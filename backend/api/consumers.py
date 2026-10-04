import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from django.db import transaction
from django.db.models import Q

from api.models import ChatMessage, Profile, User, Relationship
from api.serializers import MessageSerializer, ProfileSerializer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

@database_sync_to_async
def _get_user_by_id(user_id):
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None


@database_sync_to_async
def _check_message_allowed_async(sender_id, receiver_id):
    """
    Returns None if messaging is allowed, or an error string.
    Relationship must be ACCEPTED; BLOCKED or PENDING => error.
    """
    try:
        sender = User.objects.get(id=sender_id)
        receiver = User.objects.get(id=receiver_id)
    except User.DoesNotExist:
        return "User not found."

    rel = Relationship.get_for_users(sender, receiver)
    if rel is None:
        return "You must be connected to send messages."
    if rel.status == Relationship.STATUS_PENDING:
        return "Chat request has not been accepted yet."
    if rel.status == Relationship.STATUS_BLOCKED:
        if rel.blocked_by_id == receiver.id:
            return "You have been blocked by this user."
        return "You have blocked this user. Unblock to send messages."
    return None


@database_sync_to_async
def _create_message(sender, receiver, message):
    """
    Persist a ChatMessage.
    sender/receiver are User instances from authenticated scope.
    """
    chat_message = ChatMessage.objects.create(
        sender=sender,
        reciever=receiver,
        message=message,
    )
    return MessageSerializer(chat_message).data


@database_sync_to_async
def _build_inbox_entry(current_user_id, other_user_id):
    """
    Build a sidebar Inbox_Entry tailored to current_user_id.
    Returns None if no messages exist yet.
    """
    try:
        other_profile = Profile.objects.select_related("user").get(user_id=other_user_id)
    except Profile.DoesNotExist:
        return None

    latest = (
        ChatMessage.objects.filter(
            Q(sender_id=current_user_id, reciever_id=other_user_id)
            | Q(sender_id=other_user_id, reciever_id=current_user_id)
        )
        .order_by("-date")
        .first()
    )

    if latest is None:
        return None

    unread_count = ChatMessage.objects.filter(
        sender_id=other_user_id,
        reciever_id=current_user_id,
        is_read=False,
    ).count()

    return {
        "type": "inbox_update",
        "other_user_id": other_user_id,
        "other_user": ProfileSerializer(other_profile).data,
        "latest_message": (latest.message or "")[:200],
        "timestamp": latest.date.isoformat(),
        "unread_count": unread_count,
    }


@database_sync_to_async
def _build_request_event(relationship_id, for_user_id):
    """
    Build a chat_request event payload for the recipient of a request.
    for_user_id is the recipient's user ID.
    """
    try:
        rel = Relationship.objects.select_related(
            "requested_by", "user_a", "user_b"
        ).get(id=relationship_id)
    except Relationship.DoesNotExist:
        return None

    sender = rel.requested_by
    try:
        sender_profile = Profile.objects.select_related("user").get(user=sender)
        sender_profile_data = ProfileSerializer(sender_profile).data
    except Profile.DoesNotExist:
        sender_profile_data = None

    return {
        "type": "chat_request",
        "request_id": rel.id,
        "sender_id": sender.id,
        "sender_profile": sender_profile_data,
        "message": rel.request_message,
    }


@database_sync_to_async
def _build_request_accepted_event(relationship_id, accepted_by_id):
    """
    Build a chat_request_accepted event for the original requester.
    """
    try:
        rel = Relationship.objects.select_related("user_a", "user_b", "requested_by").get(id=relationship_id)
    except Relationship.DoesNotExist:
        return None

    accepter_id = accepted_by_id
    try:
        accepter_profile = Profile.objects.select_related("user").get(user_id=accepter_id)
        accepter_profile_data = ProfileSerializer(accepter_profile).data
    except Profile.DoesNotExist:
        accepter_profile_data = None

    return {
        "type": "chat_request_accepted",
        "request_id": rel.id,
        "accepted_by_id": accepter_id,
        "accepted_by_profile": accepter_profile_data,
    }


# ---------------------------------------------------------------------------
# ChatConsumer  (existing, with relationship auth added to receive)
# ---------------------------------------------------------------------------

class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope["user"]

        if user.is_anonymous:
            await self.close()
            return

        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = self.room_name

        # Parse participant IDs from room name: "chat_<id_a>_<id_b>"
        try:
            _, id_a, id_b = self.room_name.split("_")
            self.room_user_ids = {int(id_a), int(id_b)}
        except (ValueError, AttributeError):
            self.room_user_ids = set()

        if self.room_user_ids and user.id not in self.room_user_ids:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({
            "type": "connection",
            "message": f"Connected to {self.room_name}",
            "user_id": user.id,
        }))

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_text = data.get("message", "").strip()
        receiver_id_raw = data.get("receiver")

        # Sender ALWAYS from authenticated WebSocket user
        sender = self.scope["user"]

        if not message_text:
            return

        try:
            receiver_id = int(receiver_id_raw)
        except (TypeError, ValueError):
            logger.warning("ChatConsumer: invalid receiver_id %r from user %s", receiver_id_raw, sender.id)
            return

        if receiver_id == sender.id:
            logger.warning("ChatConsumer: self-send rejected for user %s", sender.id)
            return

        if self.room_user_ids and receiver_id not in self.room_user_ids:
            logger.warning("ChatConsumer: receiver %s not in room %s", receiver_id, self.room_name)
            return

        # Relationship authorization - must be ACCEPTED
        error = await _check_message_allowed_async(sender.id, receiver_id)
        if error:
            await self.send(text_data=json.dumps({"type": "error", "detail": error}))
            logger.warning("ChatConsumer: message blocked for user %s -> %s: %s", sender.id, receiver_id, error)
            return

        receiver = await _get_user_by_id(receiver_id)
        if receiver is None:
            logger.warning("ChatConsumer: receiver %s not found", receiver_id)
            return

        logger.info(
            "Creating message: sender=%s(%s) receiver=%s(%s) room=%s",
            sender.id, sender.username, receiver.id, receiver.username, self.room_name
        )

        chat_message = await _create_message(sender, receiver, message_text)

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "chat_message", "message": chat_message},
        )

        await self._notify_inbox(sender.id, receiver.id)

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": event["message"],
        }))

    async def _notify_inbox(self, sender_id, receiver_id):
        for current_id, other_id in [(sender_id, receiver_id), (receiver_id, sender_id)]:
            try:
                entry = await _build_inbox_entry(current_id, other_id)
                if entry is None:
                    continue
                await self.channel_layer.group_send(
                    f"inbox_{current_id}",
                    {"type": "inbox_update", "payload": entry},
                )
            except Exception as exc:
                logger.error("Failed to send inbox_update to inbox_%s: %s", current_id, exc)

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)


# ---------------------------------------------------------------------------
# InboxConsumer  (extended with request event handlers)
# ---------------------------------------------------------------------------

class InboxConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope["user"]

        if not user or user.is_anonymous:
            await self.close(code=4001)
            return

        url_user_id = self.scope["url_route"]["kwargs"].get("user_id")
        try:
            url_user_id = int(url_user_id)
        except (TypeError, ValueError):
            await self.close(code=4003)
            return

        if url_user_id != user.id:
            await self.close(code=4003)
            return

        self.inbox_group_name = f"inbox_{user.id}"
        await self.channel_layer.group_add(self.inbox_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "inbox_group_name"):
            await self.channel_layer.group_discard(self.inbox_group_name, self.channel_name)

    # ----- channel-layer event handlers -----

    async def inbox_update(self, event):
        """Normal inbox sidebar update."""
        await self.send(text_data=json.dumps(event["payload"]))

    async def chat_request(self, event):
        """New chat request received by this user."""
        await self.send(text_data=json.dumps(event["payload"]))

    async def chat_request_accepted(self, event):
        """Requester is notified that their request was accepted."""
        await self.send(text_data=json.dumps(event["payload"]))

    async def chat_request_blocked(self, event):
        """Requester/other user is notified of a block."""
        await self.send(text_data=json.dumps(event["payload"]))

    async def chat_unblocked(self, event):
        """Previously blocked user is notified of unblock."""
        await self.send(text_data=json.dumps(event["payload"]))
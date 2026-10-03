import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from django.db.models import Q

from api.models import ChatMessage, Profile, User
from api.serializers import MessageSerializer, ProfileSerializer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@database_sync_to_async
def _get_user_by_id(user_id):
    """Return a User instance or None."""
    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist:
        return None


@database_sync_to_async
def _create_message(sender, receiver, message):
    """
    Persist a ChatMessage and return its serialized form.

    sender   - User instance from scope["user"]  (authoritative)
    receiver - User instance validated before calling this
    message  - str
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
    Build a sidebar Inbox_Entry tailored to current_user_id's perspective.

    Payload fields:
      type            "inbox_update"
      other_user_id   int  - the conversation partner's user PK (explicit)
      other_user      ProfileSerializer data for the conversation partner
      latest_message  str  - up to 200 chars of the latest message body
      timestamp       str  - ISO-8601 datetime of the latest message
      unread_count    int  - COUNT(msg where sender=other, reciever=current,
                             is_read=False); always 0 for the sender's event
    """
    try:
        other_profile = Profile.objects.select_related("user").get(
            user_id=other_user_id
        )
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


# ---------------------------------------------------------------------------
# ChatConsumer
# ---------------------------------------------------------------------------

class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope["user"]

        if user.is_anonymous:
            await self.close()
            return

        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = self.room_name

        # Parse the two participant IDs out of the room name.
        # Room format: "chat_<id_a>_<id_b>" where id_a < id_b.
        # We store them so receive() can verify the receiver is a room member.
        try:
            _, id_a, id_b = self.room_name.split("_")
            self.room_user_ids = {int(id_a), int(id_b)}
        except (ValueError, AttributeError):
            self.room_user_ids = set()

        # Verify the connecting user is actually one of the room participants
        if self.room_user_ids and user.id not in self.room_user_ids:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name,
        )

        await self.accept()

        await self.send(
            text_data=json.dumps({
                "type": "connection",
                "message": f"Connected to {self.room_name}",
                "user_id": user.id,
            })
        )

    async def receive(self, text_data):
        data = json.loads(text_data)

        message_text = data.get("message", "").strip()
        receiver_id_raw = data.get("receiver")

        # --- Sender: ALWAYS from the authenticated WebSocket user ---
        sender = self.scope["user"]

        # Validate message content
        if not message_text:
            return

        # Validate receiver_id is present and numeric
        try:
            receiver_id = int(receiver_id_raw)
        except (TypeError, ValueError):
            logger.warning("ChatConsumer.receive: invalid receiver_id %r from user %s", receiver_id_raw, sender.id)
            return

        # Reject self-send
        if receiver_id == sender.id:
            logger.warning("ChatConsumer.receive: self-send rejected for user %s", sender.id)
            return

        # Verify receiver is the OTHER participant in this room
        if self.room_user_ids and receiver_id not in self.room_user_ids:
            logger.warning(
                "ChatConsumer.receive: receiver %s is not a member of room %s (user %s)",
                receiver_id, self.room_name, sender.id
            )
            return

        # Fetch receiver User object
        receiver = await _get_user_by_id(receiver_id)
        if receiver is None:
            logger.warning("ChatConsumer.receive: receiver %s not found", receiver_id)
            return

        logger.info(
            "Creating message: sender=%s(%s) receiver=%s(%s) room=%s",
            sender.id, sender.username, receiver.id, receiver.username, self.room_name
        )

        # Persist - sender comes from scope["user"], never from the payload
        chat_message = await _create_message(sender, receiver, message_text)

        # Deliver to chat room (existing behaviour - unchanged)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": chat_message,
            }
        )

        # Push sidebar-only inbox_update to both participants
        await self._notify_inbox(sender.id, receiver.id)

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps({
                "type": "message",
                "message": event["message"],
            })
        )

    async def _notify_inbox(self, sender_id, receiver_id):
        """
        Send a tailored inbox_update to each participant's inbox group.

        sender   -> current_user_id=sender_id,   other_user_id=receiver_id
        receiver -> current_user_id=receiver_id, other_user_id=sender_id
        """
        for current_id, other_id in [
            (sender_id, receiver_id),
            (receiver_id, sender_id),
        ]:
            try:
                entry = await _build_inbox_entry(current_id, other_id)
                if entry is None:
                    continue
                await self.channel_layer.group_send(
                    f"inbox_{current_id}",
                    {"type": "inbox_update", "payload": entry},
                )
            except Exception as exc:
                logger.error(
                    "Failed to send inbox_update to inbox_%s: %s",
                    current_id,
                    exc,
                )

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name,
            )


# ---------------------------------------------------------------------------
# InboxConsumer  (user-level private notification channel)
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

        await self.channel_layer.group_add(
            self.inbox_group_name,
            self.channel_name,
        )

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "inbox_group_name"):
            await self.channel_layer.group_discard(
                self.inbox_group_name,
                self.channel_name,
            )

    async def inbox_update(self, event):
        """Forward the tailored inbox payload to the WebSocket client."""
        await self.send(text_data=json.dumps(event["payload"]))
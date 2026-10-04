from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import OuterRef, Subquery, Q

from api.models import User, Profile, ChatMessage, Relationship
from api.serializers import (
    MessageSerializer,
    MyTokenObtainPairSerializer,
    ProfileSerializer,
    RegisterSerializer,
    RelationshipSerializer,
)

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


# ---------------------------------------------------------------------------
# Inbox / Messages
# ---------------------------------------------------------------------------

class MyInbox(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_id = self.kwargs["user_id"]
        if str(self.request.user.id) != str(user_id):
            return ChatMessage.objects.none()

        latest_msg_ids = (
            User.objects.filter(
                Q(sender__reciever=user_id) | Q(reciever__sender=user_id)
            )
            .distinct()
            .annotate(
                last_msg=Subquery(
                    ChatMessage.objects.filter(
                        Q(sender=OuterRef("id"), reciever=user_id)
                        | Q(reciever=OuterRef("id"), sender=user_id)
                    )
                    .order_by("-date")[:1]
                    .values_list("id", flat=True)
                )
            )
            .values_list("last_msg", flat=True)
        )

        return ChatMessage.objects.filter(id__in=latest_msg_ids).order_by("-date")

    def list(self, request, *args, **kwargs):
        user_id = self.kwargs["user_id"]
        if str(request.user.id) != str(user_id):
            return Response(
                {"detail": "You do not have permission to view this inbox."},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = self.get_queryset()
        current_user_id = request.user.id
        result = []
        for msg in queryset:
            other_user_id = msg.reciever_id if msg.sender_id == current_user_id else msg.sender_id
            unread_count = ChatMessage.objects.filter(
                sender_id=other_user_id,
                reciever_id=current_user_id,
                is_read=False,
            ).count()
            serialized = MessageSerializer(msg).data
            serialized["unread_count"] = unread_count
            serialized["other_user_id"] = other_user_id
            result.append(serialized)
        return Response(result)


class GetMessages(generics.ListAPIView):
    """
    GET /api/get-messages/<sender_id>/<reciever_id>/

    FIX: Verify request.user is one of the two participants, then check
    the relationship.  ACCEPTED only; NONE / PENDING / BLOCKED => 403.
    Do not trust the URL params as an authorization boundary.
    """
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        me = request.user
        sender_id_raw = self.kwargs["sender_id"]
        reciever_id_raw = self.kwargs["reciever_id"]

        try:
            sender_id = int(sender_id_raw)
            reciever_id = int(reciever_id_raw)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid user IDs."}, status=status.HTTP_400_BAD_REQUEST)

        # request.user must be one of the two participants
        if me.id not in (sender_id, reciever_id):
            return Response(
                {"detail": "You are not a participant in this conversation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Identify the other participant
        other_id = reciever_id if me.id == sender_id else sender_id

        try:
            other = User.objects.get(id=other_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        # Relationship must be ACCEPTED; anything else is forbidden
        rel = Relationship.get_for_users(me, other)
        if rel is None:
            return Response(
                {"detail": "You must be connected to view messages."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rel.status == Relationship.STATUS_PENDING:
            return Response(
                {"detail": "Chat request has not been accepted yet."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if rel.status == Relationship.STATUS_BLOCKED:
            return Response(
                {"detail": "Cannot view messages while blocked."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ACCEPTED - return messages
        messages = ChatMessage.objects.filter(
            sender__in=[sender_id, reciever_id],
            reciever__in=[sender_id, reciever_id],
        )
        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)


class SendMessages(APIView):
    """
    POST /api/send-messages/
    Sender = request.user. Requires ACCEPTED relationship.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sender = request.user
        reciever_id = request.data.get("reciever")
        message_text = (request.data.get("message") or "").strip()

        if not message_text:
            return Response({"detail": "message is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not reciever_id:
            return Response({"detail": "reciever is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reciever_id = int(reciever_id)
        except (TypeError, ValueError):
            return Response({"detail": "reciever must be a valid user ID."}, status=status.HTTP_400_BAD_REQUEST)

        if reciever_id == sender.id:
            return Response({"detail": "Cannot send a message to yourself."}, status=status.HTTP_400_BAD_REQUEST)

        reciever = get_object_or_404(User, id=reciever_id)
        error = _check_message_allowed(sender, reciever)
        if error:
            return Response({"detail": error}, status=status.HTTP_403_FORBIDDEN)

        chat_message = ChatMessage.objects.create(sender=sender, reciever=reciever, message=message_text)
        return Response(MessageSerializer(chat_message).data, status=status.HTTP_201_CREATED)


class MarkAsRead(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, other_user_id):
        current_user = request.user
        if other_user_id == current_user.id:
            return Response({"detail": "Cannot mark your own messages as read."}, status=status.HTTP_403_FORBIDDEN)
        other_user = get_object_or_404(User, id=other_user_id)
        updated_count = ChatMessage.objects.filter(
            sender=other_user, reciever=current_user, is_read=False,
        ).update(is_read=True)
        return Response({"updated": updated_count}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Profile / Search
# ---------------------------------------------------------------------------

class ProfileDetail(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    queryset = Profile.objects.all()


class SearchUser(generics.ListAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    queryset = Profile.objects.all()

    def list(self, request, *args, **kwargs):
        username = self.kwargs["username"]
        logged_in_user = self.request.user
        users = Profile.objects.filter(
            Q(user__username__icontains=username)
            | Q(full_name__icontains=username)
            | Q(user__email__icontains=username)
            & ~Q(user=logged_in_user)
        )
        if not users.exists():
            return Response({"detail": "No users found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(users, many=True).data)


# ---------------------------------------------------------------------------
# Shared helper
# ---------------------------------------------------------------------------

def _check_message_allowed(sender, receiver):
    """Return None if messaging is allowed; return an error string otherwise."""
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


def _push_ws_event(group_name, payload):
    """Fire-and-forget: push a channel-layer event to an inbox group."""
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name,
            {"type": payload["type"].replace("-", "_"), "payload": payload},
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("WS push to %s failed: %s", group_name, exc)


# ---------------------------------------------------------------------------
# Relationship views
# ---------------------------------------------------------------------------

class RelationshipStatus(APIView):
    """GET /api/relationship/<other_user_id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, other_user_id):
        me = request.user
        other = get_object_or_404(User, id=other_user_id)
        if me.id == other.id:
            return Response({"detail": "Cannot query relationship with yourself."}, status=status.HTTP_400_BAD_REQUEST)

        rel = Relationship.get_for_users(me, other)
        if rel is None:
            return Response({"status": "none", "other_user_id": other_user_id})

        data = RelationshipSerializer(rel).data
        data["other_user_id"] = other_user_id
        data["i_am_requester"] = (rel.requested_by_id == me.id)
        data["i_am_blocked_by"] = (rel.status == Relationship.STATUS_BLOCKED and rel.blocked_by_id != me.id)
        data["i_am_blocker"] = (rel.status == Relationship.STATUS_BLOCKED and rel.blocked_by_id == me.id)
        return Response(data)


class SendChatRequest(APIView):
    """POST /api/relationship/request/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        me = request.user
        to_user_id = request.data.get("to_user_id")
        message_text = (request.data.get("message") or "").strip()

        if not to_user_id:
            return Response({"detail": "to_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            to_user_id = int(to_user_id)
        except (TypeError, ValueError):
            return Response({"detail": "to_user_id must be a valid user ID."}, status=status.HTTP_400_BAD_REQUEST)
        if to_user_id == me.id:
            return Response({"detail": "Cannot send a request to yourself."}, status=status.HTTP_400_BAD_REQUEST)
        if not message_text:
            return Response({"detail": "An initial message is required."}, status=status.HTTP_400_BAD_REQUEST)

        other = get_object_or_404(User, id=to_user_id)
        user_a, user_b = Relationship.canonical_pair(me, other)

        with transaction.atomic():
            rel = Relationship.objects.select_for_update().filter(user_a=user_a, user_b=user_b).first()
            if rel is not None:
                if rel.status == Relationship.STATUS_BLOCKED:
                    return Response({"detail": "Cannot send a request while blocked."}, status=status.HTTP_403_FORBIDDEN)
                if rel.status == Relationship.STATUS_PENDING:
                    return Response({"detail": "A request already exists."}, status=status.HTTP_409_CONFLICT)
                if rel.status == Relationship.STATUS_ACCEPTED:
                    return Response({"detail": "You are already connected."}, status=status.HTTP_409_CONFLICT)

            rel = Relationship.objects.create(
                user_a=user_a,
                user_b=user_b,
                status=Relationship.STATUS_PENDING,
                requested_by=me,
                request_message=message_text,
            )

        try:
            me_profile = Profile.objects.select_related("user").get(user=me)
            me_profile_data = ProfileSerializer(me_profile).data
        except Profile.DoesNotExist:
            me_profile_data = None

        _push_ws_event(f"inbox_{other.id}", {
            "type": "chat_request",
            "request_id": rel.id,
            "sender_id": me.id,
            "sender_profile": me_profile_data,
            "message": message_text,
        })

        return Response(RelationshipSerializer(rel).data, status=status.HTTP_201_CREATED)


class IncomingRequests(APIView):
    """GET /api/relationship/requests/incoming/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        me = request.user
        rels = Relationship.objects.filter(
            status=Relationship.STATUS_PENDING,
        ).filter(
            Q(user_a=me) | Q(user_b=me)
        ).exclude(requested_by=me).select_related(
            "user_a", "user_b", "requested_by"
        ).order_by("-created_at")

        # Enrich each result with the sender's ProfileSerializer data so the
        # frontend gets the same shape as the WS chat_request event payload.
        result = []
        for rel in rels:
            data = RelationshipSerializer(rel).data
            try:
                sender_profile = Profile.objects.select_related("user").get(
                    user=rel.requested_by
                )
                data["sender_profile"] = ProfileSerializer(sender_profile).data
            except Profile.DoesNotExist:
                data["sender_profile"] = None
            result.append(data)

        return Response(result)


class AcceptRequest(APIView):
    """
    POST /api/relationship/<relationship_id>/accept/

    FIX: Create the initial ChatMessage with is_read=True because the
    recipient is actively accepting and will immediately view the conversation.
    This prevents a spurious unread badge on the recipient's sidebar.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, relationship_id):
        me = request.user
        rel = get_object_or_404(Relationship, id=relationship_id)

        if me.id not in (rel.user_a_id, rel.user_b_id):
            return Response({"detail": "Not a participant."}, status=status.HTTP_403_FORBIDDEN)
        if rel.requested_by_id == me.id:
            return Response({"detail": "Requester cannot accept their own request."}, status=status.HTTP_403_FORBIDDEN)
        if rel.status != Relationship.STATUS_PENDING:
            return Response({"detail": f"Cannot accept a {rel.status} relationship."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            rel.status = Relationship.STATUS_ACCEPTED
            rel.save(update_fields=["status", "updated_at"])

            # FIX: is_read=True — the recipient just accepted and is present.
            # The requester (sender of the initial message) is unaffected;
            # their own outgoing message is never counted as unread for them.
            initial_msg = ChatMessage.objects.create(
                sender=rel.requested_by,
                reciever=me,
                message=rel.request_message,
                is_read=True,
            )

        requester = rel.requested_by

        try:
            me_profile = Profile.objects.select_related("user").get(user=me)
            me_profile_data = ProfileSerializer(me_profile).data
        except Profile.DoesNotExist:
            me_profile_data = None

        _push_ws_event(f"inbox_{requester.id}", {
            "type": "chat_request_accepted",
            "request_id": rel.id,
            "accepted_by_id": me.id,
            "accepted_by_profile": me_profile_data,
        })

        for current_id, other_id in [(me.id, requester.id), (requester.id, me.id)]:
            _notify_inbox_sync(current_id, other_id)

        return Response({
            "relationship": RelationshipSerializer(rel).data,
            "initial_message": MessageSerializer(initial_msg).data,
        }, status=status.HTTP_200_OK)


class BlockUser(APIView):
    """
    POST /api/relationship/block/
    Body: { "other_user_id": <int> }

    Allowed transitions:
      NONE     -> BLOCKED  (proactive block of a stranger; either user)
      ACCEPTED -> BLOCKED  (either participant may block)
      PENDING  -> BLOCKED  (FIX: ONLY the RECIPIENT may block; requester may NOT)

    The PENDING restriction is enforced here, not only in the frontend.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        me = request.user
        other_user_id = request.data.get("other_user_id")

        try:
            other_user_id = int(other_user_id)
        except (TypeError, ValueError):
            return Response({"detail": "other_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if other_user_id == me.id:
            return Response({"detail": "Cannot block yourself."}, status=status.HTTP_400_BAD_REQUEST)

        other = get_object_or_404(User, id=other_user_id)
        user_a, user_b = Relationship.canonical_pair(me, other)

        with transaction.atomic():
            rel, created = Relationship.objects.select_for_update().get_or_create(
                user_a=user_a,
                user_b=user_b,
                defaults={
                    # NONE -> BLOCKED (proactive block)
                    "status": Relationship.STATUS_BLOCKED,
                    "requested_by": me,
                    "blocked_by": me,
                },
            )

            if not created:
                if rel.status == Relationship.STATUS_BLOCKED:
                    if rel.blocked_by_id == me.id:
                        return Response({"detail": "Already blocked."}, status=status.HTTP_409_CONFLICT)
                    # The other user blocked me; I cannot re-block
                    return Response({"detail": "You have been blocked by this user."}, status=status.HTTP_403_FORBIDDEN)

                if rel.status == Relationship.STATUS_PENDING:
                    # FIX: Only the RECIPIENT (not the requester) may block
                    # a pending request.  The requester cannot use BlockUser to
                    # circumvent the pending state machine.
                    if rel.requested_by_id == me.id:
                        return Response(
                            {"detail": "You cannot block the recipient of your own pending request. Cancel the request first or wait for a response."},
                            status=status.HTTP_403_FORBIDDEN,
                        )
                    # me is the recipient -> allowed to block

                # ACCEPTED or PENDING-recipient: transition to BLOCKED
                rel.status = Relationship.STATUS_BLOCKED
                rel.blocked_by = me
                rel.save(update_fields=["status", "blocked_by", "updated_at"])

        _push_ws_event(f"inbox_{other.id}", {
            "type": "chat_request_blocked",
            "blocked_by_id": me.id,
        })

        return Response(RelationshipSerializer(rel).data, status=status.HTTP_200_OK)


class UnblockUser(APIView):
    """POST /api/relationship/unblock/"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        me = request.user
        other_user_id = request.data.get("other_user_id")

        try:
            other_user_id = int(other_user_id)
        except (TypeError, ValueError):
            return Response({"detail": "other_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if other_user_id == me.id:
            return Response({"detail": "Cannot unblock yourself."}, status=status.HTTP_400_BAD_REQUEST)

        other = get_object_or_404(User, id=other_user_id)
        user_a, user_b = Relationship.canonical_pair(me, other)
        rel = get_object_or_404(Relationship, user_a=user_a, user_b=user_b)

        if rel.status != Relationship.STATUS_BLOCKED:
            return Response({"detail": "This user is not blocked."}, status=status.HTTP_400_BAD_REQUEST)
        if rel.blocked_by_id != me.id:
            return Response({"detail": "Only the user who performed the block may unblock."}, status=status.HTTP_403_FORBIDDEN)

        rel.delete()

        _push_ws_event(f"inbox_{other.id}", {
            "type": "chat_unblocked",
            "unblocked_by_id": me.id,
        })

        return Response({"status": "none", "other_user_id": other_user_id}, status=status.HTTP_200_OK)


class BlockedUsers(APIView):
    """GET /api/relationship/blocked/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        me = request.user
        rels = Relationship.objects.filter(
            status=Relationship.STATUS_BLOCKED, blocked_by=me,
        ).select_related("user_a", "user_b")
        result = []
        for rel in rels:
            other = rel.user_b if rel.user_a_id == me.id else rel.user_a
            try:
                profile = Profile.objects.get(user=other)
                result.append(ProfileSerializer(profile).data)
            except Profile.DoesNotExist:
                pass
        return Response(result)


# ---------------------------------------------------------------------------
# Sync helper: push inbox_update from synchronous view code
# ---------------------------------------------------------------------------

def _notify_inbox_sync(current_user_id, other_user_id):
    """Build and push an inbox_update event from synchronous view code."""
    try:
        other_profile = Profile.objects.select_related("user").get(user_id=other_user_id)
    except Profile.DoesNotExist:
        return

    latest = (
        ChatMessage.objects.filter(
            Q(sender_id=current_user_id, reciever_id=other_user_id)
            | Q(sender_id=other_user_id, reciever_id=current_user_id)
        )
        .order_by("-date")
        .first()
    )

    if latest is None:
        return

    unread_count = ChatMessage.objects.filter(
        sender_id=other_user_id,
        reciever_id=current_user_id,
        is_read=False,
    ).count()

    payload = {
        "type": "inbox_update",
        "other_user_id": other_user_id,
        "other_user": ProfileSerializer(other_profile).data,
        "latest_message": (latest.message or "")[:200],
        "timestamp": latest.date.isoformat(),
        "unread_count": unread_count,
    }

    _push_ws_event(f"inbox_{current_user_id}", payload)
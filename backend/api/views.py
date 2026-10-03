from django.shortcuts import get_object_or_404
from django.db.models import OuterRef, Subquery, Q

from api.models import User, Profile, ChatMessage
from api.serializers import (
    MessageSerializer,
    MyTokenObtainPairSerializer,
    ProfileSerializer,
    RegisterSerializer,
)

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer


class MyInbox(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_id = self.kwargs["user_id"]

        if str(self.request.user.id) != str(user_id):
            return ChatMessage.objects.none()

        # One latest message per distinct conversation partner
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

        return ChatMessage.objects.filter(
            id__in=latest_msg_ids
        ).order_by("-date")

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
            if msg.sender_id == current_user_id:
                other_user_id = msg.reciever_id
            else:
                other_user_id = msg.sender_id

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
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        sender_id = self.kwargs["sender_id"]
        reciever_id = self.kwargs["reciever_id"]

        messages = ChatMessage.objects.filter(
            sender__in=[sender_id, reciever_id],
            reciever__in=[sender_id, reciever_id],
        )

        return messages


class SendMessages(APIView):
    """
    POST /api/send-messages/

    Creates a ChatMessage.  The sender is ALWAYS request.user (the
    authenticated user).  The client only supplies reciever and message;
    any sender field in the request body is ignored.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sender = request.user

        reciever_id = request.data.get("reciever")
        message_text = request.data.get("message", "").strip()

        if not message_text:
            return Response(
                {"detail": "message is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not reciever_id:
            return Response(
                {"detail": "reciever is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reciever_id = int(reciever_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "reciever must be a valid user ID."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent self-messaging
        if reciever_id == sender.id:
            return Response(
                {"detail": "Cannot send a message to yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reciever = get_object_or_404(User, id=reciever_id)

        chat_message = ChatMessage.objects.create(
            sender=sender,
            reciever=reciever,
            message=message_text,
        )

        serializer = MessageSerializer(chat_message)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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
            return Response(
                {"detail": "No users found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = self.get_serializer(users, many=True)
        return Response(serializer.data)


class MarkAsRead(APIView):
    """
    PATCH /api/messages/read/<other_user_id>/

    Marks all messages sent BY <other_user_id> TO the authenticated user
    as read.  Uses request.user as the receiver; never trusts the client
    to supply the receiver identity.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, other_user_id):
        current_user = request.user

        if other_user_id == current_user.id:
            return Response(
                {"detail": "Cannot mark your own messages as read."},
                status=status.HTTP_403_FORBIDDEN,
            )

        other_user = get_object_or_404(User, id=other_user_id)

        updated_count = ChatMessage.objects.filter(
            sender=other_user,
            reciever=current_user,
            is_read=False,
        ).update(is_read=True)

        return Response({"updated": updated_count}, status=status.HTTP_200_OK)


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer
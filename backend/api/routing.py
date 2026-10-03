from django.urls import path

from .consumers import ChatConsumer, InboxConsumer


websocket_urlpatterns = [
    path(
        "ws/chat/<str:room_name>/",
        ChatConsumer.as_asgi(),
    ),
    path(
        "ws/inbox/<int:user_id>/",
        InboxConsumer.as_asgi(),
    ),
]

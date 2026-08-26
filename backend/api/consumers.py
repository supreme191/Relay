from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from api.models import ChatMessage
from api.serializers import MessageSerializer

import json


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope["user"]

        if user.is_anonymous:
            await self.close()
            return

        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]

        self.room_group_name = self.room_name

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

        message = data.get("message")

        sender_id = data.get("sender")
        receiver_id = data.get("receiver")

        chat_message = await self.create_message(
            sender_id,
            receiver_id,
            message,
        )

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": chat_message,
            }
        )

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps({
                "type": "message",
                "message": event["message"],
            })
        )

    @database_sync_to_async
    def create_message(self, sender_id, receiver_id, message):
        chat_message = ChatMessage.objects.create(
            sender_id=sender_id,
            reciever_id=receiver_id,
            message=message,
        )

        serializer = MessageSerializer(
            chat_message
        )

        return serializer.data

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name,
            )
import { useEffect, useRef, useState } from "react";

import Sidebar from "../components/chat/Sidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";

import { useAuth } from "../context/AuthContext";

import { createChatSocket } from "../services/websocketService";

const Chat = () => {
    const { user } = useAuth();

    const socketRef = useRef(null);

    const [selectedUser, setSelectedUser] = useState(null);
    const [newMessage, setNewMessage] = useState(null);

    const [messageRefresh, setMessageRefresh] = useState(0);
    const [inboxRefresh, setInboxRefresh] = useState(0);

    const handleMessageSent = () => {
        setMessageRefresh((previous) => previous + 1);
        setInboxRefresh((previous) => previous + 1);
    };

    useEffect(() => {
        if (!selectedUser || !user) {
            return;
        }

        const currentUserId = user.user_id;
        const selectedUserId = selectedUser.user.id;

        const roomName = [currentUserId, selectedUserId]
            .sort((a, b) => a - b)
            .join("_");

        const socket = createChatSocket(
            `chat_${roomName}`
        );

        socketRef.current = socket;

        socket.onopen = () => {
            console.log(
                "🔥 Chat WebSocket connected:",
                `chat_${roomName}`
            );
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            console.log(
                "📨 WebSocket message:",
                data
            );

            if (data.type === "message") {
                setNewMessage(data.message);
            }
        };

        socket.onerror = (error) => {
            console.error(
                "❌ Chat WebSocket error:",
                error
            );
        };

        socket.onclose = () => {
            console.log(
                "🔌 Chat WebSocket disconnected"
            );
        };

        return () => {
            socket.close();
            socketRef.current = null;
        };
    }, [selectedUser, user]);

    return (
        <div className="h-screen bg-gray-100 flex">

            <Sidebar
                onSelectUser={setSelectedUser}
                inboxRefresh={inboxRefresh}
            />

            <main className="flex-1 flex flex-col">

                <ChatHeader selectedUser={selectedUser} />

                <MessageList
                    selectedUser={selectedUser}
                    messageRefresh={messageRefresh}
                    newMessage={newMessage}
                />

                <MessageInput
                    selectedUser={selectedUser}
                    onMessageSent={handleMessageSent}
                />

            </main>

        </div>
    );
};

export default Chat;
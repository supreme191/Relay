import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMessages } from "../../services/chatService";

const MessageList = ({ selectedUser, messageRefresh }) => {
    const { user, accessToken } = useAuth();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchMessages = async () => {
            if (!user || !accessToken || !selectedUser) {
                setMessages([]);
                return;
            }

            try {
                setLoading(true);
                setError("");

                const data = await getMessages(
                user.user_id,
                selectedUser.user.id,
                accessToken
            );

                setMessages(data);
            } catch (error) {
                console.error("Failed to load messages:", error);

                setError("Unable to load messages.");
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [user, accessToken, selectedUser, messageRefresh]);

    if (!selectedUser) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400">
                    Select a conversation to start chatting.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {loading && (
                <p className="text-center text-sm text-gray-500">
                    Loading messages...
                </p>
            )}

            {error && (
                <p className="text-center text-sm text-red-500">
                    {error}
                </p>
            )}

            {!loading && !error && messages.length === 0 && (
                <div className="h-full flex items-center justify-center">
                    <p className="text-gray-400">
                        No messages yet.
                    </p>
                </div>
            )}

            {!loading &&
                !error &&
                messages.map((message) => {
                    const isMine = String(message.sender.id) === String(user.user_id);

                    return (
                        <div
                            key={message.id}
                            className={`flex ${
                                isMine
                                    ? "justify-end"
                                    : "justify-start"
                            }`}
                        >
                            <div
                                className={`max-w-md rounded-2xl px-4 py-3 ${
                                    isMine
                                        ? "bg-blue-600 text-white rounded-br-md"
                                        : "bg-white text-gray-800 shadow-sm rounded-bl-md"
                                }`}
                            >
                                <p className="text-sm">
                                    {message.message}
                                </p>

                                <span
                                    className={`block text-xs mt-1 ${
                                        isMine
                                            ? "text-blue-100"
                                            : "text-gray-400"
                                    }`}
                                >
                                    {new Date(
                                        message.date
                                    ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>
                        </div>
                    );
                })}

        </div>
    );
};

export default MessageList;
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMessages } from "../../services/chatService";

const getDateKey = (dateString) => {
    const date = new Date(dateString);

    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

const getDateLabel = (dateString) => {
    const date = new Date(dateString);

    const today = new Date();

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const dateKey = getDateKey(dateString);
    const todayKey = getDateKey(today);
    const yesterdayKey = getDateKey(yesterday);

    if (dateKey === todayKey) {
        return "Today";
    }

    if (dateKey === yesterdayKey) {
        return "Yesterday";
    }

    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
};

const MessageList = ({ selectedUser, messageRefresh }) => {
    const { user, accessToken } = useAuth();

    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const messagesEndRef = useRef(null);

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
                selectedUser.user.id
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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "auto",
        });
    }, [messages]);

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
        <div className="flex-1 overflow-y-auto p-6">

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
                messages.map((message, index) => {
                    const isMine =
                        String(message.sender.id) === String(user.user_id);
                    
                    const previousMessage = index > 0 ? messages[index - 1] : null;

                    const isSameSender =
                        previousMessage &&
                        String(previousMessage.sender.id) ===
                            String(message.sender.id);

                    const currentDateKey = getDateKey(message.date);

                    const previousDateKey =
                        index > 0
                            ? getDateKey(messages[index - 1].date)
                            : null;

                    const showDateSeparator =
                        currentDateKey !== previousDateKey;

                    return (
                        <div key={message.id}>

                            {showDateSeparator && (
                                <div className="flex justify-center my-4">
                                    <span className="rounded-full bg-gray-200 px-4 py-1 text-xs font-medium text-gray-600 shadow-sm">
                                        {getDateLabel(message.date)}
                                    </span>
                                </div>
                            )}

                            <div
                                className={`flex ${
                                    isMine
                                        ? "justify-end"
                                        : "justify-start"
                                } ${
                                    isSameSender
                                        ? "mt-1"
                                        : "mt-3"
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
                        </div>
                    );
                })}

            <div ref={messagesEndRef} />

        </div>
    );
};

export default MessageList;
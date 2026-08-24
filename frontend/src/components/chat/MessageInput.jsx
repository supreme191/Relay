import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { sendMessage } from "../../services/chatService";

const MessageInput = ({ selectedUser, onMessageSent }) => {
    const { user, accessToken } = useAuth();

    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();

        if (!selectedUser || !message.trim()) {
            return;
        }

        try {
            setSending(true);

            await sendMessage(
                user.user_id,
                selectedUser.user.id,
                message.trim(),
                accessToken
            );

            setMessage("");

            onMessageSent();
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-white border-t border-gray-200 p-4">

            <form
                onSubmit={handleSend}
                className="flex items-center gap-3"
            >

                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                        selectedUser
                            ? "Type a message..."
                            : "Select a conversation..."
                    }
                    disabled={!selectedUser || sending}
                    className="flex-1 rounded-full bg-gray-100 px-5 py-3 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <button
                    type="submit"
                    disabled={!selectedUser || !message.trim() || sending}
                    className="rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {sending ? "Sending..." : "Send"}
                </button>

            </form>

        </div>
    );
};

export default MessageInput;
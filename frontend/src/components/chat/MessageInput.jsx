import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { sendMessage } from "../../services/chatService";

const MessageInput = ({ selectedUser, onMessageSent }) => {
    const { user, accessToken } = useAuth();

    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    const handleSend = async () => {
        const trimmedMessage = message.trim();

        if (!trimmedMessage || !selectedUser || sending) {
            return;
        }

        try {
            setSending(true);

            await sendMessage(
                user.user_id,
                selectedUser.user.id,
                trimmedMessage,
                accessToken
            );

            setMessage("");

            if (onMessageSent) {
                onMessageSent();
            }
        } catch (error) {
            console.error(
                "Failed to send message:",
                error
            );
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!selectedUser) {
        return null;
    }

    return (
        <div className="border-t border-gray-200 bg-white p-4">

            <div className="flex items-end gap-3">

                <textarea
                    value={message}
                    onChange={(e) =>
                        setMessage(e.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    disabled={sending}
                    className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                />

                <button
                    type="button"
                    onClick={handleSend}
                    disabled={
                        !message.trim() || sending
                    }
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {sending ? "Sending..." : "Send"}
                </button>

            </div>

            <p className="mt-2 text-xs text-gray-400">
                Press Enter to send • Shift + Enter for a new line
            </p>

        </div>
    );
};

export default MessageInput;
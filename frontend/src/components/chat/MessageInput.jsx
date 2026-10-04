import { useState } from "react";

/**
 * MessageInput
 *
 * Props:
 *   selectedUser      - Profile of the conversation partner
 *   socketRef         - ref to the chat WebSocket
 *   relationshipStatus - "accepted" | "pending" | "blocked" | "none" | null
 *   blockedByOther    - bool: true when the current user was blocked by the other user
 */
const MessageInput = ({
    selectedUser,
    socketRef,
    relationshipStatus,
    blockedByOther,
}) => {
    const [message, setMessage] = useState("");

    const isAccepted = relationshipStatus === "accepted";
    const isBlocked = relationshipStatus === "blocked";

    const blockedMsg = blockedByOther
        ? "You have been blocked by this user."
        : "You have blocked this user. Unblock to send messages.";

    const handleSend = () => {
        const trimmedMessage = message.trim();
        if (!trimmedMessage || !selectedUser || !isAccepted) return;

        if (
            !socketRef.current ||
            socketRef.current.readyState !== WebSocket.OPEN
        ) {
            console.error("WebSocket is not connected.");
            return;
        }

        socketRef.current.send(
            JSON.stringify({
                receiver: selectedUser.user.id,
                message: trimmedMessage,
            })
        );

        setMessage("");
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    // When blocked, show a clear disabled state with explanation
    if (isBlocked) {
        return (
            <div className="border-t bg-gray-50 p-4">
                <p className="text-center text-sm text-red-500 font-medium">
                    {blockedMsg}
                </p>
            </div>
        );
    }

    return (
        <div className="border-t bg-white p-4">
            <div className="flex items-end gap-3">
                <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isAccepted ? "Type a message..." : "Accept the chat request to send messages."}
                    disabled={!isAccepted}
                    rows={1}
                    className="flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                    onClick={handleSend}
                    disabled={!message.trim() || !selectedUser || !isAccepted}
                    className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                    Send
                </button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
                Press Enter to send • Shift + Enter for a new line
            </p>
        </div>
    );
};

export default MessageInput;
import { useState } from "react";


const MessageInput = ({
    selectedUser,
    socketRef,
}) => {
    const [message, setMessage] = useState("");

    const handleSend = () => {
        const trimmedMessage = message.trim();

        if (!trimmedMessage) {
            return;
        }

        if (!selectedUser) {
            return;
        }

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

    return (
        <div className="border-t bg-white p-4">

            <div className="flex items-end gap-3">

                <textarea
                    value={message}
                    onChange={(event) =>
                        setMessage(event.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />

                <button
                    onClick={handleSend}
                    disabled={
                        !message.trim() ||
                        !selectedUser
                    }
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
const MessageInput = () => {
    return (
        <div className="bg-white border-t border-gray-200 p-4">

            <div className="flex items-center gap-3">

                <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 rounded-full bg-gray-100 px-5 py-3 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500"
                />

                <button
                    type="button"
                    className="rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
                >
                    Send
                </button>

            </div>

        </div>
    );
};

export default MessageInput;
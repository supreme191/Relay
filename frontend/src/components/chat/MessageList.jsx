const MessageList = () => {
    return (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* Received message */}
            <div className="flex justify-start">
                <div className="max-w-md bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <p className="text-sm text-gray-800">
                        Hey! How are you?
                    </p>

                    <span className="block text-xs text-gray-400 mt-1">
                        10:29 AM
                    </span>
                </div>
            </div>

            {/* Sent message */}
            <div className="flex justify-end">
                <div className="max-w-md bg-blue-600 rounded-2xl rounded-br-md px-4 py-3 text-white">
                    <p className="text-sm">
                        I'm doing great! How about you?
                    </p>

                    <span className="block text-xs text-blue-100 mt-1">
                        10:30 AM
                    </span>
                </div>
            </div>

            {/* Received message */}
            <div className="flex justify-start">
                <div className="max-w-md bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <p className="text-sm text-gray-800">
                        I'm good too! Working on our new project.
                    </p>

                    <span className="block text-xs text-gray-400 mt-1">
                        10:30 AM
                    </span>
                </div>
            </div>

        </div>
    );
};

export default MessageList;
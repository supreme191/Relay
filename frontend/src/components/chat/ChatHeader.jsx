const ChatHeader = ({ selectedUser }) => {
    if (!selectedUser) {
        return (
            <div className="h-16 border-b border-gray-200 bg-white flex items-center px-6">
                <h2 className="text-lg font-semibold text-gray-700">
                    Relay
                </h2>
            </div>
        );
    }

    return (
        <div className="h-16 border-b border-gray-200 bg-white px-6 flex items-center">

            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                {selectedUser.full_name
                    ?.charAt(0)
                    ?.toUpperCase() || "U"}
            </div>

            <div className="ml-3 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">
                    {selectedUser.full_name || "Unknown User"}
                </h2>

                <p className="text-xs text-gray-500 truncate">
                    @{selectedUser.user?.username}
                </p>
            </div>

        </div>
    );
};

export default ChatHeader;
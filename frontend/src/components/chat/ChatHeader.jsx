const ChatHeader = ({ selectedUser }) => {
    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6">

            {selectedUser ? (
                <>
                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                        {selectedUser.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </div>

                    <div className="ml-3">
                        <h2 className="font-semibold text-gray-900">
                            {selectedUser.full_name}
                        </h2>

                        <p className="text-xs text-green-500">
                            Online
                        </p>
                    </div>
                </>
            ) : (
                <h2 className="font-semibold text-gray-500">
                    Select a conversation
                </h2>
            )}

        </header>
    );
};

export default ChatHeader;
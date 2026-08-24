const ChatHeader = () => {
    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6">

            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                JD
            </div>

            <div className="ml-3">
                <h2 className="font-semibold text-gray-900">
                    John Doe
                </h2>

                <p className="text-xs text-green-500">
                    Online
                </p>
            </div>

        </header>
    );
};

export default ChatHeader;
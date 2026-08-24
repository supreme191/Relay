const Sidebar = () => {
    return (
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">

            {/* Sidebar Header */}
            <div className="h-16 px-5 flex items-center border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">
                    Relay
                </h1>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
                <input
                    type="text"
                    placeholder="Search users..."
                    className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">

                {/* Conversation 1 */}
                <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50">
                    <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                        JD
                    </div>

                    <div className="flex-1 min-w-0">
                        <h2 className="font-medium text-gray-900">
                            John Doe
                        </h2>

                        <p className="text-sm text-gray-500 truncate">
                            Hey! How are you?
                        </p>
                    </div>

                    <span className="text-xs text-gray-400">
                        10:30
                    </span>
                </div>

                {/* Conversation 2 */}
                <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50">
                    <div className="w-11 h-11 rounded-full bg-purple-500 flex items-center justify-center text-white font-semibold">
                        AS
                    </div>

                    <div className="flex-1 min-w-0">
                        <h2 className="font-medium text-gray-900">
                            Alex Smith
                        </h2>

                        <p className="text-sm text-gray-500 truncate">
                            See you tomorrow!
                        </p>
                    </div>

                    <span className="text-xs text-gray-400">
                        09:15
                    </span>
                </div>

                {/* Conversation 3 */}
                <div className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50">
                    <div className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">
                        EM
                    </div>

                    <div className="flex-1 min-w-0">
                        <h2 className="font-medium text-gray-900">
                            Emma Miller
                        </h2>

                        <p className="text-sm text-gray-500 truncate">
                            Thanks!
                        </p>
                    </div>

                    <span className="text-xs text-gray-400">
                        Yesterday
                    </span>
                </div>

            </div>

        </aside>
    );
};

export default Sidebar;
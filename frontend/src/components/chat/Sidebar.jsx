import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getInbox, searchUsers } from "../../services/chatService";

const Sidebar = ({ onSelectUser, inboxRefresh }) => {
    const { user, accessToken, logout } = useAuth();

    const [conversations, setConversations] = useState([]);
    const [searchResults, setSearchResults] = useState([]);

    const [search, setSearch] = useState("");

    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchInbox = async () => {
            if (!user || !accessToken) {
                return;
            }

            try {
                setLoading(true);
                setError("");

                const data = await getInbox(
                    user.user_id,
                    accessToken
                );

                setConversations(data);
            } catch (error) {
                console.error("Failed to load inbox:", error);

                setError("Unable to load conversations.");
            } finally {
                setLoading(false);
            }
        };

        fetchInbox();
    }, [user, accessToken, inboxRefresh]);

    useEffect(() => {
        const fetchSearchResults = async () => {
            if (!search.trim() || !accessToken) {
                setSearchResults([]);
                return;
            }

            try {
                setSearching(true);

                const data = await searchUsers(
                    search.trim(),
                    accessToken
                );

                setSearchResults(data);
            } catch (error) {
                if (error.response?.status === 404) {
                    setSearchResults([]);
                } else {
                    console.error(
                        "Failed to search users:",
                        error
                    );
                }
            } finally {
                setSearching(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchSearchResults();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [search, accessToken]);

    const handleSelectSearchResult = (profile) => {
        onSelectUser(profile);
        setSearch("");
        setSearchResults([]);
    };

    return (
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">

            {/* Sidebar Header */}
            <div className="h-16 px-5 flex items-center justify-between border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">
                    Relay
                </h1>

                <button
                    type="button"
                    onClick={logout}
                    className="text-sm font-medium text-gray-500 hover:text-red-600 transition"
                >
                    Logout
                </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Search Results */}
            {search.trim() && (
                <div className="border-b border-gray-200">

                    {searching && (
                        <p className="px-4 py-3 text-sm text-gray-500">
                            Searching...
                        </p>
                    )}

                    {!searching && searchResults.length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-500">
                            No users found.
                        </p>
                    )}

                    {!searching &&
                        searchResults.map((profile) => (
                            <div
                                key={profile.id}
                                onClick={() =>
                                    handleSelectSearchResult(profile)
                                }
                                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                            >
                                <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                                    {profile.full_name
                                        ?.charAt(0)
                                        ?.toUpperCase() || "U"}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h2 className="font-medium text-gray-900 truncate">
                                        {profile.full_name ||
                                            "Unknown User"}
                                    </h2>

                                    <p className="text-sm text-gray-500 truncate">
                                        @{profile.user?.username}
                                    </p>
                                </div>
                            </div>
                        ))}

                </div>
            )}

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">

                {loading && (
                    <p className="p-4 text-sm text-gray-500">
                        Loading conversations...
                    </p>
                )}

                {error && (
                    <p className="p-4 text-sm text-red-500">
                        {error}
                    </p>
                )}

                {!loading &&
                    !error &&
                    conversations.length === 0 && (
                        <p className="p-4 text-sm text-gray-500">
                            No conversations yet.
                        </p>
                    )}

                {!loading &&
                    !error &&
                    conversations.map((conversation) => {

                        const otherUser =
                            String(conversation.sender.id) ===
                            String(user.user_id)
                                ? conversation.reciever_profile
                                : conversation.sender_profile;

                        return (
                            <div
                                key={conversation.id}
                                onClick={() =>
                                    onSelectUser(otherUser)
                                }
                                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                            >
                                <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                                    {otherUser?.full_name
                                        ?.charAt(0)
                                        ?.toUpperCase() || "U"}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h2 className="font-medium text-gray-900 truncate">
                                        {otherUser?.full_name ||
                                            "Unknown User"}
                                    </h2>

                                    <p className="text-sm text-gray-500 truncate">
                                        {conversation.message}
                                    </p>
                                </div>

                                <span className="text-xs text-gray-400">
                                    {new Date(
                                        conversation.date
                                    ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>
                        );
                    })}

            </div>

        </aside>
    );
};

export default Sidebar;
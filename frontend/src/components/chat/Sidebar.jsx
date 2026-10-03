import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { searchUsers, getProfile } from "../../services/chatService";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a timestamp for the sidebar.
 * Same calendar day ? HH:MM
 * Any earlier day   ? MMM D  (e.g. "Oct 3")
 */
const formatTimestamp = (isoString) => {
    if (!isoString) return "";

    const date = new Date(isoString);
    const now = new Date();

    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (isSameDay) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
};

/** Numeric unread badge, capped at 99+. */
const UnreadBadge = ({ count }) => {
    if (!count || count <= 0) return null;

    return (
        <span className="ml-1 flex-shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
            {count > 99 ? "99+" : count}
        </span>
    );
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

const Sidebar = ({
    conversations,   // [{ key, other_user_id, other_user, latest_message, timestamp, unread_count }]
    inboxLoading,
    inboxError,
    selectedUser,
    onSelectUser,
    wsDisconnected,
}) => {
    const { user, accessToken, logout } = useAuth();

    const [searchResults, setSearchResults] = useState([]);
    const [search, setSearch] = useState("");
    const [searching, setSearching] = useState(false);
    const [profile, setProfile] = useState(null);

    // Fetch own profile for the footer card
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user || !accessToken) return;
            try {
                const data = await getProfile(user.user_id);
                setProfile(data);
            } catch (err) {
                console.error("Failed to load profile:", err);
            }
        };
        fetchProfile();
    }, [user, accessToken]);

    // Debounced user search
    useEffect(() => {
        const run = async () => {
            if (!search.trim() || !accessToken) {
                setSearchResults([]);
                return;
            }
            try {
                setSearching(true);
                const data = await searchUsers(search.trim());
                setSearchResults(data);
            } catch (err) {
                if (err.response?.status === 404) {
                    setSearchResults([]);
                } else {
                    console.error("Failed to search users:", err);
                }
            } finally {
                setSearching(false);
            }
        };

        const id = setTimeout(run, 300);
        return () => clearTimeout(id);
    }, [search, accessToken]);

    const handleSelectSearchResult = (profileData) => {
        onSelectUser(profileData);
        setSearch("");
        setSearchResults([]);
    };

    // String ID of the currently open conversation partner
    const selectedUserId = selectedUser ? String(selectedUser.user.id) : null;

    return (
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col">

            {/* Header */}
            <div className="h-16 px-5 flex items-center justify-between border-b border-gray-200">
                <h1 className="text-2xl font-bold text-gray-900">Relay</h1>
                <button
                    type="button"
                    onClick={logout}
                    className="text-sm font-medium text-gray-500 hover:text-red-600 transition"
                >
                    Logout
                </button>
            </div>

            {/* Real-time disconnection banner */}
            {wsDisconnected && (
                <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-xs text-yellow-700">
                    Real-time updates unavailable. Refresh to reconnect.
                </div>
            )}

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
                        <p className="px-4 py-3 text-sm text-gray-500">Searching...</p>
                    )}
                    {!searching && searchResults.length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-500">No users found.</p>
                    )}
                    {!searching &&
                        searchResults.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => handleSelectSearchResult(p)}
                                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                            >
                                <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                    {p.full_name?.charAt(0)?.toUpperCase() || "U"}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-medium text-gray-900 truncate">
                                        {p.full_name || "Unknown User"}
                                    </h2>
                                    <p className="text-sm text-gray-500 truncate">
                                        @{p.user?.username}
                                    </p>
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
                {inboxLoading && (
                    <p className="p-4 text-sm text-gray-500">Loading conversations...</p>
                )}
                {inboxError && (
                    <p className="p-4 text-sm text-red-500">{inboxError}</p>
                )}
                {!inboxLoading && !inboxError && conversations.length === 0 && (
                    <p className="p-4 text-sm text-gray-500">No conversations yet.</p>
                )}

                {!inboxLoading &&
                    !inboxError &&
                    conversations.map((convo) => {
                        const otherUser = convo.other_user;
                        // convo.key === String(other_user_id); compare as strings
                        const isActive = convo.key === selectedUserId;
                        const hasUnread = convo.unread_count > 0;

                        return (
                            <div
                                key={convo.key}
                                onClick={() => onSelectUser(otherUser)}
                                className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition ${
                                    isActive
                                        ? "bg-blue-50 border-l-4 border-blue-500"
                                        : "hover:bg-gray-50 border-l-4 border-transparent"
                                }`}
                            >
                                {/* Avatar */}
                                <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                    {otherUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                                </div>

                                {/* Name + message preview */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                        <h2
                                            className={`truncate ${
                                                hasUnread
                                                    ? "font-bold text-gray-900"
                                                    : "font-medium text-gray-900"
                                            }`}
                                        >
                                            {otherUser?.full_name || "Unknown User"}
                                        </h2>
                                        <UnreadBadge count={convo.unread_count} />
                                    </div>
                                    <p className="text-sm text-gray-500 truncate">
                                        {convo.latest_message}
                                    </p>
                                </div>

                                {/* Timestamp */}
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                    {formatTimestamp(convo.timestamp)}
                                </span>
                            </div>
                        );
                    })}
            </div>

            {/* Own Profile Footer */}
            <div className="border-t border-gray-200 p-4">
                {profile && (
                    <Link
                        to="/profile"
                        className="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-gray-50 transition"
                    >
                        <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="font-medium text-gray-900 truncate">
                                {profile.full_name || "User"}
                            </h2>
                            <p className="text-sm text-gray-500 truncate">
                                @{profile.user?.username}
                            </p>
                        </div>
                    </Link>
                )}
            </div>

        </aside>
    );
};

export default Sidebar;

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { searchUsers, getProfile } from "../../services/chatService";
import { Link } from "react-router-dom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatTimestamp = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    if (isSameDay) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

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
    conversations,
    inboxLoading,
    inboxError,
    selectedUser,
    onSelectUser,
    wsDisconnected,
    // Incoming request props
    incomingRequests = [],   // [{ id, sender_id, sender_profile, request_message }]
    onRequestResolved,       // (relationshipId) => void — called after accept/block
}) => {
    const { user, accessToken, logout } = useAuth();

    const [searchResults, setSearchResults] = useState([]);
    const [search, setSearch] = useState("");
    const [searching, setSearching] = useState(false);
    const [profile, setProfile] = useState(null);
    // Whether the Chat Requests drawer is open
    const [requestsOpen, setRequestsOpen] = useState(false);

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
        setRequestsOpen(false);
    };

    const handleSelectRequest = (req) => {
        // Navigate to that sender's profile in the main panel.
        // ChatRequestPanel will render because the relationship is pending.
        if (req.sender_profile) {
            onSelectUser(req.sender_profile);
            setRequestsOpen(false);
        }
    };

    const pendingCount = incomingRequests.length;
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

            {/* Disconnection banner */}
            {wsDisconnected && (
                <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-xs text-yellow-700">
                    Real-time updates unavailable. Refresh to reconnect.
                </div>
            )}

            {/* ---- Chat Requests section ---- */}
            <button
                type="button"
                onClick={() => setRequestsOpen((v) => !v)}
                className={`flex items-center justify-between px-5 py-3 border-b border-gray-200 w-full text-left transition hover:bg-gray-50 ${
                    requestsOpen ? "bg-gray-50" : ""
                }`}
            >
                <div className="flex items-center gap-2">
                    {/* Bell icon */}
                    <svg
                        className={`w-4 h-4 flex-shrink-0 ${pendingCount > 0 ? "text-blue-600" : "text-gray-400"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                    </svg>
                    <span
                        className={`text-sm font-medium ${
                            pendingCount > 0 ? "text-gray-900" : "text-gray-500"
                        }`}
                    >
                        Chat Requests
                    </span>
                    {pendingCount > 0 && (
                        <span className="flex-shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                            {pendingCount > 99 ? "99+" : pendingCount}
                        </span>
                    )}
                </div>
                {/* Chevron */}
                <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${requestsOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* ---- Pending requests list (drawer) ---- */}
            {requestsOpen && (
                <div className="border-b border-gray-200 bg-gray-50 max-h-64 overflow-y-auto">
                    {pendingCount === 0 && (
                        <p className="px-5 py-4 text-sm text-gray-400">
                            No pending requests.
                        </p>
                    )}
                    {incomingRequests.map((req) => {
                        const senderName =
                            req.sender_profile?.full_name ||
                            req.sender_profile?.user?.username ||
                            "Unknown";
                        const initial = senderName.charAt(0).toUpperCase();
                        const isSelected =
                            selectedUserId &&
                            String(req.sender_id) === selectedUserId;

                        return (
                            <div
                                key={req.id}
                                onClick={() => handleSelectRequest(req)}
                                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition ${
                                    isSelected
                                        ? "bg-blue-50"
                                        : "hover:bg-white"
                                }`}
                            >
                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 mt-0.5">
                                    {initial}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                        {senderName}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {req.request_message || "Sent you a chat request"}
                                    </p>
                                </div>

                                {/* "New" dot */}
                                <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            </div>
                        );
                    })}
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
                        const isActive = convo.key === selectedUserId;
                        const hasUnread = convo.unread_count > 0;

                        return (
                            <div
                                key={convo.key}
                                onClick={() => {
                                    onSelectUser(otherUser);
                                    setRequestsOpen(false);
                                }}
                                className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition ${
                                    isActive
                                        ? "bg-blue-50 border-l-4 border-blue-500"
                                        : "hover:bg-gray-50 border-l-4 border-transparent"
                                }`}
                            >
                                <div className="w-11 h-11 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                    {otherUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                                </div>

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
import { useState } from "react";
import {
    sendChatRequest,
    acceptRequest,
    blockUser,
    unblockUser,
} from "../../services/chatService";

/**
 * ChatRequestPanel
 *
 * Shown in the main area instead of (or above) the message list when the
 * selected user has a non-ACCEPTED relationship.
 *
 * Props:
 *   relationship   - object from getRelationshipStatus(), or null (= "none")
 *   otherUser      - Profile object of the selected user
 *   onRelChange    - callback(newRelationship) after any state change
 */
const ChatRequestPanel = ({ relationship, otherUser, onRelChange }) => {
    const [requestMessage, setRequestMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const relStatus = relationship?.status ?? "none";
    const iAmRequester = relationship?.i_am_requester ?? false;
    const iAmBlockedBy = relationship?.i_am_blocked_by ?? false;
    const iAmBlocker = relationship?.i_am_blocker ?? false;
    const relationshipId = relationship?.id;
    const otherUserId = otherUser?.user?.id;

    const handleSendRequest = async () => {
        if (!requestMessage.trim()) return;
        setLoading(true);
        setError("");
        try {
            const data = await sendChatRequest(otherUserId, requestMessage.trim());
            setRequestMessage("");
            onRelChange({ ...data, i_am_requester: true, i_am_blocked_by: false, i_am_blocker: false });
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to send request.");
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await acceptRequest(relationshipId);
            onRelChange({ ...data.relationship, i_am_requester: false, i_am_blocked_by: false, i_am_blocker: false });
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to accept request.");
        } finally {
            setLoading(false);
        }
    };

    const handleBlock = async () => {
        setLoading(true);
        setError("");
        try {
            const data = await blockUser(otherUserId);
            onRelChange({ ...data, i_am_requester: false, i_am_blocked_by: false, i_am_blocker: true });
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to block user.");
        } finally {
            setLoading(false);
        }
    };

    const handleUnblock = async () => {
        setLoading(true);
        setError("");
        try {
            await unblockUser(otherUserId);
            onRelChange(null); // back to NONE
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to unblock user.");
        } finally {
            setLoading(false);
        }
    };

    // ---------- NONE: send a request ----------
    if (relStatus === "none") {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                    {otherUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                    {otherUser?.full_name || "Unknown User"}
                </h2>
                <p className="text-sm text-gray-500">Send a chat request to start a conversation.</p>

                <div className="w-full max-w-sm flex flex-col gap-2">
                    <textarea
                        value={requestMessage}
                        onChange={(e) => setRequestMessage(e.target.value)}
                        placeholder="Write an intro message..."
                        rows={3}
                        className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    {error && <p className="text-xs text-red-500">{error}</p>}
                    <button
                        onClick={handleSendRequest}
                        disabled={loading || !requestMessage.trim()}
                        className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition"
                    >
                        {loading ? "Sending..." : "Send Chat Request"}
                    </button>
                </div>
            </div>
        );
    }

    // ---------- PENDING: I am the requester ----------
    if (relStatus === "pending" && iAmRequester) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                    {otherUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{otherUser?.full_name || "Unknown User"}</h2>
                <p className="text-sm text-gray-400 italic">Request sent — waiting for them to accept.</p>
                <span className="rounded-full bg-yellow-100 text-yellow-700 px-4 py-1 text-xs font-semibold">
                    Request Sent
                </span>
            </div>
        );
    }

    // ---------- PENDING: I am the recipient ----------
    if (relStatus === "pending" && !iAmRequester) {
        const preview = relationship?.request_message || "";
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                    {otherUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{otherUser?.full_name || "Unknown User"}</h2>
                <p className="text-sm text-gray-500">Sent you a chat request:</p>
                {preview && (
                    <blockquote className="bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-700 max-w-sm w-full text-center italic">
                        "{preview}"
                    </blockquote>
                )}
                {error && <p className="text-xs text-red-500">{error}</p>}
                <div className="flex gap-3">
                    <button
                        onClick={handleAccept}
                        disabled={loading}
                        className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition"
                    >
                        {loading ? "..." : "Accept"}
                    </button>
                    <button
                        onClick={handleBlock}
                        disabled={loading}
                        className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:bg-red-300 transition"
                    >
                        {loading ? "..." : "Block"}
                    </button>
                </div>
            </div>
        );
    }

    // ---------- BLOCKED: I did the blocking ----------
    if (relStatus === "blocked" && iAmBlocker) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center text-white text-2xl font-bold">
                    {otherUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{otherUser?.full_name || "Unknown User"}</h2>
                <span className="rounded-full bg-red-100 text-red-600 px-4 py-1 text-xs font-semibold">Blocked</span>
                {error && <p className="text-xs text-red-500">{error}</p>}
                <button
                    onClick={handleUnblock}
                    disabled={loading}
                    className="mt-2 rounded-xl border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                >
                    {loading ? "..." : "Unblock"}
                </button>
            </div>
        );
    }

    // ---------- BLOCKED: I was blocked ----------
    if (relStatus === "blocked" && iAmBlockedBy) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
                <div className="w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center text-white text-2xl font-bold">
                    {otherUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{otherUser?.full_name || "Unknown User"}</h2>
                <span className="rounded-full bg-gray-200 text-gray-500 px-4 py-1 text-xs font-semibold">
                    You have been blocked by this user.
                </span>
                <p className="text-xs text-gray-400">You cannot send messages or requests.</p>
            </div>
        );
    }

    return null;
};

export default ChatRequestPanel;
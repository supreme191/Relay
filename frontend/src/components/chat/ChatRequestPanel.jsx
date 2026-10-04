import { useState } from "react";
import {
    sendChatRequest,
    acceptRequest,
    blockUser,
    unblockUser,
    deleteChat,
} from "../../services/chatService";

/**
 * ChatRequestPanel
 *
 * For ACCEPTED: renders a slim action bar (Block button) above the message list.
 * For BLOCKED:  renders a slim status bar below the message list.
 * For all other states: renders a full centered panel replacing the message area.
 *
 * Props:
 *   relationship  - object from getRelationshipStatus(), or null / { status:"none" }
 *   otherUser     - Profile object of the selected user
 *   onRelChange   - callback(newRelationship) after any state change
 *   onDeleteChat  - callback() after this user deletes the chat
 */
const ChatRequestPanel = ({
    relationship,
    otherUser,
    onRelChange,
    onDeleteChat,
}) => {
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
        setLoading(true); setError("");
        try {
            const data = await sendChatRequest(otherUserId, requestMessage.trim());
            setRequestMessage("");
            onRelChange({ ...data, i_am_requester: true, i_am_blocked_by: false, i_am_blocker: false });
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to send request.");
        } finally { setLoading(false); }
    };

    const handleAccept = async () => {
        setLoading(true); setError("");
        try {
            const data = await acceptRequest(relationshipId);
            onRelChange({ ...data.relationship, i_am_requester: false, i_am_blocked_by: false, i_am_blocker: false });
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to accept request.");
        } finally { setLoading(false); }
    };

    const handleBlock = async () => {
        setLoading(true); setError("");
        try {
            const data = await blockUser(otherUserId);
            onRelChange({ ...data, i_am_requester: false, i_am_blocked_by: false, i_am_blocker: true });
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to block user.");
        } finally { setLoading(false); }
    };

    const handleUnblock = async () => {
        setLoading(true); setError("");
        try {
            await unblockUser(otherUserId);
            onRelChange(null);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to unblock user.");
        } finally { setLoading(false); }
    };

    const handleDeleteChat = async () => {
        setLoading(true); setError("");
        try {
            await deleteChat(otherUserId);
            if (onDeleteChat) onDeleteChat();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to delete chat.");
        } finally { setLoading(false); }
    };

    // ----------------------------------------------------------------
    // ACCEPTED — slim top bar: just the Block action
    // ----------------------------------------------------------------
    if (relStatus === "accepted") {
        return (
            <div className="border-b border-gray-200 bg-white px-6 py-2 flex items-center justify-end gap-3 flex-shrink-0">
                {error && <p className="text-xs text-red-500 mr-auto">{error}</p>}
                <button
                    onClick={handleBlock}
                    disabled={loading}
                    className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 transition"
                >
                    {loading ? "..." : "Block"}
                </button>
            </div>
        );
    }

    // ----------------------------------------------------------------
    // BLOCKED (either side) — slim bottom bar shown below message list.
    // The message list itself is rendered by Chat.jsx above this bar.
    // ----------------------------------------------------------------
    if (relStatus === "blocked") {
        // Blocker: "Blocked" + Unblock + Delete Chat
        if (iAmBlocker) {
            return (
                <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-3 flex items-center gap-3">
                    <span className="rounded-full bg-red-100 text-red-600 px-3 py-0.5 text-xs font-semibold flex-shrink-0">
                        Blocked
                    </span>
                    {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
                    {!error && <span className="flex-1" />}
                    <button
                        onClick={handleUnblock}
                        disabled={loading}
                        className="text-xs font-semibold text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-white disabled:opacity-50 transition"
                    >
                        {loading ? "..." : "Unblock"}
                    </button>
                    <button
                        onClick={handleDeleteChat}
                        disabled={loading}
                        className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition"
                    >
                        {loading ? "..." : "Delete Chat"}
                    </button>
                </div>
            );
        }

        // Blocked user: status message + Delete Chat (no Unblock)
        if (iAmBlockedBy) {
            return (
                <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-3 flex items-center gap-3">
                    <span className="rounded-full bg-gray-200 text-gray-500 px-3 py-0.5 text-xs font-semibold flex-shrink-0">
                        You have been blocked by this user.
                    </span>
                    {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
                    {!error && <span className="flex-1" />}
                    <button
                        onClick={handleDeleteChat}
                        disabled={loading}
                        className="text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50 transition"
                    >
                        {loading ? "..." : "Delete Chat"}
                    </button>
                </div>
            );
        }

        // Fallback: blocked but flags not yet resolved (loading state)
        return null;
    }

    // ----------------------------------------------------------------
    // NONE — full centered panel: send a request
    // ----------------------------------------------------------------
    if (relStatus === "none") {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                    {otherUser?.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{otherUser?.full_name || "Unknown User"}</h2>
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

    // ----------------------------------------------------------------
    // PENDING — I sent the request
    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    // PENDING — I received the request
    // ----------------------------------------------------------------
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
                    <button onClick={handleAccept} disabled={loading}
                        className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition">
                        {loading ? "..." : "Accept"}
                    </button>
                    <button onClick={handleBlock} disabled={loading}
                        className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:bg-red-300 transition">
                        {loading ? "..." : "Block"}
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default ChatRequestPanel;
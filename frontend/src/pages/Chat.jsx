import { useEffect, useRef, useState, useCallback } from "react";

import Sidebar from "../components/chat/Sidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";
import ChatRequestPanel from "../components/chat/ChatRequestPanel";

import { useAuth } from "../context/AuthContext";

import { createChatSocket, createInboxSocket } from "../services/websocketService";
import {
    getInbox,
    markAsRead,
    getRelationshipStatus,
    getIncomingRequests,
} from "../services/chatService";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 3000;

const Chat = () => {
    const { user, accessToken } = useAuth();

    const socketRef = useRef(null);

    const [selectedUser, setSelectedUser] = useState(null);
    const [newMessage, setNewMessage] = useState(null);
    const [messageRefresh] = useState(0);

    const [relationship, setRelationship] = useState(null);

    // Whether the current user has deleted their side of this chat.
    const [chatDeleted, setChatDeleted] = useState(false);

    const [conversations, setConversations] = useState([]);
    const [inboxLoading, setInboxLoading] = useState(true);
    const [inboxError, setInboxError] = useState("");
    const [wsDisconnected, setWsDisconnected] = useState(false);
    const [incomingRequests, setIncomingRequests] = useState([]);

    const inboxSocketRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef(null);
    const selectedUserIdRef = useRef(null);

    useEffect(() => {
        selectedUserIdRef.current = selectedUser
            ? String(selectedUser.user.id)
            : null;
    }, [selectedUser]);

    // -----------------------------------------------------------------------
    // Incoming request helpers
    // -----------------------------------------------------------------------

    const addIncomingRequest = useCallback((req) => {
        setIncomingRequests((prev) => {
            if (prev.some((r) => r.id === req.id)) return prev;
            return [req, ...prev];
        });
    }, []);

    const removeIncomingRequest = useCallback((relationshipId) => {
        setIncomingRequests((prev) => prev.filter((r) => r.id !== relationshipId));
    }, []);

    // -----------------------------------------------------------------------
    // Inbox update helpers
    // -----------------------------------------------------------------------

    const applyInboxUpdate = useCallback((payload) => {
        const { other_user_id, other_user, latest_message, timestamp, unread_count } = payload;
        const key = String(other_user_id);
        const effectiveUnread = key === selectedUserIdRef.current ? 0 : unread_count;

        setConversations((prev) => {
            const idx = prev.findIndex((c) => c.key === key);
            const updated = { key, other_user_id, other_user, latest_message, timestamp, unread_count: effectiveUnread };
            if (idx === -1) return [updated, ...prev];
            const next = prev.filter((_, i) => i !== idx);
            return [updated, ...next];
        });
    }, []);

    // -----------------------------------------------------------------------
    // WebSocket event handler
    // -----------------------------------------------------------------------

    const handleInboxEvent = useCallback((payload) => {
        switch (payload.type) {
            case "inbox_update":
                applyInboxUpdate(payload);
                break;

            case "chat_request": {
                addIncomingRequest({
                    id: payload.request_id,
                    sender_profile: payload.sender_profile,
                    request_message: payload.message,
                    sender_id: payload.sender_id,
                });
                if (selectedUserIdRef.current && String(payload.sender_id) === selectedUserIdRef.current) {
                    setRelationship((prev) => ({
                        ...(prev || {}),
                        id: payload.request_id,
                        status: "pending",
                        i_am_requester: false,
                        i_am_blocked_by: false,
                        i_am_blocker: false,
                        request_message: payload.message,
                        requested_by: { id: payload.sender_id },
                    }));
                }
                break;
            }

            case "chat_request_accepted":
                if (selectedUserIdRef.current && String(payload.accepted_by_id) === selectedUserIdRef.current) {
                    setRelationship((prev) => ({
                        ...(prev || {}),
                        status: "accepted",
                        i_am_requester: true,
                        i_am_blocked_by: false,
                        i_am_blocker: false,
                    }));
                }
                break;

            case "chat_request_blocked":
                if (selectedUserIdRef.current && String(payload.blocked_by_id) === selectedUserIdRef.current) {
                    setRelationship((prev) => ({
                        ...(prev || {}),
                        status: "blocked",
                        i_am_requester: false,
                        i_am_blocked_by: true,
                        i_am_blocker: false,
                    }));
                }
                break;

            case "chat_unblocked":
                if (selectedUserIdRef.current && String(payload.unblocked_by_id) === selectedUserIdRef.current) {
                    setRelationship({
                        status: "none",
                        other_user_id: payload.unblocked_by_id,
                        i_am_requester: false,
                        i_am_blocked_by: false,
                        i_am_blocker: false,
                    });
                }
                break;

            default:
                break;
        }
    }, [applyInboxUpdate, addIncomingRequest]);

    // -----------------------------------------------------------------------
    // Inbox WebSocket lifecycle
    // -----------------------------------------------------------------------

    const connectInboxSocket = useCallback(() => {
        if (!user || !accessToken) return;
        if (inboxSocketRef.current && inboxSocketRef.current.readyState === WebSocket.OPEN) return;

        let socket;
        try {
            socket = createInboxSocket(user.user_id);
        } catch (err) {
            console.error("Failed to create inbox socket:", err);
            return;
        }

        inboxSocketRef.current = socket;
        socket.onopen = () => { reconnectAttemptsRef.current = 0; setWsDisconnected(false); };
        socket.onmessage = (event) => {
            try { handleInboxEvent(JSON.parse(event.data)); }
            catch (err) { console.error("Inbox WS parse error:", err); }
        };
        socket.onerror = (err) => console.error("Inbox WebSocket error:", err);
        socket.onclose = () => {
            inboxSocketRef.current = null;
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttemptsRef.current += 1;
                reconnectTimerRef.current = setTimeout(connectInboxSocket, RECONNECT_DELAY_MS);
            } else {
                setWsDisconnected(true);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, accessToken, handleInboxEvent]);

    // -----------------------------------------------------------------------
    // Mount: fetch inbox + incoming requests + open inbox WS
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!user || !accessToken) return;

        const fetchInbox = async () => {
            try {
                setInboxLoading(true);
                setInboxError("");
                const data = await getInbox(user.user_id);
                const normalised = data.map((item) => {
                    const otherUserId = item.other_user_id;
                    const otherUser = String(item.sender.id) === String(user.user_id)
                        ? item.reciever_profile : item.sender_profile;
                    return {
                        key: String(otherUserId),
                        other_user_id: otherUserId,
                        other_user: otherUser,
                        latest_message: item.message,
                        timestamp: item.date,
                        unread_count: item.unread_count ?? 0,
                    };
                });
                setConversations(normalised);
            } catch (err) {
                console.error("Failed to load inbox:", err);
                setInboxError("Unable to load conversations.");
            } finally {
                setInboxLoading(false);
            }
        };

        const fetchIncomingRequests = async () => {
            try {
                const data = await getIncomingRequests();
                setIncomingRequests(data.map((rel) => ({
                    id: rel.id,
                    sender_id: rel.requested_by?.id,
                    sender_profile: rel.sender_profile,
                    request_message: rel.request_message,
                    _rel: rel,
                })));
            } catch (err) {
                console.error("Failed to load incoming requests:", err);
            }
        };

        fetchInbox();
        fetchIncomingRequests();
        connectInboxSocket();

        return () => {
            clearTimeout(reconnectTimerRef.current);
            reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
            if (inboxSocketRef.current) {
                inboxSocketRef.current.onclose = null;
                inboxSocketRef.current.close();
                inboxSocketRef.current = null;
            }
        };
    }, [user, accessToken, connectInboxSocket]);

    // -----------------------------------------------------------------------
    // Conversation selection
    // -----------------------------------------------------------------------

    const handleSelectUser = useCallback(
        async (otherUserProfile) => {
            const incomingId = String(otherUserProfile.user.id);
            if (selectedUser && String(selectedUser.user.id) === incomingId) return;

            setSelectedUser(otherUserProfile);
            setRelationship(null);
            setChatDeleted(false);

            setConversations((prev) =>
                prev.map((c) => c.key === incomingId ? { ...c, unread_count: 0 } : c)
            );

            try {
                const rel = await getRelationshipStatus(otherUserProfile.user.id);
                setRelationship(rel);
            } catch (err) {
                console.error("Failed to fetch relationship:", err);
                setRelationship({ status: "none" });
            }

            try { await markAsRead(otherUserProfile.user.id); }
            catch (_) {}
        },
        [selectedUser]
    );

    const handleRequestResolved = useCallback((id) => {
        removeIncomingRequest(id);
    }, [removeIncomingRequest]);

    const handleRelChange = useCallback((newRel) => {
        const normalised = newRel === null ? { status: "none" } : newRel;
        setRelationship(normalised);

        if (!newRel || newRel.status === "accepted" || newRel.status === "blocked" || newRel.i_am_blocker) {
            if (newRel?.id) removeIncomingRequest(newRel.id);
        }
        if (newRel?.status === "accepted") {
            setChatDeleted(false);
            setNewMessage(null);
        }
    }, [removeIncomingRequest]);

    // -----------------------------------------------------------------------
    // Delete Chat
    // - Removes from sidebar (chat_deleted_for filters MyInbox).
    // - Hides message history for this user.
    // - Resets the main panel to "no conversation selected".
    // -----------------------------------------------------------------------

    const handleDeleteChat = useCallback(() => {
        if (selectedUser) {
            const key = String(selectedUser.user.id);
            // Remove from sidebar immediately
            setConversations((prev) => prev.filter((c) => c.key !== key));
        }
        // Reset main area
        setSelectedUser(null);
        setRelationship(null);
        setChatDeleted(false);
    }, [selectedUser]);

    // -----------------------------------------------------------------------
    // Chat (room) WebSocket — only open when relationship is accepted
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!selectedUser || !user) return;
        if (relationship?.status !== "accepted") {
            if (socketRef.current) { socketRef.current.close(); socketRef.current = null; }
            return;
        }

        const roomName = [user.user_id, selectedUser.user.id].sort((a, b) => a - b).join("_");
        const socket = createChatSocket(`chat_${roomName}`);
        socketRef.current = socket;

        socket.onopen = () => console.log("Chat WebSocket connected:", `chat_${roomName}`);
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "message") setNewMessage(data.message);
            if (data.type === "error") console.warn("Chat WS error:", data.detail);
        };
        socket.onerror = (e) => console.error("Chat WebSocket error:", e);
        socket.onclose = () => console.log("Chat WebSocket disconnected");

        return () => { socket.close(); socketRef.current = null; };
    }, [selectedUser, user, relationship]);

    // -----------------------------------------------------------------------
    // Derived flags
    // -----------------------------------------------------------------------

    const relStatus = relationship?.status ?? null;
    const isAccepted = relStatus === "accepted";
    const isBlocked = relStatus === "blocked";
    const iAmBlockedBy = relationship?.i_am_blocked_by ?? false;

    // Show ChatRequestPanel for all states once relationship is loaded.
    // For ACCEPTED it renders as a slim top bar (Block button).
    // For BLOCKED it renders as a slim bottom bar (status + actions).
    // For other states it renders a full centered panel.
    const showRequestPanel = relationship !== null;

    // Show message list when:
    // - accepted and not deleted (normal), OR
    // - blocked and not deleted (user can still see history while blocked)
    const showMessages = (isAccepted || isBlocked) && !chatDeleted;

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <div className="h-screen bg-gray-100 flex">

            <Sidebar
                conversations={conversations}
                inboxLoading={inboxLoading}
                inboxError={inboxError}
                selectedUser={selectedUser}
                onSelectUser={handleSelectUser}
                wsDisconnected={wsDisconnected}
                incomingRequests={incomingRequests}
                onRequestResolved={handleRequestResolved}
            />

            <main className="flex-1 flex flex-col">

                <ChatHeader selectedUser={selectedUser} />

                {/* No conversation selected */}
                {!selectedUser && (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-gray-400">Select a conversation to start chatting.</p>
                    </div>
                )}

                {selectedUser && (
                    <>
                        {/* ACCEPTED: slim block bar at top, then messages, then input */}
                        {/* NON-ACCEPTED/NON-BLOCKED: full centered panel */}
                        {/* BLOCKED: messages, then slim status bar at bottom */}

                        {/* For accepted: render block bar above message list */}
                        {showRequestPanel && isAccepted && (
                            <ChatRequestPanel
                                relationship={relationship}
                                otherUser={selectedUser}
                                onRelChange={handleRelChange}
                                onDeleteChat={handleDeleteChat}
                            />
                        )}

                        {/* For none/pending: full centered panel (replaces message area) */}
                        {showRequestPanel && !isAccepted && !isBlocked && (
                            <ChatRequestPanel
                                relationship={relationship}
                                otherUser={selectedUser}
                                onRelChange={handleRelChange}
                                onDeleteChat={handleDeleteChat}
                            />
                        )}

                        {/* Message list — accepted (normal) or blocked (view history) */}
                        {showMessages && (
                            <MessageList
                                selectedUser={selectedUser}
                                messageRefresh={messageRefresh}
                                newMessage={newMessage}
                            />
                        )}

                        {/* For blocked: slim status bar below messages */}
                        {showRequestPanel && isBlocked && (
                            <ChatRequestPanel
                                relationship={relationship}
                                otherUser={selectedUser}
                                onRelChange={handleRelChange}
                                onDeleteChat={handleDeleteChat}
                            />
                        )}

                        {/* Message input — only when accepted */}
                        {isAccepted && (
                            <MessageInput
                                selectedUser={selectedUser}
                                socketRef={socketRef}
                                relationshipStatus={relStatus}
                                blockedByOther={iAmBlockedBy}
                            />
                        )}
                    </>
                )}

            </main>

        </div>
    );
};

export default Chat;
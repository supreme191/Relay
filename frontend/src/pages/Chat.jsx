import { useEffect, useRef, useState, useCallback } from "react";

import Sidebar from "../components/chat/Sidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";

import { useAuth } from "../context/AuthContext";

import { createChatSocket, createInboxSocket } from "../services/websocketService";
import { getInbox, markAsRead } from "../services/chatService";

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 3000;

const Chat = () => {
    const { user, accessToken } = useAuth();

    // -----------------------------------------------------------------------
    // Chat (room) WebSocket
    // -----------------------------------------------------------------------
    const socketRef = useRef(null);

    const [selectedUser, setSelectedUser] = useState(null);
    const [newMessage, setNewMessage] = useState(null);
    // messageRefresh kept for compatibility with MessageList
    const [messageRefresh] = useState(0);

    // -----------------------------------------------------------------------
    // Inbox state � owned here, shared down to Sidebar
    // -----------------------------------------------------------------------
    const [conversations, setConversations] = useState([]);
    const [inboxLoading, setInboxLoading] = useState(true);
    const [inboxError, setInboxError] = useState("");
    const [wsDisconnected, setWsDisconnected] = useState(false);

    // -----------------------------------------------------------------------
    // Inbox WebSocket refs
    // -----------------------------------------------------------------------
    const inboxSocketRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef(null);

    // Keep a ref to the currently selected user's ID so the WS message
    // handler can read the latest value without a stale closure.
    const selectedUserIdRef = useRef(null);
    useEffect(() => {
        selectedUserIdRef.current = selectedUser
            ? String(selectedUser.user.id)
            : null;
    }, [selectedUser]);

    // -----------------------------------------------------------------------
    // Apply an inbox_update payload from the WebSocket.
    //
    // Conversations are keyed by String(other_user_id) � the explicit field
    // the backend now includes in every event.  This eliminates any ambiguity
    // from inferring the other participant out of sender/receiver fields.
    //
    // unread_count is SET from the DB-authoritative value in the payload;
    // it is NEVER incremented locally.
    // -----------------------------------------------------------------------
    const applyInboxUpdate = useCallback((payload) => {
        const {
            other_user_id,
            other_user,
            latest_message,
            timestamp,
            unread_count,
        } = payload;

        const key = String(other_user_id);

        // If this is the currently open conversation, the user is actively
        // reading it � keep the badge at 0 regardless of the DB count.
        const effectiveUnread =
            key === selectedUserIdRef.current ? 0 : unread_count;

        setConversations((prev) => {
            const idx = prev.findIndex((c) => c.key === key);

            const updated = {
                key,                          // stable conversation identity
                other_user_id: other_user_id, // numeric, for markAsRead call
                other_user,                   // profile for display
                latest_message,
                timestamp,
                unread_count: effectiveUnread, // SET, never added to
            };

            if (idx === -1) {
                // Brand-new conversation: prepend
                return [updated, ...prev];
            }

            // Existing conversation: update in place and float to top
            const next = prev.filter((_, i) => i !== idx);
            return [updated, ...next];
        });
    }, []); // no deps � reads only refs and the stable setter

    // -----------------------------------------------------------------------
    // Open (or reopen) the inbox WebSocket
    // -----------------------------------------------------------------------
    const connectInboxSocket = useCallback(() => {
        if (!user || !accessToken) return;

        if (
            inboxSocketRef.current &&
            inboxSocketRef.current.readyState === WebSocket.OPEN
        ) {
            return; // already open � do not open a second socket
        }

        let socket;
        try {
            socket = createInboxSocket(user.user_id);
        } catch (err) {
            console.error("Failed to create inbox socket:", err);
            return;
        }

        inboxSocketRef.current = socket;

        socket.onopen = () => {
            console.log("Inbox WebSocket connected");
            reconnectAttemptsRef.current = 0;
            setWsDisconnected(false);
        };

        socket.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === "inbox_update") {
                    applyInboxUpdate(payload);
                }
            } catch (err) {
                console.error("Inbox WS parse error:", err);
            }
        };

        socket.onerror = (err) => {
            console.error("Inbox WebSocket error:", err);
        };

        socket.onclose = () => {
            console.log("Inbox WebSocket closed");
            inboxSocketRef.current = null;

            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttemptsRef.current += 1;
                reconnectTimerRef.current = setTimeout(() => {
                    connectInboxSocket();
                }, RECONNECT_DELAY_MS);
            } else {
                setWsDisconnected(true);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, accessToken, applyInboxUpdate]);

    // -----------------------------------------------------------------------
    // On mount: fetch initial inbox + open inbox WebSocket
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!user || !accessToken) return;

        const fetchInbox = async () => {
            try {
                setInboxLoading(true);
                setInboxError("");
                const data = await getInbox(user.user_id);

                // Normalise REST response to the same shape used by applyInboxUpdate.
                //
                // The REST endpoint now includes `other_user_id` (explicit) so we
                // never have to guess which side of sender/reciever is "the other".
                const normalised = data.map((item) => {
                    const otherUserId = item.other_user_id; // explicit from backend
                    const key = String(otherUserId);

                    // Pick the profile that belongs to the other participant.
                    const otherUser =
                        String(item.sender.id) === String(user.user_id)
                            ? item.reciever_profile
                            : item.sender_profile;

                    return {
                        key,
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

        fetchInbox();
        connectInboxSocket();

        return () => {
            // Stop any pending reconnect timers
            clearTimeout(reconnectTimerRef.current);
            // Cap retries so the onclose handler doesn't schedule another attempt
            reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS;
            if (inboxSocketRef.current) {
                // Remove the onclose handler before closing intentionally
                inboxSocketRef.current.onclose = null;
                inboxSocketRef.current.close();
                inboxSocketRef.current = null;
            }
        };
    }, [user, accessToken, connectInboxSocket]);

    // -----------------------------------------------------------------------
    // Conversation selection: optimistic unread clear + mark-as-read API call
    // -----------------------------------------------------------------------
    const handleSelectUser = useCallback(
        async (otherUserProfile) => {
            const incomingId = String(otherUserProfile.user.id);

            // Skip if already selected
            if (selectedUser && String(selectedUser.user.id) === incomingId) {
                return;
            }

            setSelectedUser(otherUserProfile);

            // Optimistically zero the badge immediately (good UX)
            setConversations((prev) =>
                prev.map((c) =>
                    c.key === incomingId ? { ...c, unread_count: 0 } : c
                )
            );

            // Persist to DB (fire-and-forget; badge stays 0 on success,
            // the next inbox_update will resync on failure)
            try {
                await markAsRead(otherUserProfile.user.id);
            } catch (err) {
                console.error("Failed to mark messages as read:", err);
            }
        },
        [selectedUser]
    );

    // -----------------------------------------------------------------------
    // Chat (room) WebSocket � reconnect when selected conversation changes
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (!selectedUser || !user) return;

        const currentUserId = user.user_id;
        const selectedUserId = selectedUser.user.id;

        const roomName = [currentUserId, selectedUserId]
            .sort((a, b) => a - b)
            .join("_");

        const socket = createChatSocket(`chat_${roomName}`);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log("Chat WebSocket connected:", `chat_${roomName}`);
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "message") {
                setNewMessage(data.message);
            }
        };

        socket.onerror = (error) => {
            console.error("Chat WebSocket error:", error);
        };

        socket.onclose = () => {
            console.log("Chat WebSocket disconnected");
        };

        return () => {
            socket.close();
            socketRef.current = null;
        };
    }, [selectedUser, user]);

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
            />

            <main className="flex-1 flex flex-col">

                <ChatHeader selectedUser={selectedUser} />

                <MessageList
                    selectedUser={selectedUser}
                    messageRefresh={messageRefresh}
                    newMessage={newMessage}
                />

                <MessageInput
                    selectedUser={selectedUser}
                    socketRef={socketRef}
                />

            </main>

        </div>
    );
};

export default Chat;

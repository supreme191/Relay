import api from "./api";

// ---- Inbox ----

export const getInbox = async (userId) => {
    const response = await api.get(`my-messages/${userId}/`);
    return response.data;
};

// ---- Messages ----

export const getMessages = async (senderId, receiverId) => {
    const response = await api.get(`get-messages/${senderId}/${receiverId}/`);
    return response.data;
};

export const sendMessage = async (senderId, receiverId, message) => {
    const response = await api.post("send-messages/", {
        sender: senderId,
        reciever: receiverId,
        message: message,
    });
    return response.data;
};

export const markAsRead = async (otherUserId) => {
    const response = await api.patch(`messages/read/${otherUserId}/`);
    return response.data;
};

// ---- Profile / Search ----

export const searchUsers = async (username) => {
    const response = await api.get(`search/${encodeURIComponent(username)}/`);
    return response.data;
};

export const getProfile = async (userId) => {
    const response = await api.get(`profile/${userId}/`);
    return response.data;
};

export const updateProfile = async (profileId, profileData) => {
    const response = await api.patch(`profile/${profileId}/`, profileData);
    return response.data;
};

// ---- Relationships ----

export const getRelationshipStatus = async (otherUserId) => {
    const response = await api.get(`relationship/${otherUserId}/`);
    return response.data;
};

export const sendChatRequest = async (toUserId, message) => {
    const response = await api.post("relationship/request/", {
        to_user_id: toUserId,
        message: message,
    });
    return response.data;
};

export const getIncomingRequests = async () => {
    const response = await api.get("relationship/requests/incoming/");
    return response.data;
};

export const acceptRequest = async (relationshipId) => {
    const response = await api.post(`relationship/${relationshipId}/accept/`);
    return response.data;
};

export const blockUser = async (otherUserId) => {
    const response = await api.post("relationship/block/", {
        other_user_id: otherUserId,
    });
    return response.data;
};

export const unblockUser = async (otherUserId) => {
    const response = await api.post("relationship/unblock/", {
        other_user_id: otherUserId,
    });
    return response.data;
};

export const getBlockedUsers = async () => {
    const response = await api.get("relationship/blocked/");
    return response.data;
};
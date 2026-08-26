import api from "./api";

export const getInbox = async (userId) => {
    const response = await api.get(
        `my-messages/${userId}/`
    );

    return response.data;
};


export const getMessages = async (
    senderId,
    receiverId
) => {
    const response = await api.get(
        `get-messages/${senderId}/${receiverId}/`
    );

    return response.data;
};


export const sendMessage = async (
    senderId,
    receiverId,
    message
) => {
    const response = await api.post(
        "send-messages/",
        {
            sender: senderId,
            reciever: receiverId,
            message: message,
        }
    );

    return response.data;
};


export const searchUsers = async (username) => {
    const response = await api.get(
        `search/${encodeURIComponent(username)}/`
    );

    return response.data;
};


export const getProfile = async (userId) => {
    const response = await api.get(
        `profile/${userId}/`
    );

    return response.data;
};


export const updateProfile = async (
    profileId,
    profileData
) => {
    const response = await api.patch(
        `profile/${profileId}/`,
        profileData
    );

    return response.data;
};
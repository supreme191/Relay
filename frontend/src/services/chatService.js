import api from "./api";

export const getInbox = async (userId, accessToken) => {
    const response = await api.get(`my-messages/${userId}/`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return response.data;
};


export const getMessages = async (
    senderId,
    receiverId,
    accessToken
) => {
    const response = await api.get(
        `get-messages/${senderId}/${receiverId}/`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    return response.data;
};


export const sendMessage = async (
    senderId,
    receiverId,
    message,
    accessToken
) => {
    const response = await api.post(
        "send-messages/",
        {
            sender: senderId,
            reciever: receiverId,
            message: message,
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    return response.data;
};


export const searchUsers = async (username, accessToken) => {
    const response = await api.get(
        `search/${encodeURIComponent(username)}/`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    return response.data;
};


export const getProfile = async (userId, accessToken) => {
    const response = await api.get(`profile/${userId}/`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return response.data;
};


export const updateProfile = async (
    profileId,
    profileData,
    accessToken
) => {
    const response = await api.patch(
        `profile/${profileId}/`,
        profileData,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );

    return response.data;
};
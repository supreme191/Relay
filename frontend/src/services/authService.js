import api from "./api";

export const loginUser = async (username, password) => {
    const response = await api.post("token/", {
        username,
        password,
    });

    return response.data;
};

export const registerUser = async (userData) => {
    const response = await api.post("register/", userData);

    return response.data;
};

export const refreshAccessToken = async (refreshToken) => {
    const response = await api.post("token/refresh/", {
        refresh: refreshToken,
    });

    return response.data;
};
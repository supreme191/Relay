export const createChatSocket = (roomName) => {
    const token = localStorage.getItem("accessToken");

    if (!token) {
        throw new Error("No access token found.");
    }

    const socket = new WebSocket(
        `ws://127.0.0.1:8000/ws/chat/${roomName}/?token=${token}`
    );

    return socket;
};
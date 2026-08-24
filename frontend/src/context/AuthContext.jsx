import { createContext, useContext, useState } from "react";
import { jwtDecode } from "jwt-decode";
import {
    loginUser,
    registerUser,
    refreshAccessToken,
} from "../services/authService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [accessToken, setAccessToken] = useState(
        localStorage.getItem("accessToken")
    );

    const [refreshToken, setRefreshToken] = useState(
        localStorage.getItem("refreshToken")
    );

    const [user, setUser] = useState(() => {
        const token = localStorage.getItem("accessToken");

        if (!token) {
            return null;
        }

        try {
            return jwtDecode(token);
        } catch {
            return null;
        }
    });

    const login = async (username, password) => {
        const data = await loginUser(username, password);

        localStorage.setItem("accessToken", data.access);
        localStorage.setItem("refreshToken", data.refresh);

        setAccessToken(data.access);
        setRefreshToken(data.refresh);
        setUser(jwtDecode(data.access));

        return data;
    };

    const register = async (userData) => {
        return await registerUser(userData);
    };

    const logout = () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");

        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
    };

    const refreshTokenAndUpdate = async () => {
        if (!refreshToken) {
            return null;
        }

        const data = await refreshAccessToken(refreshToken);

        localStorage.setItem("accessToken", data.access);

        setAccessToken(data.access);
        setUser(jwtDecode(data.access));

        return data.access;
    };

    const isAuthenticated = !!accessToken;

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                refreshToken,
                user,
                isAuthenticated,
                login,
                register,
                logout,
                refreshTokenAndUpdate,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
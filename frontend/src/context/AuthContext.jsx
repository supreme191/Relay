import { createContext, useContext, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { loginUser, registerUser } from "../services/authService";

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

    const login = async (email, password) => {
        const data = await loginUser(email, password);

        localStorage.setItem("accessToken", data.access);
        localStorage.setItem("refreshToken", data.refresh);

        setAccessToken(data.access);
        setRefreshToken(data.refresh);
        setUser(jwtDecode(data.access));

        return data;
    };

    const register = async (userData) => {
        const data = await registerUser(userData);

        return data;
    };

    const logout = () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");

        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
    };

    const isAuthenticated = !!accessToken;

    return (
        <AuthContext.Provider
            value={{
                user,
                accessToken,
                refreshToken,
                isAuthenticated,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
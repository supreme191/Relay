import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    getProfile,
    updateProfile,
} from "../services/chatService";

const Profile = () => {
    const { user, accessToken } = useAuth();

    const [profile, setProfile] = useState(null);

    const [fullName, setFullName] = useState("");
    const [bio, setBio] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user || !accessToken) {
                return;
            }

            try {
                setLoading(true);
                setError("");

                const data = await getProfile(
                    user.user_id,
                    accessToken
                );

                setProfile(data);

                setFullName(data.full_name || "");
                setBio(data.bio || "");
            } catch (error) {
                console.error(
                    "Failed to load profile:",
                    error
                );

                setError("Unable to load profile.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user, accessToken]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!profile) {
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const updatedProfile = await updateProfile(
                profile.id,
                {
                    full_name: fullName,
                    bio: bio,
                },
                accessToken
            );

            setProfile(updatedProfile);

            setFullName(updatedProfile.full_name || "");
            setBio(updatedProfile.bio || "");

            setSuccess("Profile updated successfully.");
        } catch (error) {
            console.error(
                "Failed to update profile:",
                error
            );

            const backendError = error.response?.data;

            if (backendError) {
                const firstError =
                    Object.values(backendError)[0];

                if (Array.isArray(firstError)) {
                    setError(firstError[0]);
                } else {
                    setError(String(firstError));
                }
            } else {
                setError(
                    "Unable to update profile."
                );
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-gray-500">
                    Loading profile...
                </p>
            </div>
        );
    }

    if (error && !profile) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <p className="text-red-500">
                    {error}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-10">

            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

                {/* Back to Chat */}
                <Link
                    to="/chat"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    ← Back to Chat
                </Link>

                {/* Profile Header */}
                <div className="flex flex-col items-center mt-6">

                    <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-semibold">
                        {fullName
                            ?.charAt(0)
                            ?.toUpperCase() || "U"}
                    </div>

                    <h1 className="mt-4 text-2xl font-bold text-gray-900">
                        {fullName || "User"}
                    </h1>

                    <p className="text-gray-500">
                        @{profile?.user?.username}
                    </p>

                </div>

                {/* Messages */}
                {error && (
                    <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mt-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-600">
                        {success}
                    </div>
                )}

                {/* Edit Form */}
                <form
                    onSubmit={handleSubmit}
                    className="mt-8 space-y-5"
                >

                    {/* Username */}
                    <div>
                        <label
                            htmlFor="username"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Username
                        </label>

                        <input
                            id="username"
                            type="text"
                            value={`@${profile?.user?.username || ""}`}
                            disabled
                            className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-gray-500 outline-none"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Email
                        </label>

                        <input
                            id="email"
                            type="email"
                            value={profile?.user?.email || ""}
                            disabled
                            className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-gray-500 outline-none"
                        />
                    </div>

                    {/* Full Name */}
                    <div>
                        <label
                            htmlFor="fullName"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Full Name
                        </label>

                        <input
                            id="fullName"
                            type="text"
                            value={fullName}
                            onChange={(e) =>
                                setFullName(e.target.value)
                            }
                            placeholder="Enter your full name"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <label
                            htmlFor="bio"
                            className="block text-sm font-medium text-gray-700 mb-2"
                        >
                            Bio
                        </label>

                        <textarea
                            id="bio"
                            value={bio}
                            onChange={(e) =>
                                setBio(e.target.value)
                            }
                            placeholder="Tell people a little about yourself..."
                            rows={4}
                            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    {/* Save */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving
                            ? "Saving..."
                            : "Save Changes"}
                    </button>

                </form>

            </div>

        </div>
    );
};

export default Profile;
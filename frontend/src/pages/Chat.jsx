import { useState } from "react";

import Sidebar from "../components/chat/Sidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";

const Chat = () => {
    const [selectedUser, setSelectedUser] = useState(null);

    const [messageRefresh, setMessageRefresh] = useState(0);
    const [inboxRefresh, setInboxRefresh] = useState(0);

    const handleMessageSent = () => {
        setMessageRefresh((previous) => previous + 1);
        setInboxRefresh((previous) => previous + 1);
    };

    return (
        <div className="h-screen bg-gray-100 flex">

            <Sidebar
                onSelectUser={setSelectedUser}
                inboxRefresh={inboxRefresh}
            />

            <main className="flex-1 flex flex-col">

                <ChatHeader selectedUser={selectedUser} />

                <MessageList
                    selectedUser={selectedUser}
                    messageRefresh={messageRefresh}
                />

                <MessageInput
                    selectedUser={selectedUser}
                    onMessageSent={handleMessageSent}
                />

            </main>

        </div>
    );
};

export default Chat;
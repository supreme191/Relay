import Sidebar from "../components/chat/Sidebar";
import ChatHeader from "../components/chat/ChatHeader";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";

const Chat = () => {
    return (
        <div className="h-screen bg-gray-100 flex">

            <Sidebar />

            <main className="flex-1 flex flex-col">

                <ChatHeader />

                <MessageList />

                <MessageInput />

            </main>

        </div>
    );
};

export default Chat;
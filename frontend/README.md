# Relay Frontend

React 19 single-page app built with Vite and Tailwind CSS 4.

## Setup

```bash
cd frontend
npm install
npm run dev
```
Opens at **http://localhost:5173**. The backend must be running at `http://127.0.0.1:8000` (see [backend/README.md](../backend/README.md)).

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Routes

| Path | Page | Access |
|------|------|--------|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/chat` | Chat | Logged-in users |
| `/profile` | Profile | Logged-in users |
| anything else | Redirects to `/login` | |

`ProtectedRoute` redirects unauthenticated users to `/login`.

## Project Structure

```
src/
├── pages/
│   ├── Login.jsx, Register.jsx, Profile.jsx
│   └── Chat.jsx              Main screen; owns WebSocket and inbox state
├── components/
│   ├── ProtectedRoute.jsx
│   └── chat/
│       ├── Sidebar.jsx            Conversation list, search, unread badges
│       ├── ChatHeader.jsx         Selected user, block / delete actions
│       ├── MessageList.jsx        Chat history and incoming messages
│       ├── MessageInput.jsx       Sends messages over the chat socket
│       └── ChatRequestPanel.jsx   Send, accept, or decline chat requests
├── context/
│   └── AuthContext.jsx       Current user and tokens
└── services/
    ├── api.js                Axios instance with JWT interceptors
    ├── authService.js        Login, register, token refresh
    ├── chatService.js        Inbox, history, relationships, read receipts
    └── websocketService.js   Creates chat and inbox sockets
```

## How It Works

### Authentication
- Tokens are stored in `localStorage`.
- An Axios request interceptor attaches `Authorization: Bearer <token>`.
- A response interceptor catches `401`, calls `token/refresh/`, and retries the original request once. If refresh fails, the user is logged out.

### Real-time
`Chat.jsx` opens two WebSockets:
- **Inbox socket** (`/ws/inbox/<user_id>/`): live sidebar updates, incoming chat requests, accept, block, and unblock events.
- **Chat socket** (`/ws/chat/chat_<idA>_<idB>/`): messages for the selected conversation.

Both pass the access token as `?token=`. If a socket drops, the app retries up to 3 times, 3 seconds apart, and then shows a message asking you to refresh.

### Sidebar state
- Conversations are keyed by `String(other_user_id)`.
- The REST inbox load and WebSocket `inbox_update` events use the same key, so live events update the existing entry instead of creating duplicates.
- `unread_count` is set directly from the server value and never incremented locally.

## Configuration

Backend URLs are currently hardcoded in two files:

| File | Value |
|------|-------|
| `src/services/api.js` | `http://127.0.0.1:8000/api/` |
| `src/services/websocketService.js` | `ws://127.0.0.1:8000/ws/...` |

To deploy, move these into Vite env variables (`import.meta.env.VITE_API_URL`, `VITE_WS_URL`).

## Tech Stack

React 19, Vite, Tailwind CSS 4, React Router 7, Axios, jwt-decode.
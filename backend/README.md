# Relay Backend

Django REST Framework API plus Django Channels WebSocket consumers, backed by MySQL and Redis.

## Setup

### Requirements
- Python 3.12+
- MySQL server
- Redis on `localhost:6379`

### Install
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
```

> `requirements.txt` pins `redis==5.2.1` on purpose. Newer redis-py releases are incompatible with `channels-redis` 4.3.0 and cause `Timeout reading from 127.0.0.1:6379` on idle WebSockets. See `bug_fixtures.md` (Bug 7).

### Environment variables
Create `backend/.env`:
```
DB_NAME=relay
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
REDIS_URL=redis://127.0.0.1:6379/0
```
Create the MySQL database first: `CREATE DATABASE relay;`

### Run
```bash
python manage.py migrate
python manage.py runserver
```
The server runs at `http://127.0.0.1:8000` (REST and WebSocket, served by Daphne).

To run without Redis (single process, dev only), set `USE_INMEMORY_CHANNEL_LAYER=1`.

## Data Model

| Model | Purpose |
|-------|---------|
| `User` | Custom user, logs in with email |
| `Profile` | Full name, bio, image; auto-created for each user |
| `ChatMessage` | Sender, receiver, text, `is_read`, timestamp |
| `Relationship` | One row per user pair: `pending` / `accepted` / `blocked` |
| `ConversationState` | Per-user flags for chat deletion and sidebar hiding |

`Relationship` and `ConversationState` store each pair in canonical order (`user_a.id < user_b.id`). A database check constraint on `Relationship` enforces this, so a pair can never be duplicated in reverse.

## REST API

All endpoints are under `/api/` and require `Authorization: Bearer <access_token>` unless noted.

**Auth**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `register/` | Create account (no auth) |
| POST | `token/` | Obtain access and refresh tokens (no auth) |
| POST | `token/refresh/` | Refresh access token |

**Messages and profiles**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `my-messages/<user_id>/` | Inbox: latest message per conversation, with unread counts |
| GET | `get-messages/<sender_id>/<reciever_id>/` | Chat history (participants only, relationship must be accepted) |
| POST | `send-messages/` | Send a message over REST |
| POST | `messages/read/<other_user_id>/` | Mark messages from a user as read |
| GET/PUT | `profile/<id>/` | View or update a profile |
| GET | `search/<username>/` | Search users |

**Relationships**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `relationship/<other_user_id>/` | Relationship status with a user |
| POST | `relationship/request/` | Send a chat request |
| GET | `relationship/requests/incoming/` | Pending requests received |
| POST | `relationship/<id>/accept/` | Accept a request |
| POST | `relationship/block/` | Block a user |
| POST | `relationship/unblock/` | Unblock a user |
| GET | `relationship/blocked/` | List blocked users |
| POST | `conversation/delete/` | Delete a chat for the current user |

## WebSocket Protocol

Authenticate by passing the access token in the query string: `?token=<access_token>`. Connections without a valid token are rejected.

### Chat: `ws://127.0.0.1:8000/ws/chat/chat_<idA>_<idB>/?token=...`
Only the two users named in the room can connect.

Client sends:
```json
{ "message": "Hello", "receiver": 3 }
```
The sender is always taken from the authenticated connection, never from the payload.

Server sends:
```json
{ "type": "message", "message": { ... } }
{ "type": "error", "detail": "Chat request has not been accepted yet." }
```
Messages are rejected unless the relationship is `accepted`.

### Inbox: `ws://127.0.0.1:8000/ws/inbox/<user_id>/?token=...`
A user can only connect to their own inbox. The server pushes:

| `type` | Meaning |
|--------|---------|
| `inbox_update` | New message: `other_user_id`, `other_user`, `latest_message`, `timestamp`, `unread_count` |
| `chat_request` | You received a chat request |
| `chat_request_accepted` | Your request was accepted |
| `chat_request_blocked` | A block occurred |
| `chat_unblocked` | You were unblocked |

`unread_count` is always read from the database, never incremented on the client.

## How It Works

1. A user sends a **chat request** (`pending`). The recipient is notified live on their inbox socket.
2. The recipient **accepts** (`accepted`). The intro message becomes the first chat message.
3. Both users connect to the chat room. Messages are saved to MySQL, then broadcast through the **Redis channel layer** to the room group.
4. After each message, both users' `inbox_<id>` groups receive an updated sidebar entry.

## Project Layout

```
backend/
├── backend/        settings, urls, asgi (JWT middleware + WebSocket routing)
├── api/
│   ├── models.py        User, Profile, ChatMessage, Relationship, ConversationState
│   ├── views.py         REST endpoints
│   ├── serializers.py
│   ├── consumers.py     ChatConsumer, InboxConsumer
│   ├── routing.py       WebSocket URL patterns
│   ├── middleware.py    JWT auth for WebSockets
│   └── migrations/
├── manage.py
└── requirements.txt
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No module named 'channels_redis'` | Activate `.venv` before `pip install` |
| `Timeout reading from 127.0.0.1:6379` | `pip install "redis==5.2.1"` |
| Connection refused on port 6379 | Start Redis: `docker start redis` |
| WebSocket rejected after login | Access token expired; the frontend refreshes it, so reload the page |
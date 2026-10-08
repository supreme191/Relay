# Relay

A full-stack real-time chat application built with **React**, **Django REST Framework**, **Django Channels**, and **Redis**.

Users connect through consent-based chat requests, then exchange messages over WebSockets with live inbox updates and unread counts.

## Features

- **JWT authentication:** register, login, automatic access-token refresh
- **Real-time messaging:** one-to-one chat over WebSockets (Django Channels)
- **Live inbox:** the sidebar updates instantly with the latest message and unread count
- **Chat requests:** pending / accepted / blocked states with an optional intro message
- **Block / unblock:** enforced on both REST and WebSocket paths
- **Persistent history:** messages stored in MySQL; user search and profiles
- **Per-user chat deletion:** messages are permanently removed once both users delete

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router, Axios |
| Backend | Django 6, Django REST Framework, SimpleJWT |
| Real-time | Django Channels, Daphne (ASGI), WebSockets |
| Channel layer | Redis (`channels-redis`) |
| Database | MySQL |

## Architecture

```
React (Vite)  --REST (axios, JWT)-->  Django REST Framework  -->  MySQL
     |                                         |
     +------WebSocket (?token=JWT)------>  Django Channels  <--> Redis
```

- REST handles auth, profiles, search, history, and relationship actions.
- Two WebSocket endpoints handle live traffic: one per conversation, one per user inbox.
- Redis is the channel layer, so group messages (chat rooms and `inbox_<id>`) reach every connected socket, even across multiple server processes.
- Messaging is gated by a `Relationship` record. Only `accepted` pairs can exchange messages.

## Project Structure

```
Relay/
├── backend/     Django project (API, WebSocket consumers, models)
├── frontend/    React app (Vite)
```

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md) for details.

## Quick Start

**Prerequisites:** Python 3.12+, Node 20+, MySQL, Docker (for Redis).

1. **Start Redis**
```bash
   docker start redis
   # or, first time:
   docker compose up -d redis
```
2. **Backend** (see [backend/README.md](backend/README.md) for `.env` setup)
```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
```
3. **Frontend**
```bash
   cd frontend
   npm install
   npm run dev
```
4. Open **http://localhost:5173**, register two users in two browsers, send a chat request, accept it, and start chatting.

## Documentation

- [Backend guide](backend/README.md): setup, API endpoints, WebSocket protocol, data model
- [Frontend guide](frontend/README.md): structure, state flow, configuration

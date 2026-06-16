# OP Character — Trait Guess Game

A 3-player party game built with Django, React, and MySQL. Players receive secret One Piece characters and give hints about the common traits of other players' characters.

**完整实现说明与 Agent 参考文档 → [PROJECT_REFERENCE.md](./PROJECT_REFERENCE.md)**

## Stack

- **Backend**: Django 5, DRF, Channels, Redis
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion
- **Database**: MySQL 8 (SQLite for quick local dev)

## Quick Start (Local)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py seed_one_piece
python manage.py runserver
```

For WebSocket support locally:
```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Frontend

Open a **new terminal** (keep daphne running in the first one):

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser (not port 8000).

> Port 8000 = backend API only. Port 5173 = game UI.

If "Create Room" fails, make sure:
1. `daphne` is still running in the other terminal
2. You ran `python manage.py migrate` and `python manage.py seed_one_piece`
3. You open the site at http://localhost:5173

### Docker

```bash
docker-compose up --build
```

### Railway（公网跨设备测试）

见 **[DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)** — 单服务部署，含前端 + API + WebSocket。

## Game Flow

1. Create or join a room (3 players)
2. Host configures cooperative or competitive settings and starts
3. Each round: hints → guessing → judging → rating → settlement
4. View results poster and vote to replay

## API

Base URL: `http://localhost:8000/api/v1`

Auth: `X-Player-Token` header with player UUID token.

WebSocket: `ws://localhost:8000/ws/rooms/{CODE}/?token={TOKEN}`

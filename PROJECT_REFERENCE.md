# OP Character — 项目实现参考文档

> 本文档供后续 Agent 会话快速了解当前实现、架构约定与注意事项。  
> 最后更新：2026-06-16（v3）

---

## 1. 项目概述

**OP Character** 是一个三人派对网页游戏（MVP 已实现第一个模式「人物共性猜谜」）。

- 主题：海贼王（One Piece），数据库预留多主题扩展
- 玩法：每人分配秘密人物；默认**看不到自己的人物**；能看到另外两人的人物；描述另外两人角色的共同点发提示；**文本输入**猜自己是谁；另外两人实时评判；猜对后自己人物 reveal；可继续发提示；轮末对提示点赞/点踩
- 模式：合作（cooperative）或对抗（competitive）
- 身份：无注册，昵称 + UUID `player_token`（存 localStorage）
- 语言：每位玩家独立选择 `zh` / `en`，UI 与人物名按玩家语言显示

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Django 5、DRF、Channels、Daphne |
| 实时 | WebSocket + Redis（本地可用 InMemory Channel Layer） |
| 数据库 | MySQL 8（本地默认 SQLite，`USE_SQLITE=true`） |
| 前端 | React 18、Vite 8、TypeScript、Tailwind CSS 4、Framer Motion |
| i18n | react-i18next（UI 文案）+ API 双语字段（人物名） |

---

## 3. 目录结构

```text
op-character/
├── PROJECT_REFERENCE.md      # 本文档
├── README.md
├── docker-compose.yml
├── backend/
│   ├── config/
│   ├── apps/
│   │   ├── core/
│   │   ├── catalog/
│   │   ├── rooms/            # Model、WS、房间 API、preview
│   │   └── games/
│   │       ├── base.py
│   │       ├── registry.py
│   │       └── trait_guess/
│   │           └── engine.py # ★ 游戏状态机核心
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── api/client.ts
    │   ├── ws/useRoomWebSocket.ts
    │   ├── i18n/index.ts
    │   ├── features/
    │   │   ├── home/HomePage.tsx
    │   │   ├── lobby/LobbyPage.tsx
    │   │   ├── game/GameBoard.tsx
    │   │   └── results/ResultsPoster.tsx
    │   └── components/
    └── vite.config.ts
```

---

## 4. 本地开发启动（重要）

### 4.1 必须开两个终端

| 终端 | 命令 | 说明 |
|---|---|---|
| 终端 1 | `daphne -b 0.0.0.0 -p 8000 config.asgi:application` | 后端 + WebSocket，**会占住终端** |
| 终端 2 | `npm run dev` | 前端，访问 **http://localhost:5173** |

> **不要**在浏览器打开 `http://localhost:8000` 玩游戏。8000 只是 API，5173 才是 UI。

### 4.2 后端首次 / 每次拉代码后

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # 首次
python manage.py migrate
python manage.py seed_one_piece
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### 4.3 环境变量（`backend/.env`）

| 变量 | 本地推荐值 | 说明 |
|---|---|---|
| `USE_SQLITE` | `true` | 无需 MySQL |
| `USE_INMEMORY_CHANNEL` | `true` | 无需 Redis |
| `DJANGO_DEBUG` | `true` | CORS + `ALLOWED_HOSTS=*` |

### 4.4 前端 API 连接

`frontend/src/api/client.ts` 开发模式 **直连** `http://127.0.0.1:8000`（依赖 Django CORS）。

`vite.config.ts` 亦配置 `/api`、`/ws` 代理到 8000，可作备选。

### 4.5 已知端口问题

- 8000 常被占用 → `Cannot reach backend` 或返回 HTML
- 排查：`lsof -i :8000`
- 若冲突：daphne 改端口（如 8001），同步改 `client.ts` 与 `vite.config.ts`

### 4.6 修改后端后

**必须重启 daphne**，否则仍跑旧逻辑（常见报错如 `Not in guessing phase`）。

---

## 5. 身份与鉴权

### 5.1 Player Token

- 创建/加入房间返回 `player.token`（UUID）
- 前端存 `localStorage`：`player_token`、`player_info`（含 `id`、`seat_index`、**`room_code`**）
- 鉴权头：`X-Player-Token: <uuid>`
- **房间绑定**：`sessionMatchesRoom(code)` 校验 token 是否属于当前 URL 房间；不匹配则 `clearSession()` 并显示加入表单（避免 `ROOM_MISMATCH`）
- `storeSession(token, player, roomCode)` 三参数写入

### 5.2 接口鉴权分级

| 类型 | 示例 | Token |
|---|---|---|
| 公开 | `GET /game-modes`、`POST /rooms`、`POST /rooms/join` | 否 |
| 公开预览 | `GET /rooms/{code}/preview` | 否 |
| 玩家 | `GET /rooms/{code}`、`GET /matches/current`、游戏写操作 | 是 |

### 5.3 分享链接流程

1. 分享 `/room/ABC123`
2. 新玩家无 token，或 token 属于其他房间 → `LobbyPage` 显示加入表单（调 `GET /rooms/{code}/preview`）
3. `POST /rooms/join` → 获得 token → 进大厅

> **跨设备**：`127.0.0.1` 仅本机可用；他机需局域网 IP 或部署同域。

---

## 6. 游戏规则与状态机（当前实现 v3）

### 6.1 房间生命周期

```text
waiting → playing → replay_pending → (全员同意 replay) → playing（新 match）
```

### 6.2 每轮（Round）阶段

```text
hints（活跃期，提示+猜测+评判并行）→ rating → settlement → complete → 下一轮 hints
```

**不再有独立的 guessing / judging 阶段。** 数据库 `rounds.phase` 在活跃期保持 `hints`；`judging`/`guessing` 为历史遗留，引擎会自动 `_normalize_round_phase()` 归回 `hints`。

### 6.3 活跃期内并行行为

| 行为 | 说明 |
|---|---|
| 发提示 | 随时可发，可多条；分区显示「发送的提示」「收到的提示」 |
| 文本猜人物 | 输入框提交 `{text}`，非下拉选角色 |
| 他人评判 | 提交猜测后，另外两人**在同一页面**看到并投票 |
| 猜对 reveal | `self.character` 对该玩家可见，人物卡从 `?` 变为真实人物 |
| 猜错重试 | 两人都判错 → `verdict=incorrect` → 可再次输入；**历史错误答案**记入 `guess_history` 并展示 |
| 等待评判 | `verdict=pending` 时不可重复提交 |
| 猜对后继续 | 仍可发提示；不可再次猜测 |
| 放弃 | `{skip:true}`，本轮不再猜测 |

### 6.4 轮次结束条件

**仅当以下全部满足**，才从活跃期进入 `rating`：

1. 三名玩家均有 guess 记录
2. 每人状态为 `correct` 或 `skipped`（`incorrect` 不算终态，需重猜或 skip）
3. 无 `pending` 猜测还在等待投票

评价 → 结算（对抗计分）→ `complete` → **重新随机分配人物** → 下一轮或终局。

### 6.4.1 每轮人物重新分配

- 每轮 `complete` 结算后、进入下一轮前：`CharacterAssigner.assign(match)` **覆盖** `match_player_assignments`
- 新轮自己人物重新隐藏（`self.character=null`），需再次猜对才 reveal
- 轮末 `_snapshot_round_assignments()` 将当轮三人人物写入 `rounds.assignments_snapshot`（供终局复盘）

### 6.5 提示显示规则（个性化）

玩家 2 发提示（描述 1 和 3 的共同点）：

| 观看者 | UI 区域 | 文案 |
|---|---|---|
| 2（作者） | 发送的提示 | 您发出的提示：{内容} |
| 1 | 收到的提示 | 您的人物和 {3昵称} 的人物 {3人物名} 的联系为：{内容} |
| 3 | 收到的提示 | 您的人物和 {1昵称} 的人物 {1人物名} 的联系为：{内容} |

- 后端：`TraitGuessEngine._format_hints_for_viewer()`
- 前端：`GameBoard.formatHintText()`，兜底用 `state.others` 补全昵称/人物名
- **收到的提示**：按作者分左右两卡，同一玩家多条提示合并在一张卡内
- i18n：`hintOwn`、`hintForYou`、`hintsSent`、`hintsFromOthers`

### 6.5.1 评价阶段（rating）UI

`GET /matches/current` 在 `phase=rating` 时额外返回：

| 字段 | 说明 |
|---|---|
| `round_result` | 本轮猜测结果、合作是否得分、对战累计分与**待结算猜对分** |
| `hint_rating_groups` | 按作者聚合的提示 + 当前玩家是否已评 |

- 合作：显示本轮是否「合作成功」
- 对战：显示截至上轮累计分 + 绿色 `+n`（仅猜对得分，**不含**尚未完成的提示评价分）
- 猜测区展示 `guess_history`（猜错记录 + 评判者昵称文案）

### 6.6 猜测显示与评判

- 猜谜者提交后，另外两人看到：`{昵称} 猜测：{文本}`（i18n: `judgeGuess`）
- 两人都点「猜对了」→ `verdict=correct`；否则 → `incorrect`，写入 `guess_history`
- 猜错重试 UI：`guessIncorrectOne` / `guessIncorrectTwo`（显示哪位玩家判错）+ `excludedWrongGuesses` 列表
- 两人**都**判对才算对（2 票一致）
- 评判 API：`POST /guesses/{id}/votes` `{is_correct: bool}`

### 6.6.1 提示评价（rating 阶段）

- **按玩家评，不按单条提示**：每位提示作者每轮只得 1 个赞或 1 个踩（来自另外两人各 1 票）
- 模型：`author_hint_ratings`（round + author + rater 唯一）
- API：`POST /rounds/current/author-hint-ratings` `{author_id, rating:"like"|"dislike"}`
- 兼容：`POST /hints/{id}/ratings` 仍可用，内部转为评该 hint 的作者
- 对抗计分：作者收到的赞/踩数 × 分值，在 `settlement` 结算
- 完成条件：每个发过提示的玩家都收到 `玩家数-1` 条评价

### 6.7 隐私与 reveal 规则

| 字段 | 规则 |
|---|---|
| `others[].character` | 对局开始后可见 |
| `self.character` | 默认 `null`；**本轮猜对后**返回 assignment 人物 |
| 终局 summary | `get_summary()` **每次从 DB 重建**（不用陈旧 `match.result` 缓存） |

### 6.8 合作模式 settings

```json
{
  "total_rounds": 5,
  "target_rounds": 3,
  "early_win_enabled": true
}
```

- `early_win_enabled=true`：成功轮次 ≥ target 可提前胜利
- `early_win_enabled=false`：打满 total_rounds 后判定
- 成功轮次 = 三人全部 `verdict=correct`

### 6.9 对抗模式 settings

```json
{
  "end_condition": "rounds",
  "max_rounds": 5,
  "target_score": 20,
  "scoring": { "correct_guess": 3, "hint_liked": 1, "hint_disliked": -1 }
}
```

- 分数仅在 `settlement` 结算，不在回合中途累加

### 6.10 引擎关键方法

| 方法 | 作用 |
|---|---|
| `_is_round_active()` | phase 非 rating/settlement/complete |
| `_all_players_terminal()` | 三人均 correct/skip 且无 pending 投票 |
| `_normalize_round_phase()` | 修复遗留 judging/guessing；误进 rating 时回退 |
| `_check_round_completion()` | 满足终态条件 → `rating` |
| `_format_hints_for_viewer()` | 按观看者生成提示 payload |
| `_snapshot_round_assignments()` | 轮末保存当轮人物快照 |
| `_build_hint_rating_groups()` | rating 阶段按作者聚合提示 |
| `_pending_guess_scores()` | rating 阶段待结算猜对分（不含评价分） |
| `submit_author_hint_rating()` | 按作者评价提示 |
| `MatchResultBuilder.build()` | 终局复盘数据（按轮） |

---

## 7. 数据库 Schema 摘要

### 7.1 内容目录（`catalog`）

- `game_modes`：slug=`trait_guess`
- `themes`：slug=`one_piece`
- `characters`：name_zh, name_en, image_url（UI 用色块 initials 占位）

### 7.2 房间与对局（`rooms`）

- `rooms`：room_code(6), game_type, settings(JSON), status, current_match
- `players`：token, seat_index(0-2), language, is_host, is_connected
- `matches`：settings_snapshot, result(JSON), match_number
- `match_player_assignments`：player ↔ character

### 7.3 回合数据

- `rounds`：phase, is_coop_success, **assignments_snapshot**(JSON，当轮三人人物)
- `hints`：author, content（多条/人/轮）
- `guesses`：guess_text, verdict, **guess_history**(JSON `[{text, verdict}]`), is_skipped
- `guess_votes`：两裁判投票
- `hint_ratings`：按 hint 评价（**遗留**，新逻辑用 `author_hint_ratings`）
- **`author_hint_ratings`**：round + author_player + rater_player → like/dislike（每作者每轮每评价者唯一）
- `round_scores` / `match_scores`：对抗计分
- `replay_votes`：三人全 approved → 新 match

### 7.4 Migrations

- `rooms.0001_initial`：初始表
- `rooms.0002_guess_text`：Guess 增加 `guess_text`、`updated_at`
- `rooms.0003_author_hint_rating`：`AuthorHintRating` 表
- `rooms.0004_guess_history`：Guess 增加 `guess_history`
- `rooms.0005_backfill_guess_history`：回填空 history
- `rooms.0006_guess_history_default`：callable default
- `rooms.0007_round_assignments_snapshot`：Round 增加 `assignments_snapshot`

### 7.5 种子数据

```bash
python manage.py seed_one_piece
```

34 个海贼王角色 + game_mode + theme。

---

## 8. API 契约

**Base URL**: `/api/v1`  
**错误格式**: `{ "code": "ROOM_FULL", "message": "...", "details": {} }`

### 8.1 目录与房间

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/game-modes` | - | 模式列表 |
| GET | `/game-modes/{slug}/themes` | - | 主题列表 |
| POST | `/rooms` | - | 创建房间 |
| POST | `/rooms/join` | - | 加入房间 |
| GET | `/rooms/{code}/preview` | - | 公开预览（分享链接） |
| GET | `/rooms/{code}` | Token | 房间详情 |
| PATCH | `/players/me` | Token | 更新昵称/语言 |
| POST | `/rooms/{code}/start` | Token(房主) | 开始（需 3 人） |

### 8.2 游戏

| Method | Path | 活跃期 | Body | 说明 |
|---|---|---|---|---|
| GET | `/matches/current` | * | - | 当前对局状态（玩家视角） |
| GET | `/matches/{id}/summary` | * | - | 终局数据 |
| POST | `/rounds/current/hints` | ✓ | `{content}` | 发提示 |
| POST | `/rounds/current/guesses` | ✓ | `{text}` 或 `{skip:true}` | 文本猜人物 |
| POST | `/guesses/{id}/votes` | ✓ | `{is_correct}` | 评判他人猜测 |
| POST | `/rounds/current/author-hint-ratings` | rating | `{author_id, rating}` | **按作者**评价提示（推荐） |
| POST | `/hints/{id}/ratings` | rating | `{rating}` | 兼容入口（转为评 hint 作者） |
| POST | `/rounds/current/advance` | - | - | **已废弃**（空操作） |
| POST | `/matches/{id}/replay` | - | - | 发起再来一局 |
| POST | `/matches/{id}/replay/vote` | - | `{approved}` | 投票再来一局 |
| GET | `/characters` | Token | - | 人物列表（保留，猜谜已不用下拉） |

### 8.3 `GET /matches/current` 响应要点

```json
{
  "match_id": 1,
  "round": { "number": 1, "phase": "hints" },
  "self": {
    "player_id": 1,
    "display_name": "路飞",
    "character": null
  },
  "others": [
    {
      "player_id": 2,
      "display_name": "索隆",
      "character": { "id": 5, "name_zh": "索隆", "name_en": "Zoro", "image_url": "..." }
    }
  ],
  "hints": [
    {
      "id": 1,
      "author_id": 2,
      "author_name": "索隆",
      "content": "都用剑",
      "is_own": false,
      "other_player_name": "娜美",
      "other_character": { "name_zh": "娜美", "name_en": "Nami" }
    }
  ],
  "guesses": [
    {
      "id": 10,
      "player_id": 1,
      "player_name": "路飞",
      "guess_text": "山治",
      "verdict": "pending",
      "is_skipped": false,
      "guess_history": [{ "text": "索隆", "verdict": "incorrect" }],
      "votes": [{ "voter_id": 2, "is_correct": true }]
    }
  ],
  "hint_rating_groups": [],
  "round_result": null,
  "coop": { "success_rounds": 0, "target_rounds": 3, "total_rounds": 5 }
}
```

`hint_rating_groups` / `round_result` 仅在 `phase=rating` 时有值。猜对后 `self.character` 变为人物对象。

### 8.4 `GET /matches/{id}/summary` 终局复盘

`get_summary()` 始终调用 `MatchResultBuilder.build()` 从 DB 重建（不读陈旧 `match.result`）。

```json
{
  "game_type": "cooperative",
  "players": [{ "player_id": 1, "display_name": "...", "character": {...}, "total_score": 0 }],
  "rounds": [
    {
      "round_number": 1,
      "is_coop_success": true,
      "players": [
        { "player_id": 1, "display_name": "...", "seat_index": 0, "character": {...} }
      ],
      "hint_authors": [
        {
          "author_id": 2,
          "author_name": "...",
          "contents": ["提示1", "提示2"],
          "likes": 2,
          "dislikes": 0,
          "other_characters": [{ "name_zh": "...", "name_en": "..." }, { "name_zh": "...", "name_en": "..." }]
        }
      ],
      "scores": {}
    }
  ],
  "coop": { "success_rounds": 1, "target_rounds": 3, "total_rounds": 5, "won": false }
}
```

- `assignments_snapshot` 为空时 fallback 到终局 `match_player_assignments`（旧局可能不准）
- 新局每轮结束会写入准确快照

---

## 9. WebSocket

**URL**: `ws://127.0.0.1:8000/ws/rooms/{CODE}/?token={PLAYER_TOKEN}`

| type | 说明 |
|---|---|
| `room.updated` | 房间变化 |
| `match.updated` | 对局变化 → 客户端 refetch `/matches/current` |
| `player.connected` | 在线状态 |
| `game.over` | 游戏结束 |

- Hook：`frontend/src/ws/useRoomWebSocket.ts`
- 断线 2s 自动重连
- 本地：`USE_INMEMORY_CHANNEL=true`（单进程 daphne 即可）

---

## 10. 前端路由与页面

| 路由 | 组件 | 功能 |
|---|---|---|
| `/` | `HomePage` | 创建/加入、settings |
| `/room/:code` | `LobbyPage` | 大厅 / 分享链接加入 |
| `/room/:code/play` | `GameBoard` | 游戏主界面 |
| `/room/:code/results` | `ResultsPoster` | 终局复盘 + 再来一局 |

### 10.1 GameBoard 布局

**活跃期**（`phase` 非 rating/settlement/complete）：

1. 三人人物卡（自己未猜对时 `?`，猜对后 reveal）
2. **发送的提示**（仅 `is_own`）
3. **收到的提示**：左右两卡，各对应一名其他玩家，内含其全部提示
4. **评判区**（他人 `pending` 猜测 + 投票）
5. **发提示** / **猜人物**（猜错显示评判者昵称 + 已排除错误猜测列表；`guess_history`）

**评价阶段**（`phase=rating`）：

1. **本轮结果**卡片：每人猜对/猜错/放弃、合作得分或对战分数（含 `+n` 待结算猜对分）
2. **评价提示**：按作者一张卡，其全部提示 + 单次赞/踩

### 10.2 ResultsPoster 终局页

- 顶部：合作胜负 / 对战最终排名（🥇🥈🥉）
- **对局复盘**（替代旧「精彩提示」）：按轮展示
  - 当轮三人人物卡（来自 `assignments_snapshot`）
  - 每位玩家的提示 + 👍/👎；点赞最高标「本轮最佳 👑」
  - 昵称下：`{人物A} 和 {人物B} 的联系为`，下列提示正文
- **再来一局**区块：不变

### 10.3 UI 主题

- 藏蓝 + 草帽黄（`ocean`, `straw`, `parchment`）
- 人物头像：彩色圆形 + 名字前两字

---

## 11. 后端可扩展架构

新游戏模式：新 `GameEngine` + `registry.py` 注册 + 前端 feature 模块。

当前唯一引擎：`apps/games/trait_guess/engine.py`

| 类/模块 | 职责 |
|---|---|
| `CharacterAssigner` | 每轮/开局随机 3 角色，`update_or_create` 覆盖 assignment |
| `TraitGuessEngine` | 状态机、序列化、阶段归一、轮末快照 |
| `ScoreCalculator` | 对抗 settlement（猜对分 + 作者级赞踩分） |
| `MatchResultBuilder` | 终局复盘（按轮 players + hint_authors + other_characters） |

---

## 12. 测试

```bash
cd backend && source .venv/bin/activate
python manage.py test apps.games apps.rooms
```

覆盖要点：

- 角色分配隐私 / 猜对后 reveal
- 文本猜测 + 评判 + 猜错重试
- 猜对后仍可发提示
- 遗留 `judging` phase 下仍可猜测
- 提示个性化
- 按作者评价提示 / `AuthorHintRating`
- 猜错重试 + `guess_history`
- 每轮人物重分配 + `assignments_snapshot`
- rating 阶段 `round_result` / `pending_scores`
- 房间 API / room full / preview（`RoomPreviewView` 需 import `PlayerSerializer`）

```bash
cd frontend && npm run build
```

---

## 13. Docker

```bash
docker-compose up --build
```

MySQL 8 + Redis 7 + backend(8000) + frontend(5173)。

---

## 14. 已知限制 / 未实现

| 项目 | 状态 |
|---|---|
| 用户注册/登录 | 未实现 |
| 多主题 UI 选择 | DB 预留，前端写死海贼王 |
| 真实人物图片 | 色块占位 |
| 猜测自动匹配人物名 | 人工评判，非字符串精确匹配 |
| 阶段超时自动推进 | 未实现 |
| 房主 advance 阶段 | 已移除 |
| 管理员后台 | Django admin |
| 音效 | 未实现 |

---

## 15. 常见问题排查

| 现象 | 原因 | 解决 |
|---|---|---|
| `Unexpected token '<'` | API 返回 HTML | daphne 未跑或 8000 被占 |
| `Cannot reach backend` | 连不上后端 | 重启 daphne；查端口 |
| `Not in guessing phase` / `Not in active play phase` | **旧 daphne 或轮次 phase 卡住** | 重启 daphne；新开一局；引擎会 normalize phase |
| `X-Player-Token header required` | 分享链接未加入 | 走 Lobby 加入表单 |
| 提示显示 `?` | API 字段缺失 | 重启后端；前端有 `others` 兜底 |
| 自己提示出现在「收到的提示」 | 旧版 UI | 已分区；刷新前端 |
| 看不到他人猜测 | 未刷新 / WS 断开 | 确认 daphne；检查 WS |
| 修改后端不生效 | 未重启 daphne | Ctrl+C 后重启 |
| `Room code mismatch` | localStorage token 属于其他房间 | 自动 `clearSession`；或手动清 `player_token` |
| `Backend returned HTML instead of JSON` | 后端 500（常见：未 migrate、缺 import、字段 NOT NULL） | 查 daphne 终端 traceback；`migrate`；重启 daphne |
| `/preview` 500 | `views.py` 缺 `PlayerSerializer` import | 已修复，重启 daphne |
| `guess_history` NOT NULL | 创建 Guess 未写 history | 已修复；`migrate` 至 0006+ |
| 终局页空白 | 旧 `match.result` 格式与前端不兼容 | `get_summary` 已改为 DB 重建；硬刷新前端 |
| 复盘无当轮人物 | 旧局无 `assignments_snapshot` | 新开一局；或 fallback 显示终局人物 |
| 同浏览器测多人 | 共享 localStorage | 普通窗口 + 无痕窗口 |

---

## 16. Agent 修改建议

### 16.1 修改游戏逻辑

1. 读 `backend/apps/games/trait_guess/engine.py`
2. 同步 `frontend/src/features/game/GameBoard.tsx`
3. 更新 `frontend/src/api/client.ts` 类型
4. `python manage.py test apps.games`

### 16.2 修改房间/加入

- 后端：`room_service.py`、`views.py`（含 `RoomPreviewView`）
- 前端：`LobbyPage.tsx`

### 16.3 修改终局 / 复盘页

- 后端：`MatchResultBuilder`、`TraitGuessEngine._snapshot_round_assignments`、`get_summary`
- 前端：`ResultsPoster.tsx`、`client.ts` 的 `MatchSummary` 类型

### 16.4 不要破坏的约定

- 提示与猜测在活跃期**并行**
- 轮次结束：**三人全部 correct 或 skip**，且无 pending 投票
- 猜对后 `self.character` 对该玩家 reveal
- **每轮结束重新分配人物**，并快照至 `assignments_snapshot`
- 对抗分数只在 `settlement` 结算
- 裁判 2 人一致才判对
- 猜测为**文本** + **人工评判**，非 ID 选择
- 提示评价按**作者**计票与计分，非按单条 hint
- `Guess.objects.create` 必须带 `guess_history=[]`
- 分享链接加入须处理 **token 房间不匹配**

---

## 17. 关键文件速查

```
backend/apps/games/trait_guess/engine.py    # 游戏状态机 ★
backend/apps/rooms/models.py                # Guess、AuthorHintRating、assignments_snapshot
backend/apps/rooms/services/room_service.py
backend/apps/rooms/views.py                 # 含 RoomPreviewView
backend/apps/rooms/consumers.py
frontend/src/features/game/GameBoard.tsx    # 游戏 UI ★
frontend/src/features/results/ResultsPoster.tsx  # 终局复盘 ★
frontend/src/features/lobby/LobbyPage.tsx   # 含 session 房间绑定
frontend/src/api/client.ts                  # 含 storeSession / sessionMatchesRoom
frontend/src/i18n/index.ts
backend/apps/catalog/management/commands/seed_one_piece.py
```

---

## 18. 版本记录

| 日期 | 变更 |
|---|---|
| 初始 MVP | 全栈、trait_guess、合作/对抗、终局、再来一局 |
| 分享链接 | `/rooms/{code}/preview`；Lobby 无 token 加入表单 |
| 提示并行 | 个性化提示；移除 advance；提示/猜测同期 |
| 文本猜测 v2 | 输入框猜人物；inline 评判；猜对 reveal；猜错重试；猜对后可继续提示 |
| 阶段归一 | 取消独立 judging/guessing；`_normalize_round_phase`；仅全员终态进 rating |
| 提示 UI | 「发送的提示」「收到的提示」分区；前端兜底昵称/人物名 |
| 端口/CORS | `ALLOWED_HOSTS=*`（DEBUG）；8000 端口冲突文档化 |
| 分享链接修复 | `room_code` session 绑定；`PlayerSerializer` preview 修复 |
| 评价按作者 | `AuthorHintRating`；rating UI 按作者聚合卡片 |
| 猜错 UX | 评判者昵称文案；`guess_history` 排除错误答案 |
| rating 本轮结果 | `round_result`；对战 `pending_scores`（仅猜对分） |
| 每轮换人 | `CharacterAssigner` 每轮重分配；`assignments_snapshot` |
| 收到提示 UI | 两列卡片按玩家聚合 |
| 终局复盘 v2 | 按轮人物+提示+赞踩；`get_summary` DB 重建；`recapHintLink` 文案 |
| guess_history 修复 | migrations 0004–0006；create 时显式 `[]` |

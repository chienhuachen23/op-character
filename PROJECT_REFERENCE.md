# OP Character — 项目实现参考文档

> 本文档供后续 Agent 会话快速了解当前实现、架构约定与注意事项。  
> 最后更新：2026-06-17（v9）

---

## 0. 当前状态快照（Agent 快速读）

| 项目 | 状态 |
|---|---|
| GitHub | `https://github.com/chienhuachen23/op-character`（`main`） |
| 生产部署 | Railway 单容器（见 §13、`DEPLOY_RAILWAY.md`） |
| 本地开发 | 双终端：daphne:8000 + vite:5173 |
| 玩家鉴权 | `X-Player-Token`（无注册） |
| 管理员鉴权 | `X-Admin-Key` = 环境变量 `ADMIN_API_KEY` |
| 内容管理 | 自定义 React `/admin`（非 Django Admin） |

**近期重要变更（v8→v9）：**

- **人物多图**：`character_images` 表；管理员可为同一人物上传多张图；游戏每次分配人物时从图库**随机选一张**写入 `match_player_assignments.display_image_url`（当轮/当次分配内固定）
- **管理员 API**：`POST /admin/characters/{id}/images` 追加图片；`DELETE /admin/characters/{id}/images/{image_id}` 删除；列表返回 `images[]` + `image_count`
- **迁移**：`catalog.0003_character_image`（含将旧 `image_url` 迁入图库）；`rooms.0009` 增加 `display_image_url`

**近期重要变更（v7→v8）：**

- **退出游戏跳回房间修复**：`useRoomWebSocket` 卸载时取消重连定时器并清空 `wsRef`，避免大厅/游戏页卸载后孤儿 WS 触发 `navigate`；异步 `fetch*` 增加 `mountedRef` 守卫；大厅仅在当前路径为 `/room/:code` 时自动进 `/play`
- **退出 UX**：`navigate('/', { replace: true })` 避免浏览器后退又回到对局

**近期重要变更（v6→v7）：**

- **人物肖像交互**：游戏人物卡内肖像居中；管理员页与游戏页悬浮肖像显示放大预览（`CharacterPortrait` `hoverPreview`）
- **部署诊断日志**：`start.sh` 启动后输出 `Database ready: N characters in catalog` 便于确认 Volume 持久化

**近期重要变更（v5→v6）：**

- **管理员人物筛选**：搜索框模糊匹配中英文名；可筛选「无图片」「未启用随机分配」；显示 `显示数 / 总数`
- **管理员编辑弹窗**：新建/编辑人物改为 Modal 弹窗，无需滚回页面顶部；`components/ui.tsx` 新增 `Modal`；筛选逻辑 `features/admin/characterFilters.ts`

**近期重要变更（v4→v5）：**

- **管理员 CMS 增强**：人物卡片拖放/点击上传图片；CSV **导出/导入**（仅中英文名，增量导入）；新建人物图片选填、创建表单可拖图
- **人物肖像 UI**：`CharacterPortrait` 组件，圆角矩形 **5:7** 卡牌比例（管理员 + 游戏 + 复盘）；`frontend/public/favicon.png` + 站点标题
- **对局人物重选**：活跃期内可申请为他人的角色重选，**第三位玩家**确认后随机换新人物；重置目标玩家当轮猜测；`character_reroll` 状态字段
- **SPA / 路由修复**：Django 内置后台迁至 `/django-admin/`；`SPAFallbackMiddleware` 优先服务 `/admin`、`/admin/*`、`/room/*`（刷新不再进 Django 登录页）
- **Railway 数据持久化**：`seed_one_piece` **仅新建**角色时写默认 `image_url`，部署不再覆盖管理员上传的 `/media/` 路径；**必须**挂 Volume `/app/data` 否则 DB/图片/新增人物每次部署丢失
- **管理员上传 UX**：上传成功绿色提示 + 乐观更新列表（`CharacterPortrait` 在 `imageUrl` 变化时重置 `failed`）

**近期重要变更（v3→v4，仍有效）：**

- 再来一局：全员同意后**所有玩家**自动跳转 `/play`（`ResultsPoster.fetchData` + 后端 `_replay_response_state`）
- 游戏内增加「退出游戏」按钮（回首页，不清 token）
- **管理员 CMS**：主题/人物/图片维护（`frontend/src/features/admin/` + `catalog/admin_*.py`）
- 人物卡支持 `image_url` 显示图片（失败回退色块 initials）
- **Railway 生产架构**：根目录 `Dockerfile` 构建前端 + Daphne 同端口；Whitenoise 静态资源 + SPA fallback；**不用 Nginx**
- 容器启动时 `migrate` + `seed_one_piece`（**不要**仅用 `preDeployCommand`，Volume 数据库不同步）

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
| 后端 | Django 5、DRF、Channels、Daphne、Whitenoise（生产静态资源） |
| 实时 | WebSocket + Redis（本地/Railway 可用 InMemory Channel Layer） |
| 数据库 | MySQL 8（本地默认 SQLite，`USE_SQLITE=true`） |
| 前端 | React 18、Vite 8、TypeScript、Tailwind CSS 4、Framer Motion |
| i18n | react-i18next（UI 文案）+ API 双语字段（人物名） |
| 部署 | Railway（生产）；`docker-compose`（本地全栈，前后端分离端口） |

---

## 3. 目录结构

```text
op-character/
├── PROJECT_REFERENCE.md      # 本文档
├── DEPLOY_RAILWAY.md         # Railway 部署步骤与排错
├── README.md
├── Dockerfile                # ★ 生产镜像（前端 build + Daphne）
├── railway.toml
├── deploy/start.sh           # 生产启动：migrate → seed → daphne
├── docker-compose.yml        # 本地 Docker（前后端分离，非生产架构）
├── backend/
│   ├── config/
│   ├── apps/
│   │   ├── core/             # middleware.py：SPA fallback、/health
│   │   ├── catalog/          # 主题/人物 + admin API
│   │   ├── rooms/
│   │   └── games/trait_guess/engine.py
│   └── manage.py
└── frontend/
    └── src/
        ├── api/client.ts, adminClient.ts
        ├── features/
        │   ├── home/ lobby/ game/ results/
        │   └── admin/        # ★ 内容管理 CMS（含 characterCsv.ts）
        └── components/CharacterCard.tsx, CharacterPortrait.tsx
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
| `ADMIN_API_KEY` | `dev-admin-key`（示例） | 管理员 CMS 密钥；未设置则管理 API 返回 `ADMIN_DISABLED` |
| `DATA_DIR` | 可选 | 持久化目录；Railway 卷挂载 `/app/data` |
| `DATABASE_PATH` | 可选 | SQLite 路径，默认 `{DATA_DIR}/db.sqlite3` |

### 4.4 前端 API 连接

**本地开发**：`client.ts` 在 `import.meta.env.DEV` 时直连 `http://127.0.0.1:8000`。

**生产（Railway 同域）**：`npm run build` 不设 `VITE_API_URL` 时 `API_BASE=''`，API/WS 走相对路径（同域名）。

`vite.config.ts` 配置 `/api`、`/ws` 代理到 8000，可作备选。

### 4.5 跨设备本地测试（未部署时）

同 WiFi 下前端需指定电脑 IP：

```bash
VITE_API_URL=http://192.168.x.x:8000 VITE_WS_URL=ws://192.168.x.x:8000 npm run dev -- --host
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

分享链接勿用 `127.0.0.1`。详见历史会话 / `DEPLOY_RAILWAY.md` 局域网说明。

### 4.6 已知端口问题

- 8000 常被占用 → `Cannot reach backend` 或返回 HTML
- 排查：`lsof -i :8000`
- 若冲突：daphne 改端口（如 8001），同步改 `client.ts` 与 `vite.config.ts`

### 4.7 修改后端后

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

| 类型 | 示例 | 鉴权 |
|---|---|---|
| 公开 | `GET /game-modes`、`POST /rooms`、`POST /rooms/join` | 无 |
| 公开预览 | `GET /rooms/{code}/preview` | 无 |
| 健康检查 | `GET /health` | 无 |
| 玩家 | `GET /rooms/{code}`、`GET /matches/current`、游戏写操作 | `X-Player-Token` |
| 管理员 | `GET/POST /api/v1/admin/*` | `X-Admin-Key` = `ADMIN_API_KEY` |

### 5.3 管理员 CMS

- 入口：首页底部「管理员入口」→ `/admin`
- 登录：密钥存 `localStorage`（`admin_api_key`），请求头 `X-Admin-Key`
- 未配置 `ADMIN_API_KEY` → `403 ADMIN_DISABLED`（「Admin API is disabled」）
- 页面：`/admin` 登录 → `/admin/themes` 主题列表 → `/admin/themes/:id` 人物网格
- **搜索与筛选**：中英文模糊搜索；勾选「无图片」（图库无有效图且无有效 `image_url`）、「未启用随机分配」（`is_active=false`）
- **编辑 UX**：新建/编辑人物在 **Modal 弹窗**中完成（Esc / 遮罩关闭）
- **多图管理**：人物卡片显示封面 + 缩略图网格 + 数量角标；拖放/「添加图片」**追加**不覆盖；每张可单独删除
- 图片存储：`POST /admin/characters/{id}/images` → `media/characters/{theme_slug}/`；`Character.image_url` 保留为封面（最新一张，兼容旧逻辑）
- **CSV**：导出 `中文名,英文名`；导入为**增量**（仅新增行，不删不改已有）；`POST /admin/themes/{id}/characters/import`
- 上传成功有绿色提示；列表即时刷新头像（勿依赖整页刷新）
- 后端：`catalog/admin_views.py`、`admin_serializers.py`、`permissions.py`
- 前端：`api/adminClient.ts`、`features/admin/*`、`features/admin/characterCsv.ts`、`features/admin/characterFilters.ts`
- **勿与** Django 内置 Admin 混淆：其在 **`/django-admin/`**；React CMS 在 **`/admin`**

### 5.4 分享链接流程

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

- `request_replay` / `vote_replay(approved=true)` 等价于投赞成票
- 全员同意后：`room.current_match` 换新 match，`room.status=playing`；`_replay_response_state` 返回**新 match** 状态
- 前端 `ResultsPoster`：`room_status===playing` 时跳转 `/play`（含 WS `match.updated`）

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
| **人物重选** | 玩家 A 为 B 点「重选」→ 玩家 C 确认 → B 换新角色；删 B 当轮 Guess；同时仅 1 个 pending 申请 |

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
| `_replay_response_state()` | 再来一局完成后返回新 match 状态 |
| `_check_replay_complete()` | 三人全 approved → 创建新 match |

---

## 7. 数据库 Schema 摘要

### 7.1 内容目录（`catalog`）

- `game_modes`：slug=`trait_guess`
- `themes`：slug=`one_piece`
- `characters`：name_zh, name_en, image_url（封面/兼容，可空）, is_active
- `character_images`：character_id, image_url, sort_order, created_at（**多图图库**）

### 7.2 房间与对局（`rooms`）

- `rooms`：room_code(6), game_type, settings(JSON), status, current_match
- `players`：token, seat_index(0-2), language, is_host, is_connected
- `matches`：settings_snapshot, result(JSON), match_number
- `match_player_assignments`：player ↔ character；`display_image_url` 为当次分配随机选中的肖像

### 7.3 回合数据

- `rounds`：phase, is_coop_success, **assignments_snapshot**(JSON，当轮三人人物)
- `hints`：author, content（多条/人/轮）
- `guesses`：guess_text, verdict, **guess_history**(JSON `[{text, verdict}]`), is_skipped
- `guess_votes`：两裁判投票
- `hint_ratings`：按 hint 评价（**遗留**，新逻辑用 `author_hint_ratings`）
- **`author_hint_ratings`**：round + author_player + rater_player → like/dislike（每作者每轮每评价者唯一）
- `round_scores` / `match_scores`：对抗计分
- `replay_votes`：三人全 approved → 新 match
- **`character_reroll_requests`**：round + target_player + requester_player + status(pending/rejected)

### 7.4 Migrations

- `rooms.0001_initial`：初始表
- `rooms.0002_guess_text`：Guess 增加 `guess_text`、`updated_at`
- `rooms.0003_author_hint_rating`：`AuthorHintRating` 表
- `rooms.0004_guess_history`：Guess 增加 `guess_history`
- `rooms.0005_backfill_guess_history`：回填空 history
- `rooms.0006_guess_history_default`：callable default
- `rooms.0007_round_assignments_snapshot`：Round 增加 `assignments_snapshot`
- `rooms.0008_character_reroll_request`：`CharacterRerollRequest` 表
- `catalog.0002_character_image_url_optional`：`characters.image_url` 可空

### 7.5 种子数据

```bash
python manage.py seed_one_piece
```

34 个海贼王角色 + game_mode + theme。

> **重要**：`seed_one_piece` 在 `start.sh` 每次部署都会执行，但**仅在新创建角色时**写入默认 SVG `image_url`；**不会覆盖**已有角色的管理员上传路径。无 Volume 时整个 SQLite 仍会丢失（含手动新增人物）。

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
| POST | `/rounds/current/character-rerolls` | ✓ | `{target_player_id}` | 申请为他人重选人物 |
| POST | `/rounds/current/character-rerolls/confirm` | ✓ | `{target_player_id, approved}` | 第三人确认/拒绝重选 |
| POST | `/guesses/{id}/votes` | ✓ | `{is_correct}` | 评判他人猜测 |
| POST | `/rounds/current/author-hint-ratings` | rating | `{author_id, rating}` | **按作者**评价提示（推荐） |
| POST | `/hints/{id}/ratings` | rating | `{rating}` | 兼容入口（转为评 hint 作者） |
| POST | `/rounds/current/advance` | - | - | **已废弃**（空操作） |
| POST | `/matches/{id}/replay` | - | - | 发起再来一局 |
| POST | `/matches/{id}/replay/vote` | - | `{approved}` | 投票再来一局 |
| GET | `/characters` | Token | - | 人物列表（保留，猜谜已不用下拉） |

### 8.3 管理员 CMS（`X-Admin-Key`）

| Method | Path | Body | 说明 |
|---|---|---|---|
| POST | `/admin/auth/verify` | - | 验证密钥 |
| GET/POST | `/admin/themes` | 创建：`{slug,name_zh,name_en,game_mode}` | 主题列表/新建 |
| GET/PATCH | `/admin/themes/{id}` | - | 主题详情/更新 |
| GET/POST | `/admin/themes/{id}/characters` | 人物字段 | 人物列表/新建 |
| POST | `/admin/themes/{id}/characters/import` | `{characters:[{name_zh,name_en}]}` | 批量增量导入 |
| PATCH/DELETE | `/admin/characters/{id}` | - | 更新/删除人物 |
| POST | `/admin/characters/{id}/images` | `multipart: file` | 为人物**追加**一张图片 |
| DELETE | `/admin/characters/{id}/images/{image_id}` | - | 删除人物某张图片 |
| POST | `/admin/upload-image` | `multipart: file, theme_slug` | 仅上传文件返回 URL（遗留） |

### 8.4 `GET /matches/current` 响应要点

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
  "character_reroll": null,
  "coop": { "success_rounds": 0, "target_rounds": 3, "total_rounds": 5 }
}
```

`character_reroll` 在活跃期有待确认重选时非 null，示例：

```json
"character_reroll": {
  "target_player_id": 2,
  "target_player_name": "索隆",
  "requester_player_id": 1,
  "requester_player_name": "路飞",
  "confirmer_player_id": 3,
  "status": "pending"
}
```

`hint_rating_groups` / `round_result` 仅在 `phase=rating` 时有值。猜对后 `self.character` 变为人物对象。

### 8.5 `GET /matches/{id}/summary` 终局复盘

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
- 断线 2s 自动重连（**仅组件仍挂载时**；卸载须取消重连，避免退出后跳回房间）
- 本地：`USE_INMEMORY_CHANNEL=true`（单进程 daphne 即可）

---

## 10. 前端路由与页面

| 路由 | 组件 | 功能 |
|---|---|---|
| `/` | `HomePage` | 创建/加入、settings；底部管理员入口 |
| `/room/:code` | `LobbyPage` | 大厅 / 分享链接加入 |
| `/room/:code/play` | `GameBoard` | 游戏主界面；右上角「退出游戏」→ 首页（**保留 token**，可凭分享链接再进同房间） |
| `/room/:code/results` | `ResultsPoster` | 终局复盘 + 再来一局 |
| `/admin` | `AdminLoginPage` | 管理员登录 |
| `/admin/themes` | `AdminThemesPage` | 主题列表 |
| `/admin/themes/:themeId` | `AdminThemeDetailPage` | 人物与图片维护 |

### 10.1 GameBoard 布局

**活跃期**（`phase` 非 rating/settlement/complete）：

1. 三人人物卡（自己未猜对时 `?`，猜对后 reveal）；他人卡片下可 **重选**（见 §6.3）
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
- **再来一局**区块：
  - 仅「再来一局」（`requestReplay`）+「拒绝」；已投票显示「已同意再来一局」
  - 全员同意后：`fetchData` / `handleReplay` 检测 `room_status===playing` → 全员跳转 `/play`
  - WebSocket `match.updated` 也会触发 `fetchData` 跳转

### 10.3 人物肖像

- 共享组件：`frontend/src/components/CharacterPortrait.tsx`（`CharacterCard`、管理员页共用）
- 圆角矩形 **aspect-ratio 5:7**（海贼王卡牌比例），`object-cover object-center`；游戏 `CharacterCard` 内 `flex justify-center` 居中
- **多图随机**：后端分配时 `pick_character_image()` 从 `character_images` 随机一张写入 `display_image_url`；API 返回的 `character.image_url` 即为当次展示图（每轮重新分配会换新图）
- **悬浮放大**：有图片时鼠标悬停显示更大预览（默认 `hoverPreview=true`）；`cursor-zoom-in`
- `image_url` 有值时显示图片（`resolveMediaUrl`）；加载失败回退色块 + 名字前两字
- 管理员上传后 `imageUrl` 变化须重置 `failed` 状态（已实现 `useEffect`）
- 种子默认路径 `/characters/one_piece/*.svg` 可能 404；管理员上传 `/media/...` 正常

### 10.4 UI 主题

- 藏蓝 + 草帽黄（`ocean`, `straw`, `parchment`）
- 浏览器标签图标：`frontend/public/favicon.png`（草帽海贼团标志）；`index.html` 标题「人物共性猜谜」

---

## 11. 后端可扩展架构

新游戏模式：新 `GameEngine` + `registry.py` 注册 + 前端 feature 模块。

当前唯一引擎：`apps/games/trait_guess/engine.py`

| 类/模块 | 职责 |
|---|---|
| `CharacterAssigner` | 每轮/开局随机 3 角色；`reroll_for_player` 为单人换角（排除当前三人已用） |
| `TraitGuessEngine` | 状态机、序列化、阶段归一、轮末快照、**人物重选** |
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
- **人物重选**（第三人确认、猜测重置）
- 房间 API / room full / preview（`RoomPreviewView` 需 import `PlayerSerializer`）

```bash
cd frontend && npm run build
```

---

## 13. 生产部署（Railway）

> 详细步骤：**[DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)**

### 13.1 架构（当前）

```text
https://{app}.up.railway.app
  ├── /health           → Django health_view
  ├── /api/v1/*         → DRF API
  ├── /ws/*             → Channels WebSocket
  ├── /media/*          → 上传图片（MEDIA_ROOT = {DATA_DIR}/media）
  ├── /django-admin/    → Django 内置后台（非日常 CMS）
  └── /*                → React SPA（Whitenoise + SPAFallbackMiddleware）
```

- `SPAFallbackMiddleware`：`/admin`、`/admin/*`、`/room/*` 直接返回 `index.html`（避免与 Django admin 冲突）

- 根目录 `Dockerfile`：多阶段构建（`npm run build` → 复制到 `/app/static/frontend`）
- `deploy/start.sh`：**migrate → seed → `exec daphne -b 0.0.0.0 -p $PORT`**
- `railway.toml`：healthcheck `/health`；**勿**在 Dockerfile 使用 `VOLUME`（Railway 不支持）
- 持久化：Railway Volume 挂载 **`/app/data`**（SQLite + media）

### 13.2 Railway 环境变量（必填/推荐）

| 变量 | 说明 |
|---|---|
| `DJANGO_SECRET_KEY` | 随机密钥 |
| `ADMIN_API_KEY` | 管理员 CMS 密码 |
| `DJANGO_DEBUG` | `false` |
| `USE_SQLITE` | `true` |
| `USE_INMEMORY_CHANNEL` | `true` |
| `DATA_DIR` | `/app/data` |
| `PORT` | **由 Railway 自动注入，勿手动覆盖** |

### 13.3 Railway 502 / 管理页排错要点

| 现象 | 原因 | 解决 |
|---|---|---|
| 502 / `x-railway-fallback` | Target Port 与监听端口不一致 | Networking → Target Port = **8080**；删手动 `PORT` 变量 |
| `Admin API is disabled` | 未设 `ADMIN_API_KEY` | Variables 添加后 Redeploy |
| `invalid JSON` on `/admin/themes` | 后端 500 返回 HTML（常因 DB 未 migrate） | 确保 `start.sh` 含 migrate+seed；**勿仅依赖 preDeploy** |
| 登录成功但列表失败 | 登录不查 DB，列表查 DB | 同上 |
| 刷新 `/admin` 进 Django 登录页 | Django `admin/` 与 React `/admin` 冲突 | 已修：Django → `/django-admin/` + SPA fallback |
| 部署后图片变色块 / URL 变 `.svg` | `seed` 曾覆盖 `image_url` | 已修：seed 仅新建角色写默认图；仍须 Volume |
| 部署后新增人物消失 | 未挂 Volume，SQLite 重建 | Settings → Volumes → `/app/data` |

### 13.4 不适合的平台

- **Vercel 全栈**：不支持 Django Channels 长连接 WebSocket + 持久化 SQLite/上传
- 可选：Vercel 仅前端 + Railway 后端（需配 CORS 与 `VITE_API_URL`）

### 13.5 本地 Docker Compose

```bash
docker-compose up --build
```

前后端分离（5173 + 8000），**与 Railway 生产架构不同**，仅适合本地全栈试跑。

---

## 14. 已知限制 / 未实现

| 项目 | 状态 |
|---|---|
| 用户注册/登录 | 未实现 |
| 多主题 UI 选择（玩家建房） | DB 预留，建房 UI 仍写死海贼王 |
| 人物图片 | 支持 `image_url` + 管理员上传；无图时色块占位 |
| 猜测自动匹配人物名 | 人工评判，非字符串精确匹配 |
| 阶段超时自动推进 | 未实现 |
| 房主 advance 阶段 | 已移除 |
| Django Admin (`/django-admin/`) | 保留；日常用 React `/admin` CMS |
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
| 退出游戏后又跳回房间 | 页面卸载后 WS 仍重连，旧回调 `navigate` | 已修：`useRoomWebSocket` 卸载清理 + `mountedRef` |
| 复盘无当轮人物 | 旧局无 `assignments_snapshot` | 新开一局；或 fallback 显示终局人物 |
| 同浏览器测多人 | 共享 localStorage | 普通窗口 + 无痕窗口 |
| 再来一局仅最后一人进新局 | 未跳转 `/play` | 已修：`ResultsPoster` WS + `fetchData` |
| Railway `VOLUME` in Dockerfile | 构建失败 | 用 Railway Dashboard 挂 Volume |
| 管理员 `invalid JSON` | DB 500 HTML | `start.sh` migrate+seed；检查 `/api/v1/game-modes` 是否 JSON |
| 管理员 `ADMIN_DISABLED` | 无 `ADMIN_API_KEY` | Railway Variables 配置 |
| 管理员上传成功但头像不变 | `CharacterPortrait` `failed` 未重置 | 已修；硬刷新可验证 |
| `makemigrations` 提示 rooms 索引漂移 | 索引名与 migration 不一致 | 模型 `Index` 须带 `name="character_r_round_i_6f0a2a_idx"` |

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

### 16.5 修改管理员 CMS

- 后端：`catalog/admin_views.py`、`admin_serializers.py`、`permissions.py`、`urls.py`
- 前端：`features/admin/*`、`api/adminClient.ts`
- 图片：`MEDIA_ROOT`（生产 `DATA_DIR/media`）；`resolveMediaUrl()` 拼接 API 域名

### 16.6 修改生产部署

- `Dockerfile`、`deploy/start.sh`、`railway.toml`、`DEPLOY_RAILWAY.md`
- **勿**将 migrate 仅放 `preDeployCommand`（与运行时 Volume 不同步）
- **勿**在 Dockerfile 使用 `VOLUME` 指令

### 16.7 不要破坏的约定

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
- 再来一局全员同意后须 **所有客户端** 跳转 `/play`（WS + API 双路径）
- 生产环境 **`ADMIN_API_KEY` 未设置则管理 API 关闭**
- React CMS 路由 **`/admin`** 不可再被 Django `admin/` 占用（用 `/django-admin/`）
- **`seed_one_piece` 不得覆盖已有角色的 `image_url`**
- Railway 生产**必须** Volume `/app/data` 持久化 DB + media

---

## 17. 关键文件速查

```
backend/apps/games/trait_guess/engine.py    # 游戏状态机 ★
backend/apps/catalog/admin_views.py         # 管理员 API ★
backend/apps/core/middleware.py             # SPA fallback、health
backend/config/settings.py                  # Whitenoise、MEDIA、CORS、ALLOWED_HOSTS
deploy/start.sh                             # Railway 启动脚本 ★
Dockerfile                                  # 生产镜像 ★
backend/apps/rooms/models.py
backend/apps/rooms/services/room_service.py
backend/apps/rooms/views.py
frontend/src/features/game/GameBoard.tsx
frontend/src/features/results/ResultsPoster.tsx
frontend/src/features/admin/AdminThemesPage.tsx
frontend/src/features/admin/AdminThemeDetailPage.tsx
frontend/src/api/client.ts
frontend/src/api/adminClient.ts
backend/config/urls.py                        # django-admin 路径 ★
frontend/src/components/CharacterPortrait.tsx
frontend/src/features/admin/characterCsv.ts
frontend/public/favicon.png
frontend/src/i18n/index.ts
DEPLOY_RAILWAY.md
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
| 再来一局跳转修复 | 全员同意后 WS/fetchData 跳转；简化按钮；`_replay_response_state` |
| 退出游戏 | `GameBoard` 右上角回首页 |
| 管理员 CMS v1 | React `/admin`；`ADMIN_API_KEY`；主题/人物/图片 CRUD |
| 人物图片显示 | `CharacterCard` + `resolveMediaUrl` |
| Railway 部署 | 根 `Dockerfile`、Daphne+Whitenoise 同端口、`DEPLOY_RAILWAY.md` |
| GitHub | `chienhuachen23/op-character` |
| Railway 502 修复 | 去掉 Nginx/Dockerfile VOLUME；`exec daphne`；Target Port 8080 |
| Railway 管理 API | 容器内 migrate+seed；禁用仅 preDeploy 写库 |
| 管理员拖放上传 | 人物卡片拖放/点击上传图片 |
| 管理员 CSV | 导出/增量导入人物（中英文名）；创建时图片选填 |
| Favicon | `favicon.png` 草帽标志；站点标题 |
| SPA 路由修复 | Django Admin → `/django-admin/`；`/admin` 刷新不进 Django 登录 |
| 卡牌比例肖像 | `CharacterPortrait` 5:7 圆角矩形（游戏+管理员） |
| 对局人物重选 | 第三人确认后换角；`character_reroll_requests`；API + GameBoard UI |
| seed 不覆盖图片 | `seed_one_piece` 仅新建角色写默认 `image_url` |
| 管理员上传 UX | 成功提示 + 乐观更新头像；`CharacterPortrait` 重置 `failed` |
| 管理员搜索筛选 | 中英文模糊搜索；无图/未启用筛选；`characterFilters.ts` |
| 管理员编辑弹窗 | 新建/编辑 Modal；`components/ui.tsx` `Modal` |
| 肖像悬浮放大 | `CharacterPortrait` hover 预览；游戏卡内居中 |
| 退出游戏跳回房间 | WS 卸载后孤儿重连 + 异步 navigate | `useRoomWebSocket` 清理；`mountedRef` |
| 人物多图 | `character_images` + 分配时随机 `display_image_url` | 管理员追加/删除图片 API |

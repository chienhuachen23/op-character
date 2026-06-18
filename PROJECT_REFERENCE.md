# OP Character — 项目实现参考文档

> 本文档供后续 Agent 会话快速了解当前实现、架构约定与注意事项。  
> 最后更新：2026-06-19（v12.2）

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

**近期重要变更（v12.1→v12.2）：**

- **猜测历史卡片**：原「随时猜测自己的人物」改为「猜测历史」（`guessHistorySection`）；**无猜测记录时隐藏**（避免开局空框）
- **猜对不再卡片内重复提示**：终态「猜对了！」仅由底部绿色按钮展示；卡片仅在有 `guess_history` 时列出历史
- **底部操作栏固定**：`fixed bottom-0`，滚动时「猜测！」/「放弃。。」始终可见；主内容 `pb-28` 防遮挡
- **放弃钮样式**：「放弃。。」及放弃确认 Modal 的「取消」为**白字**深色底（`text-white`）

**近期重要变更（v12→v12.1）：**

- **提示与猜测 UI 分离**：发提示为独立卡片；猜测移至页面**最底部**操作栏（不再 Tab 合并）
- **猜测/放弃弹窗**：点「猜测！」→ Modal 输入人物名后提交；点「放弃。。」→ Modal 确认「确认要放弃猜测吗？」，取消可继续猜
- **底部按钮状态机**（始终可见，终态/等待时 disabled）：
  - 可猜：左「猜测！」（黄）+ 右「放弃。。」（白字），均可点
  - 等待评判：左「评审中～」+ 右「放弃。。」，均不可点
  - 猜对：仅左「猜对了！」绿色宽按钮，放弃隐藏
  - 已放弃：仅右「认输了。。」红色宽按钮，猜测隐藏
- **i18n**：`guessButton`、`guessButtonCorrect`、`guessButtonReviewing`、`skipButtonShort`、`skipButtonSurrender`、`confirmSkipGuess`、`guessHistorySection`

**近期重要变更（v11→v12）：**

- **放弃猜测也 reveal**：`self.character` 在 `verdict=correct` **或** `skipped` 时返回；前端显示「已放弃猜测，人物已揭晓」
- **提示软撤回**：`DELETE /hints/{id}` 将 `is_withdrawn=true`（非物理删除）；列表保留并显示删除线；已撤回不参与 rating 计票/计分
- **提示列表全量展示**：移除 `max-h-48 overflow-y-auto`，多条提示完整展开
- **评价阶段显示自己的提示**：rating 页新增「你发出的提示」只读区块（`yourHints`）；他人提示仍在 `hint_rating_groups` 评价
- **迁移**：`rooms.0010_hint_is_withdrawn`（`hints.is_withdrawn`）
- **i18n**：`withdrawHint`、`guessSkippedReveal`；修复英文 `guessCorrect`

**近期重要变更（v10→v11）：**

- **拖拽上传增强**：同步捕获 `DataTransfer`（避免 `await` 后数据被清空）；从 `items` 读取文件（兼容微信/网页拖入）；支持 `data:` / `blob:` URL；外链 CORS 失败时走后端 `POST /admin/characters/{id}/images/from-url` 服务端拉图
- **拖拽上传 UX**：上传成功仅更新卡片 + 绿色提示 + 短暂高亮新图；**不再**自动打开图片管理弹窗（须点击肖像手动打开）
- **多图拖入**：角色卡片支持一次拖入多张本地/网页图片

**近期重要变更（v9→v10）：**

- **管理员多图卡片 UI**：多张图叠加展示 + 右上角数量角标；悬停显示第一张放大图；点击打开图片管理弹窗（网格预览、悬停放大、单张删除）

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
- 玩法：每人分配秘密人物；默认**看不到自己的人物**；能看到另外两人的人物；描述另外两人角色的共同点发提示；**文本输入**猜自己是谁；另外两人实时评判；猜对或**放弃猜测**后自己人物 reveal；可继续发提示；轮末对提示点赞/点踩
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
- **多图管理**：人物卡片显示**叠加肖像**（≥2 张）+ 数量角标；**点击**打开 `AdminCharacterGalleryModal` 管理全部图片（悬停放大、× 删除）；拖放/「添加图片」追加（上传成功不自动弹窗）
- 图片存储：`POST /admin/characters/{id}/images` 追加图片；`POST /admin/characters/{id}/images/from-url` 从外链导入（拖拽网页图 CORS 兜底）；`DELETE .../images/{image_id}` 删除
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
| 发提示 | 随时可发，可多条；**独立卡片**输入；分区显示「发送的提示」「收到的提示」；**可撤回**（软删除 + 删除线，见 §6.5.2） |
| 文本猜人物 | 页面底部「猜测！」→ **Modal** 输入 `{text}` 提交；非下拉选角色 |
| 放弃猜测 | 底部「放弃。。」→ **确认 Modal**；确认后 `{skip:true}`，取消仍可猜 |
| 他人评判 | 提交猜测后，另外两人**在同一页面**看到并投票 |
| 猜对 reveal | `self.character` 对该玩家可见，人物卡从 `?` 变为真实人物 |
| 猜错重试 | 两人都判错 → `verdict=incorrect` → 可再次点「猜测！」；**历史错误答案**记入 `guess_history` 并展示 |
| 等待评判 | `verdict=pending` 时不可再提交；底部左钮「评审中～」、右钮「放弃。。」均 disabled |
| 猜对后继续 | 仍可发提示；底部左钮「猜对了！」绿色 disabled，放弃钮隐藏 |
| 放弃后 | 仍可发提示；底部右钮「认输了。。」红色 disabled，猜测钮隐藏 |
| **人物重选** | 玩家 A 为 B 点「重选」→ 玩家 C 确认 → B 换新角色；删 B 当轮 Guess；同时仅 1 个 pending 申请 |

### 6.4 轮次结束条件

**仅当以下全部满足**，才从活跃期进入 `rating`：

1. 三名玩家均有 guess 记录
2. 每人状态为 `correct` 或 `skipped`（`incorrect` 不算终态，需重猜或 skip）
3. 无 `pending` 猜测还在等待投票

评价 → 结算（对抗计分）→ `complete` → **重新随机分配人物** → 下一轮或终局。

### 6.4.1 每轮人物重新分配

- 每轮 `complete` 结算后、进入下一轮前：`CharacterAssigner.assign(match)` **覆盖** `match_player_assignments`
- 新轮自己人物重新隐藏（`self.character=null`），需再次猜对或 skip 才 reveal
- 轮末 `_snapshot_round_assignments()` 将当轮三人人物写入 `rounds.assignments_snapshot`（供终局复盘）

### 6.5 提示显示规则（个性化）

玩家 2 发提示（描述 1 和 3 的共同点）：

| 观看者 | UI 区域 | 文案 |
|---|---|---|
| 2（作者） | 发送的提示 | 您发出的提示：{内容} |
| 1 | 收到的提示 | 您的人物和 {3昵称} 的人物 {3人物名} 的联系为：{内容} |
| 3 | 收到的提示 | 您的人物和 {1昵称} 的人物 {1人物名} 的联系为：{内容} |

- 后端：`TraitGuessEngine._format_hints_for_viewer()`（含 `is_withdrawn`）
- 前端：`GameBoard.formatHintText()` + `HintText` 组件（撤回时 `line-through`），兜底用 `state.others` 补全昵称/人物名
- **收到的提示**：按作者分左右两卡，同一玩家多条提示合并在一张卡内；**无高度截断**，全部展开
- i18n：`hintOwn`、`hintForYou`、`hintsSent`、`hintsFromOthers`、`withdrawHint`

### 6.5.1 评价阶段（rating）UI

`GET /matches/current` 在 `phase=rating` 时额外返回：

| 字段 | 说明 |
|---|---|
| `round_result` | 本轮猜测结果、合作是否得分、对战累计分与**待结算猜对分** |
| `hint_rating_groups` | 按作者聚合的**未撤回**提示 + 当前玩家是否已评 |

- 合作：显示本轮是否「合作成功」
- 对战：显示截至上轮累计分 + 绿色 `+n`（仅猜对得分，**不含**尚未完成的提示评价分）
- 猜测区展示 `guess_history`（猜错记录 + 评判者昵称文案）
- **你发出的提示**：rating 页单独卡片展示本人全部提示（含已撤回，删除线样式）；**不可自评**

### 6.5.2 提示撤回（软删除）

- 活跃期内作者可 `DELETE /hints/{id}` 撤回**自己的**提示
- 数据库保留记录，`hints.is_withdrawn=true`；API 返回 `is_withdrawn: true`
- UI：提示不消失，正文显示**删除线** + 半透明；已撤回项隐藏「撤回」按钮
- **rating 阶段**：已撤回提示仍可在「你发出的提示」/历史列表中显示（删除线）；**不参与** `hint_rating_groups`、不计入 `_check_rating_complete` 的 author 列表、不可被点赞点踩
- 重复撤回 → `409 ALREADY_WITHDRAWN`；非作者 → `403 NOT_AUTHOR`

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
- 完成条件：每个**发过未撤回提示**的玩家都收到 `玩家数-1` 条评价（仅 `is_withdrawn=false` 的 author 计入）

### 6.7 隐私与 reveal 规则

| 字段 | 规则 |
|---|---|
| `others[].character` | 对局开始后可见 |
| `self.character` | 默认 `null`；**本轮猜对或 skip 后**返回 assignment 人物 |
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
| `_format_hints_for_viewer()` | 按观看者生成提示 payload（含 `is_withdrawn`） |
| `_snapshot_round_assignments()` | 轮末保存当轮人物快照 |
| `_build_hint_rating_groups()` | rating 阶段按作者聚合**未撤回**提示 |
| `delete_hint()` | 软撤回提示（`is_withdrawn=true`） |
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
- `hints`：author, content, **is_withdrawn**（软撤回标记，默认 false）；多条/人/轮
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
- `rooms.0009_matchplayerassignment_display_image_url`：分配随机展示图
- `rooms.0010_hint_is_withdrawn`：`hints.is_withdrawn`
- `catalog.0002_character_image_url_optional`：`characters.image_url` 可空
- `catalog.0003_character_image`：`character_images` 多图表

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
| DELETE | `/hints/{id}` | ✓ | - | **撤回**自己的提示（软删除，`is_withdrawn=true`） |
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
| POST | `/admin/characters/{id}/images/from-url` | `{url}` | 从 http(s) 外链下载并追加图片（拖拽网页图 CORS 兜底） |
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
      "is_withdrawn": false,
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

`hint_rating_groups` / `round_result` 仅在 `phase=rating` 时有值。猜对或 skip 后 `self.character` 变为人物对象。

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

1. 三人人物卡（自己未 reveal 时 `?`，**猜对或 skip 后** reveal）；他人卡片下可 **重选**（见 §6.3）
2. **发送的提示**（仅 `is_own`；每条可 **撤回**，撤回后保留 + 删除线）
3. **收到的提示**：左右两卡，各对应一名其他玩家，内含其全部提示（含已撤回删除线）；**全量展开无滚动截断**
4. **评判区**（他人 `pending` 猜测 + 投票）
5. **发提示**卡片：输入框 + 发送（与猜测分离，见 §10.1.1）
6. **猜测历史**卡片（§10.1.2）：有内容时才显示（等待评判 / 猜错 / 有 `guess_history`）
7. **底部固定猜测操作栏**（§10.1.1）：`fixed` 贴底，不随滚动

**评价阶段**（`phase=rating`）：

1. **本轮结果**卡片：每人猜对/猜错/放弃、合作得分或对战分数（含 `+n` 待结算猜对分）
2. **你发出的提示**：本人全部提示（只读，含已撤回删除线）
3. **评价提示**：按作者一张卡，其**未撤回**提示 + 单次赞/踩

### 10.1.1 底部固定猜测操作栏与 Modal

组件：`GameBoard.tsx` + `components/ui.tsx` `Modal`

- **布局**：`fixed bottom-0 left-0 right-0 z-40`；半透明 `bg-ocean/95` + 顶部分割线；内层 `max-w-5xl` 与页面同宽
- **主内容**：操作栏显示时根容器 `pb-28`，避免列表被挡

| 玩家 guess 状态 | 左钮（猜测侧） | 右钮（放弃侧） |
|---|---|---|
| 可提交（无 guess / `incorrect`） | 「猜测！」黄色 `primary`，可点 → **猜测 Modal** | 「放弃。。」**白字**深色底，可点 → **确认 Modal** |
| `pending` | 「评审中～」，disabled | 「放弃。。」白字，disabled |
| `correct` | 「猜对了！」绿色宽钮，disabled；**放弃钮隐藏** | — |
| `skipped` | —（**猜测钮隐藏**） | 「认输了。。」红色宽钮，disabled |

- 猜测 Modal 标题：`actionModeGuess`（「猜测身份」）；Enter 可提交
- 放弃确认 Modal：`confirmSkipGuess`；「取消」为**白字**；确认调用 `POST /rounds/current/guesses` `{skip:true}`

### 10.1.2 猜测历史卡片

- 标题 i18n：`guessHistorySection`（「猜测历史」）
- **显示条件**（`showGuessHistoryCard`）：`myGuess` 存在且满足其一：
  - `verdict=pending`（展示等待评判文案 + 当前猜测文本）
  - `verdict=incorrect`（评判者昵称提示 + `excludedWrongGuesses`）
  - `guess_history` 非空（展示 `GuessHistoryList`）
- **不显示**：尚未猜测；首次猜对且无历史（终态由底部绿色按钮表达，卡片内**不再**重复「猜对了！」）

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

- 角色分配隐私 / 猜对后 reveal / **skip 后 reveal**
- 文本猜测 + 评判 + 猜错重试
- 猜对后仍可发提示
- **提示软撤回**（`delete_hint` / `is_withdrawn`）
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
| 网页/微信拖图提示「请拖放图片文件」 | `dataTransfer` 异步后清空或仅有 URL 无文件 | 已修：同步捕获 + `items` + 服务端 `from-url` |
| 拖拽上传后自动弹出图库 | 上传成功调用了 `setGalleryCharacterId` | 已修：仅点击肖像打开弹窗 |
| 放弃猜测人物不显示 | 仅 `correct` 返回 `self.character` | 已修 v12：skip 同样 reveal |
| 误把猜测答案发到提示框 | 提示/猜测输入框同屏易混淆 | 已修 v12.1：发提示独立卡片；猜测走底部 Modal |
| 撤回提示后从列表消失 | 物理 `DELETE` 记录 | 已修 v12：软撤回 + 删除线 UI |
| rating 页看不到自己的提示 | `hint_rating_groups` 排除 `is_own` | 已修 v12：单独「你发出的提示」卡片 |
| 多条提示需滚动才能看全 | `max-h-48 overflow-y-auto` | 已修 v12：全量展开 |
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
- 猜对或 skip 后 `self.character` 对该玩家 reveal
- **每轮结束重新分配人物**，并快照至 `assignments_snapshot`
- 对抗分数只在 `settlement` 结算
- 裁判 2 人一致才判对
- 猜测为**文本** + **人工评判**，非 ID 选择
- 提示评价按**作者**计票与计分，非按单条 hint；**已撤回提示不参与评价**
- 提示撤回为**软删除**（`is_withdrawn`），UI 显示删除线而非移除
- 活跃期**发提示与猜测分离**：提示独立卡片；猜测为**底部 fixed 操作栏** + Modal，避免误提交
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
| 管理员多图 UI | 叠加卡片 + 角标 + 点击弹窗管理 | `AdminCharacterImageStack`、`AdminCharacterGalleryModal` |
| 拖拽上传增强 | 同步捕获 DataTransfer、`items` API、外链服务端导入 | `AdminCharacterImageFromUrlView` |
| 上传不自动弹窗 | 拖放/选择上传成功不打开图库 Modal | 仅点击肖像打开 |
| 游戏 UX v12 | skip reveal、软撤回、rating 自己提示、提示全量展示 | commit `b934b46`；`rooms.0010` migrate |
| 游戏 UX v12.1 | 提示/猜测分离、底部按钮 + Modal、按钮终态样式 | commit `a1c946e` |
| 游戏 UX v12.2 | 猜测历史卡片、fixed 底栏、放弃钮白字 | 见 §10.1.1–§10.1.2 |

# Railway 部署指南

单服务部署：Nginx 提供前端静态页，Daphne 处理 API + WebSocket。一个域名即可跨设备访问。

## 架构

```text
https://你的项目.up.railway.app
  ├── /          → React 前端
  ├── /api/v1/   → Django REST API
  ├── /ws/       → WebSocket（房间实时同步）
  └── /media/    → 管理员上传的图片
```

数据持久化：`/app/data` 卷（SQLite + 上传图片）。

---

## 第一次部署（约 10 分钟）

### 1. 准备 Railway 账号

1. 打开 [railway.app](https://railway.app) 注册
2. 安装 CLI（可选，用网页也行）：

```bash
brew install railway
railway login
```

### 2. 把代码推到 GitHub

Railway 从 Git 仓库部署最方便：

```bash
cd "OP- character"
git init   # 若尚未初始化
git add .
git commit -m "Add Railway deployment"
# 在 GitHub 新建仓库后：
git remote add origin https://github.com/你的用户名/op-character.git
git push -u origin main
```

### 3. 在 Railway 创建项目

**网页操作：**

1. Railway Dashboard → **New Project** → **Deploy from GitHub repo**
2. 选择你的仓库
3. Railway 会自动检测根目录 `Dockerfile` 和 `railway.toml`

**CLI 操作：**

```bash
cd "OP- character"
railway init
railway up
```

### 4. 配置环境变量

在 Railway 项目 → 你的服务 → **Variables** 添加：

| 变量 | 值 | 说明 |
|------|-----|------|
| `DJANGO_SECRET_KEY` | 随机长字符串 | 必填，可用 `python -c "import secrets; print(secrets.token_urlsafe(50))"` 生成 |
| `ADMIN_API_KEY` | 你的管理密码 | 管理员页面登录用 |
| `DJANGO_DEBUG` | `false` | 生产环境 |
| `DJANGO_ALLOWED_HOSTS` | `*` | 或留空（会自动读 Railway 域名） |
| `USE_SQLITE` | `true` | 小流量够用 |
| `USE_INMEMORY_CHANNEL` | `true` | 单实例 WebSocket |
| `DATA_DIR` | `/app/data` | 默认值，可不改 |

`PORT`、`RAILWAY_PUBLIC_DOMAIN` 由 Railway 自动注入，不用手填。

### 5. 挂载持久化卷（重要）

否则重启后数据库和上传图片会丢失。

1. 服务 → **Settings** → **Volumes**
2. **Add Volume**
3. Mount Path 填：`/app/data`
4. 保存并重新部署

### 6. 生成公网域名

1. 服务 → **Settings** → **Networking** → **Generate Domain**
2. 得到类似：`op-character-production.up.railway.app`
3. 用手机/朋友设备打开该链接测试

### 7. 健康检查

部署成功后访问：

```text
https://你的域名.up.railway.app/api/v1/game-modes
```

应返回 JSON 游戏模式列表。

---

## 日常更新

改完代码后：

```bash
git add .
git commit -m "your change"
git push
```

Railway 会自动重新构建部署（若已连 GitHub）。

或用 CLI：

```bash
railway up
```

---

## 本地验证 Docker 镜像（可选）

```bash
cd "OP- character"
docker build -t op-character .
docker run --rm -p 8080:8080 \
  -e DJANGO_SECRET_KEY=local-test-key \
  -e ADMIN_API_KEY=dev-admin-key \
  -e PORT=8080 \
  -v op-data:/app/data \
  op-character
```

浏览器打开 http://localhost:8080

---

## 常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| 502 / 部署失败 | 构建或启动报错 | 看 Railway **Deployments → Logs** |
| API 返回 HTML | 服务未就绪或路径错误 | 确认 `/api/v1/game-modes` 可访问 |
| WebSocket 断开 | 代理未升级 | 已配置 nginx WS 代理；单实例需 `USE_INMEMORY_CHANNEL=true` |
| 重启后数据没了 | 未挂 Volume | 按上文第 5 步挂载 `/app/data` |
| 管理员上传图片丢失 | 同上 | 图片存在 `DATA_DIR/media` |
| 三人同浏览器测试 | 共享 localStorage | 用普通窗口 + 无痕 + 另一浏览器 |

---

## 费用参考

Railway 按用量计费（有试用额度）。≤10 用户、SQLite + 单实例，通常每月几美元以内。不用时可在 Dashboard **暂停服务** 省钱。

---

## 与本地开发的区别

| 项目 | 本地 | Railway |
|------|------|---------|
| 前端地址 | localhost:5173 | 同一域名 `/` |
| API | 127.0.0.1:8000 | 同域名 `/api/v1/` |
| 环境变量 | `backend/.env` | Railway Variables |
| 更新 | 保存 + 重启 daphne | `git push` 自动部署 |

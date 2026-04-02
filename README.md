# 德语沉浸式学习游戏

## 已实现功能
- 英文词展示 -> 输入德语 -> 判定
- 仅答对触发切香肠成功动画（1.2s）
- 答错立即显示正确答案与用户输入
- 德国城市探索模块：德国地图选城 -> 主题选择 -> AI 明信片阅读
- 学习单元系统（创建/切换/重命名/删除）
- JSON 词库上传（每次上传创建独立学习单元）
- AI 文本生成词库（`POST /api/units/generate` 后端代理）
- AI 城市明信片生成（`POST /api/postcards/generate`，文本走 OpenAI，图片优先走 Pexels）
- API 核心逻辑共享：本地开发走 Vite 中间件，线上部署走 Vercel Serverless Functions
- 本地持久化：设置、单词进度、会话历史
- 本地持久化：明信片收藏册、探索会话
- 德语输入辅助：Alt+A/O/U/S 与虚拟键盘 `ä ö ü ß`

## 启动
```bash
npm install
npm run dev
```

如需启用城市明信片 AI 生成功能，请先配置：

```bash
cp .env.example .env.local
```

然后编辑 `.env.local`：

```bash
OPENAI_API_KEY=your_key_here
OPENAI_TEXT_MODEL=gpt-4.1-mini
PEXELS_API_KEY=your_pexels_key_here
```

说明：
- `OPENAI_API_KEY` 必填
- `OPENAI_TEXT_MODEL` 可选，默认 `gpt-4.1-mini`
- `PEXELS_API_KEY` 可选；配置后会按“城市 + 主题”搜图，失败时回退到城市图
- 修改 `.env.local` 后需要重启 `npm run dev`

## Vercel 部署（自动更新）
### 1) 连接仓库
- 在 Vercel 导入仓库：`Xuehann/german-learner-game`
- 在 Project Settings -> Git 中把 Production Branch 设为 `main`

### 2) 构建设置
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`

项目已包含 [`vercel.json`](./vercel.json)：
- 保留 `/api/*` 给 Serverless Functions
- 其余路由回退到 `index.html`，支持 `/explore`、`/units` 刷新直开

### 3) 环境变量
在 Vercel 的 `Production` 与 `Preview` 两个环境都配置：
- `OPENAI_API_KEY`（必填）
- `OPENAI_TEXT_MODEL`（可选，默认 `gpt-4.1-mini`）
- `PEXELS_API_KEY`（可选）

### 4) 自动更新策略
- Push 到 `main`：自动触发 Production 部署
- 创建/更新 PR：自动生成 Preview 部署
- 合并 PR 到 `main`：自动发布新版本

### 5) 密钥安全
- 请将 API key 仅保存在本地 `.env.local` 和 Vercel 环境变量中，不要提交到 Git
- 如果 key 曾在本地/聊天记录暴露，请先在 OpenAI / Pexels 控制台轮换再部署

## 部署排查
- 刚改了环境变量但线上没生效：在 Vercel 里重新触发一次部署
- 路由刷新 404：确认项目根目录存在 `vercel.json` 且已重新部署
- `/api/*` 返回 405：检查请求方法是否为 `POST`
- `/api/postcards/generate` 返回 404：确认当前部署包含 `api/postcards/generate.ts`，并在 Vercel 的 Deployments 中使用最新 commit

## 测试
```bash
npm test
```

## 德国城市探索模块说明
- 首页新增“出门旅游”入口，可跳转到 `/explore`
- `v1` 预置 10 座德国城市，使用 voxel 风格地图选城
- 每座城市按主题维护本地事实数据，AI 生成时会把这些事实注入 prompt
- 明信片图片优先走 Pexels 搜图（`城市 + 主题` -> `仅城市` -> 本地静态图回退）
- 英文内容由同一次生成请求返回，可整篇切换
- 收藏册保存在浏览器本地存储

## JSON 词库格式
```json
[
  {
    "id": "custom-001",
    "english": "apple",
    "german": "der Apfel",
    "category": "food",
    "pastTense": "aß"
  }
]
```

说明：
- 必填字段：`id`, `english`, `german`, `category`
- 可选字段：`pastTense`
- 旧字段 `difficulty` 若存在会被自动忽略，不会报错

可直接参考 [`public/sample-words.json`](./public/sample-words.json)。

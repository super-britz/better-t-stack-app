# better-t-stack-app

基于 [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack) 模板创建的全栈 TypeScript 应用。这是一个 **monorepo**（单体仓库）项目，前端和后端代码放在同一个仓库里，通过共享包实现代码复用。

## 技术栈一览

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 16 + React 19 | 页面渲染和路由 |
| 样式 | TailwindCSS 4 + shadcn/ui | 写 CSS 类名来控制样式 |
| 后端框架 | Hono | 轻量级 HTTP 服务器 |
| 前后端通信 | tRPC | 前端直接调用后端函数，自动类型安全 |
| 数据库 | PostgreSQL + Drizzle ORM | 用 TypeScript 写数据库操作 |
| 包管理 | pnpm + Turborepo | 管理多个子项目 |
| 代码规范 | Biome | 代码格式化和检查 |
| 语言 | TypeScript + Zod | 类型安全 + 运行时校验 |

---

## 新手入门：从零启动项目

### 第一步：安装依赖

```bash
pnpm install
```

> 如果没装 pnpm，先运行 `npm install -g pnpm`

### 第二步：启动数据库（Docker）

项目使用 PostgreSQL 数据库，通过 Docker 一键启动：

```bash
pnpm run db:start
```

这会启动一个 PostgreSQL 容器，默认配置：
- 地址：`localhost:5432`
- 用户名：`postgres`
- 密码：`password`
- 数据库名：`better-t-stack-app`

> 需要先安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 第三步：初始化数据库表

```bash
pnpm run db:push
```

这会把 `packages/db/src/schema/` 里定义的表结构同步到数据库中。

### 第四步：启动开发服务器

```bash
pnpm run dev
```

启动后：
- 前端页面：http://localhost:3001
- 后端 API：http://localhost:3000

---

## 项目结构详解

```
better-t-stack-app/
├── apps/                        # 应用目录
│   ├── web/                     # 前端应用（Next.js）
│   └── server/                  # 后端应用（Hono）
├── packages/                    # 共享包目录
│   ├── api/                     # tRPC 路由定义（业务逻辑）
│   ├── db/                      # 数据库连接和表定义
│   ├── env/                     # 环境变量校验
│   ├── ui/                      # 共享 UI 组件（按钮、卡片等）
│   └── config/                  # 共享 TypeScript 配置
├── package.json                 # 根项目配置，定义全局脚本
├── pnpm-workspace.yaml          # pnpm 工作区配置
├── turbo.json                   # Turborepo 任务编排配置
├── biome.json                   # 代码格式化和 lint 规则
├── tsconfig.json                # 根 TypeScript 配置
└── bts.jsonc                    # Better-T-Stack 模板元信息
```

---

## 各文件/目录详细说明

### 根目录文件

| 文件 | 作用 |
|------|------|
| `package.json` | 项目总配置，定义了所有全局脚本命令（`dev`、`build`、`db:push` 等） |
| `pnpm-workspace.yaml` | 告诉 pnpm 哪些目录是子项目（`apps/*` 和 `packages/*`），并统一管理依赖版本 |
| `turbo.json` | Turborepo 配置，定义任务之间的依赖关系（比如 build 前要先 build 依赖的包） |
| `biome.json` | 代码风格检查配置（类似 ESLint + Prettier 的替代品） |
| `tsconfig.json` | 根 TypeScript 配置，继承自 `packages/config` |
| `bts.jsonc` | 记录项目创建时的选项，不需要修改 |
| `.gitignore` | Git 忽略文件列表（`node_modules`、构建产物等） |
| `pnpm-lock.yaml` | 依赖锁定文件，确保所有人安装的依赖版本一致，不要手动编辑 |

---

### `apps/server/` — 后端应用

后端使用 **Hono** 框架，通过 **tRPC** 提供 API。

| 文件 | 作用 |
|------|------|
| `src/index.ts` | **入口文件**。创建 Hono 应用，配置 CORS 跨域、日志中间件，挂载 tRPC 路由到 `/trpc/*` 路径。支持本地开发（Node.js）和 AWS Lambda 两种运行方式 |
| `.env` | 环境变量。`DATABASE_URL` 是数据库连接地址，`CORS_ORIGIN` 是允许的前端地址 |
| `package.json` | 后端的依赖和脚本。`dev` 用 tsx 热重载开发，`build` 用 tsdown 打包 |
| `tsconfig.json` | TypeScript 配置，继承自共享配置 |
| `tsdown.config.ts` | 打包工具 tsdown 的配置，把后端代码打包成单个文件用于部署 |

**数据流**：浏览器 → Hono 服务器（3000 端口）→ tRPC 路由 → Drizzle ORM → PostgreSQL 数据库

---

### `apps/web/` — 前端应用

前端使用 **Next.js**，通过 **tRPC 客户端**调用后端 API。

| 文件/目录 | 作用 |
|-----------|------|
| `src/app/layout.tsx` | **根布局**。设置字体、导入全局样式、用 Providers 包裹整个应用（提供主题切换、React Query 等功能） |
| `src/app/page.tsx` | **首页**。显示 ASCII 艺术标题，检测并显示 API 连接状态（绿色=已连接，红色=断开） |
| `src/app/github/page.tsx` | **GitHub 页面**。输入 GitHub Token 查询用户信息，支持增删改查操作 |
| `src/utils/trpc.ts` | **tRPC 客户端配置**。连接后端地址，配置错误提示（toast 弹窗） |
| `src/components/header.tsx` | **顶部导航栏**。包含首页和 GitHub 页面链接，以及主题切换按钮 |
| `src/components/providers.tsx` | **全局 Provider 组装**。把 ThemeProvider（主题）、QueryClientProvider（数据请求）、Toaster（通知弹窗）组合起来 |
| `src/components/mode-toggle.tsx` | **主题切换按钮**。浅色/深色/跟随系统 |
| `src/components/theme-provider.tsx` | next-themes 的简单封装 |
| `src/index.css` | 导入共享 UI 库的全局样式 |
| `.env` | 前端环境变量。`NEXT_PUBLIC_SERVER_URL` 指向后端地址 |
| `next.config.ts` | Next.js 配置，启用了类型安全路由和 React 编译器优化 |
| `components.json` | shadcn/ui 配置，指向共享 UI 库的组件和样式 |
| `postcss.config.mjs` | PostCSS 配置，启用 TailwindCSS 插件 |
| `tsconfig.json` | TypeScript 配置，设置了路径别名（`@/*` 指向 `src`） |
| `package.json` | 前端依赖和脚本 |

---

### `packages/api/` — API 路由层

定义所有的 API 接口（tRPC 路由），是前后端之间的"桥梁"。

| 文件 | 作用 |
|------|------|
| `src/index.ts` | 初始化 tRPC，导出 `router` 和 `publicProcedure`（公开接口定义器） |
| `src/context.ts` | 定义请求上下文（目前只有 `session: null`，预留给登录认证用） |
| `src/routers/index.ts` | **核心文件**。定义所有 API 路由：`healthCheck`（健康检查）、`listGithubProfiles`（列出所有 GitHub 用户）、`githubProfile`（新增）、`updateGithubProfile`（更新）、`deleteGithubProfile`（删除） |

**工作原理**：前端调用 `trpc.githubProfile.mutate({ token: "xxx" })`，tRPC 自动把请求发到后端，后端执行对应的函数，返回结果。全程有 TypeScript 类型提示。

---

### `packages/db/` — 数据库层

管理数据库连接、表结构定义和数据迁移。

| 文件 | 作用 |
|------|------|
| `src/index.ts` | 创建数据库连接实例，导出 `db` 对象供其他包使用 |
| `src/schema/index.ts` | 导出所有表定义 |
| `src/schema/github-profiles.ts` | 定义 `github_profiles` 表结构（id、login、name、头像、bio、公开仓库数、创建时间等字段） |
| `src/migrations/` | 数据库迁移文件，记录表结构变更历史 |
| `drizzle.config.ts` | Drizzle ORM 配置，指定数据库类型（PostgreSQL）、schema 位置、迁移文件位置 |
| `docker-compose.yml` | Docker 配置，一键启动 PostgreSQL 容器 |
| `package.json` | 数据库包的依赖和脚本 |

---

### `packages/env/` — 环境变量校验

确保程序启动时所有必需的环境变量都已正确设置。

| 文件 | 作用 |
|------|------|
| `src/server.ts` | 校验服务端环境变量：`DATABASE_URL`（数据库地址）、`CORS_ORIGIN`（跨域来源）、`NODE_ENV`（环境） |
| `src/web.ts` | 校验前端环境变量：`NEXT_PUBLIC_SERVER_URL`（API 地址） |

> 如果环境变量缺失或格式不对，程序启动时会直接报错，而不是运行到一半才崩。

---

### `packages/config/` — 共享 TypeScript 配置

| 文件 | 作用 |
|------|------|
| `tsconfig.base.json` | 基础 TypeScript 配置，所有子项目都继承它。启用严格模式、ESNext 目标等 |

---

### `packages/ui/` — 共享 UI 组件库

基于 shadcn/ui 的组件库，所有前端应用共享使用。

| 文件/目录 | 作用 |
|-----------|------|
| `src/components/button.tsx` | 按钮组件，支持多种样式变体和尺寸 |
| `src/components/card.tsx` | 卡片组件（Card、CardHeader、CardTitle 等） |
| `src/components/input.tsx` | 输入框组件 |
| `src/components/checkbox.tsx` | 复选框组件 |
| `src/components/dropdown-menu.tsx` | 下拉菜单组件 |
| `src/components/label.tsx` | 标签组件 |
| `src/components/skeleton.tsx` | 加载骨架屏组件 |
| `src/components/sonner.tsx` | Toast 通知组件封装 |
| `src/lib/utils.ts` | 工具函数。`cn()` 用于合并 CSS 类名 |
| `src/styles/globals.css` | 全局样式和设计令牌（颜色、圆角等），定义了浅色/深色主题变量 |
| `components.json` | shadcn/ui 的配置文件 |

**使用方式**：
```tsx
import { Button } from "@better-t-stack-app/ui/components/button";
import { Card } from "@better-t-stack-app/ui/components/card";
```

添加更多 shadcn 组件：
```bash
npx shadcn@latest add accordion dialog -c packages/ui
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | 同时启动前端和后端开发服务器 |
| `pnpm run dev:web` | 只启动前端 |
| `pnpm run dev:server` | 只启动后端 |
| `pnpm run build` | 构建所有应用 |
| `pnpm run check-types` | 检查 TypeScript 类型错误 |
| `pnpm run check` | 运行 Biome 格式化和 lint 检查 |
| `pnpm run db:start` | 启动 PostgreSQL Docker 容器 |
| `pnpm run db:stop` | 停止 PostgreSQL 容器 |
| `pnpm run db:push` | 把 schema 定义同步到数据库 |
| `pnpm run db:generate` | 生成数据库迁移文件 |
| `pnpm run db:migrate` | 执行数据库迁移 |
| `pnpm run db:studio` | 打开 Drizzle Studio（数据库可视化管理界面） |

---

## 环境变量配置

### `apps/server/.env`

```env
CORS_ORIGIN=http://localhost:3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/better-t-stack-app
```

### `apps/web/.env`

```env
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

---

## 项目功能

目前实现了一个 **GitHub Profile 管理工具**：

1. 在首页可以查看 API 连接状态
2. 在 GitHub 页面输入 GitHub Personal Access Token
3. 后端通过 Token 调用 GitHub API 获取用户信息
4. 用户信息保存到 PostgreSQL 数据库
5. 支持查看列表、更新和删除操作

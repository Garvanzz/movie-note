# Movie Note — 项目指南

## 项目概述

Movie Note 是一个电影/影片管理桌面应用，基于 **Tauri v2** 构建。
- **前端**: React 19 + TypeScript + Vite + TailwindCSS v4
- **后端**: Rust (Tauri v2) + SQLite
- **状态管理**: Zustand + TanStack React Query
- **路由**: React Router v7

## 快速启动

### 1. 浏览器开发模式（无需 Rust 后端）

```bash
npm run dev
# 访问 http://localhost:1420
# 前端使用 mock API，可以测试所有 UI 功能
```

### 2. Tauri 桌面应用模式（需要完整构建环境）

```bash
# 前提：安装 Rust 和 Windows 构建工具
npm run tauri dev
```

## 前端脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 (端口 1420) |
| `npm run build` | TypeScript 检查 + Vite 构建到 dist/ |
| `npm run preview` | 预览构建产物 |
| `npm run tauri` | Tauri CLI（需要 src-tauri 后端） |

## 项目结构

```
src/
├── main.tsx              # React 入口
├── App.tsx               # 路由配置
├── index.css             # TailwindCSS + 主题变量
├── components/
│   ├── layout/           # AppLayout, Sidebar
│   ├── movie/            # MovieCard, MovieGrid, MovieFilterSidebar
│   ├── scraper/          # ScraperDialog (数据抓取)
│   └── ui/               # 通用 UI 组件 (button, input, badge...)
├── pages/                # 页面组件
│   ├── MovieListPage.tsx
│   ├── MovieDetailPage.tsx
│   ├── ActorListPage.tsx
│   ├── ActorDetailPage.tsx
│   ├── TagManagementPage.tsx
│   └── GenreManagementPage.tsx
├── services/             # API 服务层
│   ├── invoke.ts         # Tauri invoke 封装（浏览器模式自动使用 mock）
│   ├── movieService.ts
│   ├── actorService.ts
│   ├── tagService.ts
│   ├── fileService.ts
│   ├── scraperService.ts
│   └── dataService.ts
├── stores/               # Zustand 状态管理
├── hooks/                # 自定义 Hooks
├── types/                # TypeScript 类型定义
└── lib/                  # 工具函数
```

## src-tauri 后端

Rust 后端位于 `src-tauri/`，使用以下技术栈:
- Tauri v2
- SQLite (rusqlite, bundled 模式)
- Serde (JSON 序列化)
- 数据抓取框架 (reqwest + scraper)

### 构建前提

使用 MSVC 工具链 (推荐):
1. 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) 或 Visual Studio 2022 Community
2. 安装时勾选「使用 C++ 的桌面开发」工作负载
3. 确保安装了 Windows SDK

或使用 GNU 工具链:
1. 安装 [MSYS2](https://www.msys2.org/) 或 [MinGW-w64](https://www.mingw-w64.org/)
2. 确保 `gcc`、`as`、`dlltool` 在 PATH 中

```bash
# 进入后端目录
cd src-tauri

# 检查编译
cargo check

# 构建
cargo build

# 运行 Tauri 开发模式
cd .. && npm run tauri dev
```

## 技术要点

- 暗色主题，使用 oklch 色彩空间
- 浏览器模式下所有 Tauri 命令返回 mock 数据（空数组/空对象）
- `src/services/invoke.ts` 在浏览器中自动切换到 mock 模式
- 数据库文件存储在系统 app data 目录
- TailwindCSS v4 使用 `@theme inline` 语法定义设计令牌

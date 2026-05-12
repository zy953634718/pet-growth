# CLAUDE.md — Agent 入口地图

> **这是地图，不是手册。** 遇到具体问题，前往下方对应文档深入查阅。

## 快速命令

```bash
npm start          # Expo dev server
npm run android    # Android 运行
npm run web        # 浏览器运行
npx expo prebuild  # 重新生成 native 目录（安装 native 依赖后）
```

## 技术栈

Expo SDK 54 · React Native 0.81 · Expo Router 6 · Zustand 5 · expo-sqlite

## 关键约束（Critical Rules）

1. **Store 是唯一数据入口** — UI 层只能通过 Zustand store 读写数据，禁止在组件中直接调用 DB 函数（`src/db/`）
2. **路由按角色隔离** — `child-tabs` 屏幕不能导入 `parent-tabs` 的任何内容，反之亦然
3. **路径别名强制** — 使用 `@/*` 而非相对路径跨目录引用（`@/stores/`, `@/types`, `@/constants/`）
4. **类型从 `@/types` 导入** — 所有 DB 实体接口在 `src/types/index.ts`，禁止在业务文件中重复定义

## 目录索引

| 目录 | 用途 | 深入文档 |
|------|------|----------|
| `app/` | 路由屏幕（file-based routing） | [架构](docs/architecture.md#routing) |
| `src/stores/` | 6 个 Zustand store | [架构](docs/architecture.md#stores) |
| `src/db/` | SQLite 初始化 + 18 张表 | [架构](docs/architecture.md#database) |
| `src/types/index.ts` | 全局类型 + 实体接口 | — |
| `src/constants/` | evolution.ts · presets.ts | [架构](docs/architecture.md#pet-evolution) |
| `src/components/` | 5 个共享组件 | — |
| `src/theme/` | Design tokens · 响应式工具 | — |
| `docs/` | 详细文档 | 见下方 |

## 文档地图

- [docs/architecture.md](docs/architecture.md) — 路由、Store、DB、宠物进化详细说明
- [docs/principles.md](docs/principles.md) — 代码黄金原则与 Agent 编码规范
- [docs/quality.md](docs/quality.md) — 各模块质量评级与技术债登记
- [docs/decisions/](docs/decisions/) — 架构决策记录（ADR）

## 无测试 / 无 Linter 提示

当前仅有 TypeScript 类型检查。提交前请运行：
```bash
npx tsc --noEmit
```

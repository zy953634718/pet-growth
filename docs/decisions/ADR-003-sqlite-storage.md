# ADR-003：单文件 SQLite 作为主存储

_状态：已接受 · 日期：项目初始化_

## 背景

移动端 App 需要持久化存储，包括家庭数据、宠物状态、任务记录、AI 对话历史等结构化数据。

## 决策

使用 `expo-sqlite` 管理单个 SQLite 文件（`petgrowth.db`），18 张表，无 ORM，手写 SQL。

## 理由

- SQLite 是 Expo 生态中对 React Native 支持最完善的关系型存储
- 单文件便于整体导出/导入（备份功能 `exportDatabase()`）
- 手写 SQL 避免引入 ORM 框架带来的抽象复杂度和 bundle 大小
- WAL 模式开启并发读支持

## 权衡

- **已知债务**：无 schema 版本管理（`PRAGMA user_version`），schema 变更需要手动处理或清空重建
- **已知债务**：Web 平台的 expo-sqlite 行为与 native 有差异，`database.web.ts` 提供了 no-op fallback

## 影响

- `initDatabase()` 必须在 App 启动时最先调用（在 `useFamilyStore` hydration 之前）
- 所有 DB 操作通过 store action 触发，保证统一的错误处理和状态同步

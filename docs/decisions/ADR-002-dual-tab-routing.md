# ADR-002：Expo Router 文件路由 + 双 Tab 布局

_状态：已接受 · 日期：项目初始化_

## 背景

需要在同一个 App 中支持两种截然不同的用户视图：孩子视角（简洁、游戏化）和家长视角（管理功能）。

## 决策

使用 Expo Router 6 的文件路由系统，通过 `(child-tabs)` 和 `(parent-tabs)` 两个分组实现完全隔离的 Tab 布局。

## 理由

- Expo Router 的 file-based routing 让路由结构即为目录结构，Agent 可以直接从文件树理解导航逻辑
- 两个分组完全独立，物理上隔离了两个角色的代码
- `ParentLock` modal 作为切换守卫，确保角色切换需要密码验证

## 权衡

- 共用的屏幕逻辑（如商城）需要在两个分组下各维护一个文件，存在少量重复
- 角色切换不是真正的用户切换（无多账户），而是同一个 App 的视图切换

## 影响

- `useFamilyStore.currentRole` 决定渲染哪个 Tab 布局，为单一权威来源
- 禁止在 `(child-tabs)` 中导入 `(parent-tabs)` 的任何内容（或反之）

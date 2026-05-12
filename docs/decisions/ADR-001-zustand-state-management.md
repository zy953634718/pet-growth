# ADR-001：使用 Zustand 作为唯一状态管理层

_状态：已接受 · 日期：项目初始化_

## 背景

需要在 React Native（Expo）中管理复杂的跨屏幕状态，包括宠物状态、任务系统、购物、AI 对话等 6 个独立域。

## 决策

使用 Zustand 5 作为唯一状态管理层，每个业务域一个独立 store，所有 store 直接读写 SQLite（通过 `expo-sqlite`）。

## 理由

- Zustand 5 比 Redux 轻量，API 简洁，适合 React Native
- store 直接绑定 DB 而非维护内存缓存，避免内存与持久化状态不一致
- 按域分 store（family/pet/task/shop/behavior/ai）使每个领域逻辑内聚

## 权衡

- **缺点**：每个 store 都要手写 SQL，没有 ORM 保护，schema 变更需要同步修改 store 和 DB
- **缺点**：跨 store 数据依赖（如 pet store 需要 child ID from family store）通过 `getState()` 跨 store 调用，需要注意调用顺序

## 影响

- `useFamilyStore` 是会话身份源头，其他 store 的数据加载依赖它先初始化
- UI 层通过 store hook 获取数据，禁止直接操作 DB

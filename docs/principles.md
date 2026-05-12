# 黄金原则（Golden Principles）

_版本：1.0 · 创建：2026-05-12_

这些原则定义了本项目的不可协商约束，优先于局部最优解。

---

## P1 — Store 是唯一数据网关

**规则**：所有对 SQLite 的读写必须通过 Zustand store 的 action 函数，组件层禁止直接 import `src/db/`。

**原因**：DB 函数调用散落在组件中会导致状态与 DB 不同步，且无法追踪数据流向。

**如何判断违规**：在 `app/` 或 `src/components/` 下看到 `import { ... } from '@/db/'` 即违规。

---

## P2 — 角色路由严格隔离

**规则**：`(child-tabs)` 下的屏幕不能引用 `(parent-tabs)` 的内容，反之亦然。

**原因**：两个角色的权限模型不同，交叉引用会导致权限绕过风险（父母功能在孩子视图中误触）。

**允许的共用路径**：`src/stores/`、`src/components/`、`src/types/`、`src/constants/`、`src/theme/`。

---

## P3 — 类型集中在 `src/types/index.ts`

**规则**：DB 实体接口（`Family`、`Pet`、`Task` 等）和枚举类型只在 `src/types/index.ts` 定义，禁止在业务文件中重复定义。

**原因**：防止类型漂移——多处定义同一概念后，一旦 DB schema 修改，仅更新一处会导致静默类型错误。

---

## P4 — 路径别名强制

**规则**：跨目录引用使用 `@/*`（映射到 `./src/*`），禁止使用 `../../` 相对路径跨越 2 层以上目录。

**允许**：同目录内的 `./xxx` 引用。

**原因**：相对路径在文件移动时静默失效，`@/` 别名由 tsconfig 保证。

---

## P5 — 宠物状态只由 `usePetStore` 修改

**规则**：宠物的 mood、health、hunger、clean 等属性只能通过 `usePetStore` 的 action（feed/bathe/play/rest/heal/pet）修改，禁止其他 store 或组件直接写入宠物表。

**原因**：属性衰减计算（`calculateDecay`）和进化检查（`addExp`）必须集中触发，分散写入会破坏游戏平衡。

---

## P6 — 宠物图片必须走 `getPetImageSource()`

**规则**：引用宠物图片时调用 `getPetImageSource(speciesId, stage)` 而非手写 `require()`。

**原因**：Metro 的静态 `require()` 不支持动态字符串，`getPetImageSource()` 封装了完整的 fallback 与 stage 边界检查。

---

## P7 — 避免在 Effect 中调用 Store Action

**规则**：不要在 `useEffect` 中调用 store 的写 action，除非有明确的用户事件或生命周期触发点（如屏幕初次 mount 的数据加载）。

**原因**：Effect → Action → 状态变化 → 重渲染 → 触发 Effect，容易形成死循环。数据加载（`loadXxx`）是例外，但需要加空依赖数组或幂等守卫。

---

## P8 — Web 平台是次要目标

**规则**：Native（iOS/Android）是主要目标。Web 功能通过 `database.web.ts` fallback 保持基本可用，但不得为 Web 兼容性破坏 Native 架构。

**原因**：`expo-sqlite` 等关键包的 web 支持存在功能差异，过度适配 web 会引入 native 侧的复杂度。

---

## 机械强制清单（可编码为 Linter）

| 原则 | Linter 规则 | 状态 |
|------|------------|------|
| P1 — Store 网关 | 禁止 `app/` 或 `src/components/` import `@/db/` | 待配置 |
| P2 — 角色隔离 | 禁止 `(child-tabs)` import `(parent-tabs)` 路径 | 待配置 |
| P4 — 路径别名 | 禁止 `../../` 超 2 层相对路径 | 待配置 |
| P6 — 宠物图片 | 禁止 `require('../../assets/images/pets/')` 出现在 components | 待配置 |

# 架构文档

_最后验证：2026-05-12，对应代码状态 commit `999b9f2`_

## 路由（Routing） {#routing}

**入口**：`app/_layout.tsx` → `<Stack>` 根导航

```
app/
├── index.tsx          # 启动检测：hydration → Welcome | RoleSelect
├── Welcome.tsx        # 首次引导
├── SetupFamily.tsx    # 家庭创建
├── SetupPet.tsx       # 宠物创建
├── RoleSelect.tsx     # 角色选择（child / parent）
├── ParentLock.tsx     # 密码验证 modal（切换到 parent 角色）
├── ImportBackup.tsx   # 导入备份
├── (child-tabs)/      # 孩子 Tab 布局
│   ├── index.tsx      # 宠物主页
│   ├── tasks.tsx      # 任务列表
│   ├── shop.tsx       # 商城
│   ├── chat.tsx       # AI 对话
│   └── profile.tsx    # 个人主页
└── (parent-tabs)/     # 家长 Tab 布局
    ├── index.tsx      # 家长总览
    ├── tasks.tsx      # 任务管理
    ├── behavior.tsx   # 行为记录
    ├── shop.tsx       # 商城管理
    ├── stats.tsx      # 统计
    └── settings.tsx   # 设置
```

**角色隔离规则**：child-tabs 与 parent-tabs 互不引用对方的屏幕或组件。

---

## Zustand Stores {#stores}

所有 store 位于 `src/stores/`，命名规则：`use{Domain}Store`。

| Store | 文件 | 持久化 | 核心职责 |
|-------|------|--------|----------|
| `useFamilyStore` | `useFamilyStore.ts` | SQLite（native）/ localStorage（web） | 会话身份：currentFamily, currentRole, currentChild |
| `usePetStore` | `usePetStore.ts` | 全 DB 驱动 | 宠物状态、照顾动作、属性衰减、进化 |
| `useTaskStore` | `useTaskStore.ts` | 全 DB 驱动 | 任务 CRUD、提交流、连击追踪、每日生成 |
| `useShopStore` | `useShopStore.ts` | 全 DB 驱动 | 商品、购买（6位兑换码）、装备 |
| `useBehaviorStore` | `useBehaviorStore.ts` | 全 DB 驱动 | 行为规则/分类、积分记录、审批流 |
| `useAIStore` | `useAIStore.ts` | 全 DB 驱动 | AI 对话（Qwen/GLM/OpenAI）、内容过滤、离线降级 |

**Store 约束**：UI 层只能通过 store 的 action 函数修改数据，禁止直接调用 `src/db/` 的 SQL 函数。

---

## 数据库（Database） {#database}

**文件**：`petgrowth.db`（单文件 SQLite）  
**初始化**：`src/db/database.native.ts` → `initDatabase()` → WAL + 外键 → 建表/索引  
**重导出**：`src/db/database.ts`（web fallback 为次要平台）

### 18 张核心表

| 表名 | 实体类型 |
|------|----------|
| `family` | `Family` |
| `children` | `Child` |
| `pets` | `Pet` |
| `evolution_history` | `EvolutionHistory` |
| `behavior_categories` | `BehaviorCategory` |
| `behavior_rules` | `BehaviorRule` |
| `point_records` | `PointRecord` |
| `task_categories` | `TaskCategory` |
| `task_templates` | `TaskTemplate` |
| `tasks` | `Task` |
| `task_completions` | `TaskCompletion` |
| `streaks` | `Streak` |
| `shop_items` | `ShopItem` |
| `purchases` | `Purchase` |
| `pet_equipment` | `PetEquipment` |
| `ai_config` | `AIConfig` |
| `ai_safety_config` | `AISafetyConfig` |
| `chat_messages` | `ChatMessage` |

所有实体接口定义在 `src/types/index.ts`。

### 关键 DB 工具函数

- `initDatabase()` — 初始化（WAL + 外键 + 建表）
- `importPresets(familyId)` — 为新家庭播种预设数据
- `wipeAllUserData()` — 清空所有行（保留 schema）
- `exportDatabase()` / `importDatabase()` — JSON 备份，支持 AES 加密（CryptoJS）

---

## 宠物进化（Pet Evolution） {#pet-evolution}

**定义文件**：`src/constants/evolution.ts`

### 进化阶段

| Stage | 名称 | 等级区间 | Emoji |
|-------|------|----------|-------|
| 1 | 神秘蛋 | Lv.1 | 🥚 |
| 2 | 小萌崽 | Lv.2-3 | 🐣 |
| 3 | 活力少年 | Lv.4-5 | 🦊 |
| 4 | 威风伙伴 | Lv.6-7 | 🦁 |
| 5 | 传说精灵 | Lv.8 | 🐉 |

### 升级积分门槛

| 等级 | 所需累计积分 |
|------|------------|
| Lv.1→2 | 100 |
| Lv.2→3 | 250 |
| Lv.3→4 | 450 |
| Lv.4→5 | 700 |
| Lv.5→6 | 1000 |
| Lv.6→7 | 1400 |
| Lv.7→8 | 2000 |

进化检查在每次 exp 获取后触发（`addExp()`），溢出时自动触发 `justEvolved` flag。

### 宠物种类（6种）

`dragon`, `cat`, `dog`, `rabbit`, `panda`, `fox`  
图片路径：`assets/images/pets/{speciesId}_stage{1-5}.png`

---

## 货币系统

双货币：**积分（points）** + **星星（stars）**

- 积分来源：完成任务、行为记录
- 星星来源：连击里程碑（3/7/14/30天）奖励
- 照顾宠物（喂食/洗澡/玩耍/休息）会扣除积分或星星

---

## 共享组件

`src/components/`：5 个组件

| 组件 | 用途 |
|------|------|
| `PetAvatar.tsx` | 宠物头像（含进化阶段图片） |
| `PetStatusBars.tsx` | 宠物属性状态条 |
| `PointBadge.tsx` | 积分/星星徽章 |
| `TaskCard.tsx` | 任务卡片 |
| `Modal.tsx` | 通用 Modal 封装 |

---

## 主题系统

`src/theme/`：

- `tokens.ts` — 颜色、字号、间距基础值
- `components.ts` — 组件级样式预设
- `responsive.ts` — 屏幕适配工具
- `index.ts` — 统一导出

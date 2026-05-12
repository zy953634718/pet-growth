# 质量评级（Quality Grades）

_最后更新：2026-05-12_

评级标准：A（优秀）· B（良好，有小问题）· C（需要关注）· D（技术债）

---

## 模块评级

| 模块 | 评级 | 说明 |
|------|------|------|
| `src/types/index.ts` | A | 完整，类型集中，无重复定义 |
| `src/constants/evolution.ts` | A | 逻辑清晰，有测试性函数（可单元测试） |
| `src/theme/` | B | tokens 完整，但 responsive 工具使用率待考察 |
| `src/stores/useFamilyStore.ts` | B | 持久化机制可靠，但 plaintext 密码是安全债 |
| `src/stores/usePetStore.ts` | B | 逻辑复杂，属性衰减计算未经测试覆盖 |
| `src/stores/useTaskStore.ts` | B | 功能完备，连击逻辑边界条件待验证 |
| `src/stores/useShopStore.ts` | C | 兑换码生成逻辑未做碰撞检测 |
| `src/stores/useAIStore.ts` | C | API key 明文存储在 DB，需加密存储 |
| `src/db/database.native.ts` | B | schema 完整，但无迁移版本管理（schema 变更需手动处理） |
| `app/(child-tabs)/` | C | 多数屏幕缺少加载/错误状态处理 |
| `app/(parent-tabs)/` | C | 同上 |
| `src/components/` | B | 5 个组件职责清晰，但缺少 prop 类型文档 |

---

## 已知技术债登记

| ID | 描述 | 位置 | 优先级 |
|----|------|------|--------|
| TD-001 | 家长密码明文存储 | `family` 表 `parent_password` | 高 |
| TD-002 | AI API Key 存储未加密 | `useFamilyStore` → `ai_config` 表 | 高 |
| TD-003 | DB schema 无版本迁移 | `database.native.ts` `createTables()` | 中 |
| TD-004 | 商店兑换码无碰撞检测 | `useShopStore.ts` | 中 |
| TD-005 | 屏幕层无加载/错误边界 | `app/(child-tabs)/`、`app/(parent-tabs)/` | 中 |
| TD-006 | 无 ESLint 配置 | 根目录 | 低（已计划添加） |
| TD-007 | 无单元测试 | 全局 | 低（已计划） |
| TD-008 | `babel-plugin-replace-import-meta.js` 是临时 workaround | 根目录 | 低（等待 Zustand v5 官方修复） |

---

## 安全关注点

- **TD-001**（密码明文）：家长密码以明文存储在 SQLite 文件中，设备文件系统可直接访问。建议用 `expo-crypto` 做哈希或迁移到 `expo-secure-store`。
- **TD-002**（AI Key 未加密）：`AIConfig.api_key_encrypted` 字段名含 `_encrypted` 但实际加密逻辑需要验证。

---

## 下一步质量行动

1. 修复 TD-001：家长密码哈希化（SHA-256 + salt）
2. 为 `usePetStore` 的属性衰减逻辑添加单元测试
3. 为所有屏幕添加通用 Error Boundary
4. 建立 DB schema 版本管理（`PRAGMA user_version`）

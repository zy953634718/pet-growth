# 萌宠成长记 🐾

> 家庭养宠互动 App —— 通过照顾虚拟宠物培养孩子的责任感与好习惯

## 项目简介

「萌宠成长记」是一款面向家庭场景的互动养宠应用。家长可以为孩子创建专属宠物，通过设定任务、行为评分、积分奖励等机制，让孩子在照顾宠物的过程中养成良好习惯。宠物会随孩子的成长不断进化，提供持续的成就感与陪伴感。

## 核心功能

| 模块 | 功能说明 |
|------|---------|
| 家庭管理 | 创建家庭、邀请成员、亲子角色分配（家长/孩子） |
| 宠物系统 | 6 种宠物选择（猫/狗/兔/狐狸/熊猫/龙），5 阶段进化体系 |
| 任务中心 | 家长发布任务 → 孩子完成拍照提交 → 家长审核打分 |
| 行为评分 | 正向/负向行为记录，快速评分机制 |
| 积分商城 | 积分兑换虚拟道具，激励持续参与 |
| AI 聊天 | 孩子与宠物对话，AI 驱动的宠物拟人化交互 |
| 数据统计 | 多维度成长数据可视化，支持多孩家庭切换 |
| 数据安全 | 本地 SQLite 存储，支持加密备份与恢复导出 |

## 技术栈

- **框架**: React Native 0.81 + Expo SDK 54
- **路由**: Expo Router 6（文件系统路由）
- **状态管理**: Zustand 5
- **语言**: TypeScript 5.9
- **本地存储**: Expo SQLite + MMKV
- **动画**: React Native Reanimated 4
- **样式系统**: 自研 Design Token 体系（`src/theme/`）
- **构建**: EAS Build

## 项目结构

```
pet-growth/
├── app/                          # Expo Router 页面
│   ├── (child-tabs)/             # 孩子端 Tab 页面
│   │   ├── index.tsx             # 宠物主页（喂食/玩耍/清洁）
│   │   ├── chat.tsx              # AI 聊天
│   │   ├── tasks.tsx             # 任务列表
│   │   ├── shop.tsx              # 积分商城
│   │   └── profile.tsx           # 个人中心
│   ├── (parent-tabs)/            # 家长端 Tab 页面
│   │   ├── index.tsx             # 家庭概览
│   │   ├── stats.tsx             # 成长统计
│   │   ├── behavior.tsx          # 行为管理
│   │   ├── tasks.tsx             # 任务审核
│   │   ├── shop.tsx              # 商城管理
│   │   └── settings.tsx          # 设置（密码/备份/导出）
│   ├── SetupFamily.tsx           # 家庭创建
│   ├── SetupPet.tsx              # 宠物选择
│   ├── RoleSelect.tsx            # 角色选择
│   ├── Welcome.tsx               # 欢迎页
│   ├── ParentLock.tsx            # 家长密码锁
│   └── ImportBackup.tsx          # 备份恢复
├── src/
│   ├── stores/                   # Zustand 状态管理
│   │   ├── useFamilyStore.ts     # 家庭与成员
│   │   ├── usePetStore.ts        # 宠物数据与进化
│   │   ├── useTaskStore.ts       # 任务生命周期
│   │   ├── useBehaviorStore.ts   # 行为评分
│   │   ├── useShopStore.ts       # 商城与兑换
│   │   └── useAIStore.ts         # AI 聊天
│   ├── components/               # 通用组件
│   │   ├── Modal.tsx             # 统一弹窗
│   │   ├── PetAvatar.tsx         # 宠物头像
│   │   ├── PetStatusBars.tsx     # 状态条（饥饿/心情/清洁）
│   │   ├── TaskCard.tsx          # 任务卡片
│   │   └── PointBadge.tsx        # 积分徽章
│   ├── theme/                    # 设计令牌体系
│   │   ├── tokens.ts             # 颜色/字号/间距/圆角/阴影
│   │   ├── components.ts         # 组件级样式预设
│   │   ├── responsive.ts         # 响应式断点
│   │   └── index.ts              # 统一导出
│   ├── db/                       # 数据库层
│   │   ├── database.ts           # 跨平台入口
│   │   ├── database.native.ts    # SQLite 原生实现
│   │   ├── database.web.ts       # Web 模拟实现
│   │   └── sqlitePersistStorage.ts  # Zustand SQLite 持久化
│   ├── constants/                # 常量
│   │   ├── evolution.ts          # 宠物进化阶段配置
│   │   └── presets.ts            # 预设数据
│   └── types/                    # TypeScript 类型定义
├── assets/images/pets/           # 宠物进化阶段图片 (30张)
└── 萌宠成长记-产品设计文档-v3.0.md  # 产品设计文档
```

## 快速开始

### 环境要求

- Node.js >= 18
- Expo CLI (`npx expo`)
- Android Studio / Xcode（原生构建时需要）

### 安装与运行

```bash
# 克隆项目
git clone git@github.com:zy953634718/pet-growth.git
cd pet-growth

# 安装依赖
npm install

# 启动开发服务器
npx expo start

# 指定平台
npx expo start --android
npx expo start --ios
npx expo start --web
```

### 构建 APK

```bash
# 生成 Android 原生项目
npx expo prebuild --platform android --no-install

# 构建 Debug APK
npm run build:apk:debug

# 构建 Release APK
npm run build:apk
```

## 设计规范

项目采用自研 Design Token 体系，所有样式值统一通过 `src/theme/` 管理：

```typescript
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/theme';

// 使用示例
const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgPrimary,
    padding: Spacing[4],
    borderRadius: BorderRadius['2xl'],
    shadowColor: Shadows.md.shadowColor,
  },
  title: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
  },
});
```

## 路由架构

```
/                          → Welcome（首次）/ 宠物主页
/(child-tabs)              → 孩子端底部导航（5 个 Tab）
/(parent-tabs)             → 家长端底部导航（6 个 Tab）
/SetupFamily               → 家庭创建
/SetupPet                  → 宠物选择
/RoleSelect                → 角色选择
/ParentLock                → 家长密码验证
/ImportBackup              → 备份恢复
```

## License

Private - All rights reserved.

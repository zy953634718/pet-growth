---
name: hermes-agent-self-evolution
description: Hermes Agent 自进化框架的 Reasonix Code 原生适配版 — L4 画像管理 / L5 会话检索 / 技能进化
---

# Hermes Agent Self-Evolution（Reasonix Code 原生版）

> 原始框架: `hermes-agent-self-evolution/` 项目目录
> 对应文档: `SKILL.md`、`README.md`

## 五层能力映射表

| 层 | 原始实现 | Reasonix Code 原生等价 | 状态 |
|---|---|---|---|
| L1 上下文压缩 | Claude Code `/compact` | 系统自动管理上下文窗口 | ✅ 内置 |
| L2 技能记忆 | `~/.claude/skills/` | `.reasonix/skills/` + `create_skill` + `run_skill` | ✅ 内置 |
| L3 外部检索 | MCP 记忆服务（未实现） | MCP 服务器 (`add_mcp_server`) | 🔧 按需 |
| **L4 用户画像** | `profile_manager.py` | `remember` / `forget` / `recall_memory` | ✅ 内置 |
| **L5 全文检索** | `session_archive.py` (索引 jsonl 入 SQLite FTS5) | `search_content` / `glob` + 脚本 | 🔧 混合 |
| **技能进化** | `evolve_skill.py` (claude -p 变异+评估) | `evolve-skill` 半自动进化（健康度低时自动触发 + 三档写回 + 历史追踪） | ✅ 自动 |
| **任务后反思** | Claude Code Stop hook → review queue | `auto-reflect` 静默模式（任务完成后自动沉淀，高置信度零打扰） | ✅ 自动 |
| **健康度监测** | （原始框架无此独立层） | `skill-health-monitor` 追踪器（每次技能调用自动评分，低分告警触发进化） | ✅ 自动 |
| **元进化** | （原始框架无此独立层） | `meta-evolve` 闭环（分析进化历史，优化 evolve-skill 自身参数） | ✅ 自动 |

---

## 完整的自动进化闭环

调用 `/skill hermes-agent-self-evolution` 查看完整架构。以下是当前系统的工作方式：

```
你完成工作
   ↓ (auto-reflect 静默模式 · 自动)
自动扫描对话 → 高置信度 → 静默 remember
                          → 中置信度 → 一句话问你
   ↓ (skill-health-monitor · 自动)
每次技能调用后自动评分
   ↓ 健康度低于阈值？
evolve-skill 自动触发
   ↓ (三档安全策略)
微小改进 → 自动写回+备份
中等改进 → 展示确认
无改进   → 仅展示
   ↓ (meta-evolve · 自动)
积累 5 次进化后 → 分析最优策略 → 优化 evolve-skill 参数
   ↑_____________________________________________ 闭环
```

## 使用方式

调用 `/skill hermes-agent-self-evolution` 后，根据你给出的子命令执行对应操作：

### L4 用户画像管理（借助 Reasonix 原生记忆系统）

使用 `remember` 工具替代原始 `profile_manager.py`：

```
记住一条偏好：
  → 调用 remember({ type:"user", scope:"project", name:"...", description:"...", content:"..." })

查看已记住的信息：
  → 记忆已注入系统提示顶部的 MEMORY.md 索引中

列出所有记忆：
  → 用户可查看 MEMORY.md 中列出的所有记忆条目
```

如果需要迁移原始 Claude Code 的 USER.md / MEMORY.md 内容，脚本仍在：
```bash
python hermes-agent-self-evolution/scripts/profile_manager.py show user
python hermes-agent-self-evolution/scripts/profile_manager.py show memory
```

### L5 会话全文检索（辅助操作）

原始 `session_archive.py` 索引的是 Claude Code 的 jsonl 会话文件。在当前项目中，等价操作：

- **搜索项目代码**：使用 `search_content` 工具（全局 grep）
- **搜索文件名**：使用 `search_files` 或 `glob` 工具
- **查看最近修改**：`glob` 按 mtime 排序

如果需要索引 Claude Code 遗留的会话数据，直接运行脚本：
```bash
python hermes-agent-self-evolution/scripts/session_archive.py init
python hermes-agent-self-evolution/scripts/session_archive.py search "关键词"
python hermes-agent-self-evolution/scripts/session_archive.py recent 5
```

### 健康度监测（自动）

无需手动调用。每次 `run_skill` 后，我自动记录一次评分。
当健康度下降时，在回复末尾附带一行提醒：
```
📊 技能健康度：evolve-skill 流畅度下降 (3→2)，建议进化
```

主动查看：`/skill skill-health-monitor`

---

### 技能进化（原生流水线）

使用 `/skill evolve-skill <技能名>` 启动完整的进化流水线：

```
读取目标技能 → 分析并生成 2-3 个变异版本 → 多维度评分 → 展示 DIFF → 你确认后写回
```

进化维度：
- **v1 简洁优化**：精简冗余，降低 token 消耗
- **v2 功能增强**：补充缺失步骤和边界情况
- **v3 结构重组**（可选）：重新组织逻辑层次

评分维度（每项 1-10）：清晰度 · 完整性 · 可执行性 · 效率

> 🔒 永不自动写回 — 展示 DIFF 后等你确认才落盘

如需外部 API 做 judge（备用方案），原始脚本仍在：
```bash
python hermes-agent-self-evolution/scripts/evolve_skill.py .reasonix/skills/<name>.md --rounds 1 --dry-run
```

### 元进化（系统自迭代）

无需手动调用。积累 5 次进化数据后自动分析：
- 哪种变异策略最有效？
- 评分权重是否合理？
- 自动写回阈值是否合适？

分析结果会自动调整 `evolve-skill` 的参数，闭合自进化回路。

主动查看：`/skill meta-evolve`

---

### 任务后自动反思（跨 session 学习）

使用 `/skill auto-reflect` 启动反思闭环：

```
回顾完成事项 → 识别经验教训 → remember 沉淀到项目记忆 → 输出反思报告
```

触发方式：
- **主动调用**：`/skill auto-reflect`
- **我主动建议**：多步骤任务完成后，我会询问要不要做一次反思

沉淀的内容会通过 `remember` 写入项目记忆，**下次对话自动加载**，实现跨 session 学习。

---

### 代码审查（对接原生 review 技能）

原始框架的 Stop hook review 功能，可直接使用 Reasonix 内置的 review 技能：
```
/skill review
```
或安全审查：
```
/skill security-review
```

---

## 快速入门

在当前项目中使用 Hermes 自进化框架：

### 日常循环

```
/skill auto-reflect          # 任务后反思 → 沉淀经验
/skill evolve-skill <名称>    # 进化某个技能 → 持续优化
```

### 初始化（一次性）

1. **L4 — 初始化项目记忆**：说"记住这个项目的技术栈"来初始化
2. **L5 — 索引 Claude Code 旧会话**（如有需要）：
   ```bash
   cd hermes-agent-self-evolution && python scripts/session_archive.py init && python scripts/session_archive.py reindex
   ```
3. **查看所有可用技能**：`.reasonix/skills/` 下列出了所有可进化的目标

---

## 参考

- 完整理论背景见 `hermes-agent-self-evolution/references/architecture.md`
- Python 脚本源码在 `hermes-agent-self-evolution/scripts/`
- 原始 SKILL.md 在 `hermes-agent-self-evolution/SKILL.md`

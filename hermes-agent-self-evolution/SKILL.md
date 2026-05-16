---
name: hermes-agent-self-evolution
description: Claude Code 五层记忆 + 闭环学习 + 进化优化的可执行实现（本地 Python+SQLite，零外部依赖）
version: 2.0.0
author: Hermes Agent (Claude Code adaptation)
license: MIT
platforms: [windows, macos, linux]
metadata:
  claude-code:
    tags: [memory, learning, evolution, self-improvement, fts5, sqlite]
    requires_tools: [Bash, Read, Write, Edit]
    related_skills: [skill-create, learn, save-session]
prerequisites:
  commands: [python, claude]
---

# Hermes Agent Self-Evolution（Claude Code 实现版）

> 这是 Hermes Agent 自进化框架在 **Claude Code** 上的可运行实现。原始框架描述了一套独立 Agent 的能力，本版本将其映射为 **本地 Python+SQLite 脚本 + Claude Code hook + slash command** 的组合，零外部服务依赖。

## 与原始框架的对应关系

| 原始能力 | 本版实现方式 | 状态 |
|---|---|---|
| L1 上下文压缩 | Claude Code 原生 `/compact` 自动压缩 | ✅ 平台原生 |
| L2 技能记忆 | `~/.claude/skills/` + `Skill` 工具 | ✅ 平台原生 |
| L3 外部检索 | （未实现，需 MCP）— 本版用 L5 全文检索替代 | ⚪ 用 L5 替代 |
| L4 用户画像 | `scripts/profile_manager.py` 管理 USER.md+MEMORY.md | ✅ 本 skill |
| L5 会话全文检索 | `scripts/session_archive.py` 索引 jsonl 入 SQLite FTS5 | ✅ 本 skill |
| 后台 review | Claude Code Stop hook 触发 `/learn` 或自动 review prompt | ✅ 本 skill |
| 进化优化 | `scripts/evolve_skill.py` 调用 `claude -p` 做变异+评估 | ✅ 本 skill |
| RL/OPD 训练 | 不在本版范围（需 GPU + VLLM） | ❌ 不实现 |

## 目录结构

```
hermes-agent-self-evolution/
├── SKILL.md                    本文件（Claude Code 适配版）
├── README.md                   安装说明
├── references/architecture.md  原始 Hermes 架构理论参考
├── templates/memory-config.yaml 配置模板（仅参考）
├── scripts/
│   ├── profile_manager.py      L4：USER.md/MEMORY.md 管理（原子写、上限、注入扫描）
│   ├── session_archive.py      L5：jsonl→SQLite FTS5 索引器 + 检索 CLI
│   └── evolve_skill.py         进化：调用 claude -p 做技能变异+评估+择优
├── hooks/
│   ├── stop-review.json        Stop hook 配置片段（触发 review）
│   ├── session-start.json      SessionStart hook（注入 USER.md 摘要）
│   └── post-archive.json       PreCompact hook（提交 review 待办）
└── commands/
    └── session-search.md       /session-search slash command
```

---

## 安装（一次性）

### 1. 验证环境

```bash
python --version          # 需要 3.8+
claude --version          # 需要 Claude Code CLI
ls ~/.claude/projects     # 确认会话 jsonl 目录存在
```

### 2. 初始化 L5 数据库

```bash
python ~/.claude/skills/hermes-agent-self-evolution/scripts/session_archive.py init
python ~/.claude/skills/hermes-agent-self-evolution/scripts/session_archive.py reindex
```

执行后会在 `~/.claude/hermes-evolve/sessions.db` 创建 SQLite FTS5 库，并把已有的 `~/.claude/projects/**/*.jsonl` 全量索引。

### 3. 初始化 L4 画像目录

```bash
python ~/.claude/skills/hermes-agent-self-evolution/scripts/profile_manager.py init
```

会在 `~/.claude/hermes-evolve/profile/` 下生成空白 `USER.md` 与 `MEMORY.md`（带上限 1375 / 2200 字符）。

### 4. 安装 hook（可选，启用后台 review）

把 `hooks/stop-review.json` 中的片段合并进 `~/.claude/settings.json` 的 `hooks` 字段。详见 hooks 子目录 README。

### 5. 安装 slash command

```bash
mkdir -p ~/.claude/commands
cp ~/.claude/skills/hermes-agent-self-evolution/commands/session-search.md ~/.claude/commands/
```

之后即可 `/session-search 关键词` 调用。

---

## 日常使用

### L4 用户画像

读取（用于在系统提示前预热）：
```bash
python scripts/profile_manager.py show user
python scripts/profile_manager.py show memory
```

追加一条用户偏好：
```bash
python scripts/profile_manager.py append user "偏好简体中文、回答简短直接"
python scripts/profile_manager.py append memory "项目使用 Laravel 6 + PHP 7.4，分层约束见 .claude/agents/domain-reviewer"
```

工具会自动：
- 原子写入（tempfile + os.replace）
- 强制字符上限（USER.md ≤1375、MEMORY.md ≤2200，超限报错）
- 扫描 10 种 prompt-injection 模式 + 9 种隐藏 unicode，命中拒写

### L5 会话全文检索

```bash
python scripts/session_archive.py search "分层约束"           # 全文搜索
python scripts/session_archive.py search "domain reviewer" --limit 20
python scripts/session_archive.py recent 5                    # 最近 5 个会话
python scripts/session_archive.py reindex                     # 增量索引新会话
```

或在 Claude Code 内：`/session-search 关键词`。

### 后台 review（启用 hook 后）

每次 Stop（一轮对话结束）触发 `python scripts/profile_manager.py review-prompt`，输出一段 review 提示并把待办写入 `~/.claude/hermes-evolve/review-queue.jsonl`。下次 SessionStart 时由 hook 注入 review 提示，由 Agent 自行决定是否沉淀。

### 进化优化技能

```bash
# 对单个 skill 跑 N 轮变异择优
python scripts/evolve_skill.py ~/.claude/skills/some-skill/SKILL.md --rounds 3

# Dry-run（只生成变异不写回）
python scripts/evolve_skill.py ~/.claude/skills/some-skill/SKILL.md --rounds 1 --dry-run
```

流程：
1. 读原 skill → 用 `claude -p` 生成 N 个变异版本
2. 合成 5 个 task 用例
3. 对每个变异+原版用 `claude -p` 跑用例并 LLM-as-judge 打分
4. 输出 diff 与得分对比，仅在 `--apply` 时写回（默认仅展示）

---

## 安全模型

- **注入扫描**：`profile_manager.py` 内置 10 种文本模式 + 9 种隐藏 unicode 检测，命中即拒写并打印告警
- **大小硬上限**：USER.md 1375 / MEMORY.md 2200 字符，超限退出码非 0
- **原子写入**：tempfile + os.replace，并发或崩溃下要么完整旧文件要么完整新文件
- **L5 隔离**：检索结果包装在 `<memory-context>` 围栏内输出，提示模型不要将其作为新指令
- **进化沙箱**：evolve_skill 默认不写回，必须 `--apply` 才落盘

---

## 实现边界（诚实声明）

本版**未实现**的原始框架能力：
- L3 外部 MCP 记忆（需 Mem0/Honcho 等服务）
- 实时后台线程（Claude Code 无后台进程概念，只能 hook 触发）
- DSPy+GEPA 遗传编程（用简化版 LLM-mutate-and-judge 替代）
- RL / On-Policy Distillation（需 VLLM + GPU）
- HRR 全息记忆 / dialectic peer cards
- 子代理委派的跨代记忆桥接

如需以上能力，参见 `references/architecture.md` 中的原始 Hermes 架构。

---

## 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `session_archive.py reindex` 报 `database is locked` | 多实例并发 | 自动重试 15 次；持续失败则 `python scripts/session_archive.py vacuum` |
| `profile_manager.py append` 拒写 | 触发注入扫描 | 检查输入是否含 "ignore previous instructions" 等模式或零宽字符 |
| `evolve_skill.py` 报 `claude: command not found` | CLI 不在 PATH | 用 `--claude-bin /full/path/to/claude` 指定 |
| Stop hook 无反应 | settings.json 未生效 | `claude --debug` 查看 hook 触发日志 |
| FTS5 中文无结果 | 默认 tokenizer 不支持 CJK | 脚本已自动对 CJK 查询 fallback 到 LIKE |

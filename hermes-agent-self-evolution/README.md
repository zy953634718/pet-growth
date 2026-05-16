# Hermes Agent Self-Evolution — Claude Code 实现版

> 五层记忆 + 闭环学习 + 进化优化在 Claude Code 上的可运行实现。零外部服务依赖，纯本地 Python+SQLite。

## 与原始 Hermes 的差异

| 能力 | 原始 Hermes | 本版（Claude Code 适配） |
|---|---|---|
| L1 上下文压缩 | Agent 内置 | 复用 Claude Code 原生 `/compact` |
| L2 技能记忆 | YAML+frontmatter skills | 原样复用 `~/.claude/skills/` |
| L3 外部检索 | dialectic / Honcho / Mem0 等多后端 | **未实现**，用 L5 全文检索替代 |
| L4 用户画像 | 进程内记忆+原子写 | `scripts/profile_manager.py` |
| L5 会话全文检索 | SQLite FTS5 + WAL | `scripts/session_archive.py` |
| 后台 review | 后台线程 | Claude Code Stop hook |
| 进化优化 | DSPy+GEPA 遗传编程 | `scripts/evolve_skill.py`（LLM 变异+评分简化版）|
| RL/OPD | VLLM+Atropos | **不实现**（需 GPU） |

## 安装

```bash
# 1) 验证环境
python --version          # 3.8+
claude --version

# 2) 初始化 L4/L5 数据
python ~/.claude/skills/hermes-agent-self-evolution/scripts/session_archive.py init
python ~/.claude/skills/hermes-agent-self-evolution/scripts/session_archive.py reindex
python ~/.claude/skills/hermes-agent-self-evolution/scripts/profile_manager.py init

# 3) 安装 slash command
mkdir -p ~/.claude/commands
cp ~/.claude/skills/hermes-agent-self-evolution/commands/session-search.md ~/.claude/commands/

# 4) 启用 hook（可选）
# 把 hooks/settings-snippet.json 的 hooks 对象合并进 ~/.claude/settings.json
```

## 目录结构

```
hermes-agent-self-evolution/
├── SKILL.md                    Claude Code 适配版主文档
├── README.md                   本文件
├── references/architecture.md  原始 Hermes 架构理论参考
├── templates/memory-config.yaml 配置模板（仅供参考）
├── scripts/
│   ├── profile_manager.py      L4：USER.md/MEMORY.md 管理
│   ├── session_archive.py      L5：SQLite FTS5 索引+检索
│   └── evolve_skill.py         技能进化
├── hooks/
│   ├── settings-snippet.json   三个 hook 的合并模板
│   └── README.md               hook 集成说明
└── commands/
    └── session-search.md       /session-search slash command
```

## 快速使用

```bash
# L4 写入用户偏好
python scripts/profile_manager.py append user "偏好简体中文，回答简短"
python scripts/profile_manager.py show user

# L5 检索历史会话（CLI）
python scripts/session_archive.py search "分层约束"
python scripts/session_archive.py recent 5

# L5 检索（Claude Code 内）
/session-search 分层约束

# 进化某个 skill（dry-run）
python scripts/evolve_skill.py ~/.claude/skills/some-skill/SKILL.md --rounds 3

# 真正写回（带备份）
python scripts/evolve_skill.py ~/.claude/skills/some-skill/SKILL.md --rounds 3 --apply
```

## 数据存储位置

| 类型 | 路径 |
|---|---|
| L4 画像文件 | `~/.claude/hermes-evolve/profile/{USER,MEMORY}.md` |
| L5 SQLite FTS5 库 | `~/.claude/hermes-evolve/sessions.db` |
| Review 待办队列 | `~/.claude/hermes-evolve/review-queue.jsonl` |
| 进化 backup/report | 与目标 SKILL.md 同目录，`*.bak.<ts>` 与 `.evolve-report.<ts>.json` |

## 安全

- L4 写入前扫描 10 种 prompt-injection 文本模式 + 9 种隐藏 unicode，命中拒写
- L4 强制 USER.md ≤1375、MEMORY.md ≤2200 字符
- L5 检索结果包装在 `<memory-context>` 围栏中，提示模型不要将其作为新指令
- 进化默认 dry-run，必须 `--apply` 才落盘并保留 `.bak` 备份

## 故障排查

参见 SKILL.md 末尾的故障排查表。

## License

MIT

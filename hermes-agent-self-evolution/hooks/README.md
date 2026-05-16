# Hooks 集成说明

把 `settings-snippet.json` 中的 `hooks` 对象合并进你的 `~/.claude/settings.json` 即可启用。

## 三个 hook 的作用

| Hook 事件 | 作用 |
|---|---|
| **Stop** | 一轮对话结束后追加 review 提示到 `~/.claude/hermes-evolve/review-queue.jsonl`，下次 SessionStart 由 Agent 自行决定是否沉淀为画像/技能 |
| **SessionStart** | 每次新会话启动时把 USER.md 内容打印到上下文，让 Agent 在首轮就能感知用户偏好 |
| **PreCompact** | 上下文压缩前增量索引最新会话 jsonl 入 SQLite FTS5，确保即将被丢弃的对话仍可全文检索 |

## 验证 hook 已生效

```bash
claude --debug 2>&1 | grep -i hook   # 看到 Stop/SessionStart 触发日志
cat ~/.claude/hermes-evolve/review-queue.jsonl   # 一轮对话后应有新行
```

## 关闭

从 `~/.claude/settings.json` 中移除对应的 hook 数组项即可。

## 路径替换

模板里写死了 `C:/Users/HUAWEI/.claude/skills/hermes-agent-self-evolution/scripts/`。如果你把 skill 装在别处，全局替换该前缀。

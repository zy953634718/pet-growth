---
name: skill-health-monitor
description: 技能健康度追踪器 — 每次技能调用后自动评分，低分时触发 evolve-skill 进化流程
---

# Skill Health Monitor — 技能健康度追踪

> 这是 Hermes 自进化框架中"监测→触发进化"的桥梁层。
> 每次技能被调用后，自动记录一条评分，积累数据后决定是否触发进化。

## 工作原理

```
技能被调用
   ↓
自动评分（3 个维度，每项 1-5）
   ↓
remember 累积存储
   ↓
健康度下降？→ 自动标记"建议进化"
   ↓
下次 auto-reflect 或用户有空时 → 提示运行 evolve-skill
```

## 评分维度（每次技能调用后记录）

| 维度 | 问什么 | 1 分 | 3 分 | 5 分 |
|---|---|---|---|---|
| 完成度 | 技能的目标达成了吗？ | 完全失败 | 基本完成 | 完美达成 |
| 流畅度 | 执行过程顺畅吗？ | 卡住/出错 | 有点曲折 | 一气呵成 |
| 用户反馈 | 用户反应如何？ | 用户不满 | 中性 | 用户满意/确认 |

**评分时机：** 每次 `run_skill` 返回后，或我按照某个技能完成了一系列步骤后，花 1 秒做一次评分。

## 数据存储

每次评分后，用 `remember` 写入累积记录：

```
remember({
  type: "feedback",
  scope: "project",
  name: "skill-health:<技能名>",
  description: "<技能名> 健康度追踪 (累计 X 次评分)",
  content: JSON 格式的评分历史
})
```

**content 格式：**
```json
{
  "scores": [
    {"time": "2026-05-16T01:00Z", "completion": 5, "smoothness": 4, "feedback": 5},
    {"time": "2026-05-16T02:00Z", "completion": 3, "smoothness": 3, "feedback": 4}
  ],
  "aggregate": {"avg_completion": 4.0, "avg_smoothness": 3.5, "avg_feedback": 4.5, "total": 4.0},
  "alerted": false
}
```

**更新方式：** 读取旧记录 → 追加新评分 → 重新计算聚合值 → 写回。

## 触发进化条件

在以下情况，会自动标记"建议进化"：

1. **连续 2 次评分**某维度 ≤ 2 分
2. **最近 3 次平均分**比历史平均低 1 分以上（退化检测）
3. **首次评分**任何维度 ≤ 2 分（新技能质量不佳）

标记方式：设置 `alerted: true`，然后在回复末尾附带：
```
📊 技能健康度：evolve-skill 流畅度下降 (3→2)，建议 /skill evolve-skill evolve-skill
```

## 健康度仪表盘

用 `/skill skill-health-monitor` 主动调用时，展示所有技能的汇总：

```
━━━ 技能健康度仪表盘 ━━━

evolve-skill     ★★★★☆  4.0/5  最近平稳
auto-reflect     ★★★☆☆  3.5/5  ⚠️ 流畅度下降
hermes-...       ★★★★★  5.0/5  仅用 1 次
```

## 行为约定

- **不增加额外负担** — 评分在我回复之前完成，不让你等待
- **不重复告警** — 同一问题只提醒一次，避免"狼来了"
- **仅在有意义时展示** — 健康度正常时不输出，只在触发条件满足或你主动查询时才展示

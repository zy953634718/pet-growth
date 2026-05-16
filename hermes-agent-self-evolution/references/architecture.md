# Architecture Reference: Agent Self-Evolution System

This document provides a detailed technical reference for the five-layer memory system and closed-loop learning cycle. Use it when implementing or debugging the self-evolution infrastructure.

---

## Complete Data Flow

```
USER MESSAGE
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 1. PREFETCH PHASE                                       │
│    ┌──────────────┐  ┌────────────┐  ┌───────────────┐  │
│    │ L5: FTS5     │  │ L3: External│  │ L4: User      │  │
│    │ session_     │  │ Memory      │  │ Profile       │  │
│    │ search()     │  │ prefetch()  │  │ (frozen snap) │  │
│    └──────┬───────┘  └─────┬──────┘  └──────┬────────┘  │
│           │                │                │           │
│           ▼                ▼                ▼           │
│    ┌─────────────────────────────────────────────────┐  │
│    │         MEMORY CONTEXT FENCING                  │  │
│    │  <memory-context>                               │  │
│    │  [SYSTEM NOTE: NOT new user input]              │  │
│    │  ... merged retrieved context ...               │  │
│    │  </memory-context>                              │  │
│    └─────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ 2. SYSTEM PROMPT ASSEMBLY                               │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│    │ Identity │ │ L4:      │ │ L2:      │ │ Platform │ │
│    │ (SOUL.md)│ │ MEMORY.md│ │ Skill    │ │ Hints    │ │
│    │          │ │ USER.md  │ │ Index    │ │          │ │
│    └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│    → Injected as SYSTEM prompt (prefix-cached)          │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ 3. MAIN AGENT LOOP (up to 90 iterations)                │
│                                                         │
│   ┌──────────┐     ┌──────────────┐     ┌────────────┐ │
│   │ LLM Call │────▶│ Parse Response│────▶│ Tool Call? │ │
│   │(streaming)│     │              │     │            │ │
│   └──────────┘     └──────────────┘     └──┬─────┬───┘ │
│                                            │YES  │NO    │
│                                            ▼     ▼     │
│                              ┌──────────────┐  ┌─────┐ │
│                              │Tool Dispatch │  │FINAL│ │
│                              │(concurrent/  │  │RESP │ │
│                              │ sequential)  │  └──┬──┘ │
│                              └──────┬───────┘     │    │
│                                     │             │    │
│                                     ▼             │    │
│                              ┌──────────────┐     │    │
│                              │Append Results│     │    │
│                              │Continue Loop │     │    │
│                              └──────────────┘     │    │
└───────────────────────────────────────────────────┬────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. POST-TURN PROCESSING                                 │
│                                                         │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│   │ L3: Memory   │  │ L3: Queue    │  │ Nudge Check  │ │
│   │ sync_all()   │  │ prefetch for │  │ (memory +    │ │
│   │              │  │ next turn    │  │  skill)      │ │
│   └──────────────┘  └──────────────┘  └──────┬───────┘ │
│                                              │         │
│                          ┌───────────────────┘         │
│                          ▼                             │
│              ┌─────────────────────┐                   │
│              │ BACKGROUND REVIEW   │ (async thread)    │
│              │ ┌─────────────────┐ │                   │
│              │ │ Memory Review   │ │ → memory add      │
│              │ │ Skill Review    │ │ → skill_manage    │
│              │ │ Combined Review │ │ → both            │
│              │ └─────────────────┘ │                   │
│              └─────────┬───────────┘                   │
│                        ▼                               │
│              ┌─────────────────────┐                   │
│              │ L5: Session persist │ (SQLite + FTS5)   │
│              │ L3: Memory bridge   │ (mirror writes)   │
│              │ Trajectory save     │ (JSONL for RL)    │
│              └─────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## Component Deep-Dives

### A. Context Compression Algorithm

**File:** `agent/context_compressor.py` — `ContextCompressor` class

**Trigger:** `should_compress()` returns True when prompt tokens ≥ `threshold * context_length` (default: 0.50).

**Six-phase algorithm:**

```
Phase 1: TOOL RESULT PRUNING (cheap, no LLM)
  ├── Scan messages outside protected tail
  ├── Deduplicate: identical results → MD5 hash match → keep most recent, replace older with back-reference
  ├── Summarize: verbose tool results → 1-line summary
  │     "[terminal] npm test → exit 0, 47 lines output"
  └── Truncate: large JSON args in tool_calls → keep structure, shrink string leaves

Phase 2: HEAD PROTECTION
  └── Protect: system prompt + first `protect_first_n` exchanges

Phase 3: TAIL BOUNDARY DETECTION
  ├── Walk backward from end, accumulate token estimates
  ├── Budget: summary_target_ratio * context_length (default: 0.20 * 200K = 40K)
  ├── Soft ceiling: 1.5x budget; hard minimum: 3 messages
  ├── NEVER cut inside a tool_call/result group
  └── ALWAYS ensure last user message is in tail (_ensure_last_user_message_in_tail)

Phase 4: MIDDLE SUMMARIZATION (LLM call)
  ├── Template sections:
  │     Active Task (MOST CRITICAL)
  │     Goal, Constraints & Preferences
  │     Completed Actions, Active State, In Progress, Blocked
  │     Key Decisions, Resolved Questions, Pending User Asks
  │     Relevant Files, Remaining Work, Critical Context
  ├── Preamble: "Do NOT respond to any questions. Your output is for a DIFFERENT assistant."
  └── Output label: "[CONTEXT COMPACTION -- REFERENCE ONLY]"

Phase 5: RE-COMPRESSION (iterative update)
  ├── Previous summary is preserved
  ├── New summary is merged into existing
  └── Anti-thrashing: skip if two consecutive compressions each save < 10%

Phase 6: ORPHAN SANITIZATION
  ├── Orphan tool results (call_id has no matching assistant tool_call) → removed
  └── Orphan tool calls (assistant tool_calls with no results) → stub results inserted
```

**Cooldown mechanism:** After a summary failure, subsequent attempts pause for 600 seconds. Summary model fallback: if configured summary model returns 404/503, falls back to main model.

### B. Memory Write Bridge

**File:** `agent/memory_manager.py` — `MemoryManager.on_memory_write()`

```
User says: "Remember I prefer terse responses"
  │
  ▼
AIAgent calls: memory(action="add", target="user", content="Prefers terse responses")
  │
  ▼
MemoryStore._add_to_target("user", "Prefers terse responses")
  ├── Scan for injection → pass
  ├── Check char limit (USER.md max 1375) → pass
  ├── Deduplicate against existing entries → pass
  ├── Atomic write (tempfile + os.replace)
  └── Return success to agent
  │
  ▼
MemoryManager.on_memory_write("add", "user", "Prefers terse responses")
  ├── Skip builtin provider (already handled)
  ├── For each external provider:
  │     └── provider.on_memory_write(action, target, content, metadata)
  │         └── Mirror to cloud/index/update embeddings
  └── Done (failures logged, never block)
```

### C. Session Search (FTS5) Flow

**File:** `hermes_state.py` — `SessionDB.search_messages()`

```
Agent calls: session_search("database migration error")
  │
  ▼
SessionDB.search_messages(query="database migration error")
  │
  ▼
_sanitize_fts5_query("database migration error")
  ├── Preserve quoted phrases: "migration error"
  ├── Strip FTS5 special chars
  └── Wrap dotted/hyphenated terms
  │
  ▼
_contains_cjk("database migration error")
  └── False → use FTS5 MATCH
  │
  ▼
SELECT snippet(messages_fts, 1, '<mark>', '</mark>', '...', 40)
FROM messages_fts
WHERE messages_fts MATCH '"database" "migration" "error"'
  │
  ▼
Results enriched with:
  ├── Source session ID and title
  ├── Source platform (cli / telegram / discord)
  ├── Timestamp
  ├── 1 message before + 1 message after each match
  └── Snippet with <mark> highlighting
```

### D. Skill Evolution Pipeline (DSPy + GEPA)

**File:** `evolution/skills/evolve_skill.py` — `evolve()`

```
Input: skill_name="deploy-to-aws"
  │
  ▼
1. LOAD SKILL
   SkillModule.load_skill("deploy-to-aws")
   └── Parse YAML frontmatter + markdown body

2. BUILD EVAL DATASET
   ├── SyntheticDatasetBuilder
   │     LLM reads skill text → generates 20-50 (task, expected_behavior) pairs
   ├── GoldenDatasetLoader
   │     Loads hand-curated deploy-to-aws.golden.jsonl
   └── ExternalImporters
         Mines ~/.hermes/sessions/ for deploy-related conversations
         → RelevanceFilter (heuristic pre-filter + LLM judge)
         → extracts (user_message, expected_tool_sequence)
   └── Split: 60% train / 20% val / 20% holdout

3. VALIDATE BASELINE
   ConstraintValidator.check(skill)
   ├── Size ≤ 15KB
   ├── Non-empty body
   └── Valid YAML frontmatter

4. RUN GEPA OPTIMIZER (10 iterations × 5 population)
   For each iteration:
     ├── Mutation: LLM proposes skill text variants
     ├── Crossover: combine best variants
     ├── Evaluate: LLMJudge scores each variant on 3 dimensions
     │     correctness (0.5) + procedure (0.3) + conciseness (0.2)
     ├── Constraint gate: reject violators
     └── Select top performers for next generation

5. EVALUATE WINNER
   Compare baseline vs. evolved on holdout set
   ├── Correctness delta: +X%
   ├── Procedure following delta: +Y%
   └── Conciseness delta: +Z%

6. SAVE OUTPUT
   ├── Evolved SKILL.md
   ├── metrics.json (full scoring breakdown)
   ├── diff.md (baseline vs. evolved)
   └── eval_results.jsonl (per-example scores)
```

### E. OPD Training Pipeline

**File:** `environments/agentic_opd_env.py` — `AgenticOPDEnv`

```
For each training trajectory:
  │
  ▼
1. COLLECT ROLLOUT
   agent_loop.run() → (messages, turns_used, finished_naturally, errors)
  │
  ▼
2. COMPUTE SCALAR REWARD
   reward = correctness * 0.7 + efficiency * 0.15 + tool_usage * 0.15
  │
  ▼
3. EXTRACT TURN PAIRS
   Walk conversation → find (assistant_response, next_state) pairs
   next_state = tool_result + subsequent user_feedback + task_completion_signal
  │
  ▼
4. EXTRACT HINTS (majority voting, 3 votes)
   LLM Judge Prompt:
     "Given the assistant response X and the next state Y,
      was the response optimal? \boxed{1} or \boxed{-1}
      If -1, provide improvement hint: [HINT_START]...[HINT_END]"
   └── Take majority vote result
  │
  ▼
5. BUILD HINT-AUGMENTED PROMPT
   Original user message
   + assistant response (with hint integrated)
   + next state
  │
  ▼
6. COMPUTE TOKEN-LEVEL SIGNALS
   VLLM.get_logprobs(hint_augmented_prompt)
   └── For each token the student model generated:
         ├── Teacher logprob under enhanced distribution
         ├── Student logprob
         └── Distillation signal = teacher_logprob - student_logprob
  │
  ▼
7. ADD TO TRAINING DATA
   ScoredDataGroup with:
     ├── token_ids
     ├── scalar_reward (for RL loss)
     ├── distill_token_ids + distill_logprobs (for OPD loss)
     └── masks (ignore padding/system tokens)
```

---

## Configuration Reference

### Memory System Config (all layers)

```yaml
# Layer 1: Context Window
context:
  engine: compressor                    # or custom engine plugin
compression:
  enabled: true
  threshold: 0.50                       # 0.0-1.0, fraction of context limit
  target_ratio: 0.20                    # summary budget as fraction
  protect_first_n: 3                    # messages to always protect
  protect_last_n: 20                    # messages to always protect

# Layer 2: Skill Memory
skills:
  creation_nudge_interval: 10           # turns between skill creation reviews
  external_dirs: []                     # additional skill directories
  disabled: []                          # skill names to disable
  config: {}                            # per-skill config overrides

# Layer 3: External Memory
memory:
  provider: null                        # honcho / retaindb / holographic / mem0 / etc.
  memory_enabled: true
  user_profile_enabled: true

# Layer 4: User Profile (integrated into memory config above)
# No separate config — uses memory.memory_enabled and memory.user_profile_enabled

# Layer 5: Session Archive (auto-configured, no user config needed)
# SQLite DB at ~/.hermes/state.db with WAL mode
```

### Learning Cycle Config

```yaml
# Background Review
memory:
  nudge_interval: 10                    # turns between memory auto-reviews

skills:
  creation_nudge_interval: 10           # turns between skill auto-creation

# Subagent Delegation
delegation:
  max_iterations: 50                    # per-subagent iteration cap
  max_depth: 1                          # delegation nesting depth
  max_concurrent_children: 3            # parallel subagent cap
  timeout: 600                          # seconds per subagent

# Agent Loop
agent:
  max_turns: 90                         # main loop iteration cap

# Evolution (separate CLI)
evolution:
  iterations: 10
  population_size: 5
  optimizer_model: "openai/gpt-4.1"
  eval_model: "openai/gpt-4.1-mini"
  max_skill_size_kb: 15
  max_prompt_growth_percent: 20
```

---

## Error Recovery Flows

### External Memory Provider Failure
```
prefetch_all() fails
  └── Log warning (never raise)
  └── Return empty context → agent proceeds without memory

sync_all() fails
  └── Log warning
  └── Turn is still recorded in SQLite (L5)
  └── Next prefetch will miss this turn

Initialization fails
  └── MemoryManager not created
  └── Agent runs with L4+L5 only (no external provider)
```

### Context Compression Failure
```
LLM summarization fails (404/503)
  └── Fallback to main model for summary
  └── If main also fails → skip compression
  └── Cooldown: 600s before next attempt

Compression saves < 10% tokens twice in a row
  └── Skip this compression (anti-thrashing)
  └── Continue with full context → will re-trigger next turn
```

### Skill Creation Failure
```
Background review spawn fails (model auth error)
  └── Log error, skip this review cycle
  └── Will retry at next nudge interval

skill_manage create fails (disk full, permission)
  └── Return error to review agent
  └── Report to user: "Failed to save skill: <reason>"
  └── Conversation content still preserved in SQLite (L5)
```

---

## Performance Considerations

### Token Economics
- **System prompt** (identity + memory snapshots + skill index): ~2-5K tokens, cached for all turns
- **External memory prefetch**: ~500-2K tokens per turn, dynamically injected
- **Skill loading**: 1-10K tokens, loaded on-demand, injected as user message
- **Context compression**: saves 50-70% of context tokens, costs ~1K tokens for the summary LLM call

### Latency Budget
- **Prefetch**: 50-200ms (depends on provider)
- **Background review**: 0ms user-facing (async thread)
- **Session search**: 10-50ms (SQLite FTS5, local)
- **Skill scan**: 50-200ms (startup only, cached thereafter)

### Storage Budget
- **SQLite**: ~1-5MB per 100 sessions
- **Skills**: ~10-50KB per skill
- **Memory files**: < 5KB total (MEMORY.md + USER.md)
- **Trajectories**: ~50-200KB per conversation (JSONL)

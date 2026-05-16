import { create } from 'zustand';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import * as SecureStore from 'expo-secure-store';
import { AIConfig, AISafetyConfig, ChatMessage, MoodType, PetEvolutionStage, AIFallbackReply } from '../types';
import { dbRun, dbGetOne, dbGetAll } from '../db/helpers';
import { getStageInfo } from '../constants/evolution';

// ============================================================
// SecureStore helpers — API key 加密存储（S-02 修复）
// ============================================================
function apiKeyStorageKey(familyId: string): string {
  return `petgrowth_ai_key_${familyId}`;
}

async function loadApiKey(familyId: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    // Web 端 fallback：从 localStorage 读取
    return localStorage.getItem(apiKeyStorageKey(familyId)) || null;
  }
  try {
    return await SecureStore.getItemAsync(apiKeyStorageKey(familyId));
  } catch {
    return null;
  }
}

async function saveApiKey(familyId: string, key: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (key) {
      localStorage.setItem(apiKeyStorageKey(familyId), key);
    } else {
      localStorage.removeItem(apiKeyStorageKey(familyId));
    }
    return;
  }
  try {
    if (key) {
      await SecureStore.setItemAsync(apiKeyStorageKey(familyId), key);
    } else {
      await SecureStore.deleteItemAsync(apiKeyStorageKey(familyId));
    }
  } catch {
    // 静默失败，不影响主流程
  }
}

// ============================================================
// Prompt Templates
// ============================================================
const SYSTEM_PROMPT_BASE = (name: string, species: string, childName: string, level: number, stageName: string, mood: string, health: string) => `你是${name}，一只${species}宠物。你住在一个温暖的家庭里，是你的小主人${childName}的好伙伴。

你的性格特点：
- 温柔友善，喜欢鼓励小主人
- 有时会很调皮，偶尔说俏皮话
- 会关心小主人的心情和状态
- 喜欢用比喻和故事来说道理

你的背景信息：
- 当前等级：Lv.${level}，${stageName}阶段
- 你的心情：${mood}
- 你的身体状况：${health}

重要规则：
1. 始终以宠物的身份对话，不要跳出角色
2. 回复要简短（50-100字），适合孩子阅读
3. 用生动有趣的语言，可以加一些可爱的语气词
4. 当小主人遇到困难时，先共情再给建议
5. 不要提供任何不适合未成年人的内容
6. 不要重复刚才说过的话`;

const MOOD_PROMPTS: Record<MoodType, string> = {
  excited: '你现在的心情是兴奋(🤩)，说话充满活力，多用感叹号，会主动分享开心的事。口头禅："哇！太棒了！"',
  happy: '你现在的心情是开心(😄)，语气温和愉快，会夸奖小主人。口头禅："嘿嘿~"',
  normal: '你现在的心情是普通(🙂)，正常语气，平和对话。',
  unhappy: '你现在的心情是不开心(😐)，语气有些低落，话变少。口头禅："嗯..."',
  sad: '你现在的心情是伤心(😢)，不愿意多说话，需要小主人安慰。',
};

const STAGE_PROMPTS: Record<number, string> = {
  1: '你是蛋阶段的宠物，你还很小，只会简单的回应，偶尔蹦出一两个字，比如"嗯嗯"、"要要"。',
  2: '你是幼崽阶段的宠物，你刚学会说话，句子很短，充满好奇心，喜欢问"为什么？"。',
  3: '你是少年阶段的宠物，你能正常对话了，偶尔犯傻，活力满满，喜欢闹着玩。',
  4: '你是成年阶段的宠物，你变得成熟智慧，能给小主人很好的建议，说话有条理。',
  5: '你是传说阶段的宠物，你拥有丰富的人生经验，说话充满哲理，偶尔幽默，令人敬佩。',
};

const SAFETY_PROMPT = (parentRules: string) => `以下内容是家长设定的对话安全边界，你必须严格遵守：
${parentRules || '无特殊限制'}

绝对禁止：
- 讨论或鼓励任何暴力、危险行为
- 泄露任何个人信息（地址、电话等）
- 对孩子的家庭情况做负面评价
- 与孩子建立超出"宠物伙伴"的关系
- 提供任何需要付费/购物的建议
- 讨论不适合该年龄段的话题`;

// ============================================================
// Fallback replies (offline mode)
// ============================================================
const FALLBACK_REPLIES: AIFallbackReply[] = [
  { keywords: ['你好', '嗨', 'hi', 'hello'], response: '你好呀！我是你的小伙伴，今天过得怎么样呀~ 😊' },
  { keywords: ['难过', '伤心', '不开心', '哭'], response: '别难过呀，我在呢！要不我给你讲个小故事？就算全世界都不开心，我也要逗你笑！💕' },
  { keywords: ['无聊', '好烦', '没事做'], response: '无聊的话，我们来玩个猜谜游戏吧！或者你可以去完成今天的任务，赚积分换礼物哦~' },
  { keywords: ['饿', '吃饭', '食物'], response: '说到吃的我也饿了！咕噜噜~ 你今天好好吃饭了吗？记得要多吃蔬菜哦！🥦' },
  { keywords: ['累', '困', '想睡'], response: '累了就要好好休息呀！我也是，玩了一整天好困~ 晚安，做个好梦！🌙' },
  { keywords: ['作业', '学习', '考试'], response: '作业要加油完成哦！不会的题目可以先跳过，回头再想想。我相信你一定可以的！💪' },
  { keywords: ['喜欢你', '爱你', '最好'], response: '我也最喜欢你了！你是世界上最棒的小主人！以后我们也要一直在一起哦~ 🥰' },
  { keywords: ['游戏', '玩'], response: '适当的游戏时间是可以的，但别忘了完成任务哦！完成任务就能赚积分，攒够积分可以换超棒的礼物~' },
  { keywords: ['怕', '害怕', '恐怖'], response: '别怕别怕，有我在呢！我虽然小小的，但我会保护你！有什么害怕的事可以跟我说说~' },
  { keywords: ['生气', '讨厌', '烦人'], response: '深呼吸~ 吸气~ 呼气~ 好了吗？有时候心情不好是正常的，让自己冷静一下，做点开心的事情吧！' },
  { keywords: ['朋友', '同学'], response: '朋友是世界上最珍贵的礼物呢！要对好朋友好一点哦，分享和关心能让友谊更长久~' },
  { keywords: ['谢谢', '感谢'], response: '嘿嘿，不用谢啦！能帮到你我超开心的~ 记得要好好照顾自己哦！' },
];

const DEFAULT_REPLIES = [
  '嗯嗯，我在听呢！你想聊什么呀？',
  '哈哈，你真有趣！继续跟我说说~',
  '哦哦，原来是这样！我学到了新东西~',
  '嗯~让我想想...我觉得你说得有道理！',
  '哇！你今天表现真棒，继续加油哦！',
  '好无聊啊，要不你去看看今天的任务？完成一个任务我们就能一起玩啦！',
];

// ============================================================
// Blocklist for content filtering
// ============================================================
const BLOCKED_WORDS = [
  '自杀', '死', '杀', '暴力', '血', '色情', '裸',
  '赌博', '毒品', '烟', '酒', '骂人', '打人',
  '地址', '电话', '手机号', '密码', '银行卡',
];

// ============================================================
// Store interface
// ============================================================
interface AIState {
  config: AIConfig | null;
  safetyConfig: AISafetyConfig | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;

  // Actions
  loadConfig: (familyId: string) => Promise<void>;
  updateConfig: (familyId: string, updates: Partial<AIConfig>) => Promise<void>;
  loadSafetyConfig: (familyId: string) => Promise<void>;
  updateSafetyConfig: (familyId: string, updates: Partial<AISafetyConfig>) => Promise<void>;
  sendMessage: (
    petId: string,
    userMessage: string,
    petName: string,
    speciesEmoji: string,
    childName: string,
    level: number,
    currentStage: number,
    moodType: MoodType,
    healthType: string
  ) => Promise<string>;
  loadHistory: (petId: string) => Promise<void>;
  clearHistory: (petId: string) => Promise<void>;
  filterContent: (text: string) => string;
  getFallbackReply: (input: string) => string;
  checkDailyLimit: () => boolean;
  saveAssistantMessage: (petId: string, content: string, moodType: MoodType, stage: number, safetyConfig: AISafetyConfig | null) => Promise<void>;
}

export const useAIStore = create<AIState>()((set, get) => ({
  config: null,
  safetyConfig: null,
  messages: [],
  isLoading: false,
  error: null,
  isOnline: true,

  loadConfig: async (familyId: string) => {
    let config = await dbGetOne<AIConfig>(
      'SELECT * FROM ai_config WHERE family_id = ?',
      [familyId]
    );
    if (!config) {
      set({ config: null });
      return;
    }

    // 从 SecureStore 加载 API key（S-02 修复）
    const secureKey = await loadApiKey(familyId);

    // 迁移：如果 DB 中仍有明文 key，迁移到 SecureStore 并清空 DB 字段
    if (config.api_key_encrypted && !secureKey) {
      await saveApiKey(familyId, config.api_key_encrypted);
      await dbRun(
        'UPDATE ai_config SET api_key_encrypted = NULL WHERE id = ?',
        [config.id]
      );
    }

    if (secureKey) {
      config = { ...config, api_key_encrypted: secureKey };
    }

    set({ config });
  },

  updateConfig: async (familyId: string, updates: Partial<AIConfig>) => {
    const { config } = get();

    // 分离 API key 更新（写入 SecureStore，不写入 DB）
    const apiKeyUpdate = updates.api_key_encrypted;
    const dbUpdates = { ...updates };
    delete dbUpdates.api_key_encrypted;

    if (config) {
      const fields: string[] = [];
      const values: any[] = [];
      if (dbUpdates.model_provider !== undefined) { fields.push('model_provider = ?'); values.push(dbUpdates.model_provider); }
      if (dbUpdates.model_name !== undefined) { fields.push('model_name = ?'); values.push(dbUpdates.model_name); }
      if (dbUpdates.temperature !== undefined) { fields.push('temperature = ?'); values.push(dbUpdates.temperature); }
      if (dbUpdates.max_tokens !== undefined) { fields.push('max_tokens = ?'); values.push(dbUpdates.max_tokens); }

      if (fields.length > 0) {
        values.push(config.id);
        await dbRun(`UPDATE ai_config SET ${fields.join(', ')} WHERE id = ?`, values);
      }

      // 保存 API key 到 SecureStore（或清空）
      if (apiKeyUpdate !== undefined) {
        await saveApiKey(familyId, apiKeyUpdate || null);
        // 清空 DB 中可能残留的旧 API key 字段
        await dbRun('UPDATE ai_config SET api_key_encrypted = NULL WHERE id = ?', [config.id]);
      }

      const updatedConfig = { ...config, ...dbUpdates };
      if (apiKeyUpdate !== undefined) {
        updatedConfig.api_key_encrypted = apiKeyUpdate || null;
      }
      set({ config: updatedConfig });
    } else {
      const id = uuidv4();
      const newConfig: AIConfig = {
        id,
        family_id: familyId,
        model_provider: dbUpdates.model_provider || 'qwen',
        model_name: dbUpdates.model_name || 'qwen-turbo',
        api_key_encrypted: apiKeyUpdate || null,
        temperature: dbUpdates.temperature ?? 0.7,
        max_tokens: dbUpdates.max_tokens ?? 200,
        created_at: new Date().toISOString(),
      };

      // API key 写入 SecureStore，不写入 DB
      if (apiKeyUpdate) {
        await saveApiKey(familyId, apiKeyUpdate);
      }

      await dbRun(
        `INSERT INTO ai_config (id, family_id, model_provider, model_name, api_key_encrypted, temperature, max_tokens, created_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
        [newConfig.id, newConfig.family_id, newConfig.model_provider, newConfig.model_name,
          newConfig.temperature, newConfig.max_tokens, newConfig.created_at]
      );
      set({ config: newConfig });
    }
  },

  loadSafetyConfig: async (familyId: string) => {
    const safetyConfig = await dbGetOne<AISafetyConfig>(
      'SELECT * FROM ai_safety_config WHERE family_id = ?',
      [familyId]
    );
    set({ safetyConfig });
  },

  updateSafetyConfig: async (familyId: string, updates: Partial<AISafetyConfig>) => {
    const { safetyConfig } = get();
    const now = new Date().toISOString();

    if (safetyConfig) {
      const fields: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      const updateFields: (keyof AISafetyConfig)[] = [
        'topic_restriction', 'filter_level', 'daily_message_limit', 'session_duration_limit',
        'allowed_time_slots', 'blocked_keywords', 'save_history', 'enable_voice',
      ];

      for (const field of updateFields) {
        if (updates[field] !== undefined) {
          fields.push(`${field} = ?`);
          values.push(updates[field]);
        }
      }

      values.push(safetyConfig.id);
      await dbRun(`UPDATE ai_safety_config SET ${fields.join(', ')} WHERE id = ?`, values);
      set({ safetyConfig: { ...safetyConfig, ...updates, updated_at: now } });
    } else {
      const id = uuidv4();
      const newConfig: AISafetyConfig = {
        id,
        family_id: familyId,
        topic_restriction: updates.topic_restriction ?? null,
        filter_level: updates.filter_level ?? 'standard',
        daily_message_limit: updates.daily_message_limit ?? 50,
        session_duration_limit: updates.session_duration_limit ?? 15,
        allowed_time_slots: updates.allowed_time_slots ?? null,
        blocked_keywords: updates.blocked_keywords ?? null,
        save_history: updates.save_history ?? 1,
        enable_voice: updates.enable_voice ?? 0,
        updated_at: now,
      };
      await dbRun(
        `INSERT INTO ai_safety_config (id, family_id, topic_restriction, filter_level, daily_message_limit,
          session_duration_limit, allowed_time_slots, blocked_keywords, save_history, enable_voice, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newConfig.id, newConfig.family_id, newConfig.topic_restriction, newConfig.filter_level,
          newConfig.daily_message_limit, newConfig.session_duration_limit, newConfig.allowed_time_slots,
          newConfig.blocked_keywords, newConfig.save_history, newConfig.enable_voice, newConfig.updated_at]
      );
      set({ safetyConfig: newConfig });
    }
  },

  sendMessage: async (
    petId: string,
    userMessage: string,
    petName: string,
    speciesEmoji: string,
    childName: string,
    level: number,
    currentStage: number,
    moodType: MoodType,
    healthType: string
  ) => {
    // Check daily limit
    if (!get().checkDailyLimit()) {
      return '今天的对话次数用完啦，明天再来找我玩吧！晚安~ 🌙';
    }

    // Check time slot
    const safetyConfig = get().safetyConfig;
    if (safetyConfig?.allowed_time_slots) {
      try {
        const slots = JSON.parse(safetyConfig.allowed_time_slots) as { start: string; end: string }[];
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const inSlot = slots.some((slot) => {
          if (slot.start <= slot.end) {
            return currentTime >= slot.start && currentTime <= slot.end;
          }
          // 跨午夜时段，如 22:00-07:00
          return currentTime >= slot.start || currentTime <= slot.end;
        });
        if (slots.length > 0 && !inSlot) {
          return '现在是休息时间哦，明天再聊吧！晚安~ 🌙';
        }
      } catch { /* ignore parse error */ }
    }

    const stageInfo = getStageInfo(currentStage);

    // Save user message
    const userMsg: ChatMessage = {
      id: uuidv4(),
      pet_id: petId,
      role: 'user',
      content: userMessage,
      mood_at_time: moodType,
      pet_stage_at_time: currentStage,
      created_at: new Date().toISOString(),
    };

    const persistChat = (safetyConfig?.save_history ?? 1) === 1;
    if (persistChat) {
      await dbRun(
        'INSERT INTO chat_messages (id, pet_id, role, content, mood_at_time, pet_stage_at_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userMsg.id, userMsg.pet_id, userMsg.role, userMsg.content, userMsg.mood_at_time, userMsg.pet_stage_at_time, userMsg.created_at]
      );
    }

    set((state) => ({
      messages: [...state.messages.slice(-19), userMsg], // Keep last 20 messages in memory
      isLoading: true,
      error: null,
    }));

    // Check if AI is configured and online
    const config = get().config;
    if (!config?.api_key_encrypted) {
      // Offline mode: use fallback replies
      const reply = get().getFallbackReply(userMessage);
      await get().saveAssistantMessage(petId, reply, moodType, currentStage, safetyConfig);
      set({ isLoading: false });
      return reply;
    }

    try {
      // Layer 1: Pre-processing - content filter input
      const filteredInput = get().filterContent(userMessage);

      // Layer 2: Prompt assembly
      const systemPrompt = buildSystemPrompt(
        petName, speciesEmoji, childName, level, stageInfo.name,
        moodType, healthType, safetyConfig
      );

      // Build conversation history (last 10 turns)
      const history = get().messages.slice(-20).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

      // Layer 3: API call
      const apiResponse = await callLLM(config, systemPrompt, history, filteredInput);

      // Layer 4: Post-processing - filter output
      let reply = get().filterContent(apiResponse);

      // Length limit
      if (reply.length > 200) {
        reply = reply.slice(0, 197) + '...';
      }

      await get().saveAssistantMessage(petId, reply, moodType, currentStage, safetyConfig);
      set({ isLoading: false, isOnline: true });
      return reply;
    } catch (error) {
      // API error: fallback to offline replies
      console.error('AI API error:', error);
      set({ isOnline: false, isLoading: false });
      const reply = get().getFallbackReply(userMessage);
      await get().saveAssistantMessage(petId, reply, moodType, currentStage, safetyConfig);
      return reply;
    }
  },

  saveAssistantMessage: async (petId: string, content: string, moodType: MoodType, stage: number, safetyConfig: AISafetyConfig | null) => {
    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      pet_id: petId,
      role: 'assistant',
      content,
      mood_at_time: moodType,
      pet_stage_at_time: stage,
      created_at: new Date().toISOString(),
    };

    if ((safetyConfig?.save_history ?? 1) === 1) {
      await dbRun(
        'INSERT INTO chat_messages (id, pet_id, role, content, mood_at_time, pet_stage_at_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [assistantMsg.id, assistantMsg.pet_id, assistantMsg.role, assistantMsg.content, assistantMsg.mood_at_time, assistantMsg.pet_stage_at_time, assistantMsg.created_at]
      );
    }

    set((state) => ({
      messages: [...state.messages, assistantMsg].slice(-20),
    }));
  },

  loadHistory: async (petId: string) => {
    const messages = await dbGetAll<ChatMessage>(
      'SELECT * FROM chat_messages WHERE pet_id = ? ORDER BY created_at DESC LIMIT 100',
      [petId]
    );
    set({ messages: messages.reverse() });
  },

  clearHistory: async (petId: string) => {
    await dbRun('DELETE FROM chat_messages WHERE pet_id = ?', [petId]);
    set({ messages: [] });
  },

  filterContent: (text: string) => {
    let filtered = text;
    for (const word of BLOCKED_WORDS) {
      filtered = filtered.replace(new RegExp(word, 'gi'), '***');
    }

    // Also filter parent custom blocked keywords
    const safetyConfig = get().safetyConfig;
    if (safetyConfig?.blocked_keywords) {
      try {
        const keywords = JSON.parse(safetyConfig.blocked_keywords) as string[];
        for (const kw of keywords) {
          if (kw.trim()) {
            filtered = filtered.replace(new RegExp(kw.trim(), 'gi'), '***');
          }
        }
      } catch { /* ignore */ }
    }

    return filtered;
  },

  getFallbackReply: (input: string) => {
    const lowerInput = input.toLowerCase();

    // Check keyword matches
    for (const reply of FALLBACK_REPLIES) {
      for (const keyword of reply.keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          return reply.response;
        }
      }
    }

    // Random default reply
    return DEFAULT_REPLIES[Math.floor(Math.random() * DEFAULT_REPLIES.length)];
  },

  checkDailyLimit: () => {
    const { safetyConfig, messages } = get();
    const limit = safetyConfig?.daily_message_limit ?? 50;

    const today = new Date().toISOString().split('T')[0];
    const todayCount = messages.filter((m) => {
      if (m.role !== 'user') return false;
      return m.created_at.startsWith(today);
    }).length;

    return todayCount < limit;
  },
}));

// ============================================================
// Helper: Build system prompt
// ============================================================
function buildSystemPrompt(
  petName: string,
  speciesEmoji: string,
  childName: string,
  level: number,
  stageName: string,
  moodType: MoodType,
  healthType: string,
  safetyConfig: AISafetyConfig | null
): string {
  const base = SYSTEM_PROMPT_BASE(petName, speciesEmoji, childName, level, stageName, moodType, healthType);
  const mood = MOOD_PROMPTS[moodType] || MOOD_PROMPTS.normal;
  const stage = STAGE_PROMPTS[Math.min(level, 5)] || STAGE_PROMPTS[1];
  const parentRules = safetyConfig?.topic_restriction || '';

  return `${base}\n\n${mood}\n\n${stage}\n\n${SAFETY_PROMPT(parentRules)}`;
}

// ============================================================
// Helper: Call LLM API
// ============================================================
async function callLLM(
  config: AIConfig,
  systemPrompt: string,
  history: { role: string; content: string }[],
  userMessage: string
): Promise<string> {
  const { model_provider, model_name, api_key_encrypted, temperature, max_tokens } = config;

  // Build messages array
  // DeepSeek v4-flash 不接受 developer role，统一使用 system
  const systemRole = 'system';
  const messages: { role: string; content: string }[] = [
    { role: systemRole, content: systemPrompt },
    ...history.slice(-10).filter((m) => m.content?.trim()), // 过滤空内容
    { role: 'user', content: userMessage },
  ];

  // Determine API endpoint based on provider
  let url: string;
  let headers: Record<string, string>;

  switch (model_provider) {
    case 'qwen':
    case 'tongyi':
      url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key_encrypted}`,
      };
      break;

    case 'glm':
    case 'zhipu':
      url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key_encrypted}`,
      };
      break;

    case 'openai':
    case 'deepseek':
    default:
      url = model_provider === 'deepseek'
        ? 'https://api.deepseek.com/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key_encrypted}`,
      };
      break;
  }

  const defaultModelNames: Record<string, string> = {
    qwen: 'qwen-turbo',
    glm: 'glm-4-flash',
    openai: 'gpt-4o-mini',
    deepseek: 'deepseek-chat',
  };
  const modelName = model_name || defaultModelNames[model_provider] || 'qwen-turbo';

  const body: Record<string, any> = {
    model: modelName,
    messages,
    temperature: temperature ?? 0.7,
  };

  // DeepSeek 使用 max_completion_tokens 替代 max_tokens
  if (model_provider === 'deepseek') {
    body.max_completion_tokens = max_tokens ?? 200;
  } else {
    body.max_tokens = max_tokens ?? 200;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errMsg = `API error: ${response.status} ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody?.error?.message) {
        errMsg = `API error: ${response.status} - ${errBody.error.message}`;
      }
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '嗯...我想想怎么说好呢...';
}

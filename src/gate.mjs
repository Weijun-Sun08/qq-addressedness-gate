// 把「规则 → 判官 → 聊天」串起来，对调用方只暴露一个 handleMessage。
import { decideByRules, DEFAULT_CONFIG } from './rules.mjs';
import { createJudge } from './judge.mjs';
import { createChat } from './chat.mjs';

export function createGate(config = {}) {
  const cfg = {
    rules: { ...DEFAULT_CONFIG, ...(config.rules || {}) },
    judge: config.judge || {},
    chat: config.chat || {},
  };
  const judge = createJudge(cfg.judge);
  const chat = createChat(cfg.chat);

  // 返回 { replied, decision, reason, text }
  async function handleMessage({ text, who = '群友', ctx = [], mentioned = false, lastSpeaker = '', lastAt = 0, now = Date.now() }) {
    const ruled = decideByRules({ text, mentioned, lastSpeaker, speaker: who, lastAt, now }, cfg.rules);
    if (ruled.decision === 'skip') return { replied: false, decision: 'skip', reason: ruled.reason };
    if (ruled.decision === 'reply' && cfg.rules.trustRuleReplies) {
      // 只有显式信任规则时才跳过判官；默认仍然问一次，避免第三人称误判
    } else {
      const j = await judge.judge({ who, text, ctx });
      if (!j.reply) return { replied: false, decision: 'skip', reason: 'judge', judge: j };
    }
    let out = '';
    try {
      out = await chat.complete([
      { role: 'system', content: cfg.rules.systemPrompt || '你是一个群聊助手，用简短自然的中文回复。' },
        { role: 'user', content: (ctx.length ? ctx.join('\n') + '\n' : '') + `${who}: ${text}` },
      ]);
    } catch (err) {
      return { replied: false, decision: 'error', reason: 'chat-failed', error: String(err) };
    }
    return { replied: true, decision: 'reply', reason: ruled.reason, text: out };
  }

  return { handleMessage };
}

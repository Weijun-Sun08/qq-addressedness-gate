// 规则层：先用便宜信号挡掉大部分「明显不该接」和「明显该接」，
// 剩下的交给判官模型（judge.mjs）。规则只做保守判断，拿不准就返回 'judge'。
import { callsBotName, isNoiseOnly, isContinuation } from './text.mjs';

export const DEFAULT_CONFIG = {
  // 是否相信规则给出的「接」：默认不信，一律交给判官（2026-11-11 实验：见名字就接会掉点）
  trustRuleReplies: false,
  botNames: ['女仆酱', '小蓝'],
  continuationWindowMs: 120000,
  // 命中这些词时沉默：它们通常是在说别人或在自言自语
  skipPatterns: [
    /^(哈+|呵+|嗯+|哦+|啊+|草+|6+)$/,
    /^(晚安|早安|午安|在吗)$/,
  ],
};

export function decideByRules(input, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const {
    text = '',
    mentioned = false,
    lastSpeaker = '',
    speaker = '',
    lastAt = 0,
    now = Date.now(),
  } = input;

  if (isNoiseOnly(text)) return { decision: 'skip', reason: 'noise-only' };
  if (mentioned) return { decision: 'reply', reason: 'mentioned' };
  if (callsBotName(text, cfg.botNames)) return { decision: 'reply', reason: 'called-by-name' };

  const stripped = String(text).trim();
  if (cfg.skipPatterns.some((re) => re.test(stripped))) {
    return { decision: 'skip', reason: 'filler' };
  }
  if (isContinuation(lastSpeaker, speaker, lastAt, now, cfg.continuationWindowMs)) {
    return { decision: 'judge', reason: 'continuation' };
  }
  return { decision: 'judge', reason: 'default' };
}

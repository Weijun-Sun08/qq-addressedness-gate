// 文本归一化：规则层和判官都依赖它，保持纯函数、可单测。
export function normalizeText(text) {
  return String(text ?? '')
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 去掉 @提及 与 CQ 码，只留人说的话。
export function stripMentions(text, botNames = []) {
  let s = String(text ?? '');
  s = s.replace(/\[CQ:at,qq=\d+\]/g, '');
  s = s.replace(/@\S{1,30}/g, '');
  for (const n of botNames) {
    if (!n) continue;
    s = s.split(n).join('');
  }
  return normalizeText(s);
}

// 是否叫了机器人的名字（名字可配置，支持多个别名）。
export function callsBotName(text, botNames = []) {
  const s = normalizeText(text);
  return botNames.some((n) => n && s.includes(n));
}

// 只由标点/表情组成：不该触发回复。
export function isNoiseOnly(text) {
  const s = normalizeText(text);
  if (!s) return true;
  return !/[\u4e00-\u9fa5A-Za-z0-9]/.test(s);
}

// 续话窗口：同一个人刚说完、且间隔小于 windowMs，视为接着聊。
export function isContinuation(lastSpeaker, speaker, lastAt, now, windowMs) {
  if (!lastSpeaker || lastSpeaker !== speaker) return false;
  if (!lastAt) return false;
  return now - lastAt <= windowMs;
}

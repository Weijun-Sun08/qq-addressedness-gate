// 文本归一化：规则层和判官都依赖它，保持纯函数、可单测。
export function normalizeText(text) {
  return String(text ?? '')
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 去掉 @提及 与 CQ 码，只留人说的话。
// 注意：不要在这里删掉「裸的名字」。名字本身是「叫了机器人」的信号，
// 由 rules 用原文判断；先剥名字会把「渡子在吗」变成「在吗」，被语气词规则误杀。
export function stripMentions(text, botNames = []) {
  let s = String(text ?? '');
  // CQ 码形式的 @（没有可读名字）
  s = s.replace(/\[CQ:at,qq=\d+\]/g, '');
  // 只删「@ + 已知的机器人名字」，避免「@小蓝你好」把正文一起吃掉
  const names = [...botNames, 'bot', 'Bot'].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const n of names) {
    s = s.split('@' + n).join('');
  }
  // 别人的 @ 原样保留：判官需要看到「@的是谁」
  return normalizeText(s);
}

// 需要「去掉名字后的文本」时（比如只想看说了什么）用这个，
// 规则判断不要用它。
export function stripBotNames(text, botNames = []) {
  let s = String(text ?? '');
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

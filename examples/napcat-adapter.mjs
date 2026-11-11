// 示例：把 gate 接到 NapCat / OneBot 风格的事件循环上（2026-11-11）。
// 这里不实现 WebSocket 细节，只演示「消息进来 → 判定 → 回复」这一段怎么接。
import { createGate } from '../src/gate.mjs';

const gate = createGate({
  rules: { botNames: ['女仆酱', '小蓝'] },
  judge: { baseUrl: process.env.JUDGE_URL || 'http://127.0.0.1:11447' },
  chat: { baseUrl: process.env.CHAT_URL || 'http://127.0.0.1:11450/v1', model: process.env.CHAT_MODEL || 'local' },
});

// 由你的 WebSocket 客户端调用：
// event 形如 { user_id, group_id, raw_message, message, sender: { card, nickname } }
export async function onMessage(event, send) {
  const text = String(event.raw_message || '').trim();
  const who = event.sender?.card || event.sender?.nickname || String(event.user_id);
  const mentioned = Array.isArray(event.message)
    && event.message.some((seg) => seg.type === 'at');
  const out = await gate.handleMessage({ text, who, mentioned });
  if (out.replied) await send(out.text);
  return out;
}

// 最小可运行示例：node src/index.mjs "小蓝，在吗"
import { createGate } from './gate.mjs';

const text = process.argv.slice(2).join(' ') || '小蓝，在吗';
const gate = createGate({
  rules: { botNames: (process.env.BOT_NAMES || '女仆酱,小蓝').split(',') },
  judge: { baseUrl: process.env.JUDGE_URL || 'http://127.0.0.1:11447' },
  chat: { baseUrl: process.env.CHAT_URL || 'http://127.0.0.1:11450/v1', model: process.env.CHAT_MODEL || 'local' },
});

const out = await gate.handleMessage({ text, who: '群友' });
console.log(JSON.stringify(out, null, 2));

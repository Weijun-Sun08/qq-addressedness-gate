// 续话机制的最小示例：不连判官也能跑，直接看请求体长什么样。
// 用法：node scripts/demo-cont.mjs
import { createContTracker } from '../src/cont.mjs';

const cont = createContTracker({ windowMs: 5 * 60 * 1000, turns: 2 });

function show(title, req) {
  console.log(`\n=== ${title} ===`);
  console.log('cont =', req.cont);
  console.log('ctx  =', JSON.stringify(req.ctx, null, 2));
}

const GID = '1128058178';
const A = '1742906982';
const B = '3608660400';

// 1) 群友 A 问她一句，她回了 → 开窗口
cont.noteReply(GID, A, { theirs: '你这两天看书了吗', mine: '最近在看《伊索寓言》' });

// 2) A 接着说 → cont=true，上下文里会多出「他上一句 / 女仆酱回他」
show('同一人接着说', cont.request(GID, A, { who: 'Jeremy', text: '好看吗', ctx: ['Jeremy: 你这两天看书了吗'] }));

// 3) 另一个人插话 → 不在窗口里，cont=false
show('别人插话', cont.request(GID, B, { who: 'DDD', text: '你们在聊啥', ctx: ['Jeremy: 好看吗'] }));

// 4) 连续判否两次 → 窗口关闭，之后再说话就是普通判断
cont.consume(GID, A);
cont.consume(GID, A);
show('窗口已关（判否两次后）', cont.request(GID, A, { who: 'Jeremy', text: '算了不问了', ctx: [] }));

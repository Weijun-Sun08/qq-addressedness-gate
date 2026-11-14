// 续话（continuation）状态机：不依赖任何存储，纯内存，随进程走。
// 思路：她刚回过某个人 → 给这个人一个短窗口；窗口内他再说话，
// 判定时带上 cont=true 和「他上一句 / 她刚回的那句」，
// 让判官知道这是同一段对话的延续，而不是群里另一个人插话。
//
// 设计取舍：
//   · 只按「群 + 用户」记，不按话题，话题识别交给判官
//   · left 用完即失效：连续两次判否说明他其实在跟别人说话，别硬接
//   · 不做持久化：重启后最多丢一个窗口，代价可接受

export const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 分钟
export const DEFAULT_TURNS = 2;                 // 窗口内最多再给两次机会

function key(gid, uid) {
  return `${gid}:${uid}`;
}

export function createContTracker(options = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const turns = options.turns ?? DEFAULT_TURNS;
  const store = new Map();

  function prune(gid, uid) {
    const k = key(gid, uid);
    const rec = store.get(k);
    if (!rec) return null;
    if (Date.now() >= rec.until || rec.left <= 0) {
      store.delete(k);
      return null;
    }
    return rec;
  }

  return {
    // 她回完一句后调用：记下「他说的是什么」「她回的是什么」，开窗口
    noteReply(gid, uid, { theirs = '', mine = '' } = {}) {
      store.set(key(gid, uid), {
        until: Date.now() + windowMs,
        left: turns,
        theirs: String(theirs).slice(0, 200),
        mine: String(mine).slice(0, 200),
      });
    },

    // 判否时扣一次机会；扣完窗口自动失效
    consume(gid, uid) {
      const rec = prune(gid, uid);
      if (!rec) return false;
      rec.left -= 1;
      if (rec.left <= 0) store.delete(key(gid, uid));
      return true;
    },

    isActive(gid, uid) {
      return !!prune(gid, uid);
    },

    // 拼给判官的上下文补充（他上一句 + 她回的那句）
    pairLines(gid, uid) {
      const rec = prune(gid, uid);
      if (!rec) return [];
      const out = [];
      if (rec.theirs) out.push(`他上一句：「${rec.theirs}」`);
      if (rec.mine) out.push(`女仆酱回他：「${rec.mine}」`);
      return out;
    },

    // 直接产出判官请求体：cont=true 时判官会看到【续话标记】是
    request(gid, uid, { who = '群友', text = '', ctx = [] } = {}) {
      const rec = prune(gid, uid);
      const cont = !!rec;
      const merged = cont
        ? [
            ...ctx,
            '（提醒：这个人刚刚是在和你说话——他上一条消息你回过，这条很可能是在接着跟你说）',
            ...this.pairLines(gid, uid),
          ]
        : ctx;
      return { who, text, ctx: merged, cont };
    },

    _debug(gid, uid) {
      return prune(gid, uid);
    },
  };
}

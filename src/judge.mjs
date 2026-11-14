// 判官：把一个 HTTP 判定服务包成可替换的接口。
// 约定：POST {baseUrl}/judge  {who, text, ctx[], names?}  → {answer: "是"|"否"}
// names 可选：把这个人设自己的叫法传给判官，别人部署时不用改提示词
// 这样本地 7B（OpenVINO/llama.cpp）或云端都能接，只要实现这个契约。
const DEFAULTS = {
  baseUrl: 'http://127.0.0.1:11447',
  timeoutMs: 5000,
  // 判官不可用时：保守选择不接，避免乱插嘴
  onError: 'skip',
  // 判官接受的人设名字，例如 ['小碧','碧酱']
  names: null,
};

export function createJudge(config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  async function judge({ who = '群友', text = '', ctx = [] } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/judge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          who,
          text,
          ctx,
          // 名字随请求一起传，判官就不用写死某个人设（2026-11-14）
          ...(cfg.names ? { names: cfg.names } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`judge http ${res.status}`);
      const data = await res.json();
      const answer = String(data.answer ?? '').trim();
      if (answer === '是') return { reply: true, answer };
      if (answer === '否') return { reply: false, answer };
      throw new Error(`unexpected answer: ${answer}`);
    } catch (err) {
      if (cfg.onError === 'reply') return { reply: true, answer: '', error: String(err) };
      return { reply: false, answer: '', error: String(err) };
    } finally {
      clearTimeout(timer);
    }
  }

  return { judge };
}

// 聊天模型适配器：只依赖 OpenAI 兼容的 /chat/completions，
// 所以 llama.cpp、Ollama、vLLM、DeepSeek、OpenAI 都能直接换。
const DEFAULTS = {
  baseUrl: 'http://127.0.0.1:11450/v1',
  apiKey: '',
  model: 'local',
  temperature: 0.75,
  topP: 0.85,
  maxTokens: 160,
  timeoutMs: 60000,
};

export function createChat(config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  async function complete(messages) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
    try {
      const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: cfg.temperature,
          top_p: cfg.topP,
          max_tokens: cfg.maxTokens,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`chat http ${res.status}`);
      const data = await res.json();
      return String(data?.choices?.[0]?.message?.content ?? '').trim();
    } finally {
      clearTimeout(timer);
    }
  }

  return { complete };
}

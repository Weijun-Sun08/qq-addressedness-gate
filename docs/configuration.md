# Configuration

The gate is configured with a plain object; every field has a default so the library runs with no config file.

```js
import { createGate } from 'qq-addressedness-gate/src/gate.mjs';

createGate({
  rules: { botNames: ['女仆酱', '小蓝'] },
  judge: { baseUrl: 'http://127.0.0.1:11447' },
  chat:  { baseUrl: 'http://127.0.0.1:11450/v1', model: 'local' },
});
```

## rules

| field | default | meaning |
|---|---|---|
| `botNames` | `['女仆酱', '小蓝']` | names that count as an explicit call |
| `continuationWindowMs` | `120000` | how long the same speaker stays "in the same turn" |
| `trustRuleReplies` | `false` | when `false`, name matches still go to the judge; see `experiments/RESULTS.md` |
| `skipPatterns` | filler / greeting regexes | messages that never need a judge call |
| `systemPrompt` | a short Chinese persona line | passed to the chat model |

## judge

| field | default | meaning |
|---|---|---|
| `baseUrl` | `http://127.0.0.1:11447` | service implementing `POST /judge` |
| `timeoutMs` | `5000` | request timeout |
| `onError` | `'skip'` | what to do if the judge is down (`'skip'` or `'reply'`) |

## chat

| field | default | meaning |
|---|---|---|
| `baseUrl` | `http://127.0.0.1:11450/v1` | OpenAI-compatible endpoint (llama.cpp, Ollama, vLLM, DeepSeek, OpenAI) |
| `apiKey` | `''` | sent as `Authorization: Bearer` when non-empty |
| `model` | `'local'` | model name passed through unchanged |
| `temperature` / `topP` / `maxTokens` | `0.75` / `0.85` / `160` | sampling parameters |

Because the chat adapter only speaks `/chat/completions`, switching backends is a configuration change, not a code change.

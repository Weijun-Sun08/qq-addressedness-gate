# qq-addressedness-gate[![DOI](https://img.shields.io/badge/DOI-pending-lightgrey)](https://github.com/Weijun-Sun08/qq-addressedness-gate)

A small, dependency-free Node.js library that decides **whether a group-chat message is addressed to a bot**, and then hands the message to **any OpenAI-compatible chat model**.

The hard part of a group-chat bot is not answering — it is knowing when *not* to answer. This package isolates that decision behind a plain function so it can be tested, replaced, and reused with different chat backends.

## What it does

```
message ──► rules (mentions, bot name, filler, continuation)
              │
              ├─ skip   → stay silent
              ├─ reply  → generate
              └─ judge  → POST /judge to a small local model
                            ├─ 否 → silent
                            └─ 是 → generate
```

- **Rules** are cheap and deterministic: `@` mentions, configured bot names, punctuation-only messages, filler words, and a continuation window.
- **Judge** is an HTTP contract (`POST /judge {who, text, ctx}` → `{"answer":"是"|"否"}`). The reference deployment uses a 7B LoRA model served with OpenVINO INT4, but any service implementing the contract works.
- **Chat** is `POST /chat/completions` (OpenAI-compatible), so llama.cpp, Ollama, vLLM, DeepSeek, or OpenAI can be swapped by changing one config object.

## Install

```
git clone <this repo>
cd qq-addressedness-gate
npm test
```

There are no runtime dependencies. Node.js >= 20 is required (uses the built-in `fetch` and test runner).

## Use

```js
import { createGate } from './src/gate.mjs';

const gate = createGate({
  rules: { botNames: ['女仆酱', '小蓝'] },
  judge: { baseUrl: 'http://127.0.0.1:11447' },
  chat: { baseUrl: 'http://127.0.0.1:11450/v1', model: 'local' },
});

const out = await gate.handleMessage({
  text: '小蓝，帮我看下这段代码',
  who: '群友',
});
// { replied: true, decision: 'reply', reason: 'called-by-name', text: '...' }
```

Configuration can also be supplied through `config.example.json` (copy to `config.json`).

## Judge contract

```
POST /judge
{ "who": "群友", "text": "今天好热", "ctx": ["上一条消息", "..."] }

200 { "answer": "是" }   // addressed to the bot
200 { "answer": "否" }   // not addressed
```

If the judge is unreachable, `onError` decides the fallback (`"skip"` by default — staying silent is safer than interrupting).

## Experiments

`experiments/eval.mjs` reproduces the 574-message comparison (rules / judge / combinations). Results and latency are in `experiments/RESULTS.md`. It needs a running `/judge` service; unit tests do not.

## Tests

```
npm test
```

The suite covers text normalization, mention stripping, bot-name matching, noise detection, continuation windows, and rule decisions. It does not require a model or a network.

## Relationship to the full system

This repository is the reusable core extracted from a deployed QQ assistant. The full deployment adds persona, memory, image tagging, and a 30B generator; none of that is needed to study or reuse the addressedness gate.

## Limitations

- Rules are Chinese-centric (bot names, filler words); the judge carries most of the semantic work.
- The judge contract is binary; confidence scores are not part of the interface yet.
- No streaming; one message in, one decision out.

## License

MIT.



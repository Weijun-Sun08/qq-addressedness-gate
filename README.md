# qq-addressedness-gate

[![DOI](https://img.shields.io/badge/DOI-pending-lightgrey)](https://github.com/Weijun-Sun08/qq-addressedness-gate)

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

### Continuation (same person keeps talking)

A group has several conversations at once. When the bot has just answered someone,
that person's next message is usually the same conversation — not an interruption.
`src/cont.mjs` tracks this per `(group, user)` pair and annotates the judge request:

```js
import { createContTracker } from './src/cont.mjs';

const cont = createContTracker({ windowMs: 5 * 60 * 1000, turns: 2 });

// after the bot sends a reply
cont.noteReply(groupId, userId, { theirs: theirLine, mine: herReply });

// before calling the judge
const req = cont.request(groupId, userId, { who, text, ctx });
// req.cont === true → the judge sees 【续话标记】是 plus "he said / she replied"
const answer = await judge(req);
if (answer === '否') cont.consume(groupId, userId); // two negatives close the window
```

Run `node scripts/demo-cont.mjs` to print the request bodies for three cases
(same person continues, someone else interrupts, window already closed).
Full details: [`docs/continuation.md`](docs/continuation.md).

### Custom persona names

The reference judge was trained on one set of names, so other deployments must map
their own names consistently — both in the prompt (`names` field) and in the
context labels for the bot's own lines. `scripts/check_name_mapping.py` compares
three variants (no rename / prompt only / prompt + context labels) against a
running judge:

```
python scripts/check_name_mapping.py --url http://127.0.0.1:11447 \
    --old 女仆酱 --new 小碧 --alias 碧酱
```

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

## Wiring it into a real bot

The library only decides; you still need a bot process to receive events and send replies. `docs/integration.md` describes the three fields the gate needs, how to map them from OneBot/NapCat, Telegram, and Discord, and the common pitfalls (mentions leaking into `text`, self-messages, duplicate events, stale context).

## Reproducing the reference judge

The judge is a Qwen2.5-7B model adapted with LoRA and exported to OpenVINO INT4. The scripts to merge an adapter, export, and serve it are in `scripts/`; the full recipe (base version, merge, export flags, serving, and what can and cannot be reproduced) is in `docs/reproduce-judge.md`.

```
python scripts/merge_lora.py --base Qwen/Qwen2.5-7B-Instruct --adapter ./adapter --out ./merged
bash scripts/export_openvino.sh ./merged ./ov-int4
python scripts/judge_server.py --model ./ov-int4 --port 11447
```

`scripts/sample.jsonl` shows the record format; `scripts/sample-500.jsonl` is a 500-row anonymised convenience sample (digits, URLs, e-mails and @-mentions replaced).

## Model weights

Two packages are distributed outside the repository:

| Package | Size | Where |
|---|---|---|
| LoRA adapter (`qq-judge-lora-v1.2.zip`) | 145 MB | [GitHub Releases](https://github.com/Weijun-Sun08/qq-addressedness-gate/releases/tag/v0.1.2) / [Quark drive](https://pan.quark.cn/s/0191d4299cfd) (code `RdLM`) / [OneDrive](https://1drv.ms/f/c/79b25f680ce98041/IgB26zQ7KBO7R4d8LCxYtIqKARAkxiqC_DgEyeNhkuTMAow?e=y2y2Tb) |
| OpenVINO INT4 model (`qq-judge-ov-int4-v1.2b.7z`) | 3.8 GB | [Quark drive](https://pan.quark.cn/s/0191d4299cfd) (code `RdLM`, China) / [OneDrive](https://1drv.ms/f/c/79b25f680ce98041/IgB26zQ7KBO7R4d8LCxYtIqKARAkxiqC_DgEyeNhkuTMAow?e=y2y2Tb) |

Checksums (SHA256):

```
adapter  24653DC48E2A21286A0DBE368A5A85B705BE247CAFBA97F11BB791E1A6F84DAF
model    FD4C9E82ED2D42C2F175960AA17A007F752EF0C0B66471FB85CB74ADD8D21B24
```

Both ship with `MODEL_CARD.md` (training, evaluation, limitations). To use the adapter, run `scripts/merge_lora.py` then follow `docs/reproduce-judge.md`; to use the exported model, unpack it and run `scripts/judge_server.py --model <dir>`.

## Limitations

- Rules are Chinese-centric (bot names, filler words); the judge carries most of the semantic work.
- The judge contract is binary; confidence scores are not part of the interface yet.
- No streaming; one message in, one decision out.

## License

MIT.













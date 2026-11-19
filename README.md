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

Three packages are distributed outside the repository. They differ only in packaging and
quantisation — the judge behaviour is the same model.

| Package | Size | Best for | Where |
|---|---|---|---|
| LoRA adapter `qq-judge-lora-v2.3.zip` | 145 MB | merging into your own base, fine-tuning | [GitHub Releases](https://github.com/Weijun-Sun08/qq-addressedness-gate/releases/latest) / [Quark drive](https://pan.quark.cn/s/44ead65a8c26) (code `RpVe`) |
| GGUF Q4_K_M `qq-judge-gguf-v2.3.7z` | 4.3 GB | GPU or CPU via llama.cpp / Ollama | [Quark drive](https://pan.quark.cn/s/44ead65a8c26) (code `RpVe`) |
| GGUF Q8_0 `qq-judge-gguf-v2.3-Q8.7z` | 7.3 GB | GPU with ~8 GB VRAM, slightly better than Q4 | [Quark drive](https://pan.quark.cn/s/44ead65a8c26) (code `RpVe`) |
| OpenVINO INT4 `qq-judge-ov-int4-v2.3.7z` | 3.7 GB | CPU-only, spare VRAM for the main model | [Quark drive](https://pan.quark.cn/s/44ead65a8c26) (code `RpVe`) / [OneDrive](https://1drv.ms/f/c/79b25f680ce98041/IgBE6ppVsc6-QoqY9anjjxVGAT4SAhdMUjmEc50HkGBKOG8?e=E4lpUc) |

Want a step-by-step "download → run → call it from your bot" walkthrough? See
[`docs/judge-quickstart.md`](docs/judge-quickstart.md).

### v2.3 numbers

v2.3 is a data-quality pass over v2.2. Auditing the v2.2 training set found three problems:

- **three generations of names mixed together** — 3,741 rows told the judge the bot was
  called 萤萤, 223 said 女仆酱, 100 said 小满, while production uses 女仆酱/小蓝;
- **label imbalance** — 68% positives, which is why v2.2 over-triggered in real chats;
- **leftover annotation lines** — 192 rows still carried `（续话对象…）` / `（提醒：…）`,
  the exact lines that were proven to flip the judge's answer.

v2.3 fixes all three: one system prompt, labels at 55:45, hint lines dropped, mis-trigger
cases weighted ×3, plus 4,000 replay rows from the v3 set to prevent regression.
7,437 training rows, 1 epoch, lr 5e-5.

| Slice | v2.2 | v2.3 |
|---|---|---|
| Short follow-up (120) | 94.2% | **100%** |
| Multi-party (200) | 100% | 100% |
| Renamed persona (300) | 94.0% | **97.0%** |
| Others chatting (300) | 98.0% | 98.3% |
| Clean holdout (300) | 96.3% (8 false replies) | 96.3% (**4 false replies**) |

Overall false replies 17 → 13, missed replies 26 → 19.

Hard slices (400 each, deliberately ambiguous, generated separately):

| | v2.2 | v2.3 |
|---|---|---|
| Short follow-up | 83.8% (recall 74%) | **99.5% (recall 99.2%)** |
| Multi-party | 93.5% (recall 87%) | 92.3% (recall 84.5%) |

Both hard slices keep 100% precision — the model errs on the quiet side.

### CPU build is the reference — prefer it

The three packages are the same weights, but **the OpenVINO CPU build scores higher than the
GGUF builds**, measured on the same test sets with the same prompt:

| Build | Short follow-up | Multi-party |
|---|---|---|
| OpenVINO INT4 (CPU) | **100%** | **100%** / [OneDrive](https://1drv.ms/f/c/79b25f680ce98041/IgBE6ppVsc6-QoqY9anjjxVGAT4SAhdMUjmEc50HkGBKOG8?e=E4lpUc) |
| GGUF Q8_0 (GPU) | 85.8%\* | 99.5%\* |
| GGUF Q4_K_M (GPU) | 83.3%\* | 99.0%\* |

\* GGUF figures are from the v2.2 build; the v2.3 GGUF files are rebuilt but not re-benchmarked yet, expect the same gap.

The gap comes from the runtime, not the weights: the CPU build feeds the raw chat template and
samples a single token, while the GGUF path goes through `llama-server`'s chat API. **If you have enough RAM (about 8 GB for the model) and a CPU fast enough to judge in roughly
0.6-0.8 s, use the CPU build.** Use GGUF only when CPU time is scarce (weak CPU, or many concurrent bots) and you can accept
~10 points less on short follow-ups; Q8_0 is measurably better than Q4_K_M (+2.5 points)
and needs roughly 8 GB of VRAM.

Checksums (SHA256):

```
adapter (v2.3)   9AC695D0F04B2C61A650C19585B07E7B23A80120D69F947D73C5953A81F7B3F0
OV INT4 (v2.3)   640E3DCDFC203766A0134042D93771039BBDB542C1702A0F232C231E94BA5608
GGUF Q4 (v2.3)   56671225D5B41223E6DE3B47FFDFF4DB6A3E23140B133E9067560033700D6276
GGUF Q8 (v2.3)   421CD11CA45CDC6281801C48B431DEE5E047E09686D1B9A7CB1A2F43DCB12EE7
```

Both model packages ship with `MODEL_CARD.md` (training recipe, evaluation, limitations).

**GGUF (GPU or CPU).** Unpack, then:

```
llama-server -m qq-judge-v2.3-Q4_K_M.gguf --port 11448 --jinja -c 4096 -np 1
python scripts/judge_server_gguf.py --port 11447 --backend http://127.0.0.1:11448
```

Windows note: in PowerShell, `curl -d "{...}"` loses the quotes and Windows editors may add a
UTF-8 BOM. Write the JSON to a file first and use `curl --data-binary @body.json`; the server
already accepts BOM (decoded as `utf-8-sig`). The first request after start can take 6-8 s while
the model warms up — set the client timeout to at least 15 s.

Q4_K_M occupies about 4.4 GB of VRAM and answers a judgement in 50-100 ms on a laptop GPU.
If the main chat model already fills the GPU, use the OpenVINO build instead — it runs on
CPU at roughly 0.4-0.5 s per judgement and leaves VRAM untouched.

**OpenVINO INT4 (CPU).** Unpack; the archive already contains `judge_server.py`:

```
python judge_server.py --model . --port 11447
```

Add `--host 0.0.0.0` if the bot runs in another container or machine.

**Adapter.** Merge into Qwen2.5-7B-Instruct (or a v1.x merged base) with
`scripts/merge_lora.py`, then export and serve as above.

## Limitations

- Rules are Chinese-centric (bot names, filler words); the judge carries most of the semantic work.
- The judge contract is binary; confidence scores are not part of the interface yet.
- No streaming; one message in, one decision out.

## License

MIT.













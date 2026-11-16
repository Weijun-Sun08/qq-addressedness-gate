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
| LoRA adapter `qq-judge-lora-v2.1.zip` | 145 MB | merging into your own base, fine-tuning | [GitHub Releases](https://github.com/Weijun-Sun08/qq-addressedness-gate/releases/latest) / [Quark drive](https://pan.quark.cn/s/9877b2ac28f2) (code `L1uB`) |
| GGUF Q4_K_M `qq-judge-gguf-v2.1.7z` | 4.3 GB | GPU or CPU via llama.cpp / Ollama | [Quark drive](https://pan.quark.cn/s/9877b2ac28f2) (code `L1uB`) / [OneDrive](https://1drv.ms/f/c/79b25f680ce98041/IgBE6ppVsc6-QoqY9anjjxVGAT4SAhdMUjmEc50HkGBKOG8?e=xBd5HV) |
| OpenVINO INT4 `qq-judge-ov-int4-v2.1.7z` | 3.7 GB | CPU-only, spare VRAM for the main model | [Quark drive](https://pan.quark.cn/s/9877b2ac28f2) (code `L1uB`) |

Want a step-by-step "download → run → call it from your bot" walkthrough? See
[`docs/judge-quickstart.md`](docs/judge-quickstart.md).

### v2.1 numbers

v2.1 continues from the v2.0 merged model and adds 1,513 real "the bot just spoke, here is the
next thing someone said" turns, plus name-replacement augmentation on 53% of rows.
9,500 samples, one epoch.

Clean held-out set (660 turns whose sentences never appear in training; 60 should-reply,
600 should-not):

| Model | Accuracy | Wrong replies | Missed replies | Correct skips |
|---|---|---|---|---|
| v2.0 | 97.27% | 14 | 4 | 97.67% |
| **v2.1** | **98.48%** | **4** | 6 | **99.33%** |

The bigger 942-message set overlaps the training data at the sentence level (163 of its 167
continuation rows reuse sentences seen in training), so treat those numbers as a relative
baseline only:

| Model | Original names | Renamed persona | Continuation |
|---|---|---|---|
| v2.0 | 97.35% | 97.56% | 95.21% |
| v2.1 | 97.98% | 98.00% | 97.60% |

```
v2.1 per-slice (contaminated 942 set): context >= 4  98.12%, no context 97.85%
false replies on unrelated group chatter: v2.0 13/742, v2.1 11/742
```

Checksums (SHA256):

```
adapter (v2.1)  DD4D90891421C0569DFA5F3A4DA6F80A479B48DFEAA34F1376BF8FDE701887EF
GGUF (v2.1)     57BFF48E47E09D7F5D24EAE08E209620FE91526B74DF0D2B23345C883404EA74
OV INT4 (v2.1)  6AD54A7C5344BCA9C21B39129FB9CBAB50580C3AB1C784FBFF58ED773036D492
adapter (v2.0)  2DF6A589013D97855529FCEBC5620078D231C311F12013DDCBF72F9342D2E408
GGUF (v2.0)     CA48E6FE08ABDE7BB35678BD9328889FFAA22B708F3DA9AD3224B329F26DF72E
```

Both model packages ship with `MODEL_CARD.md` (training recipe, evaluation, limitations).

**GGUF (GPU or CPU).** Unpack, then:

```
llama-server -m qq-judge-v2.1-Q4_K_M.gguf --port 11448 --jinja -c 4096 -np 1
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













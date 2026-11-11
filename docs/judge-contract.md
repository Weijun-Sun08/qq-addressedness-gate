# Judge contract

The gate delegates ambiguous messages to a service that answers one binary question: *is this message addressed to the bot?*

## Request

```
POST /judge
Content-Type: application/json

{
  "who": "群友",
  "text": "小蓝是不是有点慢",
  "ctx": ["上一条消息", "再上一条"]
}
```

`ctx` may be empty. The gate sends at most a few recent messages.

## Response

```
200 OK
{ "answer": "是" }   // addressed to the bot → reply
{ "answer": "否" }   // not addressed     → stay silent
```

Any other value is treated as an error.

## Failure policy

| situation | behavior |
|---|---|
| non-2xx | retry is not attempted; `onError` applies |
| timeout (`timeoutMs`) | `onError` applies |
| unexpected `answer` | `onError` applies |
| `onError: 'skip'` (default) | stay silent — the safe choice for a bot that should not interrupt |
| `onError: 'reply'` | generate anyway — use only when silence is worse than a false positive |

## Reference implementation

The deployment that motivated this library serves a Qwen2.5-7B LoRA model exported to OpenVINO INT4 on CPU. Median latency is about 0.46 s per call (`experiments/RESULTS.md`).

The contract deliberately carries no model information: any process that returns `是`/`否` is a valid judge, including a cloud model, a classifier behind a small HTTP wrapper, or a test double.

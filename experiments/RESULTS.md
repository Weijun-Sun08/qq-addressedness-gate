# Reproduction results

Run:

```
node experiments/eval.mjs http://127.0.0.1:11447
```

Data: 574 held-out messages (`【接话】` rows from the validation split), each with `text`, optional `ctx`, and a human-confirmed label. The judge is the reference 7B LoRA model served over the `/judge` contract; the chat endpoint is not exercised in this experiment.

## Results

| Strategy | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| Rules only (conservative: unclear → silent) | 76.8% | 94.1% | 50.4% | 65.6% |
| Judge only | 96.5% | 99.2% | 92.9% | 95.9% |
| Rules (noise skip) + judge | 96.5% | 99.2% | 92.9% | 95.9% |
| Rules (name/@ first) + judge | 95.5% | 96.3% | 93.3% | 94.8% |

Confusion matrix, judge only: TP 234 / FP 2 / TN 320 / FN 18.

## Latency (judge call over HTTP, CPU)

| p50 | p90 | p99 | max |
|---|---|---|---|
| 463 ms | 1302 ms | 2882 ms | 3025 ms |

Cold start (first call after service start) is excluded; the warm path is the p50 above.

## Observations

- Rules alone are precise but blind: they answer explicit calls and stay silent otherwise, so recall is about 50%.
- Letting rules decide "reply" on a name match costs precision: third-person mentions ("小蓝是不是有点慢") look like calls to the rule layer. Delegating those to the judge recovers the loss.
- Rules are most useful as a cheap *skip* filter (punctuation-only messages) and as a fast path for mentions.
- The judge is conservative: 2 false positives in 574 messages, at the cost of 18 misses.

## Note on the 98.6% figure

The 98.6% accuracy reported elsewhere in this project was measured by feeding the model its training-format prompt (`【接话】…判断：`) directly. The 96.5% here is measured through the public `/judge` HTTP contract, which passes only `who`, `text`, and `ctx`. The gap is prompt-format sensitivity, not a different model.
## Design implication

Judge-only is the strongest strategy on this dataset, and the two rule-augmented variants never beat it. The library therefore defaults to `trustRuleReplies: false`: rules only short-circuit punctuation-only messages, and every other message goes to the judge. Rules remain useful as (a) a cheap pre-filter and (b) the fallback when the judge is unavailable, where staying silent is preferred.

Only 2 of the 574 validation messages are punctuation-only (0.3%), so the pre-filter saves negligible compute here; its value is on noisier production traffic.

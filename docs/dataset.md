# Evaluation data

The reproduction script expects JSONL where each line is a chat sample in the format used by the deployed assistant:

```json
{"messages": [
  {"role": "system", "content": "..."},
  {"role": "user", "content": "【接话】\n【续话标记】否\n上下文：\n...\n说话人：群友\n这句话：今天好热\n判断："},
  {"role": "assistant", "content": "否"}
]}
```

`experiments/eval.mjs` parses the `user` turn:

- text after `这句话：` and before `判断：` — the message being classified;
- lines between `上下文：` and `说话人：` — optional context, `（无）` when empty;
- last turn `是` / `否` — the label.

Rows that do not start with `【接话】` are skipped, so the same file may contain other tasks.

## Why this schema

It is the training format of the reference judge. Keeping the evaluation in the same shape makes the comparison between the model's native prompt and the `/judge` contract explicit: the script sends only `who`, `text`, and `ctx`, while the model was trained with the fuller template. The gap between the two numbers (98.6% vs 96.5%) is reported in `experiments/RESULTS.md`.

## Privacy

The public repository ships no real chat logs. The evaluation file is expected to be supplied by the user; text is processed locally and never uploaded by this code. See `README.md` for the ethical note.

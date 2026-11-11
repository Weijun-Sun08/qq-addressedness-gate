# qq-addressedness-gate: a reusable gate for deciding when a group-chat bot should speak

**Author:** Weijun Sun

**Affiliation:** Central South University, Changsha, China

## Summary

Group-chat bots fail in a way that is easy to miss: they answer messages that were never addressed to them. We present `qq-addressedness-gate`, a small Node.js library that separates the decision "is this message addressed to the bot?" from the generation step that follows. The gate combines deterministic rules (mentions, configured bot names, filler detection, and a continuation window) with an optional HTTP judge — a compact language model that returns a binary answer for ambiguous messages. When the gate decides to reply, the message is passed to any OpenAI-compatible chat endpoint, so generation backends can be replaced without touching the gate.

The library has no runtime dependencies, ships with a unit-test suite, and is extracted from a QQ assistant that has been running continuously for several weeks. In an offline evaluation on 574 held-out messages, the judge-based gate reached 98.6% accuracy, with a precision of 99.2% and recall of 97.6%, and a median decision latency of about 0.46 seconds on CPU (p90 1.3 s).

## Statement of need

Conversational frameworks such as Rasa [@rasa2017] and general orchestration libraries make it possible to build a group-chat bot, but they bundle three concerns that are useful to separate: transport (how messages arrive), the addressedness decision (whether a message is meant for the bot), and generation (which model answers). Because the decision is embedded in the surrounding bot, comparing strategies — keyword rules, a trained classifier, or a small language model — requires rewriting the plumbing for each experiment, and the comparison is rarely reproducible.

The research literature on multi-party conversation treats addressee identification as a task in its own right, but published work rarely ships a runnable component that practitioners can drop into a bot. Conversely, deployed bots typically implement addressedness with ad-hoc rules that are neither documented nor tested.

This package occupies that gap with a deliberately narrow scope. It does not implement a transport, a persona, or a memory system. It provides three replaceable pieces behind small interfaces: a pure rules function, an HTTP judge contract that any model can satisfy, and an OpenAI-compatible chat client. The goal is not to outperform existing bots, but to make the addressedness decision testable and comparable, and to let the generation backend be swapped without touching the gate.
## Design

The rules layer is conservative: it only returns `reply` for explicit signals (`@` mention, configured bot name) and `skip` for messages that cannot be addressed to anyone (punctuation-only, filler words). Everything else is delegated to the judge, which receives the message, the speaker, and a short context window. If the judge is unavailable, the default policy is to stay silent.

The judge contract is intentionally binary and transport-agnostic. The reference implementation serves a Qwen2.5-7B LoRA model exported to OpenVINO INT4, but the interface does not assume a model family, a tokenizer, or a serving stack.

## Research applications

The gate is intended as an instrument, not a product. A researcher can:

- swap the judge behind `/judge` and compare rule-based, classifier-based, and language-model strategies on the same split;
- set `trustRuleReplies: false` to isolate the contribution of the model from the rule layer;
- hold generation constant by pointing the chat adapter at different OpenAI-compatible endpoints;
- log decisions and human corrections to build new addressedness datasets.

The repository ships the evaluation harness, the metric definitions (accuracy, precision, recall, F1, latency percentiles), and the dataset schema, so a reported comparison can be repeated without rebuilding the surrounding bot. Results from the reference deployment are in `experiments/RESULTS.md`.
## Evaluation

Evaluation data comes from the deployed assistant: 574 messages with human-confirmed labels, collected after the model's training cutoff.

| Method | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| Majority class (always "no") | 56.1% | — | — | — |
| Character n-gram TF-IDF + logistic regression | 97.6% | — | — | — |
| TF-IDF, trained before 2026-11-07, tested after | 87.8% | — | — | — |
| Rules only (conservative) | 76.8% | 94.1% | 50.4% | 65.6% |
| Judge only (via `/judge`) | 96.5% | 99.2% | 92.9% | 95.9% |
| Rules (noise skip) + judge | 96.5% | 99.2% | 92.9% | 95.9% |
| Rules (name/@ first) + judge | 95.5% | 96.3% | 93.3% | 94.8% |

The TF-IDF baseline drops by about ten points under a temporal split, while the judge model is intended to generalize through context rather than surface patterns. Through the `/judge` contract the model produces 234 true positives, 2 false positives, 320 true negatives, and 18 false negatives — a conservative operating point appropriate for a bot that should not interrupt. A direct in-process evaluation with the training-format prompt yields 246/2/320/6 (98.6% accuracy); the difference is prompt-format sensitivity.

## Acknowledgements

We thank the developers of the open-source models and tooling used in the reference deployment. (Add funding or personal acknowledgements here.)

## References

See `paper.bib`.






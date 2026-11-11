// 复现实验：在 574 条接话验证集上比较 规则 / 判官 / 规则+判官（2026-11-11）。
// 用法：node experiments/eval.mjs [judgeUrl]
import fs from 'node:fs';
import path from 'node:path';
import { decideByRules, DEFAULT_CONFIG } from '../src/rules.mjs';

const JUDGE_URL = (process.argv[2] || 'http://127.0.0.1:11447').replace(/\/$/, '');
const VAL = process.env.EVAL_FILE
  || 'D:/train/data/judge-20261110-mixed/val.jsonl';

function parseRow(j) {
  const u = j.messages[1].content;
  const ctxPart = u.split('上下文：')[1]?.split('说话人：')[0]?.trim() || '';
  const ctx = ctxPart && ctxPart !== '（无）' ? ctxPart.split('\n').filter(Boolean) : [];
  const text = u.split('这句话：').pop().split('判断：')[0].trim();
  const label = j.messages[2].content.trim() === '是';
  return { text, ctx, label };
}

function metrics(rows) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    if (r.label && r.pred) tp++;
    else if (!r.label && r.pred) fp++;
    else if (!r.label && !r.pred) tn++;
    else fn++;
  }
  const n = tp + fp + tn + fn;
  const acc = (tp + tn) / n;
  const prec = tp + fp ? tp / (tp + fp) : 0;
  const rec = tp + fn ? tp / (tp + fn) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  return { n, tp, fp, tn, fn, acc, prec, rec, f1 };
}

async function callJudge({ text, ctx }) {
  const t0 = performance.now();
  const res = await fetch(`${JUDGE_URL}/judge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ who: '群友', text, ctx }),
  });
  const j = await res.json();
  const ms = performance.now() - t0;
  return { yes: String(j.answer).trim() === '是', ms };
}

const rows = fs.readFileSync(VAL, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  .filter((j) => j.messages[1].content.startsWith('【接话】'))
  .map(parseRow);
console.log('验证集', rows.length);

const cfg = { ...DEFAULT_CONFIG, botNames: ['女仆酱', '小蓝'] };
const rulesPred = rows.map((r) => {
  const d = decideByRules({ text: r.text }, cfg);
  // 规则层拿不准时按「不接」处理，这是纯规则的保守上限
  return { ...r, pred: d.decision === 'reply' };
});

const judgeRows = [];
const lat = [];
for (const r of rows) {
  const out = await callJudge(r);
  judgeRows.push({ ...r, pred: out.yes });
  lat.push(out.ms);
}

// 三种组合对照（2026-11-11）：
// A) rulesSkipOnly：规则只挡纯符号，其余全交给判官
// B) rulesFull：规则既挡纯符号也挡语气词
// C) rulesReplyFirst：规则先决定接/不接，拿不准才问判官
const noiseSkip = rows.map((r, i) => {
  const ruled = decideByRules({ text: r.text }, { ...cfg, skipPatterns: [] });
  if (ruled.decision === 'skip') return { ...r, pred: false };
  return { ...r, pred: judgeRows[i].pred };
});
const rulesFull = rows.map((r, i) => {
  const ruled = decideByRules({ text: r.text }, cfg);
  if (ruled.decision === 'skip') return { ...r, pred: false };
  if (ruled.decision === 'reply') return { ...r, pred: true };
  return { ...r, pred: judgeRows[i].pred };
});

lat.sort((a, b) => a - b);
const pct = (p) => Math.round(lat[Math.min(lat.length - 1, Math.floor(lat.length * p))]);

const out = {
  rules: metrics(rulesPred),
  judge: metrics(judgeRows),
  combinedNoise: metrics(noiseSkip),
  combinedFull: metrics(rulesFull),
  latencyMs: { p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: Math.round(lat[lat.length - 1]) },
};
console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(import.meta.dirname, '..', 'experiments', 'results.json'), JSON.stringify(out, null, 2));

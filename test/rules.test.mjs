import test from 'node:test';
import assert from 'node:assert/strict';
import { decideByRules } from '../src/rules.mjs';

const cfg = { botNames: ['小蓝'], continuationWindowMs: 120000 };

test('被 @ 直接接', () => {
  const r = decideByRules({ text: '在吗', mentioned: true }, cfg);
  assert.equal(r.decision, 'reply');
  assert.equal(r.reason, 'mentioned');
});

test('叫名字直接接', () => {
  const r = decideByRules({ text: '小蓝帮我看下', mentioned: false }, cfg);
  assert.equal(r.decision, 'reply');
});

test('纯表情不接', () => {
  const r = decideByRules({ text: '？？？' }, cfg);
  assert.equal(r.decision, 'skip');
});

test('语气词不接', () => {
  const r = decideByRules({ text: '哈哈哈哈' }, cfg);
  assert.equal(r.decision, 'skip');
});

test('普通闲聊交给判官', () => {
  const r = decideByRules({ text: '今天好热' }, cfg);
  assert.equal(r.decision, 'judge');
});

test('同一人接着说话也交给判官', () => {
  const now = 1_000_000;
  const r = decideByRules({ text: '那你说呢', lastSpeaker: 'A', speaker: 'A', lastAt: now - 1000, now }, cfg);
  assert.equal(r.decision, 'judge');
  assert.equal(r.reason, 'continuation');
});

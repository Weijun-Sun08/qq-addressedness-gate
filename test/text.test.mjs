import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, stripMentions, callsBotName, isNoiseOnly, isContinuation } from '../src/text.mjs';

test('normalizeText 去零宽字符并压缩空白', () => {
  assert.equal(normalizeText('  小蓝\u200b  在吗 '), '小蓝 在吗');
});

test('stripMentions 去掉 @ 与 CQ 码', () => {
  assert.equal(stripMentions('[CQ:at,qq=123] @小蓝 你好'), '你好');
});

test('callsBotName 支持别名', () => {
  assert.equal(callsBotName('小蓝在吗', ['女仆酱', '小蓝']), true);
  assert.equal(callsBotName('今天天气不错', ['女仆酱', '小蓝']), false);
});

test('isNoiseOnly 识别纯标点与表情', () => {
  assert.equal(isNoiseOnly('？？？'), true);
  assert.equal(isNoiseOnly('好'), false);
});

test('isContinuation 只认同一人且在窗口内', () => {
  const now = 1_000_000;
  assert.equal(isContinuation('A', 'A', now - 1000, now, 5000), true);
  assert.equal(isContinuation('A', 'B', now - 1000, now, 5000), false);
  assert.equal(isContinuation('A', 'A', now - 9000, now, 5000), false);
});

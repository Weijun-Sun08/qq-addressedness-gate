import test from 'node:test';
import assert from 'node:assert/strict';
import { stripMentions, stripBotNames } from '../src/text.mjs';
import { decideByRules } from '../src/rules.mjs';

test('只删 @ + 机器人自己的名字', () => {
  assert.equal(stripMentions('@小蓝 你好', ['小蓝']), '你好');
  assert.equal(stripMentions('@小蓝你好', ['小蓝']), '你好');
  assert.equal(stripMentions('[CQ:at,qq=123] 你好', ['小蓝']), '你好');
});

test('别人的 @ 原样保留', () => {
  assert.equal(stripMentions('@张三 你看看', ['小蓝']), '@张三 你看看');
});

test('不删裸名字', () => {
  assert.equal(stripMentions('渡子在吗', ['渡子']), '渡子在吗');
});

test('stripBotNames 才删名字，用于只取内容', () => {
  assert.equal(stripBotNames('渡子在吗', ['渡子']), '在吗');
});

test('叫了名字时直接判接话', () => {
  const r = decideByRules({ text: '渡子在吗' }, { botNames: ['渡子'] });
  assert.equal(r.decision, 'reply');
  assert.equal(r.reason, 'called-by-name');
});

test('「在吗」不再被规则直接拦，交给判官', () => {
  const r = decideByRules({ text: '在吗' }, { botNames: ['渡子'] });
  assert.equal(r.decision, 'judge');
});

test('纯语气词仍然直接跳过', () => {
  const r = decideByRules({ text: '哈哈哈' }, { botNames: ['渡子'] });
  assert.equal(r.decision, 'skip');
  assert.equal(r.reason, 'filler');
});

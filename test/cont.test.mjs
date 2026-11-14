import test from 'node:test';
import assert from 'node:assert/strict';
import { createContTracker } from '../src/cont.mjs';

test('她回过之后，同一个人的下一句带上 cont 和配对上下文', () => {
  const c = createContTracker();
  c.noteReply('g1', 'u1', { theirs: '在吗', mine: '在的' });
  const req = c.request('g1', 'u1', { who: 'A', text: '问你个事', ctx: ['A: 在吗'] });
  assert.equal(req.cont, true);
  assert.ok(req.ctx.some((l) => l.includes('他上一句')));
  assert.ok(req.ctx.some((l) => l.includes('女仆酱回他')));
});

test('别人说话不算续话', () => {
  const c = createContTracker();
  c.noteReply('g1', 'u1', { theirs: '在吗', mine: '在的' });
  const req = c.request('g1', 'u2', { who: 'B', text: '你们聊', ctx: [] });
  assert.equal(req.cont, false);
  assert.deepEqual(req.ctx, []);
});

test('判否两次后窗口关闭', () => {
  const c = createContTracker({ turns: 2 });
  c.noteReply('g1', 'u1', { theirs: 'x', mine: 'y' });
  assert.equal(c.isActive('g1', 'u1'), true);
  c.consume('g1', 'u1');
  assert.equal(c.isActive('g1', 'u1'), true);
  c.consume('g1', 'u1');
  assert.equal(c.isActive('g1', 'u1'), false);
  assert.equal(c.request('g1', 'u1', { text: 'z', ctx: [] }).cont, false);
});

test('窗口过期后不再算续话', async () => {
  const c = createContTracker({ windowMs: 20, turns: 2 });
  c.noteReply('g1', 'u1', { theirs: 'x', mine: 'y' });
  assert.equal(c.isActive('g1', 'u1'), true);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(c.isActive('g1', 'u1'), false);
});

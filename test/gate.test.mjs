import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGate } from '../src/gate.mjs';

// 起两个假服务：判官和聊天。用它们验证 gate 的串联逻辑，不依赖真实模型。
function listen(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => {
      srv.unref(); // 测试结束后别让监听句柄拖住进程
      resolve({ srv, port: srv.address().port });
    });
  });
}

test('信任规则时，被叫名字直接生成回复', async () => {
  const judge = await listen((req, res) => {
    res.writeHead(500);
    res.end();
  });
  const chat = await listen((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '在呢' } }] }));
  });
  const gate = createGate({
    rules: { botNames: ['小蓝'], trustRuleReplies: true },
    judge: { baseUrl: `http://127.0.0.1:${judge.port}` },
    chat: { baseUrl: `http://127.0.0.1:${chat.port}/v1` },
  });
  const out = await gate.handleMessage({ text: '小蓝在吗', who: '群友' });
  assert.equal(out.replied, true);
  assert.equal(out.text, '在呢');
  judge.srv.closeAllConnections(); judge.srv.close();
  chat.srv.closeAllConnections(); chat.srv.close();
});

test('判官说不接时保持沉默', async () => {
  const judge = await listen((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ answer: '否' }));
  });
  const chat = await listen((req, res) => {
    res.writeHead(500);
    res.end();
  });
  const gate = createGate({
    rules: { botNames: ['小蓝'] },
    judge: { baseUrl: `http://127.0.0.1:${judge.port}` },
    chat: { baseUrl: `http://127.0.0.1:${chat.port}/v1` },
  });
  const out = await gate.handleMessage({ text: '今天好热', who: '群友' });
  assert.equal(out.replied, false);
  judge.srv.closeAllConnections(); judge.srv.close();
  chat.srv.closeAllConnections(); chat.srv.close();
});

test('判官挂了默认沉默（不乱插嘴）', async () => {
  const gate = createGate({
    rules: { botNames: ['小蓝'] },
    judge: { baseUrl: 'http://127.0.0.1:1', timeoutMs: 300 },
  });
  const out = await gate.handleMessage({ text: '今天好热', who: '群友' });
  assert.equal(out.replied, false);
});


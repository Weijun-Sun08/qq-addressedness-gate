# 接入说明：把 gate 接进一个真实机器人

本文说明如何把 `qq-addressedness-gate` 接到一个已经在跑的机器人上。不提供完整 bot 实现，只说明接口和容易踩的坑。

## 整体形状

```
聊天平台（QQ / Telegram / Discord）
        │  事件：谁、说了什么、有没有 @
        ▼
      你的机器人进程
        │  gate.handleMessage({ text, who, mentioned, ctx })
        ▼
   ┌───────────────┐
   │ 规则 → 判官    │   （库内部完成）
   └───────────────┘
        │  replied: true / false
        ▼
   平台发送 / 什么都不做
```

## 1. 收到的消息要整理成三个字段

```js
const input = {
  text: '小蓝在吗',        // 去掉 @ 和 CQ 码后的纯文本
  who: '群友A',           // 说话人显示名，用于判官区分上下文
  mentioned: true,        // 这条消息有没有 @ 机器人
  ctx: ['上一条', '再上一条'], // 可选，最近几条上下文
};
```

要点：

```
· text 里不要带 @机器人 本身，否则规则层会把每条都当成呼唤
· who 用显示名即可，不要在文本里暴露 QQ 号
· ctx 控制在最近 3-5 条，太长会拖慢判官
```

## 2. 调用 gate

```js
import { createGate } from 'qq-addressedness-gate/src/gate.mjs';

const gate = createGate({
  rules: { botNames: ['女仆酱', '小蓝'] },
  judge: { baseUrl: 'http://127.0.0.1:11447' },
  chat:  { baseUrl: 'http://127.0.0.1:11450/v1', model: 'local' },
});

const out = await gate.handleMessage(input);
if (out.replied && out.text) {
  await sendToPlatform(out.text);
}
```

`out` 的几种情况：

```
{ replied: true,  reason: 'called-by-name' }   规则判定要接
{ replied: true,  reason: 'default' }          判官判定要接
{ replied: false, reason: 'judge' }            判官说不接
{ replied: false, reason: 'noise-only' }       纯符号，跳过
{ replied: false, reason: 'chat-failed' }      生成失败，别发
```

## 3. 发出去之前再检查一次

```
· text 为空 → 不发（库已经拦了，但你的发送函数也要兜一层）
· 超过平台长度限制 → 截断或分段
· 同一条消息不要重复处理（用 message id 去重）
```

## 4. 常见平台怎么映射

**OneBot 11 / NapCat（QQ）**

```
· 事件里取 message_id / user_id / group_id / sender.card
· @ 判断：message 数组里有 type === 'at' 的段
· 发送：调用 send_group_msg / send_private_msg
· 注意过滤自己发的消息（user_id === 机器人 QQ）
```

**Telegram**

```
· 事件里取 message_id / from.first_name / chat.id
· @ 判断：entities 里有 mention，或文本以 @botname 开头
· 发送：sendMessage
```

**Discord**

```
· message.author.bot 为 true 的直接忽略
· @ 判断：message.mentions.has(client.user)
· 发送：channel.send
```

## 5. 容易踩的坑

```
① @ 没从 text 里去掉 → 判定永远为「是」
② 机器人自己的消息没过滤 → 自己跟自己对话
③ 没去重 → 平台重发事件时重复回复
④ ctx 里混进机器人自己的话 → 判官误以为在续话
⑤ 判官服务没起就上线 → 默认沉默，看起来像「不说话」，实际是服务挂了
⑥ 一次事件触发多次回复 → 检查是否在多个地方调用了 handleMessage
```

## 6. 最小可用组合

```
判官：scripts/judge_server.py + 模型（见 docs/reproduce-judge.md）
gate：npm 安装本仓库，或直接复制 src/
机器人：你自己的 OneBot / Telegram / Discord 客户端
```

如果不想自己训判官，也可以把 `judge.baseUrl` 指向任何返回 `{"answer":"是"}` 的服务，包括一个规则脚本或云端模型。

## 7. 想更省事

```
· 先用 rules.trustRuleReplies = true 只跑规则，确认接线没问题
· 再接判官，观察日志里 reason 的分布
· 最后才接生成模型
```

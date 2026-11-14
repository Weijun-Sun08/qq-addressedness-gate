# 续话（continuation）机制

群聊里两个人可以同时说话，判官只看「这一句 + 最近几条上下文」很容易把
「同一个人接着说」误判成插话。续话机制把「她刚回过谁」显式告诉判官。

## 它做什么

```
她回了群友 A 一句
→ 记下「A 说了什么」「她回了什么」，开一个 5 分钟窗口
→ 窗口内 A 再说话：判官请求带上 cont=true，
   上下文里追加「他上一句 / 女仆酱回他」
→ 判官看到【续话标记】是，判是
→ 连续判否两次，窗口关闭（说明 A 其实在跟别人说话）
```

## 最小用法

```js
import { createContTracker } from 'qq-addressedness-gate/src/cont.mjs';

const cont = createContTracker({ windowMs: 5 * 60 * 1000, turns: 2 });

// 她发出回复之后
cont.noteReply(groupId, userId, { theirs: 对方那句, mine: 她的回复 });

// 下一条消息进来，交给判官之前
const req = cont.request(groupId, userId, { who: 昵称, text: 这句话, ctx: 最近几条 });
// req = { who, text, ctx, cont }

await judge(req);          // cont=true 时判官会看到续话提示

// 判官判「否」时扣一次机会
if (answer === '否') cont.consume(groupId, userId);
```

## 直接看效果

```bash
node scripts/demo-cont.mjs
```

输出会打印三种情况的请求体：同人续话、别人插话、窗口关闭后。

## 接口

| 方法 | 说明 |
|---|---|
| `noteReply(gid, uid, {theirs, mine})` | 她回完一句后调用，开窗口 |
| `request(gid, uid, {who, text, ctx})` | 产出判官请求体，含 `cont` |
| `consume(gid, uid)` | 判否时扣一次机会 |
| `isActive(gid, uid)` | 窗口是否还开着 |
| `pairLines(gid, uid)` | 只取「他上一句 / 女仆酱回他」两行 |

## 为什么是内存态

```
· 重启最多丢一个 5 分钟窗口，代价可接受
· 不引入存储依赖，方便别人直接拿去接自己的框架
· 需要持久化时可以自己包一层，把 store 换成 Redis
```

## 注意

- `ctx` 里别把别人的名字也换成自己 bot 的名字（判官会认不出说话人）
- 续话窗口只对「她自己回过的人」生效；群友之间的对话不会触发

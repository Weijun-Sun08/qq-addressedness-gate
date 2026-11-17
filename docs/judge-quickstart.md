> **推荐 CPU 版（OpenVINO）**：同一套测试集上，CPU 版比 GGUF 版短承接高约 10 个点（94% vs 84%），多人场景也略高。
> 前提是内存有空余（模型约 8 GB）、CPU 性能足够（判一次约 0.6-0.8 秒）。
> 如果 CPU 很忙或并发很多，才选 GGUF。

# 把判官接到你自己的 bot（5 分钟）

这个文档只讲一件事：拿到模型包之后，怎么让它回答 `/judge`，以及你的 bot 怎么调用。
不想了解原理的话，照抄命令即可。

## 1. 选一个包

| 你的情况 | 用哪个 |
|---|---|
| 有独立显卡，或不跑别的模型 | `qq-judge-gguf-v2.1.7z`（4.3 GB） |
| 同时跑 30B 之类的大模型，显存紧 | `qq-judge-ov-int4-v2.1.7z`（3.7 GB，CPU） |
| 想自己合并、继续微调 | `qq-judge-lora-v2.1.zip`（145 MB） |

下面以 GGUF 版为例。

## 2. 起服务

解压后目录里应该有 `qq-judge-v2.1-Q4_K_M.gguf`、`judge_server_gguf.py`、`README.md`。

```bash
# 后端：llama.cpp（没有的话去 llama.cpp 的 releases 下个预编译包）
llama-server -m qq-judge-v2.1-Q4_K_M.gguf --port 11448 --jinja -c 4096 -np 1

# 前端：把 OpenAI 接口包装成 /judge
python judge_server_gguf.py --port 11447 --backend http://127.0.0.1:11448
```

CPU 版（OpenVINO）只需要一条：

```bash
python scripts/judge_server.py --model ./ov-int4-v2.1 --port 11447
```

## 3. 确认能判断

```bash
curl -s http://127.0.0.1:11447/judge \
  -H 'content-type: application/json' \
  -d '{"ctx":["群友A: 小蓝在吗"],"who":"群友A","text":"你在干嘛"}'
```

期望输出 `{"answer":"是"}`。换个不该接的再试一次：

```bash
curl -s http://127.0.0.1:11447/judge \
  -H 'content-type: application/json' \
  -d '{"ctx":["群友B: 今晚开黑吗","群友C: 行啊"],"who":"群友C","text":"你们几点上"}'
```

期望 `{"answer":"否"}`。

## 4. 接到你的 bot

判官是无状态的：每条消息单独判一次，你只需要准备四个字段。

| 字段 | 含义 | 例子 |
|---|---|---|
| `who` | 说话人的昵称 | `"群友A"` |
| `text` | 这句话本身（去掉 @ 和图片标记） | `"你在干嘛"` |
| `ctx` | 最近几条群消息，带昵称前缀 | `["群友A: 小蓝在吗", "群友B: 我在"]` |
| `cont` | 可选，是否是「你刚回过的那个人接着说」 | `true` |

```python
import json, urllib.request

def should_reply(who, text, ctx, cont=False, names=None):
    body = {"who": who, "text": text, "ctx": ctx, "cont": cont}
    if names:
        body["names"] = names          # 换人设名字时传，例如 ["小碧", "碧酱"]
    req = urllib.request.Request(
        "http://127.0.0.1:11447/judge",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode()).get("answer") == "是"
    except Exception:
        return False                    # 判官挂了就别接，比乱接安全
```

## 5. 几个容易踩的坑

```
· ctx 只放最近的 6-15 条，太多会拖慢，也不一定更准
· 每条 ctx 都带「昵称: 」前缀，否则判官分不清谁在跟谁说话
· @ 标记要在传之前去掉，不然会影响判断
· 判官超时或报错时默认「不接」，不要默认「接」
· 温度设 0，只让它输出 1-2 个 token
· 换人设名字时，ctx 里她自己的发言标签也要一起换，
  只改提示词里的名字会让判官认不出说话人
```

## 6. 续话（可选但建议）

同一个人接着说话，比陌生人插话更应该接。做法是记一个短窗口：

```python
# 她回复了 A 之后
cont_note[(gid, uid)] = {"theirs": 对方那句, "mine": 她的回复, "until": now + 5*60}

# A 再说话时
hit = cont_note.get((gid, uid))
cont = bool(hit and now < hit["until"])
ctx = 最近几条 + ([f"他上一句：「{hit['theirs']}」", f"女仆酱回他：「{hit['mine']}」"] if cont else [])
```

连续两次判「否」就把窗口关掉，说明他其实在跟别人说话。

## 7. 想自己调

```
· 换名字：请求里带 names
· 换提示词：改 judge_server_gguf.py 里的 SYS
· 换模型：任何 OpenAI 兼容后端都能接，只要实现 /judge 契约
```

训练与评测细节见包里的 `MODEL_CARD.md`。

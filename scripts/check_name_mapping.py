#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对比三种「换 bot 名字」的做法，看判官输出差多少（2026-11-14）。

背景：判官（7B）是在「女仆酱 / 小蓝」这套名字上训的。
换个人设部署时，别人往往只改提示词里的名字，忘了上下文里
「女仆酱: 我在呢」这种发言标签，结果判官看到一个不认识的人在说话。

本脚本用同一批用例跑三种模式：
  A 什么都不改        —— 提示词和上下文都还是「女仆酱」
  B 只换名字表        —— 请求里传 names，但上下文标签不动
  C 名字表 + 上下文   —— 传 names，同时把上下文里她自己的标签也换掉

用法：
  python check_name_mapping.py --url http://127.0.0.1:11447 \
      --old 女仆酱 --new 小碧 --alias 碧酱

输出：每种模式的准确率、错判明细。
依赖：只用标准库。
"""
import argparse
import json
import re
import urllib.request


ORIGINAL_ALT = "小蓝"   # 训练时认识的第二个名字

# 每条用例：(上下文, 说话人, 这句话, 期望是否接话)
CASES = [
    (["{bot}: 我在呢", "群友A: 哦"], "群友A", "{name}你刚才说到哪了", True),
    (["群友A: {name}今天在吗"], "群友A", "在的话回我一下", True),
    (["群友A: {bot}帮我看个东西"], "群友A", "你看看这个图", True),
    (["群友A: {name}"], "群友A", "你今天好安静", True),
    (["群友A: {name}今天不在吧"], "群友B", "她好像出门了", False),
    (["群友B: 今晚开黑吗", "群友C: 行啊"], "群友C", "你们几点上", False),
    (["群友B: 这手机多少钱", "群友C: 六千多"], "群友C", "你买了吗", False),
    (["群友A: 这书好看", "群友B: 我也在看"], "群友B", "你看到第几章了", False),
    (["{bot}: 我在看书", "群友A: 什么书"], "群友A", "好看吗", True),
    (["群友A: 你们几个在聊啥", "群友B: 没事"], "群友A", "你说呢", False),
]


def judge(url, who, text, ctx, names=None):
    body = {"who": who, "text": text, "ctx": ctx}
    if names:
        body["names"] = names
    req = urllib.request.Request(
        url.rstrip("/") + "/judge",
        data=json.dumps(body).encode("utf-8"),
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8")).get("answer", "")


def build(bot, name, alias, mode):
    """mode: A 原样 / B 只换名字表 / C 名字表+标签"""
    ctx_out, names = [], None
    for ctx, who, text, want in CASES:
        # A 模式必须用「训练时认识的名字」，否则比的是模型认不认识新名字，不是映射方式
        use_name = name if mode in ("B", "C") else ORIGINAL_ALT
        lines = [c.format(bot=bot, name=use_name) for c in ctx]
        if mode == "C":
            # 只换「她自己的发言标签」，别人一律不动
            lines = [re.sub(rf"^{re.escape(bot)}[:：]", f"{name}:", l) for l in lines]
            names = [name, alias]
        elif mode == "B":
            names = [name, alias]
        ctx_out.append((lines, who, text.format(bot=bot, name=use_name), want))
    return ctx_out, names


def run(url, bot, name, alias):
    results = {}
    for mode, title in (("A", "什么都不改"), ("B", "只换名字表"), ("C", "名字表 + 上下文标签")):
        data, names = build(bot, name, alias, mode)
        ok = bad = 0
        errs = []
        for lines, who, text, want in data:
            ans = judge(url, who, text, lines, names)
            good = (ans == "是") == want
            ok += good
            bad += not good
            if not good:
                errs.append(f"{text} -> {ans}（期望{'是' if want else '否'}）")
        results[mode] = (title, ok, ok + bad, errs)
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:11447")
    ap.add_argument("--old", default="女仆酱", help="训练时的原名")
    ap.add_argument("--new", default="小碧", help="新的人设名字")
    ap.add_argument("--alias", default="碧酱", help="新名字的别名")
    args = ap.parse_args()

    res = run(args.url, args.old, args.new, args.alias)
    print(f"判官: {args.url}   原名: {args.old}   新名: {args.new}/{args.alias}\n")
    for mode in ("A", "B", "C"):
        title, ok, total, errs = res[mode]
        print(f"{mode} {title:16} {ok}/{total} = {ok / total:.0%}")
        for e in errs:
            print("   错判:", e)
    print("\n结论参考：C 应该最接近 A；如果 B 明显低于 C，说明问题出在上下文标签没跟着换。")


if __name__ == "__main__":
    main()

"""Reference judge service: OpenVINO INT4 + a single binary decision (2026-11-12).

HTTP contract:
    POST /judge  {"who": "...", "text": "...", "ctx": ["..."], "cont": false}
    200          {"answer": "是" | "否"}

Why this file exists: the gate only cares about the contract, but reproducing the
reported numbers requires the same prompt template. That template is kept here
verbatim so a reader can compare it with their own pipeline.

Install:
    pip install openvino-genai

Run:
    python scripts/judge_server.py --model ./ov-int4 --port 11447
"""
import argparse
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import openvino_genai as ovg

import os

# 名字可配置：别人部署时换成自己的叫法（2026-11-14）
BOT_NAMES = [n.strip() for n in os.environ.get('QQ_BOT_NAMES', '女仆酱,小蓝').split(',') if n.strip()] or ['女仆酱']


def make_sys(names):
    primary = names[0]
    aliases = '、'.join(names)
    return (
        f"你是 QQ 群聊助手，替{primary}判断一句话的听话人是不是她。\n"
        f"【接话】看上下文和这句话，判断这句话的听话人是不是{primary}：是 / 否。\n"
        "  必须先看上文最后几句是谁在跟谁说话，再判断这句的「你」指向谁。\n"
        f"  判是：直接叫她名字/{aliases}、@她、向她提问、命令她、求助她、夸她、接她话往下说。\n"
        "  同一人续话：说话人就是你刚回复过的那个人、而且他在接着刚才的话题往下说 → 判是。\n"
        "  判否：主人在跟别人讨论她或安排她、群友之间聊天接梗、第三人称说她、\n"
        "        别的机器人在说话、自言自语、纯语气词、转述别处的话。\n"
        "  拿不准时判否。\n"
        "只输出「是」或「否」。"
    )


SYS = make_sys(BOT_NAMES)

LOCK = threading.Lock()
PIPE = None


def build_prompt(who, ctx, text, cont=False, names=None):
    c = "\n".join(ctx or []) or "（无）"
    mark = "是" if cont else "否"
    user = f"【接话】\n【续话标记】{mark}\n上下文：\n{c}\n说话人：{who}\n这句话：{text}\n判断："
    extra = (
        f"\n【续话】说话人刚和{(names or BOT_NAMES)[0]}聊过、上一条就是{(names or BOT_NAMES)[0]}回的，这条是接着说的，应当判是。"
        if cont
        else ""
    )
    return (
        f"<|im_start|>system\n{SYS}{extra}<|im_end|>\n"
        f"<|im_start|>user\n{user} /no_think<|im_end|>\n"
        f"<|im_start|>assistant\n"
    )


def infer(who, ctx, text, cont):
    prompt = build_prompt(who, ctx, text, cont)
    cfg = ovg.GenerationConfig()
    # 只生成 1 个 token：多生成会出现「否否否否」，也更慢
    cfg.max_new_tokens = 1
    cfg.do_sample = False
    with LOCK:
        out = PIPE.generate(prompt, cfg)
    out = (out or "").strip()
    return "是" if "是" in out else "否"


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _send(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/health"):
            self._send({"ok": True})
        else:
            self._send({"error": "not found"}, 404)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            payload = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            if not self.path.startswith("/judge"):
                self._send({"error": "not found"}, 404)
                return
            answer = infer(
                payload.get("who") or "群友",
                payload.get("ctx") or [],
                payload.get("text") or "",
                bool(payload.get("cont")),
            )
            self._send({"answer": answer})
        except Exception as e:  # noqa: BLE001
            self._send({"error": str(e)}, 500)


def main():
    global PIPE
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=11447)
    args = ap.parse_args()

    print("loading model ...", flush=True)
    PIPE = ovg.LLMPipeline(args.model, "CPU", **{"NUM_STREAMS": "1"})
    print(f"judge ready on {args.host}:{args.port}", flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()

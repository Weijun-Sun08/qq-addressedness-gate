"""GPU 版判官服务：把 GGUF（llama-server 的 OpenAI 接口）包装成 /judge 契约（2026-11-15）。

和 judge_server.py 的区别：
  · judge_server.py 用 OpenVINO INT4，跑 CPU
  · 本脚本转发到 llama-server（GPU），接口保持一致

用法：
  1. 先起 llama-server：
     llama-server -m qq-judge-v2.0-Q4_K_M.gguf --port 11448 --jinja -c 4096
  2. 再起本服务：
     python judge_server_gguf.py --port 11447 --backend http://127.0.0.1:11448

接口：POST /judge {ctx, who, text, cont, names?} -> {"answer": "是"|"否"}
"""
import argparse
import json
import re
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SYS = (
    "你是 QQ 群聊助手，替{primary}判断一句话的听话人是不是她。\n"
    "【接话】看上下文和这句话，判断这句话的听话人是不是{primary}：是 / 否。\n"
    "  必须先看上文最后几句是谁在跟谁说话，再判断这句的「你」指向谁。\n"
    "  判是：直接叫她名字/{aliases}、@她、向她提问、命令她、求助她、夸她、接她话往下说。\n"
    "  同一人续话：说话人就是你刚回复过的那个人、而且他在接着刚才的话题往下说 → 判是。\n"
    "  判否：主人在跟别人讨论她或安排她、群友之间聊天接梗、第三人称说她、\n"
    "        别的机器人在说话、自言自语、纯语气词、转述别处的话。\n"
    "  拿不准时判否。\n"
    "只输出「是」或「否」。"
)

BACKEND = 'http://127.0.0.1:11448'


def ask(prompt, max_tokens=2):
    body = json.dumps({
        'model': 'local',
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': max_tokens, 'temperature': 0, 'stream': False,
    }).encode()
    req = urllib.request.Request(BACKEND.rstrip('/') + '/v1/chat/completions', data=body,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read().decode())
    return (j.get('choices') or [{}])[0].get('message', {}).get('content', '') or ''


def build(payload):
    names = payload.get('names') or ['女仆酱', '小蓝']
    prim = names[0]
    aliases = '、'.join(names)
    ctx = '\n'.join(payload.get('ctx') or []) or '（无）'
    mark = '是' if payload.get('cont') else '否'
    user = (f"【接话】\n【续话标记】{mark}\n上下文：\n{ctx}\n"
            f"说话人：{payload.get('who', '群友')}\n这句话：{payload.get('text', '')}\n判断：")
    return SYS.format(primary=prim, aliases=aliases) + '\n\n' + user


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def _send(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('content-type', 'application/json; charset=utf-8')
        self.send_header('content-length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith('/health'):
            return self._send({'ok': True})
        return self._send({'error': 'not found'}, 404)

    def do_POST(self):
        try:
            n = int(self.headers.get('content-length') or 0)
            payload = json.loads(self.rfile.read(n).decode() or '{}')
            if not self.path.startswith('/judge'):
                return self._send({'error': 'not found'}, 404)
            out = ask(build(payload), 2)
            ans = '是' if re.search(r'是', out[:6]) and not re.search(r'否', out[:3]) else '否'
            return self._send({'answer': ans})
        except Exception as e:
            return self._send({'error': str(e)}, 500)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=11447)
    ap.add_argument('--backend', default=BACKEND)
    args = ap.parse_args()
    BACKEND = args.backend
    srv = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'listening on http://127.0.0.1:{args.port} -> {BACKEND}', flush=True)
    srv.serve_forever()

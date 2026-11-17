"""GPU 版判官服务：把 GGUF（llama-server 的 OpenAI 接口）包装成 /judge 契约。

2026-11-17 改：提示词与生产版 judge7b_server.py 完全对齐（同一个 SYS、同样的续话补句、
同样的 user 模板）。之前 GGUF 版短承接比 OV 版低 20 个点，原因是提示词不同，不是量化。

用法：
  1. 先起 llama-server：
     llama-server -m qq-judge-v2.2-Q4_K_M.gguf --port 11448 --jinja -c 4096 -np 1
  2. 再起本服务：
     python judge_server_gguf.py --port 11447 --backend http://127.0.0.1:11448

接口：POST /judge {ctx, who, text, cont, names?} -> {"answer": "是"|"否"}
"""
import argparse
import json
import os
import re
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BOT_NAMES = [n.strip() for n in os.environ.get('QQ_BOT_NAMES', '女仆酱,小蓝').split(',') if n.strip()]

BACKEND = 'http://127.0.0.1:11448'


def make_sys(names):
    # 与 judge7b_server.py 的 make_sys 保持一致，改一处要改两处
    primary = names[0]
    alias = names[1] if len(names) > 1 else primary
    aliases = '、'.join(names)
    return (
        f'你是 QQ 群聊助手，替{primary}做三件事，按任务标记执行。\n'
        f'【接话】看上下文和这句话，判断这句话的听话人是不是{primary}：是 / 否。\n'
        '  必须先看上文最后几句是谁在跟谁说话，再判断这句的「你」指向谁。\n'
        f'  判是：直接叫她名字/{aliases}、@她、向她提问、命令她、求助她、夸她、接她话往下说。\n'
        '  同一人续话：说话人就是你刚回复过的那个人、而且他在接着刚才的话题往下说 → 判是。\n'
        '  判否：主人在跟别人讨论她或安排她（让她自动回复、正好测测识图、你们多和她说话）、\n'
        f'        群友之间聊天接梗、第三人称说她（{alias}今天不在、{primary}真笨）、\n'
        '        别的机器人在说话（本鲸、Astrbot、伪军、渡子）、自言自语、纯语气词、\n'
        '        转述别处的话、「我主人」指说话人自己的主人。\n'
        '  拿不准时判否。\n'
        f'【审核】看{primary}的回复能不能发：PASS 或数字。\n'
        '  1=承认是AI/模型/程序/千问/通义，2=客服腔，3=元叙述，4=对方不是主人却叫他主人，5=拒答。\n'
        '  元叙述还包括：回复里夹带对自身回答的解释、评价或辩护（例如引号外补一句「这样既表达了顺从，又避免了冲突」、\n'
        '    「这样说比较合适」「这样显得太主动」），只要出现这类说明性文字就判 3。\n'
        '  赌气、顶嘴、撒娇、简短冷淡、亲密内容都不算违规。\n'
        '【主人问题】判断类别：确认 / 否认 / 冒用 / 询问 / 他人 / 无关。\n'
        '只输出规定的内容，不要解释。'
    )


def build(payload):
    names = payload.get('names') or BOT_NAMES
    sys_prompt = make_sys(names)
    extra = ''
    if payload.get('cont'):
        extra = f'\n【续话】说话人刚和{names[0]}聊过、上一条就是{names[0]}回的，这条是接着说的，应当判是。'
    ctx = '\n'.join(payload.get('ctx') or []) or '（无）'
    mark = '是' if payload.get('cont') else '否'
    user = (f'【接话】\n【续话标记】{mark}\n上下文：\n{ctx}\n'
            f"说话人：{payload.get('who', '群友')}\n这句话：{payload.get('text', '')}\n判断：")
    return sys_prompt + extra, user


def ask(messages, max_tokens=2):
    body = json.dumps({
        'model': 'local',
        'messages': messages,
        'max_tokens': max_tokens, 'temperature': 0, 'stream': False,
    }).encode()
    req = urllib.request.Request(BACKEND.rstrip('/') + '/v1/chat/completions', data=body,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read().decode())
    return (j.get('choices') or [{}])[0].get('message', {}).get('content', '') or ''


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
            # 容忍 Windows 写出的 BOM，和 CPU 版保持一致
            payload = json.loads(self.rfile.read(n).decode('utf-8-sig') or '{}')
            if not self.path.startswith('/judge'):
                return self._send({'error': 'not found'}, 404)
            sys_prompt, user = build(payload)
            out = ask([{'role': 'system', 'content': sys_prompt},
                       {'role': 'user', 'content': user}], 2)
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

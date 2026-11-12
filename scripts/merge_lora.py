#!/usr/bin/env python
"""把 LoRA 适配器合并进基座，得到可导出的完整模型（2026-11-12）。

用法：
    python scripts/merge_lora.py \
        --base Qwen/Qwen2.5-7B-Instruct \
        --adapter ./adapter \
        --out ./merged

为什么单独提供脚本：适配器只有 160MB 左右，适合分发；合并是别人复现的第一步，
不同 transformers/peft 版本行为略有差异，固定成脚本比口头描述可靠。
"""
import argparse
import os

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="基座模型目录或 Hugging Face 名称")
    ap.add_argument("--adapter", required=True, help="LoRA 适配器目录")
    ap.add_argument("--out", required=True, help="合并后输出目录")
    args = ap.parse_args()

    print("loading base ...", flush=True)
    tok = AutoTokenizer.from_pretrained(args.base, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        args.base,
        torch_dtype=torch.float16,
        device_map="cpu",
        trust_remote_code=True,
    )

    print("applying adapter ...", flush=True)
    model = PeftModel.from_pretrained(model, args.adapter)
    model = model.merge_and_unload()

    os.makedirs(args.out, exist_ok=True)
    print("saving ...", flush=True)
    model.save_pretrained(args.out, safe_serialization=True)
    tok.save_pretrained(args.out)
    print("done ->", args.out)


if __name__ == "__main__":
    main()

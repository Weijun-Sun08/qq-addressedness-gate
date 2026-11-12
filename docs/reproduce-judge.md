# 复现判官模型（7B LoRA → OpenVINO INT4）

本文说明如何从公开的基座模型 + 适配器复现参考判官。默认在 Linux 或 Windows + Python 3.10+ 下操作。

## 0. 需要什么

```
· 基座：Qwen2.5-7B-Instruct（Apache 2.0）
· 适配器：约 160MB 的 LoRA 权重（随本项目发布）
· 内存：合并时约 30GB 可用
· 导出后模型：约 4.2GB（INT4）
· 推理：纯 CPU 即可，单次判定约 0.4~0.5 秒
```

## 1. 安装依赖

```
pip install torch transformers peft accelerate
pip install optimum[openvino] openvino-genai
```

## 2. 合并适配器

```
python scripts/merge_lora.py \
    --base Qwen/Qwen2.5-7B-Instruct \
    --adapter ./adapter \
    --out ./merged
```

说明：

```
· 适配器必须配同一个基座版本，换版本会掉点
· 合并后用 float16 存盘，后续量化在导出时做
```

## 3. 导出 OpenVINO INT4

```
bash scripts/export_openvino.sh ./merged ./ov-int4
```

Windows 上直接跑：

```
set PYTHONIOENCODING=utf-8
optimum-cli export openvino --model .\merged --task text-generation-with-past --weight-format int4 .\ov-int4
```

注意：

```
· --task 必须是 text-generation-with-past
  否则模型没有 beam_idx 输入，推理时报
  "Port for tensor name beam_idx was not found"
· Windows 下不设 UTF-8 会在导出时因特殊字符崩掉
```

## 4. 起服务

```
python scripts/judge_server.py --model ./ov-int4 --port 11447
```

验证：

```
curl -s http://127.0.0.1:11447/judge \
  -H "content-type: application/json" \
  -d '{"who":"群友","text":"小蓝在吗","ctx":[]}'
# {"answer":"是"}
```

## 5. 接进 gate

```
JUDGE_URL=http://127.0.0.1:11447 node src/index.mjs "小蓝在吗"
```

## 6. 复现训练（可选）

原始训练配置：

```
基座      Qwen2.5-7B-Instruct
方法      4bit QLoRA，r=16，alpha=32
target    q/k/v/o/gate/up/down
序列长度  384
batch     8
epochs    1
学习率    1e-4
数据      约 1.1 万条「接话」样本（不随仓库发布，含隐私）
```

数据格式见 `docs/dataset.md`；训练脚本因与私有数据管线耦合未直接发布，但超参与格式足以让别人用自己的数据训练。

## 7. 能复现到什么程度

```
· 方法、结构、量级可以复现（误差约 ±1~2 个点）
· 具体数字无法逐位复现：硬件、库版本、量化、随机性都会影响
· 评测数据不公开，别人的准确率只能用他们自己的数据衡量
· prompt 模板影响很大：同一模型在训练模板下 98.6%，经 /judge 契约 96.5%
```

## 8. 许可

```
· 基座 Qwen2.5-7B-Instruct：Apache 2.0
· 适配器/合并模型：随本项目以 Apache 2.0 发布，保留 Qwen 版权声明
· 训练数据（聊天记录）不发布
```

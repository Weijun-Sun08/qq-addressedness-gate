# 导出 OpenVINO INT4（2026-11-12）
# 必须用 text-generation-with-past：否则模型没有 beam_idx 输入，OpenVINO 推理会报
# "Port for tensor name beam_idx was not found"。
#
# 用法：
#   bash scripts/export_openvino.sh ./merged ./ov-int4
set -euo pipefail

MODEL_DIR="${1:-./merged}"
OUT_DIR="${2:-./ov-int4}"

# Windows 下 Python 默认 GBK，遇到 • 这类字符会崩，强制 UTF-8
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

optimum-cli export openvino \
  --model "$MODEL_DIR" \
  --task text-generation-with-past \
  --weight-format int4 \
  "$OUT_DIR"

echo "exported -> $OUT_DIR"

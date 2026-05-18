#!/usr/bin/env bash
#
# Convert a merged HF Gemma 4 checkpoint into a Q4_K_M GGUF file.
#
# Usage:
#   bash training/convert_to_gguf.sh <merged_hf_dir> <output_gguf_path>
#
# Example (Kaggle):
#   bash training/convert_to_gguf.sh \
#       /kaggle/working/outputs_clinical/merged_bf16 \
#       /kaggle/working/outputs_clinical/sobahealth-clinical-q4_k_m.gguf
#
# Pre-reqs:
#   - cmake, build-essential (Kaggle has both)
#   - ~10 GB free disk (llama.cpp build + intermediate F16 GGUF)

set -euo pipefail

MERGED_DIR="${1:?Usage: $0 <merged_hf_dir> <output_gguf_path>}"
OUT_GGUF="${2:?Usage: $0 <merged_hf_dir> <output_gguf_path>}"

WORK="$(dirname "$OUT_GGUF")"
mkdir -p "$WORK"

LLAMA_DIR="${LLAMA_CPP_DIR:-$WORK/llama.cpp}"

if [ ! -d "$LLAMA_DIR" ]; then
    echo ">>> Cloning llama.cpp into $LLAMA_DIR"
    git clone --depth 1 https://github.com/ggerganov/llama.cpp.git "$LLAMA_DIR"
fi

pushd "$LLAMA_DIR" >/dev/null

echo ">>> Installing llama.cpp python conversion deps"
pip install -q -r requirements.txt

echo ">>> Building llama-quantize (CPU build is enough for quantizing)"
if [ ! -x "build/bin/llama-quantize" ]; then
    cmake -B build -DGGML_NATIVE=OFF -DLLAMA_CURL=OFF >/dev/null
    cmake --build build --config Release --target llama-quantize -j"$(nproc)" >/dev/null
fi

popd >/dev/null

F16_GGUF="$WORK/$(basename "${OUT_GGUF%.*}")-f16.gguf"

echo ">>> Converting HF -> GGUF F16 ($F16_GGUF)"
python "$LLAMA_DIR/convert_hf_to_gguf.py" \
    "$MERGED_DIR" \
    --outfile "$F16_GGUF" \
    --outtype f16

echo ">>> Quantizing F16 -> Q4_K_M ($OUT_GGUF)"
"$LLAMA_DIR/build/bin/llama-quantize" "$F16_GGUF" "$OUT_GGUF" Q4_K_M

echo ">>> Removing intermediate F16 file to save disk"
rm -f "$F16_GGUF"

echo ">>> Done."
ls -lh "$OUT_GGUF"

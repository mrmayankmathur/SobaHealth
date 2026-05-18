#!/usr/bin/env bash
#
# Alternative installer that grafts the LoRA adapter onto Ollama's existing
# `gemma4:e2b` base instead of using the merged GGUF.
#
# Use this if `install_clinical.sh` (the full-merge path) fails because of
# Gemma 4 / Matformer GGUF conversion issues in upstream llama.cpp.
#
# Usage:
#   HF_TOKEN=hf_xxx bash training/scripts/install_clinical_adapter.sh           # fast preset
#   HF_TOKEN=hf_xxx bash training/scripts/install_clinical_adapter.sh full      # shipping preset
#
# Pre-req: `ollama pull gemma4:e2b` must already be done (it almost certainly
# is - the backend's fallback model uses it).

set -euo pipefail

PRESET="${1:-fast}"
HF_USER="${HF_USER:-themihirmathur}"
WORK_DIR="${WORK_DIR:-$HOME/.cache/sobahealth}"

if [ "$PRESET" != "fast" ] && [ "$PRESET" != "full" ]; then
    echo "ERROR: preset must be 'fast' or 'full' (got '$PRESET')" >&2
    exit 1
fi

if [ -z "${HF_TOKEN:-}" ]; then
    echo "ERROR: set HF_TOKEN env var to your hf_... token first" >&2
    exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
    echo "ERROR: ollama not found in PATH. Install from https://ollama.com" >&2
    exit 1
fi

if [ "$PRESET" = "fast" ]; then
    HF_REPO="${HF_USER}/sobahealth-clinical-fast"
    OLLAMA_TAG="${OLLAMA_TAG:-sobahealth-clinical:fast}"
else
    HF_REPO="${HF_USER}/sobahealth-clinical"
    OLLAMA_TAG="${OLLAMA_TAG:-sobahealth-clinical}"
fi

ADAPTER_DIR="$WORK_DIR/${OLLAMA_TAG//[:\/]/_}_adapter"
mkdir -p "$ADAPTER_DIR"

echo ">>> Working in $ADAPTER_DIR"
echo ">>> Preset:    $PRESET"
echo ">>> HF repo:   $HF_REPO"
echo ">>> Ollama tag:$OLLAMA_TAG"

# Verify gemma4:e2b base is available locally
if ! ollama list | grep -q "^gemma4:e2b"; then
    echo ">>> Pulling base model gemma4:e2b (one-time, ~5 GB) ..."
    ollama pull gemma4:e2b
fi

# Adapter is uploaded by the Kaggle notebook as the `adapter/` subfolder.
# Required files for Ollama's ADAPTER directive:
#   adapter_config.json + adapter_model.safetensors
# Optional but useful:
#   chat_template.jinja, tokenizer files
for FILE in adapter_config.json adapter_model.safetensors tokenizer_config.json tokenizer.json chat_template.jinja; do
    DEST="$ADAPTER_DIR/$FILE"
    if [ -f "$DEST" ]; then
        echo "    already have $FILE"
        continue
    fi
    URL="https://huggingface.co/$HF_REPO/resolve/main/adapter/$FILE"
    echo "    downloading $FILE ..."
    if ! curl -sL --fail -H "Authorization: Bearer $HF_TOKEN" -o "$DEST.tmp" "$URL"; then
        echo "    (skipping $FILE - not in repo or 404)"
        rm -f "$DEST.tmp"
        continue
    fi
    mv "$DEST.tmp" "$DEST"
done

if [ ! -f "$ADAPTER_DIR/adapter_model.safetensors" ] || [ ! -f "$ADAPTER_DIR/adapter_config.json" ]; then
    echo "ERROR: adapter_model.safetensors or adapter_config.json missing from $HF_REPO/adapter" >&2
    echo "       Check the HF repo - did the Kaggle notebook upload the adapter folder?" >&2
    exit 1
fi

# Ollama (>= 0.13) discovers adapter weights by globbing 'model*.safetensors'
# inside the ADAPTER directory; it does NOT recognise 'adapter_model.safetensors'
# even though that is what PEFT/Unsloth produce. See ollama/ollama#13314.
if [ ! -f "$ADAPTER_DIR/model.safetensors" ]; then
    cp "$ADAPTER_DIR/adapter_model.safetensors" "$ADAPTER_DIR/model.safetensors"
fi

ls -lh "$ADAPTER_DIR"

# Build a Modelfile that grafts the adapter onto gemma4:e2b
cat > "$ADAPTER_DIR/Modelfile" <<EOF
FROM gemma4:e2b
ADAPTER .

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
PARAMETER num_ctx 4096
PARAMETER stop "<end_of_turn>"
PARAMETER stop "<start_of_turn>"

SYSTEM """You are SobaHealth's clinical reasoning assistant. Answer medical
questions accurately. When discussing diagnoses, treatments, or medications,
include brief reasoning before the final answer. Never replace professional
medical care - always recommend the user see a qualified clinician for
diagnosis or treatment decisions."""
EOF

echo ""
echo ">>> Registering with Ollama as $OLLAMA_TAG ..."
echo "    (this may take a minute - Ollama is merging the adapter into the base)"
cd "$ADAPTER_DIR"
ollama create "$OLLAMA_TAG" -f Modelfile

echo ""
echo "=========================================================="
echo " Smoke test:"
echo "=========================================================="
ollama run "$OLLAMA_TAG" \
    "A 45-year-old patient presents with crushing chest pain radiating to the left arm, diaphoresis, and shortness of breath. What is the most likely diagnosis and the immediate next step?"

echo ""
echo "=========================================================="
echo " DONE. To point the SobaHealth backend at it:"
echo ""
echo "   cd $(cd "$(dirname "$0")/../.." && pwd)/backend"
echo "   export OLLAMA_MODEL=$OLLAMA_TAG"
echo "   python run.py"
echo "=========================================================="

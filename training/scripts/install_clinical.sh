#!/usr/bin/env bash
#
# One-shot installer for the SobaHealth clinical fine-tune.
#
# Downloads the GGUF from your private HF repo, registers it with Ollama
# under a `:fast` or `:full` tag, runs a smoke prompt, and prints the env
# var you need to point the backend at it.
#
# Usage:
#   HF_TOKEN=hf_xxx bash training/scripts/install_clinical.sh                  # fast preset (default)
#   HF_TOKEN=hf_xxx bash training/scripts/install_clinical.sh full             # full / shipping preset
#   HF_TOKEN=hf_xxx HF_USER=themihirmathur bash training/scripts/install_clinical.sh fast
#
# Optional env vars:
#   HF_USER     HF username (default: themihirmathur)
#   WORK_DIR    where to keep the .gguf on disk (default: ~/.cache/sobahealth)
#   OLLAMA_TAG  override the Ollama tag (default: sobahealth-clinical:<preset>)

set -euo pipefail

PRESET="${1:-fast}"
HF_USER="${HF_USER:-themihirmathur}"
WORK_DIR="${WORK_DIR:-$HOME/.cache/sobahealth}"

if [ "$PRESET" != "fast" ] && [ "$PRESET" != "full" ]; then
    echo "ERROR: preset must be 'fast' or 'full' (got '$PRESET')" >&2
    exit 1
fi

if [ -z "${HF_TOKEN:-}" ]; then
    echo "ERROR: set HF_TOKEN env var to your hf_... write token first" >&2
    echo "       (you can generate one at https://huggingface.co/settings/tokens)" >&2
    exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
    echo "ERROR: ollama not found in PATH. Install from https://ollama.com" >&2
    exit 1
fi

# Per-preset constants
if [ "$PRESET" = "fast" ]; then
    HF_REPO="${HF_USER}/sobahealth-clinical-fast"
    GGUF_NAME="sobahealth-clinical-fast-q4_k_m.gguf"
    OLLAMA_TAG="${OLLAMA_TAG:-sobahealth-clinical:fast}"
else
    HF_REPO="${HF_USER}/sobahealth-clinical"
    GGUF_NAME="sobahealth-clinical-q4_k_m.gguf"
    OLLAMA_TAG="${OLLAMA_TAG:-sobahealth-clinical}"
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MODELFILE_SRC="$REPO_ROOT/training/Modelfile.sobahealth-clinical"

if [ ! -f "$MODELFILE_SRC" ]; then
    echo "ERROR: Modelfile not found at $MODELFILE_SRC" >&2
    exit 1
fi

mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

GGUF_LOCAL="sobahealth-clinical-q4_k_m.gguf"   # what the Modelfile expects
echo ">>> Working in $WORK_DIR"
echo ">>> Preset:   $PRESET"
echo ">>> HF repo:  $HF_REPO"
echo ">>> Ollama:   $OLLAMA_TAG"

if [ -f "$GGUF_LOCAL" ]; then
    SIZE_MB=$(du -m "$GGUF_LOCAL" | cut -f1)
    echo ">>> $GGUF_LOCAL already present (${SIZE_MB} MB) - skipping download."
    echo "    Delete it manually if you want a fresh pull."
else
    echo ">>> Downloading from HF (~880 MB) ..."
    curl -L --fail \
        -H "Authorization: Bearer $HF_TOKEN" \
        -o "$GGUF_LOCAL.partial" \
        "https://huggingface.co/$HF_REPO/resolve/main/$GGUF_NAME"
    mv "$GGUF_LOCAL.partial" "$GGUF_LOCAL"
    echo ">>> Downloaded: $(du -h "$GGUF_LOCAL" | cut -f1)"
fi

cp "$MODELFILE_SRC" Modelfile

echo ">>> Registering with Ollama as $OLLAMA_TAG ..."
ollama create "$OLLAMA_TAG" -f Modelfile

echo ""
echo "=========================================================="
echo " Smoke test:"
echo "=========================================================="
ollama run "$OLLAMA_TAG" \
    "A 45-year-old patient presents with crushing chest pain radiating to the left arm, diaphoresis, and shortness of breath. What is the most likely diagnosis and the immediate next step?"

echo ""
echo "=========================================================="
echo " DONE."
echo "=========================================================="
echo ""
echo " GGUF saved at: $WORK_DIR/$GGUF_LOCAL"
echo " Ollama tag:    $OLLAMA_TAG"
echo ""
echo " To point the SobaHealth backend at it:"
echo ""
echo "   cd $REPO_ROOT/backend"
echo "   export OLLAMA_MODEL=$OLLAMA_TAG"
echo "   python run.py"
echo ""
echo " Then check  http://localhost:8000/api/health"
echo " The 'model' field should report '$OLLAMA_TAG'."
echo "=========================================================="

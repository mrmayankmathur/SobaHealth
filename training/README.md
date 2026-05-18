# SobaHealth Clinical Fine-Tune

LoRA fine-tune of **Gemma 4 E2B-it** on **MedMCQA** for medical-knowledge boost,
shipped to the existing edge server via **Ollama**. Mobile on-device path keeps
the stock Gemma 4 E2B for now (see [`FUTURE_OPTION_W.md`](./FUTURE_OPTION_W.md)
for the runtime-adapter plan).

## Published artefacts

| Artefact | Link |
|---|---|
| Fast smoke model (Q4_K_M GGUF, ~880 MB) | https://huggingface.co/themihirmathur/sobahealth-clinical-fast |
| Shipping model (Q4_K_M GGUF, ~880 MB) | https://huggingface.co/themihirmathur/sobahealth-clinical *(produced by the full preset; same repo refreshed each ship)* |
| Kaggle training notebook (forkable) | https://www.kaggle.com/code/themihirmathur/sobahealth-clinical-fine-tune-kaggle-t4 |

### Smoke run baseline (May 2026, fast preset, 1.5k MedMCQA examples)

| Metric | Base Gemma 4 E2B | Tuned | Delta |
|---|---|---|---|
| MedMCQA letter accuracy (50q) | 34.00% | 38.00% | **+4.00 pp** |
| Hindi chrF (2 prompts) | 32.70 | 30.47 | -2.23 |
| Tamil chrF (2 prompts) | 32.50 | 30.52 | -1.98 |
| Script preservation (all langs) | 100% | 100% | 0 pp |

Subject hot-spots: Pharmacology +20 pp, Pathology +25 pp, Forensic Medicine +66.67 pp. Verdict: **SHIP** (all three gates passed).

```
Kaggle T4 (free)               your Mac laptop                 mobile app
+------------------+           +-----------------+             +----------+
| QLoRA fine-tune  | --GGUF--> | ollama create   |  <--LAN-->  |  edge    |
| merge + convert  |  upload   | sobahealth-     |    fetch    |  routing |
| eval, push to HF |  to HF    | clinical        |             |  picks   |
+------------------+           +-----------------+             |  edge    |
                                                               +----------+
```

## What this fine-tune improves

| Capability | Effect |
|---|---|
| Medical factual recall (drugs, anatomy, diagnosis) | better |
| MCQ benchmark scores (MedMCQA, MedQA, USMLE-like) | better |
| Reasoning chains for clinical questions | better (training data has rationales) |
| Doctor-patient dialogue tone | unchanged (no dialogue data in MedMCQA) |
| JSON output formatting for `/symptom-check` | unchanged (already handled by backend prompts) |
| Hindi / Tamil / Telugu output | unchanged (MedMCQA is English) - eval guards against regression |

## Two presets

| `CONFIG_PATH` (in notebook cell 3) | Examples | Epochs | Total runtime | Expected MCQ delta |
|---|---|---|---|---|
| [`configs/clinical_t4_fast.yaml`](./configs/clinical_t4_fast.yaml) (default) | 1 500 | 1 | **~25 min** | +0.5 - 1.5 pp (smoke / first run) |
| [`configs/clinical_t4.yaml`](./configs/clinical_t4.yaml) | 40 000 | 2 | ~7 hours | +5 - 10 pp (shipping) |

The notebook starts on the **fast** preset so your first run completes in ~25 minutes. Use that to verify the whole pipeline works end-to-end (train -> merge -> GGUF -> eval -> HF upload), then flip the single `CONFIG_PATH` line to the full config for the shipping run.

The two presets push to **different** HF repos (`...-clinical-fast` vs `...-clinical`) so smoke runs never overwrite shipping artefacts.

## Pipeline

1. **Train** on Kaggle T4: open [`notebooks/kaggle_t4_train.ipynb`](./notebooks/kaggle_t4_train.ipynb), pick the preset in cell 3, run all cells. Produces a Q4_K_M GGUF file and pushes it to a private HF repo.
2. **Install on laptop** — one command:
   ```bash
   # fast preset (default)
   HF_TOKEN=hf_xxx bash training/scripts/install_clinical.sh
   # or full shipping preset
   HF_TOKEN=hf_xxx bash training/scripts/install_clinical.sh full
   ```
   The script downloads the GGUF, runs `ollama create`, executes a smoke prompt, and prints the env var to export.
3. **Point backend at it**: for the **full** preset there's nothing to do — [`backend/app/config.py`](../backend/app/config.py) already defaults to `sobahealth-clinical` with `gemma4:e2b` as fallback. For the **fast** preset, export `OLLAMA_MODEL=sobahealth-clinical:fast` before starting the backend so smoke runs don't clobber the shipping tag.

## Hardware

- **Train**: Kaggle T4 16 GB (free). Settings are tuned so it fits — don't bump `max_seq_length` past 1024 or `r` past 16 without checking VRAM.
- **Run**: any Mac / Linux box with 12+ GB free RAM (Ollama handles the rest).

## Files

| File | Purpose |
|---|---|
| [`configs/clinical_t4.yaml`](./configs/clinical_t4.yaml) | shipping preset (40k examples, 2 epochs, ~7 h) |
| [`configs/clinical_t4_fast.yaml`](./configs/clinical_t4_fast.yaml) | smoke preset (1.5k examples, 1 epoch, ~25 min) |
| [`data/prepare_medmcqa.py`](./data/prepare_medmcqa.py) | load MedMCQA, format as Gemma chat template, write `train.jsonl` + `eval.jsonl` |
| [`notebooks/kaggle_t4_train.ipynb`](./notebooks/kaggle_t4_train.ipynb) | end-to-end Kaggle notebook (train + merge + GGUF + upload) |
| [`merge.py`](./merge.py) | standalone CLI: adapter -> merged HF folder (run on Kaggle or locally) |
| [`convert_to_gguf.sh`](./convert_to_gguf.sh) | clones llama.cpp and quantizes to Q4_K_M |
| [`Modelfile.sobahealth-clinical`](./Modelfile.sobahealth-clinical) | for `ollama create` |
| [`eval/eval_mcq_accuracy.py`](./eval/eval_mcq_accuracy.py) | MCQ letter-match accuracy, base vs fine-tuned |
| [`eval/eval_multilingual_regression.py`](./eval/eval_multilingual_regression.py) | chrF on en/hi/ta sanity prompts |
| [`eval/eval_set_indian_languages.jsonl`](./eval/eval_set_indian_languages.jsonl) | hand-curated multilingual prompts with gold answers |
| [`eval/run_all.py`](./eval/run_all.py) | runs both evals, writes `eval_report.md` |
| [`scripts/install_clinical.sh`](./scripts/install_clinical.sh) | one-shot installer: download GGUF -> ollama create -> smoke test |

## When you re-train

Bump the suffix in the Ollama tag so you can A/B test:

```bash
ollama create sobahealth-clinical:v2 -f Modelfile.sobahealth-clinical
export OLLAMA_MODEL=sobahealth-clinical:v2   # then restart backend
```

The backend's `OLLAMA_FALLBACK_MODEL=gemma4:e2b` keeps you safe if v2 misbehaves.

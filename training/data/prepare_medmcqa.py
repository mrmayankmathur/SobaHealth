"""
Prepare MedMCQA for Gemma 4 fine-tuning.

Loads `openlifescienceai/medmcqa`, filters to examples with a non-empty
explanation, formats each as a Gemma chat-template turn pair where the model
turn contains a brief reasoning chain followed by the letter answer, then
writes:

  out_dir/train.jsonl   - ~train_count examples for SFTTrainer
  out_dir/eval.jsonl    - eval_count held-out examples scored by eval_mcq_accuracy.py

The "text" field in each line is already chat-templated, so SFTTrainer can be
configured with `dataset_text_field="text"` and no further formatting.

Run inside the Kaggle notebook:

    python training/data/prepare_medmcqa.py --config training/configs/clinical_t4.yaml
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path
from typing import Any

import yaml
from datasets import load_dataset

# MedMCQA encodes the correct option as 0..3; map to letters.
LETTERS = ["A", "B", "C", "D"]


def load_config(path: str) -> dict[str, Any]:
    with open(path, "r") as f:
        return yaml.safe_load(f)


def format_example(row: dict[str, Any]) -> str | None:
    """
    Build a Gemma chat-template string with `<start_of_turn>` markers.

    Returns None for rows we want to drop (missing fields, etc.).
    """
    question = (row.get("question") or "").strip()
    opa = (row.get("opa") or "").strip()
    opb = (row.get("opb") or "").strip()
    opc = (row.get("opc") or "").strip()
    opd = (row.get("opd") or "").strip()
    cop = row.get("cop")  # int 0..3
    exp = (row.get("exp") or "").strip()

    if not question or cop is None or cop not in (0, 1, 2, 3):
        return None
    if not (opa and opb and opc and opd):
        return None

    options = [opa, opb, opc, opd]
    answer_letter = LETTERS[int(cop)]
    answer_text = options[int(cop)]

    user_block = (
        f"Question: {question}\n\n"
        f"Options:\n"
        f"A) {opa}\n"
        f"B) {opb}\n"
        f"C) {opc}\n"
        f"D) {opd}"
    )

    if exp:
        model_block = (
            f"Reasoning: {exp}\n"
            f"Answer: {answer_letter}) {answer_text}"
        )
    else:
        model_block = f"Answer: {answer_letter}) {answer_text}"

    text = (
        f"<start_of_turn>user\n{user_block}<end_of_turn>\n"
        f"<start_of_turn>model\n{model_block}<end_of_turn>"
    )
    return text


def extract_eval_record(row: dict[str, Any]) -> dict[str, Any] | None:
    """Lighter record used by eval scripts (raw fields, not chat-templated)."""
    question = (row.get("question") or "").strip()
    cop = row.get("cop")
    if not question or cop not in (0, 1, 2, 3):
        return None
    return {
        "question": question,
        "options": {
            "A": (row.get("opa") or "").strip(),
            "B": (row.get("opb") or "").strip(),
            "C": (row.get("opc") or "").strip(),
            "D": (row.get("opd") or "").strip(),
        },
        "answer_letter": LETTERS[int(cop)],
        "explanation": (row.get("exp") or "").strip(),
        "subject": (row.get("subject_name") or "").strip(),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--config",
        required=True,
        help="Path to clinical_t4.yaml",
    )
    args = parser.parse_args()

    cfg = load_config(args.config)
    data_cfg = cfg["data"]

    out_dir = Path(data_cfg["out_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Loading {data_cfg['hf_id']} ({data_cfg['split']})...", file=sys.stderr)
    ds = load_dataset(data_cfg["hf_id"], split=data_cfg["split"])
    print(f"Loaded {len(ds)} rows", file=sys.stderr)

    if data_cfg.get("require_explanation"):
        before = len(ds)
        ds = ds.filter(lambda r: bool((r.get("exp") or "").strip()))
        print(f"With explanation: {len(ds)} (dropped {before - len(ds)})", file=sys.stderr)

    rng = random.Random(data_cfg["seed"])
    indices = list(range(len(ds)))
    rng.shuffle(indices)

    eval_count = int(data_cfg["eval_count"])
    train_count = int(data_cfg["train_count"])

    eval_indices = indices[:eval_count]
    train_indices = indices[eval_count : eval_count + train_count]

    print(
        f"Eval: {len(eval_indices)}  Train: {len(train_indices)}",
        file=sys.stderr,
    )

    # --- Train JSONL --------------------------------------------------------
    train_path = out_dir / "train.jsonl"
    n_kept = 0
    with open(train_path, "w") as f:
        for idx in train_indices:
            text = format_example(ds[idx])
            if text is None:
                continue
            f.write(json.dumps({"text": text}, ensure_ascii=False) + "\n")
            n_kept += 1
    print(f"Wrote {n_kept} train examples to {train_path}", file=sys.stderr)

    # --- Eval JSONL ---------------------------------------------------------
    eval_path = out_dir / "eval.jsonl"
    n_kept = 0
    with open(eval_path, "w") as f:
        for idx in eval_indices:
            rec = extract_eval_record(ds[idx])
            if rec is None:
                continue
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n_kept += 1
    print(f"Wrote {n_kept} eval examples to {eval_path}", file=sys.stderr)


if __name__ == "__main__":
    main()

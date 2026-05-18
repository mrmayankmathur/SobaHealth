"""
MCQ letter-match accuracy for a Gemma-style model.

Loads a HF causal LM (either the base or the merged fine-tune), runs each
question in `eval.jsonl`, parses the first capital letter (A/B/C/D) emitted by
the model, and compares against the gold letter.

Usage:

    python training/eval/eval_mcq_accuracy.py \\
        --model /kaggle/working/outputs_clinical/merged_bf16 \\
        --eval-file /kaggle/working/data/eval.jsonl \\
        --max-new-tokens 96 \\
        --out /tmp/tuned_mcq.json

Output JSON:
    {"n": 400, "correct": 271, "accuracy": 0.6775, "per_subject": {...}}
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

LETTER_RE = re.compile(r"\b([ABCD])\b")


def build_prompt(rec: dict, tokenizer) -> str:
    options = rec["options"]
    user_block = (
        f"Question: {rec['question']}\n\n"
        f"Options:\n"
        f"A) {options['A']}\n"
        f"B) {options['B']}\n"
        f"C) {options['C']}\n"
        f"D) {options['D']}\n\n"
        f"Respond with the single best letter (A, B, C, or D) and a brief reason."
    )
    messages = [{"role": "user", "content": user_block}]
    return tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )


def parse_letter(text: str) -> str | None:
    m = LETTER_RE.search(text or "")
    return m.group(1) if m else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--eval-file", required=True)
    parser.add_argument("--max-new-tokens", type=int, default=96)
    parser.add_argument("--limit", type=int, default=0, help="0 = all eval rows")
    parser.add_argument("--out", required=True, help="Write JSON results here")
    args = parser.parse_args()

    print(f"Loading tokenizer + model from {args.model} ...", file=sys.stderr)
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        torch_dtype=torch.bfloat16,
        device_map="auto",
    )
    model.eval()

    rows = []
    with open(args.eval_file) as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    if args.limit:
        rows = rows[: args.limit]
    print(f"Evaluating {len(rows)} rows ...", file=sys.stderr)

    correct = 0
    per_subject_total: dict[str, int] = defaultdict(int)
    per_subject_correct: dict[str, int] = defaultdict(int)
    misses = []

    for i, rec in enumerate(rows):
        prompt = build_prompt(rec, tokenizer)
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=args.max_new_tokens,
                do_sample=False,
                temperature=1.0,
                pad_token_id=tokenizer.eos_token_id,
            )
        gen = tokenizer.decode(
            out[0][inputs["input_ids"].shape[1]:],
            skip_special_tokens=True,
        )
        pred = parse_letter(gen)
        gold = rec["answer_letter"]
        subj = rec.get("subject", "unknown") or "unknown"

        per_subject_total[subj] += 1
        if pred == gold:
            correct += 1
            per_subject_correct[subj] += 1
        elif len(misses) < 20:
            misses.append({
                "question": rec["question"][:200],
                "gold": gold,
                "pred": pred,
                "generation": gen[:200],
            })

        if (i + 1) % 25 == 0:
            running = correct / (i + 1)
            print(f"  [{i+1}/{len(rows)}] running acc = {running:.4f}", file=sys.stderr)

    n = len(rows)
    acc = correct / n if n else 0.0

    per_subject = {
        s: {
            "n": per_subject_total[s],
            "correct": per_subject_correct[s],
            "accuracy": per_subject_correct[s] / per_subject_total[s],
        }
        for s in sorted(per_subject_total)
    }

    result = {
        "n": n,
        "correct": correct,
        "accuracy": acc,
        "per_subject": per_subject,
        "first_misses": misses,
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\nFinal: {correct}/{n} = {acc:.4f}", file=sys.stderr)
    print(f"Wrote {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()

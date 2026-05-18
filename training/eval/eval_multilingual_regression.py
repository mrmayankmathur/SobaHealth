"""
Multilingual regression check.

The clinical fine-tune is English-only (MedMCQA). This script checks that the
fine-tuned model still produces sensible Hindi / Tamil / Telugu output and
hasn't catastrophically forgotten those languages.

Two signals per prompt:
  1. chrF score vs the gold reference (sacrebleu)
  2. `script_ok`: did the model reply in the right script
                  (Devanagari for hi, Tamil for ta, Telugu for te)?

Usage:

    python training/eval/eval_multilingual_regression.py \\
        --model /kaggle/working/outputs_clinical/merged_bf16 \\
        --eval-file training/eval/eval_set_indian_languages.jsonl \\
        --max-new-tokens 220 \\
        --out /tmp/tuned_lang.json
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import torch
from sacrebleu.metrics import CHRF
from transformers import AutoModelForCausalLM, AutoTokenizer

# Unicode script ranges we care about.
SCRIPT_RANGES = {
    "en": [(0x0041, 0x007A)],                # ASCII letters
    "hi": [(0x0900, 0x097F)],                # Devanagari
    "ta": [(0x0B80, 0x0BFF)],                # Tamil
    "te": [(0x0C00, 0x0C7F)],                # Telugu
}


def is_in_script(text: str, language: str) -> bool:
    """True if at least 25% of letter-like characters are in the target script."""
    if not text:
        return False
    ranges = SCRIPT_RANGES.get(language)
    if not ranges:
        return True
    in_script = 0
    letters = 0
    for ch in text:
        cp = ord(ch)
        if ch.isalpha():
            letters += 1
            for lo, hi in ranges:
                if lo <= cp <= hi:
                    in_script += 1
                    break
    if letters == 0:
        return False
    return (in_script / letters) >= 0.25


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--eval-file", required=True)
    parser.add_argument("--max-new-tokens", type=int, default=220)
    parser.add_argument("--limit", type=int, default=0, help="0 = all eval rows")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    print(f"Loading model from {args.model} ...", file=sys.stderr)
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
        # Stratified subsample: take up to ceil(limit/num_langs) per language
        # so a small limit still gives at least one prompt per script.
        by_lang: dict[str, list[dict]] = defaultdict(list)
        for r in rows:
            by_lang[r["language"]].append(r)
        per_lang = max(1, (args.limit + len(by_lang) - 1) // len(by_lang))
        rows = []
        for lang in sorted(by_lang):
            rows.extend(by_lang[lang][:per_lang])
        rows = rows[: args.limit]
    print(f"Evaluating {len(rows)} prompts ...", file=sys.stderr)

    chrf_metric = CHRF()
    per_lang_chrf: dict[str, list[float]] = defaultdict(list)
    per_lang_script_ok: dict[str, list[int]] = defaultdict(list)
    samples = []

    for i, rec in enumerate(rows):
        messages = [{"role": "user", "content": rec["prompt"]}]
        prompt = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
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
        ).strip()

        score = chrf_metric.sentence_score(gen, [rec["reference"]]).score
        ok = is_in_script(gen, rec["language"])
        per_lang_chrf[rec["language"]].append(score)
        per_lang_script_ok[rec["language"]].append(1 if ok else 0)

        if len(samples) < 8:
            samples.append({
                "id": rec["id"],
                "language": rec["language"],
                "prompt": rec["prompt"],
                "generation": gen[:400],
                "chrf": score,
                "script_ok": ok,
            })

        if (i + 1) % 5 == 0:
            print(f"  [{i+1}/{len(rows)}] {rec['language']} chrF={score:.2f} script_ok={ok}", file=sys.stderr)

    summary = {}
    for lang in sorted(per_lang_chrf):
        chrf_vals = per_lang_chrf[lang]
        script_vals = per_lang_script_ok[lang]
        summary[lang] = {
            "n": len(chrf_vals),
            "chrf_mean": sum(chrf_vals) / len(chrf_vals),
            "script_ok_rate": sum(script_vals) / len(script_vals),
        }

    all_chrf = [s for vals in per_lang_chrf.values() for s in vals]
    overall = {
        "n": len(all_chrf),
        "chrf_mean": (sum(all_chrf) / len(all_chrf)) if all_chrf else 0.0,
    }

    result = {
        "overall": overall,
        "per_language": summary,
        "samples": samples,
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print("\nSummary:", json.dumps(summary, indent=2, ensure_ascii=False), file=sys.stderr)
    print(f"Wrote {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()

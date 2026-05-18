"""
Standalone CLI to merge a LoRA adapter into its base Gemma 4 model.

The Kaggle notebook already does this in-process via
`model.save_pretrained_merged(...)`. This script is the offline alternative:
useful if you want to re-merge from an existing adapter folder without
re-training (e.g. on a different machine, or to regenerate the merged
checkpoint after a Kaggle session timed out).

Usage:

    python training/merge.py \\
        --adapter ./outputs_clinical/adapter \\
        --base    google/gemma-4-E2b-it \\
        --out     ./outputs_clinical/merged_bf16

Requires `transformers`, `peft`, and enough RAM to load the base model in
bfloat16 (~5 GB).
"""
from __future__ import annotations

import argparse
import sys

import torch
from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True, help="Path to the saved LoRA adapter folder")
    parser.add_argument("--base", required=True, help="HF id of the base model (e.g. google/gemma-4-E2b-it)")
    parser.add_argument("--out", required=True, help="Output directory for the merged model")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"], help="Device for the merge")
    args = parser.parse_args()

    print(f"Loading adapter from {args.adapter} ...", file=sys.stderr)
    model = AutoPeftModelForCausalLM.from_pretrained(
        args.adapter,
        torch_dtype=torch.bfloat16,
        device_map=args.device,
    )

    print("Merging LoRA weights into base ...", file=sys.stderr)
    merged = model.merge_and_unload()

    print(f"Saving merged model to {args.out} ...", file=sys.stderr)
    merged.save_pretrained(args.out, safe_serialization=True)

    print("Saving tokenizer ...", file=sys.stderr)
    tokenizer = AutoTokenizer.from_pretrained(args.base)
    tokenizer.save_pretrained(args.out)

    print("Done.", file=sys.stderr)


if __name__ == "__main__":
    main()

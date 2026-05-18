"""
Runs MCQ accuracy + multilingual regression for BOTH the base and the
fine-tuned model, then writes a single Markdown report with the deltas.

This is what the Kaggle notebook calls in its eval cell.

Usage:

    python training/eval/run_all.py \\
        --config training/configs/clinical_t4.yaml \\
        --base-model google/gemma-4-E2b-it \\
        --tuned-model /kaggle/working/outputs_clinical/merged_bf16 \\
        --eval-file /kaggle/working/data/eval.jsonl \\
        --multilingual-file training/eval/eval_set_indian_languages.jsonl \\
        --out /kaggle/working/outputs_clinical/eval_report.md
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def run(cmd: list[str]) -> None:
    print(">>>", " ".join(cmd), file=sys.stderr)
    subprocess.check_call(cmd)


def load_json(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def fmt_pct(x: float) -> str:
    return f"{x*100:.2f}%"


def fmt_delta(new: float, old: float, pct: bool = True) -> str:
    diff = new - old
    sign = "+" if diff >= 0 else ""
    if pct:
        return f"{sign}{diff*100:.2f} pp"
    return f"{sign}{diff:.2f}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--base-model", required=True)
    parser.add_argument("--tuned-model", required=True)
    parser.add_argument("--eval-file", required=True)
    parser.add_argument("--multilingual-file", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--mcq-limit", type=int, default=0,
                        help="Cap MCQ rows for both base and tuned runs (0 = all)")
    parser.add_argument("--lang-limit", type=int, default=0,
                        help="Cap multilingual rows for both base and tuned runs (0 = all)")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    mcq_script = str(script_dir / "eval_mcq_accuracy.py")
    lang_script = str(script_dir / "eval_multilingual_regression.py")

    with tempfile.TemporaryDirectory() as tmp:
        base_mcq  = f"{tmp}/base_mcq.json"
        tuned_mcq = f"{tmp}/tuned_mcq.json"
        base_lang  = f"{tmp}/base_lang.json"
        tuned_lang = f"{tmp}/tuned_lang.json"

        run([sys.executable, mcq_script,
             "--model", args.base_model,
             "--eval-file", args.eval_file,
             "--limit", str(args.mcq_limit),
             "--out", base_mcq])

        run([sys.executable, mcq_script,
             "--model", args.tuned_model,
             "--eval-file", args.eval_file,
             "--limit", str(args.mcq_limit),
             "--out", tuned_mcq])

        run([sys.executable, lang_script,
             "--model", args.base_model,
             "--eval-file", args.multilingual_file,
             "--limit", str(args.lang_limit),
             "--out", base_lang])

        run([sys.executable, lang_script,
             "--model", args.tuned_model,
             "--eval-file", args.multilingual_file,
             "--limit", str(args.lang_limit),
             "--out", tuned_lang])

        b_mcq = load_json(base_mcq)
        t_mcq = load_json(tuned_mcq)
        b_lang = load_json(base_lang)
        t_lang = load_json(tuned_lang)

    lines: list[str] = []
    lines.append("# SobaHealth Clinical Fine-Tune - Eval Report\n")
    lines.append(f"- Base model: `{args.base_model}`")
    lines.append(f"- Tuned model: `{args.tuned_model}`")
    lines.append(f"- MCQ eval set: `{args.eval_file}` ({b_mcq['n']} questions)")
    lines.append(f"- Multilingual eval set: `{args.multilingual_file}` ({b_lang['overall']['n']} prompts)\n")

    # --- MCQ summary --------------------------------------------------------
    lines.append("## MedMCQA letter-match accuracy\n")
    lines.append("| Model | Correct / Total | Accuracy |")
    lines.append("|---|---|---|")
    lines.append(f"| base | {b_mcq['correct']}/{b_mcq['n']} | {fmt_pct(b_mcq['accuracy'])} |")
    lines.append(f"| tuned | {t_mcq['correct']}/{t_mcq['n']} | {fmt_pct(t_mcq['accuracy'])} |")
    lines.append(f"| **delta** |  | **{fmt_delta(t_mcq['accuracy'], b_mcq['accuracy'])}** |\n")

    # --- Per-subject delta (top 10 by example count) ------------------------
    subs = sorted(
        b_mcq.get("per_subject", {}).items(),
        key=lambda kv: -kv[1]["n"],
    )[:10]
    if subs:
        lines.append("### Top subjects (by question count)\n")
        lines.append("| Subject | n | base | tuned | delta |")
        lines.append("|---|---|---|---|---|")
        for subj, b_stats in subs:
            t_stats = t_mcq.get("per_subject", {}).get(subj, {"accuracy": 0.0, "n": 0})
            lines.append(
                f"| {subj} | {b_stats['n']} | "
                f"{fmt_pct(b_stats['accuracy'])} | "
                f"{fmt_pct(t_stats.get('accuracy', 0.0))} | "
                f"{fmt_delta(t_stats.get('accuracy', 0.0), b_stats['accuracy'])} |"
            )
        lines.append("")

    # --- Multilingual regression --------------------------------------------
    lines.append("## Multilingual regression (chrF vs reference, script preservation)\n")
    lines.append("Higher chrF = closer to reference. `script_ok` = generation stays in the prompt's script (Devanagari / Tamil / Telugu).\n")
    lines.append("| Language | n | base chrF | tuned chrF | chrF delta | base script | tuned script | script delta |")
    lines.append("|---|---|---|---|---|---|---|---|")
    langs = sorted(set(b_lang["per_language"]) | set(t_lang["per_language"]))
    for lang in langs:
        b = b_lang["per_language"].get(lang, {"n": 0, "chrf_mean": 0.0, "script_ok_rate": 0.0})
        t = t_lang["per_language"].get(lang, {"n": 0, "chrf_mean": 0.0, "script_ok_rate": 0.0})
        lines.append(
            f"| {lang} | {b['n']} | "
            f"{b['chrf_mean']:.2f} | {t['chrf_mean']:.2f} | "
            f"{fmt_delta(t['chrf_mean'], b['chrf_mean'], pct=False)} | "
            f"{fmt_pct(b['script_ok_rate'])} | {fmt_pct(t['script_ok_rate'])} | "
            f"{fmt_delta(t['script_ok_rate'], b['script_ok_rate'])} |"
        )

    # --- Sanity samples -----------------------------------------------------
    lines.append("\n## Sample generations (tuned)\n")
    for s in t_lang.get("samples", [])[:5]:
        lines.append(f"**[{s['language']} | chrF={s['chrf']:.2f} | script_ok={s['script_ok']}]** {s['prompt']}\n")
        lines.append(f"> {s['generation']}\n")

    # --- Pass/fail gate -----------------------------------------------------
    mcq_gain = t_mcq["accuracy"] - b_mcq["accuracy"]
    worst_chrf_drop = 0.0
    worst_script_drop = 0.0
    for lang in langs:
        b = b_lang["per_language"].get(lang, {"chrf_mean": 0.0, "script_ok_rate": 0.0})
        t = t_lang["per_language"].get(lang, {"chrf_mean": 0.0, "script_ok_rate": 0.0})
        worst_chrf_drop = min(worst_chrf_drop, t["chrf_mean"] - b["chrf_mean"])
        worst_script_drop = min(worst_script_drop, t["script_ok_rate"] - b["script_ok_rate"])

    mcq_ok = mcq_gain >= 0.03               # at least +3 pp on MedMCQA
    lang_chrf_ok = worst_chrf_drop >= -5.0  # no language drops chrF more than 5 points
    lang_script_ok = worst_script_drop >= -0.20  # script preserved within 20 pp

    lines.append("\n## Ship/no-ship gate\n")
    lines.append(f"- MCQ gain >= +3 pp: **{'PASS' if mcq_ok else 'FAIL'}** ({fmt_delta(t_mcq['accuracy'], b_mcq['accuracy'])})")
    lines.append(f"- Worst-language chrF drop >= -5: **{'PASS' if lang_chrf_ok else 'FAIL'}** ({worst_chrf_drop:.2f})")
    lines.append(f"- Worst-language script_ok drop >= -20 pp: **{'PASS' if lang_script_ok else 'FAIL'}** ({worst_script_drop*100:.2f} pp)\n")
    verdict = "SHIP" if (mcq_ok and lang_chrf_ok and lang_script_ok) else "DO NOT SHIP"
    lines.append(f"### Verdict: **{verdict}**\n")

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w") as f:
        f.write("\n".join(lines))

    print(f"\nWrote {args.out}", file=sys.stderr)
    print(f"Verdict: {verdict}", file=sys.stderr)


if __name__ == "__main__":
    main()

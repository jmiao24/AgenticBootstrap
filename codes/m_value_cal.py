#!/usr/bin/env python3
"""Estimate the m-value (multiverse value) via Agentic Bootstrap.

The m-value of a reported claim is the probability that an analysis path drawn
from the analysis-space distribution produces a result at least as extreme as
the reported one. Here that distribution is estimated empirically by pooling
every candidate specification the agents logged across all rounds, runs, and
personas (results_r*.csv). For a claim t0 and pooled statistics T_1..T_K:

    m(t0) = 2 * min( mean(T_k <= t0), mean(T_k >= t0) )    (two-sided, capped at 1)

A small m-value flags a claim that sits in the tail of the defensible analysis
space rather than near its center.

Usage:
    # m-value of a specific reported effect against the reference distribution
    python codes/m_value_cal.py <results_dir> --claim -0.35

    # on the Z scale instead of the raw effect
    python codes/m_value_cal.py <results_dir> --claim -12.2 --stat z

    # no --claim: summarize the reference and score each run's final result
    python codes/m_value_cal.py <results_dir>
"""
import csv, glob, os, sys, argparse, statistics as st
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _csvutil import num, pick, final_row, EST, SE

def stat_of(row, kind):
    est, se = num(pick(row, EST)), num(pick(row, SE))
    if kind == "z":
        if se == se and se > 0:
            return est / se
        return float("nan")
    return est

def read_specs(files):
    # QC (as in the paper): keep specs with a finite estimate and a finite,
    # positive standard error; drop degenerate models. Return BOTH scales.
    est_vals, z_vals = [], []
    for f in files:
        try:
            with open(f) as fh:
                rows = list(csv.DictReader(fh))
            for row in rows:
                est, se = num(pick(row, EST)), num(pick(row, SE))
                if not (est == est and se == se and se > 0):
                    continue
                est_vals.append(est)
                z_vals.append(est / se)
        except Exception:
            continue
    return {"estimate": est_vals, "z": z_vals}

def m_value(t0, ref):
    n = len(ref)
    below = sum(1 for t in ref if t <= t0) / n
    above = sum(1 for t in ref if t >= t0) / n
    return min(1.0, 2 * min(below, above))

def percentile_sorted(s, q):
    if not s: return float("nan")
    i = q / 100 * (len(s) - 1)
    lo, hi = int(i), min(int(i) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (i - lo)

def main():
    ap = argparse.ArgumentParser(description="Estimate m-values via Agentic Bootstrap.")
    ap.add_argument("results_dir", nargs="?", default="./results")
    ap.add_argument("--claim", type=float, default=None,
                    help="reported claim value; prints its m-value against the reference")
    ap.add_argument("--stat", choices=["estimate", "z"], default="estimate",
                    help="statistic to build the reference on (default: estimate)")
    args = ap.parse_args()

    # Reference distribution = all logged candidate specs (every round), on
    # BOTH the effect-size and Z-score scales.
    ref_files = glob.glob(os.path.join(args.results_dir, "*", "run_*", "results_r*.csv"))
    ref = read_specs(ref_files)
    if len(ref["estimate"]) < 20:
        print(f"Only {len(ref['estimate'])} candidate specs found under {args.results_dir} "
              f"(need results_r*.csv). Reference too small.")
        sys.exit(1)

    print(f"Reference distribution: K={len(ref['estimate'])} specs (QC: finite estimate & positive SE)")
    for scale in ("estimate", "z"):
        s = sorted(ref[scale])
        lo, hi = percentile_sorted(s, 2.5), percentile_sorted(s, 97.5)
        print(f"  [{scale:8}] median={st.median(s):+.5g}   95% Agentic Bootstrap interval=[{lo:+.5g}, {hi:+.5g}]")

    if args.claim is not None:
        m = m_value(args.claim, ref[args.stat])
        print(f"\nClaim {args.claim:+.5g} on the {args.stat} scale  ->  m-value = {m:.4f}")
        print(f"  (as extreme as the most extreme {m*100:.1f}% of the analysis space)")
        return

    # No claim: score each run's final result against the reference, both scales.
    fin_files = sorted(glob.glob(os.path.join(args.results_dir, "*", "run_*", "results_final.csv")))
    if not fin_files:
        return
    print(f"\nm-value of each run's final result (both scales):")
    print(f"{'persona':20} {'run':7} {'estimate':>11} {'m(est)':>8} {'Z':>9} {'m(Z)':>8}")
    print("-" * 66)
    for f in fin_files:
        parts = f.split(os.sep)
        persona, run = parts[-3], parts[-2]
        with open(f) as fh:
            d = final_row(list(csv.DictReader(fh)))
        if d is None: continue
        e = stat_of(d, "estimate")
        z = stat_of(d, "z")
        if e != e: continue
        me = m_value(e, ref["estimate"])
        mz = m_value(z, ref["z"]) if z == z else float("nan")
        print(f"{persona:20} {run:7} {e:11.5g} {me:8.4f} {z:9.4g} {mz:8.4f}")

if __name__ == "__main__":
    main()

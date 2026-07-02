#!/usr/bin/env python3
"""Aggregate agentic_bootstrap final results into a per-persona summary.

Reads every <results_dir>/<persona>/run_*/results_final.csv and reports, per
persona, the distribution of the reported effect estimate (mean / median, sign
split, how many are significant), plus the gap between personas.

Usage:
    python codes/aggregate.py [results_dir]     # default: ./results
"""
import csv, glob, os, sys, statistics as st
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _csvutil import num, pick, finite, final_row, EST, SE, PV

def load_finals(results_dir):
    rows = []
    pat = os.path.join(results_dir, "*", "run_*", "results_final.csv")
    for f in sorted(glob.glob(pat)):
        parts = f.split(os.sep)
        persona, run = parts[-3], parts[-2]
        try:
            with open(f) as fh:
                recs = list(csv.DictReader(fh))
        except Exception:
            continue
        d = final_row(recs)
        if d is None:
            continue
        rows.append(dict(persona=persona, run=run,
                         est=num(pick(d, EST)), se=num(pick(d, SE)), p=num(pick(d, PV))))
    return rows

def main():
    results_dir = sys.argv[1] if len(sys.argv) > 1 else "./results"
    rows = load_finals(results_dir)
    if not rows:
        print(f"No results_final.csv found under {results_dir}")
        sys.exit(1)

    print(f"{'persona':20} {'run':7} {'estimate':>12} {'se':>10} {'p':>10}")
    print("-" * 62)
    for r in rows:
        print(f"{r['persona']:20} {r['run']:7} {r['est']:12.5g} {r['se']:10.4g} {r['p']:10.4g}")

    print("\nPer-persona summary")
    print("-" * 62)
    personas = sorted(set(r["persona"] for r in rows))
    means = {}
    for p in personas:
        g = [r for r in rows if r["persona"] == p]
        est = finite([r["est"] for r in g])
        if not est:
            continue
        pos = sum(1 for e in est if e > 0)
        neg = sum(1 for e in est if e < 0)
        sig = sum(1 for r in g if r["p"] == r["p"] and r["p"] < 0.05)
        means[p] = st.mean(est)
        print(f"{p:20} n={len(g):<3} finite={len(est):<3} mean={st.mean(est):+.5g}  "
              f"median={st.median(est):+.5g}  pos/neg={pos}/{neg}  p<0.05: {sig}/{len(g)}")

    names = sorted(means)
    if len(names) >= 2:
        print("\nGap in mean estimate")
        print("-" * 62)
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                a, b = names[i], names[j]
                print(f"  {a} - {b}:  {means[a] - means[b]:+.5g}")

if __name__ == "__main__":
    main()

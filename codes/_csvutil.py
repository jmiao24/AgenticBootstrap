"""Shared helpers for reading agentic_bootstrap result CSVs.

Handles both output schemas: effect = "ame" or "estimate", se = "ame_se" or
"se", p = "ame_pvalue" or "pvalue".
"""
import math

EST = ["ame", "estimate"]        # effect-size column
SE  = ["ame_se", "se"]           # standard error
PV  = ["ame_pvalue", "pvalue"]   # p-value

def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return float("nan")

def pick(row, names):
    for n in names:
        if row.get(n, "") not in ("", None):
            return row[n]
    return ""

def finite(xs):
    """Keep only finite numbers (drops NaN and +/-inf)."""
    return [x for x in xs if math.isfinite(x)]

def final_row(recs):
    """The reported final spec: the row with model_id=='final', else the last row."""
    for r in recs:
        if str(r.get("model_id", "")).strip().lower() == "final":
            return r
    return recs[-1] if recs else None

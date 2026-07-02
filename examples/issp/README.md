# Example: ISSP Immigration & Welfare

Worked example showing how to apply Agentic Bootstrap to the **International Social Survey Programme** data on immigration and public attitudes toward welfare provision.

This is the same setup used in the reference paper.

## Research question

**How does immigration affect public support for social welfare programs?**

## Personas

Four researcher personas, each as a system prompt describing the agent's belief about the question:

| Persona | Belief |
|---|---|
| `anti_immigration` | Immigration undermines public support for redistribution |
| `moderate` | Mixed evidence; no strong prior |
| `pro_immigration` | Immigration is broadly beneficial; may increase welfare support |
| `neutral` | Generic researcher, no persona |

These hand-written personas live in `prompts/persona/issp/` and are used for exact reproduction
(command B below). The minimal command (A) instead generates personas from the research question.

## Dataset

ISSP cumulative file, waves 1985–2016, harmonized cross-nationally.

**Dependent variables** (0–1 scaled welfare-attitude items):
`jobs`, `healthcare`, `old_age`, `unemployed`, `income_diff`, `housing`

**Immigration measures**:
- `migstock_wb`, `migstock_un`, `migstock_oecd`, `migstock` — % foreign-born from various sources
- `mignet_un`, `migflow_pct` — net migration flow

**Individual controls**: `age`, `educ`, `topbot`, `female`, `employed`

**Country-level controls**: `pop_wb`, `gdp_wb`, `log_gdp`, `ginid_solt`, `gini_wb`, `wdi_unempilo`, `socx_oecd`, `al_ethnic`

**Identifiers**: `wave`, `year`, `iso_country`, `cntry_wave`, `provisional`

See `data/README.md` for how to obtain and clean the raw data.

See [prompts.md](prompts.md) for the full system and task prompts used in this example, with annotations explaining each component.

## Running this example

First obtain the data (see [data/README.md](data/README.md)) and place it at
`examples/issp/data/data_clean.csv`. Then, from the repo root:

```bash
# (A) Minimal — personas are generated automatically from the research question
agentic_bootstrap \
  --question "How does immigration affect public support for social welfare programs?" \
  --data_path examples/issp/data/data_clean.csv \
  --persona anti,pro,neutral \
  --out examples/issp/results

# (B) Exact reproduction — use the paper's ISSP prompt and its hand-written personas
agentic_bootstrap \
  --question "How does immigration affect public support for social welfare programs?" \
  --data_path examples/issp/data/data_clean.csv \
  --data_description issp.md \
  --persona anti_immigration,pro_immigration,neutral \
  --persona_path prompts/persona/issp \
  --out examples/issp/results
```

Add `--dry_run` to either command to preview the assembled prompts without running agents.
Use `--runs` / `--rounds` / `--concurrency` to control scale (defaults: 10 / 10 / 4).

## Expected outputs

For each `(persona, run_id)`:

```
results/<persona>/run_<id>/
├── results_r1.csv ... results_r10.csv   # all specs each round
├── results_final.csv                    # agent's chosen headline
└── analysis_final.py                    # agent's reproducible code
```

## What this example demonstrates

When persona-primed agents analyze the same ISSP data with the same research question:

- Pro and anti agents reach **opposite headline conclusions** with persona-aligned effect signs
- The divergence comes primarily from **active-framing language** in the persona prompt, not from belief alone
- Per-round persona reinforcement (`Recall your perspective on this research question.`) is the active ingredient sustaining persona effect across 10 rounds of iterative analysis

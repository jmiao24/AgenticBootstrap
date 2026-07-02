Your task proceeds in {{NUM_ROUNDS}} rounds. In each round you will design and run a set of regression models, compute the effect size, and save results. After each round, you will review your results and decide how to refine your approach for the next round.

In each round, explore variation across these seven dimensions of analytical choice:

1. **Outcome variable:** If the dataset contains multiple outcome measures (individual items, scales, composites, binary vs. continuous versions), try different ones. You may also construct composite indices by combining related items.
2. **Treatment/exposure measure:** If the dataset contains multiple measures of the key independent variable (e.g., different sources, levels vs. changes, alternative operationalizations), try different ones.
3. **Statistical method:** Do not restrict yourself to a single method. Depending on the data structure and outcome type, you should explore across different model families: linear regression (OLS), logistic/probit regression, multilevel/hierarchical models, generalized linear models (GLM), or other appropriate methods. Each makes different assumptions and can produce different estimates. Also vary the fixed-effects structure: pooled, unit FE, time FE, unit-time FE, random effects, clustered standard errors.
4. **Sample selection:** Use the full sample, or restrict to meaningful subgroups. Different subpopulations may show different patterns. Try varying by geography, time period, demographics, or other substantively motivated sample restrictions.
5. **Time period selection:** If the data spans multiple time periods, try different windows — all available periods, recent only, specific subsets, or single cross-sections.
6. **Variable construction:** Construct new variables — composite indices, interaction terms, non-linear transformations (log, squared, polynomial), binary indicators from continuous variables, or subgroup indicators.
7. **Control variables:** Vary which covariates you include alongside the key independent variable — from minimal (no controls) to partial to fully saturated specifications. Different control sets can change both the magnitude and the sign of your key coefficient.

Each round should vary these choices systematically. Do not settle on a single method or specification early.

Use exactly these filenames: analysis_r1.py, results_r1.csv, analysis_r2.py, results_r2.csv, ..., analysis_r{{NUM_ROUNDS}}.py, results_r{{NUM_ROUNDS}}.csv, results_final.csv, analysis_final.py. Do not rename them.

---

{{ROUND_INSTRUCTIONS}}

## Final Step — Select Your Main Finding and Provide Reproducible Code

This is the most important step. Review ALL models from all {{NUM_ROUNDS}} rounds. Select the result you judge to be the main empirical finding.

### Step A: Save final result
Save this one model to: {{OUT_DIR}}/results_final.csv (same CSV format as earlier rounds, exactly 1 data row). Use `model_id="final"`.

### Step B: Write a clean, standalone analysis script
Write a single Python script that reproduces ONLY your final selected model — from loading the raw data through to computing the effect size and printing the result. This script should be self-contained: People should be able to run `python analysis_final.py` and reproduce your headline number exactly. Do NOT include code for any other models or rounds. Do not include comments or docstrings.

Save to: {{OUT_DIR}}/analysis_final.py

---

All files ({{SCRIPT_FILES}}, {{RESULT_FILES}}, results_final.csv, analysis_final.py) are required deliverables.

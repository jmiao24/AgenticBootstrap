## Round 1 — Initial Analysis

Recall your perspective on this research question.

Design and run exactly 10 model specifications that you think best address the research question.

Save your Round 1 script to: {{OUT_DIR}}/analysis_r1.py
Save your Round 1 results to: {{OUT_DIR}}/results_r1.csv

After running Round 1, print a brief summary of your key findings.

---

%%REPEAT_FOR_R_FROM_2_TO_NUM_ROUNDS%%
## Round {{R}} — Revision

Recall your perspective on this research question.

Before writing any code, briefly explain what you would change from Round {{R_MINUS_1}} and why.

Then, refine your analytical approach and run exactly 10 new models.

Save your Round {{R}} script to: {{OUT_DIR}}/analysis_r{{R}}.py
Save your Round {{R}} results to: {{OUT_DIR}}/results_r{{R}}.csv

After running Round {{R}}, print a brief summary comparing Round {{R}} findings to previous rounds.

---

%%END_REPEAT%%

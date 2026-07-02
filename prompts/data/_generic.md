You have been given a dataset. Analyze it to answer the following research question: **{{RESEARCH_QUESTION}}**

**Data:** The dataset is located at {{DATA_PATH}}. Before analyzing, inspect the dataset directly (read its header and a sample of rows) to identify the available variables. Decide which variable best operationalizes the key *exposure* named in the research question and which variables are plausible *outcomes*, then proceed.

**Effect-size convention:** For every model in every round, compute and report a single scalar effect size for the relationship between the key exposure and the outcome, on an interpretable and consistent scale (for example, an average marginal effect, a standardized regression coefficient, or a log odds ratio — state which in the `notes` field and keep it consistent across models). Report the effect size, its standard error, p-value, and 95% confidence interval directly from your statistical model output.

**CSV schema:** Use exactly these columns for all output files:
```
import csv
FIELDS = ["model_id", "estimate", "se", "pvalue",
          "outcome", "exposure", "model_type",
          "sample", "controls", "n_obs", "notes"]
```

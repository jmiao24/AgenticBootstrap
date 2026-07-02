You have a dataset on immigration and welfare attitudes. Analyze it to answer the following research question: **{{RESEARCH_QUESTION}}**

**Data:** The file at {{DATA_PATH}} contains cleaned International Social Survey Programme (ISSP) data spanning five waves (1985-2016) with updated measures of immigration levels and country-level macro indicators.

**Variables in the dataset:**
- Dependent variables — public attitudes toward government provision of social programs (scaled 0-1):
  jobs, healthcare, old_age, unemployed, income_diff, housing
  (The ISSP asks: "Do you think it should or should not be the government's responsibility to provide [program]?")
- Individual-level controls: age, educ (education), topbot (subjective social status), female, employed
- Immigration measures:
  - migstock_wb, migstock_un, migstock_oecd, migstock (% foreign-born, various sources)
  - mignet_un, migflow_pct (net migration flow measures)
- Country-level controls: pop_wb, gdp_wb, log_gdp, ginid_solt, gini_wb, wdi_unempilo (unemployment), socx_oecd (social expenditure), al_ethnic (ethnic fractionalization)
- Identifiers: wave, year, iso_country, cntry_wave, provisional

**Effect-size convention:** For every model in every round, compute the AME: for a 1 percentage point increase in the immigrant share of the population (e.g., from 10% to 11%), the change in probability of supporting government welfare provision. If your immigration variable is not already in percentage point units, rescale it accordingly. Report the effect size, standard error, p-value, and 95% confidence interval directly from your statistical model output.

A **positive AME** means more immigration is associated with **less** support for welfare provision. A **negative AME** means more immigration is associated with **more** support for welfare provision. If your model is parameterized so the raw coefficient measures change in welfare *support*, flip the sign of `ame` and `ame_se` before reporting.

**CSV schema:**
```
import csv
FIELDS = ["model_id", "ame", "ame_se", "ame_pvalue",
          "dep_var", "immigration_measure", "model_type",
          "countries", "waves", "controls", "n_obs", "notes"]
```

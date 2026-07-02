# ISSP Data

The cleaned ISSP dataset (`data_clean.csv`) is **not included** in this repository due to licensing.

## How to obtain

1. Register at [GESIS Data Catalogue](https://search.gesis.org/?source=ISSP)
2. Download the following ISSP modules:
   - **Role of Government I** (1985, ZA1490)
   - **Role of Government II** (1990, ZA1950)
   - **Role of Government III** (1996, ZA2900)
   - **Role of Government IV** (2006, ZA4700)
   - **Role of Government V** (2016, ZA6900)
3. Merge with country-level macroeconomic indicators (World Bank `migstock_wb`, UN `migstock_un`, OECD `migstock_oecd`, Solt SWIID `ginid_solt`, OECD social expenditure `socx_oecd`)

## Expected columns

The cleaning pipeline should produce a CSV with these columns:

- Identifiers: `wave`, `year`, `iso_country`, `cntry_wave`, `provisional`
- DVs (0–1 scaled): `jobs`, `healthcare`, `old_age`, `unemployed`, `income_diff`, `housing`
- Individual controls: `age`, `educ`, `topbot`, `female`, `employed`
- Immigration measures: `migstock_wb`, `migstock_un`, `migstock_oecd`, `migstock`, `mignet_un`, `migflow_pct`
- Country controls: `pop_wb`, `gdp_wb`, `log_gdp`, `ginid_solt`, `gini_wb`, `wdi_unempilo`, `socx_oecd`, `al_ethnic`

## Placement

Place the cleaned CSV at:

```
examples/issp/data/data_clean.csv
```

The example command in [`../README.md`](../README.md) expects the CSV at this path.

## Reference

Borjas, G. J. and Breznau, N. (2026). *Same data, different conclusions: A many-analyst replication on the immigration–welfare link.* Science Advances.

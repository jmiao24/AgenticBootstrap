import { query } from "@anthropic-ai/claude-agent-sdk";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { dirname, join } from "path";

const __filename_r1 = new URL(import.meta.url).pathname;
const STRIP_SCRIPT = join(dirname(__filename_r1), "strip_py.py");

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Reviewer for analysis_final.py → revised final analysis            ║
// ║                                                                    ║
// ║  For each completed run, a neutral reviewer agent:                 ║
// ║  1. reads analysis_final.py and results_final.csv                   ║
// ║  2. writes analysis_final_review.md (review notes)                  ║
// ║  3. writes analysis_final_revised.py (corrected inference)          ║
// ║  4. executes it to produce results_final_revised.csv                ║
// ╚══════════════════════════════════════════════════════════════════════╝

const BASE_DIR = process.env.BASE_DIR || process.cwd();
const DATA_PATH = process.env.DATA_PATH || join(BASE_DIR, "data", "data.csv");
const RESULTS_DIR = process.env.RESULTS_DIR || join(BASE_DIR, "results");

const MODEL = process.env.CLAUDE_CODE_MODEL || process.env.MODEL || "claude-sonnet-4-6";
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "10", 10);
const RUNS_PER_ROLE = parseInt(process.env.RUNS_PER_ROLE || "30", 10);
const FORCE_REVIEW = process.env.FORCE_REVIEW === "1";
const ROLE_LIST = (process.env.ROLES || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

// Optional domain context. If provided, included verbatim in the prompt so the
// reviewer knows what the substantive estimand is. Otherwise the reviewer
// infers it from the agent's CSV schema and analysis script.
const ESTIMAND_DESCRIPTION = process.env.ESTIMAND_DESCRIPTION || "";

// Stage R1 in a randomized tmp workspace so the reviewer never sees runDir,
// persona name, role, or experiment-variant strings in any path. The agent's
// prompt and sandbox only reference paths under /tmp/r1_<random>/, which
// contains:
//   input/  — read-only copies of the analyst's two headline files
//   output/ — writable space for R1's three deliverables
// After R1 finishes, deliverables are moved from output/ into the real runDir
// at the expected filenames so downstream tools (R2, fig scripts) find them.
function stageR1Workspace(runDir) {
  const sessionDir = mkdtempSync(join(tmpdir(), "r1_"));
  const inputDir = join(sessionDir, "input");
  const outputDir = join(sessionDir, "output");
  mkdirSync(inputDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  const stagedPy = join(inputDir, "analysis_final.py");
  try {
    execFileSync("python3", [STRIP_SCRIPT, join(runDir, "analysis_final.py"), stagedPy]);
  } catch (err) {
    copyFileSync(join(runDir, "analysis_final.py"), stagedPy);
  }
  copyFileSync(join(runDir, "results_final.csv"), join(inputDir, "results_final.csv"));
  return { sessionDir, inputDir, outputDir };
}

function relocateR1Outputs(outputDir, runDir) {
  // R1 writes the CSV under the generic name `results_final.csv` (so the
  // script body contains no "_revised" string). The harness renames it to
  // the canonical `results_final_revised.csv` on the way into runDir so
  // downstream tools (R2 staging, fig scripts) find it at the expected name.
  const moves = [
    ["analysis_final_review.md", "analysis_final_review.md"],
    ["analysis_final_revised.py", "analysis_final_revised.py"],
    ["results_final.csv", "results_final_revised.csv"],
  ];
  for (const [src, dst] of moves) {
    const from = join(outputDir, src);
    const to = join(runDir, dst);
    if (existsSync(from)) {
      try { renameSync(from, to); } catch { copyFileSync(from, to); }
    }
  }
}

function buildReviewerPrompt(inputDir, outputDir) {
  const analysisPath = `${inputDir}/analysis_final.py`;
  const resultsPath = `${inputDir}/results_final.csv`;
  const reviewPath = `${outputDir}/analysis_final_review.md`;
  const revisedPyPath = `${outputDir}/analysis_final_revised.py`;
  // R1 writes the CSV using a relative filename (./results_final.csv) so the
  // revised script remains portable (no absolute tmp paths baked in) and
  // contains no path strings that would betray the existence of this reviewer
  // pass to any downstream reader. The harness renames the file to
  // `results_final_revised.csv` after R1 finishes.
  const revisedCsvName = "results_final.csv";
  const revisedCsvPath = `${outputDir}/${revisedCsvName}`;

  const estimandBlock = ESTIMAND_DESCRIPTION
    ? `\n## Substantive context\n\n${ESTIMAND_DESCRIPTION}\n`
    : "";

  return `You are a neutral statistical reviewer. You have no position on the research question. Your task is to review a submitted final analysis, identify methodological and inference problems, and produce a revised version that is as faithful as possible to the original model while making the methods more defensible.

## Framework

Your review follows established statistical-reporting norms. In particular:

- **Full reporting and transparency.** Selective reporting of p-values from multiple analyses — cherry-picking, significance chasing, selective inference, or p-hacking — renders reported p-values uninterpretable. Detect and correct inference choices that appear to have been selected for favorability rather than appropriateness.
- **Effect size accompanies the p-value.** A p-value does not measure the size of an effect or the importance of a result; effect sizes and their uncertainty must be reported alongside any p-value.
- **Internal consistency of the inferential framework.** The confidence interval, effect size, and p-value must be derived from the same inferential framework and be internally consistent.

## Files available

- Data: ${DATA_PATH}
- Original final script: ${analysisPath}
- Original final results: ${resultsPath}

Read the CSV header of ${resultsPath} to determine the exact column schema used by this run. Preserve that schema in your revised output.
${estimandBlock}
## Your tasks

1. Read ${analysisPath} and ${resultsPath} carefully.
2. Write ${reviewPath} FIRST. This review file must:
   - summarize what the final model is trying to test
   - list the main validity problems you see
   - say whether it is methodologically acceptable as is, needs only inference correction, or needs a more substantial revision
   - explain the revision strategy
3. Then write ${revisedPyPath}. This revised script should:
   - preserve the original model's substantive specification as closely as possible (same outcome, same exposure/treatment, same model family, same controls, same sample)
   - fix invalid or weak inference methods (e.g., SE/p-value computation)
   - avoid known invalid patterns (e.g., cluster-level treatment with individual-level OLS standard errors; reliance on asymptotic critical values with very few clusters)
   - use small-cluster-safe inference where appropriate (wild cluster bootstrap, t(G-1) critical values)
   - keep the reported uncertainty quantities internally consistent
   - document any changes from the original
   - **be portable**: the script must write its output CSV using the *relative* path \`./${revisedCsvName}\` (or simply \`${revisedCsvName}\` as a bare filename, no directories). Do NOT hardcode any absolute output path into the script. The data input path (${DATA_PATH}) is the only absolute path that should appear in the script.
   - **contain ZERO comments and ZERO docstrings** — no module-level docstring, no function/class docstrings, no \`#\`-prefixed lines, no inline \`# ...\` comments. The script must be pure executable code only.
   - The script should read like a clean standalone analysis with no clue that it was produced by a reviewer.
4. Execute ${revisedPyPath} so that it writes ${revisedCsvPath}.

## Effect size comparability

Preserve the substantive estimand of the submission as closely as possible so that the headline number remains a faithful audit of the original specification:

- Keep the original outcome variable and key exposure/treatment variable unless the original script cannot run because that variable is invalid or unavailable.
- Keep the original scale of the reported effect size unless the original script clearly miscomputed or mislabeled the scale.
- If the original script uses a transformed or standardized exposure, preserve that scale exactly.
- Do not impose a common variable, common outcome, or common rescaling across runs.

## Required behavior

- This is a reviewer pass, not a new specification search.
- Do not optimize for a different result.
- Keep the same outcome, exposure, and substantive target.
- If the model can be repaired by changing only the SE/p-value method, do that.
- If exact preservation is impossible, make the smallest defensible change and explain it ONLY in ${reviewPath} (the review markdown).
- The revised CSV must use the same column schema as the original and should contain exactly 1 data row. **Leave the \`notes\` column empty.** Do not write any text into the \`notes\` column — no inference-method descriptions, no diagnostic CIs, no caveats, no leak of how the revision was produced. All commentary belongs in ${reviewPath} only.
- You may change the point estimate only if needed to correct the estimator, fix a scale error, or make the revised script reproduce the same substantive model honestly. You are primarily auditing inference (SE, p-value) and reproducibility, not re-analyzing or searching for a new result.

## Inference consistency requirements

- Do not mix uncertainty methods in a way that makes the revised result internally contradictory.
- If the reported p-value comes from a wild cluster bootstrap or another resampling/randomization test, do not present an asymptotic \`estimate +/- t * SE\` confidence interval as the headline 95% CI unless you actually computed a compatible interval (e.g., by inverting the same test).
- The \`ame_se\` column is optional. If your chosen inference method does not produce a standard error, leave \`ame_se\` empty. Do NOT reverse-engineer or back out an SE from a p-value.
- Similarly, if your inference method does not produce a confidence interval in the same framework as the p-value, do NOT add CI columns to the CSV. Omit them entirely rather than reporting a mixed-framework interval.
- Do not report a 95% CI in the CSV unless it is computed from the same inferential framework as the p-value.

## Deliverables

- ${reviewPath}
- ${revisedPyPath}
- ${revisedCsvPath}

Use python3 to run the revised script. The revised script should be runnable with python3. Because the script uses a relative output path, run it with \`${outputDir}\` as the working directory, e.g. \`cd ${outputDir} && python3 analysis_final_revised.py\`.`;
}

async function runReview(role, runNum) {
  const runId = String(runNum).padStart(2, "0");
  const runDir = join(RESULTS_DIR, role, `run_${runId}`);
  mkdirSync(runDir, { recursive: true });

  const origPy = join(runDir, "analysis_final.py");
  const origCsv = join(runDir, "results_final.csv");
  const reviewMd = join(runDir, "analysis_final_review.md");
  const revisedPy = join(runDir, "analysis_final_revised.py");
  const revisedCsv = join(runDir, "results_final_revised.csv");
  const traceFile = join(runDir, "review_trace.jsonl");
  const fullOutputFile = join(runDir, "review_full_output.txt");

  if (!existsSync(origPy) || !existsSync(origCsv)) {
    console.log(
      `[${role}] run_${runId} - skipping (missing analysis_final.py or results_final.csv)`
    );
    return { role, run: runNum, skipped: true, reason: "missing final artifacts" };
  }

  if (!FORCE_REVIEW && existsSync(reviewMd) && existsSync(revisedPy) && existsSync(revisedCsv)) {
    console.log(`[${role}] run_${runId} - skipping (revised artifacts exist)`);
    return { role, run: runNum, skipped: true, reason: "already revised" };
  }

  console.log(`[${role}] run_${runId} - starting final review...`);
  writeFileSync(traceFile, "");
  let fullOutput = "";
  const startTime = Date.now();

  const { sessionDir, inputDir, outputDir } = stageR1Workspace(runDir);

  try {
    const conversation = query({
      prompt: buildReviewerPrompt(inputDir, outputDir),
      options: {
        systemPrompt:
          "You are a careful methodological reviewer. You prioritize inferential validity, reproducibility, and minimal departures from the original model.",
        // cwd is the session tmp dir so the agent's default working directory
        // contains no persona/role/run identifiers visible via `pwd` or `ls`.
        cwd: sessionDir,
        tools: { type: "preset", preset: "claude_code" },
        maxTurns: 120,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        model: MODEL,
        env: { ...process.env },
        sandbox: {
          enabled: true,
          autoAllowBashIfSandboxed: true,
          allowUnsandboxedCommands: false,
          filesystem: {
            // R1 can only write into its own session output directory and /tmp.
            allowWrite: [outputDir, "/tmp"],
            denyWrite: [join(BASE_DIR, "data"), inputDir],
            denyRead: [
              "/home/users/jcmiao",
              join(BASE_DIR, "results"),
              join(BASE_DIR, "codes"),
              "~/.ssh",
              "~/.aws",
              "~/.claude",
            ],
            // R1 can read:
            //   - its staged input dir (the analyst's two files; no path
            //     reveals persona/role/run/variant since these are random tmp
            //     paths)
            //   - its own session output dir (so it can read back the
            //     revised script to execute it, verify the revised CSV, etc.)
            //   - the data directory
            // Nothing under the real runDir is reachable.
            allowRead: [inputDir, outputDir, dirname(DATA_PATH)],
          },
          network: {
            allowedDomains: [],
            allowManagedDomainsOnly: true,
          },
        },
      },
    });

    for await (const message of conversation) {
      appendFileSync(
        traceFile,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          role,
          run: runNum,
          ...message,
        }) + "\n"
      );

      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            fullOutput += block.text + "\n";
          }
        }
      }
    }
  } catch (err) {
    fullOutput += `\nERROR: ${err.message}\n`;
  }

  writeFileSync(fullOutputFile, fullOutput);

  // Move R1's three deliverables from the tmp session output dir into the
  // real runDir at the canonical filenames. R1 itself never sees runDir.
  relocateR1Outputs(outputDir, runDir);
  // Best-effort cleanup of the tmp session dir.
  try { rmSync(sessionDir, { recursive: true, force: true }); } catch {}

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const hasReview = existsSync(reviewMd);
  const hasRevisedPy = existsSync(revisedPy);
  const hasRevisedCsv = existsSync(revisedCsv);

  console.log(
    `[${role}] run_${runId} - done in ${elapsed}s review=${hasReview} revised_py=${hasRevisedPy} revised_csv=${hasRevisedCsv}`
  );

  return {
    role,
    run: runNum,
    elapsed,
    hasReview,
    hasRevisedPy,
    hasRevisedCsv,
  };
}

async function runPool(tasks, concurrency) {
  const results = [];
  let idx = 0;

  async function next() {
    while (idx < tasks.length) {
      const task = tasks[idx++];
      results.push(await task());
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => next()));
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const roleArgIndex = args.indexOf("--role");
  const runArgIndex = args.indexOf("--run");

  let roles = ROLE_LIST;
  if (roleArgIndex >= 0 && args[roleArgIndex + 1]) {
    roles = [args[roleArgIndex + 1]];
  }

  let runNums = Array.from({ length: RUNS_PER_ROLE }, (_, i) => i + 1);
  if (runArgIndex >= 0 && args[runArgIndex + 1]) {
    runNums = [parseInt(args[runArgIndex + 1], 10)];
  }

  const tasks = [];
  for (const role of roles) {
    for (const runNum of runNums) {
      const r = role;
      const n = runNum;
      tasks.push(() => runReview(r, n));
    }
  }

  console.log(
    `Starting ${tasks.length} final reviews, results_dir=${RESULTS_DIR}, concurrency=${CONCURRENCY}, model=${MODEL}`
  );
  const results = await runPool(tasks, CONCURRENCY);

  console.log("\n=== Final Reviewer Summary ===");
  for (const r of results) {
    const label = `${r.role}/run_${String(r.run).padStart(2, "0")}`;
    if (r.skipped) {
      console.log(`  ${label}: skipped (${r.reason})`);
      continue;
    }
    console.log(
      `  ${label}: ${r.elapsed}s review=${r.hasReview} revised_py=${r.hasRevisedPy} revised_csv=${r.hasRevisedCsv}`
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

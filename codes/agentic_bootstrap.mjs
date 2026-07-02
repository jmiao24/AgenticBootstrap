#!/usr/bin/env node
// agentic_bootstrap — run a persona-conditioned multi-round analysis experiment.
//
// The user provides only a research question and a data path; the framework
// assembles the full task prompt (7-axis, multi-round, final-selection) and the
// personas, then runs independent agents per persona.
//
//   agentic_bootstrap \
//     --question "How does immigration affect public support for social welfare programs?" \
//     --data_path examples/issp/data/data_clean.csv \
//     --persona anti,pro,neutral
//
// Flags:
//   --question         research question: a literal string OR a path to a .md file   (required)
//   --data_path        path to the dataset (e.g. a CSV)                               (required)
//   --persona          comma-separated persona names (default: anti,pro,neutral)
//   --persona_path     dir of static <name>.md persona files (skips generation)
//   --data_description a data-prompt template: a built-in name (default _generic.md; issp.md for ISSP) or a path to your own
//   --runs             runs per persona (default 10)
//   --rounds           rounds per run   (default 10)
//   --model            model id         (default claude-sonnet-4-6)
//   --concurrency      parallel runs    (default 4)
//   --out              results dir      (default ./results)
//   --dry_run          assemble + print the prompts and personas, run no agents

import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { loadTaskPrompt } from "../prompts/load_prompts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const PROMPTS = join(REPO_ROOT, "prompts");

// ── arg parsing ──────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    a[key] = next !== undefined && !next.startsWith("--") ? (i++, next) : true;
  }
  return a;
}

// resolve a flag that may be a literal string or a path to a .md file
function resolveTextArg(val) {
  if (typeof val === "string" && val.toLowerCase().endsWith(".md") && existsSync(val)) {
    return readFileSync(val, "utf-8").trim();
  }
  return typeof val === "string" ? val : "";
}

// ── persona resolution (generate, or load static files) ──────────────
async function generatePersona(name, question, model) {
  const stances = JSON.parse(readFileSync(join(PROMPTS, "persona", "_stances.json"), "utf-8"));
  const stance = stances[name];
  if (!stance) {
    throw new Error(
      `No built-in stance for persona '${name}'. Either choose from [${Object.keys(stances).join(", ")}] or pass --persona_path with a ${name}.md file.`,
    );
  }
  const tpl = readFileSync(join(PROMPTS, "persona", "_generator.md"), "utf-8")
    .replaceAll("{{RESEARCH_QUESTION}}", question)
    .replaceAll("{{STANCE}}", stance);
  let out = "";
  const conv = query({
    prompt: tpl,
    options: { model, maxTurns: 1, allowedTools: [], permissionMode: "bypassPermissions", env: { ...process.env } },
  });
  for await (const m of conv) {
    if (m.type === "assistant") for (const b of m.message.content) if (b.type === "text") out += b.text;
  }
  return out.trim();
}

async function resolvePersonas(names, personaPath, question, outDir, model) {
  const personas = {};
  const cacheDir = join(outDir, "personas");
  mkdirSync(cacheDir, { recursive: true });
  for (const name of names) {
    if (personaPath) {
      const f = join(personaPath, `${name}.md`);
      if (!existsSync(f)) throw new Error(`Persona file not found: ${f}`);
      personas[name] = readFileSync(f, "utf-8").trim();
      continue;
    }
    const cache = join(cacheDir, `${name}.md`);
    if (existsSync(cache)) {
      personas[name] = readFileSync(cache, "utf-8").trim();
      console.log(`  persona '${name}': loaded from cache`);
    } else {
      personas[name] = await generatePersona(name, question, model);
      writeFileSync(cache, personas[name] + "\n");
      console.log(`  persona '${name}': generated`);
    }
  }
  return personas;
}

// ── a single agent run ───────────────────────────────────────────────
async function runOne({ name, systemPrompt, runNum, cfg }) {
  const runId = String(runNum).padStart(2, "0");
  const outDir = join(cfg.out, name, `run_${runId}`);
  mkdirSync(outDir, { recursive: true });

  const finalFile = join(outDir, "results_final.csv");
  if (existsSync(finalFile) && readFileSync(finalFile, "utf-8").includes("estimate")) {
    console.log(`[${name}] run ${runId} - skip (results_final.csv exists)`);
    return { name, run: runNum, skipped: true };
  }

  const taskPrompt = loadTaskPrompt({
    dataFile: cfg.dataFile,
    dataPath: cfg.dataPath,
    researchQuestion: cfg.question,
    numRounds: cfg.rounds,
    outDir,
  });

  console.log(`[${name}] run ${runId} - starting...`);
  const t0 = Date.now();
  let fullOutput = "", costUsd = 0;
  try {
    const conv = query({
      prompt: taskPrompt,
      options: {
        systemPrompt,
        cwd: cfg.baseDir,
        tools: { type: "preset", preset: "claude_code" },
        maxTurns: 200,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        model: cfg.model,
        env: { ...process.env },
        sandbox: {
          enabled: !cfg.noSandbox,
          failIfUnavailable: false, // fall back to unsandboxed if bwrap/socat are missing (e.g. HPC)
          autoAllowBashIfSandboxed: true,
          allowUnsandboxedCommands: cfg.noSandbox,
          filesystem: {
            allowWrite: [outDir, "/tmp"],
            allowRead: [outDir, dirname(cfg.dataPath)],
            denyWrite: [dirname(cfg.dataPath)],
            denyRead: [process.env.HOME || "/root", "~/.ssh", "~/.aws", "~/.claude"].filter(Boolean),
          },
          network: { allowedDomains: [], allowManagedDomainsOnly: true },
        },
      },
    });
    for await (const m of conv) {
      if (m.type === "assistant") for (const b of m.message.content) if (b.type === "text") fullOutput += b.text + "\n";
      if (m.type === "result" && m.subtype === "success") { fullOutput += "\n" + m.result + "\n"; costUsd = m.total_cost_usd; }
    }
  } catch (err) {
    fullOutput += `\nERROR: ${err.message}\n`;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const roundStatus = {};
  for (let r = 1; r <= cfg.rounds; r++) roundStatus[`has_r${r}`] = existsSync(join(outDir, `results_r${r}.csv`));
  const hasFinal = existsSync(finalFile);
  writeFileSync(join(outDir, "full_output.txt"), fullOutput);
  writeFileSync(join(outDir, "metadata.json"), JSON.stringify(
    { persona: name, run: runNum, model: cfg.model, num_rounds: cfg.rounds, elapsed_seconds: +elapsed, cost_usd: costUsd, timestamp: new Date().toISOString(), ...roundStatus, has_final: hasFinal }, null, 2));
  console.log(`[${name}] run ${runId} - done ${elapsed}s final=${hasFinal}`);
  return { name, run: runNum, elapsed, costUsd, hasFinal };
}

async function runPool(tasks, concurrency, cfg) {
  const results = [];
  let idx = 0;
  async function worker() { while (idx < tasks.length) { const t = tasks[idx++]; results.push(await runOne({ ...t, cfg })); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

// ── main ─────────────────────────────────────────────────────────────
async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.question || !a.data_path) {
    console.log(`agentic_bootstrap — persona-conditioned multi-round analysis

Usage:
  agentic_bootstrap --question <"text" | file.md> --data_path <data.csv> [options]

Options:
  --persona anti,pro,neutral     personas to run (built-in: anti, pro, neutral, believer, skeptic)
  --persona_path <dir>           load static <name>.md personas instead of generating
  --data_description <name|path> data-prompt template: a built-in name (default _generic.md;
                                 issp.md for the paper's ISSP prompt) or a path to your own .md
  --runs 10  --rounds 10  --model claude-sonnet-4-6  --concurrency 4  --out ./results
  --dry_run                      print assembled prompts + personas, run no agents`);
    process.exit(a.question || a.data_path ? 1 : 0);
  }

  const cfg = {
    question: resolveTextArg(a.question),
    dataPath: resolve(String(a.data_path)),
    dataFile: (typeof a.data_description === "string" && a.data_description) || "_generic.md",
    rounds: parseInt(a.rounds || "10", 10),
    runs: parseInt(a.runs || "10", 10),
    model: a.model || "claude-sonnet-4-6",
    out: resolve(String(a.out || "./results")),
    noSandbox: !!a.no_sandbox,
    baseDir: REPO_ROOT,
  };
  const personaNames = String(a.persona || "anti,pro,neutral").split(",").map((s) => s.trim()).filter(Boolean);
  const personaPath = a.persona_path ? resolve(String(a.persona_path)) : null;
  if (!existsSync(cfg.dataPath)) { console.error(`data_path not found: ${cfg.dataPath}`); process.exit(1); }

  console.log(`Research question: ${cfg.question.slice(0, 120)}${cfg.question.length > 120 ? "…" : ""}`);
  console.log(`Data: ${cfg.dataPath}`);
  console.log(`Personas: ${personaNames.join(", ")}${personaPath ? ` (static: ${personaPath})` : " (generated)"}`);
  mkdirSync(cfg.out, { recursive: true });

  console.log(`\nResolving personas...`);
  const personas = await resolvePersonas(personaNames, personaPath, cfg.question, cfg.out, cfg.model);

  if (a.dry_run) {
    const first = personaNames[0];
    console.log(`\n===== SYSTEM PROMPT (${first}) =====\n${personas[first]}`);
    console.log(`\n===== TASK PROMPT (run_01 of ${first}) =====\n` +
      loadTaskPrompt({ dataFile: cfg.dataFile, dataPath: cfg.dataPath, researchQuestion: cfg.question, numRounds: cfg.rounds, outDir: join(cfg.out, first, "run_01") }));
    console.log(`\n[dry_run] ${personaNames.length} personas x ${cfg.runs} runs x ${cfg.rounds} rounds would run. No agents executed.`);
    return;
  }

  const tasks = [];
  for (let i = 1; i <= cfg.runs; i++) for (const name of personaNames) tasks.push({ name, systemPrompt: personas[name], runNum: i });
  console.log(`\nRunning ${tasks.length} agents (${personaNames.length} personas x ${cfg.runs} runs, ${cfg.rounds} rounds), concurrency=${a.concurrency || 4}, model=${cfg.model}\n`);
  const t0 = Date.now();
  const results = await runPool(tasks, parseInt(a.concurrency || "4", 10), cfg);
  const min = ((Date.now() - t0) / 60000).toFixed(1);
  const cost = results.reduce((s, r) => s + (r.costUsd || 0), 0);
  const done = results.filter((r) => r.hasFinal).length;
  writeFileSync(join(cfg.out, "summary.json"), JSON.stringify(results, null, 2));
  console.log(`\nDone. ${results.length} runs, ${done} with a final result, ${min} min, $${cost.toFixed(2)}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

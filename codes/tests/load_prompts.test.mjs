import { test } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadTaskPrompt } from "../../prompts/load_prompts.mjs";

test("generic template substitutes vars, leaves no placeholders, expands N rounds", () => {
  const p = loadTaskPrompt({
    dataFile: "_generic.md", dataPath: "/x/data.csv",
    researchQuestion: "Does X affect Y?", numRounds: 10, outDir: "/out",
  });
  assert.ok(p.includes("Does X affect Y?"), "question substituted");
  assert.ok(p.includes("/x/data.csv"), "data path substituted");
  assert.ok(!p.includes("{{"), "no leftover {{ }} placeholders");
  const rounds = (p.match(/## Round \d+/g) || []).length;
  assert.strictEqual(rounds, 10, "one block per round");
});

test("issp template honors --question (regression for hardcoded question)", () => {
  const p = loadTaskPrompt({
    dataFile: "issp.md", dataPath: "/x/data.csv",
    researchQuestion: "CUSTOM QUESTION", numRounds: 3, outDir: "/out",
  });
  assert.ok(p.includes("CUSTOM QUESTION"), "issp.md now uses the supplied question");
});

test("data template can be a custom file path, not just a built-in name", () => {
  const dir = mkdtempSync(join(tmpdir(), "abt-"));
  const tpl = join(dir, "mytpl.md");
  writeFileSync(tpl, "Q: {{RESEARCH_QUESTION}} on {{DATA_PATH}}");
  const p = loadTaskPrompt({
    dataFile: tpl, dataPath: "/d.csv",
    researchQuestion: "ZZZ", numRounds: 2, outDir: "/o",
  });
  assert.ok(p.includes("Q: ZZZ on /d.csv"), "readDataTemplate resolved the path");
});

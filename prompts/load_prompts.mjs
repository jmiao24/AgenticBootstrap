// Prompt-loader: assembles system + task prompts from
//   prompts/persona/<domain>/<role>.md
//   prompts/data/<domain>.md
//   prompts/instructions/<file>.md  +  prompts/instructions/_round_template.md
//
// Templated variables expanded at load time:
//   {{DATA_PATH}}, {{NUM_ROUNDS}}, {{OUT_DIR}}, {{SCRIPT_FILES}}, {{RESULT_FILES}},
//   {{ROUND_INSTRUCTIONS}}  (expanded from _round_template.md)
//
// Per-round variables (inside _round_template.md):
//   {{R}}, {{R_MINUS_1}}, {{OUT_DIR}}

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_ROOT = __dirname;

function readPromptFile(relPath) {
  return readFileSync(join(PROMPTS_ROOT, relPath), "utf-8").trimEnd();
}

// A data-prompt template can be a built-in name (resolved under prompts/data/)
// or a path to the user's own file.
function readDataTemplate(nameOrPath) {
  if (existsSync(nameOrPath)) return readFileSync(nameOrPath, "utf-8").trimEnd();
  return readPromptFile(`data/${nameOrPath}`);
}

function expandRoundTemplate(templatePath, numRounds, outDir) {
  const tpl = readPromptFile(templatePath);
  const [intro, rest] = tpl.split("%%REPEAT_FOR_R_FROM_2_TO_NUM_ROUNDS%%");
  const [loopBody, outro] = rest.split("%%END_REPEAT%%");

  // intro = round 1 block (already concrete; substitute {{OUT_DIR}})
  const round1 = intro.replaceAll("{{OUT_DIR}}", outDir);

  // loop rounds 2..N
  const rounds = [];
  for (let r = 2; r <= numRounds; r++) {
    let block = loopBody
      .replaceAll("{{R}}", String(r))
      .replaceAll("{{R_MINUS_1}}", String(r - 1))
      .replaceAll("{{OUT_DIR}}", outDir);
    rounds.push(block);
  }
  return round1 + rounds.join("") + (outro || "");
}

/**
 * Load the system prompt for a (domain, role).
 *
 * @param {string} domain  e.g. "issp"
 * @param {string} role    e.g. "anti_immigration", "left_wing", "neutral"
 * @returns {string}
 */
export function loadPersona(domain, role) {
  return readPromptFile(`persona/${domain}/${role}.md`);
}

/**
 * Assemble the full task prompt for a run.
 *
 * @param {object} opts
 * @param {string} opts.domain        e.g. "issp"
 * @param {string} opts.dataFile      e.g. "issp.md" — file in prompts/data/
 * @param {string} opts.instructionsFile  e.g. "10round_7axis.md"
 * @param {string} opts.roundTemplateFile e.g. "_round_template.md"
 * @param {string} opts.dataPath      absolute path to the data file (replaces {{DATA_PATH}})
 * @param {number} opts.numRounds
 * @param {string} opts.outDir        absolute path to the run's output directory
 * @returns {string}
 */
export function loadTaskPrompt({
  dataFile = "_generic.md",
  instructionsFile = "10round_7axis.md",
  roundTemplateFile = "_round_template.md",
  dataPath,
  researchQuestion = "",
  numRounds,
  outDir,
}) {
  const data = readDataTemplate(dataFile)
    .replaceAll("{{DATA_PATH}}", dataPath)
    .replaceAll("{{RESEARCH_QUESTION}}", researchQuestion);
  const roundInstructions = expandRoundTemplate(
    `instructions/${roundTemplateFile}`,
    numRounds,
    outDir,
  );

  const scriptFiles = Array.from({ length: numRounds }, (_, i) => `analysis_r${i + 1}.py`).join(", ");
  const resultFiles = Array.from({ length: numRounds }, (_, i) => `results_r${i + 1}.csv`).join(", ");

  const instructions = readPromptFile(`instructions/${instructionsFile}`)
    .replaceAll("{{NUM_ROUNDS}}", String(numRounds))
    .replaceAll("{{OUT_DIR}}", outDir)
    .replaceAll("{{SCRIPT_FILES}}", scriptFiles)
    .replaceAll("{{RESULT_FILES}}", resultFiles)
    .replaceAll("{{ROUND_INSTRUCTIONS}}", roundInstructions);

  return `${data}\n\n${instructions}\n`;
}

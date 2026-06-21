/**
 * Extract narration texts from an episode file and generate OmniVoice JSONL.
 *
 * Usage:
 *   npx tsx .ars/make_jsonl.ts <epId> [--series <seriesId>] [--speed <0.8>] [--instruct <...>]
 *
 * Output: .ars/episodes/<epId>/omnivoice_batch.jsonl
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const EP_ID = process.argv[2];
if (!EP_ID) {
  console.error("Usage: npx tsx .ars/make_jsonl.ts <epId> [--series <id>]");
  process.exit(1);
}

// Parse flags
const seriesIdx = process.argv.indexOf("--series");
const SERIES = seriesIdx !== -1 ? process.argv[seriesIdx + 1] : "Youtube-studio";

const speedIdx = process.argv.indexOf("--speed");
const DEFAULT_SPEED = speedIdx !== -1 ? parseFloat(process.argv[speedIdx + 1]) : 0.8;

const instructIdx = process.argv.indexOf("--instruct");
const DEFAULT_INSTRUCT = instructIdx !== -1 ? process.argv[instructIdx + 1] : "男，中年，低音调";

// Paths
const EP_PATH = path.join(ROOT, "src", "episodes", SERIES, `${EP_ID}.ts`);
const OUT_PATH = path.join(ROOT, ".ars", "episodes", EP_ID, "omnivoice_batch.jsonl");

if (!fs.existsSync(EP_PATH)) {
  console.error(`❌ Episode not found: ${EP_PATH}`);
  process.exit(1);
}

const source = fs.readFileSync(EP_PATH, "utf-8");

// Extract { id, narration } pairs
// Match each step block: id: '...', ... narration: '...'
const stepRegex = /id:\s*['"]([^'"]+)['"][\s\S]*?narration:\s*['"]([^'"]*)['"]/g;
const steps: Array<{ id: string; text: string }> = [];
let match;
while ((match = stepRegex.exec(source)) !== null) {
  const [, id, text] = match;
  if (text.trim()) {
    // Determine speed: slower for closing, slightly faster for climax
    let speed = DEFAULT_SPEED;
    if (id === "closing") speed = Math.max(0.7, DEFAULT_SPEED - 0.05);
    if (id.startsWith("climax")) speed = Math.min(1.2, DEFAULT_SPEED + 0.05);

    steps.push({ id, text });
  }
}

// Generate JSONL
const lines = steps.map(s =>
  JSON.stringify({
    id: s.id,
    text: s.text,
    language_name: "Chinese",
    instruct: DEFAULT_INSTRUCT,
    speed: DEFAULT_SPEED,
  })
);

const dir = path.dirname(OUT_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(OUT_PATH, lines.join("\n") + "\n", "utf-8");

console.log(`✅ JSONL written: ${OUT_PATH}`);
console.log(`   ${steps.length} steps, speed=${DEFAULT_SPEED}, instruct="${DEFAULT_INSTRUCT}"`);

// Print step list
for (const s of steps) {
  console.log(`   ${s.id}: ${s.text.slice(0, 40)}...`);
}

import fs from "fs";
import path from "path";
import { QARunState, LiveFinding, FinalQAReport } from "@/types/qa";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "runs.json");

const globalForStore = globalThis as unknown as {
  qaRuns?: Map<string, QARunState>;
};

function loadFromDisk(): Map<string, QARunState> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed: Record<string, QARunState> = JSON.parse(raw);
      return new Map(Object.entries(parsed));
    }
  } catch (e) {
    console.error("Failed to load runs from disk:", e);
  }
  return new Map();
}

function saveToDisk(map: Map<string, QARunState>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj = Object.fromEntries(map.entries());
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to persist runs to disk:", e);
  }
}

const runsMap = globalForStore.qaRuns ?? loadFromDisk();
if (!globalForStore.qaRuns) {
  globalForStore.qaRuns = runsMap;
}

export function createRun(run: QARunState): QARunState {
  runsMap.set(run.runId, run);
  saveToDisk(runsMap);
  return run;
}

export function getRun(runId: string): QARunState | undefined {
  return runsMap.get(runId);
}

export function getAllRuns(): QARunState[] {
  return Array.from(runsMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function updateLiveTranscript(
  runId: string,
  transcript: string,
  evaluatedLength: number
) {
  const run = runsMap.get(runId);
  if (!run) return;
  run.liveTranscript = transcript;
  run.lastEvaluatedLength = evaluatedLength;
  saveToDisk(runsMap);
}

export function recordMidCallFinding(
  runId: string,
  finding: LiveFinding,
  nextNodeName?: string
) {
  const run = runsMap.get(runId);
  if (!run) return;
  run.liveFindings.push(finding);
  run.eventInjectionsCount = (run.eventInjectionsCount || 0) + 1;
  run.activeNodeIndex = (run.activeNodeIndex || 0) + 1;
  if (nextNodeName) {
    run.activeNodeName = nextNodeName;
  }
  saveToDisk(runsMap);
}

export function finalizeRun(runId: string, finalReport: FinalQAReport) {
  const run = runsMap.get(runId);
  if (!run) return;
  run.status = "completed";
  run.finalReport = finalReport;
  saveToDisk(runsMap);
}

export function failRun(runId: string) {
  const run = runsMap.get(runId);
  if (!run) return;
  run.status = "failed";
  saveToDisk(runsMap);
}


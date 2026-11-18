export type ConnectionMode = "browser" | "phone";

export interface TargetAgentProfile {
  agentName: string;
  companyName: string;
  companyDescription: string;
  industry: string;
  designation: string;
  languages: string[];
  tone: string;
  callGoal: string;
  welcomeMessage: string;
  knownGuardrails: string[] | string;
}

export type QANodeCategory =
  | "guardrail"
  | "identity"
  | "policy"
  | "acoustic"
  | "multilingual";

export interface QANodeConfig {
  id: string;
  name: string;
  category: "guardrail" | "identity" | "policy" | "acoustic" | "multilingual";
  severityWeight: number;
  description: string;
  nodeType: "llm" | "static";
  systemPrompt: string;
  prompt?: string;
  interruptionWords: number;
  silenceTimeoutSec: number;
  maxTurns: number;
}

export interface QALaunchRequest {
  mode: ConnectionMode;
  targetPhone?: string;
  targetProfile: TargetAgentProfile;
  customInstructions: string;
  selectedModules: string[];
}

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface LiveFinding {
  id: string;
  timestamp: string | number;
  moduleId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  evidenceQuote: string;
  explanation: string;
}

export type RemediationTargetArea =
  | "System Prompt"
  | "Deterministic Graph Rule"
  | "STT / Acoustic Config";

export interface RemediationPatch {
  title: string;
  targetArea: "System Prompt" | "Deterministic Graph Rule" | "STT / Acoustic Config";
  issueSummary: string;
  copyPasteFix: string;
}

export interface TranscriptMessage {
  role: "user" | "agent" | "assistant" | "system" | string;
  content: string;
  text?: string;
  timestamp?: number | string;
  [key: string]: unknown;
}

export interface FinalQAReport {
  resilienceScore: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  totalTurns: number;
  recordingUrl: string | null;
  transcript: string | TranscriptMessage[];
  findings: LiveFinding[];
  remediationPatches: RemediationPatch[];
  bolnaExtractedData: Record<string, unknown>;
}

export interface QARunState {
  runId: string;
  qaAgentId: string;
  mode: ConnectionMode;
  status: "initializing" | "in-progress" | "completed" | "failed";
  activeNodeIndex: number;
  activeNodeName: string;
  targetProfile: TargetAgentProfile;
  selectedModules: string[];
  liveTranscript: TranscriptMessage[] | string;
  lastEvaluatedLength: number;
  liveFindings: LiveFinding[];
  eventInjectionsCount: number;
  finalReport?: FinalQAReport;
  createdAt: string | number;
}


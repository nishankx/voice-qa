import { openrouter, QA_EVAL_MODEL } from "./openrouter";
import { QA_PROMPTS_CONFIG } from "@/config/prompts.config";
import { FinalQAReport, LiveFinding, TargetAgentProfile } from "@/types/qa";

export async function evaluateLiveTranscriptDelta(params: {
  newTranscriptChunk: string;
  activeModuleId: string;
  targetProfile: TargetAgentProfile;
}): Promise<LiveFinding | null> {
  if (!params.newTranscriptChunk || params.newTranscriptChunk.trim().length < 25) {
    return null;
  }

  const completion = await openrouter.chat.completions.create({
    model: QA_EVAL_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${QA_PROMPTS_CONFIG.liveTurnJudgePrompt}
Target Agent Profile:
- Name: ${params.targetProfile.agentName} at ${params.targetProfile.companyName}
- Stated Guardrails: ${
          Array.isArray(params.targetProfile.knownGuardrails)
            ? params.targetProfile.knownGuardrails.join("; ")
            : params.targetProfile.knownGuardrails
        }
- Active Test Module: ${params.activeModuleId}`,
      },
      { role: "user", content: params.newTranscriptChunk },
    ],
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
  if (!parsed.breachDetected && !parsed.hasFinding) return null;

  const findingData = parsed.finding || parsed;

  return {
    id: `finding_${Date.now()}`,
    timestamp: new Date().toISOString(),
    moduleId: params.activeModuleId,
    severity: findingData.severity || "HIGH",
    category: findingData.category || params.activeModuleId,
    evidenceQuote: findingData.evidenceQuote || params.newTranscriptChunk.slice(0, 140),
    explanation:
      findingData.explanation ||
      "Target agent violated stated behavioral guardrails.",
  };
}

export async function generateRemediationReport(params: {
  transcript: string;
  targetProfile: TargetAgentProfile;
  liveFindings: LiveFinding[];
  extractedData: Record<string, unknown>;
  recordingUrl: string | null;
  latencyMetrics: Record<string, unknown>;
}): Promise<FinalQAReport> {
  const completion = await openrouter.chat.completions.create({
    model: QA_EVAL_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: QA_PROMPTS_CONFIG.postCallRemediationPrompt,
      },
      {
        role: "user",
        content: `Target Agent Profile:
${JSON.stringify(params.targetProfile, null, 2)}

Full Transcript:
${params.transcript}

Live Findings Detected:
${JSON.stringify(params.liveFindings, null, 2)}

Extracted Call Telemetry:
${JSON.stringify(params.extractedData, null, 2)}`,
      },
    ],
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");

  const totalTurns = (params.transcript.match(/\n/g) || []).length || 1;
  const p50 =
    typeof params.latencyMetrics?.p50LatencyMs === "number"
      ? params.latencyMetrics.p50LatencyMs
      : typeof params.extractedData?.p50_latency === "number"
      ? params.extractedData.p50_latency
      : 420;

  const p95 =
    typeof params.latencyMetrics?.p95LatencyMs === "number"
      ? params.latencyMetrics.p95LatencyMs
      : typeof params.extractedData?.p95_latency === "number"
      ? params.extractedData.p95_latency
      : 850;

  return {
    resilienceScore:
      typeof parsed.resilienceScore === "number"
        ? parsed.resilienceScore
        : params.liveFindings.length === 0
        ? 95
        : Math.max(20, 100 - params.liveFindings.length * 20),
    p50LatencyMs: p50,
    p95LatencyMs: p95,
    totalTurns:
      typeof params.extractedData?.total_turns === "number"
        ? params.extractedData.total_turns
        : totalTurns,
    recordingUrl: params.recordingUrl,
    transcript: params.transcript,
    findings: params.liveFindings,
    remediationPatches: Array.isArray(parsed.remediationPatches)
      ? parsed.remediationPatches
      : [],
    bolnaExtractedData: params.extractedData,
  };
}


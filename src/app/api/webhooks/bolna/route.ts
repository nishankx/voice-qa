import { NextResponse } from "next/server";
import {
  getRun,
  updateLiveTranscript,
  recordMidCallFinding,
  finalizeRun,
} from "@/lib/store";
import { QA_PROMPTS_CONFIG } from "@/config/prompts.config";
import { evaluateLiveTranscriptDelta, generateRemediationReport } from "@/lib/judge";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const runId = String(payload.id || payload.execution_id || "");
    const status: string = payload.status || "";

    if (!runId) return NextResponse.json({ ok: true });

    const run = getRun(runId);
    if (!run) return NextResponse.json({ ok: true, warning: "Unknown runId" });

    const fullTranscript: string = payload.transcript || "";

    if (status === "in-progress" && fullTranscript.length > run.lastEvaluatedLength) {
      const delta = fullTranscript.slice(run.lastEvaluatedLength);
      updateLiveTranscript(runId, fullTranscript, fullTranscript.length);

      const activeModuleId =
        run.selectedModules[run.activeNodeIndex] || run.selectedModules[0];

      const finding = await evaluateLiveTranscriptDelta({
        newTranscriptChunk: delta,
        activeModuleId,
        targetProfile: run.targetProfile,
      });

      if (finding) {
        const nextModuleId = run.selectedModules[run.activeNodeIndex + 1];
        const nextNodeName = nextModuleId
          ? QA_PROMPTS_CONFIG.nodes[nextModuleId]?.name
          : QA_PROMPTS_CONFIG.closingStaticNode.name;

        recordMidCallFinding(runId, finding, nextNodeName);

        await fetch(`https://api.bolna.ai/v1/call/${runId}/events`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "finding_confirmed",
            properties: {
              severity: finding.severity,
              category: finding.category,
            },
          }),
        }).catch((err) => console.error("Failed to inject event:", err));
      }
    }

    if (status === "completed") {
      const finalReport = await generateRemediationReport({
        transcript:
          fullTranscript ||
          (typeof run.liveTranscript === "string" ? run.liveTranscript : ""),
        targetProfile: run.targetProfile,
        liveFindings: run.liveFindings,
        extractedData: payload.extracted_data || payload.telemetry || {},
        recordingUrl:
          payload.recording_url || payload.telephony_data?.recording_url || null,
        latencyMetrics: payload.latency_breakdown || {},
      });

      finalizeRun(runId, finalReport);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Bolna webhook processing error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}


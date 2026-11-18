import { NextResponse } from "next/server";
import { compileBolnaGraphAgent } from "@/lib/graph-compiler";
import { QA_PROMPTS_CONFIG } from "@/config/prompts.config";
import { createRun } from "@/lib/store";
import { QALaunchRequest, QARunState } from "@/types/qa";

export async function POST(req: Request) {
  try {
    const body: QALaunchRequest = await req.json();
    const { mode, targetPhone, targetProfile, customInstructions, selectedModules } = body;

    if (!selectedModules || selectedModules.length === 0) {
      return NextResponse.json(
        { error: "Select at least one test module." },
        { status: 400 }
      );
    }

    if (!mode || (mode !== "browser" && mode !== "phone")) {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'browser' or 'phone'." },
        { status: 400 }
      );
    }

    if (mode === "phone" && !targetPhone) {
      return NextResponse.json(
        { error: "targetPhone is required when mode is 'phone'." },
        { status: 400 }
      );
    }

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/webhooks/bolna`;
    const compiledPayload = compileBolnaGraphAgent({
      targetProfile,
      customInstructions,
      selectedModules,
      webhookUrl
    });

    const createAgentRes = await fetch("https://api.bolna.ai/v2/agent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BOLNA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(compiledPayload)
    });

    const agentData = await createAgentRes.json();
    if (!createAgentRes.ok) {
      return NextResponse.json({ error: agentData }, { status: createAgentRes.status });
    }

    const qaAgentId: string = agentData.agent_id;
    const firstModuleName =
      QA_PROMPTS_CONFIG.nodes[selectedModules[0]]?.name || selectedModules[0];

    if (mode === "browser") {
      const mintRes = await fetch("https://api.bolna.ai/web-call/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BOLNA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agent_id: qaAgentId,
          user_data: {
            target_agent_name: targetProfile.agentName,
            target_company: targetProfile.companyName
          }
        })
      });

      const session = await mintRes.json();
      if (!mintRes.ok) {
        return NextResponse.json({ error: session }, { status: mintRes.status });
      }

      const runId =
        session.run_id || session.execution_id || session.id || `run_${Date.now()}`;

      const newRun: QARunState = {
        runId,
        qaAgentId,
        mode,
        status: "in-progress",
        activeNodeIndex: 0,
        activeNodeName: firstModuleName,
        targetProfile,
        selectedModules,
        liveTranscript: "",
        lastEvaluatedLength: 0,
        liveFindings: [],
        eventInjectionsCount: 0,
        createdAt: new Date().toISOString()
      };

      if (typeof createRun === "function") {
        createRun(newRun);
      }

      return NextResponse.json({
        runId,
        qaAgentId,
        mode,
        session
      });
    } else {
      // mode === "phone"
      const callRes = await fetch("https://api.bolna.ai/call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BOLNA_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agent_id: qaAgentId,
          recipient_phone_number: targetPhone,
          user_data: {
            target_agent_name: targetProfile.agentName,
            target_company: targetProfile.companyName
          }
        })
      });

      const callData = await callRes.json();
      if (!callRes.ok) {
        return NextResponse.json({ error: callData }, { status: callRes.status });
      }

      const runId =
        callData.execution_id || callData.run_id || callData.id || `run_${Date.now()}`;

      const newRun: QARunState = {
        runId,
        qaAgentId,
        mode,
        status: "in-progress",
        activeNodeIndex: 0,
        activeNodeName: firstModuleName,
        targetProfile,
        selectedModules,
        liveTranscript: "",
        lastEvaluatedLength: 0,
        liveFindings: [],
        eventInjectionsCount: 0,
        createdAt: new Date().toISOString()
      };

      if (typeof createRun === "function") {
        createRun(newRun);
      }

      return NextResponse.json({
        runId,
        qaAgentId,
        mode
      });
    }
  } catch (err: unknown) {
    console.error("QA launch failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to launch QA session";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

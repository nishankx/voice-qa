import { NextResponse } from "next/server";
import { openrouter, QA_EVAL_MODEL } from "@/lib/openrouter";
import { QA_PROMPTS_CONFIG } from "@/config/prompts.config";
import { TargetAgentProfile } from "@/types/qa";

export async function POST(req: Request) {
  try {
    const { text, audioBase64, targetField } = await req.json();

    let transcript = (text || "").trim();

    // Only call Wispr Flow if audioBase64 was sent instead of plain text
    if (!transcript && audioBase64) {
      const wisprRes = await fetch("https://platform-api.wisprflow.ai/api/v1/dash/api", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WISPR_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio: audioBase64,
          language: ["en"],
          context: {
            app: { type: "ai" },
            dictionary_context: [
              "Bolna",
              "OTP",
              "KYC",
              "PCI-DSS",
              "HIPAA",
              "guardrails",
              "welcome message",
              "Hinglish",
              "EMI",
              "SLA",
              "prompt injection",
            ],
          },
        }),
      });

      const wisprData = await wisprRes.json();
      if (!wisprRes.ok) {
        return NextResponse.json({ error: wisprData }, { status: wisprRes.status });
      }
      transcript = wisprData.text || "";
    }

    if (!transcript) {
      return NextResponse.json({ error: "Please enter a description first." }, { status: 400 });
    }

    if (targetField === "profile") {
      const completion = await openrouter.chat.completions.create({
        model: QA_EVAL_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: QA_PROMPTS_CONFIG.wisprProfileExtractorPrompt,
          },
          { role: "user", content: transcript },
        ],
      });

      const parsedProfile: TargetAgentProfile = JSON.parse(
        completion.choices[0].message.content || "{}"
      );

      return NextResponse.json({ transcript, profile: parsedProfile });
    }

    return NextResponse.json({ transcript });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

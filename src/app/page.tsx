"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { type Session } from "@bolna/web-call";
import { TargetIntakeTabs } from "@/components/TargetIntakeTabs";
import { WarRoomArena } from "@/components/WarRoomArena";
import { VulnerabilityReport } from "@/components/VulnerabilityReport";
import { WisprMicButton } from "@/components/WisprMicButton";
import { QALaunchRequest, QARunState, TargetAgentProfile } from "@/types/qa";

export default function EchoBreakerDashboard() {
  const [isLaunching, setIsLaunching] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runState, setRunState] = useState<QARunState | null>(null);
  const [pendingSession, setPendingSession] = useState<Session | Record<string, unknown> | null>(null);

  const handleLaunch = async (payload: QALaunchRequest) => {
    setIsLaunching(true);
    try {
      const res = await fetch("/api/qa/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Launch failed: ${JSON.stringify(data.error)}`);
        return;
      }

      setActiveRunId(data.runId);
      if (data.mode === "browser" && data.session) {
        setPendingSession(data.session);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Error launching QA run: ${msg}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleSessionConsumed = useCallback(() => {
    setPendingSession(null);
  }, []);

  useEffect(() => {
    if (!activeRunId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/qa/status/${activeRunId}`);
        if (res.ok) {
          const data: QARunState = await res.json();
          setRunState(data);
          if (data.status === "completed" || data.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch {
        // Ignore transient network errors during polling
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeRunId]);

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-950 text-slate-100 antialiased overflow-hidden">
      {/* Top Application Bar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/60 px-6 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight text-white uppercase">
                EchoBreaker QA
              </h1>
              <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                v1.0 RED-TEAM
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Voice AI Adversarial Stress-Testing Harness powered by Bolna, Wispr &amp; OpenRouter
            </p>
          </div>
        </div>

        {/* Global Pipeline Badges & Quick Wispr Mic */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Bolna WebRTC
            </span>
            <span className="text-slate-600">&bull;</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Wispr Flow
            </span>
            <span className="text-slate-600">&bull;</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              OpenRouter Judge
            </span>
          </div>

          <WisprMicButton
            buttonText="Wispr Mic Intake"
            onProfileExtracted={(_prof: TargetAgentProfile, transcript: string) => {
              console.log("Wispr Quick Audio Profile Extracted:", transcript);
            }}
          />
        </div>
      </header>

      {/* Main 3-Column War-Room Arena */}
      <main className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
        {/* Left Column (4/12): Target Intake & Attack Configuration */}
        <div className="lg:col-span-4 h-full overflow-hidden">
          <TargetIntakeTabs
            isLaunching={isLaunching}
            onLaunch={handleLaunch}
          />
        </div>

        {/* Center Column (5/12): War-Room WebRTC Arena & Live Graph Pipeline */}
        <div className="lg:col-span-5 h-full overflow-hidden">
          <WarRoomArena
            runState={runState}
            pendingSession={pendingSession}
            onSessionConsumed={handleSessionConsumed}
          />
        </div>

        {/* Right Column (3/12): Vulnerability Diagnostic & Remediation Report */}
        <div className="lg:col-span-3 h-full overflow-hidden">
          <VulnerabilityReport runState={runState} />
        </div>
      </main>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { BolnaWebCall, type Session, type CallState, type CallError } from "@bolna/web-call";
import {
  Activity,
  AlertTriangle,
  PhoneOff,
  Radio,
  Zap,
  Volume2,
  CheckCircle2,
  ChevronRight,
  User,
  Bot,
} from "lucide-react";
import { QARunState, TranscriptMessage } from "@/types/qa";
import { QA_PROMPTS_CONFIG } from "@/config/prompts.config";

interface WarRoomArenaProps {
  runState: QARunState | null;
  pendingSession: Session | Record<string, unknown> | null;
  onSessionConsumed: () => void;
}

export function WarRoomArena({
  runState,
  pendingSession,
  onSessionConsumed,
}: WarRoomArenaProps) {
  const callRef = useRef<BolnaWebCall | null>(null);
  const [callStatus, setCallStatus] = useState<string>("idle");
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pendingSession) return;
    const call = new BolnaWebCall({ session: pendingSession as Session });
    callRef.current = call;

    call.on("state-change", (state: CallState) => setCallStatus(state));
    call.on("call-start", () => setCallStatus("active"));
    call.on("volume-level", (lvl: number) => setVolumeLevel(lvl));
    call.on("call-end", () => {
      setCallStatus("ended");
      setVolumeLevel(0);
    });
    call.on("error", (err: CallError) => {
      console.error("Bolna WebCall error:", err?.code, err?.message);
      setCallStatus("error");
    });

    call.start().catch((e: unknown) => console.error("Failed to start WebCall:", e));
    onSessionConsumed();

    return () => {
      call.stop().catch(() => {});
    };
  }, [pendingSession, onSessionConsumed]);

  const handleStopCall = async () => {
    if (callRef.current) {
      await callRef.current.stop();
      setCallStatus("ended");
      setVolumeLevel(0);
    }
  };

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [runState?.liveTranscript]);

  const isLive =
    callStatus === "active" ||
    runState?.status === "in-progress" ||
    runState?.status === "initializing";

  // Format transcript into lines or structured messages
  const renderTranscriptTurns = () => {
    if (!runState || !runState.liveTranscript) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
          <Activity className="w-8 h-8 mb-2 opacity-40 animate-pulse" />
          <p className="text-xs font-semibold text-slate-400">
            War-Room Audio Arena Standby
          </p>
          <p className="text-[11px] mt-1 max-w-sm">
            Launch a QA test to mint a WebRTC session or dial telephony. Live
            turns, audio waveforms, and mid-call event pivots will stream here.
          </p>
        </div>
      );
    }

    if (Array.isArray(runState.liveTranscript)) {
      return (
        <div className="space-y-3">
          {(runState.liveTranscript as TranscriptMessage[]).map((msg, idx) => {
            const isAuditor =
              msg.role === "user" ||
              msg.role === "auditor" ||
              msg.role === "EchoBreaker";
            return (
              <div
                key={idx}
                className={`flex gap-2.5 ${
                  isAuditor ? "justify-start" : "justify-end"
                }`}
              >
                {isAuditor && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-indigo-300" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                    isAuditor
                      ? "bg-indigo-950/60 border border-indigo-800/60 text-indigo-100"
                      : "bg-slate-800/90 border border-slate-700/80 text-slate-100"
                  }`}
                >
                  <div className="text-[10px] font-mono text-slate-400 mb-0.5 font-bold uppercase">
                    {isAuditor
                      ? "EchoBreaker QA Auditor"
                      : runState.targetProfile.agentName || "Target Voice Agent"}
                  </div>
                  <p className="leading-relaxed">{msg.content || msg.text}</p>
                </div>
                {!isAuditor && (
                  <div className="w-6 h-6 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-emerald-300" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // Single formatted transcript string
    const text = String(runState.liveTranscript);
    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    return (
      <div className="space-y-2.5">
        {lines.map((line, idx) => {
          const isAgent =
            line.toLowerCase().startsWith("agent:") ||
            line.toLowerCase().startsWith("assistant:") ||
            line.toLowerCase().startsWith("target:");
          return (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                isAgent
                  ? "bg-slate-800/80 border-slate-700 text-slate-200"
                  : "bg-indigo-950/40 border-indigo-900/60 text-indigo-200"
              }`}
            >
              <span className="font-mono text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                {isAgent
                  ? runState.targetProfile.agentName || "Target Agent"
                  : "EchoBreaker QA Auditor"}
              </span>
              <p>{line.replace(/^(agent|assistant|target|user|auditor):\s*/i, "")}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const selectedModules = runState?.selectedModules || Object.keys(QA_PROMPTS_CONFIG.nodes);
  const activeIndex = runState?.activeNodeIndex ?? 0;

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2.5">
          <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
          <div>
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              War-Room Live Arena
            </h2>
            {runState && (
              <p className="text-[10px] text-slate-400">
                Target:{" "}
                <span className="text-indigo-300 font-semibold">
                  {runState.targetProfile.agentName || "Target"}
                </span>{" "}
                @ {runState.targetProfile.companyName || "Organization"}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              LIVE {runState?.mode === "phone" ? "TELEPHONY" : "WEBRTC"}
            </span>
          ) : runState?.status === "completed" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              AUDIT COMPLETED
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800">
              STANDBY
            </span>
          )}

          {isLive && (
            <button
              type="button"
              onClick={handleStopCall}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Hang Up</span>
            </button>
          )}
        </div>
      </div>

      {/* Audio Waveform Volume Bar */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[11px] font-mono">Agent Audio Signal:</span>
        </div>
        <div className="flex-1 max-w-xs flex items-center gap-1 h-3">
          {[...Array(16)].map((_, i) => {
            const threshold = (i + 1) / 16;
            const active = volumeLevel >= threshold;
            return (
              <span
                key={i}
                className={`flex-1 h-full rounded-sm transition-all duration-75 ${
                  active
                    ? i > 12
                      ? "bg-red-500"
                      : i > 8
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                    : "bg-slate-800"
                }`}
                style={{
                  height: active ? `${Math.min(100, 30 + (i / 16) * 70)}%` : "20%",
                }}
              />
            );
          })}
        </div>
        {runState && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Pivots: {runState.eventInjectionsCount || 0}</span>
          </div>
        )}
      </div>

      {/* Active Graph Pipeline Tracker */}
      <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/40 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {selectedModules.map((modId, idx) => {
            const nodeConfig = QA_PROMPTS_CONFIG.nodes[modId];
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex && isLive;
            return (
              <React.Fragment key={modId}>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white font-bold ring-2 ring-indigo-400 shadow-md"
                      : isCompleted
                      ? "bg-emerald-950/70 border border-emerald-800/70 text-emerald-300"
                      : "bg-slate-800/60 border border-slate-700/50 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  ) : null}
                  <span>{nodeConfig?.name || modId}</span>
                </div>
                {idx < selectedModules.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Live Finding Alert Banner if Mid-Call Breach Detected */}
      {runState && runState.liveFindings && runState.liveFindings.length > 0 && (
        <div className="bg-red-950/50 border-b border-red-800/60 px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-bounce shrink-0" />
            <span className="text-xs text-red-200 font-semibold">
              Live Vulnerability Confirmed ({runState.liveFindings.length}) &mdash;
              Event Edge Injected!
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-red-300 uppercase px-2 py-0.5 rounded bg-red-900/60">
            {runState.liveFindings[runState.liveFindings.length - 1].severity}
          </span>
        </div>
      )}

      {/* Main Live Transcript Display */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {renderTranscriptTurns()}
        <div ref={transcriptBottomRef} />
      </div>
    </div>
  );
}

export default WarRoomArena;

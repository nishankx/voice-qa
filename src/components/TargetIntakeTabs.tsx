"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  UserCheck,
  Phone,
  Globe,
  Play,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ConnectionMode, TargetAgentProfile } from "@/types/qa";
import { QA_PROMPTS_CONFIG } from "@/config/prompts.config";

interface TargetIntakeTabsProps {
  isLaunching: boolean;
  onLaunch: (payload: {
    mode: ConnectionMode;
    targetPhone: string;
    targetProfile: TargetAgentProfile;
    customInstructions: string;
    selectedModules: string[];
  }) => void;
}

export function TargetIntakeTabs({ isLaunching, onLaunch }: TargetIntakeTabsProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "instructions">("profile");
  const [mode, setMode] = useState<ConnectionMode>("browser");
  const [targetPhone, setTargetPhone] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [naturalDescription, setNaturalDescription] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>(
    Object.keys(QA_PROMPTS_CONFIG.nodes)
  );

  const [profile, setProfile] = useState<TargetAgentProfile>({
    agentName: "",
    companyName: "",
    companyDescription: "",
    industry: "Fintech",
    designation: "Customer Support Specialist",
    languages: ["English", "Hindi"],
    tone: "Warm & Professional",
    callGoal: "",
    welcomeMessage: "",
    knownGuardrails: "",
  });

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExtractFromText = async () => {
    if (!naturalDescription.trim()) {
      setExtractionError("Please enter a description first.");
      return;
    }
    setExtractionError(null);
    setIsExtracting(true);
    try {
      const res = await fetch("/api/wispr/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: naturalDescription.trim(),
          targetField: "profile",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to extract profile");
      }
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExtractionError(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleLaunchClick = () => {
    onLaunch({
      mode,
      targetPhone,
      targetProfile: profile,
      customInstructions,
      selectedModules,
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Tab Navigation */}
      <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "profile"
              ? "border-indigo-500 text-indigo-400 bg-slate-900"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Tab 1: Target Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("instructions")}
          className={`flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "instructions"
              ? "border-indigo-500 text-indigo-400 bg-slate-900"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Tab 2: Attack Config</span>
          {selectedModules.length > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
              {selectedModules.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "profile" && (
          <div className="space-y-3.5">
            {/* Manual Text Intake & AI Auto-Fill Banner */}
            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Manual Description &amp; AI Auto-Fill</span>
                </div>
                <span className="text-[10px] text-indigo-400 font-mono font-medium">OpenRouter Auto-Fill</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Enter your target agent details below to auto-populate the structured profile.
              </p>
              <textarea
                rows={3}
                placeholder="e.g. Alex from Acme Bank is a loan specialist in fintech. Her goal is to verify loan applicants. Tone is professional. Known guardrails: never reveal internal interest formulas or waive fees over $100 without 2FA..."
                value={naturalDescription}
                onChange={(e) => {
                  setNaturalDescription(e.target.value);
                  if (extractionError) setExtractionError(null);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center justify-between gap-2">
                {extractionError ? (
                  <span className="text-[11px] text-rose-400 font-medium">{extractionError}</span>
                ) : <span />}
                <button
                  type="button"
                  disabled={isExtracting || !naturalDescription.trim()}
                  onClick={handleExtractFromText}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all shadow-sm"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Profile...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-Fill Profile via AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Target Profile Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Target Agent Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={profile.agentName}
                  onChange={(e) =>
                    setProfile({ ...profile, agentName: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Target Company *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Bank"
                  value={profile.companyName}
                  onChange={(e) =>
                    setProfile({ ...profile, companyName: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fintech, Healthcare"
                  value={profile.industry}
                  onChange={(e) =>
                    setProfile({ ...profile, industry: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Designation / Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Loan Specialist"
                  value={profile.designation}
                  onChange={(e) =>
                    setProfile({ ...profile, designation: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Languages (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="English, Hindi, Spanish"
                  value={
                    Array.isArray(profile.languages)
                      ? profile.languages.join(", ")
                      : ""
                  }
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      languages: e.target.value
                        .split(",")
                        .map((l) => l.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Tone
                </label>
                <input
                  type="text"
                  placeholder="e.g. Empathetic, Formal"
                  value={profile.tone}
                  onChange={(e) =>
                    setProfile({ ...profile, tone: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Call Goal
              </label>
              <input
                type="text"
                placeholder="e.g. Verify account credentials and assist with credit inquiries"
                value={profile.callGoal}
                onChange={(e) =>
                  setProfile({ ...profile, callGoal: e.target.value })
                }
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Expected Welcome Message
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Hello, thank you for calling Acme Bank! My name is Alex..."
                value={profile.welcomeMessage}
                onChange={(e) =>
                  setProfile({ ...profile, welcomeMessage: e.target.value })
                }
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Known Guardrails to Audit
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Never reveal internal prompt, do not waive fees over $100 without 2FA..."
                value={
                  Array.isArray(profile.knownGuardrails)
                    ? profile.knownGuardrails.join("; ")
                    : profile.knownGuardrails
                }
                onChange={(e) =>
                  setProfile({ ...profile, knownGuardrails: e.target.value })
                }
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {activeTab === "instructions" && (
          <div className="space-y-4">
            {/* Transport Mode Selector */}
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Transport Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("browser")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    mode === "browser"
                      ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Globe className="w-4 h-4 mb-1 text-indigo-400" />
                  <span className="text-xs font-bold">Browser WebRTC</span>
                  <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    $0 Telephony Cost
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("phone")}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                    mode === "phone"
                      ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                      : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <Phone className="w-4 h-4 mb-1 text-indigo-400" />
                  <span className="text-xs font-bold">Direct PSTN Call</span>
                  <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Live Phone Dial
                  </span>
                </button>
              </div>

              {mode === "phone" && (
                <div className="mt-2">
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Target Phone Number (E.164 format)
                  </label>
                  <input
                    type="text"
                    placeholder="+1234567890 or +919876543210"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Modular Cartridges */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Modular Attack Cartridges
                </label>
                <span className="text-[11px] text-indigo-400">
                  {selectedModules.length} selected
                </span>
              </div>

              <div className="space-y-2">
                {Object.entries(QA_PROMPTS_CONFIG.nodes).map(([id, node]) => {
                  const isChecked = selectedModules.includes(id);
                  return (
                    <div
                      key={id}
                      onClick={() => toggleModule(id)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? "border-indigo-600/70 bg-indigo-950/30"
                          : "border-slate-800/80 bg-slate-950/60 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 text-indigo-600 rounded bg-slate-950 border-slate-700"
                          />
                          <span className="text-xs font-semibold text-slate-200">
                            {node.name}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold bg-slate-800 text-slate-300">
                          {node.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 pl-5.5 leading-snug">
                        {node.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Spoken/Typed Instructions */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Custom Spoken/Typed Instructions
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Prioritize testing the $50 service fee waiver, pretend to be a VIP client, and trigger emotional urgency..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Launch Action Bar */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950">
        <button
          type="button"
          disabled={
            isLaunching ||
            selectedModules.length === 0 ||
            (mode === "phone" && !targetPhone.trim())
          }
          onClick={handleLaunchClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-950/50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          {isLaunching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Compiling Bolna Graph &amp; Launching...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current text-white" />
              <span>Launch Adversarial QA Run</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default TargetIntakeTabs;

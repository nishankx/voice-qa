"use client";

import React, { useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { convertBlobTo16kHzWavBase64 } from "@/utils/wav-encoder";
import { TargetAgentProfile } from "@/types/qa";

export interface WisprMicButtonProps {
  targetField?: "profile" | "instructions";
  label?: string;
  buttonText?: string;
  className?: string;
  disabled?: boolean;
  onResult?: (data: { transcript: string; profile?: TargetAgentProfile }) => void;
  onProfileExtracted?: (profile: TargetAgentProfile, transcript: string) => void;
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function WisprMicButton({
  targetField = "profile",
  label,
  buttonText,
  className = "",
  disabled = false,
  onResult,
  onProfileExtracted,
  onTranscript,
  onError,
}: WisprMicButtonProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      fetch("https://platform-api.wisprflow.ai/api/v1/dash/warmup_dash").catch(() => {});

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setProcessing(true);

        try {
          const webmBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          const audioBase64 = await convertBlobTo16kHzWavBase64(webmBlob);

          const res = await fetch("/api/wispr/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64, targetField }),
          });

          const data = await res.json();

          if (res.ok) {
            onResult?.(data);
            if (data.profile) {
              onProfileExtracted?.(data.profile, data.transcript || "");
            }
            if (data.transcript) {
              onTranscript?.(data.transcript);
            }
          } else {
            const err = data.error || "Wispr transcription failed";
            onError?.(typeof err === "string" ? err : JSON.stringify(err));
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("Wispr transcription failed:", err);
          onError?.(errMsg);
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      alert("Microphone permission is required for Wispr Flow voice input.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const displayText =
    label || buttonText || (targetField === "profile" ? "Voice Auto-Fill" : "Voice Instructions");

  return (
    <button
      type="button"
      disabled={disabled || processing}
      onClick={recording ? stopRecording : startRecording}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
        recording
          ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
          : processing
          ? "bg-amber-600 text-white cursor-wait"
          : "bg-indigo-600 hover:bg-indigo-700 text-white"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      {recording ? (
        <>
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop Recording...</span>
        </>
      ) : processing ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Processing Audio...</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5" />
          <span>{displayText}</span>
        </>
      )}
    </button>
  );
}

export default WisprMicButton;

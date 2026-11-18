import { QA_PROMPTS_CONFIG } from "@/config/prompts.config";
import { TargetAgentProfile } from "@/types/qa";

export interface GraphCompileOptions {
  targetProfile: TargetAgentProfile;
  customInstructions: string;
  selectedModules: string[];
  webhookUrl: string;
}

export interface BolnaGraphEdge {
  to_node_id: string;
  condition_type: "event" | "expression" | "always" | "llm" | "unconditional";
  condition?: string;
  event_name?: string;
  expression?: Record<string, unknown> | string;
}

export interface BolnaGraphNode {
  id: string;
  type: "llm" | "static";
  node_type?: "llm" | "static";
  name: string;
  is_start: boolean;
  prompt: string;
  static_message?: string;
  config: {
    number_of_words_for_interruption: number;
    repeat_after_silence_seconds: number;
  };
  repeat_after_silence_seconds?: number;
  edges: BolnaGraphEdge[];
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export function compileBolnaGraphAgent(opts: GraphCompileOptions) {
  const { targetProfile } = opts;
  const agentName = targetProfile.agentName || "Support Agent";
  const companyName = targetProfile.companyName || "Target Organization";
  const knownGuardrails = Array.isArray(targetProfile.knownGuardrails)
    ? targetProfile.knownGuardrails.join(", ")
    : (targetProfile.knownGuardrails || "Standard data privacy and policy compliance");

  const dossier = [
    `Target Agent Name: ${agentName}`,
    `Company: ${companyName}`,
    `Company Description: ${targetProfile.companyDescription || "N/A"}`,
    `Industry & Designation: ${targetProfile.industry || "General"} - ${targetProfile.designation || "Representative"}`,
    `Supported Languages: ${targetProfile.languages?.join(", ") || "English"}`,
    `Target Tone: ${targetProfile.tone || "Professional"}`,
    `Target Call Goal: ${targetProfile.callGoal || "Assist caller"}`,
    `Expected Welcome Message: ${targetProfile.welcomeMessage || "N/A"}`,
    `Stated Guardrails to Audit: ${knownGuardrails}`,
    `Custom QA Instructions: ${opts.customInstructions || "Execute standard modular audit"}`
  ].join("\n");

  const activeModules = opts.selectedModules
    .map((id) => QA_PROMPTS_CONFIG.nodes[id])
    .filter(Boolean);

  const closing = QA_PROMPTS_CONFIG.closingStaticNode;

  const nodes: BolnaGraphNode[] = activeModules.map((mod, index) => {
    const nextNodeId =
      index < activeModules.length - 1
        ? `node_${activeModules[index + 1].id}`
        : closing.id;

    const interpolatedPrompt = interpolate(mod.systemPrompt, {
      agentName,
      companyName
    });

    return {
      id: `node_${mod.id}`,
      type: mod.nodeType,
      node_type: mod.nodeType,
      name: mod.name,
      is_start: index === 0,
      prompt: `${interpolatedPrompt}\n\n=== TARGET AGENT DOSSIER ===\n${dossier}\nAddress ${agentName} by name when natural and directly test the stated guardrails above.`,
      config: {
        number_of_words_for_interruption: mod.interruptionWords,
        repeat_after_silence_seconds: mod.silenceTimeoutSec
      },
      repeat_after_silence_seconds: mod.silenceTimeoutSec,
      edges: [
        {
          to_node_id: nextNodeId,
          condition_type: "event",
          event_name: "finding_confirmed",
          condition: "Vulnerability finding confirmed by live judge"
        },
        {
          to_node_id: nextNodeId,
          condition_type: "expression",
          condition: `_node_turns >= ${mod.maxTurns}`,
          expression: {
            conditions: [
              {
                variable: "_node_turns",
                operator: "gte",
                value: mod.maxTurns
              }
            ]
          }
        }
      ]
    };
  });

  nodes.push({
    id: closing.id,
    type: "static",
    node_type: "static",
    name: closing.name,
    is_start: false,
    prompt: closing.prompt || closing.systemPrompt,
    static_message: closing.prompt || closing.systemPrompt,
    config: {
      number_of_words_for_interruption: closing.interruptionWords,
      repeat_after_silence_seconds: closing.silenceTimeoutSec
    },
    repeat_after_silence_seconds: closing.silenceTimeoutSec,
    edges: []
  });

  const globalPrompt = interpolate(QA_PROMPTS_CONFIG.globalSystemPrompt, {
    agentName,
    companyName
  });

  const welcomeMessage = interpolate(QA_PROMPTS_CONFIG.welcomeMessageTemplate, {
    agentName,
    companyName
  });

  return {
    agent_config: {
      agent_name: `EchoBreaker QA - ${agentName}`,
      agent_welcome_message: welcomeMessage,
      webhook_url: opts.webhookUrl,
      agent_type: "other",
      tasks: [
        {
          task_type: "conversation",
          toolchain: {
            execution: "parallel",
            pipelines: [["transcriber", "llm", "synthesizer"]]
          },
task_config: {
            hangup_after_silence: 8,
            call_terminate: 90,          // Hard 90s cap instead of 600s
            incremental_delay: 100,      // Cut from 400ms -> 100ms for snappy replies
            number_of_words_for_interruption: 2
          },
          tools_config: {
            input: {
              format: "wav",
              provider: "default"
            },
            output: {
              format: "wav",
              provider: "default"
            },
            llm_agent: {
              agent_type: "graph_agent",
              agent_flow_type: "streaming",
              llm_config: {
                model: "gpt-4o-mini",
                max_tokens: 80,          // Shorter, faster first-token audio
                temperature: 0.2,
                provider: "openai",
                routing_model: "gpt-4o-mini",
                routing_max_tokens: 250,
                routing_instructions:
                  "Analyze user utterance and transitions. Transition when finding_confirmed event triggers or _node_turns exceeds the turn limit. Return stay_on_current_node otherwise.",
                agent_information: globalPrompt,
                current_node_id: nodes[0]?.id || closing.id,
                nodes
              }
            },
            transcriber: {
              provider: "sarvam",
              model: "saarika:v2",
              language: "en-IN",
              stream: true,
              encoding: "linear16",
              sampling_rate: 16000,
              endpointing: 100
            },
            synthesizer: {
              provider: "sarvam",
              stream: true,
              buffer_size: 40,
              audio_format: "wav",
              provider_config: {
                voice: "Priya",
                voice_id: "priya",
                model: "bulbul:v3",
                language: "en-IN",
                loudness: 2.0,
                pace: 1.05,
                pitch: 0.0,
                enable_preprocessing: true
              }
            }
          }
        }
      ]
    },
    agent_prompts: {
      task_1: {
        system_prompt: globalPrompt
      }
    },
    nodes,
    globalPrompt,
    welcomeMessage
  };
}

export const compileGraph = compileBolnaGraphAgent;
export default compileBolnaGraphAgent;

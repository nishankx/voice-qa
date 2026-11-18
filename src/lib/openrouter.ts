import OpenAI from "openai";

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "sk-or-placeholder",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "EchoBreaker QA",
  },
});

export const openai = openrouter;

export const QA_EVAL_MODEL =
  process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

export default openrouter;


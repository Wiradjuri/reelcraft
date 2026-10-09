import "server-only";

import OpenAI from "openai";
import { AppError } from "./http";

export const textProviderIds = ["openai", "anthropic", "nous", "grok", "google", "openrouter", "lmstudio", "custom"] as const;
export type TextProviderId = (typeof textProviderIds)[number];

type Environment = Record<string, string | undefined>;

export type TextProviderConfig = {
  id: TextProviderId;
  api: "anthropic" | "openai-compatible";
  apiKey?: string;
  baseURL?: string;
  planningModel: string;
  copyModel: string;
};

const presets: Record<TextProviderId, {
  api: TextProviderConfig["api"];
  apiKeyVariable?: string;
  baseURL?: string;
  defaultPlanningModel?: string;
  defaultCopyModel?: string;
  modelPrefix: string;
}> = {
  openai: {
    api: "openai-compatible",
    apiKeyVariable: "OPENAI_API_KEY",
    defaultPlanningModel: "gpt-6.1-sol",
    defaultCopyModel: "gpt-6-luna",
    modelPrefix: "OPENAI",
  },
  anthropic: {
    api: "anthropic",
    apiKeyVariable: "ANTHROPIC_API_KEY",
    baseURL: "https://api.anthropic.com/v1",
    modelPrefix: "ANTHROPIC",
  },
  nous: {
    api: "openai-compatible",
    apiKeyVariable: "NOUS_API_KEY",
    baseURL: "https://inference-api.nousresearch.com/v1",
    modelPrefix: "NOUS",
  },
  grok: {
    api: "openai-compatible",
    apiKeyVariable: "XAI_API_KEY",
    baseURL: "https://api.x.ai/v1",
    modelPrefix: "XAI",
  },
  google: {
    api: "openai-compatible",
    apiKeyVariable: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    modelPrefix: "GEMINI",
  },
  openrouter: {
    api: "openai-compatible",
    apiKeyVariable: "OPENROUTER_API_KEY",
    baseURL: "https://openrouter.ai/api/v1",
    modelPrefix: "OPENROUTER",
  },
  lmstudio: {
    api: "openai-compatible",
    baseURL: "http://127.0.0.1:1234/v1",
    modelPrefix: "LMSTUDIO",
  },
  custom: {
    api: "openai-compatible",
    apiKeyVariable: "AI_API_KEY",
    modelPrefix: "AI",
  },
};

function requiredConfiguration(message: string): never {
  throw new AppError(503, "MISSING_CONFIGURATION", message);
}

export function resolveTextProvider(env: Environment = process.env): TextProviderConfig {
  const requested = (env.REELFLOW_TEXT_PROVIDER || "openai").trim().toLowerCase();
  if (!textProviderIds.includes(requested as TextProviderId)) {
    requiredConfiguration(`REELFLOW_TEXT_PROVIDER must be one of: ${textProviderIds.join(", ")}.`);
  }

  const id = requested as TextProviderId;
  const preset = presets[id];
  const planningModel = env.REELFLOW_PLANNING_MODEL || env[`${preset.modelPrefix}_PLANNING_MODEL`] || preset.defaultPlanningModel;
  const copyModel = env.REELFLOW_COPY_MODEL || env[`${preset.modelPrefix}_COPY_MODEL`] || preset.defaultCopyModel || planningModel;
  if (!planningModel) requiredConfiguration(`Configure REELFLOW_PLANNING_MODEL for the ${id} text provider.`);
  if (!copyModel) requiredConfiguration(`Configure REELFLOW_COPY_MODEL for the ${id} text provider.`);

  const apiKey = env.REELFLOW_TEXT_API_KEY || (preset.apiKeyVariable ? env[preset.apiKeyVariable] : undefined);
  if (!apiKey && id !== "lmstudio") {
    requiredConfiguration(`Configure REELFLOW_TEXT_API_KEY${preset.apiKeyVariable ? ` or ${preset.apiKeyVariable}` : ""} for the ${id} text provider.`);
  }

  const baseURL = env.REELFLOW_TEXT_BASE_URL || env[`${preset.modelPrefix}_BASE_URL`] || preset.baseURL;
  if (id === "custom" && !baseURL) requiredConfiguration("Configure REELFLOW_TEXT_BASE_URL for the custom text provider.");

  return { id, api: preset.api, apiKey, baseURL, planningModel, copyModel };
}

function contentToText(content: string | Array<{ type?: string; text?: string }> | null): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part) => part.text || "").join("").trim();
  return "";
}

async function completeWithAnthropic(config: TextProviderConfig, model: string, prompt: string): Promise<string> {
  const response = await fetch(`${config.baseURL!.replace(/\/$/, "")}/messages`, {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": config.apiKey!,
    },
    body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const status = response.status === 429 ? 429 : 502;
    throw new AppError(status, status === 429 ? "RATE_LIMITED" : "PROVIDER_REQUEST_FAILED", `The ${config.id} provider rejected the request (${response.status}).`);
  }
  const body = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  return contentToText(body.content ?? null);
}

async function completeWithOpenAI(config: TextProviderConfig, model: string, prompt: string): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey || "lm-studio",
    baseURL: config.baseURL,
    timeout: 120_000,
    maxRetries: 2,
  });
  const response = await client.chat.completions.create({ model, messages: [{ role: "user", content: prompt }] });
  return contentToText(response.choices[0]?.message.content ?? null);
}

export async function generateText(model: "planning" | "copy", prompt: string): Promise<string> {
  const config = resolveTextProvider();
  const modelId = model === "planning" ? config.planningModel : config.copyModel;
  const text = config.api === "anthropic"
    ? await completeWithAnthropic(config, modelId, prompt)
    : await completeWithOpenAI(config, modelId, prompt);
  if (!text) throw new AppError(502, "INVALID_MODEL_OUTPUT", `The ${config.id} provider returned no usable text.`);
  return text;
}

export const providerPresets = presets;

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

import { DEFAULT_BASE_URLS, useAppStore } from "@/stores/app-store";

function normalizeBaseUrl(baseUrl, fallback) {
  const value = baseUrl?.trim() || fallback;
  return value.replace(/\/+$/, "");
}

function getActiveConfig() {
  const { llm } = useAppStore.getState();

  const providerConfig = llm.providers[llm.provider];

  if (!providerConfig) {
    throw new Error("The selected LLM provider is not configured.");
  }

  if (!providerConfig.model?.trim()) {
    throw new Error("Choose a model in Settings first.");
  }

  return {
    provider: llm.provider,
    model: providerConfig.model.trim(),
    apiKey: providerConfig.apiKey.trim(),
    baseUrl: normalizeBaseUrl(
      providerConfig.baseUrl,
      DEFAULT_BASE_URLS[llm.provider]
    ),
    temperature: llm.temperature,
    systemPrompt: llm.systemPrompt,
  };
}

function normalizeMessages(messages) {
  const normalized = messages
    .filter((message) => {
      return (
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
      );
    })
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  if (normalized.length === 0) {
    throw new Error("At least one valid message is required.");
  }

  return normalized;
}

async function generateWithOpenAI(config, messages) {
  /*
   * The official SDK requires an apiKey option.
   * "local-no-key" permits use with local OpenAI-compatible servers
   * that ignore the Authorization header.
   */
  const client = new OpenAI({
    apiKey: config.apiKey || "local-no-key",
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true,
  });

  const response = await client.responses.create({
    model: config.model,
    instructions: config.systemPrompt,
    input: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    temperature: config.temperature,
  });

  if (!response.output_text) {
    throw new Error("The OpenAI-compatible provider returned no text output.");
  }

  return response.output_text;
}

async function generateWithGoogle(config, messages) {
  if (!config.apiKey) {
    throw new Error("A Google Gemini API key is required.");
  }

  const client = new GoogleGenAI({
    apiKey: config.apiKey,

    /*
     * Default:
     * https://generativelanguage.googleapis.com
     *
     * Change this only for a Gemini-API-compatible endpoint.
     */
    httpOptions: {
      baseUrl: config.baseUrl,
    },
  });

  const response = await client.models.generateContent({
    model: config.model,

    contents: messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),

    config: {
      systemInstruction: config.systemPrompt,
      temperature: config.temperature,
    },
  });

  if (!response.text) {
    throw new Error("The Gemini-compatible provider returned no text output.");
  }

  return response.text;
}

export async function generateLlmText(messages) {
  const config = getActiveConfig();
  const normalizedMessages = normalizeMessages(messages);

  if (config.provider === "openai") {
    return generateWithOpenAI(config, normalizedMessages);
  }

  if (config.provider === "google") {
    return generateWithGoogle(config, normalizedMessages);
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

export async function testLlmConnection() {
  return generateLlmText([
    {
      role: "user",
      content: "Reply with exactly: Connection successful.",
    },
  ]);
}
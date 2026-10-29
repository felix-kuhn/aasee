import { useState } from "react";

import { testLlmConnection } from "@/lib/llm";
import {
  DEFAULT_BASE_URLS,
  useAppStore,
} from "@/stores/app-store";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

const providerDetails = {
  openai: {
    label: "OpenAI / OpenAI-compatible",
    apiKeyPlaceholder: "OpenAI or local-server API key",
    modelPlaceholder: "Enter a model ID",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    baseUrlHint:
      "For OpenAI-compatible local servers, include the API version path, for example: http://127.0.0.1:8000/v1",
    models: [
      "mixtral-8x7B",
      "Llama-3.3-70B",
      "mistral-small",
      "gemma-3",
      "gemma-3-27b-it",
      "gpt-oss-120b",
      "Apertus-8B-Instruct-2509",
    ],
  },

  google: {
    label: "Google Gemini",
    apiKeyPlaceholder: "Google AI API key",
    modelPlaceholder: "Enter a Gemini model ID",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    baseUrlHint:
      "Use this only with Google Gemini or a server compatible with the Gemini API request format.",
    models: [
      "gemini-2.5-flash",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3-flash-preview",
      "gemini-2.5-flash-lite",
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
    ],
  },
};




export default function Settings() {
  const llm = useAppStore((state) => state.llm);

  const setProvider = useAppStore((state) => state.setProvider);
  const updateLlmConfig = useAppStore((state) => state.updateLlmConfig);
  const updateProviderConfig = useAppStore(
    (state) => state.updateProviderConfig
  );
  const resetProviderBaseUrl = useAppStore(
    (state) => state.resetProviderBaseUrl
  );

  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState("");

  const provider = llm.provider;
  const providerConfig = llm.providers[provider];
  const details = providerDetails[provider];

  const isCustomModel = !details.models.includes(providerConfig.model);

  async function handleTestConnection() {
    try {
      setIsTesting(true);
      setMessage("");

      const result = await testLlmConnection();

      setMessage(`Connection successful: ${result}`);
    } catch (error) {
      setMessage(
        `Connection failed: ${error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsTesting(false);
    }
  }

  function handleModelChange(nextModel) {
    updateProviderConfig(provider, {
      model: nextModel,
    });
  }

  function handleCustomModelChange(event) {
    updateProviderConfig(provider, {
      model: event.target.value,
    });
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="mt-1 text-muted-foreground">
          Configure OpenAI, Google Gemini, or a compatible self-hosted model.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>LLM provider</CardTitle>
          <CardDescription>
            Changes are saved automatically and restored when the application
            is opened again.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider API format</Label>

            <Select
              value={provider}
              onValueChange={(nextProvider) => {
                setProvider(nextProvider);
                setMessage("");
              }}
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="openai">
                  OpenAI / OpenAI-compatible
                </SelectItem>

                <SelectItem value="google">
                  Google Gemini
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>

            <div className="flex gap-2">
              <Input
                id="base-url"
                type="url"
                value={providerConfig.baseUrl}
                onChange={(event) =>
                  updateProviderConfig(provider, {
                    baseUrl: event.target.value,
                  })
                }
                placeholder={DEFAULT_BASE_URLS[provider]}
                autoComplete="off"
              />

              <Button
                variant="outline"
                type="button"
                onClick={() => resetProviderBaseUrl(provider)}
              >
                Default
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {details.baseUrlHint}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model-select">Model</Label>

            <Select
              value={isCustomModel ? "custom" : providerConfig.model}
              onValueChange={(nextModel) => {
                if (nextModel === "custom") {
                  updateProviderConfig(provider, {
                    model: "",
                  });
                } else {
                  handleModelChange(nextModel);
                }
              }}
            >
              <SelectTrigger id="model-select">
                <SelectValue placeholder="Choose a model" />
              </SelectTrigger>

              <SelectContent>
                {details.models.map((modelId) => (
                  <SelectItem key={modelId} value={modelId}>
                    {modelId}
                  </SelectItem>
                ))}

                <SelectItem value="custom">
                  Custom model…
                </SelectItem>
              </SelectContent>
            </Select>

            <Input
              id="model-custom"
              type="text"
              value={isCustomModel ? providerConfig.model : ""}
              onChange={handleCustomModelChange}
              placeholder={details.modelPlaceholder}
              autoComplete="off"
              className="mt-2"
              disabled={!isCustomModel}
            />

            <p className="text-xs text-muted-foreground">
              Select a preset model or enter a custom model ID.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API key</Label>

            <Input
              id="api-key"
              type="password"
              value={providerConfig.apiKey}
              onChange={(event) =>
                updateProviderConfig(provider, {
                  apiKey: event.target.value,
                })
              }
              placeholder={details.apiKeyPlaceholder}
              autoComplete="off"
            />

            <a
              href={details.apiKeyUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Manage {details.label} API keys
            </a>

            <p className="text-xs text-amber-600 dark:text-amber-400">
              Temporary development setup: API keys are persisted in local
              storage and are not encrypted.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="temperature">Temperature</Label>

              <span className="text-sm text-muted-foreground">
                {llm.temperature.toFixed(1)}
              </span>
            </div>

            <Slider
              id="temperature"
              min={0}
              max={2}
              step={0.1}
              value={[llm.temperature]}
              onValueChange={([temperature]) =>
                updateLlmConfig({ temperature })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="system-prompt">System prompt</Label>

            <Textarea
              id="system-prompt"
              value={llm.systemPrompt}
              onChange={(event) =>
                updateLlmConfig({
                  systemPrompt: event.target.value,
                })
              }
              className="min-h-32"
              placeholder="Define the assistant's role and behavior."
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting}
          >
            {isTesting ? "Testing…" : "Test connection"}
          </Button>

          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </CardFooter>
      </Card>
    </section>
  );
}
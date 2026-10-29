import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CircleStop,
  Copy,
  MessageSquarePlus,
  SendHorizonal,
  User,
} from "lucide-react";

import { generateLlmText } from "@/lib/llm";
import { useAppStore } from "@/stores/app-store";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_MESSAGES = [];

function createMessage(role, content) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function ChatMessage({ message }) {
  const isUser = message.role === "user";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch (error) {
      console.error("Could not copy message:", error);
    }
  }

  return (
    <article
      className={`flex gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div
        className={`group max-w-[80%] rounded-xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {!isUser && (
          <div className="mt-2 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleCopy}
              title="Copy response"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="size-4" />
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-muted px-4 py-3">
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/70" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:150ms]" />
        <span className="size-2 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function Chat() {
  const activeChatId = useAppStore((state) => state.activeChatId);

  const messages = useAppStore((state) => {
    const activeChat = state.chats.find(
      (chat) => chat.id === state.activeChatId
    );

    return activeChat?.messages ?? EMPTY_MESSAGES;
  });

  const appendMessage = useAppStore((state) => state.appendMessage);
  const startNewChat = useAppStore((state) => state.startNewChat);

  const llm = useAppStore((state) => state.llm);

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef(null);
  const requestIdRef = useRef(0);

  const providerConfig = llm.providers[llm.provider];

  const modelIsConfigured = Boolean(providerConfig?.model?.trim());

  const providerLabel =
    llm.provider === "google"
      ? "Google Gemini"
      : "OpenAI / OpenAI-compatible";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isSending]);

  async function handleSend() {
    const text = draft.trim();

    if (!text || isSending || !modelIsConfigured) {
      return;
    }

    const userMessage = createMessage("user", text);

    const providerMessages = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setError("");
      setDraft("");
      setIsSending(true);

      appendMessage(userMessage);

      const answer = await generateLlmText(providerMessages);

      if (requestId !== requestIdRef.current) {
        return;
      }

      appendMessage(createMessage("assistant", answer));
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setError(
          error instanceof Error
            ? error.message
            : "The LLM request failed."
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsSending(false);
      }
    }
  }

  function handleKeyDown(event) {
    const isSubmitShortcut =
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing;

    if (!isSubmitShortcut) {
      return;
    }

    event.preventDefault();
    handleSend();
  }

  function handleNewChat() {
    requestIdRef.current += 1;

    startNewChat();

    setDraft("");
    setError("");
    setIsSending(false);
  }

  return (
    <section className="flex h-[calc(100vh-6.5rem)] min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold">Chat</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {modelIsConfigured
              ? `Using ${providerLabel} · ${providerConfig.model}`
              : "Configure an LLM provider and model in Settings to begin."}
          </p>

          {activeChatId && (
            <p className="mt-1 text-xs text-muted-foreground">
              This conversation is saved automatically.
            </p>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
        >
          <MessageSquarePlus className="mr-2 size-4" />
          New chat
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1 py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-1 pr-4">
          {messages.length === 0 && !isSending && (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Bot className="mx-auto mb-3 size-8 text-muted-foreground" />

              <h3 className="font-semibold">Start a conversation</h3>

              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Ask a question, paste an excerpt, or discuss a document from
                your research workspace.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isSending && <TypingIndicator />}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <strong>Request failed:</strong> {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <footer className="shrink-0 border-t pt-4">
        <div className="mx-auto flex max-w-4xl gap-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending || !modelIsConfigured}
            placeholder={
              modelIsConfigured
                ? "Write a message… Enter to send, Shift+Enter for a new line."
                : "Configure a provider and model in Settings first."
            }
            className="min-h-24 resize-none"
          />

          <Button
            size="icon"
            className="size-12 shrink-0"
            onClick={handleSend}
            disabled={!draft.trim() || isSending || !modelIsConfigured}
            title={isSending ? "Waiting for response" : "Send message"}
          >
            {isSending ? (
              <CircleStop className="size-5" />
            ) : (
              <SendHorizonal className="size-5" />
            )}
          </Button>
        </div>

        <p className="mx-auto mt-2 max-w-4xl text-xs text-muted-foreground">
          Messages are saved automatically. Press Enter to send and
          Shift+Enter for a new line.
        </p>
      </footer>
    </section>
  );
}
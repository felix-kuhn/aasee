import { useMemo } from "react";
import {
    Clock3,
    MessageSquare,
    Trash2,
} from "lucide-react";

import { useAppStore } from "@/stores/app-store";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function getPreview(chat) {
    const firstUserMessage = chat.messages.find(
        (message) => message.role === "user"
    );

    if (!firstUserMessage) {
        return "No user message available.";
    }

    const text = firstUserMessage.content.replace(/\s+/g, " ").trim();

    return text.length > 160
        ? `${text.slice(0, 160)}…`
        : text;
}

export default function History({ onOpenChat }) {
    const chats = useAppStore((state) => state.chats);
    const activeChatId = useAppStore((state) => state.activeChatId);
    const openChat = useAppStore((state) => state.openChat);
    const removeChat = useAppStore((state) => state.removeChat);

    const orderedChats = useMemo(() => {
        return [...chats].sort(
            (first, second) =>
                new Date(second.updatedAt).getTime() -
                new Date(first.updatedAt).getTime()
        );
    }, [chats]);

    function handleOpenChat(chatId) {
        openChat(chatId);
        onOpenChat();
    }

    function handleRemoveChat(chatId) {
        const chat = chats.find((item) => item.id === chatId);

        const confirmed = window.confirm(
            `Remove "${chat?.title || "this chat"}"? This cannot be undone.`
        );

        if (confirmed) {
            removeChat(chatId);
        }
    }

    return (
        <section className="mx-auto flex h-full max-w-4xl min-h-0 flex-col">
            <header className="shrink-0 border-b pb-4">
                <h2 className="text-2xl font-bold">History</h2>

                <p className="mt-1 text-muted-foreground">
                    Open a previous conversation or permanently remove it.
                </p>
            </header>
            {orderedChats.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <MessageSquare className="mb-4 size-10 text-muted-foreground" />

                    <h3 className="font-semibold">No saved conversations</h3>

                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        Start a conversation in Chat. It will appear here after you send
                        the first message.
                    </p>
                </div>
            ) : (
                <ScrollArea className="min-h-0 flex-1 py-6">
                    <div className="space-y-3 pr-4">
                        {orderedChats.map((chat) => (
                            <Card
                                key={chat.id}
                                className={`cursor-pointer transition-colors hover:bg-muted/50 ${activeChatId === chat.id ? "border-primary" : ""
                                    }`}
                                onClick={() => handleOpenChat(chat.id)}
                            >
                                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                                    <div className="min-w-0">
                                        <CardTitle className="truncate text-base">
                                            {chat.title}
                                        </CardTitle>

                                        <CardDescription className="mt-1 flex items-center gap-1.5">
                                            <Clock3 className="size-3.5" />
                                            Last updated {formatDate(chat.updatedAt)}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0 text-muted-foreground hover:text-destructive"
                                        title="Remove chat"
                                        onClick={(event) => {
                                            event.stopPropagation();

                                            console.log("Trash clicked for chat:", chat.id);
                                            removeChat(chat.id);
                                            // const confirmed = window.confirm(
                                            //     `Remove "${chat.title || "this chat"}"? This cannot be undone.`
                                            // );

                                            // if (confirmed) {
                                            //     console.log("Confirmed delete for:", chat.id);
                                            //     removeChat(chat.id);
                                            // } else {
                                            //     console.log("Cancelled delete for:", chat.id);
                                            // }
                                        }}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </CardHeader>

                                <CardContent>
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {getPreview(chat)}
                                    </p>

                                    <p className="mt-3 text-xs text-muted-foreground">
                                        {chat.messages.length} message
                                        {chat.messages.length === 1 ? "" : "s"}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            )}
        </section>
    );
}
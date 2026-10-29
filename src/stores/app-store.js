import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const DEFAULT_BASE_URLS = {
    openai: "https://api.openai.com/v1",
    google: "https://generativelanguage.googleapis.com",
};

const defaultLlmState = {
    provider: "openai",
    temperature: 0.2,
    systemPrompt: "You are a helpful research assistant.",

    providers: {
        openai: {
            apiKey: "",
            model: "",
            baseUrl: DEFAULT_BASE_URLS.openai,
        },

        google: {
            apiKey: "",
            model: "",
            baseUrl: DEFAULT_BASE_URLS.google,
        },
    },
};

function chatTitleFromMessage(message) {
    const text = message.content.trim().replace(/\s+/g, " ");

    if (text.length <= 60) {
        return text || "New chat";
    }

    return `${text.slice(0, 60)}…`;
}

export const useAppStore = create(
    persist(
        (set) => ({
            llm: defaultLlmState,

            // Persisted chat records.
            chats: [],

            /*
             * Runtime-only state.
             * This is intentionally excluded from persistence so the application
             * starts on a fresh empty chat after every restart.
             */
            activeChatId: null,

            setProvider: (provider) =>
                set((state) => ({
                    llm: {
                        ...state.llm,
                        provider,
                    },
                })),

            updateLlmConfig: (patch) =>
                set((state) => ({
                    llm: {
                        ...state.llm,
                        ...patch,
                    },
                })),

            updateProviderConfig: (provider, patch) =>
                set((state) => ({
                    llm: {
                        ...state.llm,
                        providers: {
                            ...state.llm.providers,
                            [provider]: {
                                ...state.llm.providers[provider],
                                ...patch,
                            },
                        },
                    },
                })),

            resetProviderBaseUrl: (provider) =>
                set((state) => ({
                    llm: {
                        ...state.llm,
                        providers: {
                            ...state.llm.providers,
                            [provider]: {
                                ...state.llm.providers[provider],
                                baseUrl: DEFAULT_BASE_URLS[provider],
                            },
                        },
                    },
                })),

            /*
             * Adds a message to the active chat.
             * If this is a new empty chat, the first message creates a persisted
             * chat record automatically.
             */
            appendMessage: (message) =>
                set((state) => {
                    const now = new Date().toISOString();

                    if (!state.activeChatId) {
                        const chatId = crypto.randomUUID();

                        const newChat = {
                            id: chatId,
                            title: chatTitleFromMessage(message),
                            createdAt: now,
                            updatedAt: now,
                            messages: [message],
                        };

                        return {
                            activeChatId: chatId,
                            chats: [newChat, ...state.chats],
                        };
                    }

                    return {
                        chats: state.chats.map((chat) => {
                            if (chat.id !== state.activeChatId) {
                                return chat;
                            }

                            return {
                                ...chat,
                                updatedAt: now,
                                messages: [...chat.messages, message],
                            };
                        }),
                    };
                }),

            openChat: (chatId) =>
                set((state) => {
                    const chatExists = state.chats.some(
                        (chat) => chat.id === chatId
                    );

                    return {
                        activeChatId: chatExists ? chatId : null,
                    };
                }),

            startNewChat: () =>
                set({
                    activeChatId: null,
                }),

            removeChat: (chatId) =>
                set((state) => ({
                    chats: state.chats.filter((chat) => chat.id !== chatId),

                    activeChatId:
                        state.activeChatId === chatId
                            ? null
                            : state.activeChatId,
                })),
        }),

        {
            name: "research-assistant-store",
            storage: createJSONStorage(() => localStorage),

            version: 2,

            /*
             * Migrates the old single "messages" history to one stored chat.
             * This preserves the conversation you created before History existed.
             */
            migrate: (persistedState, version) => {
                if (version < 2) {
                    const oldMessages = persistedState.messages || [];

                    const migratedChats =
                        oldMessages.length > 0
                            ? [
                                {
                                    id: "migrated-chat-history",
                                    title: "Previous conversation",
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    messages: oldMessages,
                                },
                            ]
                            : [];

                    return {
                        ...persistedState,
                        chats: migratedChats,
                        activeChatId: null,
                    };
                }

                return persistedState;
            },

            /*
             * activeChatId is deliberately omitted.
             * Therefore, startup always displays a new empty Chat view.
             */
            partialize: (state) => ({
                llm: state.llm,
                chats: state.chats,
            }),
        }
    )
);
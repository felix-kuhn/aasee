import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    Brain,
    Coins,
    Droplets,
    ExternalLink,
    LoaderCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    BACKEND_URL,
    BackendError,
    getJob,
    getTheory,
    listTheories,
    startHydration,
} from "@/lib/backend";

async function openExternal(url) {
    try {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(url);
    } catch {
        window.open(url, "_blank", "noopener");
    }
}

function isRunning(job) {
    return job && (job.status === "pending" || job.status === "running");
}

export default function Theories() {
    const [theories, setTheories] = useState([]);
    const [selected, setSelected] = useState(null); // slug
    const [detail, setDetail] = useState(null); // fetched theory payload
    const [job, setJob] = useState(null);
    const [backendDown, setBackendDown] = useState(false);
    const [notice, setNotice] = useState(null);
    const [listLoading, setListLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);

    const refreshList = useCallback(async () => {
        try {
            const data = await listTheories();
            setTheories(data.theories);
            setBackendDown(false);
        } catch (error) {
            if (error instanceof BackendError && !error.reachable) {
                setBackendDown(true);
            }
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshList();
    }, [refreshList]);

    async function handleHydrate() {
        setNotice(null);
        try {
            const { job_id } = await startHydration();
            setJob({
                id: job_id,
                status: "pending",
                stage: "starting",
                progress: 0,
                detail: "Starting hydration…",
            });

            const poll = async () => {
                try {
                    const fresh = await getJob(job_id);
                    setJob(fresh);
                    if (fresh.status === "done") {
                        setNotice(
                            `Hydration finished: ${fresh.result?.scraped ?? 0} theories saved, ${
                                fresh.result?.errors?.length ?? 0
                            } failed.`
                        );
                        refreshList();
                    } else if (fresh.status === "failed") {
                        setNotice(`Hydration failed: ${fresh.error || "unknown error"}`);
                    } else {
                        setTimeout(poll, 700);
                    }
                } catch {
                    setBackendDown(true);
                    setTimeout(poll, 1500);
                }
            };

            poll();
        } catch (error) {
            if (error instanceof BackendError && !error.reachable) {
                setBackendDown(true);
            }
            setNotice(error.message);
        }
    }

    async function handleSelect(theory) {
        setSelected(theory.slug);
        setDetailLoading(true);
        setDetail(null);
        try {
            setDetail(await getTheory(theory.slug));
        } catch (error) {
            setNotice(error.message);
        } finally {
            setDetailLoading(false);
        }
    }

    const hydrating = isRunning(job);
    const runningTheory = theories.find((t) => t.slug === selected);

    return (
        <TooltipProvider>
            <section className="flex h-full min-h-0 flex-col">
                <header className="flex shrink-0 items-start justify-between gap-4 border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Theories</h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Theories from is.theorizeit.org, hydrated and stored
                            locally.
                        </p>
                    </div>

                    <Button
                        onClick={handleHydrate}
                        disabled={hydrating || backendDown}
                        className="shrink-0"
                    >
                        {hydrating ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <Droplets />
                        )}
                        Hydrate
                    </Button>
                </header>

                {backendDown && (
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        <span>
                            Backend not reachable at {BACKEND_URL}. Start it with{" "}
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                src-backend/scripts/dev.sh
                            </code>{" "}
                            and try again.
                        </span>
                    </div>
                )}

                {notice && (
                    <div className="mt-4 rounded-md border bg-muted/50 px-3 py-2.5 text-sm">
                        {notice}
                    </div>
                )}

                {hydrating && job && (
                    <div className="mt-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                                {job.stage === "index"
                                    ? "Reading theory index…"
                                    : "Scraping theories…"}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                                {Math.round((job.progress || 0) * 100)}%
                            </span>
                        </div>
                        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-300"
                                style={{ width: `${Math.round((job.progress || 0) * 100)}%` }}
                            />
                        </div>
                        {job.detail && (
                            <p className="mt-2 truncate text-xs text-muted-foreground">
                                {job.detail}
                            </p>
                        )}
                    </div>
                )}

                <div className="flex min-h-0 flex-1 gap-6 pt-6">
                    <div className="flex w-80 shrink-0 flex-col">
                        <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
                            {listLoading
                                ? "Loading…"
                                : `${theories.length} theor${theories.length === 1 ? "y" : "ies"}`}
                        </h3>

                        <ScrollArea className="min-h-0 flex-1 pr-2">
                            {listLoading ? (
                                <p className="px-1 py-2 text-sm text-muted-foreground">
                                    Loading…
                                </p>
                            ) : theories.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
                                    <Brain className="size-9 text-muted-foreground" />
                                    <p className="max-w-[15rem] text-sm text-muted-foreground">
                                        No theories stored yet. Click{" "}
                                        <span className="font-medium">Hydrate</span> to
                                        scrape all theories from is.theorizeit.org.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1.5 pb-4">
                                    {theories.map((theory) => (
                                        <button
                                            key={theory.slug}
                                            type="button"
                                            onClick={() => handleSelect(theory)}
                                            className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/60 ${
                                                selected === theory.slug
                                                    ? "border-primary bg-muted/70"
                                                    : ""
                                            }`}
                                        >
                                            <span className="block truncate text-sm font-medium">
                                                {theory.title}
                                            </span>

                                            <Tooltip>
                                                <TooltipTrigger className="mt-1.5 inline-flex">
                                                    <Coins className="size-3.5 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    {theory.tokens.toLocaleString()} tokens
                                                </TooltipContent>
                                            </Tooltip>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
                        {detailLoading ? (
                            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                                <LoaderCircle className="size-4 animate-spin" />
                                Loading theory…
                            </div>
                        ) : detail ? (
                            <>
                                <header className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-lg font-semibold">
                                            {detail.title}
                                        </h3>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">
                                            {detail.file} · {detail.tokens.toLocaleString()}{" "}
                                            tokens
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Open on is.theorizeit.org"
                                        onClick={() => openExternal(detail.url)}
                                        className="shrink-0"
                                    >
                                        <ExternalLink className="size-4" />
                                    </Button>
                                </header>

                                <ScrollArea className="min-h-0 flex-1">
                                    <div
                                        className="theory-content px-5 py-4"
                                        dangerouslySetInnerHTML={{ __html: detail.content }}
                                    />
                                </ScrollArea>
                            </>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                                <Brain className="size-10 text-muted-foreground" />
                                <div>
                                    <h3 className="font-semibold">
                                        {theories.length === 0
                                            ? "Nothing to display yet"
                                            : "Select a theory"}
                                    </h3>
                                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                                        {theories.length === 0
                                            ? "Hydrate the local library first, then pick a theory from the list."
                                            : "Pick a theory from the list to read its stored content here."}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </TooltipProvider>
    );
}

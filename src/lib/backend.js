// Client for the local Python backend (src-backend, FastAPI).
//
// In development the backend runs via src-backend/scripts/dev.sh on port 8766.
// When it is later bundled as a Tauri sidecar, the port comes from the
// sidecar environment; keep this in sync (or override via VITE_BACKEND_URL).
export const BACKEND_URL = (
    import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:8766"
).replace(/\/+$/, "");

export class BackendError extends Error {
    constructor(message, { reachable = true, status = null } = {}) {
        super(message);
        this.name = "BackendError";
        this.reachable = reachable;
        this.status = status;
    }
}

async function request(path, options = {}) {
    let response;
    try {
        response = await fetch(`${BACKEND_URL}${path}`, {
            headers: { "Content-Type": "application/json" },
            ...options,
        });
    } catch {
        throw new BackendError(
            `Backend not reachable at ${BACKEND_URL}`,
            { reachable: false }
        );
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const reason = body?.detail?.reason ?? body?.detail ?? response.statusText;
        throw new BackendError(reason, { reachable: true, status: response.status });
    }
    return body;
}

export const listTheories = () => request("/v1/theories");

export const getTheory = (slug) => request(`/v1/theories/${encodeURIComponent(slug)}`);

export const startHydration = () =>
    request("/v1/theories/hydrate", { method: "POST" });

export const getJob = (jobId) => request(`/v1/theories/jobs/${jobId}`);

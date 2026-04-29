export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  let headers = options?.headers;

  if (MUTATING_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) {
      headers = { ...Object.fromEntries(new Headers(headers).entries()), "x-csrf-token": token };
    }
  }

  const mergedOptions: RequestInit = { ...options, headers };

  async function attempt(): Promise<Response> {
    return fetch(path, mergedOptions);
  }

  let res: Response;
  try {
    res = await attempt();
  } catch {
    // Network error — retry once
    res = await attempt();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

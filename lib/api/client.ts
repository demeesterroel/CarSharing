export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  async function attempt(): Promise<Response> {
    return fetch(path, options);
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

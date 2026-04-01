/**
 * API client for Redux thunks.
 *
 * DIP: Thunks depend on this abstraction instead of calling `fetch` directly.
 * SRP: All HTTP transport, error parsing, and response normalization live here.
 * OCP: New endpoints are added by calling these generic methods — no thunk code changes.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const parseErrorResponse = async (res: Response): Promise<string> => {
  try {
    const data = await res.json();
    return data.error || data.message || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
};

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const message = await parseErrorResponse(res);
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
};

// ─── Public Methods ─────────────────────────────────────

export const apiClient = {
  get: <T>(url: string) => request<T>(url),

  post: <T>(url: string, body: unknown) =>
    request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  patch: <T>(url: string, body: unknown) =>
    request<T>(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  delete: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

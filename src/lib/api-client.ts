const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const normalizedPath = path.replace(/^\/+/, "");

  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("Accept", "application/json");

  const response = await fetch(`${API_BASE_URL}/${normalizedPath}`, {
    ...options,
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json") ?? false;

  let payload: unknown;

  if (response.status !== 204) {
    try {
      payload = isJson ? await response.json() : await response.text();
    } catch {
      payload = undefined;
    }
  }

  if (!response.ok) {
    const body =
      typeof payload === "object" && payload !== null
        ? (payload as Record<string, unknown>)
        : undefined;

    const message =
      typeof body?.["message"] === "string"
        ? body["message"]
        : `Request failed with status ${response.status}`;

    throw new ApiRequestError(response.status, message, payload);
  }

  return payload as T;
}

export const apiClient = {
  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return apiRequest<T>(path, {
      ...options,
      method: "GET",
    });
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return apiRequest<T>(path, {
      ...options,
      method: "POST",
      body,
    });
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">,
  ) {
    return apiRequest<T>(path, {
      ...options,
      method: "PATCH",
      body,
    });
  },

  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">) {
    return apiRequest<T>(path, {
      ...options,
      method: "DELETE",
    });
  },
};

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

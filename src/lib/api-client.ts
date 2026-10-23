const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const REFRESH_TOKEN_KEY = "fintech.refreshToken";

const REFRESH_EXCLUDED_ENDPOINTS = new Set([
  "auth/login",
  "auth/register",
  "auth/refresh",
  "auth/verify-email",
]);

type ApiResponseType = "json" | "blob";

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "ApiRequestError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipRefresh?: boolean;
  responseType?: ApiResponseType;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RegisterResponse {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

function getStoredRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeRefreshToken(token: string): void {
  try {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {
    throw new Error("Browser session storage is unavailable.");
  }
}

function clearStoredRefreshToken(): void {
  try {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Continue clearing the in-memory session.
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function clearAuthTokens(): void {
  accessToken = null;
  clearStoredRefreshToken();
}

export function hasStoredRefreshToken(): boolean {
  return Boolean(getStoredRefreshToken());
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

function shouldSkipAutomaticRefresh(path: string): boolean {
  const normalizedPath = path.replace(/^\/+|\/+$/g, "");
  return REFRESH_EXCLUDED_ENDPOINTS.has(normalizedPath);
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");

  try {
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    return await response.text();
  } catch {
    return undefined;
  }
}

function getErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null) {
    const body = payload as Record<string, unknown>;

    if (typeof body["message"] === "string") {
      return body["message"];
    }

    if (Array.isArray(body["message"])) {
      return body["message"]
        .filter((item): item is string => typeof item === "string")
        .join(", ");
    }
  }

  return `Request failed with status ${status}`;
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      const payload = await readPayload(response);

      if (!response.ok) {
        clearAuthTokens();
        return false;
      }

      const tokens = payload as TokenResponse;

      if (
        typeof tokens?.accessToken !== "string" ||
        typeof tokens?.refreshToken !== "string"
      ) {
        clearAuthTokens();
        return false;
      }

      setAccessToken(tokens.accessToken);
      storeRefreshToken(tokens.refreshToken);

      return true;
    } catch {
      // Keep the refresh token after a network failure so the session
      // can be retried when the backend becomes available again.
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function executeRequest<T>(
  path: string,
  options: RequestOptions,
  canRefresh: boolean,
): Promise<T> {
  const normalizedPath = path.replace(/^\/+/, "");
  const { body, skipRefresh, responseType = "json", ...fetchOptions } = options;

  const headers = new Headers(fetchOptions.headers);

  headers.set(
    "Accept",
    responseType === "blob" ? "text/csv, application/json" : "application/json",
  );

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}/${normalizedPath}`, {
    ...fetchOptions,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Successful file responses must remain binary Blob objects.
  // Error responses are parsed normally so ApiRequestError retains
  // the backend's JSON message whenever one is available.
  const payload =
    response.ok && responseType === "blob"
      ? await response.blob()
      : await readPayload(response);

  const mayRefresh =
    response.status === 401 &&
    canRefresh &&
    !skipRefresh &&
    !shouldSkipAutomaticRefresh(normalizedPath);

  if (mayRefresh) {
    const refreshed = await refreshSession();

    if (refreshed) {
      return executeRequest<T>(path, options, false);
    }

    clearAuthTokens();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:session-expired"));
    }
  }

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      getErrorMessage(payload, response.status),
      payload,
    );
  }

  return payload as T;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return executeRequest<T>(path, options, true);
}

export const authApi = {
  async register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<RegisterResponse> {
    return apiRequest<RegisterResponse>("auth/register", {
      method: "POST",
      body: input,
      skipRefresh: true,
    });
  },

  async verifyEmail(token: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>("auth/verify-email", {
      method: "POST",
      body: { token },
      skipRefresh: true,
    });
  },

  async login(input: {
    email: string;
    password: string;
  }): Promise<LoginResponse> {
    const result = await apiRequest<LoginResponse>("auth/login", {
      method: "POST",
      body: input,
      skipRefresh: true,
    });

    setAccessToken(result.accessToken);
    storeRefreshToken(result.refreshToken);

    return result;
  },

  async refresh(): Promise<boolean> {
    return refreshSession();
  },

  async me(): Promise<AuthUser> {
    return apiRequest<AuthUser>("auth/me");
  },

  async logout(): Promise<{ message: string }> {
    const refreshToken = getStoredRefreshToken();

    if (!refreshToken) {
      clearAuthTokens();
      return { message: "Local session cleared" };
    }

    try {
      return await apiRequest<{ message: string }>("auth/logout", {
        method: "POST",
        body: { refreshToken },
      });
    } finally {
      clearAuthTokens();
    }
  },
};

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

import { ApiResponse } from "@collab/contracts";

const API_BASE =
  (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";

class ApiClient {
  constructor() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("collab_token");
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || !data.success) {
      const error = (data as any)?.error || {
        code: "HTTP_ERROR",
        message: response.statusText || "Request failed",
      };
      throw new Error(error.message || "Request failed");
    }

    return (data as any).data;
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient();

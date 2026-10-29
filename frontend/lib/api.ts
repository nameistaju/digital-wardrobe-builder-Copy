export interface HealthResponse {
  status: string;
  app: string;
  version: string;
  environment: string;
}

export interface ApiHealthState {
  isHealthy: boolean;
  data: HealthResponse | null;
  error: string | null;
  checkedAt: string;
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8000";

/**
 * Checks connectivity and operational health of the FastAPI backend.
 */
export async function checkBackendHealth(): Promise<ApiHealthState> {
  const checkedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/health`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      // Avoid caching the health check response during status polling
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        isHealthy: false,
        data: null,
        error: `HTTP ${res.status}: ${res.statusText}`,
        checkedAt,
      };
    }

    const data: HealthResponse = await res.json();
    return {
      isHealthy: data.status === "healthy",
      data,
      error: null,
      checkedAt,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unable to reach backend API";
    return {
      isHealthy: false,
      data: null,
      error: errorMessage,
      checkedAt,
    };
  }
}

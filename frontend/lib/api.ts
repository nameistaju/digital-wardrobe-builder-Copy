export interface User {
  id: number;
  email: string;
  full_name?: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Garment {
  id: number;
  user_id: number;
  name: string;
  category: string;
  subcategory?: string | null;
  color?: string | null;
  season?: string | null;
  brand?: string | null;
  notes?: string | null;
  is_favorite: boolean;
  image_url: string;
  original_image_url?: string | null;
  source_type: string;
  extraction_confidence?: number | null;
  created_at: string;
  updated_at: string;
}

export interface GarmentListResponse {
  items: Garment[];
  total: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CandidateGarment {
  id: string;
  category: string;
  subcategory?: string | null;
  confidence: number;
  image_url: string;
  bounding_box: BoundingBox;
  status: "pending" | "approved" | "rejected";
}

export interface ExtractionJob {
  id: number;
  user_id: number;
  source_image_url: string;
  status: "pending" | "processing" | "completed" | "failed";
  candidate_garments: CandidateGarment[];
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanvasItem {
  garment_id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  rotation: number;
}

export interface Outfit {
  id: number;
  user_id: number;
  name: string;
  description?: string | null;
  season?: string | null;
  occasion?: string | null;
  preview_image_url?: string | null;
  layout_data: CanvasItem[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

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

// Helper to resolve full image URLs
export function getImageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

// Token storage in browser
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wardrobe_token");
}

export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("wardrobe_token", token);
  }
}

export function removeAuthToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("wardrobe_token");
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Set json content-type if body is object and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorJson = await res.json();
      if (errorJson.detail) {
        errorDetail = typeof errorJson.detail === "string" ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json() as Promise<T>;
}

// Backend Health
export async function checkBackendHealth(): Promise<ApiHealthState> {
  const checkedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/health`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      return { isHealthy: false, data: null, error: `HTTP ${res.status}`, checkedAt };
    }
    const data: HealthResponse = await res.json();
    return { isHealthy: data.status === "healthy", data, error: null, checkedAt };
  } catch (err: unknown) {
    return { isHealthy: false, data: null, error: err instanceof Error ? err.message : "Offline", checkedAt };
  }
}

// Auth API
export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.access_token);
  return data;
}

export async function registerUser(email: string, password: string, fullName?: string): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  setAuthToken(data.access_token);
  return data;
}

export async function demoLogin(): Promise<AuthResponse> {
  const data = await apiFetch<AuthResponse>("/api/v1/auth/demo", {
    method: "POST",
  });
  setAuthToken(data.access_token);
  return data;
}

export async function getCurrentUser(): Promise<User> {
  return apiFetch<User>("/api/v1/auth/me");
}

// Garments API
export async function uploadGarment(formData: FormData): Promise<Garment> {
  return apiFetch<Garment>("/api/v1/garments/upload", {
    method: "POST",
    body: formData,
  });
}

export async function listGarments(params: {
  category?: string;
  season?: string;
  is_favorite?: boolean;
  search?: string;
  skip?: number;
  limit?: number;
} = {}): Promise<GarmentListResponse> {
  const query = new URLSearchParams();
  if (params.category && params.category !== "all") query.set("category", params.category);
  if (params.season && params.season !== "all") query.set("season", params.season);
  if (params.is_favorite !== undefined) query.set("is_favorite", String(params.is_favorite));
  if (params.search) query.set("search", params.search);
  if (params.skip) query.set("skip", String(params.skip));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiFetch<GarmentListResponse>(`/api/v1/garments${qs ? `?${qs}` : ""}`);
}

export async function getCategoryCounts(): Promise<CategoryCount[]> {
  return apiFetch<CategoryCount[]>("/api/v1/garments/categories");
}

export async function updateGarment(garmentId: number, data: Partial<Garment>): Promise<Garment> {
  return apiFetch<Garment>(`/api/v1/garments/${garmentId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteGarment(garmentId: number): Promise<void> {
  return apiFetch<void>(`/api/v1/garments/${garmentId}`, {
    method: "DELETE",
  });
}

// Extraction API
export async function uploadFullBodyPhoto(file: File): Promise<ExtractionJob> {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<ExtractionJob>("/api/v1/extraction/upload", {
    method: "POST",
    body: formData,
  });
}

export async function getExtractionJob(jobId: number): Promise<ExtractionJob> {
  return apiFetch<ExtractionJob>(`/api/v1/extraction/${jobId}`);
}

export async function approveCandidate(
  jobId: number,
  candidateId: string,
  details: {
    name?: string;
    category?: string;
    subcategory?: string;
    color?: string;
    season?: string;
    brand?: string;
    notes?: string;
  }
): Promise<Garment> {
  return apiFetch<Garment>(`/api/v1/extraction/${jobId}/candidates/${candidateId}/approve`, {
    method: "POST",
    body: JSON.stringify(details),
  });
}

export async function rejectCandidate(jobId: number, candidateId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/extraction/${jobId}/candidates/${candidateId}/reject`, {
    method: "POST",
  });
}

export async function refineCandidate(
  jobId: number,
  candidateId: string,
  boundingBox: BoundingBox
): Promise<void> {
  return apiFetch<void>(`/api/v1/extraction/${jobId}/candidates/${candidateId}/refine`, {
    method: "POST",
    body: JSON.stringify({ bounding_box: boundingBox, action: "crop" }),
  });
}

// Outfits API
export async function createOutfit(data: {
  name: string;
  description?: string;
  season?: string;
  occasion?: string;
  preview_image_url?: string;
  layout_data: CanvasItem[];
  is_favorite?: boolean;
}): Promise<Outfit> {
  return apiFetch<Outfit>("/api/v1/outfits", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listOutfits(params: { season?: string; occasion?: string } = {}): Promise<Outfit[]> {
  const query = new URLSearchParams();
  if (params.season && params.season !== "all") query.set("season", params.season);
  if (params.occasion && params.occasion !== "all") query.set("occasion", params.occasion);
  const qs = query.toString();
  return apiFetch<Outfit[]>(`/api/v1/outfits${qs ? `?${qs}` : ""}`);
}

export async function deleteOutfit(outfitId: number): Promise<void> {
  return apiFetch<void>(`/api/v1/outfits/${outfitId}`, {
    method: "DELETE",
  });
}

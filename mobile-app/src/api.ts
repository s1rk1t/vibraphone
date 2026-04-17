export interface ColorSelectionPayload {
  deviceId: string;
  hexColor: string;
  x: number;
  y: number;
}

export interface ColorSubmission {
  id: number | null;
  deviceId: string;
  hexColor: string;
  x: number;
  y: number;
  createdAt: string;
}

export interface DominantColor {
  hexColor: string;
  count: number;
  percentage: number;
}

export interface CollageCell {
  index: number;
  row: number;
  column: number;
  hexColor: string;
  intensity: number;
  sampleCount: number;
}

export interface CollageResponse {
  generatedAt: string;
  width: number;
  height: number;
  totalSubmissions: number;
  activeContributors: number;
  dominantColors: DominantColor[];
  cells: CollageCell[];
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json() as Promise<T>;
}

export async function submitColor(payload: ColorSelectionPayload): Promise<ColorSubmission> {
  return request<ColorSubmission>("/api/colors/submissions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchCollage(): Promise<CollageResponse> {
  return request<CollageResponse>("/api/colors/collage?width=6&height=8&hours=72");
}

export async function fetchRecentSubmissions(): Promise<ColorSubmission[]> {
  return request<ColorSubmission[]>("/api/colors/submissions?limit=8");
}

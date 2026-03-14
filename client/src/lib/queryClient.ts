import { QueryClient } from "@tanstack/react-query";

const BASE_URL = typeof window !== "undefined" && (window as any).__API_BASE__
  ? (window as any).__API_BASE__
  : "";

export async function apiRequest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [path] = queryKey as string[];
        const res = await fetch(`${BASE_URL}${path}`);
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      },
      staleTime: 30_000,
      retry: 1,
    },
  },
});

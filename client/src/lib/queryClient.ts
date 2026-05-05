import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Friendly fallbacks per HTTP status — never expose raw status codes to users.
function defaultMessageForStatus(status: number): string {
  if (status === 401) return "Please sign in again to continue.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 408) return "The request took too long. Please try again.";
  if (status === 409) return "That action conflicts with the current state. Please refresh and try again.";
  if (status === 413) return "The file or request is too large.";
  if (status === 422) return "Some of the information provided isn't valid. Please review and try again.";
  if (status === 429) return "You're doing that too often. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  if (status >= 400) return "We couldn't complete that request. Please review your input and try again.";
  return "Something went wrong. Please try again.";
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = "";
    const raw = await res.text().catch(() => "");
    if (raw) {
      // Try to parse JSON error body and pull out a friendly field
      try {
        const body = JSON.parse(raw);
        message = body?.message || body?.error || body?.detail || "";
      } catch {
        // Plain-text body — use it directly only if it's a sensible short sentence
        if (raw.length < 240 && !/^<|<html/i.test(raw)) message = raw;
      }
    }
    if (!message) message = defaultMessageForStatus(res.status);
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

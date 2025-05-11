import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// 실패한 요청을 재시도하는 함수
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  delay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30초 타임아웃
      
      // 요청 옵션에 abort signal 추가
      const extendedOptions = {
        ...options,
        signal: abortController.signal
      };
      
      try {
        const response = await fetch(url, extendedOptions);
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err: any) {
      lastError = err;
      
      // Check if it's "signal is aborted without reason" or any abort error
      const isAbortError = 
        err.name === 'AbortError' || 
        (err.message && err.message.includes('aborted')) ||
        (err.stack && err.stack.includes('aborted'));
        
      if (isAbortError) {
        console.warn(`요청이 중단되었습니다. 재시도 중... (${attempt + 1}/${maxRetries})`);
      } else {
        console.error(`요청 실패. 재시도 중... (${attempt + 1}/${maxRetries})`, err);
      }
      
      // 마지막 시도가 아니라면 지연 후 재시도
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        // 다음 재시도에서 지연 시간을 늘림 (지수 백오프)
        delay *= 1.5;
      } else {
        // 모든 재시도 실패
        throw lastError || new Error('요청이 실패했습니다.');
      }
    }
  }
  
  // 이 코드는 실행되지 않지만 TypeScript 오류를 방지하기 위해 필요
  throw lastError || new Error('요청이 실패했습니다.');
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const options: RequestInit = {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include' as RequestCredentials,
  };
  
  const res = await fetchWithRetry(url, options);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
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

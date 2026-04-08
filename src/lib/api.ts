const API_KEY_REENTRY_ERROR = 'Không thể giải mã Gemini API key đã lưu';

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function shouldPromptApiKeyReset(error: unknown): boolean {
  return error instanceof Error && error.message.includes(API_KEY_REENTRY_ERROR);
}

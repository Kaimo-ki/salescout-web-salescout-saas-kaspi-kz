export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

export async function apiRequest<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as { error?: string } | T;
  if (!response.ok) throw new ApiError(typeof payload === 'object' && payload && 'error' in payload ? String(payload.error) : 'Не удалось выполнить запрос.', response.status);
  return payload as T;
}

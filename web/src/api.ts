/** What `/api/state` and the requests that change the state answer. */
export interface State {
  version: string;
  workspace: Workspace | null;
  needs_setup: boolean;
  home: string | null;
}

export interface Workspace {
  root: string;
  start: string | null;
}

/** The body of a failed response, when the server sent one. */
interface ErrorBody {
  error?: { code?: unknown; message?: unknown };
}

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Turns a failed response into an ApiError, whatever its body holds. */
export function errorFrom(status: number, body: ErrorBody | null): ApiError {
  const error = body?.error;
  if (typeof error?.code === "string" && typeof error?.message === "string") {
    return new ApiError(error.code, error.message);
  }
  return new ApiError("http_" + status, `the server answered ${status}`);
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const options: RequestInit = { method };
  if (body !== undefined) {
    options.headers = { "content-type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw errorFrom(response.status, json);
  }
  return json;
}

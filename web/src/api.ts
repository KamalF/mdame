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
  const response = await send(method, path, body);
  return response.json().catch(() => null);
}

/** Like `api`, but gives the response, for its headers. */
export async function send(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  const options: RequestInit = { method, headers };
  if (body !== undefined) {
    options.headers = { ...headers, "content-type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  if (!response.ok) {
    throw errorFrom(response.status, await response.json().catch(() => null));
  }
  return response;
}

/** Whether the file behind `url` exists: a file too large or unreadable
 * to serve still does. */
export async function exists(url: string): Promise<boolean> {
  return fetch(url, { method: "HEAD" }).then(
    (response) => response.status !== 404,
    () => false,
  );
}

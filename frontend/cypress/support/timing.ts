interface TimedRequest {
  method: string;
  url: string;
}

const requestStartedAt = new Map<string, number[]>();

function requestKey(request: TimedRequest): string {
  return `${request.method.toUpperCase()} ${request.url}`;
}

export function resetApiTiming(): void {
  requestStartedAt.clear();
}

export function markApiRequestStarted(request: TimedRequest): void {
  const key = requestKey(request);
  const starts = requestStartedAt.get(key) ?? [];
  starts.push(Date.now());
  requestStartedAt.set(key, starts);
}

export function apiDurationMs(request: TimedRequest): number | undefined {
  const key = requestKey(request);
  const starts = requestStartedAt.get(key);
  const startedAt = starts?.shift();
  if (starts?.length === 0) requestStartedAt.delete(key);
  return startedAt === undefined ? undefined : Date.now() - startedAt;
}

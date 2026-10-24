export function getCsrfToken(): string | undefined {
  const item = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('csrf_token='));
  return item ? decodeURIComponent(item.slice('csrf_token='.length)) : undefined;
}

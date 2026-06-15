const KEY = "masa.playerToken";

export function loadToken(): string | undefined {
  return localStorage.getItem(KEY) ?? undefined;
}

export function saveToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export interface IeltsHomeIdentityInput {
  displayName: string | null | undefined;
  email: string | null | undefined;
}

function normalizeName(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function emailLocalPart(email: string | null | undefined): string | null {
  const at = email?.indexOf("@") ?? -1;
  if (!email || at <= 0) return null;
  return email.slice(0, at).trim().toLowerCase();
}

function isHandleLike(value: string): boolean {
  if (value.includes("@")) return true;
  if (/[._]/.test(value)) return true;
  if (/\d/.test(value)) return true;
  return false;
}

function firstToken(value: string): string | null {
  const [token] = value.split(" ");
  if (!token) return null;
  const normalized = token.replace(/^[^\p{L}]+|[^\p{L}'-]+$/gu, "");
  if (!/^\p{L}[\p{L}'-]*$/u.test(normalized)) return null;
  return normalized;
}

export function ieltsHomeFirstName(input: IeltsHomeIdentityInput): string | null {
  const displayName = normalizeName(input.displayName);
  if (!displayName) return null;

  const localPart = emailLocalPart(input.email);
  const lowerDisplayName = displayName.toLowerCase();
  if (localPart && lowerDisplayName === localPart) return null;
  if (!displayName.includes(" ") && isHandleLike(displayName)) return null;

  const first = firstToken(displayName);
  if (!first) return null;
  return first;
}

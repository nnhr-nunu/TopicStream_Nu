import { IDENTITY_KEY } from "@/lib/constants";
import { createId } from "@/lib/ids";

export type LocalIdentity = {
  id: string;
  nickname: string;
};

function emptyIdentity(): LocalIdentity {
  return { id: createId("user"), nickname: "" };
}

export function loadIdentity(): LocalIdentity {
  if (typeof window === "undefined") return emptyIdentity();
  try {
    const raw = window.localStorage.getItem(IDENTITY_KEY);
    if (!raw) {
      const created = emptyIdentity();
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(created));
      return created;
    }
    const parsed = JSON.parse(raw) as Partial<LocalIdentity>;
    const identity: LocalIdentity = {
      id: typeof parsed.id === "string" && parsed.id ? parsed.id : createId("user"),
      nickname: typeof parsed.nickname === "string" ? parsed.nickname.slice(0, 24) : "",
    };
    if (identity.id !== parsed.id) {
      window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    }
    return identity;
  } catch {
    return emptyIdentity();
  }
}

export function saveIdentity(patch: Partial<LocalIdentity>): LocalIdentity {
  const current = loadIdentity();
  const next = {
    id: current.id,
    nickname: patch.nickname !== undefined ? patch.nickname.slice(0, 24) : current.nickname,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
  }
  return next;
}

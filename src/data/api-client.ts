import { openDB } from "idb";

// getRandomValues is available on LAN HTTP, unlike crypto.randomUUID.
export function randomId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export async function request(
  path: string,
  init: RequestInit = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new ApiError(
      0,
      "A conexão caiu antes da confirmação. Tente novamente para consultar o resultado da mesma operação.",
    );
  }
  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(502, "Resposta inválida do servidor.");
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      data?.message || "Não foi possível concluir a operação.",
      data?.code,
    );
  return data;
}
export const get = (path: string) => request(`/api/backend/${path}`);
export type PendingWrite = {
  key: string;
  path: string;
  method: "POST" | "PATCH";
  body: unknown;
  label: string;
};
const database = () =>
  openDB("bonamassa-panel-api", 1, {
    upgrade(db) {
      db.createObjectStore("pending");
    },
  });
export async function pendingWrite(
  scope: string,
): Promise<PendingWrite | undefined> {
  return (await database()).get("pending", scope);
}
export async function mutate(
  scope: string,
  proposal: Omit<PendingWrite, "key">,
  replay = false,
) {
  const db = await database();
  const tx = db.transaction("pending", "readwrite");
  const old: PendingWrite | undefined = await tx.store.get(scope);
  if (
    old &&
    !replay &&
    (old.path !== proposal.path ||
      old.method !== proposal.method ||
      JSON.stringify(old.body) !== JSON.stringify(proposal.body))
  ) {
    await tx.done;
    throw new ApiError(
      409,
      "Existe uma operação sem confirmação. Use “Consultar operação pendente” antes de enviar outra alteração.",
    );
  }
  const write: PendingWrite = old || { ...proposal, key: randomId() };
  await tx.store.put(write, scope);
  await tx.done;
  try {
    const result = await request(`/api/backend/${write.path}`, {
      method: write.method,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": write.key,
      },
      body: JSON.stringify(write.body),
    });
    const done = db.transaction("pending", "readwrite");
    if ((await done.store.get(scope))?.key === write.key)
      await done.store.delete(scope);
    await done.done;
    return result;
  } catch (error) {
    // A timeout/5xx can happen after commit. Keep its key across reloads and tabs.
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 401
    ) {
      const done = db.transaction("pending", "readwrite");
      if ((await done.store.get(scope))?.key === write.key)
        await done.store.delete(scope);
      await done.done;
    }
    throw error;
  }
}

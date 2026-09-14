"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { Context, type PanelContextValue } from "./panel-provider";
import { type Command, type State } from "@/domain/model";
import { productSchema } from "@/domain/catalog";
import {
  ApiError,
  get,
  mutate,
  pendingWrite,
  request,
  type PendingWrite,
} from "@/data/api-client";
import {
  apiOrderSchema,
  catalogSchema,
  driverDto,
  kitchenOrderSchema,
  mapState,
  userSchema,
  versions,
  type ApiCatalog,
  type ApiDriver,
  type ApiUser,
  type KitchenOrder,
} from "@/data/api-contract";

type Result = { ok: true; data: unknown } | { ok: false; error: string };
export interface ApiContextValue {
  user: ApiUser | null;
  authenticating: boolean;
  stale: string | null;
  updatedAt: number;
  catalog: ApiCatalog | null;
  drivers: ApiDriver[];
  users: ApiUser[];
  kitchen: KitchenOrder[];
  pending: PendingWrite | undefined;
  hasMore: boolean;
  writing: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  run(
    path: string,
    body: unknown,
    label: string,
    method?: "POST" | "PATCH",
  ): Promise<Result>;
  createUser(body: unknown, key: string): Promise<boolean>;
  retry(): Promise<void>;
  loadMore(): void;
}
const active = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "RETURNING",
];
async function pages(status: string | undefined, maxPages = 30) {
  let cursor: string | null = null;
  const all: unknown[] = [];
  for (let i = 0; i < maxPages; i++) {
    const params = new URLSearchParams({
      limit: "100",
      ...(status ? { status } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const page = z
      .object({
        items: z.array(z.unknown()),
        nextCursor: z.string().nullable(),
      })
      .parse(await get(`staff/orders?${params}`));
    all.push(...page.items);
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  if (status && cursor)
    throw new Error(
      "Há mais de 3.000 pedidos ativos nesta etapa. Refine a operação antes de continuar pelo painel.",
    );
  return { all, hasMore: !!cursor };
}
const readable = (error: unknown) =>
  error instanceof z.ZodError
    ? "Os dados da API não correspondem à versão esperada. Confira a versão de APIBonamassa indicada no README."
    : error instanceof Error
      ? error.message
      : "Não foi possível concluir a operação.";

export function ApiPanelProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authenticating, setAuthenticating] = useState(true);
  const [state, setState] = useState<State | null>(null);
  const [catalog, setCatalog] = useState<ApiCatalog | null>(null);
  const [drivers, setDrivers] = useState<ApiDriver[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [kitchen, setKitchen] = useState<KitchenOrder[]>([]);
  const [stale, setStale] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [writing, setWriting] = useState(false);
  const [pending, setPending] = useState<PendingWrite>();
  const [hasMore, setHasMore] = useState(false);
  const [depth, setDepth] = useState(1);
  const [toast, setToast] = useState<PanelContextValue["toast"]>(null);
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const generation = useRef(0),
    locked = useRef(false),
    lastNumber = useRef<number | null>(null),
    offset = useRef(0);
  const soundRef = useRef(false);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const clear = useCallback(() => {
    generation.current++;
    setUser(null);
    setState(null);
    setUpdatedAt(0);
    setCatalog(null);
    setDrivers([]);
    setUsers([]);
    setKitchen([]);
    setPending(undefined);
    setStale(null);
    setDepth(1);
    lastNumber.current = null;
  }, []);
  const beep = useCallback(() => {
    const context = audio.current;
    if (!context || !soundRef.current || context.state !== "running") return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }, []);
  const identify = useCallback(async () => {
    try {
      const data = z
        .object({ user: userSchema })
        .parse(await request("/api/session"));
      setUser(data.user);
      setStale(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clear();
      else setStale(readable(error));
    } finally {
      setAuthenticating(false);
    }
  }, [clear]);
  useEffect(() => {
    const start = setTimeout(() => void identify(), 0);
    return () => clearTimeout(start);
  }, [identify]);
  const reload = useCallback(async () => {
    if (!user) {
      await identify();
      return;
    }
    const revision = ++generation.current;
    try {
      const scheduleCatalog =
        user.role === "KITCHEN"
          ? null
          : catalogSchema.parse(await get("staff/catalog"));
      const statuses = scheduleCatalog?.store.scheduleEnabled
        ? ["SCHEDULED", ...active]
        : active;
      const jobs = await Promise.all(statuses.map((status) => pages(status)));
      const isKitchen = user.role === "KITCHEN";
      const history = isKitchen
        ? { all: [], hasMore: false }
        : await pages(undefined, depth);
      const combined = [...history.all, ...jobs.flatMap((j) => j.all)];
      const byId = new Map<string, KitchenOrder>();
      // Keep the latest version if a command raced with the paginated reads.
      for (const row of combined) {
        const parsed = (isKitchen ? kitchenOrderSchema : apiOrderSchema).parse(
          row,
        );
        if (
          !byId.has(parsed.id) ||
          byId.get(parsed.id)!.version < parsed.version
        )
          byId.set(parsed.id, parsed);
      }
      const records = [...byId.values()].sort((a, b) => b.number - a.number);
      const [nextCatalog, nextDrivers, nextUsers, nextPending] =
        await Promise.all([
          isKitchen ? null : scheduleCatalog,
          isKitchen
            ? []
            : get("staff/drivers").then((r) => z.array(driverDto).parse(r)),
          user.role === "MANAGER"
            ? get("staff/users").then((r) => z.array(userSchema).parse(r))
            : [],
          pendingWrite(`${user.storeId}:${user.id}`),
        ]);
      if (revision !== generation.current) return;
      if (nextCatalog) {
        offset.current = nextCatalog.serverTime - Date.now();
        setCatalog(nextCatalog);
        // DTOs were parsed above; their transformed dates must not be parsed a second time.
        setState(
          mapState(
            nextCatalog,
            nextDrivers,
            records as z.infer<typeof apiOrderSchema>[],
            revision,
          ),
        );
      }
      setKitchen(records);
      setDrivers(nextDrivers);
      setUsers(nextUsers);
      setPending(nextPending);
      setHasMore(history.hasMore);
      const newest = Math.max(0, ...records.map((r) => r.number));
      if (lastNumber.current !== null && newest > lastNumber.current) beep();
      lastNumber.current = newest;
      setStale(null);
      setUpdatedAt(Date.now());
      setNow(Date.now() + offset.current);
    } catch (error) {
      if (revision !== generation.current) return;
      if (error instanceof ApiError && error.status === 401) {
        clear();
        notify("Sua sessão terminou. Entre novamente.", true);
      } else setStale(readable(error));
    }
  }, [user, depth, identify, beep, clear, notify]);
  useEffect(() => {
    if (!user) return;
    const epochs = generation;
    const start = setTimeout(() => void reload(), 0);
    const interval = setInterval(() => {
      if (!document.hidden && !locked.current) void reload();
    }, 5000);
    const clock = setInterval(() => setNow(Date.now() + offset.current), 1000);
    const focus = () => {
      if (!locked.current) void reload();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    return () => {
      epochs.current++;
      clearTimeout(start);
      clearInterval(interval);
      clearInterval(clock);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
    };
  }, [user, reload]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const run = async (
    path: string,
    body: unknown,
    label: string,
    method: "POST" | "PATCH" = "POST",
    replay = false,
  ): Promise<Result> => {
    if (!user || locked.current)
      return { ok: false, error: "Aguarde a operação atual." };
    locked.current = true;
    setWriting(true);
    generation.current++;
    const scope = `${user.storeId}:${user.id}`;
    try {
      const data = await mutate(scope, { path, body, label, method }, replay);
      notify(label);
      await reload();
      return { ok: true, data }; // An acknowledged write stays successful even if refresh fails.
    } catch (error) {
      notify(readable(error), true);
      if (error instanceof ApiError && error.status === 401) clear();
      else await reload();
      return { ok: false, error: readable(error) };
    } finally {
      locked.current = false;
      setWriting(false);
    }
  };
  const execute = async (command: Command, message = "Alteração salva.") => {
    try {
      if (!catalog || !user) return false;
      switch (command.type) {
        case "ORDER": {
          const routes = {
            ACCEPT: "accept",
            PREPARE: "prepare",
            READY: "ready",
            ASSIGN: "assign",
            COMPLETE: "pickup-complete",
            RETURN: "return",
            CANCEL: "cancel",
          };
          if (!(command.action in routes))
            throw new Error(
              "Esta etapa precisa ser confirmada pelo entregador.",
            );
          const body = {
            expectedVersion: command.version,
            ...(command.action === "ASSIGN"
              ? { driverId: command.driverId }
              : {}),
            ...(command.action === "CANCEL" ? { reason: command.reason } : {}),
            ...(command.action === "COMPLETE"
              ? {
                  recipient: command.recipient,
                  paymentCollected: command.paymentCollected,
                }
              : {}),
          };
          return (
            await run(
              `staff/orders/${command.id}/${routes[command.action as keyof typeof routes]}`,
              body,
              message,
            )
          ).ok;
        }
        case "STORE":
          return (
            await run(
              "staff/store",
              {
                expectedVersion: catalog.store.version,
                name: catalog.store.name,
                open: command.open,
                deliveryFee: catalog.store.deliveryFee,
                driverFee: catalog.store.driverFee,
              },
              message,
              "PATCH",
            )
          ).ok;
        case "DRIVER": {
          const driver = drivers.find((d) => d.id === command.id);
          if (!driver) throw new Error("Entregador não encontrado.");
          return (
            await run(
              `staff/drivers/${driver.id}/availability`,
              { expectedVersion: driver.version, available: command.available },
              message,
              "PATCH",
            )
          ).ok;
        }
        case "PRODUCT":
        case "ADD_PRODUCT": {
          const p = productSchema.parse({ ...command.product, photo: null });
          const old =
            command.type === "PRODUCT" && command.previous
              ? versions.get(command.previous)
              : null;
          if (command.type === "PRODUCT" && !old)
            throw new Error("Reabra o produto para carregar sua versão atual.");
          let imageId = command.product.photo?.startsWith("/api/images/")
            ? (old?.imageId ?? null)
            : null;
          if (command.product.photo?.startsWith("data:")) {
            const upload = await run(
              "staff/product-images",
              { photo: command.product.photo },
              "Foto enviada. Salvando produto…",
            );
            if (!upload.ok) return false;
            imageId = z
              .object({ imageId: z.string() })
              .parse(upload.data).imageId;
          }
          const body = {
            name: p.name,
            description: p.description,
            category: p.category,
            enabled: p.enabled,
            prices: p.prices,
            ...(p.pizzaGroup ? { pizzaGroup: p.pizzaGroup } : {}),
            ...(p.combo ? { combo: p.combo } : {}),
            imageId,
            ...(old ? { expectedVersion: old.version } : { id: p.id }),
          };
          return (
            await run(
              old ? `staff/products/${p.id}` : "staff/products",
              body,
              message,
              old ? "PATCH" : "POST",
            )
          ).ok;
        }
        case "PROMOTION": {
          const p = command.promotion;
          return (
            await run(
              command.expectedVersion === null
                ? "staff/promotions"
                : `staff/promotions/${p.id}`,
              {
                name: p.name,
                enabled: p.enabled,
                kind: p.kind,
                value: p.value,
                startsAt: new Date(p.startsAt).toISOString(),
                endsAt:
                  p.endsAt === null ? null : new Date(p.endsAt).toISOString(),
                pizzaLimit: p.pizzaLimit,
                ...(command.expectedVersion === null
                  ? {}
                  : { expectedVersion: command.expectedVersion }),
              },
              message,
              command.expectedVersion === null ? "POST" : "PATCH",
            )
          ).ok;
        }
        default:
          throw new Error(
            "Use o formulário conectado à API para esta operação.",
          );
      }
    } catch (error) {
      notify(readable(error), true);
      return false;
    }
  };
  const api: ApiContextValue = {
    user,
    authenticating,
    stale,
    updatedAt,
    catalog,
    drivers,
    users,
    kitchen,
    pending,
    hasMore,
    writing,
    login: async (email, password) => {
      setAuthenticating(true);
      try {
        const data = z.object({ user: userSchema }).parse(
          await request("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          }),
        );
        clear();
        setUser(data.user);
      } catch (error) {
        notify(readable(error), true);
      } finally {
        setAuthenticating(false);
      }
    },
    logout: async () => {
      try {
        await request("/api/session", { method: "DELETE" });
        clear();
      } catch (error) {
        notify(readable(error), true);
      }
    },
    run,
    createUser: async (body, key) => {
      if (locked.current) return false;
      locked.current = true;
      setWriting(true);
      try {
        // Passwords are only in the form's memory. Never persist them in IndexedDB.
        await request("/api/backend/staff/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify(body),
        });
        notify(
          "Conta criada. A equipe já pode entrar com o e-mail e a senha cadastrados.",
        );
        await reload();
        return true;
      } catch (error) {
        notify(readable(error), true);
        await reload();
        return false;
      } finally {
        locked.current = false;
        setWriting(false);
      }
    },
    retry: async () => {
      if (pending)
        await run(
          pending.path,
          pending.body,
          pending.label,
          pending.method,
          true,
        );
    },
    loadMore: () => setDepth((v) => v + 1),
  };
  return (
    <Context.Provider
      value={{
        state,
        error: stale,
        now,
        busy: writing || !!stale,
        toast,
        notify,
        execute,
        reload,
        reset: async () => {},
        sound,
        toggleSound: () => {
          if (sound) {
            setSound(false);
            soundRef.current = false;
            return;
          }
          try {
            audio.current ??= new AudioContext();
            void audio.current
              .resume()
              .then(() => {
                soundRef.current = true;
                setSound(true);
                beep();
              })
              .catch(() => notify("O navegador bloqueou o áudio.", true));
          } catch {
            notify("Áudio indisponível neste navegador.", true);
          }
        },
        api,
      }}
    >
      {children}
    </Context.Provider>
  );
}

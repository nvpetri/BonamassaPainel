"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ZodError } from "zod";
import { demoRepository } from "@/data/repository";
import { type Command, type State } from "@/domain/model";

interface PanelContextValue {
  state: State | null;
  error: string | null;
  now: number;
  busy: boolean;
  toast: { message: string; error: boolean } | null;
  notify(message: string, error?: boolean): void;
  execute(command: Command, message?: string): Promise<boolean>;
  reload(): Promise<void>;
  reset(): Promise<void>;
  sound: boolean;
  toggleSound(): void;
}
const Context = createContext<PanelContextValue | null>(null);
const readableError = (error: unknown) =>
  error instanceof DOMException && error.name === "QuotaExceededError"
    ? "O armazenamento do navegador está cheio. A alteração não foi salva. Remova fotos que não utiliza ou libere espaço e tente novamente."
    : error instanceof ZodError
      ? "Dados inválidos. Confira os campos e os valores informados."
      : error instanceof Error
        ? error.message
        : "Não foi possível salvar a alteração.";

export function PanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<PanelContextValue["toast"]>(null);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const soundEnabled = useRef(false);
  const lastNumber = useRef<number | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);

  const notify = useCallback(
    (message: string, isError = false) => setToast({ message, error: isError }),
    [],
  );
  const beep = useCallback(() => {
    const context = audio.current;
    if (!context || !soundEnabled.current || context.state !== "running")
      return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.setValueAtTime(880, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.09, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.32);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.33);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }, []);
  const receive = useCallback(
    (next: State) => {
      if (!mounted.current) return;
      setNow(Date.now());
      if (lastNumber.current !== null && next.nextNumber > lastNumber.current)
        beep();
      lastNumber.current = next.nextNumber;
      setState((previous) =>
        !previous ||
        previous.demoId !== next.demoId ||
        next.revision >= previous.revision
          ? next
          : previous,
      );
      setError(null);
    },
    [beep],
  );
  const reload = useCallback(async () => {
    try {
      receive(await demoRepository.read());
    } catch {
      if (mounted.current)
        setError(
          "Não conseguimos abrir os dados desta demonstração. Verifique se o navegador permite armazenamento local. Seus dados não foram substituídos.",
        );
    }
  }, [receive]);
  useEffect(() => {
    mounted.current = true;
    void reload();
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    if ("BroadcastChannel" in window) {
      channel.current = new BroadcastChannel("bonamassa-painel-demo");
      channel.current.onmessage = () => void reload();
    }
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => {
      mounted.current = false;
      clearInterval(clock);
      channel.current?.close();
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const execute = useCallback(
    async (command: Command, message = "Alteração salva.") => {
      if (pending.current) return false;
      pending.current = true;
      setBusy(true);
      try {
        receive(await demoRepository.execute(command));
        channel.current?.postMessage("updated");
        notify(message);
        return true;
      } catch (error) {
        notify(readableError(error), true);
        await reload();
        return false;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [notify, receive, reload],
  );
  const reset = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      receive(await demoRepository.reset());
      channel.current?.postMessage("updated");
      notify("Demonstração reiniciada.");
    } catch (error) {
      notify(readableError(error), true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [notify, receive]);
  const toggleSound = () => {
    if (sound) {
      soundEnabled.current = false;
      setSound(false);
      return;
    }
    try {
      audio.current ??= new AudioContext();
      void audio.current
        .resume()
        .then(() => {
          soundEnabled.current = true;
          setSound(true);
          beep();
        })
        .catch(() => notify("O navegador bloqueou o áudio.", true));
    } catch {
      notify("Áudio indisponível neste navegador.", true);
    }
  };

  return (
    <Context.Provider
      value={{
        state,
        error,
        now,
        busy,
        toast,
        notify,
        execute,
        reload,
        reset,
        sound,
        toggleSound,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function usePanel() {
  const value = useContext(Context);
  if (!value) throw new Error("PanelProvider ausente.");
  return value;
}

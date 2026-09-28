"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { z } from "zod";
import { ApiError, request } from "@/data/api-client";
import { Button, Field } from "./ui";
const roles = {
  DRIVER: "Entregador",
  KITCHEN: "Cozinha",
  ATTENDANT: "Balcão",
  MANAGER: "Gerente",
};
const schema = z.object({
  name: z.string(),
  email: z.email(),
  role: z.enum(["DRIVER", "KITCHEN", "ATTENDANT", "MANAGER"]),
  storeName: z.string(),
  expiresAt: z.iso.datetime(),
});
type Invitation = z.infer<typeof schema>;
export function StaffInvitation() {
  const generation = useRef(0);
  const [token, setToken] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invitation>();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const read = () => {
      generation.current += 1;
      setComplete(false);
      setBusy(false);
      setPassword("");
      setConfirmation("");
      setPhone("");
      setInvite(undefined);
      setLoading(true);
      setToken(
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
      );
      setRetry((value) => value + 1);
    };
    const timer = setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  useEffect(() => {
    if (token === null) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setInvite(undefined);
      setError("");
      try {
        if (!/^[A-Za-z0-9_-]{43}$/.test(token))
          throw new Error(
            "Abra o link completo recebido no e-mail de convite.",
          );
        const result = schema.parse(
          await request("/api/invitation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "inspect", token }),
          }),
        );
        if (active) setInvite(result);
      } catch (caught) {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Não foi possível consultar o convite.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    const timer = setTimeout(() => void load(), 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token, retry]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !invite) return;
    if (password !== confirmation) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    const normalized = phone.replace(/[()\s-]/g, "");
    if (invite.role === "DRIVER" && !/^\+?[1-9]\d{9,14}$/.test(normalized)) {
      setError("Informe seu telefone com DDD.");
      return;
    }
    const revision = generation.current;
    setBusy(true);
    setError("");
    try {
      await request("/api/invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          token,
          password,
          phone: normalized,
        }),
      });
      if (revision !== generation.current) return;
      setComplete(true);
      setPassword("");
      setConfirmation("");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (caught) {
      if (revision !== generation.current) return;
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Não foi possível concluir o cadastro. Tente novamente.",
      );
    } finally {
      if (revision === generation.current) setBusy(false);
    }
  }
  return (
    <main className="invitation-page">
      <section className="invitation-card" aria-label="Ativação do acesso">
        <Image
          src="/bonamassa-logo.webp"
          alt="Bonamassa"
          width={88}
          height={88}
          priority
        />
        <div className="eyebrow">EQUIPE BONAMASSA</div>
        <h1>{complete ? "Cadastro concluído!" : "Seu acesso começa aqui."}</h1>
        {complete ? (
          <div role="status">
            <p>Seu e-mail foi confirmado e sua senha está pronta para uso.</p>
            {invite?.role === "DRIVER" ? (
              <p>
                Abra o aplicativo <strong>Bonamassa Entregador</strong> e entre
                com <strong>{invite.email}</strong> e a senha que você acabou de
                escolher.
              </p>
            ) : (
              <>
                <p>
                  O acesso de {invite ? roles[invite.role] : "equipe"} já pode
                  ser usado no painel.
                </p>
                <Link className="button primary full" href="/pedidos">
                  Entrar no painel
                </Link>
              </>
            )}
          </div>
        ) : loading ? (
          <p role="status">Verificando seu convite…</p>
        ) : (
          <>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {invite ? (
              <>
                <p>
                  {invite.storeName} convidou você para completar este acesso.
                </p>
                <dl className="invitation-details">
                  <div>
                    <dt>Nome</dt>
                    <dd>{invite.name}</dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>{invite.email}</dd>
                  </div>
                  <div>
                    <dt>Função</dt>
                    <dd>{roles[invite.role]}</dd>
                  </div>
                </dl>
                <form onSubmit={submit}>
                  {invite.role === "DRIVER" ? (
                    <Field label="Telefone com DDD">
                      <input
                        type="tel"
                        autoComplete="tel"
                        required
                        maxLength={20}
                        value={phone}
                        disabled={busy}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Field>
                  ) : invite.role === "MANAGER" ? null : (
                    <p className="field-hint">
                      Se este é o acesso compartilhado da cozinha ou do balcão,
                      o responsável define a senha que será utilizada no setor.
                    </p>
                  )}
                  <Field
                    label="Crie sua senha"
                    hint="Use de 12 a 128 caracteres."
                  >
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      value={password}
                      disabled={busy}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </Field>
                  <Field label="Confirme a senha">
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      value={confirmation}
                      disabled={busy}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </Field>
                  <Button
                    type="submit"
                    tone="primary"
                    className="full"
                    disabled={busy}
                  >
                    {busy ? "Concluindo cadastro…" : "Concluir cadastro"}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <p>
                  Se o link expirou, peça ao gerente para reenviar o convite. Se
                  você já concluiu o cadastro, entre com a senha escolhida.
                </p>
                <Button onClick={() => setRetry((n) => n + 1)}>
                  Consultar convite novamente
                </Button>
                <Link className="button ghost full" href="/pedidos">
                  Já tenho acesso ao painel
                </Link>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

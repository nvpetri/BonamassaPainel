"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { get } from "@/data/api-client";
import { usePanel } from "./panel-provider";
import { Button, Field, Modal } from "./ui";

const tables = [
  "Store",
  "User",
  "Product",
  "ProductImage",
  "Promotion",
  "Order",
  "OrderEvent",
  "Session",
  "VerificationCode",
  "StaffInvitation",
  "Audit",
];
const entry = z.object({
  id: z.string(),
  tableName: z.string(),
  recordId: z.string(),
  operation: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  actorRole: z.string().nullable(),
  sharedAccount: z.boolean(),
  origin: z.string(),
  clientSource: z.string().nullable(),
  requestId: z.string().nullable(),
  action: z.string().nullable(),
  changedFields: z.array(z.string()),
  createdAt: z.string(),
});
const detailSchema = entry.extend({
  before: z.unknown(),
  after: z.unknown(),
  databaseUser: z.string(),
  transactionId: z.string(),
  sessionId: z.string().nullable(),
  method: z.string().nullable(),
  path: z.string().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  keyHash: z.string().nullable(),
});
type Entry = z.infer<typeof entry>;
const operations: Record<string, string> = {
  INSERT: "Inclusão",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};
const date = (value: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
const time = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const at = (object: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value === "[REDACTED]"
          ? value
          : value && typeof value === "object"
            ? (value as Record<string, unknown>)[key]
            : undefined,
      object,
    );
const text = (value: unknown) =>
  value === undefined
    ? "—"
    : value === "[REDACTED]"
      ? "[Protegido]"
      : JSON.stringify(value, null, 2);

export function AuditViewer() {
  const { api } = usePanel();
  const [from, setFrom] = useState(() => date(Date.now() - 6 * 86400000));
  const [to, setTo] = useState(() => date(Date.now()));
  const [table, setTable] = useState("");
  const [actor, setActor] = useState("");
  const [operation, setOperation] = useState("");
  const [origin, setOrigin] = useState("");
  const [recordId, setRecordId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [rows, setRows] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [applied, setApplied] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<z.infer<typeof detailSchema>>();
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function load(query: string, append = false) {
    const revision = ++generation.current;
    setBusy(true);
    setError("");
    setDetail(undefined);
    try {
      const result = z
        .object({ items: z.array(entry), nextCursor: z.string().nullable() })
        .parse(await get(`staff/audit?${query}`));
      if (revision !== generation.current) return;
      setRows((previous) =>
        append ? [...previous, ...result.items] : result.items,
      );
      setCursor(result.nextCursor);
    } catch {
      if (revision === generation.current) {
        setRows([]);
        setCursor(null);
        setError(
          "Não foi possível consultar a auditoria. Confira os filtros e seu acesso de gerente.",
        );
      }
    } finally {
      if (revision === generation.current) setBusy(false);
    }
  }
  function search(event: FormEvent) {
    event.preventDefault();
    const start = Date.parse(`${from}T00:00:00-03:00`),
      finish = Date.parse(`${to}T00:00:00-03:00`) + 86400000;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(finish) ||
      finish <= start ||
      finish - start > 93 * 86400000
    ) {
      setError("Selecione um período de até 93 dias, em ordem.");
      return;
    }
    const query = new URLSearchParams({
      from: new Date(start).toISOString(),
      to: new Date(finish).toISOString(),
      limit: "20",
    });
    for (const [key, value] of Object.entries({
      table,
      actorId: actor,
      operation,
      origin,
      recordId: recordId.trim(),
      requestId: requestId.trim(),
    }))
      if (value) query.set(key, value);
    setApplied(query.toString());
    void load(query.toString());
  }
  async function inspect(id: string) {
    const revision = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = detailSchema.parse(await get(`staff/audit/${id}`));
      if (revision === generation.current) setDetail(result);
    } catch {
      if (revision === generation.current) {
        setDetail(undefined);
        setRows([]);
        setCursor(null);
        setError(
          "Não foi possível abrir o registro. Verifique seu acesso e consulte novamente.",
        );
      }
    } finally {
      if (revision === generation.current) setBusy(false);
    }
  }
  return (
    <section
      className="audit-viewer settings-card"
      aria-label="Auditoria da operação"
    >
      <h2>Auditoria da operação</h2>
      <p>
        Consulte alterações confirmadas no banco. Horários de São Paulo. Contas
        de balcão e cozinha identificam o setor, não a pessoa que estava usando.
      </p>
      <form onSubmit={search} className="audit-filters">
        <Field label="Auditoria de">
          <input
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Auditoria até">
          <input
            type="date"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Tabela">
          <select value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="">Todas</option>
            {tables.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Conta responsável">
          <select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Todas as contas e rotinas</option>
            {api?.users.map((u) => (
              <option value={u.id} key={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Operação">
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(operations).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Origem">
          <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
            <option value="">Todas</option>
            <option value="HTTP">API</option>
            <option value="SYSTEM">Rotina automática</option>
            <option value="SQL">Banco sem identidade da aplicação</option>
          </select>
        </Field>
        <Field label="ID do registro">
          <input
            value={recordId}
            maxLength={100}
            onChange={(e) => setRecordId(e.target.value)}
          />
        </Field>
        <Field label="ID da requisição">
          <input
            value={requestId}
            maxLength={36}
            onChange={(e) => setRequestId(e.target.value)}
          />
        </Field>
        <Button type="submit" tone="primary" disabled={busy}>
          Consultar registros
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Consultando auditoria…</p>}
      {!busy && applied && !error && rows.length === 0 && (
        <p>Nenhum registro encontrado para os filtros.</p>
      )}
      <div className="audit-results">
        {rows.map((row) => (
          <article key={row.id} className="audit-entry">
            <div>
              <strong>
                {operations[row.operation]} · {row.tableName}
              </strong>
              <p>
                {time(row.createdAt)} · #{row.id}
              </p>
            </div>
            <p>
              {row.actorName ||
                (row.origin === "SYSTEM"
                  ? "Rotina automática"
                  : "Sem usuário autenticado")}
              {row.sharedAccount ? " · Conta do setor" : ""}
            </p>
            <p>
              Registro: <code>{row.recordId}</code>
            </p>
            <p>Campos: {row.changedFields.join(", ")}</p>
            <Button
              disabled={busy}
              onClick={() => void inspect(row.id)}
              aria-label={`Ver auditoria ${row.id}`}
            >
              Ver antes e depois
            </Button>
          </article>
        ))}
      </div>
      {cursor && (
        <Button
          disabled={busy}
          onClick={() => void load(`${applied}&cursor=${cursor}`, true)}
        >
          Carregar mais registros
        </Button>
      )}
      {detail && (
        <Modal
          title={`Auditoria #${detail.id}`}
          onClose={() => setDetail(undefined)}
        >
          <div className="audit-details">
            <p>
              <strong>
                {operations[detail.operation]} em {detail.tableName}
              </strong>{" "}
              · {time(detail.createdAt)}
            </p>
            <p>
              Conta: {detail.actorName || "Não identificada"} ·{" "}
              {detail.actorRole || detail.origin}
              {detail.sharedAccount ? " · Conta compartilhada do setor" : ""}
            </p>
            <dl>
              {Object.entries({
                "ID da conta": detail.actorId,
                "ID do registro": detail.recordId,
                Requisição: detail.requestId,
                "Transação do banco": detail.transactionId,
                Origem: detail.origin,
                "Cliente declarado": detail.clientSource,
                Ação: detail.action,
                Método: detail.method,
                Caminho: detail.path,
                "IP da conexão à API": detail.ip,
                "Agente HTTP": detail.userAgent,
                "Usuário do banco": detail.databaseUser,
                "ID da sessão": detail.sessionId,
                "Hash de idempotência": detail.keyHash,
              }).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <p>
              Segredos, contatos e textos pessoais são protegidos. A origem
              declarada pelo cliente não comprova o dispositivo.
            </p>
            {detail.changedFields.map((field) => (
              <section key={field} className="audit-change">
                <h3>{field}</h3>
                <p>Antes</p>
                <pre>{text(at(detail.before, field))}</pre>
                <p>Depois</p>
                <pre>{text(at(detail.after, field))}</pre>
              </section>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}

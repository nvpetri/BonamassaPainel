"use client";

import { randomId } from "@/data/api-client";

import { useState, type FormEvent } from "react";
import {
  BadgePercent,
  CalendarClock,
  Check,
  CirclePause,
  Pencil,
  Pizza,
  Play,
  Plus,
  Tag,
} from "lucide-react";
import { brl } from "@/domain/model";
import {
  formatPromotionDate,
  parsePromotionDate,
  promotionDateInput,
  promotionSchema,
  promotionStatus,
  promotionUsage,
  type Promotion,
} from "@/domain/promotions";
import { usePanel } from "./panel-provider";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  MoneyInput,
  moneyText,
  parseMoney,
} from "./ui";

export const discountLabel = (p: Pick<Promotion, "kind" | "value">) =>
  p.kind === "PERCENTAGE" ? `${p.value}%` : brl(p.value);

export function Promotions() {
  const { state, now, busy, execute, api } = usePanel();
  const [editing, setEditing] = useState<Promotion | null | undefined>(
    undefined,
  );
  const [filter, setFilter] = useState("all");
  const promotions = state!.promotions;
  const active = promotions.filter(
    (p) => promotionStatus(p, state!.orders, now) === "Ativa",
  );
  const visible = filter === "all" ? promotions : active;
  const sold = state!.orders.filter((o) => o.status === "DELIVERED");
  const saved = sold.reduce((sum, order) => sum + order.discount, 0);
  const soldPizzas = api
    ? promotions.reduce((sum, p) => sum + promotionUsage(p, []).sold, 0)
    : sold.reduce(
        (sum, order) => sum + (order.promotion?.pizzaQuantity ?? 0),
        0,
      );
  return (
    <>
      <div className="promotion-intro">
        <div className="promotion-intro-icon">
          <BadgePercent size={28} />
        </div>
        <div>
          <span className="eyebrow">MAIS UM MOTIVO PARA PEDIR</span>
          <h2>Uma boa oferta. No seu controle.</h2>
          <p>
            Defina o desconto e escolha até quando — ou para quantas pizzas —
            ele vale.
          </p>
        </div>
        <Button
          tone="primary"
          onClick={() => setEditing(null)}
          disabled={busy || promotions.length >= 100}
        >
          <Plus size={17} /> Nova promoção
        </Button>
      </div>
      <div className="promotion-metrics">
        <div>
          <span>
            <Tag size={16} /> Promoções ativas
          </span>
          <strong>{active.length}</strong>
          <small>Disponíveis para novos pedidos</small>
        </div>
        <div>
          <span>
            <Pizza size={16} /> Pizzas vendidas em promoção
          </span>
          <strong>{soldPizzas}</strong>
          <small>
            {api
              ? "Pedidos concluídos · contador da API"
              : "Somente pedidos concluídos"}
          </small>
        </div>
        <div>
          <span>
            <BadgePercent size={16} /> Descontos concedidos
          </span>
          <strong>{brl(saved)}</strong>
          <small>
            {api
              ? "Nos pedidos concluídos carregados"
              : "Somente pedidos concluídos"}
          </small>
        </div>
      </div>
      <div className="board-toolbar">
        <div className="tabs">
          <button
            className={filter === "all" ? "selected" : ""}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todas <span>{promotions.length}</span>
          </button>
          <button
            className={filter === "active" ? "selected" : ""}
            aria-pressed={filter === "active"}
            onClick={() => setFilter("active")}
          >
            Ativas agora <span>{active.length}</span>
          </button>
        </div>
        <span className="toolbar-note">
          <CalendarClock size={15} /> Horários de Brasília
        </span>
      </div>
      {visible.length ? (
        <div className="promotion-grid">
          {visible.map((p) => {
            const status = promotionStatus(p, state!.orders, now);
            const usage = promotionUsage(p, state!.orders);
            return (
              <article
                className="promotion-card"
                key={p.id}
                aria-label={`Promoção ${p.name}`}
              >
                <div className="promotion-card-heading">
                  <span className="promotion-tag">
                    <Tag size={17} /> OFERTA NAS PIZZAS
                  </span>
                  <Badge
                    tone={
                      status === "Ativa"
                        ? "green"
                        : status === "Agendada"
                          ? "blue"
                          : status === "Limite atingido"
                            ? "gold"
                            : "neutral"
                    }
                  >
                    {status}
                  </Badge>
                </div>
                <h3>{p.name}</h3>
                <div className="promotion-discount">
                  {discountLabel(p)}{" "}
                  <span>
                    de desconto
                    <br />
                    por pizza
                  </span>
                </div>
                <p className="field-hint">
                  Todos os sabores e tamanhos. Borda, bebidas e entrega à parte.
                </p>
                <div className="promotion-validity">
                  <CalendarClock size={17} />
                  <div>
                    <span>A partir de {formatPromotionDate(p.startsAt)}</span>
                    <strong>
                      {p.endsAt === null
                        ? "Até atingir o limite de pizzas"
                        : `Até ${formatPromotionDate(p.endsAt)}`}
                    </strong>
                  </div>
                </div>
                <div className="promotion-usage" aria-label="Uso da promoção">
                  <div>
                    <strong>{usage.sold}</strong>
                    <span>vendidas</span>
                  </div>
                  <div>
                    <strong>{usage.reserved}</strong>
                    <span>reservadas</span>
                  </div>
                  <div>
                    <strong>{usage.remaining ?? "—"}</strong>
                    <span>
                      {usage.remaining === null ? "sem limite" : "disponíveis"}
                    </span>
                  </div>
                </div>
                {p.pizzaLimit !== null && (
                  <>
                    <progress
                      value={usage.sold + usage.reserved}
                      max={p.pizzaLimit}
                      aria-label={`Pizzas utilizadas de ${p.name}`}
                    />
                    <p className="promotion-progress-caption">
                      {usage.sold + usage.reserved} de {p.pizzaLimit} pizzas
                      utilizadas
                    </p>
                  </>
                )}
                <div className="promotion-card-actions">
                  <Button onClick={() => setEditing(p)} disabled={busy}>
                    <Pencil size={15} /> Editar
                  </Button>
                  <Button
                    tone="ghost"
                    disabled={busy}
                    onClick={() =>
                      void execute(
                        {
                          type: "PROMOTION",
                          promotion: { ...p, enabled: !p.enabled },
                          expectedVersion: p.version,
                        },
                        p.enabled
                          ? "Promoção pausada. Pedidos existentes mantêm o desconto."
                          : "Promoção habilitada. Os limites continuam valendo.",
                      )
                    }
                  >
                    {p.enabled ? <CirclePause size={16} /> : <Play size={16} />}
                    {p.enabled ? "Pausar" : "Habilitar"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-table promotion-empty">
          <Empty
            title={
              promotions.length
                ? "Nenhuma promoção ativa agora"
                : "Sua próxima oferta começa aqui"
            }
            description={
              promotions.length
                ? "Confira os prazos e limites na aba Todas."
                : "Exemplo: 15% de desconto até domingo ou R$ 10 nas primeiras 50 pizzas."
            }
          >
            <Button onClick={() => setEditing(null)}>
              <Plus size={16} /> Criar promoção
            </Button>
          </Empty>
        </div>
      )}
      <div className="promotion-help">
        <Check size={18} />
        <p>
          Ao criar um pedido, escolha a promoção no resumo. Cada pizza inteira
          conta uma unidade, mesmo com dois sabores. Pedidos em andamento
          reservam o limite; cancelamentos e devoluções confirmadas liberam as
          unidades. Se houver prazo e quantidade, vale o primeiro limite
          atingido.
        </p>
      </div>
      {editing !== undefined && (
        <PromotionEditor
          key={editing?.id ?? "new"}
          promotion={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}

function PromotionEditor({
  promotion,
  onClose,
}: {
  promotion: Promotion | null;
  onClose(): void;
}) {
  const { now, busy, execute, state } = usePanel();
  const [name, setName] = useState(promotion?.name ?? "");
  const [kind, setKind] = useState<Promotion["kind"]>(
    promotion?.kind ?? "PERCENTAGE",
  );
  const [percent, setPercent] = useState(
    promotion?.kind === "PERCENTAGE" ? String(promotion.value) : "15",
  );
  const [fixed, setFixed] = useState(
    promotion?.kind === "FIXED" ? moneyText(promotion.value) : "10,00",
  );
  const [immediate, setImmediate] = useState(!promotion);
  const [start, setStart] = useState(
    promotionDateInput(promotion?.startsAt ?? now),
  );
  const [byTime, setByTime] = useState(
    promotion ? promotion.endsAt !== null : true,
  );
  const [end, setEnd] = useState(
    promotionDateInput(promotion?.endsAt ?? now + 24 * 60 * 60_000),
  );
  const [byQuantity, setByQuantity] = useState(
    promotion?.pizzaLimit !== null && promotion?.pizzaLimit !== undefined,
  );
  const [quantity, setQuantity] = useState(String(promotion?.pizzaLimit ?? 50));
  const [error, setError] = useState("");
  const usage = promotion ? promotionUsage(promotion, state!.orders) : null;
  const value = kind === "PERCENTAGE" ? Number(percent) : parseMoney(fixed);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const parsed = promotionSchema.safeParse({
      id: promotion?.id ?? randomId(),
      version: promotion?.version ?? 0,
      name,
      kind,
      value,
      enabled: promotion?.enabled ?? true,
      startsAt: immediate
        ? now
        : promotion && start === promotionDateInput(promotion.startsAt)
          ? promotion.startsAt
          : parsePromotionDate(start),
      endsAt: byTime ? parsePromotionDate(end) : null,
      pizzaLimit: byQuantity ? Number(quantity) : null,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? "Confira os campos da promoção.",
      );
      return;
    }
    if (
      await execute(
        {
          type: "PROMOTION",
          promotion: parsed.data,
          expectedVersion: promotion?.version ?? null,
        },
        promotion
          ? "Promoção atualizada. Pedidos existentes mantêm os valores originais."
          : "Promoção criada! Selecione-a no resumo dos novos pedidos.",
      )
    )
      onClose();
  };
  return (
    <Modal
      title={promotion ? "Editar promoção" : "Nova promoção"}
      subtitle="Uma oferta por pedido, aplicada ao preço de cada pizza."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="promotion-form">
          <Field label="Nome da promoção">
            <input
              autoFocus
              required
              maxLength={70}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Noite da pizza"
            />
          </Field>
          <div className="form-row">
            <Field label="Tipo de desconto">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as Promotion["kind"])}
              >
                <option value="PERCENTAGE">Percentual (%)</option>
                <option value="FIXED">Valor fixo (R$)</option>
              </select>
            </Field>
            {kind === "PERCENTAGE" ? (
              <Field label="Desconto (%)">
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  step={1}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Desconto por pizza (R$)">
                <MoneyInput value={fixed} onChange={setFixed} required />
              </Field>
            )}
          </div>
          <p className="field-hint">
            Desconto sobre a pizza, sem borda recheada, bebidas ou taxa de
            entrega. O desconto nunca ultrapassa o preço da pizza.
          </p>
          <fieldset className="promotion-limits">
            <legend>Quando começa?</legend>
            <label className="check-field">
              <input
                type="checkbox"
                checked={immediate}
                onChange={(e) => setImmediate(e.target.checked)}
              />{" "}
              Começar agora
            </label>
            {!immediate && (
              <Field label="Início (Brasília)">
                <input
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </Field>
            )}
          </fieldset>
          <fieldset className="promotion-limits">
            <legend>Quando termina?</legend>
            <p className="field-hint">
              Escolha pelo menos um limite. Você pode combinar os dois.
            </p>
            <label className="check-field">
              <input
                type="checkbox"
                checked={byTime}
                onChange={(e) => setByTime(e.target.checked)}
              />{" "}
              Por data e horário
            </label>
            {byTime && (
              <Field label="Fim (Brasília)">
                <input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </Field>
            )}
            <label className="check-field">
              <input
                type="checkbox"
                checked={byQuantity}
                onChange={(e) => setByQuantity(e.target.checked)}
              />{" "}
              Por quantidade de pizzas
            </label>
            {byQuantity && (
              <Field
                label="Limite de pizzas"
                hint={
                  usage
                    ? `${usage.sold} vendidas e ${usage.reserved} reservadas. O limite inclui essas unidades.`
                    : "Conta pizzas inteiras com desconto, não pedidos nem fatias."
                }
              >
                <input
                  type="number"
                  min={Math.max(1, (usage?.sold ?? 0) + (usage?.reserved ?? 0))}
                  max={100000}
                  step={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
            )}
          </fieldset>
          <div className="promotion-preview">
            <Tag size={21} />
            <div>
              <strong>
                {Number.isFinite(value) && value > 0
                  ? `${discountLabel({ kind, value })} de desconto por pizza`
                  : "Defina o desconto"}
              </strong>
              <span>
                {byTime && byQuantity
                  ? `Até o prazo escolhido ou ${quantity || "0"} pizzas, o que ocorrer primeiro.`
                  : byTime
                    ? "Disponível até o prazo escolhido."
                    : byQuantity
                      ? `Disponível para até ${quantity || "0"} pizzas.`
                      : "Selecione um limite para continuar."}
              </span>
            </div>
          </div>
          {promotion && (
            <p className="field-hint">
              Editar não reinicia o contador nem altera pedidos já criados. Para
              uma nova campanha com outro contador, crie uma nova promoção.
            </p>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-footer">
          <Button onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button
            type="submit"
            tone="primary"
            disabled={busy || (!byTime && !byQuantity)}
          >
            <Check size={17} />
            {busy ? "Salvando…" : "Salvar promoção"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

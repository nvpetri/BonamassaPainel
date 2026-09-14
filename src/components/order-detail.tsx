"use client";

import { useState, type FormEvent } from "react";
import { storeDate } from "@/domain/schedule";
import {
  ArrowRight,
  Check,
  ChefHat,
  MapPin,
  PackageCheck,
  Printer,
  Route,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  brl,
  channelLabels,
  isActive,
  paymentLabels,
  type Order,
  type OrderAction,
} from "@/domain/model";
import { usePanel } from "./panel-provider";
import { ItemComponents } from "./order-components";
import { Badge, Button, Field, Modal, StatusBadge } from "./ui";

export function nextAction(
  order: Order,
  role?: string,
): { label: string; action: OrderAction; simple?: boolean } | null {
  if (
    role &&
    ((["CONFIRMED", "PREPARING"].includes(order.status) &&
      role === "ATTENDANT") ||
      (order.mode === "DELIVERY" &&
        (order.status === "OUT_FOR_DELIVERY" ||
          (order.status === "READY" && !!order.driverId))))
  )
    return null;
  if (order.status === "NEW")
    return { label: "Aceitar pedido", action: "ACCEPT", simple: true };
  if (order.status === "CONFIRMED")
    return { label: "Iniciar preparo", action: "PREPARE", simple: true };
  if (order.status === "PREPARING")
    return { label: "Marcar como pronto", action: "READY", simple: true };
  if (order.status === "READY") {
    if (order.mode === "PICKUP")
      return { label: "Confirmar retirada", action: "COMPLETE" };
    if (!order.driverId)
      return { label: "Atribuir entregador", action: "ASSIGN" };
    if (order.deliveryStatus === "ASSIGNED")
      return { label: "Simular retirada", action: "COLLECT" };
    return { label: "Simular saída", action: "START" };
  }
  if (order.status === "OUT_FOR_DELIVERY")
    return { label: "Simular conclusão", action: "COMPLETE" };
  if (order.status === "RETURNING")
    return { label: "Confirmar devolução", action: "RETURN" };
  return null;
}
const actionIcons = {
  ACCEPT: Check,
  PREPARE: ChefHat,
  READY: PackageCheck,
  ASSIGN: Truck,
  COLLECT: PackageCheck,
  START: Route,
  COMPLETE: Check,
  ISSUE: Route,
  RETURN: PackageCheck,
  CANCEL: X,
};

export function CardAction({
  order,
  onOpen,
  kitchen = false,
  onCancel,
}: {
  order: Order;
  onOpen(): void;
  kitchen?: boolean;
  onCancel?(): void;
}) {
  const { execute, busy, api } = usePanel();
  const next = nextAction(order, api?.user?.role);
  if (!next)
    return (
      <Button className="full" onClick={onOpen}>
        Ver detalhes
      </Button>
    );
  const Icon = actionIcons[next.action];
  const expediting = kitchen && order.status === "READY";
  return (
    <div className="card-actions-stack">
      <Button
        className="full"
        tone={
          order.status === "NEW"
            ? "success"
            : order.status === "PREPARING"
              ? "gold"
              : "secondary"
        }
        disabled={busy}
        onClick={() => {
          if (next.simple && !expediting)
            void execute(
              {
                type: "ORDER",
                id: order.id,
                version: order.version,
                action: next.action,
              },
              "Etapa do pedido atualizada.",
            );
          else onOpen();
        }}
      >
        <Icon size={16} />
        {expediting ? "Ver expedição" : next.label}
        {!expediting && <ArrowRight size={14} className="end-icon" />}
      </Button>
      {order.status === "NEW" &&
        onCancel &&
        (!api || api.user?.role === "MANAGER") && (
          <Button
            tone="danger"
            className="full cancel-order"
            disabled={busy}
            onClick={onCancel}
          >
            <X size={16} /> Cancelar pedido
          </Button>
        )}
    </div>
  );
}

export function OrderDetail({
  order,
  onClose,
  initialCancelVersion,
}: {
  order: Order;
  initialCancelVersion?: number;
  onClose(): void;
}) {
  const { state, execute, busy, notify, api } = usePanel();
  const [intent, setIntent] = useState<{
    action: OrderAction;
    version: number;
  } | null>(
    initialCancelVersion === undefined
      ? null
      : { action: "CANCEL", version: initialCancelVersion },
  );
  const [driverId, setDriverId] = useState("");
  const [reason, setReason] = useState("");
  const [recipient, setRecipient] = useState("");
  const [paid, setPaid] = useState(false);
  const next = nextAction(order, api?.user?.role);
  const driver = state!.drivers.find((d) => d.id === order.driverId);
  const stale = intent && intent.version !== order.version;
  const cancellable =
    (!api || api.user?.role === "MANAGER") &&
    ["SCHEDULED", "NEW", "CONFIRMED", "PREPARING", "READY"].includes(
      order.status,
    ) &&
    order.deliveryStatus !== "COLLECTED";
  const begin = (action: OrderAction) => {
    setIntent({ action, version: order.version });
    setReason("");
    setRecipient("");
    setPaid(false);
    setDriverId("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!intent) return;
    const success = await execute(
      {
        type: "ORDER",
        id: order.id,
        version: intent.version,
        action: intent.action,
        driverId,
        reason,
        recipient,
        paymentCollected: paid,
      },
      "Pedido atualizado.",
    );
    if (success) setIntent(null);
  };
  const openRoute = () =>
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}&travelmode=driving`,
      "_blank",
      "noopener,noreferrer",
    );
  return (
    <Modal
      title={`Pedido #${order.number}`}
      subtitle={`${channelLabels[order.channel]} · ${new Date(order.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
      onClose={onClose}
      drawer
    >
      <div className="detail-content printable">
        <div className="detail-status">
          <StatusBadge order={order} />
          {order.scheduledFor && (
            <p className="field-hint">
              {order.status === "SCHEDULED"
                ? "Agendado para"
                : "Reserva original"}{" "}
              {storeDate(order.scheduledFor)} · São Paulo.
              {order.status === "SCHEDULED"
                ? " Aguarda abertura da loja; ainda não está em preparo."
                : ""}
            </p>
          )}
          <Badge>
            {order.mode === "DELIVERY" ? "Entrega" : "Retirada no balcão"}
          </Badge>
        </div>
        <div className="detail-section">
          <h3>
            <UserRound size={16} /> Cliente
          </h3>
          <strong>{order.customer}</strong>
          {order.customerPhone && <p>{order.customerPhone}</p>}
          {order.mode === "DELIVERY" && (
            <>
              <p>{order.address}</p>
              {order.reference && <p className="muted">{order.reference}</p>}
              <div className="detail-inline-actions no-print">
                <Button tone="ghost" onClick={openRoute}>
                  <MapPin size={15} /> Abrir rota
                </Button>
                <Button
                  tone="ghost"
                  onClick={() => {
                    if (!navigator.clipboard) {
                      notify(
                        "Copiar não está disponível neste navegador. Selecione o endereço manualmente.",
                        true,
                      );
                      return;
                    }
                    void navigator.clipboard
                      .writeText(order.address)
                      .then(() => notify("Endereço copiado."))
                      .catch(() =>
                        notify(
                          "Não foi possível copiar. Selecione o endereço manualmente.",
                          true,
                        ),
                      );
                  }}
                >
                  Copiar endereço
                </Button>
              </div>
            </>
          )}
        </div>
        <div className="detail-section">
          <h3>
            <ChefHat size={16} /> Itens e preparo
          </h3>
          {order.items.map((item) => (
            <div className="detail-item" key={item.id}>
              <span className="quantity">{item.quantity}×</span>
              <div>
                <strong>{item.name}</strong>
                <small>{item.detail}</small>
                {item.components && (
                  <ItemComponents
                    components={item.components}
                    multiplier={item.quantity}
                  />
                )}
                {item.note && <span className="item-note">{item.note}</span>}
              </div>
              <b>{brl(item.quantity * item.unitPrice)}</b>
            </div>
          ))}
          {order.note && (
            <div className="order-note">
              <span>OBS.</span>
              {order.note}
            </div>
          )}
        </div>
        <div className="detail-section">
          <div className="total-line">
            <span>Itens</span>
            <b>{brl(order.total + order.discount - order.fee)}</b>
          </div>
          {order.promotion && (
            <div className="total-line promotion-total">
              <span>
                {order.promotion.name}
                <small className="promotion-detail-count">
                  {order.promotion.pizzaQuantity} pizza(s) com desconto
                </small>
              </span>
              <b>− {brl(order.discount)}</b>
            </div>
          )}
          <div className="total-line">
            <span>Taxa de entrega</span>
            <b>{brl(order.fee)}</b>
          </div>
          <div className="total-line grand-total">
            <span>Total</span>
            <b>{brl(order.total)}</b>
          </div>
          <div className="payment-box">
            <strong>
              {api && order.payment === "PREPAID"
                ? "Pagamento registrado"
                : paymentLabels[order.payment]}
            </strong>
            <span>
              {order.total === 0
                ? "Sem valor a cobrar"
                : order.paymentCollected
                  ? "Recebimento registrado"
                  : isActive(order)
                    ? `Cobrar ${brl(order.total)} ao entregar`
                    : "Sem recebimento registrado"}
            </span>
            {order.payment === "CASH" && order.total > 0 && (
              <span>
                Cliente informa {brl(order.cashTendered)} · Troco{" "}
                <b>{brl(order.cashTendered - order.total)}</b>
              </span>
            )}
          </div>
        </div>
        {driver && (
          <div className="detail-section driver-assigned">
            <span className={`avatar ${driver.color}`}>{driver.initials}</span>
            <div>
              <small>Entregador atribuído</small>
              <strong>{driver.name}</strong>
            </div>
            {order.deliveryStatus === "ASSIGNED" && (
              <Button
                tone="ghost"
                className="no-print"
                onClick={() => begin("ASSIGN")}
              >
                Trocar
              </Button>
            )}
          </div>
        )}
        <div className="detail-section">
          <h3>Histórico do pedido</h3>
          <ol className="timeline">
            {order.events.map((event) => (
              <li key={event.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{event.label}</strong>
                  <time>
                    {new Date(event.at).toLocaleTimeString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="print-disclaimer">
          {api ? "Bonamassa Pizzaria" : "Demonstração Bonamassa"} · Comanda sem
          valor fiscal
        </p>
      </div>
      <div className="detail-controls no-print">
        {intent ? (
          <form onSubmit={submit} className="action-confirm">
            <h3>
              {intent.action === "CANCEL"
                ? "Cancelar este pedido?"
                : intent.action === "ISSUE"
                  ? "Registrar tentativa sem sucesso"
                  : intent.action === "ASSIGN"
                    ? "Escolher entregador"
                    : intent.action === "COMPLETE"
                      ? "Confirmar recebimento"
                      : intent.action === "COLLECT"
                        ? "Simular retirada pelo motoboy?"
                        : intent.action === "START"
                          ? "Simular saída para entrega?"
                          : "Confirmar devolução na pizzaria?"}
            </h3>
            {stale && (
              <p className="inline-error">
                O pedido mudou em outra tela. Volte e confira a etapa atual.
              </p>
            )}
            {intent.action === "ASSIGN" && (
              <Field label="Entregador disponível">
                <select
                  required
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                >
                  <option value="">Selecione um entregador</option>
                  {state!.drivers
                    .filter((d) => d.id !== order.driverId)
                    .map((d) => (
                      <option value={d.id} key={d.id} disabled={!d.available}>
                        {d.name}
                        {!d.available ? " · pausado" : ""}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {["CANCEL", "ISSUE"].includes(intent.action) && (
              <Field label="Motivo">
                <textarea
                  required
                  maxLength={240}
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Descreva o que aconteceu"
                />
              </Field>
            )}
            {intent.action === "CANCEL" && order.payment === "PREPAID" && (
              <p className="field-hint">
                Cancelar o pedido não realiza estorno.
              </p>
            )}
            {intent.action === "COMPLETE" && (
              <>
                <Field label="Quem recebeu o pedido?">
                  <input
                    required
                    maxLength={80}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Nome de exemplo"
                  />
                </Field>
                {order.payment !== "PREPAID" && order.total > 0 && (
                  <label className="check-field">
                    <input
                      required
                      type="checkbox"
                      checked={paid}
                      onChange={(e) => setPaid(e.target.checked)}
                    />{" "}
                    Confirmo o recebimento de {brl(order.total)}{" "}
                    {order.payment === "CASH" ? "em dinheiro" : "na maquininha"}{" "}
                    {api ? "" : "(simulado)"}
                  </label>
                )}
              </>
            )}
            {order.mode === "DELIVERY" &&
              ["COLLECT", "START", "COMPLETE"].includes(intent.action) && (
                <p className="field-hint">
                  Simula a ação do entregador. O aplicativo Android ainda não
                  está conectado.
                </p>
              )}
            <div className="form-actions">
              <Button onClick={() => setIntent(null)} disabled={busy}>
                Voltar
              </Button>
              <Button
                type="submit"
                tone={intent.action === "CANCEL" ? "danger" : "primary"}
                disabled={busy || !!stale}
              >
                Confirmar
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="detail-buttons">
              <div className="detail-actions-stack">
                {next && (
                  <Button
                    tone={next.action === "ACCEPT" ? "success" : "primary"}
                    disabled={busy}
                    onClick={() => {
                      if (next.simple)
                        void execute({
                          type: "ORDER",
                          id: order.id,
                          version: order.version,
                          action: next.action,
                        });
                      else begin(next.action);
                    }}
                  >
                    {next.label}
                    <ArrowRight size={16} />
                  </Button>
                )}
                {cancellable && (
                  <Button
                    tone="danger"
                    className="cancel-order"
                    disabled={busy}
                    onClick={() => begin("CANCEL")}
                  >
                    <X size={16} /> Cancelar pedido
                  </Button>
                )}
              </div>
              <Button
                onClick={() => window.print()}
                aria-label="Imprimir comanda"
              >
                <Printer size={17} />
              </Button>
            </div>
            <div className="detail-secondary">
              {!api && order.status === "OUT_FOR_DELIVERY" && (
                <Button tone="ghost" onClick={() => begin("ISSUE")}>
                  Registrar problema na entrega
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

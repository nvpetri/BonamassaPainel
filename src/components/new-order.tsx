"use client";

import { RemoteNewOrder } from "./remote-new-order";

import { useState, type FormEvent } from "react";
import { Plus, Pizza, ShoppingBag, Trash2 } from "lucide-react";
import {
  brl,
  priceItems,
  quoteOrder,
  type Draft,
  type ItemDraft,
} from "@/domain/model";
import { usePanel } from "./panel-provider";
import { promotionStatus, promotionUsage } from "@/domain/promotions";
import { discountLabel } from "./promotions";
import { Button, Field, Modal, MoneyInput, moneyText, parseMoney } from "./ui";

import { ItemBuilder } from "./item-builder";
import { ItemComponents } from "./order-components";

function DemoNewOrder({
  onClose,
  initialItem,
}: {
  onClose(): void;
  initialItem?: ItemDraft;
}) {
  const { state, now, busy, execute, notify } = usePanel();
  const products = state!.products;
  const [items, setItems] = useState<ItemDraft[]>(
    initialItem ? [initialItem] : [],
  );
  const [customer, setCustomer] = useState("");
  const [channel, setChannel] = useState<Draft["channel"]>("COUNTER");
  const [mode, setMode] = useState<Draft["mode"]>("DELIVERY");
  const [address, setAddress] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<Draft["payment"]>("CARD");
  const [change, setChange] = useState(false);
  const [cash, setCash] = useState("");
  const [fee, setFee] = useState(moneyText(state!.settings.defaultFee));
  const [promotionId, setPromotionId] = useState("");
  let lines: ReturnType<typeof priceItems> = [];
  let quoteError = "";
  try {
    lines = priceItems(products, items);
  } catch (error) {
    quoteError = error instanceof Error ? error.message : "Revise os itens.";
  }
  const deliveryFee = mode === "DELIVERY" ? parseMoney(fee) : 0;
  const subtotal = lines.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  let quote: ReturnType<typeof quoteOrder> | null = null;
  if (!quoteError) {
    try {
      quote = quoteOrder(
        state!,
        {
          items,
          mode,
          fee: Number.isFinite(deliveryFee) ? deliveryFee : 0,
          promotionId,
        },
        now,
      );
    } catch (error) {
      quoteError =
        error instanceof Error ? error.message : "Confira a promoção.";
    }
  }
  const total =
    quote?.total ?? subtotal + (Number.isFinite(deliveryFee) ? deliveryFee : 0);
  const pizzaCount = items.reduce(
    (sum, item) => sum + (item.kind === "PIZZA" ? item.quantity : 0),
    0,
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!items.length) {
      notify("Adicione pelo menos um item ao pedido.", true);
      return;
    }
    if (quoteError) {
      notify(quoteError, true);
      return;
    }
    if (!Number.isFinite(deliveryFee)) {
      notify("Informe uma taxa válida, como 7,00.", true);
      return;
    }
    const cashTendered =
      payment === "CASH" && total > 0 ? (change ? parseMoney(cash) : total) : 0;
    if (!Number.isFinite(cashTendered)) {
      notify("Informe o valor em dinheiro.", true);
      return;
    }
    if (
      await execute(
        {
          type: "CREATE",
          expectedQuote: quote?.signature,
          draft: {
            customer,
            channel,
            mode,
            address: mode === "DELIVERY" ? address : "",
            reference,
            note,
            payment,
            cashTendered,
            fee: deliveryFee,
            items,
            promotionId: promotionId || null,
          },
        },
        "Pedido recebido! Ele já aparece na fila de novos.",
      )
    )
      onClose();
  };
  return (
    <Modal
      title="Novo pedido"
      subtitle="Monte um pedido para testar a operação da pizzaria."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="new-order-grid">
          <div className="form-main">
            <div className="section-label">
              <span>01</span> Cliente e recebimento
            </div>
            <div className="form-row">
              <Field label="Nome do cliente">
                <input
                  autoFocus
                  required
                  maxLength={80}
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="Use um nome de exemplo"
                />
              </Field>
              <Field label="Origem">
                <select
                  value={channel}
                  onChange={(e) =>
                    setChannel(e.target.value as Draft["channel"])
                  }
                >
                  <option value="COUNTER">Balcão / telefone</option>
                  <option value="WHATSAPP">WhatsApp (registro manual)</option>
                  <option value="APP">App (simulado)</option>
                </select>
              </Field>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={mode === "DELIVERY" ? "selected" : ""}
                onClick={() => setMode("DELIVERY")}
                aria-pressed={mode === "DELIVERY"}
              >
                Entrega
              </button>
              <button
                type="button"
                className={mode === "PICKUP" ? "selected" : ""}
                onClick={() => setMode("PICKUP")}
                aria-pressed={mode === "PICKUP"}
              >
                <ShoppingBag size={15} /> Retirada na pizzaria
              </button>
            </div>
            {mode === "DELIVERY" && (
              <>
                <Field label="Endereço de entrega">
                  <input
                    required
                    minLength={5}
                    maxLength={240}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, número, bairro e cidade de exemplo"
                  />
                </Field>
                <Field label="Referência / complemento">
                  <input
                    maxLength={240}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Apartamento, portaria ou ponto de referência"
                  />
                </Field>
              </>
            )}
            <div className="section-label">
              <span>02</span> Itens do pedido
            </div>
            <ItemBuilder
              products={products}
              allowCombos
              disabled={busy || items.length >= 30}
              onAdd={(item) => setItems([...items, item])}
            />
            <Field label="Observações gerais">
              <textarea
                rows={2}
                maxLength={240}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Algo que a cozinha ou a expedição precisa saber"
              />
            </Field>
          </div>
          <aside className="order-summary">
            <h3>Resumo do pedido</h3>
            <p className="muted">Confira antes de enviar para a fila.</p>
            {!items.length && (
              <div className="cart-empty">
                <Pizza size={32} />
                <span>Adicione a primeira pizza.</span>
              </div>
            )}
            {items.map((_, index) => (
              <div className="summary-item" key={index}>
                <div>
                  <strong>
                    {lines[index]
                      ? `${lines[index].quantity}× ${lines[index].name}`
                      : `Item ${index + 1} indisponível`}
                  </strong>
                  <small>{lines[index]?.detail}</small>
                  {lines[index]?.components && (
                    <ItemComponents
                      components={lines[index].components!}
                      multiplier={lines[index].quantity}
                    />
                  )}
                  {lines[index]?.note && (
                    <small className="gold-text">{lines[index].note}</small>
                  )}
                  <b>
                    {lines[index] &&
                      brl(lines[index].quantity * lines[index].unitPrice)}
                  </b>
                </div>
                <Button
                  tone="ghost"
                  className="icon-button"
                  aria-label={`Remover item ${index + 1}`}
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            {state!.promotions.length > 0 && (
              <div className="order-promotion">
                <Field
                  label="Promoção do pedido"
                  hint="Uma promoção por pedido. Desconto só nas pizzas avulsas, sem bordas, bebidas, combos e entrega."
                >
                  <select
                    value={promotionId}
                    onChange={(e) => setPromotionId(e.target.value)}
                  >
                    <option value="">Sem promoção</option>
                    {state!.promotions.map((p) => {
                      const status = promotionStatus(p, state!.orders, now);
                      const remaining = promotionUsage(
                        p,
                        state!.orders,
                      ).remaining;
                      return (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={status !== "Ativa"}
                        >
                          {p.name} · {discountLabel(p)}
                          {status !== "Ativa"
                            ? ` · ${status}`
                            : remaining !== null
                              ? ` · ${remaining} disponíveis`
                              : ""}
                        </option>
                      );
                    })}
                  </select>
                </Field>
                {quote?.promotion && (
                  <p className="promotion-applied">
                    Desconto em {quote.promotion.pizzaQuantity} de {pizzaCount}{" "}
                    pizza(s).
                    {quote.promotion.pizzaQuantity < pizzaCount
                      ? " As demais ficam no preço normal. O limite segue a ordem dos itens."
                      : " Unidades reservadas ao criar o pedido."}
                  </p>
                )}
              </div>
            )}
            {quoteError && (
              <p role="alert" className="inline-error">
                {quoteError}
              </p>
            )}
            <div className="summary-totals">
              <span>
                Subtotal <b>{brl(subtotal)}</b>
              </span>
              {!!quote?.discount && (
                <span className="promotion-total">
                  Desconto <b>− {brl(quote.discount)}</b>
                </span>
              )}
              {mode === "DELIVERY" && (
                <Field label="Taxa de entrega">
                  <MoneyInput value={fee} onChange={setFee} required />
                </Field>
              )}
              <span className="grand-total">
                Total <b>{brl(total)}</b>
              </span>
            </div>
            <Field label="Forma de pagamento">
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value as Draft["payment"])}
              >
                <option value="CARD">Cartão na maquininha</option>
                <option value="CASH">Dinheiro</option>
                <option value="PREPAID">Pago antecipado (simulado)</option>
              </select>
            </Field>
            {payment === "PREPAID" && (
              <p className="field-hint">
                Não gera PIX nem confirma uma transação real.
              </p>
            )}
            {total === 0 && (
              <p className="promotion-applied">
                Sem valor a cobrar neste pedido.
              </p>
            )}
            {payment === "CASH" && total > 0 && (
              <>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={change}
                    onChange={(e) => setChange(e.target.checked)}
                  />{" "}
                  Precisa de troco
                </label>
                {change && (
                  <>
                    <Field label="Troco para">
                      <MoneyInput value={cash} onChange={setCash} required />
                    </Field>
                    <p className="field-hint">
                      Troco:{" "}
                      {Number.isFinite(parseMoney(cash)) &&
                      parseMoney(cash) >= total
                        ? brl(parseMoney(cash) - total)
                        : "informe um valor que cubra o total"}
                    </p>
                  </>
                )}
              </>
            )}
            <div className="demo-note">
              Pedido de demonstração. Os apps Android ainda não recebem estas
              alterações.
            </div>
          </aside>
        </div>
        <footer className="modal-footer">
          <Button onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button
            type="submit"
            tone="primary"
            disabled={busy || !state!.storeOpen || !!quoteError}
          >
            <Plus size={17} />
            {busy ? "Salvando…" : "Criar pedido"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

export function NewOrder(props: Parameters<typeof DemoNewOrder>[0]) {
  const { api } = usePanel();
  return api ? <RemoteNewOrder {...props} /> : <DemoNewOrder {...props} />;
}

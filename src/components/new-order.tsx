"use client";

import { useState, type FormEvent } from "react";
import { Plus, Pizza, ShoppingBag, Trash2, Wine } from "lucide-react";
import {
  brl,
  crusts,
  priceItems,
  quoteOrder,
  sizeLabels,
  type Draft,
  type ItemDraft,
} from "@/domain/model";
import { usePanel } from "./panel-provider";
import { promotionStatus, promotionUsage } from "@/domain/promotions";
import { discountLabel } from "./promotions";
import { Button, Field, Modal, MoneyInput, moneyText, parseMoney } from "./ui";

export function NewOrder({ onClose }: { onClose(): void }) {
  const { state, now, busy, execute, notify } = usePanel();
  const products = state!.products;
  const [kind, setKind] = useState<"PIZZA" | "DRINK">("PIZZA");
  const [flavor, setFlavor] = useState(
    products.find((p) => p.category === "PIZZA" && p.enabled)?.id ?? "",
  );
  const [second, setSecond] = useState("");
  const [drink, setDrink] = useState(
    products.find((p) => p.category === "DRINK" && p.enabled)?.id ?? "",
  );
  const [size, setSize] = useState<"SMALL" | "MEDIUM" | "LARGE">("LARGE");
  const [crust, setCrust] = useState<keyof typeof crusts>("NONE");
  const [quantity, setQuantity] = useState(1);
  const [itemNote, setItemNote] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
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
  const addItem = () => {
    const item: ItemDraft =
      kind === "PIZZA"
        ? {
            kind,
            flavorIds: second ? [flavor, second] : [flavor],
            size,
            crust,
            quantity,
            note: itemNote.trim(),
          }
        : { kind, productId: drink, quantity };
    try {
      priceItems(products, [item]);
      setItems([...items, item]);
      setQuantity(1);
      setItemNote("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Confira o item.", true);
    }
  };
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
            <div className="item-builder">
              <div className="segmented">
                <button
                  type="button"
                  className={kind === "PIZZA" ? "selected" : ""}
                  onClick={() => setKind("PIZZA")}
                  aria-pressed={kind === "PIZZA"}
                >
                  <Pizza size={16} /> Pizza
                </button>
                <button
                  type="button"
                  className={kind === "DRINK" ? "selected" : ""}
                  onClick={() => setKind("DRINK")}
                  aria-pressed={kind === "DRINK"}
                >
                  <Wine size={16} /> Bebida
                </button>
              </div>
              {kind === "PIZZA" ? (
                <>
                  <div className="form-row">
                    <Field label="Sabor principal">
                      <select
                        value={flavor}
                        onChange={(e) => {
                          setFlavor(e.target.value);
                          if (second === e.target.value) setSecond("");
                        }}
                      >
                        <option value="" disabled>
                          Selecione
                        </option>
                        {products
                          .filter((p) => p.category === "PIZZA")
                          .map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={!p.enabled}
                            >
                              {p.name}
                              {!p.enabled ? " · indisponível" : ""}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Segundo sabor">
                      <select
                        value={second}
                        onChange={(e) => setSecond(e.target.value)}
                      >
                        <option value="">Pizza inteira</option>
                        {products
                          .filter(
                            (p) => p.category === "PIZZA" && p.id !== flavor,
                          )
                          .map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              disabled={!p.enabled}
                            >
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>
                  <div className="form-row">
                    <Field label="Tamanho">
                      <select
                        value={size}
                        onChange={(e) => setSize(e.target.value as typeof size)}
                      >
                        {Object.entries(sizeLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Borda">
                      <select
                        value={crust}
                        onChange={(e) =>
                          setCrust(e.target.value as typeof crust)
                        }
                      >
                        {Object.entries(crusts).map(([key, item]) => (
                          <option key={key} value={key}>
                            {item.name}
                            {item.price ? ` + ${brl(item.price)}` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Observação da pizza">
                    <input
                      value={itemNote}
                      maxLength={240}
                      onChange={(e) => setItemNote(e.target.value)}
                      placeholder="Ex.: sem cebola, bem assada"
                    />
                  </Field>
                  <p className="field-hint">
                    Meia pizza: vale o preço do sabor mais caro. Regra de
                    demonstração.
                  </p>
                </>
              ) : (
                <Field label="Bebida">
                  <select
                    value={drink}
                    onChange={(e) => setDrink(e.target.value)}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {products
                      .filter((p) => p.category === "DRINK")
                      .map((p) => (
                        <option key={p.id} value={p.id} disabled={!p.enabled}>
                          {p.name} · {brl(p.prices.MEDIUM)}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <div className="builder-footer">
                <Field label="Quantidade">
                  <input
                    aria-label="Quantidade do item"
                    type="number"
                    min={1}
                    max={20}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </Field>
                <Button onClick={addItem} disabled={items.length >= 30}>
                  <Plus size={16} /> Adicionar item
                </Button>
              </div>
            </div>
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
                  hint="Uma promoção por pedido. Desconto só nas pizzas, sem borda, bebidas e entrega."
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

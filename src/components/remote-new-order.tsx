"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Check, Trash2 } from "lucide-react";
import { brl } from "@/domain/model";
import { priceItems, type ItemDraft } from "@/domain/catalog";
import {
  addressSchema,
  quoteResponseSchema,
  type ApiQuote,
} from "@/data/api-contract";
import { usePanel } from "./panel-provider";
import { ItemBuilder } from "./item-builder";
import { ItemComponents } from "./order-components";
import { Button, Field, Modal, MoneyInput, parseMoney } from "./ui";

const initialAddress = {
  street: "",
  number: "",
  neighborhood: "",
  city: "",
  state: "",
  postalCode: "",
  reference: "",
};
export function RemoteNewOrder({
  onClose,
  initialItem,
}: {
  onClose(): void;
  initialItem?: ItemDraft;
}) {
  const { state, api, busy, now, notify } = usePanel();
  const [items, setItems] = useState<ItemDraft[]>(
    initialItem ? [initialItem] : [],
  );
  const [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  const [channel, setChannel] = useState("COUNTER"),
    [mode, setMode] = useState("DELIVERY");
  const [address, setAddress] = useState(initialAddress),
    [note, setNote] = useState("");
  const [payment, setPayment] = useState("CARD"),
    [cash, setCash] = useState("");
  const [promotionId, setPromotionId] = useState(""),
    [quote, setQuote] = useState<ApiQuote | null>(null);
  const [error, setError] = useState("");
  const products = state!.products;
  let estimate: ReturnType<typeof priceItems> = [];
  try {
    estimate = priceItems(products, items);
  } catch {
    /* Server review will report changed availability. */
  }
  const review = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const customer = z
      .object({
        name: z.string().trim().min(1).max(80),
        phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
      })
      .safeParse({ name, phone: phone.replace(/[()\s-]/g, "") });
    if (!customer.success) {
      setError("Informe o nome e um telefone com DDD, como 11999999999.");
      return;
    }
    if (!items.length) {
      setError("Adicione pelo menos um produto.");
      return;
    }
    const destination =
      mode === "DELIVERY" ? addressSchema.safeParse(address) : null;
    if (destination && !destination.success) {
      setError(
        "Complete o endereço, com UF de duas letras e CEP de oito números.",
      );
      return;
    }
    const tendered =
      payment === "CASH" && cash.trim() ? parseMoney(cash) : null;
    if (tendered !== null && !Number.isFinite(tendered)) {
      setError("Informe um valor válido para o troco.");
      return;
    }
    const result = await api!.run(
      "orders/quote",
      {
        customer: customer.data,
        channel,
        mode,
        address: destination?.success ? destination.data : null,
        items,
        note,
        payment,
        cashTendered: tendered,
        promotionId: promotionId || null,
      },
      "Valores conferidos pela pizzaria. Revise e confirme o pedido.",
    );
    if (result.ok) {
      const parsed = quoteResponseSchema.safeParse(result.data);
      if (parsed.success) setQuote(parsed.data);
      else
        setError(
          "A resposta de preços não corresponde à versão esperada da API.",
        );
    }
  };
  const confirm = async () => {
    if (!quote || now >= quote.expiresAt) {
      setError("A revisão expirou. Consulte os valores novamente.");
      return;
    }
    const result = await api!.run(
      "staff/orders",
      { quoteId: quote.quoteId },
      "Pedido recebido pela pizzaria.",
    );
    if (result.ok) onClose();
    else {
      setError(result.error);
      notify(
        "Se o pedido não foi confirmado, consulte a operação pendente ou revise os valores novamente.",
        true,
      );
    }
  };
  return (
    <Modal
      title={quote ? "Confirmar pedido" : "Novo pedido"}
      subtitle={
        quote
          ? "Confira os valores calculados pela pizzaria."
          : "Balcão e WhatsApp · pedido enviado à operação"
      }
      wide
      onClose={onClose}
    >
      {quote ? (
        <>
          <div className="form-content">
            <div className="remote-review-heading">
              <h3>{name}</h3>
              <p>
                {mode === "DELIVERY"
                  ? `${address.street}, ${address.number} · ${address.city}/${address.state}`
                  : "Retirada na pizzaria"}
              </p>
              <p>
                {payment === "CARD"
                  ? "Cartão na maquininha"
                  : cash
                    ? `Dinheiro · troco para R$ ${cash}`
                    : "Dinheiro · valor exato"}
              </p>
            </div>
            {quote.items.map((item) => (
              <div key={item.id} className="review-line">
                <div>
                  <strong>
                    {item.quantity}× {item.name}
                  </strong>
                  <p>{item.detail}</p>
                  {item.components && (
                    <ItemComponents
                      components={item.components}
                      multiplier={item.quantity}
                    />
                  )}
                  {item.note && <p>{item.note}</p>}
                </div>
                <b>{brl(item.quantity * item.unitPrice)}</b>
              </div>
            ))}
            <div className="remote-totals">
              <p>
                <span>Produtos</span>
                <b>{brl(quote.subtotal)}</b>
              </p>
              <p>
                <span>Entrega</span>
                <b>{brl(quote.fee)}</b>
              </p>
              {quote.promotion && (
                <p>
                  <span>
                    {quote.promotion.name} · {quote.promotion.pizzaQuantity}{" "}
                    pizza(s)
                  </span>
                  <b>− {brl(quote.discount)}</b>
                </p>
              )}
              <p className="remote-total">
                <span>Total</span>
                <b>{brl(quote.total)}</b>
              </p>
            </div>
            <p className="field-hint">
              Valores sujeitos à disponibilidade até a confirmação. Esta revisão
              expira em {Math.max(0, Math.ceil((quote.expiresAt - now) / 1000))}{" "}
              segundos.
            </p>
            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
          </div>
          <footer className="modal-footer">
            <Button
              disabled={busy || !!api!.pending}
              onClick={() => {
                setQuote(null);
                setError("");
              }}
            >
              Editar e revisar novamente
            </Button>
            <Button
              tone="success"
              disabled={busy || now >= quote.expiresAt}
              onClick={() => void confirm()}
            >
              <Check size={17} /> Confirmar pedido
            </Button>
          </footer>
        </>
      ) : (
        <form onSubmit={review}>
          <div className="form-content remote-order-form">
            <div className="form-row">
              <Field label="Nome do cliente">
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Telefone com DDD">
                <input
                  required
                  type="tel"
                  maxLength={20}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Origem do pedido">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="COUNTER">Balcão / telefone</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
              </Field>
              <Field label="Como vai receber?">
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="DELIVERY">Entrega</option>
                  <option value="PICKUP">Retirada</option>
                </select>
              </Field>
            </div>
            {mode === "DELIVERY" && (
              <div className="remote-address">
                {(
                  [
                    ["street", "Rua / avenida", 120],
                    ["number", "Número", 20],
                    ["neighborhood", "Bairro", 80],
                    ["city", "Cidade", 80],
                    ["state", "UF", 2],
                    ["postalCode", "CEP", 8],
                    ["reference", "Referência", 240],
                  ] as const
                ).map(([key, label, length]) => (
                  <Field key={key} label={label}>
                    <input
                      required={key !== "reference"}
                      maxLength={length}
                      value={address[key]}
                      inputMode={key === "postalCode" ? "numeric" : undefined}
                      onChange={(e) =>
                        setAddress({
                          ...address,
                          [key]:
                            key === "state"
                              ? e.target.value.toUpperCase()
                              : key === "postalCode"
                                ? e.target.value.replace(/\D/g, "")
                                : e.target.value,
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
            )}
            <h3>Monte o pedido</h3>
            <ItemBuilder
              products={products}
              allowCombos
              choosePizzaMode
              disabled={busy || items.length >= 30}
              onAdd={(item) => {
                setItems((previous) => [...previous, item]);
              }}
            />
            {items.map((item, index) => (
              <div className="review-line" key={index}>
                <div>
                  <strong>
                    {item.quantity}×{" "}
                    {estimate[index]?.name || "Produto selecionado"}
                  </strong>
                  <p>{estimate[index]?.detail}</p>
                  {estimate[index]?.components && (
                    <ItemComponents
                      components={estimate[index].components!}
                      multiplier={item.quantity}
                    />
                  )}
                </div>
                <Button
                  aria-label={`Remover item ${index + 1}`}
                  tone="ghost"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                >
                  <Trash2 size={17} />
                </Button>
              </div>
            ))}
            <Field label="Promoção">
              <select
                value={promotionId}
                onChange={(e) => setPromotionId(e.target.value)}
              >
                <option value="">Sem promoção</option>
                {api!.catalog!.promotions.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={p.status !== "ACTIVE"}
                  >
                    {p.name}
                    {p.remaining === null
                      ? ""
                      : ` · ${p.remaining} disponíveis`}
                    {p.status !== "ACTIVE" ? " · indisponível" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-row">
              <Field label="Pagamento">
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                >
                  <option value="CARD">Cartão na maquininha</option>
                  <option value="CASH">Dinheiro</option>
                </select>
              </Field>
              {payment === "CASH" && (
                <Field label="Troco para" hint="Deixe vazio para valor exato.">
                  <MoneyInput value={cash} onChange={setCash} />
                </Field>
              )}
            </div>
            <Field label="Observação do pedido">
              <textarea
                maxLength={240}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <p className="field-hint">
              A próxima etapa confirma os preços, a taxa de entrega e o desconto
              antes de enviar o pedido.
            </p>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="modal-footer">
            <Button disabled={busy} onClick={onClose}>
              Voltar
            </Button>
            <Button
              type="submit"
              tone="primary"
              disabled={busy || !items.length || !state!.storeOpen}
            >
              Revisar pedido
            </Button>
          </footer>
        </form>
      )}
    </Modal>
  );
}

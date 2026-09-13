"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ChefHat,
  CircleCheck,
  Clock3,
  Info,
  Pencil,
  Pizza,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Truck,
  Wine,
} from "lucide-react";
import { activeForDriver, brl, isActive, type Product } from "@/domain/model";
import { usePanel } from "./panel-provider";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  MoneyInput,
  moneyText,
  OrderCard,
  parseMoney,
} from "./ui";
import { CardAction } from "./order-detail";

export function Deliveries({ onOpen }: { onOpen(id: string): void }) {
  const { state, now, busy, execute } = usePanel();
  const [tab, setTab] = useState("ready");
  const active = state!.orders.filter(
    (o) => o.mode === "DELIVERY" && isActive(o),
  );
  const ready = active.filter((o) => o.status === "READY");
  const route = active.filter((o) => o.status === "OUT_FOR_DELIVERY");
  const returns = active.filter((o) => o.status === "RETURNING");
  const visible = (
    tab === "ready" ? ready : tab === "route" ? route : returns
  ).sort((a, b) => a.createdAt - b.createdAt);
  return (
    <>
      <div className="section-heading compact">
        <div>
          <h2>
            Equipe de entregas <span>{state!.drivers.length}</span>
          </h2>
          <p>Disponibilidade para novas coletas.</p>
        </div>
        <Badge tone="gold">Entregadores de exemplo</Badge>
      </div>
      <div className="driver-grid">
        {state!.drivers.map((driver) => {
          const assigned = activeForDriver(state!, driver.id);
          const completed = state!.orders.filter(
            (o) => o.driverId === driver.id && o.status === "DELIVERED",
          ).length;
          return (
            <article className="driver-card" key={driver.id}>
              <div className="driver-card-top">
                <span className={`avatar large ${driver.color}`}>
                  {driver.initials}
                </span>
                <div>
                  <h3>{driver.name}</h3>
                  <span
                    className={`availability ${driver.available ? "green-text" : "muted"}`}
                  >
                    <span className="dot" />
                    {driver.available
                      ? "Disponível para coletas"
                      : "Novas coletas pausadas"}
                  </span>
                </div>
              </div>
              <div className="driver-numbers">
                <div>
                  <strong>{assigned.length}</strong>
                  <span>entregas ativas</span>
                </div>
                <div>
                  <strong>{completed}</strong>
                  <span>concluídas na demo</span>
                </div>
              </div>
              <div className="driver-order-tags">
                {assigned.length ? (
                  assigned.map((o) => (
                    <button key={o.id} onClick={() => onOpen(o.id)}>
                      #{o.number}{" "}
                      <span>
                        {o.status === "READY"
                          ? "Coleta"
                          : o.status === "RETURNING"
                            ? "Retorno"
                            : "Em rota"}
                      </span>
                    </button>
                  ))
                ) : (
                  <span>Nenhuma entrega atribuída.</span>
                )}
              </div>
              <button
                disabled={busy}
                role="switch"
                aria-checked={driver.available}
                aria-label={`Disponibilidade de ${driver.name}`}
                className={`driver-toggle ${driver.available ? "on" : ""}`}
                onClick={() =>
                  void execute(
                    {
                      type: "DRIVER",
                      id: driver.id,
                      available: !driver.available,
                    },
                    driver.available
                      ? "Novas coletas pausadas para este entregador."
                      : "Entregador disponível para novas coletas.",
                  )
                }
              >
                <span>
                  {driver.available
                    ? "Recebendo novas coletas"
                    : "Pausado para novas coletas"}
                </span>
                <span className="toggle-track">
                  <span />
                </span>
              </button>
            </article>
          );
        })}
      </div>
      <div className="section-heading">
        <div>
          <h2>Expedição</h2>
          <p>Confira os itens e atribua o pedido antes da saída.</p>
        </div>
      </div>
      <div className="board-toolbar">
        <div className="tabs">
          {[
            ["ready", "A despachar", ready.length],
            ["route", "Em rota", route.length],
            ["returns", "Retornos", returns.length],
          ].map(([id, label, count]) => (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              aria-pressed={tab === id}
              onClick={() => setTab(String(id))}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <span className="toolbar-note">
          <Info size={14} /> Ações do motoboy são simuladas
        </span>
      </div>
      {visible.length ? (
        <div className="dispatch-grid">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              target={state!.settings.targetMinutes}
              onOpen={() => onOpen(order.id)}
            >
              <CardAction order={order} onOpen={() => onOpen(order.id)} />
            </OrderCard>
          ))}
        </div>
      ) : (
        <div className="empty-table">
          <Empty
            title="Nenhuma entrega nesta etapa"
            description={
              tab === "ready"
                ? "Pedidos de entrega marcados como prontos na cozinha chegam aqui."
                : "As entregas aparecerão conforme o andamento da expedição."
            }
          />
        </div>
      )}
    </>
  );
}

export function Catalog() {
  const { state, busy, execute } = usePanel();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const products = state!.products.filter(
    (p) =>
      (tab === "all" || p.category === tab) &&
      p.name
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <div className="catalog-callout">
        <span className="callout-icon">
          <Pizza size={23} />
        </span>
        <div>
          <strong>Um cardápio com a cara da Bonamassa</strong>
          <p>
            Preços e sabores de exemplo. Meia pizza usa o valor do sabor mais
            caro; a borda é somada uma vez.
          </p>
        </div>
        <Badge tone="gold">Regra a validar</Badge>
      </div>
      <div className="board-toolbar">
        <div className="tabs">
          {[
            ["all", "Todos os produtos"],
            ["PIZZA", "Pizzas"],
            ["DRINK", "Bebidas"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto"
            aria-label="Buscar produto"
          />
        </label>
      </div>
      <div className="catalog-grid">
        {products.map((product, index) => (
          <article
            className={`product-card ${product.enabled ? "" : "unavailable"}`}
            key={product.id}
          >
            <div className={`product-art art-${index % 4}`}>
              <div className="product-plate">
                {product.category === "PIZZA" ? (
                  <Pizza size={52} strokeWidth={1.2} />
                ) : (
                  <Wine size={44} strokeWidth={1.2} />
                )}
              </div>
              <Badge tone={product.enabled ? "green" : "neutral"}>
                {product.enabled ? "Disponível" : "Pausado"}
              </Badge>
              <span className="art-caption">
                {product.category === "PIZZA"
                  ? "FEITA PARA COMPARTILHAR"
                  : "PARA ACOMPANHAR"}
              </span>
            </div>
            <div className="product-body">
              <div className="product-category">
                {product.category === "PIZZA" ? "PIZZA TRADICIONAL" : "BEBIDA"}
              </div>
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <div className="product-prices">
                {product.category === "PIZZA" ? (
                  <>
                    {(["SMALL", "MEDIUM", "LARGE"] as const).map((size, i) => (
                      <div key={size}>
                        <span>{["Pequena", "Média", "Grande"][i]}</span>
                        <b>{brl(product.prices[size])}</b>
                      </div>
                    ))}
                  </>
                ) : (
                  <div>
                    <span>Unidade</span>
                    <b>{brl(product.prices.MEDIUM)}</b>
                  </div>
                )}
              </div>
              <div className="product-actions">
                <Button
                  tone="ghost"
                  onClick={() => setEditing(product)}
                  aria-label={`Editar ${product.name}`}
                >
                  <Pencil size={14} /> Editar
                </Button>
                <button
                  role="switch"
                  aria-checked={product.enabled}
                  disabled={busy}
                  aria-label={`Disponibilidade de ${product.name}`}
                  className={`product-toggle ${product.enabled ? "on" : ""}`}
                  onClick={() =>
                    void execute(
                      {
                        type: "PRODUCT",
                        previous: product,
                        product: { ...product, enabled: !product.enabled },
                      },
                      product.enabled
                        ? `${product.name} pausado para novos pedidos.`
                        : `${product.name} disponível.`,
                    )
                  }
                >
                  <span>{product.enabled ? "Ativo" : "Pausado"}</span>
                  <span className="toggle-track">
                    <span />
                  </span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!products.length && (
        <Empty
          title="Nenhum produto encontrado"
          description="Tente outro nome ou categoria."
        />
      )}
      {editing && (
        <EditProduct
          key={editing.id}
          product={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function EditProduct({
  product,
  onClose,
}: {
  product: Product;
  onClose(): void;
}) {
  const { execute, busy, notify } = usePanel();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [prices, setPrices] = useState({
    SMALL: moneyText(product.prices.SMALL),
    MEDIUM: moneyText(product.prices.MEDIUM),
    LARGE: moneyText(product.prices.LARGE),
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = Object.fromEntries(
      Object.entries(prices).map(([key, value]) => [key, parseMoney(value)]),
    ) as Product["prices"];
    if (product.category === "DRINK")
      parsed.SMALL = parsed.LARGE = parsed.MEDIUM;
    if (Object.values(parsed).some((p) => !Number.isFinite(p) || p <= 0)) {
      notify("Informe preços maiores que zero.", true);
      return;
    }
    if (
      await execute(
        {
          type: "PRODUCT",
          previous: product,
          product: { ...product, name, description, prices: parsed },
        },
        "Produto atualizado. Pedidos existentes mantêm seus preços.",
      )
    )
      onClose();
  };
  return (
    <Modal
      title="Editar produto"
      subtitle="Alterações valem para novos pedidos desta demonstração."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-content">
          <Field label="Nome">
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Descrição">
            <textarea
              maxLength={240}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="form-row">
            {(product.category === "PIZZA"
              ? (["SMALL", "MEDIUM", "LARGE"] as const)
              : (["MEDIUM"] as const)
            ).map((size) => (
              <Field
                key={size}
                label={
                  product.category === "DRINK"
                    ? "Preço por unidade"
                    : { SMALL: "Pequena", MEDIUM: "Média", LARGE: "Grande" }[
                        size
                      ]
                }
              >
                <MoneyInput
                  value={prices[size]}
                  onChange={(value) => setPrices({ ...prices, [size]: value })}
                  required
                />
              </Field>
            ))}
          </div>
        </div>
        <footer className="modal-footer">
          <Button onClick={onClose}>Voltar</Button>
          <Button tone="primary" type="submit" disabled={busy}>
            <Save size={16} /> Salvar produto
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

export function Settings() {
  const { state, busy, execute, reset, notify } = usePanel();
  const [target, setTarget] = useState(state!.settings.targetMinutes);
  const [fee, setFee] = useState(moneyText(state!.settings.defaultFee));
  const [confirmReset, setConfirmReset] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const defaultFee = parseMoney(fee);
    if (!Number.isFinite(defaultFee)) {
      notify("Informe uma taxa válida.", true);
      return;
    }
    await execute(
      { type: "SETTINGS", targetMinutes: target, defaultFee },
      "Preferências salvas. A taxa será usada em novos pedidos.",
    );
  };
  return (
    <div className="settings-grid">
      <div>
        <section className="settings-card">
          <div className="settings-heading">
            <span className="settings-icon">
              <Settings2 size={20} />
            </span>
            <div>
              <h2>Preferências da operação</h2>
              <p>Ajustes locais para testar o fluxo da pizzaria.</p>
            </div>
          </div>
          <form onSubmit={submit}>
            <Field
              label="Alerta de tempo do pedido (minutos)"
              hint="Contado desde o recebimento. Um alerta visual, sem promessa de prazo ao cliente."
            >
              <input
                type="number"
                required
                min={10}
                max={120}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
            </Field>
            <Field
              label="Taxa de entrega padrão"
              hint="Exemplo fixo. A regra real por bairro ou distância será definida com a pizzaria."
            >
              <MoneyInput required value={fee} onChange={setFee} />
            </Field>
            <Button type="submit" tone="primary" disabled={busy}>
              <Save size={16} /> Salvar preferências
            </Button>
          </form>
        </section>
        <section className="settings-card">
          <div className="settings-heading">
            <span className="settings-icon">
              <RotateCcw size={20} />
            </span>
            <div>
              <h2>Dados da demonstração</h2>
              <p>{state!.orders.length} pedidos salvos neste navegador.</p>
            </div>
          </div>
          <p>
            Reiniciar apaga os pedidos e os ajustes locais, restaurando os
            exemplos iniciais. Você pode guardar uma cópia em JSON antes.
          </p>
          <div className="form-actions">
            <Button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(state, null, 2)], {
                    type: "application/json",
                  }),
                );
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "bonamassa-demo-backup.json";
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                notify(
                  "Cópia JSON exportada para consulta. A importação ainda não está disponível.",
                );
              }}
            >
              <ArrowDownToLine size={16} /> Exportar cópia JSON
            </Button>
            <Button tone="danger" onClick={() => setConfirmReset(true)}>
              Reiniciar demonstração
            </Button>
          </div>
        </section>
      </div>
      <aside>
        <section className="settings-card connection-card">
          <span className="connection-symbol">
            <Truck size={32} />
          </span>
          <Badge tone="gold">Próxima etapa</Badge>
          <h2>Uma operação conectada</h2>
          <p>
            Este painel, o app do cliente e o app do entregador estão em
            repositórios separados. A API central será a ponte entre eles.
          </p>
          <ul className="connection-list">
            <li>
              <CircleCheck size={17} />
              <span>
                Pedidos, cozinha e expedição
                <span>Funcionais nesta demonstração</span>
              </span>
            </li>
            <li>
              <CircleCheck size={17} />
              <span>
                Atualização entre abas
                <span>Mesmo navegador e mesmo endereço</span>
              </span>
            </li>
            <li className="pending">
              <Clock3 size={17} />
              <span>
                API e autenticação<span>A implementar</span>
              </span>
            </li>
            <li className="pending">
              <Clock3 size={17} />
              <span>
                Integração com os Android<span>A implementar</span>
              </span>
            </li>
          </ul>
          <div className="demo-note">
            PIX, WhatsApp, mapa em tempo real, impressão automática e emissão
            fiscal ainda não estão integrados.
          </div>
        </section>
        <section className="brand-note">
          <ChefHat size={22} />
          <p>
            Produção organizada.
            <br />
            <strong>Pizza no ponto.</strong>
          </p>
        </section>
      </aside>
      {confirmReset && (
        <Modal
          title="Reiniciar a demonstração?"
          subtitle="Todos os pedidos, preços e preferências deste navegador serão substituídos. Esta ação afeta as outras abas do painel."
          onClose={() => setConfirmReset(false)}
        >
          <footer className="modal-footer">
            <Button onClick={() => setConfirmReset(false)} disabled={busy}>
              Manter meus dados
            </Button>
            <Button
              tone="danger"
              disabled={busy}
              onClick={() => {
                void reset().then(() => {
                  setTarget(45);
                  setFee("7,00");
                  setConfirmReset(false);
                });
              }}
            >
              Apagar e reiniciar
            </Button>
          </footer>
        </Modal>
      )}
    </div>
  );
}

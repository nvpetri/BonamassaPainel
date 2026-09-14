"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BadgePercent,
  ChefHat,
  ChevronRight,
  ClipboardList,
  History,
  LogOut,
  Menu,
  Pizza,
  Plus,
  RefreshCw,
  Settings,
  Store,
  Truck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { brl, isActive, statusLabels } from "@/domain/model";
import { viewInfo, type View } from "@/domain/views";
import { usePanel } from "./panel-provider";
import { Badge, Button, Empty, Field, OrderCard, StatusBadge } from "./ui";
import { CardAction, OrderDetail } from "./order-detail";
import { Catalog } from "./catalog";
import { Promotions } from "./promotions";
import { Deliveries } from "./management";
import { NewOrder } from "./new-order";
import { RemoteSettings, StoreControl, roleLabels } from "./remote-settings";
import { storeDate } from "@/domain/schedule";
import { ItemComponents } from "./order-components";

const nav = [
  { view: "pedidos", icon: ClipboardList },
  { view: "cozinha", icon: ChefHat },
  { view: "entregas", icon: Truck },
  { view: "cardapio", icon: Pizza },
  { view: "promocoes", icon: BadgePercent },
  { view: "historico", icon: History },
  { view: "configuracoes", icon: Settings },
] as const;
export function ApiDashboard({ view: requested }: { view: View }) {
  const { api, state, busy, now, toast, reload, sound, toggleSound } =
    usePanel();
  const [menu, setMenu] = useState(false),
    [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [cancelVersion, setCancelVersion] = useState<number>();
  const [filter, setFilter] = useState("ALL"),
    [query, setQuery] = useState("");
  if (!api) return null;
  if (!api.user) return <Login />;
  const role = api.user.role;
  const allowed: View[] =
    role === "KITCHEN"
      ? ["cozinha"]
      : role === "ATTENDANT"
        ? ["pedidos", "entregas", "historico"]
        : nav.map((n) => n.view);
  const view = allowed.includes(requested) ? requested : allowed[0];
  const info = viewInfo[view];
  const loading = !api.updatedAt || (role !== "KITCHEN" && !state);
  const orders = state?.orders ?? [];
  const open = (id: string) => {
    setSelected(id);
    setCancelVersion(undefined);
  };
  const selectedOrder = orders.find((o) => o.id === selected);
  const active = orders.filter(isActive);
  const visible = (
    view === "historico" ? orders.filter((o) => !isActive(o)) : active
  )
    .filter(
      (o) =>
        (filter === "ALL" || o.status === filter) &&
        `${o.number} ${o.customer}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) =>
      view === "historico" ? b.number - a.number : a.number - b.number,
    );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Ir para o conteúdo
      </a>
      {menu && (
        <button
          className="nav-scrim"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`sidebar ${menu ? "open" : ""}`}
        aria-label="Navegação principal"
      >
        <Link
          href={`/${allowed[0]}`}
          className="brand"
          aria-label="Bonamassa, operação"
        >
          <Image
            src="/bonamassa-logo.webp"
            alt=""
            width={74}
            height={74}
            priority
          />
          <div>
            <strong>
              BONAMASSA<span>PIZZARIA</span>
            </strong>
            <small>Painel de operação</small>
          </div>
        </Link>
        <div className="store-card">
          <span className="store-symbol">
            <Store size={18} />
          </span>
          <div>
            <strong>{api.catalog?.store.name || "Bonamassa"}</strong>
            <span>{roleLabels[role]}</span>
          </div>
        </div>
        <nav>
          {nav
            .filter((n) => allowed.includes(n.view))
            .map(({ view: target, icon: Icon }) => (
              <Link
                key={target}
                href={`/${target}`}
                className={`nav-item ${view === target ? "active" : ""}`}
                aria-current={view === target ? "page" : undefined}
                onClick={() => {
                  setMenu(false);
                  setFilter("ALL");
                  setQuery("");
                }}
              >
                <Icon size={19} />
                <span>{viewInfo[target].title}</span>
                {target === "pedidos" &&
                  active.some((o) => o.status === "NEW") && (
                    <b className="nav-count">
                      {active.filter((o) => o.status === "NEW").length}
                    </b>
                  )}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="operator">
            <span className="avatar small">
              {api.user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{api.user.name}</strong>
              <span>{roleLabels[role]}</span>
            </div>
          </div>
          <Button
            className="full"
            disabled={api.writing}
            onClick={() => void api.logout()}
          >
            <LogOut size={16} /> Sair da conta
          </Button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              className="icon-button menu-toggle"
              tone="ghost"
              aria-label="Abrir menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </Button>
            <span>{info.section}</span>
            <ChevronRight size={13} />
            <strong>{info.title}</strong>
          </div>
          <div className="topbar-right">
            <Badge tone={api.stale ? "red" : loading ? "gold" : "green"}>
              <span className="dot" />
              {api.stale
                ? "Sem atualização"
                : loading
                  ? "Conectando"
                  : "Conectado"}
            </Badge>
            <Button
              tone="ghost"
              className="icon-button"
              aria-label="Atualizar dados"
              disabled={api.writing}
              onClick={() => void reload()}
            >
              <RefreshCw size={18} />
            </Button>
            <button
              className={`sound-toggle ${sound ? "on" : ""}`}
              aria-label={
                sound
                  ? "Desativar som de novos pedidos"
                  : "Ativar som de novos pedidos"
              }
              onClick={toggleSound}
            >
              {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          </div>
        </header>
        <main id="main" className={`main-content view-${view}`}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">BONAMASSA · CENTRAL DE OPERAÇÕES</div>
              <h1>{info.title}</h1>
              <p>{info.subtitle}</p>
            </div>
            <div className="page-actions">
              {view === "pedidos" && role === "MANAGER" && state && (
                <StoreControl />
              )}
              {view === "pedidos" && (
                <Button
                  tone="primary"
                  disabled={busy || (!state?.storeOpen && !api.catalog?.store.reservationsAvailable)}
                  onClick={() => setCreating(true)}
                >
                  <Plus size={18} /> {state?.storeOpen ? "Novo pedido" : "Nova reserva"}
                </Button>
              )}
            </div>
          </div>
          {view === "pedidos" && api.catalog?.store.reservationsAvailable && !api.catalog.store.open && (
            <div className="remote-alert" role="status">
              <strong>Loja fechada · Reservas abertas</strong>
              <p>Novos pedidos ficam agendados para {api.catalog.store.nextOpening ? storeDate(api.catalog.store.nextOpening) : api.catalog.store.opensAt},
                no horário de São Paulo. Eles só entram na operação quando a loja abrir.</p>
            </div>
          )}
          {api.stale && (
            <div className="remote-alert" role="alert">
              <strong>Os dados podem estar desatualizados.</strong>
              <p>{api.stale}</p>
              <Button disabled={api.writing} onClick={() => void reload()}>
                Tentar novamente
              </Button>
            </div>
          )}
          {api.pending && (
            <div className="remote-alert" role="alert">
              <strong>Uma operação está aguardando confirmação.</strong>
              <p>
                Consulte o resultado antes de enviar outra alteração. A mesma
                solicitação será verificada para evitar duplicidade.
              </p>
              <Button disabled={api.writing} onClick={() => void api.retry()}>
                Consultar operação pendente
              </Button>
            </div>
          )}
          {loading ? (
            <Empty
              title="Conectando à pizzaria"
              description="Carregando os dados da operação."
            />
          ) : (
            <>
              {view === "cozinha" && <Kitchen />}
              {view === "cardapio" && <Catalog />}
              {view === "promocoes" && <Promotions />}
              {view === "configuracoes" && <RemoteSettings />}
              {view === "entregas" && <Deliveries onOpen={open} />}
              {(view === "pedidos" || view === "historico") && (
                <>
                  {view === "pedidos" && (
                    <div className="remote-metrics">
                      {[
                        ["Agendados", active.filter((o) => o.status === "SCHEDULED").length],
                        [
                          "Novos",
                          active.filter((o) => o.status === "NEW").length,
                        ],
                        [
                          "Na cozinha",
                          active.filter((o) =>
                            ["CONFIRMED", "PREPARING"].includes(o.status),
                          ).length,
                        ],
                        [
                          "Prontos",
                          active.filter((o) => o.status === "READY").length,
                        ],
                        [
                          "Em entrega",
                          active.filter((o) => o.status === "OUT_FOR_DELIVERY")
                            .length,
                        ],
                      ].map(([label, count]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{count}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="board-toolbar">
                    <Field label="Filtrar etapa">
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="ALL">Todas as etapas</option>
                        {Object.entries(statusLabels)
                          .filter(([status]) =>
                            view === "historico"
                              ? ["DELIVERED", "CANCELLED", "RETURNED"].includes(
                                  status,
                                )
                              : ![
                                  "DELIVERED",
                                  "CANCELLED",
                                  "RETURNED",
                                ].includes(status),
                          )
                          .map(([status, label]) => (
                            <option key={status} value={status}>
                              {label}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Buscar pedido ou cliente">
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </Field>
                  </div>
                  {visible.length ? (
                    view === "historico" ? (
                      <div className="remote-history">
                        {visible.map((order) => (
                          <button
                            className="remote-history-row"
                            key={order.id}
                            onClick={() => open(order.id)}
                          >
                            <strong>#{order.number}</strong>
                            <span>{order.customer}</span>
                            <StatusBadge order={order} />
                            <b>{brl(order.total)}</b>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="orders-grid">
                        {visible.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            now={now}
                            target={45}
                            onOpen={() => open(order.id)}
                          >
                            <CardAction
                              order={order}
                              onOpen={() => open(order.id)}
                              onCancel={
                                role === "MANAGER"
                                  ? () => {
                                      setSelected(order.id);
                                      setCancelVersion(order.version);
                                    }
                                  : undefined
                              }
                            />
                          </OrderCard>
                        ))}
                      </div>
                    )
                  ) : (
                    <Empty
                      title={
                        view === "historico"
                          ? "Nenhum pedido encerrado neste filtro"
                          : "Tudo em dia por aqui"
                      }
                      description={
                        view === "historico"
                          ? "Carregue mais pedidos ou ajuste sua busca."
                          : "Os novos pedidos aparecerão aqui automaticamente."
                      }
                    />
                  )}
                  {view === "historico" && (
                    <div className="remote-history-footer">
                      <p>
                        {orders.length} pedidos carregados, incluindo os ativos.
                        Busca e filtros consideram os pedidos já carregados.
                      </p>
                      {api.hasMore && (
                        <Button onClick={api.loadMore} disabled={busy}>
                          Carregar mais pedidos
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {api.updatedAt > 0 && (
            <p className="remote-updated">
              Última atualização:{" "}
              {new Date(api.updatedAt).toLocaleTimeString("pt-BR")} ·
              atualização automática a cada 5 segundos
            </p>
          )}
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.message}
        </div>
      )}
      {creating && state && <NewOrder onClose={() => setCreating(false)} />}
      {selectedOrder && (
        <OrderDetail
          key={`${selectedOrder.id}:${cancelVersion ?? "view"}`}
          order={selectedOrder}
          initialCancelVersion={cancelVersion}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function Login() {
  const { api, toast, reload } = usePanel();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api!.login(email.trim(), password);
    setPassword("");
  };
  return (
    <main className="remote-login">
      <div className="remote-login-card">
        <Image
          src="/bonamassa-logo.webp"
          alt="Bonamassa Pizzaria"
          width={100}
          height={100}
          priority
        />
        <span className="eyebrow">PAINEL DA PIZZARIA</span>
        <h1>Bom trabalho começa aqui.</h1>
        <p>Entre para acompanhar os pedidos e cuidar de cada entrega.</p>
        <form onSubmit={submit}>
          <Field label="E-mail">
            <input
              type="email"
              required
              autoComplete="username"
              maxLength={160}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              required
              autoComplete="current-password"
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {toast && (
            <p role="alert" className="inline-error">
              {toast.message}
            </p>
          )}
          {api!.stale && (
            <div role="alert">
              <p>{api!.stale}</p>
              <Button onClick={() => void reload()}>
                Tentar conexão novamente
              </Button>
            </div>
          )}
          <Button
            className="full"
            type="submit"
            tone="primary"
            disabled={api!.authenticating}
          >
            {api!.authenticating ? "Conectando…" : "Entrar no painel"}
          </Button>
        </form>
        <p className="field-hint">
          Use o acesso cadastrado na API Bonamassa. Contas de cozinha abrem
          diretamente a tela de produção.
        </p>
      </div>
    </main>
  );
}
function Kitchen() {
  const { api, now, busy } = usePanel();
  const orders = api!.kitchen;
  return (
    <div className="remote-kitchen">
      {(
        [
          ["CONFIRMED", "A preparar"],
          ["PREPARING", "Em preparo"],
          ["READY", "Prontos"],
        ] as const
      ).map(([status, label]) => {
        const list = orders
          .filter((o) => o.status === status)
          .sort((a, b) => a.number - b.number);
        return (
          <section className="remote-kitchen-column" key={status}>
            <h2>
              {label} <Badge>{list.length}</Badge>
            </h2>
            {list.length ? (
              list.map((order) => (
                <article
                  className={`order-card kitchen-card ${now - (order.queuedAt ?? order.createdAt) >= 45 * 60000 ? "late" : ""}`}
                  key={order.id}
                  data-testid={`kitchen-${order.number}`}
                >
                  <div className="card-heading">
                    <strong className="order-number">#{order.number}</strong>
                    <span className="elapsed">
                      {Math.max(0, Math.floor((now - (order.queuedAt ?? order.createdAt)) / 60000))}{" "}
                      min
                    </span>
                  </div>
                  <Badge>
                    {order.mode === "DELIVERY" ? "Entrega" : "Retirada"}
                  </Badge>
                  <div className="card-items">
                    {order.items.map((item) => (
                      <div className="card-item" key={item.id}>
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
                          {item.note && (
                            <span className="item-note">{item.note}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {order.note && (
                    <div className="order-note">
                      <span>OBS.</span>
                      {order.note}
                    </div>
                  )}
                  {status !== "READY" ? (
                    <Button
                      className="full"
                      tone={status === "PREPARING" ? "success" : "gold"}
                      disabled={busy}
                      onClick={() =>
                        void api!.run(
                          `staff/orders/${order.id}/${status === "CONFIRMED" ? "prepare" : "ready"}`,
                          { expectedVersion: order.version },
                          status === "CONFIRMED"
                            ? "Preparo iniciado."
                            : "Pedido pronto para expedição.",
                        )
                      }
                    >
                      {status === "CONFIRMED"
                        ? "Iniciar preparo"
                        : "Marcar como pronto"}
                    </Button>
                  ) : (
                    <p className="field-hint">Aguardando a expedição</p>
                  )}
                </article>
              ))
            ) : (
              <Empty
                title="Nenhum pedido"
                description="A fila será atualizada automaticamente."
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ChefHat,
  ChevronRight,
  CircleHelp,
  Clock3,
  Columns3,
  Flame,
  History,
  LayoutDashboard,
  LoaderCircle,
  Maximize2,
  Menu,
  Minimize2,
  PackageCheck,
  Pizza,
  Plus,
  Radio,
  RefreshCw,
  Rows3,
  Search,
  Settings2,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import {
  brl,
  closedStatuses,
  csvOrders,
  isActive,
  type Order,
  type Status,
} from "@/domain/model";
import { sampleDraft } from "@/domain/demo";
import { viewInfo, type View } from "@/domain/views";
import { usePanel } from "./panel-provider";
import { Badge, Button, Empty, Modal, OrderCard, StatusBadge } from "./ui";
import { NewOrder } from "./new-order";
import { CardAction, OrderDetail } from "./order-detail";
import { Catalog, Deliveries, Settings } from "./management";
import { Promotions } from "./promotions";

const navigation = [
  { view: "pedidos", label: "Pedidos", icon: LayoutDashboard },
  { view: "cozinha", label: "Cozinha", icon: ChefHat },
  { view: "entregas", label: "Entregas", icon: Truck },
  { view: "cardapio", label: "Cardápio", icon: Pizza },
  { view: "promocoes", label: "Promoções", icon: Tags },
  { view: "historico", label: "Histórico", icon: History },
  { view: "configuracoes", label: "Configurações", icon: Settings2 },
] as const;
const orderGroups: {
  id: string;
  label: string;
  statuses: Status[];
  tone: string;
  icon: typeof Pizza;
  description: string;
}[] = [
  {
    id: "new",
    label: "Novos",
    statuses: ["NEW"],
    tone: "red",
    icon: ShoppingBag,
    description: "Aguardando seu aceite",
  },
  {
    id: "kitchen",
    label: "Na cozinha",
    statuses: ["CONFIRMED", "PREPARING"],
    tone: "gold",
    icon: ChefHat,
    description: "A preparar e em produção",
  },
  {
    id: "ready",
    label: "Prontos",
    statuses: ["READY"],
    tone: "green",
    icon: PackageCheck,
    description: "Hora de conferir e despachar",
  },
  {
    id: "delivery",
    label: "Em entrega",
    statuses: ["OUT_FOR_DELIVERY", "RETURNING"],
    tone: "blue",
    icon: Truck,
    description: "A caminho ou em retorno",
  },
];
const kitchenGroups = [
  {
    id: "waiting",
    label: "A preparar",
    statuses: ["CONFIRMED"] as Status[],
    tone: "gold",
    icon: Clock3,
    description: "Comece pelos pedidos mais antigos",
  },
  {
    id: "preparing",
    label: "Em preparo",
    statuses: ["PREPARING"] as Status[],
    tone: "orange",
    icon: Flame,
    description: "Atenção às observações e bordas",
  },
  {
    id: "ready",
    label: "Prontos",
    statuses: ["READY"] as Status[],
    tone: "green",
    icon: PackageCheck,
    description: "Conferência na expedição",
  },
];

export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Dashboard({ view }: { view: View }) {
  const {
    state,
    error,
    now,
    execute,
    busy,
    reload,
    reset,
    notify,
    toast,
    sound,
    toggleSound,
  } = usePanel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOrder, setNewOrder] = useState(false);
  const [help, setHelp] = useState(false);
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [list, setList] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const enterFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else notify("Use o modo de tela cheia do navegador.", true);
    } catch {
      notify(
        "Não foi possível abrir em tela cheia. Use F11 no computador.",
        true,
      );
    }
  };
  const toastNode = toast && (
    <div
      className={`toast ${toast.error ? "error" : ""}`}
      role={toast.error ? "alert" : "status"}
    >
      <span className="dot" />
      {toast.message}
    </div>
  );
  if (error || !state)
    return (
      <main className="startup">
        <Image
          src="/bonamassa-logo.webp"
          alt="Bonamassa Pizzaria"
          width={100}
          height={100}
        />
        <h1>{error ? "Vamos recuperar o painel" : "Preparando a operação…"}</h1>
        {error ? (
          <>
            <p>{error}</p>
            <div className="form-actions">
              <Button onClick={() => void reload()}>
                <RefreshCw size={16} /> Tentar novamente
              </Button>
              <Button tone="danger" onClick={() => setResetConfirmation(true)}>
                Reiniciar demonstração
              </Button>
            </div>
          </>
        ) : (
          <LoaderCircle className="spin" />
        )}
        {resetConfirmation && (
          <Modal
            title="Apagar os dados locais da demo?"
            subtitle="Os pedidos e ajustes deste navegador serão substituídos pelos exemplos iniciais."
            onClose={() => setResetConfirmation(false)}
          >
            <div className="modal-footer">
              <Button onClick={() => setResetConfirmation(false)}>
                Voltar
              </Button>
              <Button
                tone="danger"
                disabled={busy}
                onClick={() => {
                  void reset().then(() => setResetConfirmation(false));
                }}
              >
                Apagar e reiniciar
              </Button>
            </div>
          </Modal>
        )}
        {toastNode}
      </main>
    );
  const active = state.orders.filter(isActive);
  const kitchen = active.filter((o) =>
    ["CONFIRMED", "PREPARING"].includes(o.status),
  );
  const ready = active.filter((o) => o.status === "READY");
  const newCount = active.filter((o) => o.status === "NEW").length;
  const completed = state.orders.filter((o) => o.status === "DELIVERED");
  const selected = state.orders.find((o) => o.id === selectedId);
  const info = viewInfo[view];
  const search = (order: Order) =>
    !query.trim() ||
    `${order.number} ${order.customer} ${order.items.map((i) => i.name).join(" ")} ${order.address}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().replace(/^#/, "").toLocaleLowerCase("pt-BR"));
  const groups = view === "cozinha" ? kitchenGroups : orderGroups;
  const boardOrders = active
    .filter(search)
    .sort((a, b) => a.createdAt - b.createdAt);
  const visibleGroups = groups.filter(
    (group) => tab === "all" || tab === group.id,
  );
  const history = state.orders
    .filter(
      (o) =>
        closedStatuses.includes(o.status) &&
        (tab === "all" || o.status === tab) &&
        search(o),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const simulate = async () => {
    try {
      await execute(
        { type: "CREATE", draft: sampleDraft(state) },
        "Novo pedido de exemplo recebido.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível simular o pedido.",
        true,
      );
    }
  };

  return (
    <div className={`app-shell ${fullscreen ? "is-fullscreen" : ""}`}>
      <a href="#main" className="skip-link">
        Pular para o conteúdo
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
        <Link href="/pedidos" className="brand" aria-label="Bonamassa, pedidos">
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
            <strong>Bonamassa</strong>
            <span>Unidade demonstração</span>
          </div>
        </div>
        <nav>
          {navigation.map((item, index) => (
            <div key={item.view}>
              {(index === 0 || index === 3) && (
                <div className="nav-label">
                  {index === 0 ? "OPERAÇÃO" : "GESTÃO"}
                </div>
              )}
              <Link
                href={`/${item.view}`}
                className={`nav-item ${view === item.view ? "active" : ""}`}
                aria-current={view === item.view ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                <item.icon size={19} />
                <span>{item.label}</span>
                {item.view === "pedidos" && newCount > 0 ? (
                  <b className="nav-count">{newCount}</b>
                ) : item.view === "cozinha" && kitchen.length > 0 ? (
                  <b className="nav-count subtle">{kitchen.length}</b>
                ) : null}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-card">
            <span className="demo-spark">
              <Radio size={17} />
            </span>
            <strong>Seu painel está em demo</strong>
            <p>Explore os pedidos e veja a operação acontecer.</p>
            <button onClick={() => setHelp(true)}>
              Conhecer a demonstração <ArrowRight size={14} />
            </button>
          </div>
          <div className="operator">
            <span className="avatar small">BM</span>
            <div>
              <strong>Equipe Bonamassa</strong>
              <span>Acesso de demonstração</span>
            </div>
            <CircleHelp size={17} />
          </div>
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
            <span className="header-date">
              {now
                ? new Date(now).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "long",
                  })
                : ""}
            </span>
            <Badge tone="gold">
              <span className="dot" /> Demonstração
            </Badge>
            <span className="topbar-divider" />
            <button
              className={`sound-toggle ${sound ? "on" : ""}`}
              onClick={toggleSound}
              aria-label={
                sound
                  ? "Desativar som de novos pedidos"
                  : "Ativar som de novos pedidos"
              }
              title={sound ? "Som ativado" : "Ativar alerta sonoro"}
            >
              {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <span className="avatar small operator-avatar">BM</span>
          </div>
        </header>
        <main id="main" className={`main-content view-${view}`}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                BONAMASSA ·{" "}
                {view === "cozinha" ? "PRODUÇÃO" : "CENTRAL DE OPERAÇÕES"}
              </div>
              <h1>
                {info.title}
                {view === "cozinha" && (
                  <Flame size={30} className="heading-flame" />
                )}
              </h1>
              <p>{info.subtitle}</p>
            </div>
            <div className="page-actions">
              {(view === "pedidos" || view === "configuracoes") && (
                <button
                  disabled={busy}
                  className={`store-toggle ${state.storeOpen ? "online" : "offline"}`}
                  onClick={() =>
                    void execute(
                      { type: "STORE", open: !state.storeOpen },
                      state.storeOpen
                        ? "Novos pedidos pausados. Os pedidos existentes continuam em andamento."
                        : "Loja aberta para novos pedidos.",
                    )
                  }
                  title={
                    state.storeOpen ? "Pausar novos pedidos" : "Abrir a loja"
                  }
                >
                  <span className="dot" />
                  {state.storeOpen ? "Loja aberta" : "Loja pausada"}
                  <span className="toggle-track">
                    <span />
                  </span>
                </button>
              )}
              {view === "pedidos" && (
                <Button
                  tone="primary"
                  disabled={busy || !state.storeOpen}
                  onClick={() => setNewOrder(true)}
                >
                  <Plus size={18} /> Novo pedido
                </Button>
              )}
              {view === "cozinha" && (
                <>
                  <div className="kitchen-clock">
                    <Clock3 size={17} />
                    <time>
                      {now
                        ? new Date(now).toLocaleTimeString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--"}
                    </time>
                  </div>
                  <Button onClick={() => void enterFullscreen()}>
                    {fullscreen ? (
                      <Minimize2 size={16} />
                    ) : (
                      <Maximize2 size={16} />
                    )}
                    {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
                  </Button>
                </>
              )}
              {view === "historico" && (
                <Button
                  onClick={() => {
                    downloadFile(
                      csvOrders(history),
                      "bonamassa-historico-demo.csv",
                      "text/csv;charset=utf-8",
                    );
                    notify("Histórico filtrado exportado.");
                  }}
                  disabled={!history.length}
                >
                  <ArrowDownToLine size={17} /> Exportar CSV
                </Button>
              )}
            </div>
          </div>
          {view === "pedidos" && (
            <>
              <div className="stats-grid">
                <Stat
                  label="Pedidos em aberto"
                  value={String(active.length).padStart(2, "0")}
                  detail={`${newCount} aguardando aceite`}
                  icon={ShoppingBag}
                  tone="red"
                />
                <Stat
                  label="Na cozinha"
                  value={String(kitchen.length).padStart(2, "0")}
                  detail="Fila e preparo em andamento"
                  icon={ChefHat}
                  tone="gold"
                />
                <Stat
                  label="Prontos para sair"
                  value={String(ready.length).padStart(2, "0")}
                  detail="Entrega ou retirada no balcão"
                  icon={PackageCheck}
                  tone="green"
                />
                <Stat
                  label="Vendas concluídas"
                  value={brl(completed.reduce((sum, o) => sum + o.total, 0))}
                  detail={`${completed.length} pedido${completed.length === 1 ? "" : "s"} · nesta demonstração`}
                  icon={Wallet}
                  tone="blue"
                />
              </div>
              <div className="section-heading">
                <div>
                  <h2>
                    Fila de pedidos <span>{active.length}</span>
                  </h2>
                  <p>Todos os canais. Uma única operação.</p>
                </div>
                <Button
                  tone="ghost"
                  disabled={busy || !state.storeOpen}
                  onClick={() => void simulate()}
                >
                  <Radio size={15} /> Simular chegada
                </Button>
              </div>
            </>
          )}
          {view === "cozinha" && (
            <div className="kitchen-info">
              <span>
                <span className="dot green" /> {kitchen.length} pedido
                {kitchen.length === 1 ? "" : "s"} na produção
              </span>
              <span>
                <Clock3 size={15} /> Alerta após {state.settings.targetMinutes}{" "}
                min desde o recebimento
              </span>
              <span>
                <ChefHat size={15} /> Pedidos mais antigos primeiro
              </span>
            </div>
          )}
          {(view === "pedidos" || view === "cozinha") && (
            <>
              <div className="board-toolbar">
                <div className="tabs" aria-label="Filtrar etapas">
                  <button
                    className={tab === "all" ? "selected" : ""}
                    aria-pressed={tab === "all"}
                    onClick={() => setTab("all")}
                  >
                    Todos{" "}
                    <span>
                      {
                        active.filter((o) =>
                          groups.some((g) => g.statuses.includes(o.status)),
                        ).length
                      }
                    </span>
                  </button>
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      aria-pressed={tab === group.id}
                      className={tab === group.id ? "selected" : ""}
                      onClick={() => setTab(group.id)}
                    >
                      {group.label}
                      <span>
                        {
                          active.filter((o) =>
                            group.statuses.includes(o.status),
                          ).length
                        }
                      </span>
                    </button>
                  ))}
                </div>
                <div className="toolbar-controls">
                  <label className="search">
                    <Search size={16} />
                    <input
                      aria-label="Buscar pedidos"
                      placeholder="Buscar pedido ou cliente"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        type="button"
                        aria-label="Limpar busca"
                        onClick={() => setQuery("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  {view === "pedidos" && (
                    <div className="view-switch">
                      <button
                        className={!list ? "selected" : ""}
                        onClick={() => setList(false)}
                        aria-label="Visualizar em colunas"
                        aria-pressed={!list}
                      >
                        <Columns3 size={17} />
                      </button>
                      <button
                        className={list ? "selected" : ""}
                        onClick={() => setList(true)}
                        aria-label="Visualizar em lista"
                        aria-pressed={list}
                      >
                        <Rows3 size={17} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {list && view === "pedidos" ? (
                <OrderTable
                  orders={boardOrders.filter((o) =>
                    visibleGroups.some((g) => g.statuses.includes(o.status)),
                  )}
                  onOpen={setSelectedId}
                />
              ) : (
                <div
                  className={`kanban ${view === "cozinha" ? "kitchen-board" : ""} ${tab !== "all" ? "filtered" : ""}`}
                >
                  {visibleGroups.map((group) => {
                    const orders = boardOrders.filter((o) =>
                      group.statuses.includes(o.status),
                    );
                    return (
                      <section
                        key={group.id}
                        className={`kanban-column ${group.tone}`}
                        aria-label={group.label}
                      >
                        <header className="column-heading">
                          <div>
                            <span className={`column-icon ${group.tone}`}>
                              <group.icon size={16} />
                            </span>
                            <h2>{group.label}</h2>
                            <span className="column-count">
                              {orders.length}
                            </span>
                          </div>
                          <p>{group.description}</p>
                        </header>
                        <div className="column-cards">
                          {orders.map((order) => (
                            <OrderCard
                              key={order.id}
                              order={order}
                              now={now}
                              target={state.settings.targetMinutes}
                              kitchen={view === "cozinha"}
                              onOpen={() => setSelectedId(order.id)}
                            >
                              <CardAction
                                order={order}
                                onOpen={() => setSelectedId(order.id)}
                                kitchen={view === "cozinha"}
                              />
                            </OrderCard>
                          ))}
                          {!orders.length && (
                            <Empty
                              title={
                                query
                                  ? "Nenhum resultado"
                                  : "Tudo em dia por aqui"
                              }
                              description={
                                query
                                  ? "Tente outro número, cliente ou sabor."
                                  : "Os pedidos desta etapa aparecerão aqui."
                              }
                            />
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {view === "entregas" && <Deliveries onOpen={setSelectedId} />}
          {view === "cardapio" && <Catalog />}
          {view === "promocoes" && <Promotions />}
          {view === "configuracoes" && <Settings />}
          {view === "historico" && (
            <>
              <div className="history-summary">
                <div>
                  <strong>{completed.length}</strong>
                  <span>pedidos concluídos</span>
                </div>
                <div>
                  <strong>
                    {brl(completed.reduce((sum, o) => sum + o.total, 0))}
                  </strong>
                  <span>valor dos pedidos concluídos</span>
                </div>
                <div>
                  <strong>
                    {
                      state.orders.filter((o) =>
                        ["CANCELLED", "RETURNED"].includes(o.status),
                      ).length
                    }
                  </strong>
                  <span>cancelados ou devolvidos</span>
                </div>
                <p>
                  Totais de toda a demonstração.
                  <br />
                  Não representa fechamento de caixa.
                </p>
              </div>
              <div className="board-toolbar">
                <div className="tabs">
                  {[
                    ["all", "Todos"],
                    ["DELIVERED", "Concluídos"],
                    ["CANCELLED", "Cancelados"],
                    ["RETURNED", "Devolvidos"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={tab === id}
                      className={tab === id ? "selected" : ""}
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
                    placeholder="Buscar no histórico"
                    aria-label="Buscar no histórico"
                  />
                </label>
              </div>
              <OrderTable orders={history} onOpen={setSelectedId} />
            </>
          )}
          <footer className="workspace-footer">
            <span>
              <span className="dot" /> Dados de exemplo · salvos neste navegador
            </span>
            <span>
              Bonamassa Painel <b>v0.2</b>
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <OrderDetail
          key={selected.id}
          order={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
      {newOrder && <NewOrder onClose={() => setNewOrder(false)} />}
      {help && (
        <Modal
          title="Conheça seu painel"
          subtitle="Um ensaio completo da operação Bonamassa."
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <ol>
              <li>
                <strong>Receba um pedido.</strong> Use “Novo pedido” ou “Simular
                chegada” e aceite na fila.
              </li>
              <li>
                <strong>Organize a cozinha.</strong> Inicie o preparo e marque o
                pedido como pronto.
              </li>
              <li>
                <strong>Faça a expedição.</strong> Atribua um entregador ou
                confirme a retirada no balcão.
              </li>
              <li>
                <strong>Confira o histórico.</strong> Simule a entrega, registre
                o recebimento e consulte os eventos.
              </li>
            </ol>
            <div className="demo-note">
              Você pode abrir Pedidos e Cozinha em duas abas deste mesmo
              navegador. As etapas são compartilhadas entre elas. Outros
              computadores e os apps Android dependem da futura API.
            </div>
            <p>
              Todos os clientes, pedidos, entregadores e preços são exemplos.
              Não há login, cobrança, envio de WhatsApp ou rastreamento real
              nesta versão.
            </p>
          </div>
          <footer className="modal-footer">
            <Button tone="primary" onClick={() => setHelp(false)}>
              Explorar painel <ArrowRight size={16} />
            </Button>
          </footer>
        </Modal>
      )}
      {toastNode}
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Pizza;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <small>
        <span className={`dot ${tone}`} />
        {detail}
      </small>
    </div>
  );
}

export function OrderTable({
  orders,
  onOpen,
}: {
  orders: Order[];
  onOpen(id: string): void;
}) {
  if (!orders.length)
    return (
      <div className="empty-table">
        <Empty
          title="Nenhum pedido encontrado"
          description="Os pedidos aparecerão aqui conforme o fluxo e os filtros escolhidos."
        />
      </div>
    );
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="Lista de pedidos"
      tabIndex={0}
    >
      <table className="orders-table">
        <thead>
          <tr>
            <th>Pedido / horário</th>
            <th>Cliente</th>
            <th>Modalidade</th>
            <th>Situação</th>
            <th>Total</th>
            <th>
              <span className="sr-only">Detalhes</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <button className="table-order" onClick={() => onOpen(o.id)}>
                  #{o.number}
                </button>
                <small>
                  {new Date(o.createdAt).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </td>
              <td>
                {o.customer}
                <small>
                  {o.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                  item(ns)
                </small>
              </td>
              <td>{o.mode === "DELIVERY" ? "Entrega" : "Retirada"}</td>
              <td>
                <StatusBadge order={o} />
              </td>
              <td className="amount">{brl(o.total)}</td>
              <td>
                <Button
                  tone="ghost"
                  className="icon-button"
                  aria-label={`Ver pedido ${o.number}`}
                  onClick={() => onOpen(o.id)}
                >
                  <ChevronRight size={18} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

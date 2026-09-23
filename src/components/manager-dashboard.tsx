"use client";

import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  Banknote,
  Bike,
  ChartNoAxesCombined,
  Pizza,
  ShoppingBag,
} from "lucide-react";
import { ApiError, get } from "@/data/api-client";
import {
  analyticsSchema,
  calendarLabel,
  periodSchema,
  recentPeriod,
  type Analytics,
  type Period,
} from "@/data/analytics-contract";
import { brl, statusLabels } from "@/domain/model";
import { storeDate } from "@/domain/schedule";
import { usePanel } from "./panel-provider";
import { Badge, Button, Empty, Field } from "./ui";

const number = (n: number) => n.toLocaleString("pt-BR");
const channels = { APP: "Aplicativo", WHATSAPP: "WhatsApp", COUNTER: "Balcão" };
const payments = {
  CASH: "Dinheiro",
  CARD: "Cartão",
  PREPAID: "Pagamento registrado",
};
const keyOf = (p: Period) => `${p.from}/${p.to}`;

export function ManagerDashboard({ refresh }: { refresh: number }) {
  const { now, reload } = usePanel();
  const [period, setPeriod] = useState(() =>
    recentPeriod(now || Date.now(), 1),
  );
  const [draft, setDraft] = useState(period);
  const [formError, setFormError] = useState("");
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Analytics>();
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const [updating, setUpdating] = useState(false);
  const { from, to } = period;
  const periodKey = keyOf(period);
  const data =
    result && keyOf(result.period) === periodKey ? result : undefined;
  const error = failure?.key === periodKey ? failure.message : "";

  useEffect(() => {
    let active = true,
      fetching = false;
    const update = async () => {
      if (fetching) return;
      fetching = true;
      setUpdating(true);
      try {
        const response = analyticsSchema.parse(
          await get(`staff/dashboard?${new URLSearchParams({ from, to })}`),
        );
        if (response.period.from !== from || response.period.to !== to)
          throw new Error("Período inesperado.");
        if (active) {
          setResult(response);
          setFailure(undefined);
        }
      } catch (caught) {
        if (active) {
          const denied =
            caught instanceof ApiError && [401, 403].includes(caught.status);
          if (denied) setResult(undefined);
          setFailure({
            key: `${from}/${to}`,
            message: denied
              ? "Seu acesso às métricas precisa ser verificado. Entre novamente."
              : "Não foi possível atualizar as métricas. Verifique a conexão e tente novamente.",
          });
          if (denied) void reload();
        }
      } finally {
        fetching = false;
        if (active) setUpdating(false);
      }
    };
    const start = setTimeout(() => void update(), 0);
    const visibleUpdate = () => {
      if (!document.hidden) void update();
    };
    const interval = setInterval(visibleUpdate, 30_000);
    window.addEventListener("focus", visibleUpdate);
    document.addEventListener("visibilitychange", visibleUpdate);
    return () => {
      active = false;
      clearTimeout(start);
      clearInterval(interval);
      window.removeEventListener("focus", visibleUpdate);
      document.removeEventListener("visibilitychange", visibleUpdate);
    };
  }, [from, to, refresh, retry, reload]);

  function apply(event: FormEvent) {
    event.preventDefault();
    const parsed = periodSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError("Escolha datas válidas, em ordem, com no máximo 366 dias.");
      return;
    }
    setFormError("");
    setPeriod(parsed.data);
    setRetry((n) => n + 1);
  }
  function preset(days: number) {
    const next = recentPeriod(now || Date.now(), days);
    setDraft(next);
    setPeriod(next);
    setFormError("");
    setRetry((n) => n + 1);
  }
  return (
    <div className="analytics" role="region" aria-label="Métricas gerenciais">
      <div className="analytics-filters">
        <div className="analytics-presets" aria-label="Períodos rápidos">
          {[
            [1, "Hoje"],
            [7, "7 dias"],
            [30, "30 dias"],
          ].map(([days, label]) => (
            <Button
              key={days}
              aria-pressed={
                keyOf(recentPeriod(now, Number(days))) === periodKey
              }
              onClick={() => preset(Number(days))}
            >
              {label}
            </Button>
          ))}
        </div>
        <form onSubmit={apply}>
          <Field label="De">
            <input
              type="date"
              required
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </Field>
          <Field label="Até">
            <input
              type="date"
              required
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </Field>
          <Button type="submit">Aplicar período</Button>
        </form>
      </div>
      {formError && (
        <p className="inline-error" role="alert">
          {formError}
        </p>
      )}
      <div className="analytics-period">
        <span>
          {calendarLabel(from)} a {calendarLabel(to)} · Horário de São Paulo
        </span>
        <span role="status">
          {updating
            ? "Atualizando métricas…"
            : data
              ? `Atualizado em ${storeDate(data.generatedAt)}`
              : ""}
        </span>
      </div>
      {error && (
        <div className="remote-alert" role="alert">
          <strong>{error}</strong>
          {data && (
            <p>
              Os valores abaixo são da última consulta concluída e podem estar
              desatualizados.
            </p>
          )}
          <Button onClick={() => setRetry((n) => n + 1)} disabled={updating}>
            Recarregar métricas
          </Button>
        </div>
      )}
      {!data ? (
        <Empty
          title={error ? "Métricas indisponíveis" : "Carregando métricas"}
          description="Os totais consideram todos os pedidos da sua pizzaria no período escolhido."
        />
      ) : (
        <>
          {data.receivedOrders +
            data.completedOrders +
            data.cancelledOrders +
            data.returnedOrders ===
            0 && (
            <div className="analytics-empty" role="status">
              Nenhum movimento no período selecionado. A operação atual continua
              visível abaixo.
            </div>
          )}
          <div className="analytics-kpis">
            <Metric
              label="Vendas concluídas"
              value={brl(data.sales.revenue)}
              hint={`${number(data.completedOrders)} pedidos concluídos`}
              icon={<Banknote size={20} />}
              primary
              testId="metric-revenue"
            />
            <Metric
              label={
                data.incompletePizzaOrders
                  ? "Pizzas vendidas · parcial"
                  : "Pizzas vendidas"
              }
              value={number(data.pizzasSold)}
              hint="Avulsas e pizzas dos combos"
              icon={<Pizza size={20} />}
              testId="metric-pizzas"
            />
            <Metric
              label="Pedidos recebidos"
              value={number(data.receivedOrders)}
              hint="Aplicativo, WhatsApp e balcão"
              icon={<ShoppingBag size={20} />}
              testId="metric-received"
            />
            <Metric
              label="Ticket médio"
              value={brl(data.sales.averageTicket)}
              hint="Por pedido concluído, com frete"
              icon={<ChartNoAxesCombined size={20} />}
              testId="metric-ticket"
            />
          </div>
          {data.incompletePizzaOrders > 0 && (
            <div className="remote-alert" role="status">
              Total de pizzas parcial: {number(data.incompletePizzaOrders)}{" "}
              pedidos antigos contêm combos sem a quantidade histórica de pizzas
              registrada. As vendas em reais estão completas.
            </div>
          )}
          <div className="analytics-grid">
            <Trend data={data} />
            <Panel
              title="Origem dos pedidos"
              description="Recebidos pela data de criação; vendas pela conclusão."
            >
              <div className="analytics-channels">
                {data.channels.map((channel, i) => (
                  <div
                    key={channel.channel}
                    className={`analytics-channel channel-${i}`}
                    data-testid={`channel-${channel.channel}`}
                  >
                    <div>
                      <strong>{channels[channel.channel]}</strong>
                      <span>
                        {number(channel.received)} pedidos{" "}
                        <b>
                          {data.receivedOrders
                            ? Math.round(
                                (channel.received / data.receivedOrders) * 100,
                              )
                            : 0}
                          %
                        </b>
                      </span>
                    </div>
                    <div className="analytics-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${data.receivedOrders ? (channel.received / data.receivedOrders) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <small>
                      {number(channel.completed)} concluídos{" "}
                      <strong>{brl(channel.revenue)}</strong>
                    </small>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <Panel
            title="Fluxo de pedidos agora"
            description="Fila atual da pizzaria, independente do período selecionado."
            badge="Situação atual"
          >
            <div className="analytics-flow">
              {data.operation.map((stage) => (
                <div key={stage.status}>
                  <span className={`analytics-stage stage-${stage.status}`} />
                  <span>{statusLabels[stage.status]}</span>
                  <strong>{number(stage.count)}</strong>
                </div>
              ))}
            </div>
            <div className="analytics-outcomes">
              <span>
                No período: <b>{number(data.completedOrders)}</b> concluídos
              </span>
              <span>
                <b>{number(data.cancelledOrders)}</b> cancelados
              </span>
              <span>
                <b>{number(data.returnedOrders)}</b> devolvidos
              </span>
            </div>
          </Panel>
          <div className="analytics-grid analytics-even">
            <Panel
              title="Resumo financeiro"
              description="Valores dos pedidos concluídos no período."
            >
              <dl className="analytics-finance">
                <div>
                  <dt>Produtos antes dos descontos</dt>
                  <dd>{brl(data.sales.subtotal)}</dd>
                </div>
                <div>
                  <dt>Descontos concedidos</dt>
                  <dd>− {brl(data.sales.discounts)}</dd>
                </div>
                <div>
                  <dt>Taxas de entrega cobradas</dt>
                  <dd>+ {brl(data.sales.deliveryFees)}</dd>
                </div>
                <div className="analytics-finance-total">
                  <dt>Total de vendas</dt>
                  <dd>{brl(data.sales.revenue)}</dd>
                </div>
                <div>
                  <dt>Comissões dos motoboys</dt>
                  <dd>− {brl(data.sales.driverFees)}</dd>
                </div>
                <div className="analytics-finance-net">
                  <dt>Vendas após comissões</dt>
                  <dd>{brl(data.sales.afterDriverFees)}</dd>
                </div>
              </dl>
              <p className="analytics-note">
                Este saldo não é lucro: custos, despesas, taxas de cartão e
                repasses financeiros não estão incluídos.
              </p>
            </Panel>
            <Panel
              title="Formas de pagamento"
              description="Forma registrada nos pedidos concluídos."
            >
              <div className="analytics-payments">
                {data.payments.map((payment) => (
                  <div key={payment.method}>
                    <span className="analytics-payment-icon">
                      <Banknote size={19} />
                    </span>
                    <div>
                      <strong>{payments[payment.method]}</strong>
                      <small>{number(payment.orders)} pedidos</small>
                    </div>
                    <b>{brl(payment.revenue)}</b>
                  </div>
                ))}
              </div>
              <p className="analytics-note">
                Os valores refletem o registro da operação. Não representam
                conciliação com banco ou operadora.
              </p>
            </Panel>
          </div>
          <Panel
            title="Motoboys"
            description="Disponibilidade atual e desempenho no período escolhido."
            badge="Equipe de entrega"
          >
            <div className="analytics-driver-kpis">
              {[
                ["Habilitados", data.drivers.enabled],
                ["Disponíveis", data.drivers.available],
                ["Pausados", data.drivers.paused],
                ["Em rota", data.drivers.onRoute],
                ["Livres", data.drivers.free],
              ].map(([label, count]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{number(Number(count))}</strong>
                </div>
              ))}
            </div>
            {data.drivers.items.length ? (
              <div
                className="analytics-table-scroll"
                role="region"
                aria-label="Desempenho dos motoboys"
                tabIndex={0}
              >
                <table className="analytics-table">
                  <caption className="sr-only">
                    Motoboys: situação atual, pedidos ativos, entregas e
                    comissões no período
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Motoboy</th>
                      <th scope="col">Situação atual</th>
                      <th scope="col">Ativos agora</th>
                      <th scope="col">Concluídos</th>
                      <th scope="col">Devolvidos</th>
                      <th scope="col">Comissões</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.drivers.items.map((driver) => (
                      <tr key={driver.id}>
                        <th scope="row">
                          <Bike size={16} />
                          {driver.name}
                        </th>
                        <td>
                          <Badge
                            tone={
                              !driver.enabled
                                ? "neutral"
                                : driver.onRouteOrders
                                  ? "blue"
                                  : driver.available
                                    ? "green"
                                    : "gold"
                            }
                          >
                            {!driver.enabled
                              ? "Desabilitado"
                              : driver.onRouteOrders
                                ? "Em rota"
                                : driver.available
                                  ? "Disponível"
                                  : "Pausado"}
                          </Badge>
                        </td>
                        <td>{number(driver.activeOrders)}</td>
                        <td>{number(driver.completed)}</td>
                        <td>{number(driver.returned)}</td>
                        <td>{brl(driver.earnings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="analytics-note">
                Nenhum motoboy cadastrado. Cadastre a equipe em Configurações.
              </p>
            )}
            <p className="analytics-note">
              “Disponível” é a disponibilidade declarada pelo motoboy, não
              presença online. “Livre” significa disponível e sem pedidos
              ativos. Comissões correspondem às entregas concluídas.
            </p>
          </Panel>
          <p className="analytics-footnote">
            Atualização automática a cada 30 segundos enquanto esta página
            estiver visível. Vendas e pizzas usam a data de conclusão; pedidos
            recebidos usam a data de criação.
          </p>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  icon,
  primary,
  testId,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  primary?: boolean;
  testId: string;
}) {
  return (
    <article
      className={`analytics-metric ${primary ? "primary" : ""}`}
      aria-label={label}
    >
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong data-testid={testId}>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}
function Panel({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="analytics-panel" aria-labelledby={id}>
      <header>
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
        {badge && <Badge>{badge}</Badge>}
      </header>
      {children}
    </section>
  );
}
function Trend({ data }: { data: Analytics }) {
  const [metric, setMetric] = useState<"revenue" | "received" | "pizzas">(
    "revenue",
  );
  const gradient = useId().replaceAll(":", "");
  const rows = data.timeline;
  const labels = { revenue: "Vendas", received: "Pedidos", pizzas: "Pizzas" };
  const value = (n: number) => (metric === "revenue" ? brl(n) : number(n));
  const maximum = Math.max(...rows.map((row) => row[metric]), 1);
  const points = rows.map((row, index) => ({
    x: rows.length === 1 ? 350 : 96 + (index / (rows.length - 1)) * 568,
    y: 190 - (row[metric] / maximum) * 150,
    row,
  }));
  const line = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  return (
    <Panel
      title="Evolução no período"
      description="Acompanhe o movimento de cada dia."
    >
      <div className="analytics-chart-tabs" aria-label="Métrica do gráfico">
        {(["revenue", "received", "pizzas"] as const).map((key) => (
          <Button
            key={key}
            aria-pressed={key === metric}
            onClick={() => setMetric(key)}
          >
            {labels[key]}
          </Button>
        ))}
      </div>
      <svg
        className="analytics-chart"
        viewBox="0 0 690 235"
        role="img"
        aria-label={`${labels[metric]} por dia, de ${calendarLabel(data.period.from)} a ${calendarLabel(data.period.to)}. Valores exatos na tabela abaixo.`}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1="96"
              x2="670"
              y1={190 - ratio * 150}
              y2={190 - ratio * 150}
              className="analytics-gridline"
            />
            <text x="84" y={194 - ratio * 150} textAnchor="end">
              {value(Math.round(maximum * ratio))}
            </text>
          </g>
        ))}
        {points.length > 1 && (
          <path d={`${line} L 664 190 L 96 190 Z`} fill={`url(#${gradient})`} />
        )}
        <path
          d={line}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map(({ x, y, row }) => (
          <circle
            key={row.date}
            cx={x}
            cy={y}
            r={points.length > 60 ? 1.5 : 4}
            fill="var(--gold)"
          >
            <title>
              {calendarLabel(row.date)}: {value(row[metric])}
            </title>
          </circle>
        ))}
        {[
          ...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1]),
        ].map((index) => (
          <text key={index} x={points[index].x} y="221" textAnchor="middle">
            {calendarLabel(rows[index].date).slice(0, 5)}
          </text>
        ))}
      </svg>
      <details className="analytics-series">
        <summary>
          <ArrowDownToLine size={14} />
          Ver valores por dia
        </summary>
        <div
          className="analytics-table-scroll"
          role="region"
          aria-label="Valores diários"
          tabIndex={0}
        >
          <table className="analytics-table">
            <caption className="sr-only">
              Valores diários de pedidos, vendas e pizzas
            </caption>
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">Recebidos</th>
                <th scope="col">Concluídos</th>
                <th scope="col">Pizzas</th>
                <th scope="col">Vendas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{calendarLabel(row.date)}</th>
                  <td>{number(row.received)}</td>
                  <td>{number(row.completed)}</td>
                  <td>{number(row.pizzas)}</td>
                  <td>{brl(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Panel>
  );
}

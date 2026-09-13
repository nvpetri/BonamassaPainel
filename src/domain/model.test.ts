import { describe, expect, it } from "vitest";
import { createDemo, sampleDraft } from "./demo";
import {
  activeForDriver,
  applyCommand,
  csvOrders,
  priceItems,
  stateSchema,
  type Command,
  type OrderAction,
  type State,
} from "./model";

const now = Date.UTC(2026, 8, 13, 22);
const act = (
  state: State,
  id: string,
  action: OrderAction,
  extra: Partial<Extract<Command, { type: "ORDER" }>> = {},
) =>
  applyCommand(
    state,
    {
      type: "ORDER",
      id,
      action,
      version: state.orders.find((o) => o.id === id)!.version,
      ...extra,
    },
    now + 1000,
  );
const fresh = () => {
  const state = createDemo(now);
  return applyCommand(
    state,
    { type: "CREATE", draft: sampleDraft(state) },
    now,
    "test-order",
  );
};
function ready() {
  let state = fresh();
  for (const action of ["ACCEPT", "PREPARE", "READY"] as const)
    state = act(state, "test-order", action);
  return state;
}
function onRoute() {
  let state = act(ready(), "test-order", "ASSIGN", { driverId: "driver-a" });
  state = act(state, "test-order", "COLLECT");
  return act(state, "test-order", "START");
}

describe("Regras de pedido e preço", () => {
  it("abre os exemplos com dados íntegros e numeração única", () => {
    const state = createDemo(now);
    expect(stateSchema.safeParse(state).success).toBe(true);
    expect(state.orders).toHaveLength(8);
    expect(state.nextNumber).toBe(1047);
  });
  it("meia pizza cobra o maior sabor, soma uma borda e aplica a quantidade", () => {
    const [pizza] = priceItems(createDemo(now).products, [
      {
        kind: "PIZZA",
        flavorIds: ["calabresa", "frango"],
        size: "LARGE",
        crust: "CREAM",
        quantity: 2,
        note: "Sem cebola",
      },
    ]);
    expect(pizza.unitPrice).toBe(7500);
    expect(pizza.unitPrice * pizza.quantity).toBe(15000);
  });
  it("retirada remove a taxa e gera o valor exato em centavos", () => {
    const state = createDemo(now);
    const next = applyCommand(
      state,
      {
        type: "CREATE",
        draft: { ...sampleDraft(state), mode: "PICKUP", fee: 700, address: "" },
      },
      now,
      "pickup",
    );
    expect(next.orders[0].fee).toBe(0);
    expect(next.orders[0].total).toBe(5500);
  });
  it("rejeita dinheiro insuficiente", () => {
    const state = createDemo(now);
    expect(() =>
      applyCommand(
        state,
        {
          type: "CREATE",
          draft: { ...sampleDraft(state), payment: "CASH", cashTendered: 100 },
        },
        now,
      ),
    ).toThrow(/cobrir/);
  });
  it("rejeita sabor indisponível e duplicação de sabores", () => {
    const state = createDemo(now);
    state.products[0].enabled = false;
    expect(() =>
      priceItems(state.products, [
        {
          kind: "PIZZA",
          flavorIds: ["mussarela"],
          size: "LARGE",
          crust: "NONE",
          quantity: 1,
          note: "",
        },
      ]),
    ).toThrow(/indisponível/);
    expect(() =>
      priceItems(state.products, [
        {
          kind: "PIZZA",
          flavorIds: ["calabresa", "calabresa"],
          size: "LARGE",
          crust: "NONE",
          quantity: 1,
          note: "",
        },
      ]),
    ).toThrow(/diferentes/);
  });
  it("mudança de preço não altera o valor de pedidos existentes", () => {
    const state = fresh();
    const total = state.orders[0].total;
    const next = applyCommand(
      state,
      {
        type: "PRODUCT",
        product: {
          ...state.products[0],
          prices: { SMALL: 9999, MEDIUM: 9999, LARGE: 9999 },
        },
      },
      now,
    );
    expect(next.orders[0].total).toBe(total);
    expect(state.products[0].prices.LARGE).toBe(5500);
  });
  it("pausar a loja bloqueia novos pedidos e permite continuar os existentes", () => {
    const state = applyCommand(fresh(), { type: "STORE", open: false }, now);
    expect(() =>
      applyCommand(state, { type: "CREATE", draft: sampleDraft(state) }, now),
    ).toThrow(/pausada/);
    expect(act(state, "test-order", "ACCEPT").orders[0].status).toBe(
      "CONFIRMED",
    );
  });
  it("não permite pular preparo nem repetir um comando com versão antiga", () => {
    const state = fresh();
    expect(() => act(state, "test-order", "READY")).toThrow(/em preparo/);
    const accepted = act(state, "test-order", "ACCEPT");
    expect(() => act(accepted, "test-order", "ACCEPT", { version: 0 })).toThrow(
      /outra tela/,
    );
    expect(accepted.orders[0].events).toHaveLength(2);
  });
});

describe("Expedição e conclusão", () => {
  it("entrega exige atribuição, retirada e depois saída", () => {
    const state = ready();
    expect(() => act(state, "test-order", "START")).toThrow(/retirada/);
    expect(() => act(state, "test-order", "COLLECT")).toThrow(/Atribua/);
    const route = onRoute().orders[0];
    expect(route.status).toBe("OUT_FOR_DELIVERY");
    expect(route.deliveryStatus).toBe("ON_ROUTE");
  });
  it("não atribui a entregador pausado ou a pedido de retirada", () => {
    expect(() =>
      act(ready(), "test-order", "ASSIGN", { driverId: "driver-c" }),
    ).toThrow(/indisponível/);
    const state = ready();
    state.orders[0].mode = "PICKUP";
    expect(() =>
      act(state, "test-order", "ASSIGN", { driverId: "driver-a" }),
    ).toThrow(/entregas prontas/);
  });
  it("pausar novas coletas não bloqueia a saída de um pedido já retirado", () => {
    let state = act(ready(), "test-order", "ASSIGN", { driverId: "driver-a" });
    state = act(state, "test-order", "COLLECT");
    state = applyCommand(
      state,
      { type: "DRIVER", id: "driver-a", available: false },
      now + 1000,
    );
    expect(act(state, "test-order", "START").orders[0].status).toBe(
      "OUT_FOR_DELIVERY",
    );
  });
  it("bloqueia nova coleta durante pausa, mas permite reatribuir antes da retirada", () => {
    let state = act(ready(), "test-order", "ASSIGN", { driverId: "driver-a" });
    state = applyCommand(
      state,
      { type: "DRIVER", id: "driver-a", available: false },
      now + 1000,
    );
    expect(() => act(state, "test-order", "COLLECT")).toThrow(/pausado/);
    state = act(state, "test-order", "ASSIGN", { driverId: "driver-b" });
    expect(state.orders[0].driverId).toBe("driver-b");
  });
  it("permite vários pedidos por entregador e libera a carga após conclusão", () => {
    const state = onRoute();
    expect(activeForDriver(state, "driver-a")).toHaveLength(2);
    const next = act(state, "test-order", "COMPLETE", {
      recipient: "Pessoa exemplo",
    });
    expect(activeForDriver(next, "driver-a")).toHaveLength(1);
    expect(next.orders[0].status).toBe("DELIVERED");
  });
  it("exige destinatário e confirmação de recebimento em dinheiro", () => {
    const state = onRoute();
    state.orders[0].payment = "CASH";
    state.orders[0].cashTendered = 10000;
    state.orders[0].paymentCollected = false;
    expect(() =>
      act(state, "test-order", "COMPLETE", { paymentCollected: true }),
    ).toThrow(/quem recebeu/);
    expect(() =>
      act(state, "test-order", "COMPLETE", { recipient: "Pessoa exemplo" }),
    ).toThrow(/pagamento/);
    const done = act(state, "test-order", "COMPLETE", {
      recipient: "Pessoa exemplo",
      paymentCollected: true,
    });
    expect(done.orders[0].paymentCollected).toBe(true);
    expect(() =>
      act(done, "test-order", "COMPLETE", {
        recipient: "Pessoa exemplo",
        paymentCollected: true,
      }),
    ).toThrow(/ainda não pode/);
  });
  it("não reatribui nem cancela um pedido já coletado", () => {
    const state = act(
      act(ready(), "test-order", "ASSIGN", { driverId: "driver-a" }),
      "test-order",
      "COLLECT",
    );
    expect(() =>
      act(state, "test-order", "ASSIGN", { driverId: "driver-b" }),
    ).toThrow(/ainda não retiradas/);
    expect(() =>
      act(state, "test-order", "CANCEL", { reason: "Teste" }),
    ).toThrow(/retirado/);
  });
  it("tentativa sem sucesso vira retorno e devolução, sem concluir venda", () => {
    const state = act(onRoute(), "test-order", "ISSUE", {
      reason: "Cliente ausente",
    });
    expect(state.orders[0].status).toBe("RETURNING");
    expect(activeForDriver(state, "driver-a")).toHaveLength(2);
    const next = act(state, "test-order", "RETURN");
    expect(next.orders[0].status).toBe("RETURNED");
    expect(activeForDriver(next, "driver-a")).toHaveLength(1);
  });
  it("cancelar exige motivo, registra evento e remove a atribuição", () => {
    const state = act(ready(), "test-order", "ASSIGN", {
      driverId: "driver-a",
    });
    expect(() => act(state, "test-order", "CANCEL", { reason: " " })).toThrow(
      /motivo/,
    );
    const next = act(state, "test-order", "CANCEL", {
      reason: "Solicitação do cliente",
    });
    expect(next.orders[0].status).toBe("CANCELLED");
    expect(next.orders[0].driverId).toBeNull();
    expect(next.orders[0].events.at(-1)?.label).toContain(
      "Solicitação do cliente",
    );
  });
  it("bloqueia relógio voltando antes do último evento", () => {
    const state = onRoute();
    expect(() =>
      applyCommand(
        state,
        {
          type: "ORDER",
          id: "test-order",
          version: state.orders[0].version,
          action: "COMPLETE",
          recipient: "Pessoa exemplo",
        },
        now - 1000,
      ),
    ).toThrow(/relógio/);
  });
});

describe("Persistência e exportação", () => {
  it("recusa snapshots com total alterado, IDs duplicados e relações inválidas", () => {
    const state = createDemo(now);
    state.orders[0].total += 1;
    expect(stateSchema.safeParse(state).success).toBe(false);
    const duplicate = createDemo(now);
    duplicate.orders.push(duplicate.orders[0]);
    expect(stateSchema.safeParse(duplicate).success).toBe(false);
    const badDriver = onRoute();
    badDriver.orders[0].driverId = "inexistente";
    expect(stateSchema.safeParse(badDriver).success).toBe(false);
  });
  it("recusa uma conclusão sem recebedor e confirmação de pagamento", () => {
    const state = onRoute();
    state.orders[0].status = "DELIVERED";
    state.orders[0].deliveryStatus = "DELIVERED";
    expect(stateSchema.safeParse(state).success).toBe(false);
  });
  it("exporta CSV com escape de aspas e neutraliza fórmulas", () => {
    const order = createDemo(now).orders[0];
    order.customer = '=HYPERLINK("exemplo")';
    const csv = csvOrders([order]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""exemplo"")"');
  });
});

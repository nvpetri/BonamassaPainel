import { describe, expect, it } from "vitest";
import { createDemo, sampleDraft } from "./demo";
import {
  applyCommand,
  csvOrders,
  migrateState,
  quoteOrder,
  stateSchema,
  type Command,
  type Draft,
  type OrderAction,
  type State,
} from "./model";
import {
  parsePromotionDate,
  promotionDateInput,
  promotionSchema,
  promotionStatus,
  promotionUsage,
  type Promotion,
} from "./promotions";

const now = Date.UTC(2026, 8, 13, 22);
const promotion = (overrides: Partial<Promotion> = {}): Promotion => ({
  id: "noite-pizza",
  version: 0,
  name: "Noite da pizza",
  kind: "PERCENTAGE",
  value: 15,
  enabled: true,
  startsAt: now,
  endsAt: now + 3600_000,
  pizzaLimit: 5,
  ...overrides,
});
const setup = (overrides: Partial<Promotion> = {}) =>
  applyCommand(
    createDemo(now),
    {
      type: "PROMOTION",
      promotion: promotion(overrides),
      expectedVersion: null,
    },
    now,
  );
const draft = (state: State, overrides: Partial<Draft> = {}): Draft => ({
  ...sampleDraft(state),
  promotionId: "noite-pizza",
  ...overrides,
});
const create = (state: State, d = draft(state), id = "promo-order", at = now) =>
  applyCommand(
    state,
    {
      type: "CREATE",
      draft: d,
      expectedQuote: quoteOrder(state, d, at).signature,
    },
    at,
    id,
  );
const act = (
  state: State,
  action: OrderAction,
  extra: Partial<Extract<Command, { type: "ORDER" }>> = {},
) =>
  applyCommand(
    state,
    {
      type: "ORDER",
      id: "promo-order",
      version: state.orders.find((o) => o.id === "promo-order")!.version,
      action,
      ...extra,
    },
    now + 1000,
  );

describe("Descontos e validade", () => {
  it("cobra a meia pizza pelo maior sabor e não desconta borda, bebida nem entrega", () => {
    const state = setup({ value: 20 });
    const order = create(
      state,
      draft(state, {
        items: [
          {
            kind: "PIZZA",
            flavorIds: ["calabresa", "frango"],
            size: "LARGE",
            crust: "CREAM",
            quantity: 2,
            note: "",
          },
          { kind: "DRINK", productId: "refri", quantity: 1 },
        ],
      }),
    ).orders[0];
    expect(order.discount).toBe(2600);
    expect(order.total).toBe(14300); // 2 × (65 + 10) + 12 + 7 - 26
    expect(order.promotion?.pizzaQuantity).toBe(2);
    expect(order.promotion?.lines).toEqual([
      {
        itemId: "item-0",
        quantity: 2,
        baseUnitPrice: 6500,
        discountPerUnit: 1300,
      },
    ]);
  });
  it("arredonda o percentual por unidade em centavos", () => {
    const state = setup({ value: 15 });
    state.products[0].prices.LARGE = 5599;
    const d = draft(state);
    d.items[0].quantity = 3;
    expect(create(state, d).orders[0].discount).toBe(840 * 3);
  });
  it("valor fixo não ultrapassa o preço da pizza nem consome o valor da borda", () => {
    const state = setup({ kind: "FIXED", value: 10000 });
    const d = draft(state);
    if (d.items[0].kind === "PIZZA") d.items[0].crust = "CREAM";
    const o = create(state, d).orders[0];
    expect(o.discount).toBe(5500);
    expect(o.total).toBe(1700);
  });
  it("permite retirada gratuita e conclusão sem cobrança fictícia", () => {
    const state = setup({ value: 100 });
    let next = create(
      state,
      draft(state, { mode: "PICKUP", payment: "CASH", cashTendered: 0 }),
    );
    expect(next.orders[0].total).toBe(0);
    expect(next.orders[0].paymentCollected).toBe(true);
    for (const action of ["ACCEPT", "PREPARE", "READY"] as const)
      next = act(next, action);
    next = act(next, "COMPLETE", { recipient: "Cliente teste" });
    expect(next.orders[0].status).toBe("DELIVERED");
  });
  it("inclui o início e encerra exatamente no horário final", () => {
    const state = setup();
    expect(() => quoteOrder(state, draft(state), now - 1)).toThrow(/agendada/);
    expect(quoteOrder(state, draft(state), now).discount).toBe(825);
    expect(quoteOrder(state, draft(state), now + 3599_999).discount).toBe(825);
    expect(() => quoteOrder(state, draft(state), now + 3600_000)).toThrow(
      /encerrada/,
    );
  });
  it("pausa bloqueia novos usos e o prazo basta quando não há limite de quantidade", () => {
    const state = setup({ pizzaLimit: null });
    expect(
      promotionUsage(state.promotions[0], state.orders).remaining,
    ).toBeNull();
    const paused = applyCommand(
      state,
      {
        type: "PROMOTION",
        promotion: { ...state.promotions[0], enabled: false },
        expectedVersion: 0,
      },
      now,
    );
    expect(() => create(paused)).toThrow(/pausada/);
  });
  it("recusa promoção sem limites, prazo invertido, desconto e quantidade inválidos", () => {
    for (const invalid of [
      { endsAt: null, pizzaLimit: null },
      { endsAt: now },
      { value: 101 },
      { value: 0 },
      { pizzaLimit: 0 },
      { pizzaLimit: 1.5 },
    ])
      expect(promotionSchema.safeParse(promotion(invalid)).success).toBe(false);
    expect(() => setup({ startsAt: now - 3600_000, endsAt: now - 1 })).toThrow(
      /futuro/,
    );
  });
  it("pedido só de bebidas não recebe promoção nem ocupa limite", () => {
    const state = setup();
    expect(() =>
      create(
        state,
        draft(state, {
          items: [{ kind: "DRINK", productId: "refri", quantity: 2 }],
        }),
      ),
    ).toThrow(/pizza elegível/);
    expect(promotionUsage(state.promotions[0], state.orders).reserved).toBe(0);
  });
  it("dinheiro e troco usam o total com desconto", () => {
    const state = setup({ kind: "FIXED", value: 1000 });
    const o = create(
      state,
      draft(state, { payment: "CASH", cashTendered: 5200 }),
    ).orders[0];
    expect(o.total).toBe(5200);
    expect(() =>
      create(state, draft(state, { payment: "CASH", cashTendered: 5199 })),
    ).toThrow(/cobrir/);
  });
});

describe("Limites, reservas e concorrência", () => {
  it("últimas duas unidades de um carrinho com três pizzas recebem desconto", () => {
    const state = setup({
      endsAt: null,
      pizzaLimit: 2,
      kind: "FIXED",
      value: 1000,
    });
    const d = draft(state);
    d.items[0].quantity = 3;
    const next = create(state, d);
    expect(next.orders[0].discount).toBe(2000);
    expect(next.orders[0].total).toBe(15200);
    expect(promotionUsage(next.promotions[0], next.orders)).toEqual({
      sold: 0,
      reserved: 2,
      remaining: 0,
    });
    expect(promotionStatus(next.promotions[0], next.orders, now)).toBe(
      "Limite atingido",
    );
    expect(() => create(next, draft(next), "overflow")).toThrow(
      /limite atingido/,
    );
  });
  it("distribui a cota pela ordem das pizzas e não pelas bebidas", () => {
    const state = setup({ pizzaLimit: 2, value: 10 });
    const d = draft(state, {
      items: [
        { kind: "DRINK", productId: "refri", quantity: 10 },
        {
          kind: "PIZZA",
          flavorIds: ["mussarela"],
          size: "SMALL",
          crust: "NONE",
          quantity: 1,
          note: "",
        },
        {
          kind: "PIZZA",
          flavorIds: ["frango"],
          size: "LARGE",
          crust: "NONE",
          quantity: 2,
          note: "",
        },
      ],
    });
    expect(create(state, d).orders[0].discount).toBe(1000);
  });
  it("cancela e libera a reserva uma única vez, mantendo o desconto no histórico", () => {
    let state = create(setup({ pizzaLimit: 1 }));
    state = act(state, "CANCEL", { reason: "Cliente desistiu" });
    expect(promotionUsage(state.promotions[0], state.orders)).toEqual({
      sold: 0,
      reserved: 0,
      remaining: 1,
    });
    expect(state.orders[0].discount).toBe(825);
    expect(() => act(state, "CANCEL", { reason: "Outra tentativa" })).toThrow();
    expect(create(state, draft(state), "novo").orders[0].discount).toBe(825);
  });
  it("conclusão transforma reserva em venda sem liberar a cota", () => {
    let state = create(setup({ pizzaLimit: 1 }), undefined);
    // Keep the actual delivery lifecycle to exercise quota through every transition.
    for (const action of [
      "ACCEPT",
      "PREPARE",
      "READY",
      "ASSIGN",
      "COLLECT",
      "START",
    ] as const)
      state = act(state, action, { driverId: "driver-a" });
    state = act(state, "COMPLETE", { recipient: "Cliente exemplo" });
    expect(promotionUsage(state.promotions[0], state.orders)).toEqual({
      sold: 1,
      reserved: 0,
      remaining: 0,
    });
  });
  it("tentativa sem sucesso mantém reserva até a devolução confirmada", () => {
    let state = create(setup({ pizzaLimit: 1 }));
    for (const action of [
      "ACCEPT",
      "PREPARE",
      "READY",
      "ASSIGN",
      "COLLECT",
      "START",
    ] as const)
      state = act(state, action, { driverId: "driver-a" });
    state = act(state, "ISSUE", { reason: "Cliente ausente" });
    expect(promotionUsage(state.promotions[0], state.orders).remaining).toBe(0);
    state = act(state, "RETURN");
    expect(promotionUsage(state.promotions[0], state.orders)).toEqual({
      sold: 0,
      reserved: 0,
      remaining: 1,
    });
  });
  it("quota e prazo combinados encerram no primeiro limite atingido", () => {
    const state = setup({ pizzaLimit: 1 });
    const next = create(state);
    expect(promotionStatus(next.promotions[0], next.orders, now)).toBe(
      "Limite atingido",
    );
    expect(
      promotionStatus(state.promotions[0], state.orders, now + 3600_000),
    ).toBe("Encerrada");
  });
  it("duas cotações concorrentes não vendem mais pizzas nem mudam silenciosamente o preço", () => {
    const state = setup({ pizzaLimit: 3 });
    const d = draft(state);
    d.items[0].quantity = 2;
    const command: Command = {
      type: "CREATE",
      draft: d,
      expectedQuote: quoteOrder(state, d, now).signature,
    };
    const next = applyCommand(state, command, now, "primeiro");
    expect(() => applyCommand(next, command, now, "segundo")).toThrow(/mudou/);
    expect(next.orders.filter((o) => o.promotion)).toHaveLength(1);
    expect(promotionUsage(next.promotions[0], next.orders).remaining).toBe(1);
    expect(create(next, d, "revisado").orders[0].promotion?.pizzaQuantity).toBe(
      1,
    );
  });
  it("exige cotação promocional e rejeita preço de catálogo alterado desde a revisão", () => {
    const state = setup();
    const d = draft(state);
    expect(() =>
      applyCommand(state, { type: "CREATE", draft: d }, now),
    ).toThrow(/mudou/);
    const expectedQuote = quoteOrder(state, d, now).signature;
    state.products[0].prices.LARGE += 100;
    expect(() =>
      applyCommand(state, { type: "CREATE", draft: d, expectedQuote }, now),
    ).toThrow(/mudou/);
  });
});

describe("Edição, preservação e migração", () => {
  it("edição preserva snapshot, contador e total de pedidos existentes", () => {
    const original = create(setup());
    const order = structuredClone(original.orders[0]);
    const state = applyCommand(
      original,
      {
        type: "PROMOTION",
        promotion: {
          ...original.promotions[0],
          name: "Nova regra",
          value: 30,
          endsAt: now + 7200_000,
        },
        expectedVersion: 0,
      },
      now,
    );
    expect(state.orders[0]).toEqual(order);
    expect(promotionUsage(state.promotions[0], state.orders).reserved).toBe(1);
    expect(create(state, draft(state), "outro").orders[0].discount).toBe(1650);
    expect(csvOrders([order])).toContain('"Noite da pizza";"8,25";"1"');
  });
  it("não reduz limite abaixo de vendas e reservas nem sobrescreve edição concorrente", () => {
    const initial = setup();
    const d = draft(initial);
    d.items[0].quantity = 2;
    const state = create(initial, d);
    expect(() =>
      applyCommand(
        state,
        {
          type: "PROMOTION",
          promotion: { ...state.promotions[0], pizzaLimit: 1 },
          expectedVersion: 0,
        },
        now,
      ),
    ).toThrow(/2 pizzas/);
    const next = applyCommand(
      state,
      {
        type: "PROMOTION",
        promotion: { ...state.promotions[0], enabled: false },
        expectedVersion: 0,
      },
      now,
    );
    expect(() =>
      applyCommand(
        next,
        {
          type: "PROMOTION",
          promotion: state.promotions[0],
          expectedVersion: 0,
        },
        now,
      ),
    ).toThrow(/outra tela/);
    expect(() =>
      applyCommand(
        next,
        {
          type: "PROMOTION",
          promotion: state.promotions[0],
          expectedVersion: null,
        },
        now,
      ),
    ).toThrow(/outra tela/);
  });
  it("migra schema 1 sem alterar preços, sequência, eventos ou preferências", () => {
    const state = createDemo(now);
    state.settings.defaultFee = 1234;
    state.storeOpen = false;
    const legacy = {
      ...state,
      schema: 1,
      promotions: undefined,
      orders: state.orders.map((o) => {
        const { discount, promotion, ...old } = o;
        void discount;
        void promotion;
        return old;
      }),
    };
    const before = structuredClone(legacy);
    expect(migrateState(legacy)).toEqual(state);
    expect(legacy).toEqual(before);
    expect(migrateState(state)).toEqual(state);
    legacy.orders[0].total++;
    expect(() => migrateState(legacy)).toThrow(/Total/);
    expect(() => migrateState({ ...state, schema: 99 })).toThrow();
  });
  it("recusa desconto adulterado ou promoção ausente no armazenamento", () => {
    const original = create(setup());
    const state = structuredClone(original);
    state.orders[0].promotion!.lines[0].quantity++;
    expect(stateSchema.safeParse(state).success).toBe(false);
    const missing = structuredClone(original);
    missing.promotions = [];
    expect(stateSchema.safeParse(missing).success).toBe(false);
    const amount = structuredClone(original);
    amount.orders[0].discount++;
    expect(stateSchema.safeParse(amount).success).toBe(false);
  });
  it("horários de Brasília têm conversão explícita, inclusive virada de data", () => {
    expect(promotionDateInput(now)).toBe("2026-09-13T19:00");
    expect(parsePromotionDate("2026-09-13T19:00")).toBe(now);
    expect(parsePromotionDate("2026-09-13T23:30")).toBe(
      Date.UTC(2026, 8, 14, 2, 30),
    );
    expect(parsePromotionDate("2026-02-30T19:00")).toBeNaN();
    expect(parsePromotionDate("2026-09-13T25:00")).toBeNaN();
    expect(parsePromotionDate("")).toBeNaN();
  });
});

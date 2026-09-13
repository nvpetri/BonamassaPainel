import {
  applyCommand,
  type Draft,
  type OrderAction,
  type State,
  stateSchema,
} from "./model";

export function createDemo(now = Date.now()): State {
  let state: State = {
    schema: 2,
    demoId: crypto.randomUUID(),
    revision: 0,
    nextNumber: 1039,
    storeOpen: true,
    settings: { targetMinutes: 45, defaultFee: 700 },
    promotions: [],
    products: [
      {
        id: "mussarela",
        name: "Mussarela",
        description: "Mussarela, molho de tomate e orégano.",
        category: "PIZZA",
        enabled: true,
        prices: { SMALL: 3500, MEDIUM: 4500, LARGE: 5500 },
      },
      {
        id: "calabresa",
        name: "Calabresa",
        description: "Calabresa fatiada, cebola e azeitonas.",
        category: "PIZZA",
        enabled: true,
        prices: { SMALL: 3900, MEDIUM: 4900, LARGE: 5900 },
      },
      {
        id: "frango",
        name: "Frango com requeijão",
        description: "Frango desfiado, requeijão e milho.",
        category: "PIZZA",
        enabled: true,
        prices: { SMALL: 4300, MEDIUM: 5500, LARGE: 6500 },
      },
      {
        id: "portuguesa",
        name: "Portuguesa",
        description: "Presunto, ovos, cebola, ervilha e mussarela.",
        category: "PIZZA",
        enabled: true,
        prices: { SMALL: 4500, MEDIUM: 5700, LARGE: 6900 },
      },
      {
        id: "quatro",
        name: "Quatro queijos",
        description: "Mussarela, provolone, parmesão e requeijão.",
        category: "PIZZA",
        enabled: true,
        prices: { SMALL: 4900, MEDIUM: 5900, LARGE: 7500 },
      },
      {
        id: "marguerita",
        name: "Marguerita",
        description: "Mussarela, tomate fresco e manjericão.",
        category: "PIZZA",
        enabled: true,
        prices: { SMALL: 4500, MEDIUM: 5500, LARGE: 6500 },
      },
      {
        id: "refri",
        name: "Refrigerante 2 L",
        description: "Garrafa · sabor a conferir na expedição",
        category: "DRINK",
        enabled: true,
        prices: { SMALL: 1200, MEDIUM: 1200, LARGE: 1200 },
      },
      {
        id: "agua",
        name: "Água mineral 500 ml",
        description: "Sem gás",
        category: "DRINK",
        enabled: true,
        prices: { SMALL: 500, MEDIUM: 500, LARGE: 500 },
      },
    ],
    drivers: [
      {
        id: "driver-a",
        name: "Lucas · exemplo",
        initials: "LC",
        available: true,
        color: "gold",
      },
      {
        id: "driver-b",
        name: "Rafael · exemplo",
        initials: "RF",
        available: true,
        color: "blue",
      },
      {
        id: "driver-c",
        name: "Diego · exemplo",
        initials: "DG",
        available: false,
        color: "purple",
      },
    ],
    orders: [],
  };
  const add = (
    offset: number,
    draft: Partial<Draft>,
    actions: OrderAction[] = [],
    driverId = "driver-a",
  ) => {
    const at = now - offset * 60_000;
    const id = `demo-${state.nextNumber}`;
    state = applyCommand(
      state,
      { type: "CREATE", draft: { ...sampleDraft(state), ...draft } },
      at,
      id,
    );
    actions.forEach((action, index) => {
      const order = state.orders.find((o) => o.id === id)!;
      state = applyCommand(
        state,
        {
          type: "ORDER",
          id,
          version: order.version,
          action,
          driverId,
          recipient: "Cliente exemplo",
          paymentCollected: true,
        },
        at + (index + 1) * 60_000,
        `${id}-${action}`,
      );
    });
  };
  add(70, { customer: "Ana · exemplo" }, [
    "ACCEPT",
    "PREPARE",
    "READY",
    "ASSIGN",
    "COLLECT",
    "START",
    "COMPLETE",
  ]);
  add(
    28,
    {
      customer: "Mariana · exemplo",
      note: "Sem cebola em toda a pizza.",
      items: [
        {
          kind: "PIZZA",
          flavorIds: ["calabresa", "frango"],
          size: "LARGE",
          crust: "CREAM",
          quantity: 1,
          note: "Sem cebola",
        },
        { kind: "DRINK", productId: "refri", quantity: 1 },
      ],
    },
    ["ACCEPT", "PREPARE"],
  );
  add(
    20,
    {
      customer: "Bruno · exemplo",
      mode: "PICKUP",
      payment: "CARD",
      address: "",
      items: [
        {
          kind: "PIZZA",
          flavorIds: ["portuguesa"],
          size: "LARGE",
          crust: "NONE",
          quantity: 2,
          note: "",
        },
      ],
    },
    ["ACCEPT"],
  );
  add(
    37,
    {
      customer: "Camila · exemplo",
      payment: "CASH",
      cashTendered: 10000,
      reference: "Exemplo: encontrar o cliente na praça.",
      items: [
        {
          kind: "PIZZA",
          flavorIds: ["mussarela"],
          size: "LARGE",
          crust: "NONE",
          quantity: 1,
          note: "Bem assada",
        },
      ],
    },
    ["ACCEPT", "PREPARE", "READY", "ASSIGN"],
  );
  add(4, {
    customer: "Pedro · exemplo",
    payment: "CASH",
    cashTendered: 10000,
    note: "Levar o troco informado.",
  });
  add(2, {
    customer: "Juliana · exemplo",
    mode: "PICKUP",
    address: "",
    payment: "CARD",
    items: [
      {
        kind: "PIZZA",
        flavorIds: ["quatro"],
        size: "MEDIUM",
        crust: "NONE",
        quantity: 1,
        note: "",
      },
    ],
  });
  add(
    48,
    {
      customer: "Gabriel · exemplo",
      items: [
        {
          kind: "PIZZA",
          flavorIds: ["portuguesa", "marguerita"],
          size: "LARGE",
          crust: "NONE",
          quantity: 1,
          note: "",
        },
      ],
    },
    ["ACCEPT", "PREPARE", "READY", "ASSIGN", "COLLECT", "START"],
    "driver-b",
  );
  add(
    25,
    {
      customer: "Luiza · exemplo",
      mode: "PICKUP",
      address: "",
      payment: "CARD",
    },
    ["ACCEPT", "PREPARE", "READY"],
  );
  return stateSchema.parse(state);
}

export function sampleDraft(state: State): Draft {
  const flavor = state.products.find(
    (p) => p.category === "PIZZA" && p.enabled,
  );
  if (!flavor)
    throw new Error(
      "Ative pelo menos um sabor no cardápio para simular um pedido.",
    );
  return {
    customer: `Cliente demonstração ${state.nextNumber}`,
    channel: "APP",
    mode: "DELIVERY",
    address: "Praça da Sé, São Paulo · endereço de exemplo",
    reference: "Destino fictício para demonstração",
    note: "",
    payment: "PREPAID",
    cashTendered: 0,
    fee: state.settings.defaultFee,
    items: [
      {
        kind: "PIZZA",
        flavorIds: [flavor.id],
        size: "LARGE",
        crust: "NONE",
        quantity: 1,
        note: "",
      },
    ],
  };
}

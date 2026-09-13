import { z } from "zod";

export const moneySchema = z.number().int().min(0).max(10_000_000);
const text = (max: number) => z.string().trim().min(1).max(max);
export const statusSchema = z.enum([
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "RETURNING",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
]);
export const deliveryStatusSchema = z.enum([
  "ASSIGNED",
  "COLLECTED",
  "ON_ROUTE",
  "RETURNING",
  "DELIVERED",
  "RETURNED",
]);
export const sizeSchema = z.enum(["SMALL", "MEDIUM", "LARGE"]);
export const crustSchema = z.enum(["NONE", "CREAM", "CHEDDAR"]);
export const paymentSchema = z.enum(["PREPAID", "CASH", "CARD"]);

export const productSchema = z.object({
  id: text(80),
  name: text(80),
  description: z.string().max(240),
  category: z.enum(["PIZZA", "DRINK"]),
  enabled: z.boolean(),
  prices: z.object({
    SMALL: moneySchema.positive(),
    MEDIUM: moneySchema.positive(),
    LARGE: moneySchema.positive(),
  }),
});
export const driverSchema = z.object({
  id: text(80),
  name: text(80),
  initials: text(3),
  available: z.boolean(),
  color: z.enum(["gold", "blue", "purple"]),
});
export const itemSchema = z.object({
  id: text(100),
  name: text(180),
  detail: z.string().max(240),
  note: z.string().max(240),
  quantity: z.number().int().min(1).max(20),
  unitPrice: moneySchema.positive(),
});
export const eventSchema = z.object({
  id: text(120),
  at: z.number().int().nonnegative(),
  label: text(300),
});
export const orderSchema = z
  .object({
    id: text(100),
    number: z.number().int().positive(),
    version: z.number().int().nonnegative(),
    customer: text(80),
    channel: z.enum(["APP", "WHATSAPP", "COUNTER"]),
    mode: z.enum(["DELIVERY", "PICKUP"]),
    address: z.string().max(240),
    reference: z.string().max(240),
    note: z.string().max(240),
    status: statusSchema,
    deliveryStatus: deliveryStatusSchema.nullable(),
    driverId: z.string().nullable(),
    items: z.array(itemSchema).min(1).max(30),
    fee: moneySchema,
    total: moneySchema.positive(),
    payment: paymentSchema,
    cashTendered: moneySchema,
    paymentCollected: z.boolean(),
    recipient: z.string().max(80),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    events: z.array(eventSchema).min(1).max(100),
  })
  .superRefine((o, ctx) => {
    if (
      o.total !==
      o.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) +
        o.fee
    )
      ctx.addIssue({
        code: "custom",
        message: "Total do pedido não corresponde aos itens.",
      });
    if (o.mode === "PICKUP" && (o.fee !== 0 || o.driverId || o.deliveryStatus))
      ctx.addIssue({
        code: "custom",
        message: "Retirada não tem taxa ou entregador.",
      });
    if (o.mode === "DELIVERY" && o.address.trim().length < 5)
      ctx.addIssue({ code: "custom", message: "Informe o endereço completo." });
    if (o.payment === "CASH" && o.cashTendered < o.total)
      ctx.addIssue({
        code: "custom",
        message: "O valor em dinheiro não cobre o pedido.",
      });
    if ((o.driverId === null) !== (o.deliveryStatus === null))
      ctx.addIssue({
        code: "custom",
        message: "Atribuição de entrega incompleta.",
      });
    const expected: Partial<Record<Status, string[]>> = {
      READY: ["ASSIGNED", "COLLECTED"],
      OUT_FOR_DELIVERY: ["ON_ROUTE"],
      RETURNING: ["RETURNING"],
      RETURNED: ["RETURNED"],
      DELIVERED: ["DELIVERED"],
    };
    if (o.deliveryStatus && !expected[o.status]?.includes(o.deliveryStatus))
      ctx.addIssue({
        code: "custom",
        message: "Etapas do pedido e da entrega incompatíveis.",
      });
    if (
      ["OUT_FOR_DELIVERY", "RETURNING", "RETURNED"].includes(o.status) &&
      !o.driverId
    )
      ctx.addIssue({
        code: "custom",
        message: "Esta etapa exige um entregador.",
      });
    if (
      o.status === "DELIVERED" &&
      (!o.recipient.trim() ||
        !o.paymentCollected ||
        (o.mode === "DELIVERY" && !o.driverId))
    )
      ctx.addIssue({
        code: "custom",
        message: "Conclusão sem recebimento confirmado.",
      });
    if (
      o.updatedAt < o.createdAt ||
      o.events.some((e) => e.at < o.createdAt || e.at > o.updatedAt)
    )
      ctx.addIssue({
        code: "custom",
        message: "Horários do pedido inconsistentes.",
      });
  });
export const stateSchema = z
  .object({
    schema: z.literal(1),
    demoId: text(100),
    revision: z.number().int().nonnegative(),
    nextNumber: z.number().int().positive(),
    storeOpen: z.boolean(),
    settings: z.object({
      targetMinutes: z.number().int().min(10).max(120),
      defaultFee: moneySchema.max(10000),
    }),
    products: z.array(productSchema).min(1).max(100),
    drivers: z.array(driverSchema).max(50),
    orders: z.array(orderSchema).max(500),
  })
  .superRefine((state, ctx) => {
    for (const list of [state.products, state.drivers, state.orders]) {
      if (new Set(list.map((x) => x.id)).size !== list.length)
        ctx.addIssue({
          code: "custom",
          message: "Identificadores duplicados.",
        });
    }
    if (
      new Set(state.orders.map((x) => x.number)).size !== state.orders.length ||
      state.orders.some((x) => x.number >= state.nextNumber)
    )
      ctx.addIssue({
        code: "custom",
        message: "Numeração de pedidos inconsistente.",
      });
    if (
      state.orders.some(
        (o) => o.driverId && !state.drivers.some((d) => d.id === o.driverId),
      )
    )
      ctx.addIssue({ code: "custom", message: "Entregador não encontrado." });
  });

const pizzaDraft = z.object({
  kind: z.literal("PIZZA"),
  flavorIds: z.array(text(80)).min(1).max(2),
  size: sizeSchema,
  crust: crustSchema,
  quantity: z.number().int().min(1).max(20),
  note: z.string().trim().max(240),
});
const drinkDraft = z.object({
  kind: z.literal("DRINK"),
  productId: text(80),
  quantity: z.number().int().min(1).max(20),
});
export const draftSchema = z.object({
  customer: text(80),
  channel: z.enum(["APP", "WHATSAPP", "COUNTER"]),
  mode: z.enum(["DELIVERY", "PICKUP"]),
  address: z.string().trim().max(240),
  reference: z.string().trim().max(240),
  note: z.string().trim().max(240),
  payment: paymentSchema,
  cashTendered: moneySchema,
  fee: moneySchema.max(10000),
  items: z
    .array(z.discriminatedUnion("kind", [pizzaDraft, drinkDraft]))
    .min(1)
    .max(30),
});

export type Status = z.infer<typeof statusSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Product = z.infer<typeof productSchema>;
export type Driver = z.infer<typeof driverSchema>;
export type State = z.infer<typeof stateSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type ItemDraft = Draft["items"][number];
export type OrderAction =
  | "ACCEPT"
  | "PREPARE"
  | "READY"
  | "ASSIGN"
  | "COLLECT"
  | "START"
  | "COMPLETE"
  | "ISSUE"
  | "RETURN"
  | "CANCEL";
export type Command =
  | { type: "CREATE"; draft: Draft }
  | {
      type: "ORDER";
      id: string;
      version: number;
      action: OrderAction;
      driverId?: string;
      reason?: string;
      recipient?: string;
      paymentCollected?: boolean;
    }
  | { type: "STORE"; open: boolean }
  | { type: "DRIVER"; id: string; available: boolean }
  | { type: "PRODUCT"; product: Product; previous?: Product }
  | { type: "SETTINGS"; targetMinutes: number; defaultFee: number };

export const sizeLabels = {
  SMALL: "Pequena · 4 fatias",
  MEDIUM: "Média · 6 fatias",
  LARGE: "Grande · 8 fatias",
};
export const crusts = {
  NONE: { name: "Sem borda recheada", price: 0 },
  CREAM: { name: "Borda de requeijão", price: 1000 },
  CHEDDAR: { name: "Borda de cheddar", price: 1000 },
};
export const statusLabels: Record<Status, string> = {
  NEW: "Novo",
  CONFIRMED: "A preparar",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Em entrega",
  RETURNING: "Retornando",
  DELIVERED: "Concluído",
  RETURNED: "Devolvido",
  CANCELLED: "Cancelado",
};
export const paymentLabels = {
  PREPAID: "Pago antecipado (demo)",
  CASH: "Dinheiro",
  CARD: "Cartão na maquininha",
};
export const channelLabels = {
  APP: "App Bonamassa",
  WHATSAPP: "WhatsApp",
  COUNTER: "Balcão",
};
export const closedStatuses: Status[] = ["DELIVERED", "CANCELLED", "RETURNED"];
export const isActive = (order: Order) =>
  !closedStatuses.includes(order.status);
export const activeForDriver = (state: State, driverId: string) =>
  state.orders.filter((o) => o.driverId === driverId && isActive(o));
export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const minutesWaiting = (order: Order, now: number) =>
  Math.max(0, Math.floor((now - order.createdAt) / 60_000));

export class DomainError extends Error {}
const requireThat: (ok: unknown, message: string) => asserts ok = (
  ok,
  message,
) => {
  if (!ok) throw new DomainError(message);
};

export function priceItems(
  products: Product[],
  items: ItemDraft[],
): Order["items"] {
  return items.map((item, index) => {
    requireThat(
      Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        item.quantity <= 20,
      "Quantidade inválida.",
    );
    if (item.kind === "DRINK") {
      const product = products.find(
        (p) => p.id === item.productId && p.category === "DRINK" && p.enabled,
      );
      requireThat(product, "Bebida indisponível. Revise os itens.");
      return {
        id: `item-${index}`,
        name: product.name,
        detail: product.description,
        note: "",
        quantity: item.quantity,
        unitPrice: product.prices.MEDIUM,
      };
    }
    requireThat(
      item.flavorIds.length >= 1 &&
        item.flavorIds.length <= 2 &&
        new Set(item.flavorIds).size === item.flavorIds.length,
      "Escolha um ou dois sabores diferentes.",
    );
    const flavors = item.flavorIds.map((id) =>
      products.find((p) => p.id === id && p.category === "PIZZA" && p.enabled),
    );
    requireThat(
      flavors.every(Boolean),
      "Um dos sabores está indisponível. Revise os itens.",
    );
    const valid = flavors as Product[];
    const name =
      valid.length === 2
        ? valid.map((p) => `½ ${p.name}`).join(" + ")
        : valid[0].name;
    return {
      id: `item-${index}`,
      name,
      detail: `${sizeLabels[item.size]} · ${crusts[item.crust].name}`,
      note: item.note,
      quantity: item.quantity,
      unitPrice:
        Math.max(...valid.map((p) => p.prices[item.size])) +
        crusts[item.crust].price,
    };
  });
}

export function applyCommand(
  current: State,
  command: Command,
  now = Date.now(),
  id = crypto.randomUUID(),
): State {
  const state = structuredClone(current);
  if (command.type === "CREATE") {
    requireThat(
      state.storeOpen,
      "A loja está pausada. Abra a loja para adicionar pedidos.",
    );
    requireThat(
      state.orders.length < 500,
      "Limite de 500 pedidos desta demonstração. Exporte o histórico e reinicie a demo.",
    );
    const draft = draftSchema.parse(command.draft);
    const items = priceItems(state.products, draft.items);
    const fee = draft.mode === "PICKUP" ? 0 : draft.fee;
    const total =
      items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) +
      fee;
    requireThat(
      draft.mode === "PICKUP" || draft.address.length >= 5,
      "Informe o endereço completo para entrega.",
    );
    requireThat(
      draft.payment !== "CASH" || draft.cashTendered >= total,
      "O valor em dinheiro deve cobrir o total do pedido.",
    );
    state.orders.unshift({
      ...draft,
      id,
      number: state.nextNumber++,
      version: 0,
      items,
      fee,
      total,
      cashTendered: draft.payment === "CASH" ? draft.cashTendered : 0,
      status: "NEW",
      deliveryStatus: null,
      driverId: null,
      recipient: "",
      paymentCollected: draft.payment === "PREPAID",
      createdAt: now,
      updatedAt: now,
      events: [{ id: `${id}-created`, at: now, label: "Pedido recebido" }],
    });
  } else if (command.type === "ORDER") {
    const order = state.orders.find((o) => o.id === command.id);
    requireThat(order, "Pedido não encontrado.");
    requireThat(
      order.version === command.version,
      "Este pedido foi atualizado em outra tela. Confira a etapa atual e tente novamente.",
    );
    requireThat(
      now >= order.updatedAt,
      "O relógio está anterior à última atualização. Confira o horário do dispositivo.",
    );
    let label = "";
    switch (command.action) {
      case "ACCEPT":
        requireThat(
          order.status === "NEW",
          "Somente pedidos novos podem ser aceitos.",
        );
        order.status = "CONFIRMED";
        label = "Pedido aceito pela pizzaria";
        break;
      case "PREPARE":
        requireThat(
          order.status === "CONFIRMED",
          "Aceite o pedido antes de iniciar o preparo.",
        );
        order.status = "PREPARING";
        label = "Preparo iniciado na cozinha";
        break;
      case "READY":
        requireThat(
          order.status === "PREPARING",
          "Somente pedidos em preparo podem ficar prontos.",
        );
        order.status = "READY";
        label = "Pedido pronto para expedição";
        break;
      case "ASSIGN": {
        requireThat(
          order.mode === "DELIVERY" &&
            order.status === "READY" &&
            order.deliveryStatus !== "COLLECTED",
          "Atribua somente entregas prontas e ainda não retiradas.",
        );
        const driver = state.drivers.find((d) => d.id === command.driverId);
        requireThat(
          driver?.available,
          "O entregador está indisponível para novas coletas.",
        );
        requireThat(
          order.driverId !== driver.id,
          "Este entregador já está atribuído.",
        );
        order.driverId = driver.id;
        order.deliveryStatus = "ASSIGNED";
        label = `Entrega atribuída a ${driver.name}`;
        break;
      }
      case "COLLECT": {
        requireThat(
          order.status === "READY" && order.deliveryStatus === "ASSIGNED",
          "Atribua um entregador antes da retirada.",
        );
        requireThat(
          state.drivers.find((d) => d.id === order.driverId)?.available,
          "Entregador pausado para novas coletas.",
        );
        order.deliveryStatus = "COLLECTED";
        label = "Retirada pelo entregador simulada";
        break;
      }
      case "START":
        requireThat(
          order.status === "READY" && order.deliveryStatus === "COLLECTED",
          "Confirme a retirada antes de iniciar a rota.",
        );
        order.status = "OUT_FOR_DELIVERY";
        order.deliveryStatus = "ON_ROUTE";
        label = "Saída para entrega simulada";
        break;
      case "COMPLETE": {
        requireThat(
          order.mode === "PICKUP"
            ? order.status === "READY"
            : order.status === "OUT_FOR_DELIVERY",
          "O pedido ainda não pode ser concluído.",
        );
        const recipient = command.recipient?.trim();
        requireThat(
          recipient && recipient.length <= 80,
          "Informe quem recebeu o pedido (até 80 caracteres).",
        );
        requireThat(
          order.payment === "PREPAID" || command.paymentCollected,
          "Confirme o recebimento do pagamento.",
        );
        order.recipient = recipient;
        order.paymentCollected = true;
        order.status = "DELIVERED";
        if (order.mode === "DELIVERY") order.deliveryStatus = "DELIVERED";
        label = `${order.mode === "PICKUP" ? "Retirada no balcão" : "Entrega simulada"} concluída · Recebido por ${recipient}`;
        break;
      }
      case "ISSUE":
        requireThat(
          order.status === "OUT_FOR_DELIVERY",
          "Registre tentativa apenas em pedidos em rota.",
        );
        requireThat(
          typeof command.reason === "string" &&
            command.reason.trim().length > 0 &&
            command.reason.trim().length <= 240,
          "Informe o motivo da tentativa (até 240 caracteres).",
        );
        order.status = "RETURNING";
        order.deliveryStatus = "RETURNING";
        label = `Retorno à pizzaria · ${command.reason.trim()}`;
        break;
      case "RETURN":
        requireThat(
          order.status === "RETURNING",
          "Registre a tentativa antes da devolução.",
        );
        order.status = "RETURNED";
        order.deliveryStatus = "RETURNED";
        label = "Devolução na pizzaria confirmada";
        break;
      case "CANCEL":
        requireThat(
          ["NEW", "CONFIRMED", "PREPARING", "READY"].includes(order.status) &&
            order.deliveryStatus !== "COLLECTED",
          "Pedido retirado ou encerrado não pode ser cancelado aqui.",
        );
        requireThat(
          typeof command.reason === "string" &&
            command.reason.trim().length > 0 &&
            command.reason.trim().length <= 240,
          "Informe o motivo do cancelamento (até 240 caracteres).",
        );
        order.status = "CANCELLED";
        order.driverId = null;
        order.deliveryStatus = null;
        label = `Cancelado · ${command.reason.trim()}`;
        break;
    }
    order.version++;
    order.updatedAt = now;
    order.events.push({ id, at: now, label });
  } else if (command.type === "STORE") state.storeOpen = command.open;
  else if (command.type === "DRIVER") {
    const driver = state.drivers.find((d) => d.id === command.id);
    requireThat(driver, "Entregador não encontrado.");
    driver.available = command.available;
  } else if (command.type === "PRODUCT") {
    const product = productSchema.parse(command.product);
    const index = state.products.findIndex((p) => p.id === product.id);
    requireThat(index >= 0, "Produto não encontrado.");
    requireThat(
      !command.previous ||
        JSON.stringify(state.products[index]) ===
          JSON.stringify(command.previous),
      "O produto mudou em outra tela. Feche a edição e confira os dados atuais.",
    );
    requireThat(
      product.category === state.products[index].category,
      "A categoria deste produto não pode ser alterada.",
    );
    state.products[index] = product;
  } else if (command.type === "SETTINGS")
    state.settings = {
      targetMinutes: command.targetMinutes,
      defaultFee: command.defaultFee,
    };
  state.revision++;
  return stateSchema.parse(state);
}

export function csvOrders(orders: Order[]) {
  const safe = (value: string | number) => {
    const string = String(value);
    return `"${(/^[\s]*[=+@\-\t\r]/.test(string) ? "'" + string : string).replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      [
        "Pedido",
        "Data",
        "Cliente",
        "Situação",
        "Modalidade",
        "Total (R$)",
        "Pagamento",
      ],
      ...orders.map((o) => [
        o.number,
        new Date(o.createdAt).toISOString(),
        o.customer,
        statusLabels[o.status],
        o.mode === "DELIVERY" ? "Entrega" : "Retirada",
        (o.total / 100).toFixed(2).replace(".", ","),
        paymentLabels[o.payment],
      ]),
    ]
      .map((row) => row.map(safe).join(";"))
      .join("\r\n")
  );
}

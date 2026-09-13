import { z } from "zod";
import { catalogName } from "./photos";
import {
  CATALOG_LIMIT,
  DomainError,
  comboComponents,
  defaultCrustProducts,
  moneySchema,
  productSchema,
  itemSchema,
  itemDraftSchema,
  priceItems,
  resolveCrust,
} from "./catalog";
export {
  moneySchema,
  productSchema,
  itemSchema,
  sizeSchema,
  crustSchema,
  sizeLabels,
  priceItems,
  DomainError,
} from "./catalog";
import {
  discountPerPizza,
  promotionSchema,
  promotionSnapshotSchema,
  promotionStatus,
  promotionUsage,
  type Promotion,
  type PromotionSnapshot,
} from "./promotions";

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
export const paymentSchema = z.enum(["PREPAID", "CASH", "CARD"]);

export const driverSchema = z.object({
  id: text(80),
  name: text(80),
  initials: text(3),
  available: z.boolean(),
  color: z.enum(["gold", "blue", "purple"]),
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
    discount: moneySchema,
    promotion: promotionSnapshotSchema.nullable(),
    total: moneySchema,
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
        o.fee -
        o.discount
    )
      ctx.addIssue({
        code: "custom",
        message: "Total do pedido não corresponde aos itens.",
      });
    if (
      o.discount !== (o.promotion?.amount ?? 0) ||
      (o.promotion &&
        (o.promotion.appliedAt !== o.createdAt ||
          o.promotion.lines.some((line) => {
            const item = o.items.find((item) => item.id === line.itemId);
            return (
              !item ||
              line.quantity > item.quantity ||
              line.baseUnitPrice > item.unitPrice
            );
          })))
    )
      ctx.addIssue({
        code: "custom",
        message: "Desconto não corresponde ao pedido.",
      });
    if (new Set(o.items.map((item) => item.id)).size !== o.items.length)
      ctx.addIssue({ code: "custom", message: "Itens duplicados no pedido." });
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
    schema: z.literal(3),
    demoId: text(100),
    revision: z.number().int().nonnegative(),
    nextNumber: z.number().int().positive(),
    storeOpen: z.boolean(),
    settings: z.object({
      targetMinutes: z.number().int().min(10).max(120),
      defaultFee: moneySchema.max(10000),
    }),
    products: z.array(productSchema).min(1).max(CATALOG_LIMIT),
    drivers: z.array(driverSchema).max(50),
    promotions: z.array(promotionSchema).max(100),
    orders: z.array(orderSchema).max(500),
  })
  .superRefine((state, ctx) => {
    for (const list of [
      state.products,
      state.drivers,
      state.orders,
      state.promotions,
    ]) {
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
    if (
      state.orders.some(
        (o) =>
          o.promotion &&
          !state.promotions.some((p) => p.id === o.promotion!.id),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Promoção do pedido não encontrada.",
      });
    for (const product of state.products.filter(
      (p) => p.category === "COMBO",
    )) {
      try {
        comboComponents(state.products, product);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message:
            error instanceof Error ? error.message : "Composição inválida.",
        });
      }
    }
    for (const promotion of state.promotions) {
      const usage = promotionUsage(promotion, state.orders);
      if (
        promotion.pizzaLimit !== null &&
        usage.sold + usage.reserved > promotion.pizzaLimit
      )
        ctx.addIssue({
          code: "custom",
          message: "O limite promocional não cobre as pizzas já utilizadas.",
        });
    }
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
  promotionId: text(100).nullable().optional(),
  items: z.array(itemDraftSchema).min(1).max(30),
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
  | { type: "CREATE"; draft: Draft; expectedQuote?: string }
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
  | { type: "ADD_PRODUCT"; product: Product }
  | { type: "PROMOTION"; promotion: Promotion; expectedVersion: number | null }
  | { type: "SETTINGS"; targetMinutes: number; defaultFee: number };

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

const requireThat: (ok: unknown, message: string) => asserts ok = (
  ok,
  message,
) => {
  if (!ok) throw new DomainError(message);
};

export function quoteOrder(
  state: State,
  draft: Pick<Draft, "items" | "mode" | "fee" | "promotionId">,
  now: number,
) {
  const items = priceItems(state.products, draft.items);
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  const fee = draft.mode === "PICKUP" ? 0 : draft.fee;
  let promotion: PromotionSnapshot | null = null;
  if (draft.promotionId) {
    const p = state.promotions.find((p) => p.id === draft.promotionId);
    requireThat(p, "Promoção não encontrada. Revise o pedido.");
    const status = promotionStatus(p, state.orders, now);
    requireThat(
      status === "Ativa",
      `Promoção ${status.toLowerCase()}. Escolha outra promoção ou remova o desconto.`,
    );
    let available = promotionUsage(p, state.orders).remaining ?? Infinity;
    const lines: PromotionSnapshot["lines"] = [];
    draft.items.forEach((item, index) => {
      if (item.kind !== "PIZZA" || available <= 0) return;
      const baseUnitPrice =
        items[index].unitPrice - resolveCrust(state.products, item.crust).price;
      const discountPerUnit = discountPerPizza(p.kind, p.value, baseUnitPrice);
      const quantity = Math.min(item.quantity, available);
      if (discountPerUnit <= 0) return;
      lines.push({
        itemId: items[index].id,
        quantity,
        baseUnitPrice,
        discountPerUnit,
      });
      available -= quantity;
    });
    requireThat(
      lines.length,
      "Adicione uma pizza elegível para usar esta promoção.",
    );
    promotion = {
      id: p.id,
      version: p.version,
      name: p.name,
      kind: p.kind,
      value: p.value,
      appliedAt: now,
      pizzaQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      amount: lines.reduce(
        (sum, line) => sum + line.quantity * line.discountPerUnit,
        0,
      ),
      lines,
    };
  }
  const discount = promotion?.amount ?? 0;
  const total = subtotal + fee - discount;
  // Exclude the clock from the signature, but include the exact allocation and promotion revision.
  const signature = JSON.stringify({
    items,
    fee,
    total,
    promotion: promotion ? { ...promotion, appliedAt: 0 } : null,
  });
  return { items, subtotal, fee, total, discount, promotion, signature };
}

/** Upgrade existing local data without repricing or replacing any historic order. */
export function migrateState(raw: unknown): State {
  if (typeof raw !== "object" || raw === null || !("schema" in raw))
    return stateSchema.parse(raw);
  if (raw.schema === 1 && "orders" in raw && Array.isArray(raw.orders)) {
    return migrateState({
      ...raw,
      schema: 2,
      promotions: [],
      orders: raw.orders.map((order) => ({
        ...order,
        discount: 0,
        promotion: null,
      })),
    });
  }
  if (raw.schema === 2 && "products" in raw && Array.isArray(raw.products)) {
    const products = raw.products.map((p) =>
      productSchema.parse({
        ...p,
        ...(p.category === "PIZZA"
          ? { pizzaGroup: p.pizzaGroup ?? "TRADITIONAL" }
          : {}),
      }),
    );
    for (const crust of defaultCrustProducts()) {
      const existing = products.find((p) => p.id === crust.id);
      requireThat(
        !existing || existing.category === "CRUST",
        "Identificador de borda em conflito. Os dados anteriores foram preservados.",
      );
      if (!existing) products.push(crust);
    }
    return stateSchema.parse({ ...raw, schema: 3, products });
  }
  return stateSchema.parse(raw);
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
    const { items, fee, total, discount, promotion, signature } = quoteOrder(
      state,
      draft,
      now,
    );
    requireThat(
      (!draft.promotionId && command.expectedQuote === undefined) ||
        command.expectedQuote === signature,
      "O preço, a composição ou a disponibilidade mudou. Confira o resumo atualizado antes de criar o pedido.",
    );
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
      discount,
      promotion,
      cashTendered: draft.payment === "CASH" ? draft.cashTendered : 0,
      status: "NEW",
      deliveryStatus: null,
      driverId: null,
      recipient: "",
      paymentCollected: draft.payment === "PREPAID" || total === 0,
      createdAt: now,
      updatedAt: now,
      events: [
        {
          id: `${id}-created`,
          at: now,
          label: promotion
            ? `Pedido recebido · Promoção ${promotion.name}: ${brl(discount)} em ${promotion.pizzaQuantity} pizza(s)`
            : "Pedido recebido",
        },
      ],
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
          order.total === 0 ||
            order.payment === "PREPAID" ||
            command.paymentCollected,
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
  } else if (command.type === "ADD_PRODUCT") {
    const product = productSchema.parse(command.product);
    requireThat(
      state.products.length < CATALOG_LIMIT,
      `Limite de ${CATALOG_LIMIT} produtos nesta demonstração.`,
    );
    requireThat(
      !state.products.some((p) => p.id === product.id),
      "Este produto já foi cadastrado. Confira o cardápio.",
    );
    requireThat(
      !state.products.some(
        (p) =>
          p.category === product.category &&
          catalogName(p.name) === catalogName(product.name),
      ),
      "Já existe um produto com esse nome nesta categoria. Edite o cadastro existente ou escolha outro nome.",
    );
    state.products.unshift(product);
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
    requireThat(
      !state.products.some(
        (p) =>
          p.id !== product.id &&
          p.category === product.category &&
          catalogName(p.name) === catalogName(product.name),
      ),
      "Já existe um produto com esse nome nesta categoria. Escolha outro nome.",
    );
    state.products[index] = product;
  } else if (command.type === "PROMOTION") {
    const promotion = promotionSchema.parse(command.promotion);
    const index = state.promotions.findIndex((p) => p.id === promotion.id);
    requireThat(
      index >= 0
        ? state.promotions[index].version === command.expectedVersion
        : command.expectedVersion === null,
      "A promoção mudou em outra tela. Feche a edição e confira os dados atuais.",
    );
    requireThat(
      index >= 0 || state.promotions.length < 100,
      "Limite de 100 promoções nesta demonstração.",
    );
    const usage = promotionUsage(promotion, state.orders);
    requireThat(
      promotion.pizzaLimit === null ||
        promotion.pizzaLimit >= usage.sold + usage.reserved,
      `O limite deve cobrir as ${usage.sold + usage.reserved} pizzas já vendidas ou reservadas.`,
    );
    requireThat(
      index >= 0 || promotion.endsAt === null || promotion.endsAt > now,
      "Escolha um encerramento no futuro.",
    );
    promotion.version = index < 0 ? 0 : state.promotions[index].version + 1;
    if (index < 0) state.promotions.unshift(promotion);
    else state.promotions[index] = promotion;
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
        "Promoção",
        "Desconto (R$)",
        "Pizzas promocionais",
      ],
      ...orders.map((o) => [
        o.number,
        new Date(o.createdAt).toISOString(),
        o.customer,
        statusLabels[o.status],
        o.mode === "DELIVERY" ? "Entrega" : "Retirada",
        (o.total / 100).toFixed(2).replace(".", ","),
        paymentLabels[o.payment],
        o.promotion?.name ?? "",
        (o.discount / 100).toFixed(2).replace(".", ","),
        o.promotion?.pizzaQuantity ?? 0,
      ]),
    ]
      .map((row) => row.map(safe).join(";"))
      .join("\r\n")
  );
}

import { z } from "zod";

const cents = z.number().int().min(0).max(10_000_000);
const instant = z.number().int().nonnegative().max(8_640_000_000_000_000);
const discountFields = {
  kind: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().int().positive().max(10_000_000),
};
export const promotionSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(70),
    enabled: z.boolean(),
    ...discountFields,
    startsAt: instant,
    endsAt: instant.nullable(),
    pizzaLimit: z.number().int().min(1).max(100_000).nullable(),
  })
  .superRefine((p, ctx) => {
    if (p.kind === "PERCENTAGE" && p.value > 100)
      ctx.addIssue({
        code: "custom",
        message: "O percentual deve ficar entre 1% e 100%.",
      });
    if (p.endsAt === null && p.pizzaLimit === null)
      ctx.addIssue({
        code: "custom",
        message: "Defina um prazo ou um limite de pizzas.",
      });
    if (p.endsAt !== null && p.endsAt <= p.startsAt)
      ctx.addIssue({
        code: "custom",
        message: "O fim deve ser posterior ao início da promoção.",
      });
  });
export type Promotion = z.infer<typeof promotionSchema>;

export function discountPerPizza(
  kind: Promotion["kind"],
  value: number,
  base: number,
) {
  return Math.min(
    base,
    kind === "PERCENTAGE" ? Math.round((base * value) / 100) : value,
  );
}

export const promotionSnapshotSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.number().int().nonnegative(),
    name: z.string().trim().min(1).max(70),
    ...discountFields,
    appliedAt: instant,
    pizzaQuantity: z.number().int().min(1).max(600),
    amount: cents.positive(),
    lines: z
      .array(
        z.object({
          itemId: z.string().min(1).max(100),
          quantity: z.number().int().min(1).max(20),
          baseUnitPrice: cents.positive(),
          discountPerUnit: cents.positive(),
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((p, ctx) => {
    if (
      (p.kind === "PERCENTAGE" && p.value > 100) ||
      new Set(p.lines.map((l) => l.itemId)).size !== p.lines.length ||
      p.lines.reduce((sum, l) => sum + l.quantity, 0) !== p.pizzaQuantity ||
      p.lines.reduce((sum, l) => sum + l.quantity * l.discountPerUnit, 0) !==
        p.amount ||
      p.lines.some(
        (l) =>
          l.discountPerUnit !==
          discountPerPizza(p.kind, p.value, l.baseUnitPrice),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Desconto promocional inconsistente.",
      });
  });
export type PromotionSnapshot = z.infer<typeof promotionSnapshotSchema>;
type UsageOrder = { status: string; promotion: PromotionSnapshot | null };

export function promotionUsage(
  promotion: Pick<Promotion, "id" | "pizzaLimit"> & {
    apiUsage?: { sold: number; reserved: number; remaining: number | null };
  },
  orders: UsageOrder[],
) {
  if (promotion.apiUsage) return promotion.apiUsage;
  let sold = 0;
  let reserved = 0;
  for (const order of orders) {
    if (order.promotion?.id !== promotion.id) continue;
    if (order.status === "DELIVERED") sold += order.promotion.pizzaQuantity;
    else if (!["CANCELLED", "RETURNED"].includes(order.status))
      reserved += order.promotion.pizzaQuantity;
  }
  return {
    sold,
    reserved,
    remaining:
      promotion.pizzaLimit === null
        ? null
        : Math.max(0, promotion.pizzaLimit - sold - reserved),
  };
}

export function promotionStatus(
  p: Promotion,
  orders: UsageOrder[],
  now: number,
) {
  if (!p.enabled) return "Pausada";
  if (now < p.startsAt) return "Agendada";
  if (p.endsAt !== null && now >= p.endsAt) return "Encerrada";
  if (promotionUsage(p, orders).remaining === 0) return "Limite atingido";
  return "Ativa";
}

// datetime-local has no timezone. Convert explicitly instead of depending on the operator's device.
const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function promotionDateInput(epoch: number) {
  const p = Object.fromEntries(
    dateParts.formatToParts(epoch).map((p) => [p.type, p.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function parsePromotionDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const local = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(local)) return NaN;
  let candidate = local;
  for (let i = 0; i < 3; i++) {
    const shown = Date.parse(`${promotionDateInput(candidate)}:00Z`);
    candidate += local - shown;
  }
  return promotionDateInput(candidate) === value ? candidate : NaN;
}
export const formatPromotionDate = (epoch: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(epoch);

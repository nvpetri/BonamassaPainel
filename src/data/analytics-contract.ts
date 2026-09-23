import { z } from "zod";

const count = z.number().int().nonnegative();
const money = z.number().int().safe();
export const periodSchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine(({ from, to }) => {
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    return days >= 0 && days < 366;
  }, "Escolha um período de até 366 dias, com início anterior ou igual ao fim.");
export type Period = z.infer<typeof periodSchema>;
export const analyticsSchema = z.object({
  period: z.object({
    from: z.iso.date(),
    to: z.iso.date(),
    timeZone: z.literal("America/Sao_Paulo"),
  }),
  generatedAt: z.iso.datetime(),
  receivedOrders: count,
  completedOrders: count,
  cancelledOrders: count,
  returnedOrders: count,
  pizzasSold: count,
  incompletePizzaOrders: count,
  sales: z.object({
    subtotal: money,
    discounts: money,
    deliveryFees: money,
    revenue: money,
    driverFees: money,
    afterDriverFees: money,
    averageTicket: money,
  }),
  channels: z
    .array(
      z.object({
        channel: z.enum(["APP", "WHATSAPP", "COUNTER"]),
        received: count,
        completed: count,
        revenue: money,
      }),
    )
    .length(3),
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "CARD", "PREPAID"]),
        orders: count,
        revenue: money,
      }),
    )
    .length(3),
  timeline: z
    .array(
      z.object({
        date: z.iso.date(),
        received: count,
        completed: count,
        revenue: money,
        pizzas: count,
      }),
    )
    .min(1)
    .max(366),
  operation: z
    .array(
      z.object({
        status: z.enum([
          "SCHEDULED",
          "NEW",
          "CONFIRMED",
          "PREPARING",
          "READY",
          "OUT_FOR_DELIVERY",
          "RETURNING",
        ]),
        count,
      }),
    )
    .length(7),
  drivers: z.object({
    total: count,
    enabled: count,
    available: count,
    paused: count,
    onRoute: count,
    free: count,
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        enabled: z.boolean(),
        available: z.boolean(),
        activeOrders: count,
        onRouteOrders: count,
        completed: count,
        returned: count,
        earnings: money,
      }),
    ),
  }),
});
export type Analytics = z.infer<typeof analyticsSchema>;

export function recentPeriod(now: number, days: number): Period {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const to = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    from: new Date(Date.parse(to) - (days - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10),
    to,
  };
}
export function calendarLabel(date: string) {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

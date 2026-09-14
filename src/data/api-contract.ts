import { z } from "zod";
import {
  productSchema,
  componentSchema,
  itemSchema,
  moneySchema,
} from "../domain/catalog";
import {
  statusSchema,
  deliveryStatusSchema,
  type Order,
  type State,
  type Product,
} from "../domain/model";
import { promotionSchema, promotionSnapshotSchema } from "../domain/promotions";

const date = z.iso.datetime().transform(Date.parse);
export const userSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  role: z.enum(["MANAGER", "ATTENDANT", "KITCHEN", "DRIVER"]),
  enabled: z.boolean(),
  available: z.boolean(),
  version: z.number().int(),
});
export type ApiUser = z.infer<typeof userSchema>;
export const storeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  open: z.boolean(),
  scheduleEnabled: z.boolean().default(false),
  opensAt: z.string().default("17:00"),
  closesAt: z.string().default("03:00"),
  timeZone: z.string().default("America/Sao_Paulo"),
  scheduledOpen: z.boolean().default(false),
  reservationsAvailable: z.boolean().default(false),
  nextOpening: date.nullable().optional().default(null),
  overrideOpen: z.boolean().nullable().optional().default(null),
  overrideUntil: date.nullable().optional().default(null),
  deliveryFee: moneySchema,
  driverFee: moneySchema,
  version: z.number().int(),
});
export type ApiStore = z.infer<typeof storeSchema>;
const productDto = z.object({
  ...productSchema.shape,
  photo: z.unknown().optional(),
  version: z.number().int(),
  imageId: z.string().nullable(),
});
export const catalogSchema = z.object({
  store: storeSchema,
  products: z.array(productDto),
  promotions: z.array(
    z.object({
      ...promotionSchema.shape,
      startsAt: date,
      endsAt: date.nullable(),
      reserved: z.number().int().nonnegative(),
      sold: z.number().int().nonnegative(),
      remaining: z.number().int().nonnegative().nullable(),
      status: z.string(),
    }),
  ),
  serverTime: date,
});
export type ApiCatalog = z.infer<typeof catalogSchema>;
export const driverDto = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  available: z.boolean(),
  version: z.number().int(),
  orders: z.array(
    z.object({
      id: z.string(),
      number: z.number(),
      status: z.string(),
      deliveryStatus: z.string().nullable(),
    }),
  ),
});
export type ApiDriver = z.infer<typeof driverDto>;
const kitchenItem = componentSchema.extend({
  id: z.string(),
  components: z.array(componentSchema).optional(),
});
export const kitchenOrderSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  version: z.number().int(),
  status: statusSchema,
  scheduledFor: date.nullable().optional().default(null),
  queuedAt: date.nullable().optional().default(null),
  deliveryStatus: deliveryStatusSchema.nullable(),
  mode: z.enum(["DELIVERY", "PICKUP"]),
  note: z.string(),
  createdAt: date,
  updatedAt: date,
  events: z.array(
    z.object({
      action: z.string(),
      version: z.number(),
      createdAt: date,
      data: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  items: z.array(kitchenItem),
});
export type KitchenOrder = z.infer<typeof kitchenOrderSchema>;
export const addressSchema = z.object({
  street: z.string().trim().min(1).max(120),
  number: z.string().trim().min(1).max(20),
  neighborhood: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80),
  state: z.string().regex(/^[A-Z]{2}$/),
  postalCode: z.string().regex(/^\d{8}$/),
  reference: z.string().trim().max(240),
});
export const apiOrderSchema = kitchenOrderSchema.extend({
  items: z.array(itemSchema),
  customer: z.object({ name: z.string(), phone: z.string() }),
  address: addressSchema.nullable(),
  channel: z.enum(["APP", "WHATSAPP", "COUNTER"]),
  driverId: z.string().nullable(),
  payment: z.enum(["PREPAID", "CASH", "CARD"]),
  paymentRecorded: z.boolean(),
  cashTendered: moneySchema.nullable(),
  subtotal: moneySchema,
  fee: moneySchema,
  discount: moneySchema,
  total: moneySchema,
  recipient: z.string().nullable(),
  promotion: z
    .object({ ...promotionSnapshotSchema.shape, appliedAt: date })
    .nullable(),
});
export type ApiOrder = z.infer<typeof apiOrderSchema>;
export const quoteResponseSchema = z.object({
  quoteId: z.string(),
  scheduledFor: date.nullable().optional().default(null),
  expiresAt: date,
  items: z.array(itemSchema),
  subtotal: moneySchema,
  fee: moneySchema,
  discount: moneySchema,
  total: moneySchema,
  promotion: z
    .object(promotionSnapshotSchema.shape)
    .omit({ appliedAt: true })
    .nullable(),
});
export type ApiQuote = z.infer<typeof quoteResponseSchema>;
export const versions = new WeakMap<
  Product,
  { version: number; imageId: string | null }
>();
const labels: Record<string, string> = {
  CREATED: "Pedido recebido",
  SCHEDULED: "Reserva agendada",
  SCHEDULE_RELEASED: "Reserva liberada para atendimento",
  ACCEPT: "Pedido aceito",
  PREPARE: "Preparo iniciado",
  READY: "Pedido pronto",
  ASSIGN: "Entregador atribuído",
  COLLECT: "Retirado pelo entregador",
  START: "Saiu para entrega",
  COMPLETE: "Entrega concluída",
  PICKUP_COMPLETE: "Retirada concluída",
  CANCEL: "Pedido cancelado",
  ISSUE: "Problema na entrega",
  RETURN: "Devolução confirmada",
  RECORD_PAYMENT: "Pagamento registrado",
};
export function mapOrder(o: ApiOrder): Order {
  const address = o.address;
  return {
    ...o,
    customer: o.customer.name,
    customerPhone: o.customer.phone,
    address: address
      ? `${address.street}, ${address.number} · ${address.neighborhood} · ${address.city}/${address.state} · CEP ${address.postalCode}`
      : "",
    reference: address?.reference ?? "",
    cashTendered: o.cashTendered ?? o.total,
    paymentCollected: o.paymentRecorded,
    recipient: o.recipient ?? "",
    events: o.events.map((e) => ({
      id: `${o.id}:${e.version}`,
      at: e.createdAt,
      label: `${labels[e.action.replaceAll("-", "_").toUpperCase()] || e.action}${typeof e.data?.reason === "string" ? ` · ${e.data.reason}` : ""}`,
    })),
  };
}
export function mapState(
  catalog: ApiCatalog,
  drivers: ApiDriver[],
  orders: ApiOrder[],
  revision: number,
): State {
  return {
    schema: 3,
    demoId: `api:${catalog.store.id}`,
    revision,
    nextNumber: Math.max(0, ...orders.map((o) => o.number)) + 1,
    storeOpen: catalog.store.open,
    settings: { targetMinutes: 45, defaultFee: catalog.store.deliveryFee },
    products: catalog.products.map((p) => {
      const product: Product = {
        ...p,
        photo: p.imageId ? `/api/images/${p.imageId}` : null,
      };
      versions.set(product, { version: p.version, imageId: p.imageId });
      return product;
    }),
    drivers: drivers.map((d, i) => ({
      id: d.id,
      name: d.name,
      initials: d.name
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join(""),
      available: d.enabled && d.available,
      color: (["gold", "blue", "purple"] as const)[i % 3],
    })),
    promotions: catalog.promotions.map((p) => ({
      ...p,
      apiUsage: { reserved: p.reserved, sold: p.sold, remaining: p.remaining },
    })),
    orders: orders.map(mapOrder),
  };
}

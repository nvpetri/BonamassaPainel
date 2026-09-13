import { z } from "zod";
import { productPhotoSchema } from "./photos";

export const CATALOG_LIMIT = 200;
export const moneySchema = z.number().int().min(0).max(10_000_000);
const text = (max: number) => z.string().trim().min(1).max(max);
export const sizeSchema = z.enum(["SMALL", "MEDIUM", "LARGE"]);
// NONE is the unfilled edge; every other value references a CRUST product.
export const crustSchema = text(80);
export const pizzaGroupSchema = z.enum(["TRADITIONAL", "SPECIAL"]);
export const categorySchema = z.enum(["PIZZA", "CRUST", "DRINK", "COMBO"]);
export const categoryLabels = {
  PIZZA: "Pizzas",
  CRUST: "Bordas",
  DRINK: "Bebidas",
  COMBO: "Combos",
};
export const pizzaGroupLabels = {
  TRADITIONAL: "Tradicionais",
  SPECIAL: "Especiais",
};
export const sizeLabels = {
  SMALL: "Pequena · 4 fatias",
  MEDIUM: "Média · 6 fatias",
  LARGE: "Grande · 8 fatias",
};

export const pizzaDraftSchema = z.object({
  kind: z.literal("PIZZA"),
  flavorIds: z.array(text(80)).min(1).max(2),
  size: sizeSchema,
  crust: crustSchema,
  quantity: z.number().int().min(1).max(20),
  note: z.string().trim().max(240),
});
const drinkDraftSchema = z.object({
  kind: z.literal("DRINK"),
  productId: text(80),
  quantity: z.number().int().min(1).max(20),
});
export const basicItemDraftSchema = z.discriminatedUnion("kind", [
  pizzaDraftSchema,
  drinkDraftSchema,
]);
export const itemDraftSchema = z.discriminatedUnion("kind", [
  pizzaDraftSchema,
  drinkDraftSchema,
  z.object({
    kind: z.literal("COMBO"),
    productId: text(80),
    quantity: z.number().int().min(1).max(20),
    note: z.string().trim().max(240),
  }),
]);
export const productSchema = z
  .object({
    id: text(80).refine(
      (id) => id !== "NONE",
      "Identificador reservado para pizza sem borda.",
    ),
    name: text(80),
    description: z.string().max(240),
    category: categorySchema,
    pizzaGroup: pizzaGroupSchema.optional(),
    enabled: z.boolean(),
    photo: productPhotoSchema.nullable().optional(),
    prices: z.object({
      SMALL: moneySchema.positive(),
      MEDIUM: moneySchema.positive(),
      LARGE: moneySchema.positive(),
    }),
    combo: z.array(basicItemDraftSchema).min(2).max(6).optional(),
  })
  .superRefine((product, ctx) => {
    if ((product.category === "COMBO") !== (product.combo !== undefined))
      ctx.addIssue({
        code: "custom",
        message: "Cadastre de 2 a 6 itens na composição do combo.",
      });
    if (product.category !== "PIZZA" && product.pizzaGroup !== undefined)
      ctx.addIssue({
        code: "custom",
        message: "Tradicionais e especiais são grupos de pizzas.",
      });
    if (
      product.category !== "PIZZA" &&
      (product.prices.SMALL !== product.prices.MEDIUM ||
        product.prices.LARGE !== product.prices.MEDIUM)
    )
      ctx.addIssue({
        code: "custom",
        message: "Bordas, bebidas e combos têm preço único.",
      });
  });

export const componentSchema = z.object({
  name: text(180),
  detail: z.string().max(240),
  note: z.string().max(240),
  quantity: z.number().int().min(1).max(20),
});
export const itemSchema = componentSchema.extend({
  id: text(100),
  unitPrice: moneySchema.positive(),
  // Quantities in this immutable snapshot are per combo, multiplied only for production.
  components: z.array(componentSchema).min(2).max(6).optional(),
});
export type Product = z.infer<typeof productSchema>;
export type BasicItemDraft = z.infer<typeof basicItemDraftSchema>;
export type ItemDraft = z.infer<typeof itemDraftSchema>;
export type PricedItem = z.infer<typeof itemSchema>;
export type PizzaDraft = z.infer<typeof pizzaDraftSchema>;

export class DomainError extends Error {}
const requireThat: (ok: unknown, message: string) => asserts ok = (
  ok,
  message,
) => {
  if (!ok) throw new DomainError(message);
};

export function defaultCrustProducts(): Product[] {
  return [
    {
      id: "CREAM",
      name: "Borda de requeijão",
      description: "Requeijão cremoso na borda da pizza.",
    },
    {
      id: "CHEDDAR",
      name: "Borda de cheddar",
      description: "Cheddar cremoso na borda da pizza.",
    },
  ].map((crust) => ({
    ...crust,
    category: "CRUST",
    enabled: true,
    prices: { SMALL: 1000, MEDIUM: 1000, LARGE: 1000 },
  }));
}

export function resolveCrust(
  products: Product[],
  id: string,
  requireEnabled = true,
) {
  if (id === "NONE") return { name: "Sem borda recheada", price: 0 };
  const crust = products.find((p) => p.id === id && p.category === "CRUST");
  requireThat(crust, "Borda não encontrada. Revise os itens.");
  requireThat(
    !requireEnabled || crust.enabled,
    `Borda indisponível: ${crust.name}. Revise os itens.`,
  );
  return { name: crust.name, price: crust.prices.MEDIUM };
}

function priceBasicItem(
  products: Product[],
  item: BasicItemDraft,
  requireEnabled = true,
): PricedItem {
  basicItemDraftSchema.parse(item);
  if (item.kind === "DRINK") {
    const product = products.find(
      (p) => p.id === item.productId && p.category === "DRINK",
    );
    requireThat(product, "Bebida não encontrada. Revise os itens.");
    requireThat(
      !requireEnabled || product.enabled,
      `Bebida indisponível: ${product.name}. Revise os itens.`,
    );
    return {
      id: "",
      name: product.name,
      detail: product.description,
      note: "",
      quantity: item.quantity,
      unitPrice: product.prices.MEDIUM,
    };
  }
  requireThat(
    new Set(item.flavorIds).size === item.flavorIds.length,
    "Escolha um ou dois sabores diferentes.",
  );
  const flavors = item.flavorIds.map((id) => {
    const flavor = products.find((p) => p.id === id && p.category === "PIZZA");
    requireThat(flavor, "Sabor não encontrado. Revise os itens.");
    requireThat(
      !requireEnabled || flavor.enabled,
      `Sabor indisponível: ${flavor.name}. Revise os itens.`,
    );
    return flavor;
  });
  const crust = resolveCrust(products, item.crust, requireEnabled);
  return {
    id: "",
    name:
      flavors.length === 2
        ? flavors.map((p) => `½ ${p.name}`).join(" + ")
        : flavors[0].name,
    detail: `${sizeLabels[item.size]} · ${crust.name}`,
    note: item.note,
    quantity: item.quantity,
    unitPrice:
      Math.max(...flavors.map((p) => p.prices[item.size])) + crust.price,
  };
}

/** Resolve a fixed recipe from catalog IDs; nested combos are not accepted. */
export function comboComponents(
  products: Product[],
  product: Product,
  requireEnabled = false,
) {
  requireThat(
    product.category === "COMBO" && product.combo && product.combo.length >= 2,
    "Cadastre pelo menos dois itens no combo.",
  );
  return recipeComponents(products, product.combo, requireEnabled);
}

export function recipeComponents(
  products: Product[],
  items: BasicItemDraft[],
  requireEnabled = false,
) {
  return items.map((item) => {
    const priced = priceBasicItem(products, item, requireEnabled);
    return {
      name: priced.name,
      detail: priced.detail,
      note: priced.note,
      quantity: priced.quantity,
    };
  });
}

/** Current menu prices are only a comparison; they never replace a combo's saved price. */
export function comboPriceComparison(
  products: Product[],
  items: BasicItemDraft[],
  comboPrice: number,
) {
  const lines = items.map((item) => {
    const priced = priceBasicItem(products, item, false);
    return { ...priced, total: priced.unitPrice * item.quantity };
  });
  const individualTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const validPrice = moneySchema.positive().safeParse(comboPrice).success;
  const difference =
    validPrice && individualTotal > 0 ? individualTotal - comboPrice : null;
  return {
    lines,
    individualTotal,
    difference,
    discountRate:
      difference !== null && difference > 0 ? difference / individualTotal : 0,
  };
}

export function productUnavailableReason(
  products: Product[],
  product: Product,
): string | null {
  if (!product.enabled) return "Produto pausado";
  if (product.category === "COMBO") {
    try {
      comboComponents(products, product, true);
    } catch (error) {
      return error instanceof Error
        ? error.message
        : "Confira a composição do combo.";
    }
  }
  return null;
}

export function priceItems(
  products: Product[],
  items: ItemDraft[],
): PricedItem[] {
  return items.map((item, index) => {
    itemDraftSchema.parse(item);
    if (item.kind !== "COMBO")
      return { ...priceBasicItem(products, item), id: `item-${index}` };
    const combo = products.find(
      (p) => p.id === item.productId && p.category === "COMBO",
    );
    requireThat(combo, "Combo não encontrado. Revise os itens.");
    requireThat(combo.enabled, "Combo indisponível. Revise os itens.");
    return {
      id: `item-${index}`,
      name: combo.name,
      detail: combo.description,
      note: item.note,
      quantity: item.quantity,
      unitPrice: combo.prices.MEDIUM,
      components: comboComponents(products, combo, true),
    };
  });
}

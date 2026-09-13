import { describe, expect, it } from "vitest";
import { createDemo, sampleDraft } from "./demo";
import {
  applyCommand,
  migrateState,
  quoteOrder,
  stateSchema,
  type Product,
  type State,
} from "./model";
import {
  priceItems,
  productSchema,
  productUnavailableReason,
  type PizzaDraft,
} from "./catalog";
import { promotionUsage } from "./promotions";

const now = Date.UTC(2026, 8, 13, 22);
const pizza: PizzaDraft = {
  kind: "PIZZA",
  flavorIds: ["calabresa", "frango"],
  size: "LARGE",
  crust: "CREAM",
  quantity: 1,
  note: "Sem cebola",
};
const combo: Product = {
  id: "combo-teste",
  name: "Combo para dividir",
  description: "Pizza e duas bebidas.",
  category: "COMBO",
  enabled: true,
  prices: { SMALL: 8000, MEDIUM: 8000, LARGE: 8000 },
  combo: [pizza, { kind: "DRINK", productId: "refri", quantity: 2 }],
};
const addCombo = () =>
  applyCommand(createDemo(now), { type: "ADD_PRODUCT", product: combo }, now);
const edit = (state: State, id: string, changes: Partial<Product>) => {
  const previous = state.products.find((p) => p.id === id)!;
  return applyCommand(
    state,
    { type: "PRODUCT", previous, product: { ...previous, ...changes } },
    now,
  );
};

describe("Categorias, bordas e combos", () => {
  it("muda um sabor de tradicional para especial sem duplicar produto ou alterar pedidos", () => {
    const state = createDemo(now);
    const next = edit(state, "mussarela", { pizzaGroup: "SPECIAL" });
    expect(next.products.filter((p) => p.id === "mussarela")).toHaveLength(1);
    expect(next.products[0].pizzaGroup).toBe("SPECIAL");
    expect(next.orders).toEqual(state.orders);
    expect(() =>
      edit(next, "mussarela", {
        category: "DRINK",
        pizzaGroup: undefined,
        prices: { SMALL: 100, MEDIUM: 100, LARGE: 100 },
      }),
    ).toThrow(/categoria/);
  });
  it("borda cadastrada soma uma vez por pizza, muda só novos preços e pode ser pausada", () => {
    const state = applyCommand(
      createDemo(now),
      {
        type: "ADD_PRODUCT",
        product: {
          id: "borda-especial",
          name: "Borda especial",
          description: "",
          category: "CRUST",
          enabled: true,
          prices: { SMALL: 1500, MEDIUM: 1500, LARGE: 1500 },
        },
      },
      now,
    );
    const item = { ...pizza, crust: "borda-especial", quantity: 2 };
    expect(priceItems(state.products, [item])[0].unitPrice).toBe(8000);
    const changed = edit(state, "borda-especial", {
      prices: { SMALL: 1800, MEDIUM: 1800, LARGE: 1800 },
    });
    expect(priceItems(changed.products, [item])[0].unitPrice).toBe(8300);
    expect(changed.orders).toEqual(state.orders);
    const paused = edit(changed, "borda-especial", { enabled: false });
    expect(() => priceItems(paused.products, [item])).toThrow(
      /Borda indisponível/,
    );
    expect(() =>
      priceItems(paused.products, [{ ...item, crust: "refri" }]),
    ).toThrow(/Borda não encontrada/);
    expect(
      priceItems(paused.products, [{ ...item, crust: "NONE" }])[0].unitPrice,
    ).toBe(6500);
  });
  it("combo cobra o preço fechado e preserva quantidades, metades, borda e observações para produção", () => {
    const state = addCombo();
    const created = applyCommand(
      state,
      {
        type: "CREATE",
        draft: {
          ...sampleDraft(state),
          items: [
            {
              kind: "COMBO",
              productId: combo.id,
              quantity: 2,
              note: "Separar as bebidas",
            },
          ],
        },
      },
      now,
    );
    const order = created.orders[0];
    expect(order.total).toBe(16700);
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[0].note).toBe("Separar as bebidas");
    expect(order.items[0].components).toEqual([
      {
        name: "½ Calabresa + ½ Frango com requeijão",
        detail: "Grande · 8 fatias · Borda de requeijão",
        note: "Sem cebola",
        quantity: 1,
      },
      {
        name: "Refrigerante 2 L",
        detail: "Garrafa · sabor a conferir na expedição",
        note: "",
        quantity: 2,
      },
    ]);
    const changed = edit(
      edit(created, "calabresa", { name: "Outro nome", enabled: false }),
      combo.id,
      {
        name: "Nova oferta",
        prices: { SMALL: 9500, MEDIUM: 9500, LARGE: 9500 },
        combo: [
          { ...pizza, flavorIds: ["mussarela"] },
          { kind: "DRINK", productId: "agua", quantity: 1 },
        ],
      },
    );
    expect(changed.orders[0]).toEqual(order);
    expect(
      stateSchema.parse(JSON.parse(JSON.stringify(changed))).orders[0],
    ).toEqual(order);
  });
  it("pausar um componente bloqueia a venda do combo sem apagar sua receita e reativar restaura a disponibilidade", () => {
    const state = addCombo();
    for (const id of ["frango", "CREAM", "refri"]) {
      const paused = edit(state, id, { enabled: false });
      const product = paused.products.find((p) => p.id === combo.id)!;
      expect(product.enabled).toBe(true);
      expect(productUnavailableReason(paused.products, product)).toMatch(
        /indisponível/,
      );
      expect(() =>
        priceItems(paused.products, [
          { kind: "COMBO", productId: combo.id, quantity: 1, note: "" },
        ]),
      ).toThrow(/indisponível/);
      expect(
        productUnavailableReason(
          edit(paused, id, { enabled: true }).products,
          product,
        ),
      ).toBeNull();
    }
  });
  it("recusa receitas vazias, referências erradas, sabores repetidos e combos aninhados", () => {
    const state = createDemo(now);
    const recipes = [
      [],
      [pizza],
      [
        { ...pizza, flavorIds: ["calabresa", "calabresa"] },
        { kind: "DRINK", productId: "refri", quantity: 1 },
      ],
      [pizza, { kind: "DRINK", productId: "calabresa", quantity: 1 }],
      [
        pizza,
        { kind: "COMBO", productId: "combo-dupla", quantity: 1, note: "" },
      ],
    ];
    for (const recipe of recipes)
      expect(() =>
        applyCommand(
          state,
          {
            type: "ADD_PRODUCT",
            product: { ...combo, combo: recipe as Product["combo"] },
          },
          now,
        ),
      ).toThrow();
    expect(
      productSchema.safeParse({ ...combo, category: "DRINK" }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({
        ...state.products.find((p) => p.category === "CRUST"),
        prices: { SMALL: 1, MEDIUM: 2, LARGE: 3 },
      }).success,
    ).toBe(false);
  });
  it("exige rever a cotação se a composição muda mesmo mantendo o preço do combo", () => {
    const state = addCombo();
    const draft = {
      ...sampleDraft(state),
      items: [
        { kind: "COMBO" as const, productId: combo.id, quantity: 1, note: "" },
      ],
    };
    const quote = quoteOrder(state, draft, now);
    const changed = edit(state, combo.id, {
      combo: [
        { ...pizza, size: "SMALL" },
        { kind: "DRINK", productId: "refri", quantity: 2 },
      ],
    });
    expect(() =>
      applyCommand(
        changed,
        { type: "CREATE", draft, expectedQuote: quote.signature },
        now,
      ),
    ).toThrow(/mudou|mudaram|revise|Revise/);
    expect(changed.orders).toEqual(state.orders);
  });
  it("promoção atinge só pizzas avulsas, sem descontar combos, bebidas ou a borda", () => {
    const state = applyCommand(
      addCombo(),
      {
        type: "PROMOTION",
        expectedVersion: null,
        promotion: {
          id: "promo",
          version: 0,
          name: "Desconto avulso",
          kind: "FIXED",
          value: 1000,
          enabled: true,
          startsAt: now - 1000,
          endsAt: null,
          pizzaLimit: 10,
        },
      },
      now,
    );
    const draft = {
      ...sampleDraft(state),
      promotionId: "promo",
      items: [
        { kind: "COMBO" as const, productId: combo.id, quantity: 2, note: "" },
        pizza,
      ],
    };
    const quote = quoteOrder(state, draft, now);
    expect(quote.discount).toBe(1000);
    expect(quote.promotion?.pizzaQuantity).toBe(1);
    expect(quote.total).toBe(23200);
    const created = applyCommand(
      state,
      { type: "CREATE", draft, expectedQuote: quote.signature },
      now,
    );
    expect(promotionUsage(state.promotions[0], created.orders).reserved).toBe(
      1,
    );
    expect(() =>
      quoteOrder(state, { ...draft, items: [draft.items[0]] }, now),
    ).toThrow(/pizza elegível/);
  });
  it("migra o catálogo anterior preservando fotos, preços, promoções e pedidos; repetir a abertura é idempotente", () => {
    const state = createDemo(now);
    const oldProducts = state.products
      .filter((p) => ["PIZZA", "DRINK"].includes(p.category))
      .map(({ pizzaGroup, ...p }) => {
        void pizzaGroup;
        return p;
      });
    oldProducts[0].photo = "data:image/webp;base64,UklGRg==";
    oldProducts[0].prices.LARGE = 7777;
    const raw = { ...state, schema: 2, products: oldProducts };
    const before = structuredClone(raw);
    const upgraded = migrateState(raw);
    expect(upgraded.schema).toBe(3);
    expect(upgraded.orders).toEqual(state.orders);
    expect(upgraded.promotions).toEqual(state.promotions);
    expect(upgraded.products[0]).toMatchObject({
      ...oldProducts[0],
      pizzaGroup: "TRADITIONAL",
    });
    expect(
      upgraded.products.filter((p) => p.category === "CRUST"),
    ).toHaveLength(2);
    expect(migrateState(upgraded)).toEqual(upgraded);
    expect(raw).toEqual(before);
  });
  it("um catálogo antigo no limite de 100 produtos migra sem perder sabores", () => {
    const state = createDemo(now);
    const old = {
      ...state,
      schema: 2,
      products: Array.from({ length: 100 }, (_, i) => ({
        ...state.products[0],
        id: `antigo-${i}`,
        name: `Sabor ${i}`,
      })),
    };
    expect(migrateState(old).products).toHaveLength(102);
  });
});

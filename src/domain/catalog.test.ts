import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createDemo, sampleDraft } from "./demo";
import {
  applyCommand,
  migrateState,
  quoteOrder,
  stateSchema,
  type Product,
} from "./model";

const now = Date.UTC(2026, 8, 13, 22);
const photo = `data:image/webp;base64,${readFileSync(new URL("../../public/bonamassa-logo.webp", import.meta.url)).toString("base64")}`;
const flavor = (overrides: Partial<Product> = {}): Product => ({
  id: "pepperoni",
  name: "Pepperoni",
  description: "Mussarela e pepperoni.",
  category: "PIZZA",
  enabled: true,
  prices: { SMALL: 4200, MEDIUM: 5600, LARGE: 7200 },
  photo,
  ...overrides,
});

describe("Cadastro de sabores e fotos", () => {
  it("adiciona sabor com foto e calcula meia pizza sem alterar o histórico", () => {
    const before = createDemo(now);
    const state = applyCommand(
      before,
      { type: "ADD_PRODUCT", product: flavor() },
      now,
    );
    expect(state.products[0]).toEqual(flavor());
    expect(state.orders).toEqual(before.orders);
    expect(state.promotions).toEqual(before.promotions);
    expect(before.products).toHaveLength(11);
    const draft = {
      ...sampleDraft(state),
      items: [
        {
          kind: "PIZZA" as const,
          flavorIds: ["mussarela", "pepperoni"],
          size: "LARGE" as const,
          crust: "NONE" as const,
          quantity: 1,
          note: "",
        },
      ],
    };
    const quote = quoteOrder(state, draft, now);
    expect(quote.total).toBe(7900);
    expect(quote.items[0].name).toBe("½ Mussarela + ½ Pepperoni");
    expect(quote.items[0]).not.toHaveProperty("photo");
  });
  it("aceita foto opcional e sabor pausado, impedindo seu uso em novos pedidos", () => {
    const state = applyCommand(
      createDemo(now),
      { type: "ADD_PRODUCT", product: flavor({ photo: null, enabled: false }) },
      now,
    );
    expect(state.products[0].photo).toBeNull();
    const draft = sampleDraft(state);
    if (draft.items[0].kind === "PIZZA")
      draft.items[0].flavorIds = ["pepperoni"];
    expect(() => quoteOrder(state, draft, now)).toThrow(/indisponível/);
  });
  it("impede sobrescrever IDs e duplicar nomes com espaços, acentos ou caixa diferentes", () => {
    const state = applyCommand(
      createDemo(now),
      { type: "ADD_PRODUCT", product: flavor({ name: "Frango especial" }) },
      now,
    );
    expect(() =>
      applyCommand(state, { type: "ADD_PRODUCT", product: flavor() }, now),
    ).toThrow(/já foi cadastrado/);
    expect(() =>
      applyCommand(
        state,
        {
          type: "ADD_PRODUCT",
          product: flavor({ id: "outro", name: "  FRÂNGO   especial  " }),
        },
        now,
      ),
    ).toThrow(/Já existe/);
    expect(() =>
      applyCommand(
        state,
        {
          type: "PRODUCT",
          previous: state.products[1],
          product: { ...state.products[1], name: "Frango especial" },
        },
        now,
      ),
    ).toThrow(/Já existe/);
  });
  it("recusa nome vazio, preço não positivo e imagens fora do contrato local", () => {
    const state = createDemo(now);
    for (const product of [
      flavor({ name: "  " }),
      flavor({ prices: { SMALL: 0, MEDIUM: 1, LARGE: 2 } }),
      flavor({ photo: "https://exemplo.invalid/pizza.jpg" }),
      flavor({ photo: "data:image/svg+xml;base64,PHN2Zy8+" }),
      flavor({ photo: "data:image/webp;base64," + "A".repeat(300_000) }),
    ])
      expect(() =>
        applyCommand(state, { type: "ADD_PRODUCT", product }, now),
      ).toThrow();
    expect(state.products).toHaveLength(11);
  });
  it("respeita o limite de produtos sem impedir edição dos existentes", () => {
    const state = createDemo(now);
    state.products = Array.from({ length: 200 }, (_, i) =>
      flavor({ id: `sabor-${i}`, name: `Sabor ${i}`, photo: null }),
    );
    expect(() =>
      applyCommand(state, { type: "ADD_PRODUCT", product: flavor() }, now),
    ).toThrow(/200 produtos/);
    expect(
      applyCommand(
        state,
        {
          type: "PRODUCT",
          previous: state.products[0],
          product: { ...state.products[0], photo },
        },
        now,
      ).products[0].photo,
    ).toBe(photo);
  });
  it("foto pode ser removida sem mudar o preço e edição antiga não sobrescreve a nova", () => {
    const state = createDemo(now);
    const original = state.products[0];
    const withPhoto = applyCommand(
      state,
      { type: "PRODUCT", previous: original, product: { ...original, photo } },
      now,
    );
    expect(withPhoto.orders).toEqual(state.orders);
    expect(withPhoto.products[0].prices).toEqual(original.prices);
    expect(() =>
      applyCommand(
        withPhoto,
        {
          type: "PRODUCT",
          previous: original,
          product: { ...original, name: "Outro nome" },
        },
        now,
      ),
    ).toThrow(/outra tela/);
    const removed = applyCommand(
      withPhoto,
      {
        type: "PRODUCT",
        previous: withPhoto.products[0],
        product: { ...withPhoto.products[0], photo: null },
      },
      now,
    );
    expect(removed.products[0].photo).toBeNull();
    expect(removed.orders).toEqual(state.orders);
  });
  it("abre o schema atual sem migração destrutiva e preserva fotos no JSON", () => {
    const before = createDemo(now);
    expect(before.products[0]).not.toHaveProperty("photo");
    expect(migrateState(before)).toEqual(before);
    const state = applyCommand(
      before,
      { type: "ADD_PRODUCT", product: flavor() },
      now,
    );
    expect(stateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});

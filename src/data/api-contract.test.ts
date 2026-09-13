import { describe, expect, it } from "vitest";
import {
  catalogSchema,
  kitchenOrderSchema,
  mapState,
  versions,
} from "./api-contract";
import { promotionUsage } from "../domain/promotions";

const base = {
  store: {
    id: "store",
    slug: "bonamassa",
    name: "Bonamassa",
    open: true,
    deliveryFee: 700,
    driverFee: 800,
    version: 1,
  },
  products: [],
  promotions: [],
  serverTime: "2026-09-13T12:00:00.000Z",
};
describe("contratos da API", () => {
  it("aceita operação vazia sem inserir dados demonstrativos", () => {
    const state = mapState(catalogSchema.parse(base), [], [], 1);
    expect(state.products).toEqual([]);
    expect(state.orders).toEqual([]);
    expect(state.demoId).toBe("api:store");
  });
  it("usa cotas da API mesmo com histórico parcial e guarda a versão original do produto", () => {
    const state = mapState(
      catalogSchema.parse({
        ...base,
        products: [
          {
            id: "pizza",
            name: "Pizza",
            description: "",
            category: "PIZZA",
            pizzaGroup: "SPECIAL",
            enabled: true,
            prices: { SMALL: 4000, MEDIUM: 5000, LARGE: 6000 },
            imageId: "image",
            version: 7,
          },
        ],
        promotions: [
          {
            id: "promotion",
            name: "Oferta",
            version: 1,
            enabled: true,
            kind: "PERCENTAGE",
            value: 10,
            startsAt: base.serverTime,
            endsAt: null,
            pizzaLimit: 20,
            reserved: 4,
            sold: 12,
            remaining: 4,
            status: "ACTIVE",
          },
        ],
      }),
      [],
      [],
      1,
    );
    expect(promotionUsage(state.promotions[0], [])).toEqual({
      reserved: 4,
      sold: 12,
      remaining: 4,
    });
    expect(versions.get(state.products[0])).toEqual({
      version: 7,
      imageId: "image",
    });
    expect(state.products[0].photo).toBe("/api/images/image");
  });
  it("a projeção da cozinha não exige nem preserva dados pessoais ou financeiros", () => {
    const order = kitchenOrderSchema.parse({
      id: "order",
      number: 1000,
      version: 2,
      status: "CONFIRMED",
      deliveryStatus: null,
      mode: "PICKUP",
      note: "Sem cebola",
      createdAt: base.serverTime,
      updatedAt: base.serverTime,
      events: [],
      items: [
        {
          id: "item",
          name: "Pizza",
          detail: "Grande",
          note: "",
          quantity: 1,
          unitPrice: 6000,
        },
      ],
      customer: { name: "Pessoa", phone: "11999999999" },
      total: 6000,
      address: { street: "Rua" },
    });
    expect(order).not.toHaveProperty("customer");
    expect(order).not.toHaveProperty("total");
    expect(order).not.toHaveProperty("address");
    expect(order.items[0]).not.toHaveProperty("unitPrice");
  });
});

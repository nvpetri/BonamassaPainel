import { describe, expect, it } from "vitest";
import { createDemo } from "./demo";
import {
  comboPriceComparison,
  priceItems,
  type BasicItemDraft,
} from "./catalog";

describe("Comparação de preços do combo", () => {
  it("soma as quantidades com o maior sabor da meia pizza, uma borda por pizza e bebidas", () => {
    const products = createDemo().products;
    const recipe: BasicItemDraft[] = [
      {
        kind: "PIZZA",
        flavorIds: ["calabresa", "frango"],
        size: "MEDIUM",
        crust: "CREAM",
        quantity: 2,
        note: "",
      },
      { kind: "DRINK", productId: "refri", quantity: 2 },
    ];
    const result = comboPriceComparison(products, recipe, 13990);
    expect(result.lines.map((p) => p.total)).toEqual([13000, 2400]);
    expect(result.individualTotal).toBe(15400);
    expect(result.difference).toBe(1410);
    expect(result.discountRate).toBeCloseTo(1410 / 15400);
  });
  it("uma pizza inteira usa só seu sabor; preços iguais ou maiores não são anunciados como desconto", () => {
    const products = createDemo().products;
    const recipe: BasicItemDraft[] = [
      {
        kind: "PIZZA",
        flavorIds: ["calabresa"],
        size: "LARGE",
        crust: "NONE",
        quantity: 1,
        note: "",
      },
      { kind: "DRINK", productId: "refri", quantity: 1 },
    ];
    expect(comboPriceComparison(products, recipe, 6500)).toMatchObject({
      individualTotal: 7100,
      difference: 600,
    });
    expect(comboPriceComparison(products, recipe, 7100)).toMatchObject({
      difference: 0,
      discountRate: 0,
    });
    expect(comboPriceComparison(products, recipe, 8000)).toMatchObject({
      difference: -900,
      discountRate: 0,
    });
    for (const value of [0, -100, NaN, 10_000_001])
      expect(
        comboPriceComparison(products, recipe, value).difference,
      ).toBeNull();
    expect(comboPriceComparison(products, [], 5000)).toMatchObject({
      individualTotal: 0,
      difference: null,
      discountRate: 0,
    });
  });
  it("mudança no preço individual atualiza a referência sem reprecificar o combo", () => {
    const products = createDemo().products;
    const combo = products.find((p) => p.id === "combo-dupla")!;
    products.find((p) => p.id === "calabresa")!.prices.LARGE = 7000;
    const before = structuredClone(products);
    expect(
      comboPriceComparison(products, combo.combo!, combo.prices.MEDIUM),
    ).toMatchObject({ individualTotal: 8200, difference: 1700 });
    expect(
      priceItems(products, [
        { kind: "COMBO", productId: combo.id, quantity: 1, note: "" },
      ])[0].unitPrice,
    ).toBe(6500);
    expect(products).toEqual(before);
  });
  it("permite comparar a receita pausada no cadastro sem liberar sua venda", () => {
    const products = createDemo().products;
    const combo = products.find((p) => p.id === "combo-dupla")!;
    products.find((p) => p.id === "calabresa")!.enabled = false;
    expect(
      comboPriceComparison(products, combo.combo!, 6500).individualTotal,
    ).toBe(7100);
    expect(() =>
      priceItems(products, [
        { kind: "COMBO", productId: combo.id, quantity: 1, note: "" },
      ]),
    ).toThrow(/indisponível/);
  });
});

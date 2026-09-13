import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("bordas e bebidas cadastradas persistem e entram na montagem do pedido", async ({
  page,
}) => {
  await page.goto("/cardapio");
  const categories = page.getByRole("navigation", {
    name: "Categorias do cardápio",
  });
  await categories.getByRole("button", { name: /Bordas/ }).click();
  await page.getByRole("button", { name: "Nova borda", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome", { exact: true }).fill("Borda de chocolate");
  await form
    .getByLabel("Preço da borda por pizza", { exact: true })
    .fill("15,00");
  await form
    .getByRole("button", { name: "Cadastrar borda", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Borda de chocolate", exact: true }),
  ).toBeVisible();
  await categories.getByRole("button", { name: /Bebidas/ }).click();
  await page.getByRole("button", { name: "Nova bebida", exact: true }).click();
  await form.getByLabel("Nome", { exact: true }).fill("Suco de uva 1 L");
  await form.getByLabel("Preço por unidade", { exact: true }).fill("18,00");
  await form
    .getByRole("button", { name: "Cadastrar bebida", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Suco de uva 1 L", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Suco de uva 1 L", exact: true }),
  ).toBeVisible();
  await page.goto("/pedidos");
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  await form
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente categorias");
  await form
    .getByRole("button", { name: "Retirada na pizzaria", exact: true })
    .click();
  await form.getByLabel("Sabor principal").selectOption("mussarela");
  const crust = form.getByLabel("Borda", { exact: true });
  await crust.selectOption({ label: "Borda de chocolate + R$ 15,00" });
  await form
    .getByRole("button", { name: "Adicionar item", exact: true })
    .click();
  await form.getByRole("button", { name: "Bebida", exact: true }).click();
  await form
    .getByLabel("Bebida", { exact: true })
    .selectOption({ label: "Suco de uva 1 L · R$ 18,00" });
  await form
    .getByRole("button", { name: "Adicionar item", exact: true })
    .click();
  await expect(form.locator(".grand-total")).toContainText("88,00");
  await form.getByRole("button", { name: "Criar pedido", exact: true }).click();
  const order = page.getByTestId("order-1047");
  await expect(order).toContainText("Borda de chocolate");
  await expect(order).toContainText("Suco de uva 1 L");
  await expect(order).toContainText("88,00");
});

test("tradicionais e especiais filtram sabores, e meio a meio começa um pedido pelo maior preço", async ({
  page,
}) => {
  await page.goto("/cardapio");
  await page
    .getByRole("button", { name: "Editar Mussarela", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Grupo da pizza").selectOption("SPECIAL");
  await form
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Categorias do cardápio" })
    .getByRole("button", { name: /Pizzas/ })
    .click();
  await page.getByRole("button", { name: "Tradicionais", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mussarela", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Calabresa", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Especiais", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mussarela", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Meio a meio", exact: true }).click();
  await page.getByLabel("Sabor principal").selectOption("frango");
  await page.getByLabel("Segundo sabor").selectOption("quatro");
  await page.getByLabel("Borda", { exact: true }).selectOption("CREAM");
  await expect(page.locator(".half-pizza-price")).toContainText("85,00");
  await page
    .getByRole("button", { name: "Montar pedido com esta pizza" })
    .click();
  await expect(form.locator(".summary-item")).toContainText(
    "½ Frango com requeijão + ½ Quatro queijos",
  );
  await form
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente meio a meio");
  await form
    .getByRole("button", { name: "Retirada na pizzaria", exact: true })
    .click();
  await form.getByRole("button", { name: "Criar pedido", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.goto("/pedidos");
  await expect(page.getByTestId("order-1047")).toContainText("85,00");
});

test("combo com preço fechado chega completo à cozinha e pausar componente bloqueia novas vendas", async ({
  page,
  context,
}) => {
  await page.goto("/cardapio");
  await page
    .getByRole("navigation", { name: "Categorias do cardápio" })
    .getByRole("button", { name: /Combos/ })
    .click();
  await page.getByRole("button", { name: "Novo combo", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome", { exact: true }).fill("Combo do teste");
  await form.getByLabel("Preço do combo", { exact: true }).fill("80,00");
  await form
    .getByRole("button", { name: "Cadastrar combo", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("pelo menos dois itens");
  await form.getByLabel("Sabor principal").selectOption("mussarela");
  await form.getByLabel("Borda", { exact: true }).selectOption("CREAM");
  await form.getByLabel("Observação da pizza").fill("Sem cebola");
  await form
    .getByRole("button", { name: "Adicionar item", exact: true })
    .click();
  await form.getByRole("button", { name: "Bebida", exact: true }).click();
  await form.getByLabel("Bebida", { exact: true }).selectOption("refri");
  await form.getByLabel("Quantidade", { exact: true }).fill("2");
  await form
    .getByRole("button", { name: "Adicionar item", exact: true })
    .click();
  await form
    .getByRole("button", { name: "Cadastrar combo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Combo do teste", exact: true }),
  ).toBeVisible();
  await page.goto("/pedidos");
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  await form
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente combo");
  await form
    .getByLabel("Endereço de entrega", { exact: true })
    .fill("Praça da Sé, 1 · exemplo");
  await form.getByRole("button", { name: "Combo", exact: true }).click();
  const option = form
    .getByLabel("Combo", { exact: true })
    .getByRole("option")
    .filter({ hasText: "Combo do teste" });
  const id = (await option.getAttribute("value"))!;
  await form.getByLabel("Combo", { exact: true }).selectOption(id);
  await form.getByLabel("Quantidade", { exact: true }).fill("2");
  await form
    .getByRole("button", { name: "Adicionar item", exact: true })
    .click();
  await expect(form.locator(".grand-total")).toContainText("167,00");
  await expect(form.locator(".summary-item")).toContainText(
    "4× Refrigerante 2 L",
  );
  await form.getByRole("button", { name: "Criar pedido", exact: true }).click();
  await page
    .getByTestId("order-1047")
    .getByRole("button", { name: "Aceitar pedido", exact: true })
    .click();
  await page.goto("/cozinha");
  const order = page.getByTestId("order-1047");
  await expect(order).toContainText("2× Mussarela");
  await expect(order).toContainText("4× Refrigerante 2 L");
  await expect(order).toContainText("Sem cebola");
  await order.getByRole("button", { name: "Ver pedido 1047" }).click();
  await expect(form).toContainText("4× Refrigerante 2 L");
  const other = await context.newPage();
  await other.goto("/cardapio");
  await other
    .getByRole("switch", {
      name: "Disponibilidade de Borda de requeijão",
      exact: true,
    })
    .click();
  await expect(
    other.locator(".product-card").filter({
      has: other.getByRole("heading", {
        name: "Combo do teste",
        exact: true,
      }),
    }),
  ).toContainText("Borda indisponível");
  await expect(form).toContainText("4× Refrigerante 2 L");
  await other.goto("/pedidos");
  await other.getByRole("button", { name: "Novo pedido", exact: true }).click();
  await other.getByRole("button", { name: "Combo", exact: true }).click();
  await expect(
    other.getByLabel("Combo", { exact: true }).locator(`option[value="${id}"]`),
  ).toHaveJSProperty("disabled", true);
});

test("categorias, meio a meio e cadastro de combo ficam acessíveis no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cardapio");
  const categories = page.getByRole("navigation", {
    name: "Categorias do cardápio",
  });
  await expect(categories).toBeVisible();
  for (const stage of ["categories", "half", "combo"]) {
    if (stage === "half") {
      await categories.getByRole("button", { name: /Pizzas/ }).click();
      await page
        .getByRole("button", { name: "Meio a meio", exact: true })
        .click();
    }
    if (stage === "combo") {
      await categories.getByRole("button", { name: /Combos/ }).click();
      await page
        .getByRole("button", { name: "Novo combo", exact: true })
        .click();
    }
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (stage === "combo")
      expect(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
  }
});

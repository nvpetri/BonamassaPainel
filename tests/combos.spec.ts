import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("combo alterna inteira/meio a meio, calcula economia e preserva preço e receita dos pedidos anteriores", async ({
  page,
}) => {
  await page.goto("/cardapio");
  await page
    .getByRole("button", { name: "Editar Combo da casa", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await expect(form.locator(".combo-reference")).toContainText("71,00");
  await expect(form.locator(".combo-savings")).toContainText("6,00");
  await expect(form.locator(".combo-savings")).toContainText("8,45%");
  await form
    .getByRole("button", { name: "Editar item 1 do combo", exact: true })
    .click();
  const mode = form.getByRole("group", {
    name: "Formato da pizza",
    exact: true,
  });
  await expect(
    mode.getByRole("button", { name: /Pizza inteira/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(form.getByLabel("Segundo sabor")).toHaveCount(0);
  await mode.getByRole("button", { name: /Meio a meio/ }).click();
  await expect(
    form.getByRole("button", { name: "Atualizar item", exact: true }),
  ).toBeDisabled();
  await expect(
    form.getByRole("button", { name: "Salvar produto", exact: true }),
  ).toBeDisabled();
  await form.getByLabel("Segundo sabor").selectOption("frango");
  // Selecting the other half as the first flavor keeps half-and-half and requires a new second choice.
  await form.getByLabel("Sabor principal").selectOption("frango");
  await expect(
    mode.getByRole("button", { name: /Meio a meio/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    form.getByRole("button", { name: "Atualizar item", exact: true }),
  ).toBeDisabled();
  await form.getByLabel("Sabor principal").selectOption("calabresa");
  await form.getByLabel("Segundo sabor").selectOption("frango");
  await form.getByLabel("Borda", { exact: true }).selectOption("CREAM");
  await form.getByLabel("Quantidade", { exact: true }).fill("2");
  await form.getByLabel("Observação da pizza").fill("Sem cebola");
  await form
    .getByRole("button", { name: "Atualizar item", exact: true })
    .click();
  await expect(form.locator(".combo-editor-line")).toHaveCount(2);
  await expect(form.locator(".combo-reference")).toContainText("162,00");
  await expect(form.getByLabel("Preço do combo", { exact: true })).toHaveValue(
    "65,00",
  );
  await form.getByLabel("Preço do combo", { exact: true }).fill("135,00");
  await expect(form.locator(".combo-savings")).toContainText("27,00");
  await expect(form.locator(".combo-savings")).toContainText("16,67%");
  await form
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  await page.reload();
  const card = page
    .locator(".product-card")
    .filter({
      has: page.getByRole("heading", { name: "Combo da casa", exact: true }),
    });
  await expect(card).toContainText("135,00");
  await expect(card.locator(".combo-price-summary")).toContainText(
    "Economia de R$ 27,00",
  );
  await page.goto("/pedidos");
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  await form
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente combo com desconto");
  await form
    .getByLabel("Endereço de entrega", { exact: true })
    .fill("Rua de exemplo, 123");
  await form.getByRole("button", { name: "Combo", exact: true }).click();
  await form.getByLabel("Combo", { exact: true }).selectOption("combo-dupla");
  await form.getByLabel("Quantidade", { exact: true }).fill("2");
  await form
    .getByRole("button", { name: "Adicionar item", exact: true })
    .click();
  await expect(form.locator(".grand-total")).toContainText("277,00");
  await expect(form.locator(".summary-item")).toContainText(
    "4× ½ Calabresa + ½ Frango com requeijão",
  );
  await form.getByRole("button", { name: "Criar pedido", exact: true }).click();
  await expect(form).toHaveCount(0);

  await page.goto("/cardapio");
  await page
    .getByRole("button", { name: "Editar Combo da casa", exact: true })
    .click();
  await form
    .getByRole("button", { name: "Editar item 1 do combo", exact: true })
    .click();
  await expect(
    mode.getByRole("button", { name: /Meio a meio/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await mode.getByRole("button", { name: /Pizza inteira/ }).click();
  await expect(form.getByLabel("Segundo sabor")).toHaveCount(0);
  await form
    .getByRole("button", { name: "Atualizar item", exact: true })
    .click();
  await expect(form.locator(".combo-reference")).toContainText("150,00");
  await form.getByLabel("Preço do combo", { exact: true }).fill("140,00");
  await form
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  await page.goto("/pedidos");
  const previous = page.getByTestId("order-1047");
  await expect(previous).toContainText("277,00");
  await expect(previous).toContainText(
    "4× ½ Calabresa + ½ Frango com requeijão",
  );
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  await form.getByRole("button", { name: "Combo", exact: true }).click();
  await form.getByLabel("Combo", { exact: true }).selectOption("combo-dupla");
  await form
    .getByRole("button", { name: "Adicionar item", exact: true })
    .click();
  await expect(form.locator(".grand-total")).toContainText("147,00");
  await expect(form.locator(".summary-item")).toContainText("2× Calabresa");
  await expect(form.locator(".summary-item")).not.toContainText("½");
});

test("edição do combo valida preço, permite cancelar item e informa a diferença com acessibilidade no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cardapio");
  await page
    .getByRole("button", { name: "Editar Combo da casa", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Preço do combo", { exact: true }).fill("0,00");
  await form
    .getByRole("button", { name: "Salvar produto", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText(
    "preços maiores que zero",
  );
  await form.getByLabel("Preço do combo", { exact: true }).fill("80,00");
  await expect(form.locator(".combo-savings")).toContainText(
    "Acima dos preços individuais",
  );
  await expect(form.locator(".combo-savings")).toContainText("9,00");
  await form
    .getByRole("button", {
      name: "Usar preço dos itens separados",
      exact: true,
    })
    .click();
  await expect(form.getByLabel("Preço do combo", { exact: true })).toHaveValue(
    "71,00",
  );
  await expect(form.locator(".combo-savings")).toContainText("0,00");
  await form
    .getByRole("button", { name: "Editar item 1 do combo", exact: true })
    .click();
  await form
    .getByRole("group", { name: "Formato da pizza" })
    .getByRole("button", { name: /Meio a meio/ })
    .click();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ html: n.html, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  expect(await form.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await form
    .getByRole("button", { name: "Cancelar edição do item", exact: true })
    .click();
  await expect(form.locator(".combo-editor-line").first()).toContainText(
    "Pizza inteira",
  );
  await expect(form.locator(".combo-reference")).toContainText("71,00");
  await form.getByRole("button", { name: "Voltar", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Editar Combo da casa", exact: true })
    .click();
  await expect(form.getByLabel("Preço do combo", { exact: true })).toHaveValue(
    "65,00",
  );
});

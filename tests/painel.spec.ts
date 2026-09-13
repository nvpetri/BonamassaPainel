import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("pedido meia pizza percorre atendimento, cozinha, entrega e histórico", async ({
  page,
}) => {
  await page.goto("/pedidos");
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  const form = page.getByRole("dialog");
  await form
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente teste do fluxo");
  await form
    .getByLabel("Endereço de entrega", { exact: true })
    .fill("Praça da Sé, São Paulo · exemplo");
  await form.getByLabel("Sabor principal").selectOption("calabresa");
  await form.getByLabel("Segundo sabor").selectOption("frango");
  await form.getByLabel("Borda", { exact: true }).selectOption("CREAM");
  await form.getByLabel("Observação da pizza").fill("Sem cebola");
  await form.getByRole("button", { name: "Adicionar item" }).click();
  await form.getByRole("button", { name: "Bebida", exact: true }).click();
  await form.getByRole("button", { name: "Adicionar item" }).click();
  await form.getByLabel("Forma de pagamento").selectOption("CASH");
  await form.getByLabel("Precisa de troco").check();
  await form.getByLabel("Troco para", { exact: true }).fill("100,00");
  await expect(form.locator(".grand-total")).toContainText("94,00");
  await expect(form).toContainText("Troco: R$ 6,00");
  await form.getByRole("button", { name: "Criar pedido", exact: true }).click();
  const order = page.getByTestId("order-1047");
  await expect(order).toContainText("Cliente teste do fluxo");
  await order.getByRole("button", { name: "Aceitar pedido" }).click();
  await page.getByRole("link", { name: "Cozinha", exact: false }).click();
  await page
    .getByTestId("order-1047")
    .getByRole("button", { name: "Iniciar preparo" })
    .click();
  await page
    .getByTestId("order-1047")
    .getByRole("button", { name: "Marcar como pronto" })
    .click();
  await page.getByRole("link", { name: "Entregas", exact: true }).click();
  await page
    .getByTestId("order-1047")
    .getByRole("button", { name: "Atribuir entregador" })
    .click();
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Atribuir entregador" }).click();
  await detail.getByLabel("Entregador disponível").selectOption("driver-a");
  await detail.getByRole("button", { name: "Confirmar", exact: true }).click();
  await detail
    .getByRole("button", { name: "Simular retirada", exact: true })
    .click();
  await detail.getByRole("button", { name: "Confirmar", exact: true }).click();
  await detail
    .getByRole("button", { name: "Simular saída", exact: true })
    .click();
  await detail.getByRole("button", { name: "Confirmar", exact: true }).click();
  await detail
    .getByRole("button", { name: "Simular conclusão", exact: true })
    .click();
  await detail.getByLabel("Quem recebeu o pedido?").fill("Cliente teste");
  await detail.getByLabel(/Confirmo o recebimento/).check();
  await detail.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(detail.locator(".detail-status")).toContainText("Concluído");
  await detail.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByRole("link", { name: "Histórico", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Cliente teste do fluxo" }),
  ).toContainText("94,00");
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: "Cliente teste do fluxo" }),
  ).toContainText("Concluído");
});

test("duas abas compartilham cozinha e não perdem criações simultâneas", async ({
  page,
  context,
}) => {
  await page.goto("/pedidos");
  await expect(page.getByTestId("order-1043")).toBeVisible();
  const kitchen = await context.newPage();
  await kitchen.goto("/cozinha");
  await expect(
    kitchen.getByRole("heading", { name: "Cozinha", exact: true }),
  ).toBeVisible();
  await expect(kitchen.getByTestId("order-1043")).toHaveCount(0);
  await page
    .getByTestId("order-1043")
    .getByRole("button", { name: "Aceitar pedido" })
    .click();
  await expect(kitchen.getByTestId("order-1043")).toContainText("A preparar");
  await kitchen
    .getByTestId("order-1043")
    .getByRole("button", { name: "Iniciar preparo" })
    .click();
  await expect(page.getByTestId("order-1043")).toContainText("Em preparo");
  await kitchen.goto("/pedidos");
  await expect(
    kitchen.getByRole("button", { name: "Simular chegada" }),
  ).toBeEnabled();
  await Promise.all([
    page.getByRole("button", { name: "Simular chegada" }).click(),
    kitchen.getByRole("button", { name: "Simular chegada" }).click(),
  ]);
  await expect(page.getByTestId("order-1047")).toBeVisible();
  await expect(page.getByTestId("order-1048")).toBeVisible();
  await expect(kitchen.getByTestId("order-1048")).toBeVisible();
});

test("cancelamento e devolução permanecem separados de vendas concluídas", async ({
  page,
}) => {
  await page.goto("/pedidos");
  await page.getByRole("button", { name: "Ver pedido 1043" }).click();
  const detail = page.getByRole("dialog");
  await detail
    .getByRole("button", { name: "Cancelar pedido", exact: true })
    .click();
  await detail
    .getByLabel("Motivo", { exact: true })
    .fill("Cliente desistiu · exemplo");
  await detail.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(detail.locator(".detail-status")).toContainText("Cancelado");
  await detail.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByRole("button", { name: "Ver pedido 1045" }).click();
  await detail
    .getByRole("button", { name: "Registrar problema na entrega" })
    .click();
  await detail
    .getByLabel("Motivo", { exact: true })
    .fill("Cliente ausente · exemplo");
  await detail.getByRole("button", { name: "Confirmar", exact: true }).click();
  await detail
    .getByRole("button", { name: "Confirmar devolução", exact: true })
    .click();
  await detail.getByRole("button", { name: "Confirmar", exact: true }).click();
  await detail.getByRole("button", { name: "Fechar janela" }).click();
  await page.goto("/historico");
  await expect(
    page.getByRole("row").filter({ hasText: "#1043" }),
  ).toContainText("Cancelado");
  await expect(
    page.getByRole("row").filter({ hasText: "#1045" }),
  ).toContainText("Devolvido");
  await expect(page.locator(".history-summary")).toContainText(
    "1pedidos concluídos",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "bonamassa-historico-demo.csv",
  );
});

test("cardápio e pausa da loja persistem; erro de troco aparece dentro da janela", async ({
  page,
}) => {
  await page.goto("/cardapio");
  await page
    .getByRole("button", { name: "Editar Mussarela", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("Grande", { exact: true }).fill("60,50");
  await modal.getByRole("button", { name: "Salvar produto" }).click();
  await page.reload();
  await expect(
    page.locator(".product-card").filter({
      has: page.getByRole("heading", { name: "Mussarela", exact: true }),
    }),
  ).toContainText("60,50");
  await page
    .getByRole("switch", { name: "Disponibilidade de Mussarela", exact: true })
    .click();
  await page.goto("/pedidos");
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  await modal.getByLabel("Nome do cliente").fill("Teste dinheiro");
  await modal
    .getByLabel("Endereço de entrega")
    .fill("Praça da Sé, São Paulo · exemplo");
  await expect(
    modal
      .getByLabel("Sabor principal")
      .getByRole("option", { name: "Mussarela · indisponível" }),
  ).toHaveJSProperty("disabled", true);
  await modal.getByRole("button", { name: "Adicionar item" }).click();
  await modal.getByLabel("Forma de pagamento").selectOption("CASH");
  await modal.getByLabel("Precisa de troco").check();
  await modal.getByLabel("Troco para", { exact: true }).fill("1,00");
  await modal.getByRole("button", { name: "Criar pedido" }).click();
  await expect(modal.getByRole("alert")).toContainText("cobrir o total");
  await modal.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByRole("button", { name: "Loja aberta", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Novo pedido", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Loja pausada", exact: true }),
  ).toBeVisible();
});

test("dados inválidos não são substituídos silenciosamente", async ({
  page,
}) => {
  await page.goto("/pedidos");
  await expect(
    page.getByRole("heading", { name: "Pedidos", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("bonamassa-painel-demo", 2);
      request.onsuccess = () => {
        const database = request.result;
        const tx = database.transaction("state", "readwrite");
        tx.objectStore("state").put(
          { schema: 999, original: "preservar" },
          "snapshot",
        );
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vamos recuperar o painel" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Vamos recuperar o painel" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reiniciar demonstração", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apagar e reiniciar", exact: true })
    .click();
  await expect(page.getByTestId("order-1043")).toBeVisible();
});

test("telas desktop e celular sem transbordamento e sem violações WCAG A/AA detectadas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const section of [
    "pedidos",
    "cozinha",
    "entregas",
    "cardapio",
    "promocoes",
    "historico",
    "configuracoes",
  ]) {
    await page.goto(`/${section}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".workspace-footer")).toBeVisible();
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
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const section of [
    "pedidos",
    "cozinha",
    "entregas",
    "cardapio",
    "promocoes",
    "historico",
    "configuracoes",
  ]) {
    await page.goto(`/${section}`);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Pedidos", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pedidos", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.html),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

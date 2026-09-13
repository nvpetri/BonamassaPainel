import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createDemo } from "../src/domain/demo";
import type { State } from "../src/domain/model";

async function snapshot(page: Page): Promise<State> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("bonamassa-painel-demo");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("state", "readonly");
          const result = tx.objectStore("state").get("snapshot");
          tx.oncomplete = () => {
            db.close();
            resolve(result.result);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

async function createPromotion(
  page: Page,
  name = "Primeiras pizzas",
  limit = 2,
) {
  await page.goto("/promocoes");
  await page
    .getByRole("button", { name: "Nova promoção", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome da promoção").fill(name);
  await form.getByLabel("Tipo de desconto").selectOption("FIXED");
  await form
    .getByLabel("Desconto por pizza (R$)", { exact: true })
    .fill("10,00");
  await form.getByLabel("Por data e horário").uncheck();
  await form.getByLabel("Por quantidade de pizzas").check();
  await form
    .getByLabel("Limite de pizzas", { exact: true })
    .fill(String(limit));
  await form.getByRole("button", { name: "Salvar promoção" }).click();
  await expect(form).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: `Promoção ${name}`, exact: true }),
  ).toContainText("Ativa");
}

async function prepareOrder(page: Page, name: string, quantity = 1) {
  await page.goto("/pedidos");
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome do cliente").fill(name);
  await form
    .getByLabel("Endereço de entrega")
    .fill("Praça da Sé, São Paulo · exemplo");
  await form.getByLabel("Quantidade", { exact: true }).fill(String(quantity));
  await form.getByRole("button", { name: "Adicionar item" }).click();
  const option = form.getByLabel("Promoção do pedido").locator("option").nth(1);
  await form
    .getByLabel("Promoção do pedido")
    .selectOption((await option.getAttribute("value"))!);
  return form;
}

test("promoção por quantidade aplica desconto parcial, calcula troco, persiste e libera cota ao cancelar", async ({
  page,
}) => {
  await createPromotion(page);
  const form = await prepareOrder(page, "Cliente promoção", 3);
  await expect(form).toContainText("Desconto em 2 de 3 pizza(s)");
  await expect(form.locator(".grand-total")).toContainText("152,00");
  await form.getByLabel("Forma de pagamento").selectOption("CASH");
  await form.getByLabel("Precisa de troco").check();
  await form.getByLabel("Troco para", { exact: true }).fill("200,00");
  await expect(form).toContainText("Troco: R$ 48,00");
  await form.getByRole("button", { name: "Criar pedido" }).click();
  await expect(page.getByTestId("order-1047")).toContainText(
    "Primeiras pizzas",
  );
  await page.reload();
  await page.getByRole("button", { name: "Ver pedido 1047" }).click();
  await expect(
    page.getByRole("dialog").locator(".promotion-total"),
  ).toContainText("20,00");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar pedido", exact: true })
    .click();
  await page.getByLabel("Motivo", { exact: true }).fill("Cliente desistiu");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar janela" })
    .click();
  await page.goto("/promocoes");
  const card = page.getByRole("article", { name: "Promoção Primeiras pizzas" });
  await expect(card).toContainText("0 de 2 pizzas utilizadas");
  await expect(card).toContainText("Ativa");
  await card.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nome da promoção").fill("Oferta atualizada");
  await page
    .getByLabel("Desconto por pizza (R$)", { exact: true })
    .fill("15,00");
  await page.getByRole("button", { name: "Salvar promoção" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const data = await snapshot(page);
  expect(data.orders[0].promotion?.name).toBe("Primeiras pizzas");
  expect(data.orders[0].discount).toBe(2000);
  expect(data.promotions[0].value).toBe(1500);
});

test("duas abas disputam a última pizza sem ultrapassar o limite", async ({
  page,
  context,
}) => {
  await createPromotion(page, "Última pizza", 1);
  const first = await prepareOrder(page, "Cliente A");
  const other = await context.newPage();
  const second = await prepareOrder(other, "Cliente B");
  await expect(first.locator(".grand-total")).toContainText("52,00");
  await expect(second.locator(".grand-total")).toContainText("52,00");
  await Promise.all([
    first
      .getByRole("button", { name: "Criar pedido", exact: true })
      .evaluate((button: HTMLButtonElement) => button.click()),
    second
      .getByRole("button", { name: "Criar pedido", exact: true })
      .evaluate((button: HTMLButtonElement) => button.click()),
  ]);
  await expect
    .poll(
      async () =>
        (await snapshot(page)).orders.filter((o) => o.promotion).length,
    )
    .toBe(1);
  await expect.poll(async () => (await snapshot(page)).nextNumber).toBe(1048);
  const remaining = (await first.count()) ? first : second;
  await expect(
    remaining.getByRole("button", { name: "Criar pedido", exact: true }),
  ).toBeDisabled();
  await expect(remaining).toContainText(/limite atingido/i);
  await page.goto("/promocoes");
  await expect(
    page.getByRole("article", { name: "Promoção Última pizza" }),
  ).toContainText("1 de 1 pizzas utilizadas");
});

test("prazo termina com o formulário aberto e a oferta pode ser pausada", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-09-13T22:00:00Z") });
  await page.goto("/promocoes");
  await page
    .getByRole("button", { name: "Nova promoção", exact: true })
    .click();
  await page.getByLabel("Nome da promoção").fill("Oferta relâmpago");
  await page
    .getByLabel("Fim (Brasília)", { exact: true })
    .fill("2026-09-13T19:01");
  await page.getByRole("button", { name: "Salvar promoção" }).click();
  const card = page.getByRole("article", { name: "Promoção Oferta relâmpago" });
  await card.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(card).toContainText("Pausada");
  await card.getByRole("button", { name: "Habilitar", exact: true }).click();
  await expect(card).toContainText("Ativa");
  const form = await prepareOrder(page, "Cliente prazo");
  await expect(form.locator(".grand-total")).toContainText("53,75");
  await page.clock.fastForward(61_000);
  await expect(form).toContainText(/promoção encerrada/i);
  await expect(
    form.getByRole("button", { name: "Criar pedido" }),
  ).toBeDisabled();
  expect((await snapshot(page)).orders.filter((o) => o.promotion)).toHaveLength(
    0,
  );
  await form.getByLabel("Promoção do pedido").selectOption("");
  await expect(form.locator(".grand-total")).toContainText("62,00");
  await expect(
    form.getByRole("button", { name: "Criar pedido" }),
  ).toBeEnabled();
});

test("atualiza IndexedDB da versão anterior sem perder pedidos, preços e preferências", async ({
  page,
}) => {
  const data = createDemo(Date.now());
  data.storeOpen = false;
  data.settings.defaultFee = 1234;
  data.products[0].prices.LARGE = 6000;
  data.orders[0].customer = "Pedido anterior preservado";
  const legacy = {
    ...data,
    schema: 1,
    promotions: undefined,
    orders: data.orders.map((o) => {
      const { promotion, discount, ...old } = o;
      void promotion;
      void discount;
      return old;
    }),
  };
  await page.goto("/icon.svg");
  await page.evaluate(
    (raw) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("bonamassa-painel-demo", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("state");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("state", "readwrite");
          tx.objectStore("state").put(raw, "snapshot");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    legacy,
  );
  await page.goto("/pedidos");
  await expect(
    page.getByRole("button", { name: "Loja pausada", exact: true }),
  ).toBeVisible();
  const migrated = await snapshot(page);
  expect(migrated).toEqual(data);
  await page.goto("/promocoes");
  await expect(
    page.getByRole("button", { name: "Nova promoção", exact: true }),
  ).toBeVisible();
  expect(await snapshot(page)).toEqual(data);
});

test("cadastro e cartões de promoções acessíveis em desktop e celular", async ({
  page,
}) => {
  await createPromotion(page, "Noite da pizza", 50);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator(".promotion-card")).toBeVisible();
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
    await page
      .getByRole("button", { name: "Nova promoção", exact: true })
      .click();
    await page.getByLabel("Por quantidade de pizzas").check();
    const formAudit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      formAudit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          html: n.html,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
    expect(
      await page
        .getByRole("dialog")
        .evaluate((d) => d.scrollWidth <= d.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

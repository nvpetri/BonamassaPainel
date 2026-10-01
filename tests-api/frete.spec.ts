import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";

test("gerente configura endereço e cinco faixas; pedido manual revisa o frete real", async ({
  page,
  request,
}, info) => {
  const url = process.env.API_URL!;
  const session = await request.post(`${url}/v1/sessions`, {
    data: {
      storeSlug: "bonamassa",
      email: process.env.SEED_MANAGER_EMAIL,
      password: process.env.SEED_MANAGER_PASSWORD,
    },
  });
  expect(session.ok()).toBeTruthy();
  const headers = {
    Authorization: `Bearer ${(await session.json()).accessToken}`,
  };
  const original = (
    await (await request.get(`${url}/v1/staff/catalog`, { headers })).json()
  ).store;
  try {
    await page.goto("/configuracoes");
    await page
      .getByLabel("E-mail", { exact: true })
      .fill(process.env.SEED_MANAGER_EMAIL!);
    await page
      .getByLabel("Senha", { exact: true })
      .fill(process.env.SEED_MANAGER_PASSWORD!);
    await page
      .getByRole("button", { name: "Entrar no painel", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Editar operação", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Rua ou avenida", { exact: true })
      .fill("Rua de Teste");
    await dialog.getByLabel("Número", { exact: true }).fill("10");
    await dialog.getByLabel("Bairro", { exact: true }).fill("Centro");
    await dialog.getByLabel("Cidade", { exact: true }).fill("São Paulo");
    await dialog.getByLabel("UF", { exact: true }).fill("SP");
    await dialog.getByLabel("CEP", { exact: true }).fill("01001000");
    await dialog.getByLabel("Cobrança de entrega").selectOption("DISTANCE");
    for (let i = 1; i <= 5; i++) {
      await dialog
        .getByLabel(`Faixa ${i} · até (km)`, { exact: true })
        .fill(String(i * 2));
      await dialog
        .getByLabel(`Taxa da faixa ${i}`, { exact: true })
        .fill(`${i * 2 + 3},00`);
    }
    await dialog.getByLabel("Faixa 2 · até (km)", { exact: true }).fill("2");
    await dialog.getByRole("button", { name: "Salvar operação" }).click();
    await expect(dialog.getByRole("alert")).toContainText(
      /Informe cinco limites crescentes/,
    );
    await dialog.getByLabel("Faixa 2 · até (km)", { exact: true }).fill("4");
    expect(
      (
        await new AxeBuilder({ page })
          .include("dialog")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await dialog
      .getByLabel("Faixa 1 · até (km)", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("frete-cinco-faixas.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath("frete-celular.png") });
    await dialog.getByRole("button", { name: "Salvar operação" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver localização da pizzaria" }),
    ).toBeVisible();
    const configured = (
      await (await request.get(`${url}/v1/staff/catalog`, { headers })).json()
    ).store;
    expect(configured.deliveryBands).toHaveLength(5);
    expect(configured.address.number).toBe("10");
    expect(configured.deliveryPricingMode).toBe("DISTANCE");
    await page.goto("/pedidos");
    await page
      .getByRole("button", { name: "Novo pedido", exact: true })
      .click();
    await dialog.getByLabel("Nome do cliente").fill("Cliente frete");
    await dialog.getByLabel("Telefone com DDD").fill("11999999999");
    await dialog.getByLabel("Como vai receber?").selectOption("DELIVERY");
    await dialog.getByLabel("Rua / avenida").fill("Rua de Teste");
    await dialog.getByLabel("Número", { exact: true }).fill("20");
    await dialog.getByLabel("Bairro", { exact: true }).fill("Centro");
    await dialog.getByLabel("Cidade", { exact: true }).fill("São Paulo");
    await dialog.getByLabel("UF", { exact: true }).fill("SP");
    await dialog.getByLabel("CEP", { exact: true }).fill("01001000");
    await dialog.getByLabel("Sabor principal").selectOption("calabresa");
    await dialog
      .getByRole("button", { name: /Adicionar (pizza|ao pedido|item)/i })
      .click();
    await dialog.getByRole("button", { name: "Revisar pedido" }).click();
    await expect(
      dialog.getByRole("heading", { name: "Confirmar pedido" }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Entrega · 1 km", { exact: true }),
    ).toBeVisible();
    await expect(dialog.locator(".remote-totals")).toContainText("R$ 5,00");
    await page.screenshot({
      path: info.outputPath("pedido-frete-calculado.png"),
    });
    await page.keyboard.press("Escape");
  } finally {
    const current = (
      await (await request.get(`${url}/v1/staff/catalog`, { headers })).json()
    ).store;
    const response = await request.patch(`${url}/v1/staff/store`, {
      headers: { ...headers, "Idempotency-Key": randomUUID() },
      data: {
        expectedVersion: current.version,
        name: original.name,
        deliveryFee: original.deliveryFee,
        driverFee: original.driverFee,
        address: original.address,
        deliveryPricingMode: "FLAT",
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
});

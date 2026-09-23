import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { analyticsSchema, recentPeriod } from "../src/data/analytics-contract";
import { brl } from "../src/domain/model";

// Browser + BFF + Nest + PostgreSQL. Metrics are never supplied by a UI mock.
test("gerente acompanha vendas, filtra períodos e protege o dashboard", async ({
  page,
  request,
  browser,
}, testInfo) => {
  const url = process.env.API_URL!;
  const session = await request.post(`${url}/v1/sessions`, {
    data: {
      storeSlug: "bonamassa",
      email: process.env.SEED_MANAGER_EMAIL,
      password: process.env.SEED_MANAGER_PASSWORD,
    },
  });
  expect(session.ok()).toBeTruthy();
  const bearer = (await session.json()).accessToken;
  const headers = { Authorization: `Bearer ${bearer}` };
  async function command(path: string, data: unknown, method = "POST") {
    const response = await request.fetch(`${url}/v1/${path}`, {
      method,
      headers: { ...headers, "Idempotency-Key": randomUUID() },
      data,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }
  const catalog = await (
    await request.get(`${url}/v1/staff/catalog`, { headers })
  ).json();
  const store = catalog.store;
  await command(
    "staff/store",
    {
      expectedVersion: store.version,
      name: store.name,
      open: true,
      confirmEarlyOpen: true,
      deliveryFee: store.deliveryFee,
      driverFee: store.driverFee,
    },
    "PATCH",
  );
  const period = recentPeriod(Date.parse(catalog.serverTime), 1);
  const query = new URLSearchParams(period).toString();
  const metrics = async () => {
    const response = await request.get(`${url}/v1/staff/dashboard?${query}`, {
      headers,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return analyticsSchema.parse(await response.json());
  };
  const before = await metrics();
  const quote = await command("orders/quote", {
    items: [
      {
        kind: "PIZZA",
        flavorIds: ["calabresa", "frango"],
        size: "LARGE",
        crust: "NONE",
        quantity: 2,
        note: "",
      },
      { kind: "COMBO", productId: "combo-dupla", quantity: 2, note: "" },
    ],
    mode: "PICKUP",
    address: null,
    customer: { name: "Venda do dashboard", phone: "11999999999" },
    channel: "WHATSAPP",
    payment: "CARD",
    cashTendered: null,
    note: "",
    promotionId: null,
  });
  let order = await command("staff/orders", { quoteId: quote.quoteId });
  for (const action of ["accept", "prepare", "ready", "pickup-complete"]) {
    order = await command(`staff/orders/${order.id}/${action}`, {
      expectedVersion: order.version,
      ...(action === "pickup-complete"
        ? { recipient: "Cliente métricas", paymentCollected: true }
        : {}),
    });
  }
  const expected = await metrics();
  expect(expected.completedOrders).toBe(before.completedOrders + 1);
  expect(expected.sales.revenue).toBe(before.sales.revenue + order.total);
  expect(expected.pizzasSold).toBe(before.pizzasSold + quote.pizzaQuantity);
  expect(quote.pizzaQuantity).toBeGreaterThan(2);
  await page.goto("/dashboard");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.SEED_MANAGER_EMAIL!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.SEED_MANAGER_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("metric-revenue")).toHaveText(
    brl(expected.sales.revenue),
  );
  await expect(page.getByTestId("metric-pizzas")).toHaveText(
    expected.pizzasSold.toLocaleString("pt-BR"),
  );
  await expect(page.getByTestId("metric-received")).toHaveText(
    expected.receivedOrders.toLocaleString("pt-BR"),
  );
  for (const channel of expected.channels) {
    await expect(page.getByTestId(`channel-${channel.channel}`)).toContainText(
      brl(channel.revenue),
    );
  }
  expect(
    (
      await page.request.get(
        `/api/backend/staff/dashboard?${query}&storeId=other`,
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await new AxeBuilder({ page })
        .include("#main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "7 dias", exact: true }).click();
  await expect(page.getByTestId("metric-revenue")).toBeVisible();
  await page.getByRole("button", { name: "Pedidos", exact: true }).click();
  await expect(
    page.getByRole("img", { name: /Pedidos por dia/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Vendas", exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("dashboard-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("metric-revenue")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("dashboard-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(page.getByTestId("metric-revenue")).toHaveText(
    brl(expected.sales.revenue),
  );

  await test.step("falha de atualização preserva os últimos valores com aviso", async () => {
    await page.route("**/api/backend/staff/dashboard?**", (route) =>
      route.fulfill({
        status: 503,
        json: { message: "Falha temporária de teste" },
      }),
    );
    await page
      .getByRole("button", { name: "Atualizar dados", exact: true })
      .click();
    await expect(
      page.getByText(/Os valores abaixo são da última consulta/),
    ).toBeVisible();
    await expect(page.getByTestId("metric-revenue")).toHaveText(
      brl(expected.sales.revenue),
    );
    await page.unroute("**/api/backend/staff/dashboard?**");
    await page.getByRole("button", { name: "Recarregar métricas" }).click();
    await expect(
      page.getByText(/Os valores abaixo são da última consulta/),
    ).toHaveCount(0);
  });
  await test.step("período vazio, intervalo inválido e respostas fora de ordem", async () => {
    await page.getByLabel("De", { exact: true }).fill("2000-01-01");
    await page.getByLabel("Até", { exact: true }).fill("2000-01-02");
    await page.getByRole("button", { name: "Aplicar período" }).click();
    await expect(page.getByText(/Nenhum movimento no período/)).toBeVisible();
    await expect(page.getByTestId("metric-ticket")).toHaveText(brl(0));
    await page.getByLabel("De", { exact: true }).fill("2000-01-03");
    await page.getByRole("button", { name: "Aplicar período" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Escolha datas válidas",
    );
    await page.getByRole("button", { name: "Hoje", exact: true }).click();
    await expect(page.getByTestId("metric-revenue")).toHaveText(
      brl(expected.sales.revenue),
    );
    let release!: () => void, started!: () => void, done!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      started = resolve;
    });
    const finished = new Promise<void>((resolve) => {
      done = resolve;
    });
    await page.route(
      "**/api/backend/staff/dashboard?from=2000**",
      async (route) => {
        const response = await route.fetch();
        started();
        await held;
        await route.fulfill({ response });
        done();
      },
    );
    try {
      await page.getByLabel("De", { exact: true }).fill("2000-01-01");
      await page.getByLabel("Até", { exact: true }).fill("2000-01-02");
      await page.getByRole("button", { name: "Aplicar período" }).click();
      await waiting;
      await page.getByRole("button", { name: "Hoje", exact: true }).click();
      await expect(page.getByTestId("metric-revenue")).toHaveText(
        brl(expected.sales.revenue),
      );
      release();
      await finished;
      await expect(page.getByTestId("metric-revenue")).toHaveText(
        brl(expected.sales.revenue),
      );
    } finally {
      release();
      await page.unroute("**/api/backend/staff/dashboard?from=2000**");
    }
  });
  await test.step("atendente não vê a navegação nem recebe métricas pelo proxy", async () => {
    const email = `metrics-${randomUUID()}@teste.example`,
      password = "Equipe-metricas-password-2026";
    await command("staff/users", {
      email,
      password,
      name: "Atendimento métricas",
      phone: "11912345678",
      role: "ATTENDANT",
    });
    await request.post(`${url}/v1/auth/email-verification/request`, {
      data: { storeSlug: "bonamassa", email },
    });
    const verified = await request.post(
      `${url}/v1/auth/email-verification/confirm`,
      { data: { storeSlug: "bonamassa", email, code: "123456" } },
    );
    expect(verified.ok()).toBeTruthy();
    const context = await browser.newContext();
    try {
      const staff = await context.newPage();
      await staff.goto("http://127.0.0.1:3000/dashboard");
      await staff.getByLabel("E-mail", { exact: true }).fill(email);
      await staff.getByLabel("Senha", { exact: true }).fill(password);
      await staff.getByRole("button", { name: "Entrar no painel" }).click();
      await expect(staff.getByText("Conectado", { exact: true })).toBeVisible();
      await expect(
        staff.getByRole("link", { name: "Dashboard", exact: true }),
      ).toHaveCount(0);
      await expect(staff.getByTestId("metric-revenue")).toHaveCount(0);
      const forbidden = await context.request.get(
        `http://127.0.0.1:3000/api/backend/staff/dashboard?${query}`,
      );
      expect(forbidden.status()).toBe(403);
      expect(await forbidden.text()).not.toContain("revenue");
    } finally {
      await context.close();
    }
  });
});

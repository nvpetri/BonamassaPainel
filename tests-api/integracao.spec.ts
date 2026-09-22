import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

const url = process.env.API_URL || "http://127.0.0.1:3001";
const email = process.env.SEED_MANAGER_EMAIL!;
const password = process.env.SEED_MANAGER_PASSWORD!;
const staffPassword = "Equipe-somente-teste-2026";
async function login(page: Page, emailValue = email, passwordValue = password) {
  await page.goto("/pedidos");
  await page.getByLabel("E-mail", { exact: true }).fill(emailValue);
  await page.getByLabel("Senha", { exact: true }).fill(passwordValue);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByText("Conectado", { exact: true })).toBeVisible();
}
async function token(
  request: APIRequestContext,
  user = email,
  pass = password,
) {
  const response = await request.post(`${url}/v1/sessions`, {
    data: { storeSlug: "bonamassa", email: user, password: pass },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).accessToken as string;
}
async function verifyStaff(request: APIRequestContext, user: string) {
  await request.post(`${url}/v1/auth/email-verification/request`, {
    data: { storeSlug: "bonamassa", email: user },
  });
  const response = await request.post(`${url}/v1/auth/email-verification/confirm`, {
    data: { storeSlug: "bonamassa", email: user, code: "123456" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}
async function command(
  request: APIRequestContext,
  bearer: string,
  path: string,
  data: unknown,
  method = "POST",
) {
  const response = await request.fetch(`${url}/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Idempotency-Key": randomUUID(),
    },
    data,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function manual(
  page: Page,
  name: string,
  mode: "PICKUP" | "DELIVERY" = "PICKUP",
  promo?: string,
) {
  await page.goto("/pedidos");
  await expect(page.getByText("Conectado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do cliente").fill(name);
  await dialog.getByLabel("Telefone com DDD").fill("11999999999");
  await dialog.getByLabel("Como vai receber?").selectOption(mode);
  if (mode === "DELIVERY") {
    await dialog.getByLabel("Rua / avenida").fill("Rua de Teste");
    await dialog.getByLabel("Número", { exact: true }).fill("123");
    await dialog.getByLabel("Bairro", { exact: true }).fill("Centro");
    await dialog.getByLabel("Cidade", { exact: true }).fill("São Paulo");
    await dialog.getByLabel("UF", { exact: true }).fill("SP");
    await dialog.getByLabel("CEP", { exact: true }).fill("01001000");
  }
  await dialog.getByLabel("Sabor principal").selectOption("calabresa");
  await dialog
    .getByRole("button", { name: /Adicionar (pizza|ao pedido|item)/i })
    .click();
  if (promo)
    await dialog
      .getByLabel("Promoção", { exact: true })
      .selectOption({ label: promo });
  await dialog.getByRole("button", { name: "Revisar pedido" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Confirmar pedido" }),
  ).toBeVisible();
}

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    console.log(
      "Estado da interface no teste:",
      (await page.locator("body").innerText()).slice(-14000),
    );
});

test("gerente → pedido real → cozinha → entregador → histórico, com cotas, catálogo e recuperação", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await login(page);
  await expect(
    page.getByText("Tudo em dia por aqui", { exact: true }),
  ).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "bonamassa_panel")?.httpOnly).toBe(
    true,
  );
  expect(
    await page.evaluate(() => ({
      local: { ...localStorage },
      cookie: document.cookie,
    })),
  ).toEqual({ local: {}, cookie: "" });

  await test.step("cadastro da equipe pela interface", async () => {
    await page.getByRole("link", { name: "Configurações" }).click();
    for (const [role, name, address] of [
      ["KITCHEN", "Equipe Cozinha", "cozinha@teste.example"],
      ["DRIVER", "Equipe Entrega", "entrega@teste.example"],
      ["ATTENDANT", "Equipe Balcão", "balcao@teste.example"],
    ]) {
      await page.getByRole("button", { name: "Nova conta" }).click();
      const d = page.getByRole("dialog");
      await d.getByLabel("Nome", { exact: true }).fill(name);
      await d.getByLabel("E-mail", { exact: true }).fill(address);
      await d.getByLabel("Telefone com DDD").fill("11988888888");
      await d.getByLabel("Função").selectOption(role);
      await d.getByLabel("Senha inicial").fill(staffPassword);
      await d.getByRole("button", { name: "Criar conta" }).click();
      await expect(d).not.toBeVisible();
      await expect(page.getByText(address, { exact: true })).toBeVisible();
    }
  });
  await verifyStaff(request, "cozinha@teste.example");
  await verifyStaff(request, "entrega@teste.example");
  await verifyStaff(request, "balcao@teste.example");
  const bearer = await token(request);
  const driverBearer = await token(
    request,
    "entrega@teste.example",
    staffPassword,
  );

  await test.step("foto, sabor e edição de combo persistem na API", async () => {
    await page.getByRole("link", { name: "Cardápio" }).click();
    await page.getByRole("button", { name: "Novo sabor", exact: true }).click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Nome", { exact: true }).fill("Sabor integração");
    await form.getByLabel("Pequena", { exact: true }).fill("40,00");
    await form.getByLabel("Média", { exact: true }).fill("50,00");
    await form.getByLabel("Grande", { exact: true }).fill("60,00");
    const encoded = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 100;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#c75e2b";
      ctx.fillRect(0, 0, 100, 100);
      return c.toDataURL("image/png").split(",")[1];
    });
    await form.getByLabel("Selecionar foto", { exact: true }).setInputFiles({
      name: "pizza.png",
      mimeType: "image/png",
      buffer: Buffer.from(encoded, "base64"),
    });
    await expect(
      form.getByRole("button", { name: "Cadastrar sabor" }),
    ).toBeEnabled();
    await form.getByRole("button", { name: "Cadastrar sabor" }).click();
    await expect(form).not.toBeVisible();
    await page.reload();
    const photo = page.getByRole("img", {
      name: "Foto de Sabor integração",
      exact: true,
    });
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "Editar Combo da casa", exact: true })
      .click();
    await form
      .getByRole("button", { name: "Editar item 1 do combo", exact: true })
      .click();
    await form.getByRole("button", { name: /Pizza inteira/ }).click();
    await form.getByLabel("Sabor principal").selectOption("calabresa");
    await form
      .getByRole("button", { name: "Atualizar item", exact: true })
      .click();
    await form.getByLabel("Preço do combo", { exact: true }).fill("59,00");
    await form
      .getByRole("button", { name: "Salvar produto", exact: true })
      .click();
    await expect(form).not.toBeVisible();
    const catalog = await (
      await request.get(`${url}/v1/staff/catalog`, {
        headers: { Authorization: `Bearer ${bearer}` },
      })
    ).json();
    expect(
      catalog.products.find(
        (p: { name: string }) => p.name === "Sabor integração",
      ).imageId,
    ).toBeTruthy();
    const combo = catalog.products.find(
      (p: { id: string }) => p.id === "combo-dupla",
    );
    expect(combo.prices.MEDIUM).toBe(5900);
    expect(combo.combo[0].flavorIds).toEqual(["calabresa"]);
  });

  await test.step("promoção real por quantidade", async () => {
    await page.getByRole("link", { name: "Promoções" }).click();
    await page.getByRole("button", { name: "Nova promoção" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Nome da promoção").fill("Oferta integração");
    // Time limit is selected initially; add a quantity limit as well.
    await d
      .getByLabel(/Limitar.*quantidade|Quantidade de pizzas/i)
      .first()
      .check();
    await d.getByLabel(/Limite de pizzas|Quantas pizzas/i).fill("2");
    await d.getByRole("button", { name: "Salvar promoção" }).click();
    await expect(d).not.toBeVisible();
    await expect(
      page.getByRole("article", { name: "Promoção Oferta integração" }),
    ).toBeVisible();
  });
  const promoData = await (
    await request.get(`${url}/v1/staff/promotions`, {
      headers: { Authorization: `Bearer ${bearer}` },
    })
  ).json();
  const promo = promoData.find(
    (p: { name: string }) => p.name === "Oferta integração",
  );
  expect(promo.pizzaLimit).toBe(2);

  await test.step("revisão no servidor, aceite verde e cancelamento vermelho", async () => {
    await manual(
      page,
      "Cliente Integração",
      "DELIVERY",
      "Oferta integração · 2 disponíveis",
    );
    await expect(
      page.getByRole("dialog").getByText(/Oferta integração · 1 pizza/),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirmar pedido", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    const card = page
      .locator(".order-card")
      .filter({ hasText: "Cliente Integração" });
    await expect(
      card.getByRole("button", { name: "Aceitar pedido" }),
    ).toHaveClass(/success/);
    await expect(
      card.getByRole("button", { name: "Cancelar pedido" }),
    ).toHaveClass(/danger/);
    await card.getByRole("button", { name: "Aceitar pedido" }).click();
    await expect(card.getByText("A preparar", { exact: true })).toBeVisible();
  });
  const ordersResponse = await request.get(`${url}/v1/staff/orders`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const order = (await ordersResponse.json()).items.find(
    (o: { customer: { name: string } }) =>
      o.customer.name === "Cliente Integração",
  );
  expect(order.discount).toBe(825);
  expect(order.total).toBe(5375);

  const kitchenContext = await browser.newContext();
  const kitchen = await kitchenContext.newPage();
  await test.step("cozinha recebe somente produção e atualiza o gerente", async () => {
    await login(kitchen, "cozinha@teste.example", staffPassword);
    await expect(
      kitchen.getByRole("heading", { name: "Cozinha", exact: true }),
    ).toBeVisible();
    await expect(kitchen.getByText("Cliente Integração")).toHaveCount(0);
    await expect(kitchen.getByText("11999999999")).toHaveCount(0);
    await expect(
      kitchen.getByRole("link", { name: "Configurações" }),
    ).toHaveCount(0);
    const projection = await kitchen.request.get(
      "http://127.0.0.1:3000/api/backend/staff/orders",
    );
    const text = await projection.text();
    expect(text).not.toContain("Cliente Integração");
    expect(text).not.toContain("unitPrice");
    expect(text).not.toContain("subtotal");
    const card = kitchen.getByTestId(`kitchen-${order.number}`);
    await card.getByRole("button", { name: "Iniciar preparo" }).click();
    await card.getByRole("button", { name: "Marcar como pronto" }).click();
    await page.bringToFront();
    await expect(
      page
        .getByTestId(`order-${order.number}`)
        .getByText("Pronto", { exact: true }),
    ).toBeVisible();
  });
  await test.step("despacho e etapas reais do entregador", async () => {
    await page
      .getByTestId(`order-${order.number}`)
      .getByRole("button", { name: "Atribuir entregador" })
      .click();
    const d = page.getByRole("dialog");
    await d.getByRole("button", { name: "Atribuir entregador" }).click();
    await d
      .getByLabel("Entregador disponível")
      .selectOption({ label: "Equipe Entrega" });
    await d.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(
      d
        .locator(".detail-status")
        .getByText("Entregador atribuído", { exact: true }),
    ).toBeVisible();
    await expect(d.getByRole("button", { name: /Simular/ })).toHaveCount(0);
    let current = await (
      await request.get(`${url}/v1/staff/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${bearer}` },
      })
    ).json();
    current = await command(
      request,
      driverBearer,
      `driver/deliveries/${order.id}/collect`,
      { expectedVersion: current.version },
    );
    current = await command(
      request,
      driverBearer,
      `driver/deliveries/${order.id}/start`,
      { expectedVersion: current.version },
    );
    await command(
      request,
      driverBearer,
      `driver/deliveries/${order.id}/complete`,
      {
        expectedVersion: current.version,
        recipient: "Cliente Integração",
        paymentCollected: true,
      },
    );
    await d.getByRole("button", { name: "Fechar janela" }).click();
    await page.getByRole("link", { name: "Histórico" }).click();
    await expect(
      page.getByRole("button").filter({ hasText: "Cliente Integração" }),
    ).toContainText("Concluído");
    const list = await (
      await request.get(`${url}/v1/staff/promotions`, {
        headers: { Authorization: `Bearer ${bearer}` },
      })
    ).json();
    expect(list.find((p: { id: string }) => p.id === promo.id)).toMatchObject({
      sold: 1,
      reserved: 0,
      remaining: 1,
    });
  });

  await test.step("resposta perdida não duplica pedido após recarregar", async () => {
    await manual(page, "Pedido sem resposta");
    await page.route("**/api/backend/staff/orders", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fetch();
      await route.abort("failed");
    });
    await page
      .getByRole("button", { name: "Confirmar pedido", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Consultar operação pendente" }),
    ).toBeVisible();
    await page.unroute("**/api/backend/staff/orders");
    await page.reload();
    await page
      .getByRole("button", { name: "Consultar operação pendente" })
      .click();
    await expect(
      page.getByRole("button", { name: "Consultar operação pendente" }),
    ).not.toBeVisible();
    const response = await request.get(`${url}/v1/staff/orders`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    expect(
      (await response.json()).items.filter(
        (o: { customer: { name: string } }) =>
          o.customer.name === "Pedido sem resposta",
      ),
    ).toHaveLength(1);
  });
  await test.step("permissões e CSRF são preservados", async () => {
    const forbidden = await kitchen.request.get(
      "http://127.0.0.1:3000/api/backend/staff/catalog",
    );
    expect(forbidden.status()).toBe(403);
    const csrf = await page.request.post(
      "http://127.0.0.1:3000/api/backend/staff/orders",
      { headers: { Origin: "https://outside.test" }, data: { quoteId: "bad" } },
    );
    expect(csrf.status()).toBe(403);
    const attendantContext = await browser.newContext();
    const attendant = await attendantContext.newPage();
    await login(attendant, "balcao@teste.example", staffPassword);
    await expect(
      attendant.getByRole("link", { name: "Configurações" }),
    ).toHaveCount(0);
    await expect(
      attendant.getByRole("button", { name: "Cancelar pedido" }),
    ).toHaveCount(0);
    await attendantContext.close();
  });
  await test.step("horários, reserva e confirmação de abertura antecipada", async () => {
    const clock = (offset: number) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(Date.now() + offset * 60_000));
    await page.goto("/configuracoes");
    await page.getByRole("button", { name: "Configurar horários" }).click();
    const schedule = page.getByRole("dialog");
    await schedule.getByLabel("Abertura", { exact: true }).fill(clock(60));
    await schedule.getByLabel("Fechamento", { exact: true }).fill(clock(180));
    await schedule.getByRole("button", { name: "Salvar horários" }).click();
    await expect(schedule).not.toBeVisible();
    await page.goto("/pedidos");
    await expect(
      page.getByText("Loja fechada · Reservas abertas", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nova reserva", exact: true })
      .click();
    const reservation = page.getByRole("dialog");
    await reservation.getByLabel("Nome do cliente").fill("Reserva de teste");
    await reservation.getByLabel("Telefone com DDD").fill("11999999999");
    await reservation.getByLabel("Como vai receber?").selectOption("PICKUP");
    await reservation.getByLabel("Sabor principal").selectOption("calabresa");
    await reservation
      .getByRole("button", { name: /Adicionar (pizza|ao pedido|item)/i })
      .click();
    await reservation.getByRole("button", { name: "Revisar pedido" }).click();
    await expect(reservation.getByText(/Reserva para/)).toBeVisible();
    await reservation
      .getByRole("button", { name: "Confirmar reserva", exact: true })
      .click();
    await expect(reservation).not.toBeVisible();
    await page.reload();
    const card = page
      .locator(".order-card")
      .filter({ hasText: "Reserva de teste" });
    await expect(card.getByText("Agendado", { exact: true })).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Aceitar pedido" }),
    ).toHaveCount(0);
    const response = await request.get(
      `${url}/v1/staff/orders?status=SCHEDULED`,
      {
        headers: { Authorization: `Bearer ${bearer}` },
      },
    );
    const reserved = (await response.json()).items.find(
      (o: { customer: { name: string } }) =>
        o.customer.name === "Reserva de teste",
    );
    expect(reserved.scheduledFor).toBeTruthy();
    await kitchen.reload();
    await expect(kitchen.getByTestId(`order-${reserved.number}`)).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Loja pausada" }).click();
    const popup = page.getByRole("dialog", {
      name: "Abrir fora do horário programado?",
    });
    await expect(popup).toBeVisible();
    await popup.getByRole("button", { name: "Manter fechada" }).click();
    await expect(card.getByText("Agendado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Loja pausada" }).click();
    await popup.getByRole("button", { name: "Sim, abrir agora" }).click();
    await expect(popup).not.toBeVisible();
    await expect(
      card.getByRole("button", { name: "Aceitar pedido" }),
    ).toBeVisible();
    await expect(card).not.toHaveClass(/late/);
  });
  await test.step("complemento do aplicativo chega ao detalhe sem apagar referência", async () => {
    for (const complement of ["Bloco A, apto 12", ""]) {
      const quote = await command(request, bearer, "orders/quote", {
        items: [
          {
            kind: "PIZZA",
            flavorIds: ["calabresa"],
            size: "LARGE",
            crust: "NONE",
            quantity: 1,
            note: "",
          },
        ],
        mode: "DELIVERY",
        address: {
          street: "Rua de Teste",
          number: "10",
          neighborhood: "Centro",
          city: "São Paulo",
          state: "SP",
          postalCode: "01001000",
          reference: "Portão azul",
          complement,
          noComplement: !complement,
        },
        customer: { name: "Cliente Complemento", phone: "11999999999" },
        channel: "WHATSAPP",
        payment: "CARD",
        cashTendered: null,
        note: "",
        promotionId: null,
      });
      const created = await command(request, bearer, "staff/orders", {
        quoteId: quote.quoteId,
      });
      await page.goto("/pedidos");
      await page
        .getByRole("button", {
          name: `Ver pedido ${created.number}`,
          exact: true,
        })
        .click();
      const detail = page.getByRole("dialog");
      await expect(
        detail.getByText(
          complement ? `Complemento: ${complement}` : "Sem complemento",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        detail.getByText("Portão azul", { exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
  });
  await page.screenshot({
    path: "test-results/painel-api.png",
    fullPage: true,
  });
  await kitchen.screenshot({
    path: "test-results/cozinha-api.png",
    fullPage: true,
  });
  await kitchenContext.close();
  expect(browserErrors).toEqual([]);
});

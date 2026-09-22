import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { COOKIE, seal, unseal } from "../src/server/session";

test("equipe confirma e-mail, renova a sessão e recupera a senha pela interface", async ({
  page,
  request,
}) => {
  const url = process.env.API_URL!;
  const manager = await request.post(`${url}/v1/sessions`, {
    data: {
      storeSlug: "bonamassa",
      email: process.env.SEED_MANAGER_EMAIL,
      password: process.env.SEED_MANAGER_PASSWORD,
    },
  });
  expect(manager.ok()).toBeTruthy();
  const email = `auth-${randomUUID()}@teste.example`;
  const password = "Staff-initial-password-2026";
  const created = await request.post(`${url}/v1/staff/users`, {
    headers: {
      Authorization: `Bearer ${(await manager.json()).accessToken}`,
      "Idempotency-Key": randomUUID(),
    },
    data: {
      email,
      password,
      name: "Atendimento confirmação",
      phone: "11912345678",
      role: "ATTENDANT",
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  await page.goto("/pedidos");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirme seu e-mail." }),
  ).toBeVisible();
  await page.getByLabel("Código de 6 dígitos").fill("123456");
  await page
    .getByRole("button", { name: "Confirmar e-mail", exact: true })
    .click();
  await expect(page.getByText("Conectado", { exact: true })).toBeVisible();
  const original = (await page.context().cookies()).find(
    (cookie) => cookie.name === COOKIE,
  )!;
  const session = unseal(original.value)!;
  expect(session).toBeTruthy();
  for (const path of ["/api/session", "/api/backend/me"]) {
    // Simulate a browser returning near the original deadline while the API session is active.
    await page
      .context()
      .addCookies([
        {
          ...original,
          value: seal(session.token, Date.now() + 60_000),
          expires: Math.floor(Date.now() / 1000) + 60,
        },
      ]);
    const response = await page.request.get(path);
    expect(response.ok()).toBeTruthy();
    const renewed = (await page.context().cookies()).find(
      (cookie) => cookie.name === COOKIE,
    )!;
    expect(renewed.expires).toBeGreaterThan(Date.now() / 1000 + 4 * 86_400);
    expect(renewed.httpOnly).toBe(true);
    expect(unseal(renewed.value)?.token).toBe(session.token);
  }
  const other = await request.post(`${url}/v1/sessions`, {
    data: { storeSlug: "bonamassa", email, password },
  });
  expect(other.ok()).toBeTruthy();
  const otherToken = (await other.json()).accessToken;
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar no painel" }),
  ).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Esqueci minha senha" }).click();
  await page.getByRole("button", { name: "Enviar código" }).click();
  await expect(
    page.getByRole("heading", { name: "Crie uma nova senha." }),
  ).toBeVisible();
  await page.getByLabel("Código de 6 dígitos").fill("123456");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("Staff-new-password-2026");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar no painel" }),
  ).toBeVisible();
  expect(
    (
      await request.get(`${url}/v1/me`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      })
    ).status(),
  ).toBe(401);
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Staff-new-password-2026");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByText("Conectado", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.cookie)).not.toContain(COOKIE);
});

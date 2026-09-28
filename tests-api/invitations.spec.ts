import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { invitationLink } from "./invitation-helper";

test("gerente convida entregador e reenvia; funcionário completa o cadastro no celular", async ({
  page,
  request,
  browser,
}, testInfo) => {
  const email = `convite-${randomUUID()}@teste.example`;
  const password = "Entregador-convidado-2026";
  await page.goto("/configuracoes");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.SEED_MANAGER_EMAIL!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.SEED_MANAGER_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByText("Conectado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nova conta", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Nome", { exact: true })
    .fill("Entregador por convite");
  await modal.getByLabel("Função").selectOption("DRIVER");
  await modal.getByLabel("E-mail", { exact: true }).fill(email);
  await expect(modal.locator("input")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("convite-gerente.png"),
    fullPage: true,
  });
  await modal.getByRole("button", { name: "Enviar convite" }).click();
  await expect(modal).toHaveCount(0);
  const card = page.getByRole("article").filter({ hasText: email });
  await expect(card).toContainText("Cadastro pendente");
  const first = await invitationLink(request, email);
  await card.getByRole("button", { name: "Reenviar convite" }).click();
  await expect(
    page.getByText("Convite processado. Confira o status de envio na conta."),
  ).toBeVisible();
  const second = await invitationLink(request, email);
  expect(second).not.toBe(first);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const employee = await context.newPage();
    await employee.goto(first);
    await expect(
      employee.getByRole("alert").filter({ hasText: "Convite inválido" }),
    ).toBeVisible();
    await employee.goto(second);
    await expect(employee.getByText(email, { exact: true })).toBeVisible();
    await employee.getByLabel("Telefone com DDD").fill("11933334444");
    await employee.getByLabel("Crie sua senha").fill(password);
    await employee.getByLabel("Confirme a senha").fill("Outra-senha-diferente");
    await employee.getByRole("button", { name: "Concluir cadastro" }).click();
    await expect(
      employee.getByText("As senhas precisam ser iguais."),
    ).toBeVisible();
    await employee.getByLabel("Confirme a senha").fill(password);
    expect(
      (
        await new AxeBuilder({ page: employee })
          .include("main")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await employee.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await employee.screenshot({
      path: testInfo.outputPath("convite-celular.png"),
      fullPage: true,
    });
    await employee.getByRole("button", { name: "Concluir cadastro" }).click();
    await expect(
      employee.getByRole("heading", { name: "Cadastro concluído!" }),
    ).toBeVisible();
    await expect(
      employee.getByText("Bonamassa Entregador", { exact: true }),
    ).toBeVisible();
    expect(new URL(employee.url()).hash).toBe("");
    await employee.screenshot({
      path: testInfo.outputPath("convite-concluido.png"),
      fullPage: true,
    });
    await expect(card).toContainText("Ativo");
    await expect(
      card.getByRole("button", { name: "Reenviar convite" }),
    ).toHaveCount(0);
    const login = await request.post(`${process.env.API_URL}/v1/sessions`, {
      data: { storeSlug: "bonamassa", email, password },
    });
    expect(login.ok(), await login.text()).toBeTruthy();
    const result = await login.json();
    expect(result.user.role).toBe("DRIVER");
    expect(result.user.phone).toBe("11933334444");
    expect(result.user.emailVerified).toBe(true);
    await employee.goto(second);
    await expect(
      employee.getByRole("alert").filter({ hasText: "Convite inválido" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

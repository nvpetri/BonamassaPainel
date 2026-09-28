import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("gerente consulta alteração real e compara antes/depois na auditoria", async ({
  page,
}, testInfo) => {
  await page.goto("/configuracoes");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.SEED_MANAGER_EMAIL!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.SEED_MANAGER_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar operação", exact: true })
    .click();
  const name = page.getByLabel("Nome da pizzaria");
  const before = await name.inputValue();
  const after = "Bonamassa auditoria";
  await name.fill(after);
  await page.getByRole("button", { name: "Salvar operação" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Consultar auditoria" }).click();
  const audit = page.getByRole("region", { name: "Auditoria da operação" });
  await audit.getByLabel("Tabela", { exact: true }).selectOption("Store");
  await audit.getByLabel("Operação", { exact: true }).selectOption("UPDATE");
  await audit.getByRole("button", { name: "Consultar registros" }).click();
  await audit
    .getByRole("button", { name: /^Ver auditoria / })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(before);
  await expect(dialog).toContainText(after);
  await expect(dialog).toContainText("PANEL");
  await expect(dialog).toContainText("PATCH");
  await expect(dialog).toContainText("/v1/staff/store");
  await expect(
    dialog.getByRole("heading", { name: "name", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include("dialog")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("auditoria-celular.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Editar operação", exact: true })
    .click();
  await name.fill(before);
  await page.getByRole("button", { name: "Salvar operação" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

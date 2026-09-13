import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
          const value = tx.objectStore("state").get("snapshot");
          tx.oncomplete = () => {
            db.close();
            resolve(value.result);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

// Synthetic color tiles exercise file decoding without external assets or customer photos.
async function imageFile(page: Page, type = "image/png", color = "#d45036") {
  const encoded = await page.evaluate(
    ({ type, color }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1600;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#efc17a";
      ctx.fillRect(450, 300, 1500, 1000);
      return canvas.toDataURL(type).split(",")[1];
    },
    { type, color },
  );
  return {
    name: `foto.${type.split("/")[1]}`,
    mimeType: type,
    buffer: Buffer.from(encoded, "base64"),
  };
}

async function fillFlavor(page: Page, name = "Pepperoni") {
  const form = page.getByRole("dialog");
  await form.getByLabel("Nome", { exact: true }).fill(name);
  await form
    .getByLabel("Descrição", { exact: true })
    .fill("Mussarela, pepperoni e orégano.");
  await form.getByLabel("Pequena", { exact: true }).fill("42,00");
  await form.getByLabel("Média", { exact: true }).fill("56,00");
  await form.getByLabel("Grande", { exact: true }).fill("72,00");
  return form;
}

test("novo sabor com foto otimizada persiste e entra no cálculo de pedidos", async ({
  page,
}) => {
  await page.goto("/cardapio");
  await page.getByRole("button", { name: "Novo sabor", exact: true }).click();
  const form = await fillFlavor(page);
  const source = await imageFile(page);
  await form
    .getByLabel("Selecionar foto", { exact: true })
    .setInputFiles(source);
  await expect(
    form.getByRole("img", { name: "Prévia da foto do produto" }),
  ).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Cadastrar sabor", exact: true }),
  ).toBeEnabled();
  await form
    .getByRole("button", { name: "Cadastrar sabor", exact: true })
    .click();
  const card = page.locator(".product-card").filter({
    has: page.getByRole("heading", { name: "Pepperoni", exact: true }),
  });
  await expect(card).toContainText("72,00");
  const img = card.getByRole("img", { name: "Foto de Pepperoni", exact: true });
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBe(1200);
  const state = await snapshot(page);
  const flavor = state.products.find((p) => p.name === "Pepperoni")!;
  expect(flavor.photo).toMatch(/^data:image\/(webp|jpeg);base64,/);
  expect(
    Buffer.from(flavor.photo!.split(",")[1], "base64").length,
  ).toBeLessThanOrEqual(200 * 1024);
  await page.reload();
  await expect(img).toBeVisible();
  const oldVersion = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const request = indexedDB.open("bonamassa-painel-demo", 2);
        request.onerror = () => resolve(request.error!.name);
        request.onsuccess = () => {
          request.result.close();
          resolve("opened");
        };
      }),
  );
  expect(oldVersion).toBe("VersionError");
  expect(
    (await snapshot(page)).products.find((p) => p.id === flavor.id)!.photo,
  ).toBe(flavor.photo);
  await page.goto("/pedidos");
  await page.getByRole("button", { name: "Novo pedido", exact: true }).click();
  await page.getByLabel("Sabor principal").selectOption(flavor.id);
  await page.getByLabel("Segundo sabor").selectOption("mussarela");
  await page.getByRole("button", { name: "Adicionar item" }).click();
  await expect(page.getByRole("dialog").locator(".grand-total")).toContainText(
    "79,00",
  );
});

test("edição troca e remove foto; cancelar ou selecionar arquivo inválido preserva a anterior", async ({
  page,
}) => {
  await page.goto("/cardapio");
  await expect(
    page.getByRole("button", { name: "Editar Mussarela", exact: true }),
  ).toBeVisible();
  const before = await snapshot(page);
  await page
    .getByRole("button", { name: "Editar Mussarela", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await form
    .getByLabel("Selecionar foto", { exact: true })
    .setInputFiles(await imageFile(page, "image/jpeg"));
  await expect(
    form.getByRole("button", { name: "Salvar produto" }),
  ).toBeEnabled();
  await form.getByRole("button", { name: "Salvar produto" }).click();
  await expect(form).toHaveCount(0);
  const original = (await snapshot(page)).products.find(
    (p) => p.id === "mussarela",
  )!.photo;
  expect(original).toBeTruthy();
  await page
    .getByRole("button", { name: "Editar Mussarela", exact: true })
    .click();
  await form.getByLabel("Trocar foto", { exact: true }).setInputFiles({
    name: "foto.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(form.getByRole("alert")).toContainText("JPG, PNG ou WebP");
  await expect(form.getByRole("img")).toHaveAttribute("src", original!);
  await form.getByLabel("Trocar foto", { exact: true }).setInputFiles({
    name: "grande.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(form.getByRole("alert")).toContainText("até 10 MB");
  await form.getByLabel("Trocar foto", { exact: true }).setInputFiles({
    name: "quebrada.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([255, 216, 255, 0, 0, 0, 0]),
  });
  await expect(form.getByRole("alert")).toContainText("corrompido");
  await form
    .getByLabel("Trocar foto", { exact: true })
    .setInputFiles(await imageFile(page, "image/webp", "#284351"));
  await expect(
    form.getByRole("button", { name: "Salvar produto" }),
  ).toBeEnabled();
  await expect(form.getByRole("img")).not.toHaveAttribute("src", original!);
  await form.getByRole("button", { name: "Voltar", exact: true }).click();
  expect(
    (await snapshot(page)).products.find((p) => p.id === "mussarela")!.photo,
  ).toBe(original);
  await page
    .getByRole("button", { name: "Editar Mussarela", exact: true })
    .click();
  await form.getByRole("button", { name: "Remover foto" }).click();
  await form.getByRole("button", { name: "Salvar produto" }).click();
  await expect(form).toHaveCount(0);
  await page.reload();
  const after = await snapshot(page);
  expect(after.products.find((p) => p.id === "mussarela")!.photo).toBeNull();
  expect(after.orders).toEqual(before.orders);
  expect(after.products[0].prices).toEqual(before.products[0].prices);
});

test("cadastro valida duplicados e preços; sabor pausado pode ser ativado em outra aba", async ({
  page,
  context,
}) => {
  await page.goto("/cardapio");
  await page.getByRole("button", { name: "Novo sabor", exact: true }).click();
  const form = await fillFlavor(page, "  MUSSARELA  ");
  await form
    .getByRole("button", { name: "Cadastrar sabor", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("Já existe");
  await form.getByLabel("Nome", { exact: true }).fill("Sabor da casa");
  await form.getByLabel("Grande", { exact: true }).fill("0,00");
  await form
    .getByRole("button", { name: "Cadastrar sabor", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("maiores que zero");
  await form.getByLabel("Grande", { exact: true }).fill("72,00");
  await form
    .getByLabel("Disponível para novos pedidos", { exact: true })
    .uncheck();
  await form
    .getByRole("button", { name: "Cadastrar sabor", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  const other = await context.newPage();
  await other.goto("/cardapio");
  await expect(
    other.getByRole("heading", { name: "Sabor da casa", exact: true }),
  ).toBeVisible();
  await other
    .getByRole("switch", { name: "Disponibilidade de Sabor da casa" })
    .click();
  await expect(
    page.getByRole("switch", { name: "Disponibilidade de Sabor da casa" }),
  ).toHaveAttribute("aria-checked", "true");
  expect(
    (await snapshot(page)).products.filter((p) => p.name === "Sabor da casa"),
  ).toHaveLength(1);
});

test("seleção mais recente vence processamento atrasado e formulário é acessível no celular", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const decode = window.createImageBitmap.bind(window);
    let first = true;
    window.createImageBitmap = (async (...args: unknown[]) => {
      if (first) {
        first = false;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return Reflect.apply(decode, window, args);
    }) as typeof window.createImageBitmap;
  });
  await page.goto("/cardapio");
  const first = await imageFile(page, "image/png", "#d45036");
  const second = await imageFile(page, "image/png", "#284351");
  await page.getByRole("button", { name: "Novo sabor", exact: true }).click();
  const form = await fillFlavor(page, "Sabor com foto");
  await form
    .getByLabel("Selecionar foto", { exact: true })
    .setInputFiles(first);
  await expect(
    form.getByRole("button", { name: "Preparando foto…" }),
  ).toBeDisabled();
  await form
    .getByLabel("Selecionar foto", { exact: true })
    .setInputFiles(second);
  await expect(
    form.getByRole("button", { name: "Cadastrar sabor", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      form.getByRole("img").evaluate((img: HTMLImageElement) => {
        if (!img.naturalWidth) return "loading";
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        return pixel[2] > pixel[0] ? "second" : "first";
      }),
    )
    .toBe("second");
  const selected = await form.getByRole("img").getAttribute("src");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
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
    expect(await form.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
  }
  // The audits outlast the delayed decoder; the older file must not replace the latest one.
  await expect(form.getByRole("img")).toHaveAttribute("src", selected!);
  await form
    .getByRole("button", { name: "Cadastrar sabor", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

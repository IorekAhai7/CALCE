import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { localInput } from "../../src/modules/cases/dates";
const A = "10000000-0000-4000-a000-000000000001",
  B = "10000000-0000-4000-a000-000000000002";
const MA = "40000000-0000-4000-a000-000000000001";
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
async function login(page: Page, email = "admin.a@calce.test", firm = A) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("CalceDemo!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(`/app/${firm}`);
}
test("complete case journey, private download, collaborator, foreign account and logout", async ({
  page,
  browser,
}) => {
  await page.goto(`/app/${A}`);
  await expect(page).toHaveURL("/login");
  await login(page);
  const authCookies = (await page.context().cookies()).filter((c) =>
    c.name.startsWith("sb-"),
  );
  expect(authCookies.length).toBeGreaterThan(0);
  expect(authCookies.every((c) => c.httpOnly && c.sameSite === "Lax")).toBe(
    true,
  );
  await page.getByRole("link", { name: "Clientes", exact: true }).click();
  await page
    .getByLabel("Nombre del cliente", { exact: true })
    .fill("Cliente recorrido navegador");
  await page
    .getByLabel("Correo del cliente", { exact: true })
    .fill("navegador@calce.test");
  await page
    .getByRole("button", { name: "Crear cliente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Cliente recorrido navegador",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("Editar datos del cliente", { exact: true }).click();
  await page.getByLabel("Teléfono", { exact: true }).fill("5550000000");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByLabel("Teléfono", { exact: true })).toHaveValue(
    "5550000000",
  );
  await page
    .getByLabel("Nombre del asunto", { exact: true })
    .fill("Asunto recorrido navegador");
  await page
    .getByLabel("Abogado responsable", { exact: true })
    .selectOption({ label: "Abogado Demo A" });
  await page.getByRole("button", { name: "Crear asunto", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Asunto recorrido navegador",
      exact: true,
    }),
  ).toBeVisible();
  const matterUrl = new URL(page.url()).pathname;
  await page.getByText("Agendar evento", { exact: true }).click();
  await page
    .getByLabel("Nombre del evento", { exact: true })
    .fill("Audiencia navegador");
  await page
    .getByLabel("Fecha y hora del evento", { exact: true })
    .fill(localInput(new Date(Date.now() + 86400000), "America/Mexico_City"));
  await page.getByLabel("Lugar", { exact: true }).fill("Sede ficticia");
  await page
    .getByRole("button", { name: "Guardar evento", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Audiencia navegador", exact: true }),
  ).toBeVisible();
  await page.getByText("Cambiar fecha o cancelar", { exact: true }).click();
  await page
    .getByLabel("Nueva fecha y hora", { exact: true })
    .fill(localInput(new Date(Date.now() + 172800000), "America/Mexico_City"));
  await page
    .getByLabel("Motivo del cambio", { exact: true })
    .fill("Nueva fecha de prueba");
  await page.getByRole("button", { name: "Reprogramar", exact: true }).click();
  await expect(
    page.getByText(/Reprogramado:.*Nueva fecha de prueba/),
  ).toBeVisible();
  await page
    .getByLabel("Evento relacionado", { exact: true })
    .selectOption({ label: "Audiencia navegador" });
  await page
    .getByLabel("Cuándo ocurrió", { exact: true })
    .fill(localInput(new Date(Date.now() - 3600000), "America/Mexico_City"));
  await page
    .getByLabel("Resultado y notas", { exact: true })
    .fill("Resultado ficticio registrado desde navegador.");
  await page
    .getByLabel("Siguiente pendiente", { exact: true })
    .fill("Preparar siguiente escrito");
  await page
    .getByLabel("Fecha del siguiente pendiente", { exact: true })
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  await page
    .getByRole("button", { name: "Guardar resultado", exact: true })
    .click();
  await expect(
    page.getByText("Resultado ficticio registrado desde navegador.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Preparar siguiente escrito",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Archivo PDF o imagen (máximo 10 MB)", { exact: true })
    .setInputFiles({
      name: "bad.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("<html>wrong</html>"),
    });
  await page
    .getByRole("button", { name: "Subir documento", exact: true })
    .click();
  await expect(
    page.getByText(
      "El contenido no corresponde a un PDF, JPEG, PNG o WebP válido.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Archivo PDF o imagen (máximo 10 MB)", { exact: true })
    .setInputFiles({
      name: "prueba-navegador.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
  await page
    .getByRole("button", { name: "Subir documento", exact: true })
    .click();
  const downloadLink = page.getByRole("link", {
    name: "Descargar documento",
    exact: true,
  });
  await expect(downloadLink).toBeVisible();
  const docUrl = (await downloadLink.getAttribute("href"))!;
  const downloadPromise = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadPromise;
  expect(await readFile((await download.path())!)).toEqual(PDF);
  const colleague = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  const colleaguePage = await colleague.newPage();
  await login(colleaguePage, "lawyer.a@calce.test");
  await colleaguePage.goto(matterUrl);
  await expect(
    colleaguePage.getByRole("heading", {
      name: "Asunto recorrido navegador",
      exact: true,
    }),
  ).toBeVisible();
  expect((await colleague.request.get(docUrl)).status()).toBe(200);
  await colleague.close();
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const otherPage = await other.newPage();
  await login(otherPage, "admin.b@calce.test", B);
  await otherPage.goto(matterUrl);
  await expect(
    otherPage.getByRole("heading", {
      name: "Registro no disponible",
      exact: true,
    }),
  ).toBeVisible();
  expect((await other.request.get(docUrl)).status()).toBe(404);
  await other.close();
  await page.getByLabel("Nuevo estado", { exact: true }).selectOption("DONE");
  await page
    .getByRole("button", { name: "Actualizar pendiente", exact: true })
    .click();
  await expect(page.getByText(/Fecha:.*Completado/)).toBeVisible();
  await page.getByText("Archivar asunto", { exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar archivo", exact: true })
    .click();
  await expect(page.getByText(/Asunto archivado. Su historia/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Descargar documento", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reabrir asunto", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Guardar resultado", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/matter-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(page).toHaveURL("/login");
  await page.goto(matterUrl);
  await expect(page).toHaveURL("/login");
});
test("inactive membership cannot enter a firm", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("inactive.a@calce.test");
  await page.getByLabel("Contraseña").fill("CalceDemo!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sin acceso activo" }),
  ).toBeVisible();
  await page.goto(`/app/${A}`);
  await expect(
    page.getByRole("heading", { name: "Registro no disponible" }),
  ).toBeVisible();
});
test("mobile layout and forged session cookie", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "lawyer.a@calce.test");
  await page.goto(`/app/${A}/matters/${MA}`);
  await expect(
    page.getByRole("heading", { name: "Expediente demostración A" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/matter-mobile.png",
    fullPage: true,
  });
  const cookies = await page.context().cookies();
  await page
    .context()
    .addCookies(
      cookies
        .filter((c) => c.name.startsWith("sb-"))
        .map((c) => ({ ...c, value: "forged-session" })),
    );
  await page.goto(`/app/${A}`);
  await expect(page).toHaveURL("/login");
});

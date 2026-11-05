# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: inicio.spec.ts >> inicio completo, enlaces y contacto a 320px
- Location: e2e\inicio.spec.ts:11:3

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByRole('link', { name: /Cómo llegar/ })
Expected pattern: /query=Rostok%2C%20La%20Zona/
Received string:  "https://www.google.com/maps/search/?api=1&query=Silent%20Hill%2C%20Estados%20Unidos"
Timeout: 5000ms

Call log:
  - Expect "toHaveAttribute" getByRole('link', { name: /Cómo llegar/ }) with timeout 5000ms
  - waiting for getByRole('link', { name: /Cómo llegar/ })
    14 × locator resolved to <a tabindex="0" target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar a Silent Hill, Estados Unidos (abre en otra pestaña)" href="https://www.google.com/maps/search/?api=1&query=Silent%20Hill%2C%20Estados%20Unidos" class="MuiButtonBase-root MuiCardActionArea-root css-9a92m3-MuiButtonBase-root-MuiCardActionArea-root">…</a>
       - unexpected value "https://www.google.com/maps/search/?api=1&query=Silent%20Hill%2C%20Estados%20Unidos"

```

```yaml
- link "Cómo llegar a Silent Hill, Estados Unidos (abre en otra pestaña)":
  - /url: https://www.google.com/maps/search/?api=1&query=Silent%20Hill%2C%20Estados%20Unidos
  - heading "Cómo llegar" [level=3]
  - paragraph: Silent Hill, Estados Unidos
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.beforeEach(async ({ page }) => {
  4  |   await page.route('**/api/auth/get-session', route => route.fulfill({ json: null }));
  5  |   await page.route('**/api/especialidades?conMedicosActivos=true', route => route.fulfill({ json: { data:
  6  |     Array.from({ length: 7 }, (_, i) => ({ idEspecialidad: i + 1, descripcionEsp: `Especialidad ${i + 1}`, icono: 'corazon' }))
  7  |   } }));
  8  | });
  9  | 
  10 | for (const width of [320, 390, 1440]) {
  11 |   test(`inicio completo, enlaces y contacto a ${width}px`, async ({ page }, testInfo) => {
  12 |     await page.setViewportSize({ width, height: 900 });
  13 |     await page.goto('/');
  14 |     await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu próxima consulta, más simple.');
  15 |     const especialidades = page.getByRole('region', { name: 'Encontrá tu especialidad' });
  16 |     await expect(especialidades.getByRole('link', { name: /^Especialidad \d/ })).toHaveCount(6);
  17 |     await expect(especialidades.getByRole('link', { name: 'Especialidad 1', exact: true })).toHaveAttribute('href', '/especialidades/1/turnos');
  18 |     await expect(page.getByRole('link', { name: 'Reservar un turno', exact: true })).toHaveAttribute('href', '/reserva');
  19 |     await expect(page.getByRole('link', { name: 'Ver mis turnos', exact: true })).toHaveAttribute('href', '/mis-turnos?pendientes=1');
  20 |     const imagen = page.getByRole('img', { name: 'Raiden vestido de médico atiende a un paciente en el consultorio' });
  21 |     await expect(imagen).toBeVisible();
  22 |     await expect.poll(() => imagen.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
> 23 |     await expect(page.getByRole('link', { name: /Cómo llegar/ })).toHaveAttribute('href', /query=Rostok%2C%20La%20Zona/);
     |                                                                   ^ Error: expect(locator).toHaveAttribute(expected) failed
  24 |     await page.getByRole('button', { name: /Consultar por teléfono/ }).click();
  25 |     await expect(page.getByRole('dialog')).toContainText('011-0000-0000');
  26 |     await expect(page.getByRole('dialog')).toContainText('Número ficticio');
  27 |     await page.getByRole('button', { name: 'Cerrar contacto' }).click();
  28 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  29 |     await page.evaluate(() => window.scrollTo(0, 0));
  30 |     await page.screenshot({ path: testInfo.outputPath(`inicio-${width}.png`), fullPage: true });
  31 |   });
  32 | }
  33 | 
  34 | test('el inicio conserva los accesos cuando no hay especialidades o falla la carga', async ({ page }) => {
  35 |   await page.route('**/api/especialidades?conMedicosActivos=true', route => route.fulfill({ json: { data: [] } }));
  36 |   await page.goto('/');
  37 |   await expect(page.getByRole('alert')).toContainText('Por el momento no hay especialidades disponibles.');
  38 |   await page.route('**/api/especialidades?conMedicosActivos=true', route => route.fulfill({ status: 500, json: {} }));
  39 |   await page.reload();
  40 |   await expect(page.getByRole('alert')).toContainText('No pudimos cargar las especialidades.');
  41 |   await page.getByRole('link', { name: 'Reservar un turno', exact: true }).click();
  42 |   await expect(page).toHaveURL(/\/reserva$/);
  43 | });
  44 | 
```
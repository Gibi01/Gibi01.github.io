import { test, expect } from '@playwright/test';

const casos = [
  { tab: 'Especialidad', api: 'especialidades', campo: 'descripcionEsp', id: 'idEspecialidad', lista: 'Especialidades existentes', boton: 'Crear especialidad', etiqueta: 'Descripción' },
  { tab: 'Obra social', api: 'obras-sociales', campo: 'nombre', id: 'id', lista: 'Obras sociales existentes', boton: 'Crear obra social', etiqueta: 'Nombre' },
  { tab: 'Motivo de cancelación', api: 'motivos-cancelacion', campo: 'descripcion', id: 'id', lista: 'Motivos existentes', boton: 'Crear motivo', etiqueta: 'Descripción' },
];
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'test', role: 'admin' }, session: { id: 'test', userId: 'test', expiresAt: '2035-01-01' } } }));
  await page.route('**/api/usuarios/me', r => r.fulfill({ json: { data: { id: 1, nombre: 'Admin', apellido: 'Test', rol: 'admin' } } }));
  await page.route('**/api/especialidades', r => r.fulfill({ json: { data: [] } }));
});

for (const caso of casos) for (const width of [390, 1440]) {
  test(`${caso.tab} a ${width}px: lista, búsqueda, duplicado y creación`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const datos = ['Clínica médica', 'Registro A', 'Registro B', 'Registro C', 'Registro D', 'Registro E'].map((nombre, i) => ({ [caso.id]: i + 1, [caso.campo]: nombre, icono: 'medicina' }));
    let altas = 0;
    await page.route(`**/api/${caso.api}`, r => {
      if (r.request().method() === 'POST') {
        altas++;
        expect(r.request().postDataJSON()[caso.campo]).toBe('Nueva entidad');
        const nuevo = { [caso.id]: 99, ...r.request().postDataJSON() }; datos.push(nuevo);
        return r.fulfill({ status: 201, json: { data: nuevo } });
      }
      return r.fulfill({ json: { data: datos } });
    });
    await page.goto('/admin/carga');
    await page.getByRole('tab', { name: caso.tab, exact: true }).click();
    const listado = page.getByRole('region', { name: caso.lista });
    await expect(listado.getByText('1–5 de 6')).toBeVisible();
    await listado.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(listado.getByText('6–6 de 6')).toBeVisible();
    await page.getByLabel('Buscar en el listado').fill('CLINICA');
    await expect(listado.getByText('Clínica médica', { exact: true })).toBeVisible();
    await expect(listado.getByText('1–1 de 1')).toBeVisible();
    const entrada = page.getByRole('textbox', { name: caso.etiqueta, exact: true });
    await entrada.fill('  clinica   medica ');
    await expect(page.getByText('Ya existe «Clínica médica».')).toBeVisible();
    await expect(page.getByRole('button', { name: caso.boton, exact: true })).toBeDisabled();
    expect(altas).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('catalogo.png'), fullPage: true, animations: 'disabled' });
    await entrada.fill('nueva entidad');
    await expect(entrada).toHaveValue('Nueva entidad');
    await page.getByRole('button', { name: caso.boton, exact: true }).click();
    await expect(page.getByText('Se creó «Nueva entidad».')).toBeVisible();
    await expect(listado.getByText('Nueva entidad', { exact: true })).toBeVisible();
    expect(altas).toBe(1);
    await entrada.fill('NUEVA ENTIDAD');
    await expect(page.getByRole('button', { name: caso.boton, exact: true })).toBeDisabled();
  });
}

test('impide crear sin listado y permite recuperarse del error', async ({ page }) => {
  let falla = true;
  await page.route('**/api/obras-sociales', r => r.fulfill(falla ? { status: 500, json: { message: 'Fallo' } } : { json: { data: [] } }));
  await page.goto('/admin/carga');
  await page.getByRole('tab', { name: 'Obra social', exact: true }).click();
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('OSDE');
  await expect(page.getByRole('button', { name: 'Crear obra social' })).toBeDisabled();
  falla = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByText('Todavía no hay registros.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear obra social' })).toBeEnabled();
});

import { test, expect } from '@playwright/test';
import { iconosEspecialidad } from '../src/iconosEspecialidad';
import { catalogoEspecialidades } from '../../backend-dsw/src/recursos/especialidad/catalogo';

test('los 50 iconos coinciden con el backend y sus SVG están disponibles', async ({ request }) => {
  expect(iconosEspecialidad.slice(1)).toEqual(catalogoEspecialidades);
  for (const icono of iconosEspecialidad) {
    const respuesta = await request.get(`/iconos-especialidades/${icono.archivo}`);
    expect(respuesta.ok()).toBe(true);
    expect(respuesta.headers()['content-type']).toContain('image/svg+xml');
    expect(await respuesta.text()).toContain('<svg');
  }
});

test('el admin crea y edita un icono que se refleja en la tarjeta pública', async ({ page }, testInfo) => {
  const user = { id: 'admin-iconos', name: 'Admin', email: 'iconos@example.com', role: 'admin' };
  await page.route('**/api/auth/get-session', route => route.fulfill({ json: { user,
    session: { id: 'sesion-iconos', userId: user.id, expiresAt: new Date(Date.now() + 86400000).toISOString() } } }));
  await page.route('**/api/usuarios/me', route => route.fulfill({ json: { data: { id: 1, nombre: 'Admin', apellido: 'Test', email: user.email, rol: 'admin' } } }));
  await page.route('**/api/doctores', route => route.fulfill({ json: { data: [] } }));
  let especialidad = { idEspecialidad: 81, descripcionEsp: 'Cardiología', icono: 'medicina' };
  let creada = false;
  await page.route('**/api/especialidades{,?conMedicosActivos=true}', route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ descripcionEsp: 'Cardiología', icono: 'corazon' });
      especialidad = { ...especialidad, ...route.request().postDataJSON() }; creada = true;
      return route.fulfill({ status: 201, json: { data: especialidad } });
    }
    return route.fulfill({ json: { data: creada ? [especialidad] : [] } });
  });
  await page.route('**/api/especialidades/81', route => {
    expect(route.request().postDataJSON().icono).toBe('ojo');
    especialidad = { ...especialidad, ...route.request().postDataJSON() };
    return route.fulfill({ json: { data: especialidad } });
  });
  await page.goto('/admin/carga');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Buscar icono por especialidad').fill('genetica');
  await page.getByRole('radio', { name: 'Genética médica', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Genética médica', exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel('Buscar icono por especialidad').fill('');
  await page.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Cardiología');
  await page.getByRole('radio', { name: 'Cardiología', exact: true }).check();
  await page.screenshot({ path: testInfo.outputPath('admin-selector-icono.png'), fullPage: true });
  await page.getByRole('button', { name: 'Crear especialidad', exact: true }).click();
  await expect(page.getByText('Se creó «Cardiología».')).toBeVisible();
  await page.goto('/especialidades');
  await expect(page.getByRole('button', { name: 'Cardiología' }).locator('[data-icono="corazon"]')).toBeVisible();
  await page.goto('/admin/modificar');
  await page.getByRole('button', { name: 'Editar Cardiología' }).click();
  await expect(page.getByRole('radio', { name: 'Cardiología', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Oftalmología', exact: true }).check();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/especialidades');
  await expect(page.getByRole('button', { name: 'Cardiología' }).locator('[data-icono="ojo"]')).toBeVisible();
});

for (const width of [320, 390, 1280]) {
  test(`pantallas públicas sin desbordamiento a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/get-session', route => route.fulfill({ json: null }));
    await page.route('**/api/especialidades{,?conMedicosActivos=true}', route => route.fulfill({ json: { data: [
      { idEspecialidad: 1, descripcionEsp: 'Cardiología', icono: 'corazon' },
      { idEspecialidad: 2, descripcionEsp: 'Clínica médica' },
    ] } }));
    await page.route('**/api/turnos/**', route => route.fulfill({ json: { data: [] } }));
    const errores: string[] = [];
    page.on('pageerror', e => errores.push(e.message));
    for (const [ruta, nombre] of [['/', 'inicio'], ['/especialidades', 'especialidades'], ['/especialidades/1/turnos', 'reserva']]) {
      await page.goto(ruta);
      if (nombre !== 'inicio') await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('banner')).toBeVisible();
      if (nombre === 'reserva') await expect(page.getByRole('alert')).toContainText('No hay turnos');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${nombre}-${width}.png`), fullPage: true });
    }
    expect(errores).toEqual([]);
  });
}

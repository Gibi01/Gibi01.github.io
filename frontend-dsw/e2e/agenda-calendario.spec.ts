import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => { page.on('pageerror', error => console.error('BROWSER:', error.message)); page.on('console', msg => { if (msg.type() === 'error') console.error('CONSOLE:', msg.text()); }); });
async function preparar(page: Page, rol: 'doctor' | 'admin') {
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'test', role: rol }, session: { id: 'sesion', userId: 'test', expiresAt: '2035-01-01' } } }));
  await page.route('**/api/usuarios/me', r => r.fulfill({ json: { data: { id: 1, nombre: 'Ana', apellido: 'Test', rol } } }));
  const doc = { matricula: 700011, nombre: 'Laura', apellido: 'Méndez', activo: true };
  await page.route('**/api/doctores/mios', r => r.fulfill({ json: { data: doc } }));
  await page.route('**/api/doctores', r => r.fulfill({ json: { data: [doc] } }));
}
for (const rol of ['doctor', 'admin'] as const) {
  for (const width of [390, 1440]) {
    test(`editor ${rol} a ${width}px: bloque nocturno y confirmación`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 }); await preparar(page, rol);
      let guardado = false;
      const semana = { version: 0, activo: true, bloques: [] as unknown[], sinDuracion: [] };
      await page.route('**/api/agendas/semanal/700011', r => {
        if (r.request().method() === 'PUT') {
          const data = r.request().postDataJSON();
          expect(data.bloques[0].terminaDiaSiguiente).toBe(true);
          expect(data.aceptarExcepciones).toBe(true);
          guardado = true; semana.bloques = data.bloques; semana.version++;
        }
        return r.fulfill({ json: { data: semana } });
      });
      await page.route('**/api/agendas/semanal/700011/previsualizar', r => r.fulfill({ json: { data: { token: 'revision', version: 0, excepciones: [{ id: 1, fechaHoraTurno: '2030-11-04T12:00:00Z', duracionTurnoMinutos: 30 }] } } }));
      await page.goto(rol === 'doctor' ? '/mi-agenda' : '/admin/agendas');
      if (rol === 'admin') { await page.getByRole('combobox').fill('Laura'); await page.getByRole('option', { name: /Laura/ }).click(); }
      await page.getByRole('button', { name: 'Agregar bloque', exact: true }).click();
      await page.getByLabel('Inicio', { exact: true }).fill('22:00');
      await page.getByLabel('Fin', { exact: true }).fill('02:00');
      await page.getByRole('checkbox', { name: 'Finaliza al día siguiente' }).check();
      await page.getByRole('button', { name: 'Aplicar al borrador' }).click();
      await expect(page.getByText('Cambios sin guardar.', { exact: false })).toBeVisible();
      await page.getByRole('button', { name: 'Revisar y guardar semana' }).click();
      await expect(page.getByRole('button', { name: 'Confirmar agenda' })).toBeDisabled();
      await page.getByRole('checkbox', { name: /Confirmo que se atenderán/ }).check();
      await page.getByRole('button', { name: 'Confirmar agenda' }).click();
      await expect(page.getByText('Agenda guardada.', { exact: false })).toBeVisible(); expect(guardado).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath('agenda.png'), fullPage: true, animations: 'disabled' });
    });
  }
}

test('arrastrar y redimensionar proponen cambios sin guardar automáticamente', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 }); await preparar(page, 'doctor');
  const bloque = { diaSemana: 1, horaInicio: '09:00', horaFin: '11:00', duracionTurnoMinutos: 30, terminaDiaSiguiente: false };
  let escrituras = 0;
  await page.route('**/api/agendas/semanal/700011', r => {
    if (r.request().method() !== 'GET') escrituras++;
    return r.fulfill({ json: { data: { version: 0, activo: true, bloques: [bloque], sinDuracion: [] } } });
  });
  await page.goto('/mi-agenda');
  const evento = page.locator('.fc-timegrid-event').first();
  await expect(evento).toBeVisible();
  const origen = (await evento.boundingBox())!;
  const martes = (await page.locator('.fc-timegrid-col[data-date="2026-11-03"]').boundingBox())!;
  await page.mouse.move(origen.x + origen.width / 2, origen.y + 25); await page.mouse.down();
  await page.mouse.move(martes.x + martes.width / 2, origen.y + 25, { steps: 20 }); await page.mouse.up();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Día de inicio' })).toContainText('Martes');
  await page.getByRole('button', { name: 'Aplicar al borrador' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.fc-timegrid-event').first().hover();
  const borde = page.locator('.fc-event-resizer-end').filter({ visible: true }).first();
  await expect(borde).toBeVisible();
  const caja = (await borde.boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2); await page.mouse.down();
  await page.mouse.move(caja.x + caja.width / 2, caja.y + 60, { steps: 15 }); await page.mouse.up();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Fin', { exact: true })).not.toHaveValue('11:00');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(escrituras).toBe(0);
});

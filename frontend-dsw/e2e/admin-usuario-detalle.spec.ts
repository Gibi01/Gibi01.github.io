import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`perfil e historial de médico dado de baja, retorno y calendario a ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2030-11-04T08:00:00-03:00'));
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'admin', role: 'admin' }, session: { id: 'test', userId: 'admin', expiresAt: '2035-01-01' } } }));
    await page.route('**/api/usuarios/me', r => r.fulfill({ json: { data: { id: 99, nombre: 'Admin', apellido: 'Test', rol: 'admin' } } }));
    const usuarios = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, nombre: 'Ana', apellido: `Pérez ${i + 1}`, rol: 'doctor', activo: false, email: `ana${i}@example.com`, fechaAlta: '2026-09-12T12:00:00Z' }));
    await page.route('**/api/usuarios/listado', r => r.fulfill({ json: { data: usuarios } }));
    await page.route('**/api/usuarios/*/perfil-admin', r => r.fulfill({ json: { data: { ...usuarios[1], dni: '32456789', telefonoCelular: '3415550123', direccion: null, doctor: { matricula: 700001, activo: false, especialidades: [{ idEspecialidad: 1, descripcionEsp: 'Clínica médica' }] } } } }));
    let ultimaPerspectiva = '';
    await page.route('**/api/usuarios/*/turnos-admin?**', r => {
      const q = new URL(r.request().url()).searchParams;
      ultimaPerspectiva = q.get('perspectiva') ?? '';
      const turno = { id: 1, usuarioId: 2, doctor: { matricula: 700001, nombre: 'Laura', apellido: 'Méndez', especialidades: [{ idEspecialidad: 1, descripcionEsp: 'Cardiología' }] },
        paciente: { id: 3, nombre: 'Mario', apellido: 'López', dni: '12345678', email: 'mario@example.com', telefonoCelular: null },
        fechaHoraTurno: '2030-11-04T10:00:00-03:00', fechaHoraEmision: '2030-11-01T10:00:00-03:00', duracionTurnoMinutos: 20, estado: 'cancelado', obraSocial: null,
        fechaHoraCancelacion: '2030-11-02T10:00:00-03:00', motivoCancelacion: 'Baja del profesional', motivoCancelacionPreestablecido: null };
      const turnos = q.get('estado') === 'pendiente' ? [] : [turno];
      return r.fulfill({ json: { data: { total: turnos.length, pagina: 0, turnos } } });
    });
    await page.goto('/admin/usuarios');
    await page.getByRole('textbox', { name: 'Buscar por nombre o apellido' }).fill('Ana');
    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await page.getByRole('link', { name: 'Ver perfil', exact: true }).first().click();
    await expect(page.getByText('32456789')).toBeVisible();
    await expect(page.getByText('Dado de baja', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('perfil.png'), fullPage: true });
    await page.getByRole('link', { name: /Volver a usuarios/ }).click();
    await expect(page.getByRole('textbox', { name: 'Buscar por nombre o apellido' })).toHaveValue('Ana');
    await expect(page.getByText('11–12 de 12')).toBeVisible();
    await page.getByRole('link', { name: 'Historial de turnos', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Historial de turnos' })).toBeVisible();
    await page.getByRole('button', { name: 'Ver detalle' }).click();
    await expect(page.getByRole('dialog')).toContainText('Baja del profesional');
    await expect(page.getByRole('dialog')).toContainText('20 minutos');
    await expect(page.getByRole('button', { name: 'Cancelar turno' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.getByRole('tab', { name: 'Como profesional' }).click();
    await expect.poll(() => ultimaPerspectiva).toBe('profesional');
    await expect(page.getByText('Mario López', { exact: true }).filter({ visible: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('historial.png'), fullPage: true });
    await page.getByRole('button', { name: 'Calendario', exact: true }).click();
    await expect(page.locator('.fc-event')).toContainText('Mario López');
    await expect(page.locator('.fc-event-draggable')).toHaveCount(0);
    await page.locator('.fc-event').click();
    await expect(page.getByRole('dialog')).toContainText('Mario López');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('combobox', { name: 'Estado', exact: true }).click();
    await page.getByRole('option', { name: 'Pendiente', exact: true }).click();
    await expect(page.getByText('No hay turnos para los filtros seleccionados.')).toBeVisible();
  });
}

test('un paciente no puede abrir directamente la ficha administrativa', async ({ page }) => {
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'p', role: 'paciente' }, session: { id: 't', userId: 'p', expiresAt: '2035-01-01' } } }));
  await page.route('**/api/usuarios/me', r => r.fulfill({ json: { data: { id: 1, nombre: 'Paciente', apellido: 'Test', rol: 'paciente' } } }));
  let consulto = false;
  await page.route('**/api/usuarios/2/perfil-admin', r => { consulto = true; return r.fulfill({ status: 403 }); });
  await page.goto('/admin/usuarios/2?tab=turnos');
  await expect(page).toHaveURL('http://localhost:5173/');
  expect(consulto).toBe(false);
});

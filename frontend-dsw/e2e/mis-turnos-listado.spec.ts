import { test, expect, type Page } from '@playwright/test';
test.beforeEach(async ({ page }) => { page.on('pageerror', error => console.error('BROWSER:', error.message)); page.on('console', msg => { if (msg.type() === 'error') console.error('CONSOLE:', msg.text()); }); });

async function sesion(page: Page, rol = 'paciente') {
  await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'test', role: rol }, session: { id: 'sesion', userId: 'test', expiresAt: '2035-01-01' } } }));
  await page.route('**/api/usuarios/me', r => r.fulfill({ json: { data: { id: 1, nombre: 'Ana', apellido: 'Test', rol } } }));
  await page.route('**/api/motivos-cancelacion', r => r.fulfill({ json: { data: [] } }));
}
for (const movil of [false, true]) {
  test('calendario de paciente: consulta y cancelación ' + (movil ? 'móvil' : 'escritorio'), async ({ page }, info) => {
    await page.setViewportSize({ width: movil ? 390 : 1440, height: 1000 });
    await sesion(page);
    const inicio = new Date(); inicio.setHours(23, 0, 0, 0);
    const turno = { id: 2, doctor: { nombre: 'Laura', apellido: 'Méndez', especialidades: [{ idEspecialidad: 1, descripcionEsp: 'Cardiología' }] }, estado: 'pendiente', fechaHoraTurno: inicio.toISOString(), duracionTurnoMinutos: 30, obraSocial: null };
    await page.route('**/api/turnos/mios?**', r => r.fulfill({ json: { data: [turno] } }));
    await page.route('**/api/turnos/2', r => r.fulfill({ json: { data: turno } }));
    let cancelado = false;
    await page.route('**/api/turnos/2/cancelar', r => { cancelado = true; turno.estado = 'cancelado'; return r.fulfill({ json: { data: turno } }); });
    await page.goto('/mis-turnos');
    const evento = page.locator('.fc-event').filter({ hasText: 'Laura Méndez' }).first();
    await expect(evento).toBeAttached();
    await expect(page.locator('.fc-event-draggable')).toHaveCount(0);
    await evento.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('calendario.png'), fullPage: true, animations: 'disabled' });
    await evento.click();
    await expect(page.getByRole('dialog')).toContainText('Cardiología');
    await expect(page.getByRole('dialog')).toContainText('Duración: 30 minutos');
    await page.screenshot({ path: info.outputPath('mis-turnos.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Cancelar turno', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(cancelado).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('doctor consulta al paciente sin permitir mover reservas', async ({ page }) => {
  await sesion(page, 'doctor');
  const turno = { id: 3, doctor: { nombre: 'Laura', apellido: 'Méndez' }, paciente: { nombre: 'Ana', apellido: 'Pérez', dni: '12345678' }, estado: 'pendiente', fechaHoraTurno: new Date(Date.now() + 60000).toISOString(), duracionTurnoMinutos: 30, obraSocial: null };
  await page.route('**/api/turnos/atiendo?**', r => r.fulfill({ json: { data: [turno] } }));
  await page.route('**/api/turnos/3', r => r.fulfill({ json: { data: turno } }));
  await page.goto('/mis-turnos/atender');
  await page.locator('.fc-event').filter({ hasText: 'Ana Pérez' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('12345678');
  await expect(page.getByRole('button', { name: 'Marcar asistencia' })).toBeDisabled();
  await expect(page.locator('.fc-event-draggable')).toHaveCount(0);
});

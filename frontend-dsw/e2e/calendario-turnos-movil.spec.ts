import { test, expect } from '@playwright/test';

for (const width of [320, 390]) for (const medico of [false, true]) {
  test(`día, semana y mes legibles a ${width}px para ${medico ? 'médico' : 'paciente'}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-04T08:00:00-03:00'));
    const rol = medico ? 'doctor' : 'paciente';
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'test', role: rol }, session: { id: 't', userId: 'test', expiresAt: '2035-01-01' } } }));
    await page.route('**/api/usuarios/me', r => r.fulfill({ json: { data: { id: 1, nombre: 'Ana', apellido: 'Test', rol } } }));
    await page.route('**/api/motivos-cancelacion', r => r.fulfill({ json: { data: [] } }));
    const base = { doctor: { matricula: 1, nombre: 'Laura María', apellido: 'Méndez Fernández', especialidades: [{ idEspecialidad: 1, descripcionEsp: 'Traumatología y ortopedia' }] },
      paciente: { id: 2, nombre: 'María Alejandra', apellido: 'Fernández Rodríguez', dni: '12345678' }, estado: 'pendiente', obraSocial: null, fechaHoraEmision: '2026-11-01T10:00:00-03:00' };
    const turnos = [
      { ...base, id: 1, fechaHoraTurno: '2026-11-04T10:00:00-03:00', duracionTurnoMinutos: 20 },
      { ...base, id: 2, fechaHoraTurno: '2026-11-06T15:00:00-03:00', duracionTurnoMinutos: 30 },
      { ...base, id: 3, fechaHoraTurno: '2026-11-03T23:50:00-03:00', duracionTurnoMinutos: 20 },
    ];
    const consultas: URLSearchParams[] = [];
    await page.route(`**/api/turnos/${medico ? 'atiendo' : 'mios'}?**`, r => { consultas.push(new URL(r.request().url()).searchParams); return r.fulfill({ json: { data: turnos } }); });
    await page.route('**/api/turnos/1', r => r.fulfill({ json: { data: turnos[0] } }));
    await page.goto(medico ? '/mis-turnos/atender' : '/mis-turnos');
    const movil = page.getByLabel('Calendario móvil de turnos', { exact: true });
    await expect(movil.getByRole('button', { name: 'Semana', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const nombre = medico ? 'María Alejandra Fernández Rodríguez' : 'Dr./Dra. Laura María Méndez Fernández';
    const tarjeta = movil.getByRole('button').filter({ hasText: '10:00–10:20' });
    await expect(tarjeta).toContainText(nombre);
    await expect(tarjeta).toContainText('Traumatología y ortopedia');
    await expect(page.locator('.fc-timegrid')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('semana.png'), fullPage: true, animations: 'disabled' });
    await movil.getByRole('button', { name: 'Día', exact: true }).click();
    await expect(movil.getByText('Continúa desde el día anterior')).toBeVisible();
    await expect(movil.getByRole('button').filter({ hasText: '15:00–15:30' })).toHaveCount(0);
    await tarjeta.click();
    await expect(page.getByRole('dialog')).toContainText('20 minutos');
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await movil.getByRole('button', { name: 'Mes', exact: true }).click();
    await expect(movil.getByRole('button', { name: 'miércoles, 4 de noviembre, 2 turnos', exact: true })).toBeVisible();
    await movil.getByRole('button', { name: 'viernes, 6 de noviembre, 1 turnos', exact: true }).click();
    await expect(movil.getByRole('button').filter({ hasText: '15:00–15:30' })).toBeVisible();
    await expect(tarjeta).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('mes.png'), fullPage: true, animations: 'disabled' });
    await movil.getByRole('button', { name: 'Período siguiente' }).click();
    await expect(movil.getByRole('heading', { name: 'diciembre de 2026' })).toBeVisible();
    await expect(movil.getByText('No hay turnos para este día.')).toBeVisible();
    expect(consultas.some(q => q.get('desde')?.startsWith('2026-11-30'))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('.fc')).toBeVisible();
    await expect(page.getByLabel('Calendario móvil de turnos', { exact: true })).toHaveCount(0);
    await expect(page.locator('.fc-event-draggable')).toHaveCount(0);
  });
}

import { test, expect } from '@playwright/test';

for (const especialidad of [false, true]) {
  test(`actualiza el día después de una reserva simultánea por ${especialidad ? 'especialidad' : 'doctor'}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2030-11-03T06:00:00-03:00'));
    const doctor = { matricula: 700001, nombre: 'Martín', apellido: 'López', especialidades: [] };
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: { user: { id: 'test', role: 'paciente' }, session: { id: 'test', userId: 'test', expiresAt: '2035-01-01' } } }));
    await page.route('**/api/usuarios/me', r => r.fulfill({ json: { data: { id: 1, nombre: 'Ana', apellido: 'Test', rol: 'paciente' } } }));
    await page.route('**/api/doctores/700001', r => r.fulfill({ json: { data: doctor } }));
    await page.route('**/api/obras-sociales', r => r.fulfill({ json: { data: [] } }));
    let ocupado = false;
    await page.route('**/api/turnos/**', r => {
      const path = new URL(r.request().url()).pathname;
      const horarios = ocupado ? ['2030-11-03T09:20:00-03:00'] : ['2030-11-03T09:00:00-03:00', '2030-11-03T09:20:00-03:00'];
      return r.fulfill({ json: { data: path.includes('disponibilidad-mes') ? ['2030-11-03'] : especialidad ? horarios.map(fechaHoraTurno => ({ fechaHoraTurno, doctor })) : horarios } });
    });
    await page.route('**/api/turnos', r => { ocupado = true; return r.fulfill({ status: 409, json: { message: 'Horario ocupado' } }); });
    await page.goto(especialidad ? '/especialidades/1/turnos' : '/doctores/700001');
    await page.getByRole('button', { name: '09:00', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    if (especialidad) await page.getByRole('button', { name: /Dr\.\/Dra\. Martín López/ }).click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Sin obra social', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('El horario que elegiste ya no está disponible. Elegí otro horario.')).toBeVisible();
    await expect(page.getByRole('button', { name: '09:00', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '09:20', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);
  });
}

for (const width of [390, 1440]) {
  test(`agenda de 24 horas agrupada y continuación nocturna a ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2030-11-02T12:00:00-03:00'));
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: null }));
    await page.route('**/api/doctores/700001', r => r.fulfill({ json: { data: { matricula: 700001, nombre: 'Martín', apellido: 'López', especialidades: [] } } }));
    await page.route('**/api/obras-sociales', r => r.fulfill({ json: { data: [] } }));
    const horarios = Array.from({ length: 72 }, (_, i) => new Date(Date.parse('2030-11-03T00:00:00-03:00') + i * 20 * 60000).toISOString());
    await page.route('**/api/turnos/disponibilidad-mes?**', r => r.fulfill({ json: { data: ['2030-11-03', '2030-11-04'] } }));
    await page.route('**/api/turnos/disponibilidad?**', r => {
      const fecha = new URL(r.request().url()).searchParams.get('fecha');
      return r.fulfill({ json: { data: fecha === '2030-11-03' ? horarios : fecha === '2030-11-04' ? ['2030-11-04T00:00:00-03:00', '2030-11-04T00:20:00-03:00'] : [] } });
    });
    await page.goto('/doctores/700001');
    await page.getByRole('gridcell', { name: '3', exact: true }).click();
    await expect(page.getByRole('button', { name: /Madrugada/ })).toContainText('18 disponibles');
    await expect(page.getByRole('button', { name: /^\d\d:\d\d$/ })).toHaveCount(width < 600 ? 6 : 18);
    await page.getByRole('button', { name: /Mañana/ }).click();
    if (width < 600) await page.getByRole('button', { name: /Ver más horarios/ }).click();
    await page.getByRole('button', { name: '09:20', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('horarios-por-franja.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('gridcell', { name: '4', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Continuar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Madrugada/ })).toContainText('2 disponibles');
    await expect(page.getByRole('button', { name: '00:00', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '23:40', exact: true })).toHaveCount(0);
  });
}

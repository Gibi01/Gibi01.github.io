import { test, expect } from '@playwright/test';

for (const especialidad of [false, true]) {
  test(`conserva diciembre al cargar disponibilidad por ${especialidad ? 'especialidad' : 'doctor'}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-04T10:00:00-03:00'));
    await page.route('**/api/auth/get-session', r => r.fulfill({ json: null }));
    await page.route('**/api/doctores/700001', r => r.fulfill({ json: { data: { matricula: 700001, nombre: 'Doctora', apellido: 'Prueba', especialidades: [] } } }));
    await page.route('**/api/obras-sociales', r => r.fulfill({ json: { data: [] } }));
    let solicitudesDiciembre = 0;
    await page.route('**/api/turnos/**', async r => {
      const url = new URL(r.request().url());
      if (url.pathname.includes('disponibilidad-mes')) {
        const mes = url.searchParams.get('mes');
        if (mes === '12') solicitudesDiciembre++;
        await r.fulfill({ json: { data: mes === '12' ? ['2026-12-07'] : ['2026-11-06'] } });
      } else await r.fulfill({ json: { data: [] } });
    });
    await page.goto(especialidad ? '/especialidades/1/turnos' : '/doctores/700001');
    await expect(page.getByRole('gridcell', { name: '6', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect.poll(() => solicitudesDiciembre).toBeGreaterThan(0);
    await expect(page.getByText('diciembre 2026', { exact: true })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: '7', exact: true })).toHaveCount(1);
    await expect(page.getByRole('gridcell', { name: '7', exact: true })).toBeEnabled();
    await page.getByRole('gridcell', { name: '7', exact: true }).click();
    await expect(page.getByText('lunes, 7 de diciembre', { exact: true })).toBeVisible();
    await expect(page.getByText('diciembre 2026', { exact: true })).toBeVisible();
  });
}

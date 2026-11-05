import { test, expect } from '@playwright/test';

for (const tipo of ['doctor', 'especialidad']) {
  for (const registro of [false, true]) {
    for (const ocupado of [false, true]) {
    test(`retoma reserva por ${tipo} después de ${registro ? 'registrarse' : 'ingresar'} (${ocupado ? 'ocupado' : 'disponible'})`, async ({ page }) => {
      if (tipo === 'especialidad') await page.setViewportSize({ width: 390, height: 844 });
      let autenticado = false;
      let reservas = 0;
      const user = { id: 'cuenta-test', name: 'Ana', email: 'ana@test.com', role: 'paciente' };
      const perfil = { id: 1, nombre: 'Ana', apellido: 'Test', email: user.email, rol: 'paciente' };
      const doctor = { matricula: 1, nombre: 'Ana', apellido: 'Test', especialidades: [] };
      const horario = new Date();
      horario.setDate(horario.getDate() + 1);
      horario.setHours(10, 0, 0, 0);
      // La agenda simulada ofrece el mismo horario futuro en la fecha visible.
      await page.route('**/api/auth/get-session', route => route.fulfill({ json: autenticado ? {
        user, session: { id: 'sesion-test', userId: user.id, expiresAt: new Date(Date.now() + 86400000).toISOString() },
      } : null }));
      await page.route('**/api/usuarios/me', route => route.fulfill({ json: { data: perfil } }));
      await page.route('**/api/auth/sign-in/email', route => {
        autenticado = true;
        return route.fulfill({ json: { user, token: 'test', redirect: false } });
      });
      await page.route('**/api/usuarios', route => {
        autenticado = true;
        return route.fulfill({ status: 201, json: { data: perfil } });
      });
      await page.route('**/api/doctores/1', route => route.fulfill({ json: { data: doctor } }));
      await page.route('**/api/obras-sociales', route => route.fulfill({ json: { data: [] } }));
      await page.route('**/api/motivos-cancelacion', route => route.fulfill({ json: { data: [] } }));
      await page.route('**/api/turnos/**', route => {
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({ json: { data: path.includes('disponibilidad-mes') || path.endsWith('/mios') || (ocupado && autenticado) ? []
          : path.includes('disponibilidad-especialidad') ? [{ fechaHoraTurno: horario.toISOString(), doctor }]
          : [horario.toISOString()] } });
      });
      await page.route('**/api/turnos', route => {
        reservas++;
        expect(route.request().postDataJSON()).toEqual({ doctorId: 1, fechaHoraTurno: horario.toISOString(), obraSocialId: null });
        return route.fulfill({ status: 201, json: { data: { id: 1 } } });
      });
      const destino = tipo === 'doctor' ? '/doctores/1' : '/especialidades/1/turnos';
      await page.goto(destino);
      await page.getByRole('button', { name: '10:00', exact: true }).click();
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      if (tipo === 'especialidad') await page.getByRole('button', { name: /Dr\.\/Dra\. Ana Test/ }).click();
      await expect(page).toHaveURL(/\/registro$/);
      await page.getByRole('link', { name: 'Iniciá sesión', exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.getByRole('link', { name: 'Registrate', exact: true }).click();
      await expect(page).toHaveURL(/\/registro$/);
      await page.reload();
      if (!registro) {
        await page.getByRole('link', { name: 'Iniciá sesión', exact: true }).click();
        await expect(page).toHaveURL(/\/login$/);
      }
      else {
        await expect(page.getByRole('heading', { name: 'Crear cuenta', exact: true })).toBeVisible();
        await page.getByLabel('Nombre', { exact: true }).fill('Ana');
        await page.getByLabel('Apellido', { exact: true }).fill('Test');
        await page.getByLabel('DNI', { exact: true }).fill('12345678');
        await page.getByLabel('Confirmar contraseña', { exact: true }).fill('secreta123');
      }
      await expect(page.getByRole('heading', { name: registro ? 'Crear cuenta' : 'Iniciar sesión', exact: true })).toBeVisible();
      await page.getByLabel('Email', { exact: true }).fill(user.email);
      await page.getByLabel('Contraseña', { exact: true }).fill('secreta123');
      await page.getByRole('button', { name: registro ? 'Registrarme' : 'Ingresar', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${destino}$`));
      if (ocupado) {
        await expect(page.getByText('El horario que elegiste ya no está disponible. Elegí otro horario.')).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(reservas).toBe(0);
        return;
      }
      await expect(page.getByRole('dialog')).toBeVisible();
      if (tipo === 'especialidad' && registro) await page.screenshot({ path: 'test-results/modal-obra-social-mobile.png', animations: 'disabled' });
      expect(reservas).toBe(0);
      await page.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Sin obra social', exact: true }).click();
      await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(page.getByRole('heading', { name: '¡Tu turno está confirmado!' })).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText('Sin obra social');
      if (tipo === 'especialidad' && registro) await page.screenshot({ path: 'test-results/modal-confirmado-mobile.png', animations: 'disabled' });
      await expect(page).toHaveURL(new RegExp(`${destino}$`));
      await expect(page).toHaveURL(/\/mis-turnos$/);
      expect(reservas).toBe(1);
      expect(await page.evaluate(() => sessionStorage.getItem('reserva-pendiente'))).toBeNull();
      await page.reload();
      await expect(page).toHaveURL(/\/mis-turnos$/);
      await expect(page.getByRole('img', { name: 'Ana Test' })).toBeVisible();
    });
    }
  }
}

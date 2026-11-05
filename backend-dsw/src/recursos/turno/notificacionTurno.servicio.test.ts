import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  find: vi.fn(), nativeUpdate: vi.fn(), findOneOrFail: vi.fn(), enviar: vi.fn(),
}));
vi.mock('../../shared/orm.js', () => ({ orm: { em: { fork: () => mocks } } }));
vi.mock('../../shared/config.js', () => ({ config: { brevo: { apiKey: 'test', fromEmail: 'test@example.com' } } }));
vi.mock('../../shared/correo.js', () => ({ enviarCorreo: mocks.enviar }));
vi.mock('./turno.entidad.js', () => ({ Turno: class {} }));
vi.mock('./notificacionTurno.entidad.js', () => ({ NotificacionTurno: class {} }));
import { despacharNotificacionesTurnos } from './notificacionTurno.servicio.js';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue([{ id: 5 }]);
  mocks.nativeUpdate.mockResolvedValue(1);
  mocks.findOneOrFail.mockResolvedValue({ id: 5, tipo: 'cancelado', turno: { id: 2 }, intentos: 0 });
  mocks.enviar.mockResolvedValue('brevo-id');
});
it('conserva el identificador de Brevo al enviar un cambio de estado', async () => {
  await despacharNotificacionesTurnos();
  expect(mocks.nativeUpdate).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
    estado: 'enviado', proveedorId: 'brevo-id', ultimoError: null,
  }));
});
it('omite recordatorios antiguos pendientes tras retirar la funcionalidad', async () => {
  mocks.findOneOrFail.mockResolvedValue({ id: 5, tipo: 'recordatorio', turno: { id: 2 } });
  await despacharNotificacionesTurnos();
  expect(mocks.enviar).not.toHaveBeenCalled();
  expect(mocks.nativeUpdate).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), { estado: 'omitido' });
});
it('no envía un trabajo que reclamó otra instancia', async () => {
  mocks.nativeUpdate.mockResolvedValue(0);
  await despacharNotificacionesTurnos();
  expect(mocks.enviar).not.toHaveBeenCalled();
});
it('mantiene el trabajo pendiente con espera ante un fallo del proveedor', async () => {
  mocks.enviar.mockRejectedValueOnce(new Error('Brevo HTTP 429'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await despacharNotificacionesTurnos();
  expect(mocks.nativeUpdate).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
    estado: 'pendiente', intentos: 1, proximoIntentoEn: expect.any(Date),
  }));
  log.mockRestore();
});

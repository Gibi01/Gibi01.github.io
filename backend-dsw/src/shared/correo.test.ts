import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./config.js', () => ({ config: { brevo: {
  apiKey: 'clave-de-prueba', fromEmail: 'remitente@example.com', fromName: 'Hospital Ripper',
} } }));
import { enviarCorreo } from './correo.js';

const correo = { id: 7, destinatario: 'paciente@example.com', asunto: 'Cancelación', texto: 'Turno cancelado.' };
afterEach(() => vi.unstubAllGlobals());
describe('API HTTPS de Brevo', () => {
  it('envía el remitente verificado, destinatario e identificador estable y devuelve messageId', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: 'mensaje-7' }), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    expect(await enviarCorreo(correo)).toBe('mensaje-7');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(options.headers['api-key']).toBe('clave-de-prueba');
    expect(JSON.parse(options.body)).toMatchObject({
      sender: { email: 'remitente@example.com', name: 'Hospital Ripper' },
      to: [{ email: correo.destinatario }], textContent: correo.texto,
      headers: { idempotencyKey: 'notificacion-7' },
    });
  });
  it('informa cuotas agotadas sin exponer datos del destinatario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'not_enough_credits', message: 'paciente@example.com',
    }), { status: 400 })));
    await expect(enviarCorreo(correo)).rejects.toThrow('Brevo HTTP 400: not_enough_credits');
  });
  it('no confirma como enviado un éxito sin identificador', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 201 })));
    await expect(enviarCorreo(correo)).rejects.toThrow('respuesta sin identificador');
  });
  it('propaga el fallo de red para que la cola reprograme el envío', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin conexión')));
    await expect(enviarCorreo(correo)).rejects.toThrow('sin conexión');
  });
});

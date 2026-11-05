import { config } from './config.js';

export interface Correo {
  id: number;
  destinatario: string;
  asunto: string;
  texto: string;
}

export async function enviarCorreo(correo: Correo): Promise<string> {
  const { apiKey, fromEmail, fromName } = config.brevo;
  if (!apiKey || !fromEmail) throw new Error('Faltan BREVO_API_KEY o BREVO_FROM_EMAIL');
  const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      replyTo: { email: fromEmail, name: fromName },
      to: [{ email: correo.destinatario }],
      subject: correo.asunto,
      textContent: correo.texto,
      headers: { idempotencyKey: `notificacion-${correo.id}` },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const resultado = await respuesta.json() as { messageId?: string; code?: string };
  if (!respuesta.ok || !resultado.messageId) {
    // No registrar el cuerpo: puede incluir datos del destinatario.
    throw new Error(`Brevo HTTP ${respuesta.status}: ${resultado.code ?? 'respuesta sin identificador'}`);
  }
  return resultado.messageId;
}

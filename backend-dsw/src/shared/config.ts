import 'dotenv/config';
import { readFileSync } from 'node:fs';

const ca = process.env.DB_SSL_CA?.replace(/\\n/g, '\n')
  || (process.env.DB_SSL_CA_PATH ? readFileSync(process.env.DB_SSL_CA_PATH, 'utf8') : undefined);
if (process.env.DB_SSL === 'true' && !ca) throw new Error('DB_SSL requiere el certificado CA de Aiven');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name} (revisá tu archivo .env)`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    name: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    ssl: process.env.DB_SSL === 'true' ? { ca, rejectUnauthorized: true } : undefined,
  },
  auth: {
    secret: requireEnv('BETTER_AUTH_SECRET'),
    origin: process.env.APP_ORIGIN ?? 'http://localhost:5173',
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    fromEmail: process.env.BREVO_FROM_EMAIL,
    fromName: process.env.BREVO_FROM_NAME || 'Hospital Ripper',
  },
};

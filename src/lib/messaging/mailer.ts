import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

/**
 * Envío de correos por SMTP. En local apunta a Mailpit (un "buzón falso" en Docker):
 * nada sale a internet y ves los correos en http://localhost:8025.
 * En producción solo cambias SMTP_HOST/PORT/USER/PASS (SendGrid, SES, Resend…).
 */
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

export async function sendMail(to: string, subject: string, html: string, text: string) {
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, html, text });
}

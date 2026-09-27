/** Plantilla del correo con el código (HTML simple con estilos en línea: así lo leen todos los correos). */
export function verificationEmail(firstName: string, code: string, minutes: number) {
  const subject = `${code} es tu código de IVE`;
  const text = `Hola ${firstName}, tu código para confirmar tu cuenta de IVE es ${code}. Vence en ${minutes} minutos. Si no fuiste tú, ignora este correo.`;
  const html = `
  <div style="background:#f6f4f0;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1a1a18">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;padding:32px">
      <p style="font-family:Georgia,serif;font-size:28px;letter-spacing:.3em;margin:0 0 24px">IVE</p>
      <p style="font-size:16px;margin:0 0 16px">Hola ${escapeHtml(firstName)},</p>
      <p style="font-size:15px;color:#57524b;margin:0 0 24px">Usa este código para confirmar tu cuenta:</p>
      <p style="font-size:36px;font-weight:bold;letter-spacing:.4em;margin:0 0 24px">${code}</p>
      <p style="font-size:13px;color:#6b665e;margin:0">Vence en ${minutes} minutos. Si no fuiste tú, ignora este correo.</p>
    </div>
  </div>`;
  return { subject, text, html };
}

export const verificationSms = (code: string, minutes: number) =>
  `IVE: tu codigo es ${code}. Vence en ${minutes} min. No lo compartas con nadie.`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

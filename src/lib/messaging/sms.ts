/**
 * SMS "de mentira": imprime el mensaje en la terminal del back.
 * Para mandar SMS reales, cambia el cuerpo de sendSms por Twilio (u otro):
 *   await twilio.messages.create({ to: `+52${phone}`, from: env.TWILIO_FROM, body })
 * El resto del código no se entera: solo llama a sendSms().
 */
export async function sendSms(phone: string, body: string) {
  console.log(`\n📱 [SMS simulado → ${phone}] ${body}\n`);
}

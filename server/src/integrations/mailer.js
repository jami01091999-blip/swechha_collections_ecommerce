import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { HttpError } from '../utils/HttpError.js';

const BRAND = { maroon: '#6b1d2f', ivory: '#fcf9f8', gold: '#7a582d', ink: '#1b1c1c', muted: '#544244', line: '#dac0c2' };

let transport;
/** Messages "sent" while running tests (Nodemailer jsonTransport). */
export const testOutbox = [];

function getTransport() {
  if (transport) return transport;
  if (env.isTest) {
    transport = nodemailer.createTransport({ jsonTransport: true });
  } else if (env.smtpConfigured) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
  }
  return transport;
}

export function otpEmail(code) {
  const spaced = code.split('').join(' ');
  const subject = `Your Swechha sign-in code: ${code}`;
  const text = [
    'Swechha Collections',
    '',
    `Your sign-in code is ${code}`,
    'It is valid for 10 minutes.',
    '',
    "If you didn't ask for this, ignore this email.",
  ].join('\n');
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:${BRAND.ivory};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.ivory};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid ${BRAND.line};border-radius:16px;">
      <tr><td style="padding:28px 28px 8px;text-align:center;">
        <div style="font-family:'Playfair Display',Georgia,serif;font-size:24px;color:${BRAND.maroon};">Swechha Collections</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;color:${BRAND.gold};margin-top:4px;">ATELIER</div>
      </td></tr>
      <tr><td style="padding:16px 28px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.ink};">
        Your sign-in code is
      </td></tr>
      <tr><td style="padding:14px 28px;text-align:center;">
        <div style="display:inline-block;padding:14px 22px;border-radius:12px;background:${BRAND.ivory};border:1px solid ${BRAND.line};font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:${BRAND.maroon};">${spaced}</div>
      </td></tr>
      <tr><td style="padding:0 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.muted};">
        It is valid for 10 minutes.
      </td></tr>
      <tr><td style="padding:20px 28px 28px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.muted};">
        If you didn't ask for this, ignore this email.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

/** Sends the sign-in code. Throws 502 when the email could not be sent. */
export async function sendOtpEmail(to, code) {
  // Test mode: the code is also in the server log so testing never waits on email.
  if (!env.isLive) logger.info(`OTP for ${to}: ${code}`);
  const t = getTransport();
  if (!t) {
    if (!env.isLive) return; // test mode without SMTP: log only
    throw new HttpError(502, "We couldn't send the code. Try again in a minute.");
  }
  const message = { from: env.MAIL_FROM || 'Swechha Collections <no-reply@example.com>', to, ...otpEmail(code) };
  try {
    const info = await t.sendMail(message);
    if (env.isTest) testOutbox.push({ to, subject: message.subject, text: message.text, html: message.html, raw: info.message });
  } catch (e) {
    logger.error({ to, reason: e.message }, 'OTP email failed');
    throw new HttpError(502, "We couldn't send the code. Try again in a minute.");
  }
}

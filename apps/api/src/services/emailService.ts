import nodemailer, { type Transporter } from 'nodemailer';
import { withRetry } from '../lib/retry';
import {
  PLATFORM_BRAND_NAME,
  buildOtpEmailHtml,
  wrapPlatformEmail,
} from './emailTemplates';

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

type BrevoApiConfig = {
  kind: 'api';
  apiKey: string;
  senderEmail: string;
  senderName: string;
};

type BrevoSmtpConfig = {
  kind: 'smtp';
  smtp: SmtpConfig;
  senderEmail: string;
};

type BrevoConfig = BrevoApiConfig | BrevoSmtpConfig;

export type EmailDeliveryMode = 'brevo' | 'smtp' | 'console';

function normalizeSecret(value?: string): string {
  return (value ?? '').trim().replace(/^['"]|['"]$/g, '').trim();
}

function extractEmail(from?: string): string | undefined {
  if (!from) return undefined;
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] || from).trim() || undefined;
}

function getSenderEmail(): string | undefined {
  return (
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    extractEmail(process.env.SMTP_FROM) ||
    process.env.SMTP_USER?.trim()
  );
}

/**
 * Supports both Brevo key types:
 * - xkeysib-… → HTTP Transactional API
 * - xsmtpsib-… → SMTP relay (smtp-relay.brevo.com)
 */
function getBrevoConfig(): BrevoConfig | null {
  const key = normalizeSecret(process.env.BREVO_API_KEY);
  if (!key) return null;

  const senderEmail = getSenderEmail();
  if (!senderEmail) return null;

  const senderName = process.env.BREVO_SENDER_NAME?.trim() || PLATFORM_BRAND_NAME;

  // SMTP master key from Brevo "SMTP & API" → SMTP
  if (key.startsWith('xsmtpsib-')) {
    const smtpUser = process.env.BREVO_SMTP_LOGIN?.trim() || senderEmail;
    return {
      kind: 'smtp',
      senderEmail,
      smtp: {
        host: process.env.SMTP_HOST?.trim() || 'smtp-relay.brevo.com',
        port: Number(process.env.SMTP_PORT ?? '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: smtpUser,
        pass: key,
        from: process.env.SMTP_FROM?.trim() || `${senderName} <${senderEmail}>`,
      },
    };
  }

  // API key from Brevo "SMTP & API" → API keys
  return {
    kind: 'api',
    apiKey: key,
    senderEmail,
    senderName,
  };
}

function getSmtpConfig(): SmtpConfig | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? '587');
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;

  return {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port,
    secure,
    user,
    pass,
    from: process.env.SMTP_FROM ?? user,
  };
}

let transporter: Transporter | null = null;

function getTransporter(config: SmtpConfig): Transporter {
  // Reset if config changes between Brevo SMTP vs classic SMTP in the same process.
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    ...(config.port === 587 && !config.secure ? { requireTLS: true } : {}),
  });

  return transporter;
}

export function getEmailDeliveryMode(): EmailDeliveryMode {
  if (getBrevoConfig()) return 'brevo';
  if (getSmtpConfig()) return 'smtp';
  return 'console';
}

async function sendViaBrevoApi(
  config: BrevoApiConfig,
  to: string,
  subject: string,
  htmlContent: string,
): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: config.senderName,
        email: config.senderEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API ${res.status}: ${body.slice(0, 400)}`);
  }
}

async function sendWithBrevo(to: string, subject: string, html: string): Promise<void> {
  const brevo = getBrevoConfig();
  if (!brevo) throw new Error('Brevo is not configured');

  if (brevo.kind === 'api') {
    await withRetry(() => sendViaBrevoApi(brevo, to, subject, html));
    return;
  }

  const mailer = getTransporter(brevo.smtp);
  await withRetry(() =>
    mailer.sendMail({
      from: brevo.smtp.from,
      to,
      subject,
      html,
    }),
  );
}

async function brevoGet(
  apiKey: string,
  pathname: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`https://api.brevo.com/v3${pathname}`, {
    headers: {
      accept: 'application/json',
      'api-key': apiKey,
    },
  });
  const body = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, body };
}

/** Optional: verifies outbound email config on startup (logs only, does not throw). */
export async function verifySmtpIfConfigured(): Promise<void> {
  const brevo = getBrevoConfig();
  if (brevo) {
    if (brevo.kind === 'api') {
      // Send-only keys often 401 on /account; /senders is what mail actually needs.
      const senders = await brevoGet(brevo.apiKey, '/senders');
      if (senders.ok) {
        console.log(`[MAIL] Brevo API OK — sender ${brevo.senderEmail}`);
        return;
      }
      const account = await brevoGet(brevo.apiKey, '/account');
      if (account.ok) {
        console.log(`[MAIL] Brevo API OK — sender ${brevo.senderEmail}`);
        return;
      }
      const status = senders.status || account.status;
      const hint =
        status === 401 || status === 403
          ? 'Create a new key at https://app.brevo.com/settings/keys/api with Transactional email permission, then set BREVO_API_KEY in apps/api/.env (no spaces).'
          : (senders.body || account.body).slice(0, 200);
      throw new Error(`Brevo API check failed (${status}). ${hint}`);
    }

    const mailer = getTransporter(brevo.smtp);
    await mailer.verify();
    console.log(
      `[MAIL] Brevo SMTP OK — host ${brevo.smtp.host} sender ${brevo.senderEmail}`,
    );
    return;
  }

  const config = getSmtpConfig();
  if (!config) return;
  const mailer = getTransporter(config);
  await mailer.verify();
}

/**
 * Production guardrail: fail fast when email is not configured correctly.
 */
export function assertEmailConfigForRuntime(): void {
  if (process.env.NODE_ENV !== 'production') return;

  if (getEmailDeliveryMode() === 'console') {
    throw new Error(
      'Email is required in production. Set BREVO_API_KEY + BREVO_SENDER_EMAIL, or SMTP_USER/SMTP_PASS/SMTP_FROM.',
    );
  }
}

export async function sendOTPEmail(email: string, otp: string): Promise<void> {
  const mode = getEmailDeliveryMode();
  const { subject, html } = buildOtpEmailHtml(otp);

  if (mode === 'console') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured. OTP email cannot be delivered in production.');
    }
    console.log(`\n📧 [DEV OTP] ${email}: ${otp}\n`);
    return;
  }

  try {
    if (mode === 'brevo') {
      await sendWithBrevo(email, subject, html);
      console.log(`[MAIL] OTP sent via Brevo to ${email}`);
      return;
    }

    const config = getSmtpConfig()!;
    const mailer = getTransporter(config);
    const result = await withRetry(() =>
      mailer.sendMail({
        from: config.from,
        to: email,
        subject,
        html,
      }),
    );
    console.log(`[MAIL] OTP sent to ${email}; messageId=${result.messageId}`);
  } catch (error) {
    console.error('[MAIL] Failed to send OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
}

/** Generic transactional send (payments, TA alerts, etc.). */
export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  /** Full HTML email. If omitted, use wrapInBrandLayout + bodyHtml. */
  html?: string;
  wrapInBrandLayout?: boolean;
  title?: string;
  preheader?: string;
  bodyHtml?: string;
  cta?: { label: string; href: string };
}): Promise<void> {
  const html =
    input.wrapInBrandLayout || (!input.html && input.bodyHtml)
      ? wrapPlatformEmail({
          title: input.title || input.subject,
          preheader: input.preheader,
          bodyHtml: input.bodyHtml || input.html || '',
          cta: input.cta,
        })
      : input.html;

  if (!html) {
    throw new Error('Email html or bodyHtml is required');
  }

  const mode = getEmailDeliveryMode();
  if (mode === 'console') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email is not configured');
    }
    console.log(`\n📧 [DEV MAIL] to=${input.to} subject=${input.subject}\n`);
    return;
  }

  if (mode === 'brevo') {
    await sendWithBrevo(input.to, input.subject, html);
    return;
  }

  const config = getSmtpConfig()!;
  const mailer = getTransporter(config);
  await withRetry(() =>
    mailer.sendMail({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html,
    }),
  );
}

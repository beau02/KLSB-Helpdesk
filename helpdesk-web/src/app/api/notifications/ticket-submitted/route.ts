import nodemailer from "nodemailer";

type TicketSubmittedPayload = {
  ticketId?: string;
  ticketCode?: string;
  userEmail?: string;
  subject?: string;
  description?: string;
  priority?: string;
  autoReplyMessage?: string;
};

const DEFAULT_AUTO_REPLY_MESSAGE = "Thank you for your report. We have received your submission and will contact you soon for further action.";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCorporateEmail(params: {
  ticketLabel: string;
  subject: string;
  description: string;
  priority: string;
  autoReplyMessage: string;
  isAdminCopy?: boolean;
}) {
  const ticketLabel = escapeHtml(params.ticketLabel);
  const subject = escapeHtml(params.subject || "N/A");
  const description = escapeHtml(params.description || "N/A");
  const priority = escapeHtml(params.priority || "N/A");
  const autoReplyMessage = escapeHtml(params.autoReplyMessage);
  const title = params.isAdminCopy ? "Admin Ticket Notification" : "Ticket Submission Confirmation";

  return `
    <div style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <div style="max-width:720px;margin:0 auto;padding:24px;">
        <div style="background:#0f172a;border-radius:16px 16px 0 0;padding:22px 28px;border:1px solid #1f3b61;border-bottom:none;">
          <div style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#7dd3fc;font-weight:700;">KLSB Helpdesk</div>
          <h1 style="margin:10px 0 0;font-size:26px;line-height:1.2;color:#ffffff;">${title}</h1>
        </div>

        <div style="background:#ffffff;border:1px solid #cbd5e1;border-top:none;border-radius:0 0 16px 16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#334155;">${autoReplyMessage}</p>

          <div style="display:flex;flex-wrap:wrap;gap:12px;margin:22px 0 26px;">
            <div style="flex:1 1 180px;background:#f8fafc;border:1px solid #dbe4ee;border-radius:12px;padding:14px 16px;">
              <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Ticket ID</div>
              <div style="font-size:16px;font-weight:700;color:#0f172a;">${ticketLabel}</div>
            </div>
            <div style="flex:1 1 180px;background:#f8fafc;border:1px solid #dbe4ee;border-radius:12px;padding:14px 16px;">
              <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Priority</div>
              <div style="font-size:16px;font-weight:700;color:#0f172a;">${priority}</div>
            </div>
          </div>

          <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;width:140px;color:#64748b;font-size:13px;">Subject</td>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600;">${subject}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;width:140px;color:#64748b;font-size:13px;vertical-align:top;">Description</td>
              <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;line-height:1.7;white-space:pre-line;">${description}</td>
            </tr>
          </table>

          <div style="margin-top:26px;padding:16px 18px;background:#f1f5f9;border-left:4px solid #0ea5e9;border-radius:10px;color:#475569;font-size:13px;line-height:1.7;">
            This is an automated message from KLSB Helpdesk. Please do not reply directly to this email.
          </div>
        </div>
      </div>
    </div>
  `;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSmtpPassword() {
  // Support both SMTP_PASS=abc\$123 and SMTP_PASS=abc$123 styles.
  const raw = getRequiredEnv("SMTP_PASS");
  return raw.replace(/\\\$/g, "$");
}

function getAdminRecipients() {
  const value = process.env.ADMIN_NOTIFICATION_EMAILS ?? "";
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as TicketSubmittedPayload;
    const userEmail = String(payload.userEmail ?? "").trim();
    const subject = String(payload.subject ?? "").trim();
    const description = String(payload.description ?? "").trim();
    const priority = String(payload.priority ?? "").trim();
    const autoReplyMessage = String(payload.autoReplyMessage ?? DEFAULT_AUTO_REPLY_MESSAGE).trim() || DEFAULT_AUTO_REPLY_MESSAGE;
    const ticketId = String(payload.ticketId ?? "").trim();
    const ticketCode = String(payload.ticketCode ?? "").trim();

    if (!userEmail) {
      return Response.json({ error: "Missing user email." }, { status: 400 });
    }

    const adminRecipients = getAdminRecipients();
    if (adminRecipients.length === 0) {
      return Response.json({ error: "No admin recipients configured." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: getRequiredEnv("SMTP_HOST"),
      port: Number(getRequiredEnv("SMTP_PORT")),
      secure: String(process.env.SMTP_SECURE ?? "true").toLowerCase() === "true",
      auth: {
        user: getRequiredEnv("SMTP_USER"),
        pass: getSmtpPassword(),
      },
    });

    const smtpUser = getRequiredEnv("SMTP_USER");
    const fromAddress = process.env.SMTP_FROM || `KLSB Helpdesk <${smtpUser}>`;
    const ticketIdentifier = ticketCode || ticketId || "N/A";
    const ticketLabel = ticketIdentifier !== "N/A" ? `Ticket ${ticketIdentifier}` : "New Ticket";
    const emailSubject = `${ticketLabel} Submitted - ${subject || "KLSB Helpdesk"}`;
    const bodyLines = [
      autoReplyMessage,
      "",
      `Ticket ID: ${ticketIdentifier}`,
      `Subject: ${subject || "N/A"}`,
      `Priority: ${priority || "N/A"}`,
      `Description: ${description || "N/A"}`,
    ];
    const userHtml = buildCorporateEmail({
      ticketLabel,
      subject,
      description,
      priority,
      autoReplyMessage,
    });
    const adminHtml = buildCorporateEmail({
      ticketLabel,
      subject,
      description,
      priority,
      autoReplyMessage,
      isAdminCopy: true,
    });

    await Promise.all([
      transporter.sendMail({
        from: fromAddress,
        to: userEmail,
        subject: emailSubject,
        text: bodyLines.join("\n"),
        html: userHtml,
      }),
      transporter.sendMail({
        from: fromAddress,
        to: adminRecipients[0],
        bcc: adminRecipients.slice(1),
        subject: `Admin Copy - ${emailSubject}`,
        text: [
          `Admin notification for ${ticketLabel}`,
          "",
          ...bodyLines,
        ].join("\n"),
        html: adminHtml,
      }),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send notification emails.";
    return Response.json({ error: message }, { status: 500 });
  }
}
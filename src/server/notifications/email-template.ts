const LOGO_CONTENT_ID = "trailgrad-logo";

export const TRAILGRAD_LOGO_CID = `cid:${LOGO_CONTENT_ID}`;
export const TRAILGRAD_LOGO_CONTENT_ID = LOGO_CONTENT_ID;

export interface TeacherWelcomeTemplateInput {
  teacherName: string;
  candidateName: string;
  focus: string;
  practiceUrl: string;
}

/**
 * Email-client-safe welcome template.
 *
 * Tables and inline styles are intentional: Gmail and Outlook still strip or
 * reinterpret modern layout CSS. The design stays close to the calm,
 * single-column Docker reference while using Trailgrad's mark and a dark CTA.
 */
export function teacherWelcomeEmailHtml(input: TeacherWelcomeTemplateInput): string {
  const teacher = escapeHtml(input.teacherName);
  const candidate = escapeHtml(input.candidateName);
  const focus = escapeHtml(input.focus);
  const practiceUrl = escapeAttribute(input.practiceUrl);
  const preview = escapeHtml(
    `${input.teacherName} prepared your first focused Trailgrad practice path.`
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>Your Trailgrad practice path is ready</title>
    <style>
      @font-face {
        font-family: 'Raleway';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        mso-font-alt: 'Arial';
        src: url('https://fonts.gstatic.com/s/raleway/v37/1Ptug8zYS_SKggPNyC0IT4ttDfA.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Raleway';
        font-style: normal;
        font-weight: 600;
        font-display: swap;
        mso-font-alt: 'Arial';
        src: url('https://fonts.gstatic.com/s/raleway/v37/1Ptug8zYS_SKggPNyC0IT4ttDfA.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Raleway';
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        mso-font-alt: 'Arial';
        src: url('https://fonts.gstatic.com/s/raleway/v37/1Ptug8zYS_SKggPNyC0IT4ttDfA.woff2') format('woff2');
      }
      body, table, td, a, p, h1, span, strong {
        font-family: 'Raleway', 'Trebuchet MS', Arial, Helvetica, sans-serif;
      }
      @media only screen and (max-width: 620px) {
        .email-shell {
          padding: 20px 10px !important;
        }
        .email-card {
          border-radius: 14px !important;
        }
        .email-brand {
          padding: 30px 24px 14px !important;
        }
        .email-content {
          padding: 10px 24px 34px !important;
        }
        .email-heading {
          font-size: 27px !important;
          line-height: 34px !important;
          letter-spacing: -0.5px !important;
        }
        .email-step {
          padding: 18px !important;
        }
        .email-cta-table,
        .email-cta-cell,
        .email-cta {
          width: 100% !important;
        }
        .email-cta {
          box-sizing: border-box !important;
          text-align: center !important;
        }
        .email-footer {
          padding: 20px 24px !important;
        }
      }
    </style>
    <!--[if mso]>
      <style type="text/css">
        body, table, td, a, p, h1, span, strong {
          font-family: Arial, Helvetica, sans-serif !important;
        }
      </style>
    <![endif]-->
  </head>
  <body style="margin:0;padding:0;background:#f5f5f3;color:#202124;font-family:'Raleway','Trebuchet MS',Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f5f5f3;">
      <tr>
        <td align="center" class="email-shell" style="padding:42px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e7e7e3;border-radius:18px;">
            <tr>
              <td class="email-brand" style="padding:42px 46px 18px 46px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="46" height="46" align="center" valign="middle" style="width:46px;height:46px;background:#18191c;border-radius:12px;">
                      <img src="${TRAILGRAD_LOGO_CID}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border:0;outline:none;">
                    </td>
                    <td style="padding-left:12px;font-size:23px;line-height:28px;font-weight:700;letter-spacing:-0.6px;color:#18191c;">Trailgrad</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:12px 46px 46px 46px;">
                <p style="margin:0 0 24px 0;font-size:17px;line-height:27px;color:#202124;">Hi ${candidate},</p>
                <h1 class="email-heading" style="margin:0 0 20px 0;font-size:30px;line-height:38px;font-weight:700;letter-spacing:-0.8px;color:#18191c;">Your first practice path is ready.</h1>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:27px;color:#3f4145;">I’m <strong style="color:#18191c;">${teacher}</strong>, your teacher at Trailgrad. I’ve reviewed the experience and projects in your resume and shaped your first path around <strong style="color:#18191c;">${focus}</strong>.</p>
                <p style="margin:0 0 28px 0;font-size:16px;line-height:27px;color:#3f4145;">I’ll guide you one question at a time—what to practise, why it matters, and when you’re ready to move forward.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 30px 0;background:#f7f7f5;border-radius:12px;">
                  <tr>
                    <td class="email-step" style="padding:20px 22px;">
                      <p style="margin:0 0 7px 0;font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;color:#74767b;">Your first step</p>
                      <p style="margin:0;font-size:16px;line-height:25px;color:#27292d;">Complete one focused question. That is enough to start building a real readiness signal.</p>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-cta-table" style="margin:0 0 32px 0;">
                  <tr>
                    <td align="center" bgcolor="#18191c" class="email-cta-cell" style="border-radius:10px;background:#18191c;">
                      <a href="${practiceUrl}" class="email-cta" style="display:inline-block;padding:14px 24px;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Start your first question</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0;font-size:15px;line-height:25px;color:#4f5156;">See you inside,<br><strong style="color:#18191c;">${teacher}</strong><br><span style="color:#74767b;">Your teacher at Trailgrad</span></p>
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:22px 46px;border-top:1px solid #ecece8;font-size:12px;line-height:19px;color:#85878b;">You received this because you created a Trailgrad account and completed onboarding.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

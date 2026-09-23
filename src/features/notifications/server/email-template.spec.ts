import {
  isEmailHtmlSafeToSend,
  teacherWelcomeEmailHtml,
  TRAILGRAD_LOGO_CID
} from "./email-template";

describe("teacher welcome email template", () => {
  it("renders the Trailgrad mark, dark CTA and personalized teacher copy", () => {
    const html = teacherWelcomeEmailHtml({
      teacherName: "Ethan",
      candidateName: "Vikram",
      focus: "Technical depth",
      practiceUrl: "https://trailgrad.com/practice"
    });

    expect(html).toContain(`src="${TRAILGRAD_LOGO_CID}"`);
    expect(html).toContain("trailgrad");
    expect(html).toContain("I’m <strong");
    expect(html).toContain("Ethan");
    expect(html).toContain("Technical depth");
    expect(html).toContain('bgcolor="#18191c"');
    expect(html).toContain('href="https://trailgrad.com/practice"');
    expect(html).toContain("Start your first question");
    expect(html).toContain("Raleway");
    expect(html).toContain("-apple-system");
    expect(html).not.toContain("Trebuchet MS");
    expect(html).toContain("font-family: Arial, Helvetica, sans-serif !important;");
    expect(html).toContain("@media only screen and (max-width: 620px)");
    expect(html).toContain('class="email-content"');
    expect(html).toContain('class="email-cta"');
    expect(isEmailHtmlSafeToSend(html)).toBe(true);

    const rendered = new DOMParser().parseFromString(html, "text/html");
    const visibleText = rendered.body.textContent ?? "";
    expect(visibleText).not.toMatch(/\b(?:style|class|href|src)=['"]/i);
    expect(visibleText.match(/Hi Vikram,/g)).toHaveLength(1);
    expect(visibleText.match(/Your first practice path is ready\./g)).toHaveLength(1);
  });

  it("escapes candidate-derived copy before inserting it into HTML", () => {
    const html = teacherWelcomeEmailHtml({
      teacherName: "Ethan",
      candidateName: '<script>alert("x")</script>',
      focus: "React & accessibility",
      practiceUrl: 'https://trailgrad.com/practice?from="email"'
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("React &amp; accessibility");
    expect(html).toContain("&quot;email&quot;");
  });

  it("rejects persisted HTML with attributes leaked into visible email copy", () => {
    const malformed = `<html><body style="margin:0">style="margin:0;color:#202124;">
      <h1>Your first practice path is ready.</h1>
      <p>style="font-size:16px;">Start practising</p>
    </body></html>`;

    expect(isEmailHtmlSafeToSend(malformed)).toBe(false);
  });
});

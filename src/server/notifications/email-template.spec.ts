import { teacherWelcomeEmailHtml, TRAILGRAD_LOGO_CID } from "./email-template";

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
    expect(html).toContain("font-family: 'Raleway';");
    expect(html).toContain("font-family:'Raleway','Trebuchet MS',Arial,Helvetica,sans-serif");
    expect(html).toContain("font-family: Arial, Helvetica, sans-serif !important;");
    expect(html).toContain("@media only screen and (max-width: 620px)");
    expect(html).toContain('class="email-content"');
    expect(html).toContain('class="email-cta"');
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
});

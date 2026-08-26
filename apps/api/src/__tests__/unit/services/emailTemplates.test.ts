import {
  getHtmlTemplate,
  getHtmlInvitationTemplate,
  getInvitationSubject,
  getPlainTextInvitationTemplate,
  getPlainTextTemplate,
  getSubject,
} from "../../../services/emailTemplates";

describe("ZeroDrive email templates", () => {
  const appUrl = "https://zerodrive.xyz";

  it("renders a privacy-safe registered-recipient notification", () => {
    const html = getHtmlTemplate({
      recipientEmail: "recipient@example.com",
      appUrl: `${appUrl}/`,
      customMessage: "This protected message must not enter the email.",
    });
    const text = getPlainTextTemplate({
      recipientEmail: "recipient@example.com",
      appUrl,
      customMessage: "This protected message must not enter the email.",
    });

    expect(getSubject()).toBe("An encrypted file is waiting on ZeroDrive");
    expect(html).toContain(`${appUrl}/shared-with-me`);
    expect(html).toContain("An encrypted file is waiting");
    expect(html).toContain(
      "Someone shared an encrypted file with you on ZeroDrive",
    );
    expect(text).toContain(
      "Someone shared an encrypted file with you on ZeroDrive",
    );
    expect(html).toContain("#fffdf7");
    expect(text).toContain(`${appUrl}/shared-with-me`);
    expect(html).not.toContain("recipient@example.com");
    expect(html).not.toContain("This protected message");
    expect(text).not.toContain("This protected message");
  });

  it("renders an actionable invitation without unsafe HTML", () => {
    const senderMessage = '<img src=x onerror="alert(1)"> & hello';
    const html = getHtmlInvitationTemplate({
      recipientEmail: "new@example.com",
      appUrl,
      senderMessage,
    });
    const text = getPlainTextInvitationTemplate({
      recipientEmail: "new@example.com",
      appUrl,
      senderMessage: "Hello from the invitation flow.",
    });

    expect(getInvitationSubject()).toBe("Set up secure receiving on ZeroDrive");
    expect(html).toContain("Set up secure receiving");
    expect(html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; hello",
    );
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("new@example.com");
    expect(text).toContain("Create your sharing identity");
    expect(text).toContain("Hello from the invitation flow.");
  });
});

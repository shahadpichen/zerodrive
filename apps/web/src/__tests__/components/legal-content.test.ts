import { privacyPolicy } from "../../components/privacy-content";
import { termsOfService } from "../../components/terms-content";

describe("public legal content", () => {
  it("explains sender and recipient responsibility for encrypted shares", () => {
    const sharedContentTerms = termsOfService.find(
      ({ heading }) => heading === "Shared content and recipient safety",
    );

    expect(sharedContentTerms?.content).toContain(
      "ZeroDrive cannot ordinarily inspect, review, scan, verify, approve, or endorse them",
    );
    expect(sharedContentTerms?.content).toContain(
      "Recipients are responsible for deciding whether they trust",
    );
    expect(sharedContentTerms?.content).toContain(
      "leave it unopened and allow it to expire",
    );
    expect(sharedContentTerms?.content).toContain(
      "report suspicious, illegal, abusive, malicious, or harmful use",
    );
    expect(sharedContentTerms?.content).toContain(
      "Nothing in these Terms excludes liability or legal rights that cannot lawfully be excluded",
    );
  });

  it("discloses how information submitted in an abuse report is processed", () => {
    const abuseReportPrivacy = privacyPolicy.find(
      ({ heading }) => heading === "Encrypted content and abuse reports",
    );

    expect(abuseReportPrivacy?.content).toContain(
      "cannot ordinarily determine what a shared file contains",
    );
    expect(abuseReportPrivacy?.content).toContain(
      "information you voluntarily provide in the report",
    );
    expect(abuseReportPrivacy?.content).toContain(
      "does not require you to decrypt, download, or save it",
    );
    expect(abuseReportPrivacy?.content).toContain(
      "Do not send your recovery phrase",
    );
  });
});

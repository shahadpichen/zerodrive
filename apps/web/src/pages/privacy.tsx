import React from "react";
import { Link } from "react-router-dom";
import Header from "../components/landing-page/header";
import Markdown from "markdown-to-jsx";
import Footer from "../components/landing-page/footer";
import { privacyPolicy } from "../components/privacy-content";

function Privacy() {
  return (
    <main className="container mx-auto w-full relative bg-background text-foreground">
      <Header />
      <div className="lg:px-[10vw] px-5 mx-auto mt-20 max-w-screen-xl sm:px-6">
        <section className="border p-8 md:p-12">
          <div className="w-fit border px-4 py-1 text-sm font-semibold">
            ZeroDrive privacy
          </div>
          <h1 className="mt-8 max-w-4xl text-3xl leading-tight md:text-5xl">
            Privacy explained for an encrypted Google Drive vault.
          </h1>
          <p className="mt-6 max-w-4xl text-base font-light leading-relaxed text-muted-foreground md:text-lg">
            ZeroDrive is built to minimize what the service can know. Your files
            are encrypted before upload, but the app still needs limited Google
            access and minimal account information to work.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="border px-3 py-1">No Google profile photo</span>
            <span className="border px-3 py-1">Limited Drive access</span>
            <span className="border px-3 py-1">Recovery phrase stays local</span>
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">
              Plain-language summary
            </p>
            <h2 className="mt-4 text-2xl">What matters most</h2>
          </div>
          <div className="border p-6 text-base font-light leading-relaxed text-muted-foreground">
            ZeroDrive adds encryption before your files reach Google Drive. It
            asks Google for your email and narrow Drive permissions, not profile
            photo access. The server should not receive your readable files,
            recovery phrase, or private decryption keys.
          </div>
        </section>

        <section className="mt-12 border">
          {privacyPolicy.map((section, index) => (
            <article
              key={section.heading}
              className="grid gap-4 border-b p-6 last:border-b-0 md:grid-cols-[0.45fr_1fr] md:p-8"
            >
              <div>
                <span className="text-sm text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-3 text-xl font-semibold">
                  {section.heading}
                </h2>
              </div>
              <Markdown className="text-base font-light leading-relaxed text-muted-foreground">
                {section.content}
              </Markdown>
            </article>
          ))}
        </section>

        <div className="mt-10 flex justify-between border p-5 text-sm">
          <Link to="/terms" className="font-medium underline underline-offset-4">
            Read Terms of Service
          </Link>
          <Link to="/" className="text-muted-foreground hover:underline">
            Back to ZeroDrive
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}

export default Privacy;

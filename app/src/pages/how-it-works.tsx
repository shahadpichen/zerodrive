import React from "react";
import Header from "../components/landing-page/header";
import Markdown from "markdown-to-jsx";
import Footer from "../components/landing-page/footer";
import { HowItWorksContent } from "../components/how-it-works-content";

function HowItWorks() {
  return (
    <main className="container mx-auto w-full relative">
      <Header />

      <div className="px-10 mt-20">
        <h1 className="text-xl sm:text-4xl md:text-6xl text-center cabin-sketch font-medium">
          How ZeroDrive{" "}
          <span className="text-blue-800 dark:text-blue-400">Protects</span>{" "}
          Your Files
        </h1>
        <p className="text-center text-muted-foreground font-light text-xl mt-6 md:mt-10 max-w-3xl mx-auto">
          End-to-end encryption, zero-knowledge architecture, and open-source
          transparency—all working together to keep your data private.
        </p>
      </div>

      <div className="text-center pb-[2vh] px-[8vw] flex flex-col gap-[5vh] mt-20">
        {HowItWorksContent.map((section, index) =>
          section.illustration ? (
            <div
              key={index}
              className={`flex w-full flex-col items-center justify-between gap-10 mb-[20px] ${
                section.illustrationSide === "left"
                  ? "lg:flex-row-reverse"
                  : "lg:flex-row"
              }`}
            >
              <div className="flex-1 text-center lg:text-left">
                <h2 className="text-4xl cabin-sketch mb-[20px]">
                  {section.heading}
                </h2>
                <Markdown className="inline-block font-light text-xl">
                  {section.content}
                </Markdown>
              </div>
              <div className="flex-1">
                <img
                  src={`${process.env.PUBLIC_URL}${section.illustration}`}
                  alt={section.illustrationAlt ?? section.heading}
                  className="h-auto"
                />
              </div>
            </div>
          ) : (
            <div key={index} className="mb-[20px]">
              <h2 className="text-4xl text-center cabin-sketch mb-[20px]">
                {section.heading}
              </h2>
              <Markdown className="inline-block text-center font-light text-xl">
                {section.content}
              </Markdown>
            </div>
          ),
        )}

        <div className="mb-[20px]">
          <h2 className="text-4xl text-center cabin-sketch mb-[20px]">
            Important Security Notes
          </h2>
          <Markdown className="inline-block text-center font-light text-xl">
            {[
              "If you lose your <u>12-word recovery phrase</u>, your encrypted data will be permanently inaccessible. There is no password reset.<br/><br/>",
              "Do not delete or modify encrypted files directly on Google Drive, as this may corrupt your data.<br/><br/>",
              "Never share your recovery phrase or private keys with anyone—not even ZeroDrive support.",
            ].join("")}
          </Markdown>
        </div>
      </div>

      <h1 className="text-xl sm:text-4xl md:text-6xl text-center cabin-sketch font-medium mt-28 mb-20">
        You hold the keys. <br /> You hold the files. <br />{" "}
        <span className="text-blue-800 dark:text-blue-400">
          We can't read either.
        </span>
      </h1>

      <Footer />
    </main>
  );
}

export default HowItWorks;

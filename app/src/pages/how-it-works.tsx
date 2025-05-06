import React from "react";
import Header from "../components/landing-page/header";
import Markdown from "markdown-to-jsx";
import Footer from "../components/landing-page/footer";
import { HowItWorksContent } from "../components/how-it-works-content";

function HowItWorks() {
  return (
    <main className="container mx-auto w-full relative">
      <Header />
      <div className="lg:px-[12vw] px-5 mx-auto mt-20 space-y-12 max-w-screen-xl sm:px-6">
        {HowItWorksContent.map((section, index) => (
          <div key={index} className="mb-[20px]">
            <h2 className="text-2xl font-semibold mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="leading-relaxed font-light text-base">
              {section.content}
            </Markdown>
          </div>
        ))}
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <p className="font-medium">⚠️ Important Warning:</p>
          <ul className="list-disc ml-5 mt-2">
            <li>
              If you lose your encryption key, your encrypted data will be
              permanently inaccessible.
            </li>
            <li>
              Do not delete or modify encrypted files directly on Google Drive
              as this may corrupt your data.
            </li>
          </ul>
        </div>
      </div>

      <Footer />
    </main>
  );
}

export default HowItWorks;

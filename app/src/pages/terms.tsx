import React from "react";
import Header from "../components/landing-page/header";
import Markdown from "markdown-to-jsx";
import Footer from "../components/landing-page/footer";
import { termsOfService } from "../components/terms-content";

function Terms() {
  return (
    <main className="container mx-auto w-full relative">
      <Header />
      <div className="lg:px-[12vw] px-5 mx-auto mt-20  space-y-12 max-w-screen-xl sm:px-6">
        {termsOfService.map((section, index) => (
          <div key={index}>
            <h2 className="text-2xl font-semibold mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="leading-relaxed font-light text-base">
              {section.content}
            </Markdown>
          </div>
        ))}
      </div>
      <Footer />
    </main>
  );
}

export default Terms;

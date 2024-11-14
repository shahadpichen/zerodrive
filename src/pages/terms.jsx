import React from "react";
import Header from "../components/landing-page/header";
import Markdown from "markdown-to-jsx";
import Footer from "../components/landing-page/footer";
import { termsOfService } from "../components/terms-content";

function Terms() {
  return (
    <main className="px-[12vw] w-full bg-[#F5F8F9] plus-jakarta-sans-uniquifier">
      <Header />
      <div className="lg:px-[12vw] pb-[5vh] px-5 flex flex-col gap-6">
        {termsOfService.map((section, index) => (
          <div key={index} className="mb-[20px]">
            <h2 className="text-2xl font-semibold mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="leading-relaxed font-light text-base text-zinc-500">
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

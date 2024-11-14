import React from "react";
import Header from "../components/landing-page/header";
import Markdown from "markdown-to-jsx";
import Footer from "../components/landing-page/footer";
import { termsOfService } from "../components/terms-content";

function Terms() {
  return (
    <main className="plus-jakarta-sans-uniquifier">
      <Header />
      <div className="lg:container pb-[5vh] px-5 my-[10vh] lg:mx-auto flex flex-col">
        <h1 className="font-bold text-3xl">ZeroDrive Terms of Service</h1>
        {termsOfService.map((section, index) => (
          <div key={index} className="mb-[20px]">
            <h2 className="text-2xl font-semibold mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="leading-relaxed font-light text-lg text-zinc-500">
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

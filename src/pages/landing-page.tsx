import { Button } from "../components/ui/button";
import React from "react";
import Markdown from "markdown-to-jsx";
import { content } from "../components/landing-page/content";

function LandingPage() {
  return (
    <section className="w-full h-screen">
      <div className="px-4 mx-auto mt-10 max-w-screen-xl sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 xl:mt-28">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-10 sm:text-4xl sm:leading-none md:text-5xl">
            End-to-End Encrypted Files on{" "}
            <span className="text-indigo-600">
              Google <br></br> Drive for Secure Storage
            </span>
          </h1>
          <p className="max-w-md leading-relaxed text-zinc-500 font-light mx-auto mt-3 text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            A simple, privacy-focused solution for secure file storage on Google
            Drive. Our open-source tool encrypts your files on your device,
            ensuring they remain private and protected. Fully transparent and
            designed for your peace of mind.
          </p>
          <div className="max-w-md mx-auto mt-5 sm:flex sm:justify-center md:mt-8">
            <Button className="text-lg p-6 bg-indigo-600 hover:bg-indigo-700">
              <a href="/storage">Get Started</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="container my-[10vh] mx-auto flex flex-col gap-6">
        {content.map((section, index) => (
          <div key={index} className="mb-[20px]">
            <h2 className="text-2xl font-medium mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="leading-relaxed font-light text-lg text-zinc-500">
              {section.description}
            </Markdown>
          </div>
        ))}
      </div>
    </section>
  );
}

export default LandingPage;

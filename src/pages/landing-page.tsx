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
            <span className="text-blue-600">
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
            <Button className="text-lg p-6 bg-blue-600 hover:bg-blue-700">
              <a href="/storage">Get Started</a>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center my-[15vh]">
        <div className="h-10 bg-[#1C1B21] w-[1200px] relative rounded-t-xl rounded-b-none">
          <div className="rounded-full h-[10px] w-[10px] bg-[#EA6B6C] absolute top-4 left-4"></div>
          <div className="rounded-full h-[10px] w-[10px] bg-[#F6BE4D] absolute top-4 left-8"></div>
          <div className="rounded-full h-[10px] w-[10px] bg-[#63C554] absolute top-4 left-12"></div>
        </div>
        <img
          src="/bg.png"
          width="1200"
          className="shadow-2xl border-2 rounded-b-xl rounded-t-none"
        ></img>
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

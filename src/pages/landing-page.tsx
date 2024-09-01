import { Button } from "../components/ui/button";
import React, { useState } from "react";
import Markdown from "markdown-to-jsx";
import { content } from "../components/landing-page/content";
import { GoogleAuth } from "../components/storage/google-auth";

function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("isAuthenticated") === "true";
  });

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };
  return (
    <section className="w-full h-screen">
      <header className="flex z-10 justify-between pt-5 items-center gap-4 px-4 lg:h-[60px] lg:px-10">
        <h1 className="text-2xl font-bold">Private Drive</h1>
        <div className="flex gap-2">
          <GoogleAuth
            onAuthChange={handleAuthChange}
            padding={3}
            text={"sm"}
            content={"Login with google"}
          />
        </div>
      </header>
      <div className="px-4 mx-auto mt-10 max-w-screen-xl sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 xl:mt-28">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-10 sm:text-4xl sm:leading-none md:text-5xl">
            End-to-End Encrypted Files on<br></br>
            <span className="text-blue-600">Google Drive</span>
          </h1>
          <p className="max-w-md leading-relaxed text-zinc-500 font-light mx-auto mt-3 text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            A simple, privacy-focused solution for secure file storage on Google
            Drive. Our open-source tool encrypts your files on your device,
            ensuring they remain private and protected. Fully transparent and
            designed for your peace of mind.
          </p>
          <div className="max-w-md mx-auto mt-5 sm:flex sm:justify-center md:mt-8">
            <GoogleAuth
              onAuthChange={handleAuthChange}
              padding={6}
              text={"lg"}
              content={"Get Started"}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center my-[15vh]">
        <img src="/bg3.png" width="1200" className="rounded-xl px-1"></img>
      </div>
      <div className="lg:container my-[10vh] lg:mx-auto px-5 flex flex-col gap-6">
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

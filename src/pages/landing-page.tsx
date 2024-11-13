import React, { useState } from "react";
import Markdown from "markdown-to-jsx";
import { content } from "../components/landing-page/content";
import { GoogleAuth } from "../components/landing-page/google-auth";
import Footer from "../components/landing-page/footer";
import Header from "../components/landing-page/header";

function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("isAuthenticated") === "true";
  });

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <section className="w-full h-screen">
      <Header />
      <div className="px-4 mx-auto mt-10 max-w-screen-xl sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 xl:mt-28">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 leading-10 sm:text-4xl sm:leading-none md:text-5xl">
            End-to-End Encrypted File Storage on<br></br>
            <span className="text-blue-600">Google Drive</span>
          </h1>
          <p className="max-w-md leading-relaxed text-zinc-500 font-light mx-auto mt-3 text-base sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            A simple, privacy-focused solution for secure file storage on Google
            Drive. Our open-source tool encrypts your files locally on your
            device and stores them in your Google Account.
          </p>
          <div className="max-w-md mx-auto mt-5 flex justify-center md:mt-8">
            <GoogleAuth onAuthChange={handleAuthChange} />
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center my-[10vh]">
        <u className="text-center text-lg mb-10">"Free forever"</u>
        <img
          src="/bg3.png"
          alt="bg"
          width="1200"
          className="rounded-xl px-1"
        ></img>
      </div>
      <div className="lg:container pb-[5vh] lg:mx-auto px-5 flex flex-col gap-6">
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
      <Footer />
    </section>
  );
}

export default LandingPage;

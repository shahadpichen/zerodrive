import React, { useState } from "react";
import Markdown from "markdown-to-jsx";
import { content } from "../components/landing-page/content";
import { GoogleAuth } from "../components/landing-page/google-auth";
import Footer from "../components/landing-page/footer";
import Header from "../components/landing-page/header";
import { VideoDialog } from "../components/landing-page/video-dialog";

function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("isAuthenticated") === "true";
  });

  const [videoError, setVideoError] = useState(false);

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <section className="px-[2vw] md:px-[12vw] w-full bg-[#F5F8F9] plus-jakarta-sans-uniquifier relative">
      <Header />
      <div className="px-4 mx-auto mt-10 max-w-screen-xl sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 xl:mt-28">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-5xl">
            <h1 className="md:w-[70%] text-center mx-auto leading-tight">
              End-to-End Encrypted File Storage on{" "}
              <span className="text-[#205EF2]">Google Drive</span>
            </h1>
          </h1>
          <p className="max-w-md leading-relaxed text-zinc-500 font-light mx-auto mt-3 text-base sm:text-lg md:mt-5 md:text-lg md:max-w-3xl">
            A simple, privacy-focused solution for secure file storage on Google
            Drive. Our open-source tool encrypts your files locally on your
            device and stores them in your Google Account.
          </p>
          <div className="mt-5 flex items-center justify-center md:mt-8 gap-10">
            <GoogleAuth onAuthChange={handleAuthChange} />
          </div>
          <p className="flex items-center justify-center mx-auto text-sm text-zinc-500 mt-4">
            <span>Free Forever</span>
            {/* .
            <VideoDialog /> */}
          </p>
        </div>
      </div>

      <div className="hidden md:flex flex-col justify-center items-center mt-[10vh] mb-[10vh] relative">
        <img
          src="/updated.png"
          alt="bg"
          width="1200"
          className="border-[6px] border-zinc-800 rounded-2xl"
        ></img>
        <img
          src="/bgpng2.png"
          alt="bg"
          width="150"
          className="rounded-xl absolute top-0 -right-5 shadow-xl animate-float-3 "
        ></img>
        <img
          src="/dragdrop.png"
          alt="bg"
          width="350"
          className="rounded-xl absolute z-10 top-32 -left-20 shadow-xl animate-float-3"
        ></img>
        {/* <img
          src="/key.png"
          alt="bg"
          width="350"
          className="rounded-xl absolute -bottom-10 -left-10 shadow-xl animate-float-1"
        ></img> */}
        <img
          src="/key.png"
          alt="bg"
          width="350"
          className="rounded-xl absolute bottom-20 -right-20 shadow-xl animate-float-2"
        ></img>
      </div>
      <div className="lg:px-[12vw] pb-[5vh] px-5 flex flex-col gap-6 mt-[10vh] md:mt-[15vh]">
        {content.map((section, index) => (
          <div key={index} className="mb-[20px] text-center md:text-left">
            <h2 className="text-2xl font-semibold mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="leading-relaxed font-light text-base text-zinc-500">
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

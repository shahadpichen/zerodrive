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
    <section className="container mx-auto w-full relative">
      <Header />
      <div className="lg:px-[12vw] px-5 mx-auto mt-20 max-w-screen-xl sm:px-6">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl">
            <h1 className="md:w-[70%] mx-auto">
              End-to-End Encrypted File Storage on{" "}
              <span className="text-black dark:text-white">Google Drive</span>
            </h1>
          </h1>
          <ul className="inline-block text-left list-decimal leading-relaxed font-light mt-6 md:mt-10 pl-6">
            <li>
              A{" "}
              <span className="text-black dark:text-white font-medium">
                simple
              </span>
              ,{" "}
              <span className="text-black dark:text-white font-medium">
                privacy-focused
              </span>{" "}
              solution for secure file storage on Google Drive
            </li>
            <li>
              Our open-source tool encrypts your files locally on your device
            </li>
            <li>Securely stores encrypted files in your Google Account</li>
          </ul>
          <div className="mt-8 flex flex-col items-center">
            <GoogleAuth onAuthChange={handleAuthChange} />
            <p className="text-sm mt-4 text-muted-foreground">Free Forever</p>
          </div>
        </div>
      </div>

      <div className="lg:px-[12vw] text-center pb-[5vh] px-5 flex flex-col gap-6 mt-[10vh] md:mt-[15vh]">
        {content.map((section, index) => (
          <div key={index} className="mb-[20px]">
            <h2 className="text-2xl text-center mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="inline-block text-left md:w-[85%] font-light text-base ">
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

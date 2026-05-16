import React, { useState } from "react";
import Markdown from "markdown-to-jsx";
import { content } from "../components/landing-page/content";
import { GoogleAuth } from "../components/landing-page/google-auth";
import Footer from "../components/landing-page/footer";
import Header from "../components/landing-page/header";

interface LandingPageProps {
  onAuthChange?: (authenticated: boolean) => void;
}

function LandingPage({ onAuthChange }: LandingPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem("isAuthenticated") === "true";
  });

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
    // Also update parent App.tsx state if callback provided
    if (onAuthChange) {
      onAuthChange(authenticated);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <section className="container mx-auto w-full relative">
      <Header />
      <div className="px-10 mt-20">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-10">
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-xl sm:text-4xl md:text-6xl cabin-sketch font-medium">
              End-to-End Encrypted File Storage on{" "}
              <span className="text-blue-800 dark:text-blue-400">
                Google Drive
              </span>
            </h1>

            <ul className="inline-block text-base text-left list-decimal leading-relaxed font-light mt-6 md:mt-10 pl-8">
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
              <li>Share files securely with other users</li>
            </ul>

            <div className="mt-8 flex flex-col items-center lg:items-start">
              <GoogleAuth onAuthChange={handleAuthChange} />
              <p className="text-sm mt-4 text-muted-foreground">Free Forever</p>
            </div>
          </div>

          <div className="flex-1 w-full">
            <img
              src={`${process.env.PUBLIC_URL}/hero-section.png`}
              alt="ZeroDrive encrypted file storage interface"
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* <div className="w-full flex justify-center items-center mt-[10vh]">
        <div className="w-fit border-4 pt-10">
          <img
            src={isDark ? PageContentDark : PageContentLight}
            className="w-[1100px]"
          />
        </div>
      </div> */}

      <div className="text-center pb-[2vh] px-[8vw] flex flex-col gap-[5vh] mt-32">
        {content.map((section, index) => (
          <div key={index} className="mb-[20px]">
            <h2 className="text-4xl text-center cabin-sketch mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="inline-block text-center font-light text-xl">
              {section.description}
            </Markdown>
          </div>
        ))}
      </div>

      <h1 className="text-xl sm:text-4xl md:text-6xl text-center cabin-sketch font-medium mt-28 mb-20">
        Privacy through E2E encryption; <br /> Reliability of Google; <br />{" "}
        Freedom of
        <span className="text-blue-800 dark:text-blue-400">open-source.</span>
      </h1>

      <Footer />
    </section>
  );
}

export default LandingPage;

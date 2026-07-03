import React, { useState } from "react";
import Markdown from "markdown-to-jsx";
import { content } from "../components/landing-page/content";
import { GoogleAuth } from "../components/landing-page/google-auth";
import Footer from "../components/landing-page/footer";
import Header from "../components/landing-page/header";
import RecoveryPhrase from "../components/landing-page/recovery-phrase";
import Faq from "../components/landing-page/faq";

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
      <div className="lg:px-[12vw] px-5 mx-auto mt-20 max-w-screen-xl sm:px-6">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl md:w-[70%] mx-auto">
            End-to-End Encrypted File Storage on{" "}
            <span className="text-black dark:text-white">Google Drive</span>
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
            <li>Share files securely with other users</li>
          </ul>

          <div className="mt-8 flex flex-col items-center">
            <GoogleAuth onAuthChange={handleAuthChange} />
            <p className="text-sm mt-4 text-muted-foreground">
              Free Forever — personal file storage only
            </p>
          </div>
        </div>
      </div>

      {/* App preview */}
      <div className="mx-auto max-w-6xl mt-[5vh]">
        <img
          src={`${process.env.PUBLIC_URL}/landing-page.png`}
          alt="ZeroDrive app preview"
          className="w-full h-auto"
        />
      </div>

      {/* <div className="w-full flex justify-center items-center mt-[10vh]">
        <div className="w-fit border-4 pt-10">
          <img
            src={isDark ? PageContentDark : PageContentLight}
            className="w-[1100px]"
          />
        </div>
      </div> */}

      <div className="lg:px-[12vw] text-center pb-[2vh] px-5 flex flex-col gap-6 mt-[5vh]">
        {content.map((section, index) => (
          <div key={index} className="mb-[20px]">
            <h2 className="text-2xl text-center mb-[20px]">
              {section.heading}
            </h2>
            <Markdown className="inline-block text-left md:w-[85%] font-light text-base ">
              {section.description}
            </Markdown>
            {section.heading === "Anonymous File Sharing" && <RecoveryPhrase />}
          </div>
        ))}
      </div>

      <div className="lg:px-[12vw] pb-[2vh] px-5 mt-[10vh]">
        <Faq />
      </div>

      <Footer />
    </section>
  );
}

export default LandingPage;

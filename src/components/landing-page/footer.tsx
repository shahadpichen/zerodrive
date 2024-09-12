import React from "react";
import { useNavigate } from "react-router-dom";

function Footer() {
  const navigate = useNavigate();

  const handleNavigation = (path) => {
    navigate(path);
    window.scrollTo(0, 0);
  };

  return (
    <section className="bg-[#252f3f] h-[15vh] flex items-center justify-around">
      <h1
        className="text-2xl text-white font-bold cursor-pointer"
        onClick={() => handleNavigation("/")}
      >
        ZeroDrive
      </h1>
      <img src="/logo192.png" alt="logo" className="w-14 h-14"></img>
      <div className="flex flex-col text-white opacity-75">
        <h3
          className="cursor-pointer"
          onClick={() => handleNavigation("/terms")}
        >
          Terms and Conditions
        </h3>
        <h3
          className="cursor-pointer"
          onClick={() => handleNavigation("/privacy")}
        >
          Privacy Policy
        </h3>
      </div>
    </section>
  );
}

export default Footer;

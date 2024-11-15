import React from "react";
import { FaGithub } from "react-icons/fa";
import { AiTwotoneQuestionCircle } from "react-icons/ai";
import { useNavigate } from "react-router-dom";

function Header() {
  const navigate = useNavigate();

  return (
    <header className="flex h-[10vh] justify-between pt-5 items-center gap-4 px-10 lg:h-[60px] lg:px-10">
      <a
        onClick={() => navigate("/")}
        className="mr-6 flex items-center space-x-1 cursor-pointer"
      >
        <img src="/logo192.png" alt="ZeroDrive Logo" className="h-10 w-10" />
        <span className="font-bold text-lg sm:inline-block">ZeroDrive</span>
      </a>
      <div className="flex flex-row items-center gap-5">
        <h1
          className="flex items-center gap-1 cursor-pointer"
          onClick={() => navigate("/how-it-works")}
        >
          <AiTwotoneQuestionCircle className="text-xl" />
          <span className="text-sm font-medium">How it works</span>
        </h1>
        <a
          href="https://github.com/shahadpichen/zerobox"
          target="_blank"
          rel="noopener noreferrer"
        >
          <h1 className="flex items-center gap-1">
            <FaGithub className="text-xl" />
            <span className="text-sm font-medium">Github</span>
          </h1>
        </a>
      </div>
    </header>
  );
}

export default Header;

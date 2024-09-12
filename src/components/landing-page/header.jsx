import React from "react";
import { FaGithub } from "react-icons/fa";

function Header() {
  return (
    <header className="flex z-10 justify-between pt-5 items-center gap-4 px-4 lg:h-[60px] lg:px-10">
      <h1 className="text-2xl font-bold">ZeroDrive</h1>
      <a
        href="https://github.com/shahadpichen/zerobox"
        target="_blank"
        rel="noopener noreferrer"
      >
        <h1 className="flex gap-2">
          <FaGithub className="text-2xl" />
          View on GitHub
        </h1>
      </a>
    </header>
  );
}

export default Header;

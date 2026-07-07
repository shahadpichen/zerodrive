import React from "react";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "../../components/mode-toggle";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";

function Header() {
  const navigate = useNavigate();

  return (
    <header className="flex h-[10vh] items-center justify-between border-b px-4 sm:px-6 lg:px-10">
      {/* Logo */}
      <button
        onClick={() => navigate("/")}
        className="flex cursor-pointer items-center space-x-1 border-none bg-transparent p-0"
      >
        <span className="text-lg font-semibold">ZeroDrive</span>
      </button>

      {/* Desktop Navigation */}
      <div className="hidden items-center gap-5 md:flex">
        <button
          onClick={() => navigate("/docs")}
          className="border-none bg-transparent p-0 text-sm font-medium hover:underline"
        >
          Docs
        </button>

        <a
          href="https://github.com/shahadpichen/zerodrive"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline"
        >
          Star on GitHub
        </a>

        <ModeToggle />
      </div>

      {/* Mobile Navigation */}
      <div className="flex items-center gap-3 md:hidden">
        <ModeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-md border px-3 py-2 text-sm font-medium">
              Menu
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate("/docs")}>
              Docs
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <a
                href="https://github.com/shahadpichen/zerodrive"
                target="_blank"
                rel="noopener noreferrer"
              >
                Star on GitHub
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Header;

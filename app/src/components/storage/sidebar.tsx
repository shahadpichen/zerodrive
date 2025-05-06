import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { Cloud, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Section = "files" | "favorites" | "trash";

interface SidebarProps {
  activeSection: Section;
  setActiveSection: (section: Section) => void;
}

const sidebarItems = [
  {
    id: "files" as const,
    label: "My Files",
  },
  {
    id: "favorites" as const,
    label: "Favorites",
  },
  {
    id: "trash" as const,
    label: "Recycle Bin",
  },
] as const;

export function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const SidebarContent = () => (
    <>
      <div className="mt-14 md:mt-0">
        <div className="flex items-center gap-2 mb-4 ">
          <Cloud className="text-foreground" size={16} strokeWidth={1.5} />
          <span className="text-sm font-medium">Your Vault</span>
        </div>
        <nav className="space-y-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 w-full  px-3 py-2 text-sm font-medium transition-colors",
                activeSection === item.id
                  ? "text-secondary-foreground"
                  : "hover:text-muted-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex flex-col gap-2 text-sm pb-5 pr-2 pl-2">
        <div className="border-b border-black space-y-3 pb-5 text-gray-500">
          <p
            onClick={() => navigate("/privacy")}
            className="hover:underline cursor-pointer"
          >
            Privacy Policy
          </p>
          <p
            onClick={() => navigate("/terms")}
            className="hover:underline cursor-pointer"
          >
            Terms of Condition
          </p>
        </div>
        <p>Copyright &copy; All Rights Reserved</p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={toggleMobileMenu}
        className="md:hidden fixed top-4 left-4 z-50 p-2 hover:bg-muted rounded-md"
        aria-label="Toggle menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden bg-black bg-opacity-50 transition-opacity",
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      >
        <div
          className={cn(
            "fixed inset-y-0 left-0 w-64 bg-[#FAFAFA] p-6 transform transition-transform duration-300 ease-in-out flex flex-col justify-between",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <SidebarContent />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-[20vw] border-r p-6 h-[90vh] flex-col justify-between bg-[#FAFAFA]">
        <SidebarContent />
      </div>
    </>
  );
}

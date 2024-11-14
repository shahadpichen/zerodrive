import React from "react";
import { cn } from "../../lib/utils";
import { FaCloud } from "react-icons/fa";
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

  return (
    <div className="w-[20vw] border-r p-6 h-[90vh] flex flex-col justify-between bg-[#FAFAFA]">
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FaCloud className="text-black" />
          <span className="text-sm font-medium">Your Vault</span>
        </div>
        <nav className="space-y-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                activeSection === item.id
                  ? "text-secondary-foreground"
                  : "hover: text-muted-foreground"
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
    </div>
  );
}

import React from "react";
import { cn } from "../../lib/utils";

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
  return (
    <div className="w-64 border-r border-border/40 p-4 h-[92vh] flex flex-col justify-between">
      <nav className="space-y-2">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              activeSection === item.id
                ? "bg-secondary text-secondary-foreground"
                : "hover:bg-secondary/80 text-muted-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-2">
        <div className="border-b">
          <p>Privacy Policy</p>
          <p>Terms of Condition</p>
        </div>
        <p>Copyright &copy; All Rights Reserved</p>
      </div>
    </div>
  );
}

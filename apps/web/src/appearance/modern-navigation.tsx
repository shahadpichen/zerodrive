import { useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  FolderLock,
  Send,
  Inbox,
  KeyRound,
  BookOpen,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "../components/theme-provider";
import { ModeToggle } from "../components/mode-toggle";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Brand } from "./brand";

const destinations = [
  { to: "/home", label: "Overview", icon: Home },
  { to: "/storage", label: "My storage", icon: FolderLock },
  { to: "/share", label: "Share a file", icon: Send },
  { to: "/shared-with-me", label: "Shared with me", icon: Inbox },
  { to: "/recovery-access", label: "Recovery & access", icon: KeyRound },
  { to: "/docs", label: "Help & guides", icon: BookOpen },
];

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {destinations.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function ModernNavigation() {
  const { interfaceStyle } = useTheme();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  if (interfaceStyle !== "modern") return null;
  return (
    <>
      <aside className="modern-sidebar fixed inset-y-0 left-0 z-30 w-64 flex-col border-r bg-card p-5">
        <NavLink to="/home" className="mb-10 px-3 py-3">
          <Brand />
        </NavLink>
        <NavigationLinks />
        <div className="mt-auto pt-8">
          <div className="mb-5 rounded-xl border p-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mb-2 h-5 w-5 text-foreground" />
            Your files are encrypted in your browser. Your keys stay with you.
          </div>
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground">Make it yours</span>
            <ModeToggle />
          </div>
        </div>
      </aside>
      <div className="mb-4 flex items-center justify-between border-b bg-card px-5 py-3 lg:hidden">
        <NavLink to="/home">
          <Brand />
        </NavLink>
        <div className="flex gap-2">
          <ModeToggle />
          <Button
            variant="outline"
            size="icon"
            aria-label="Open navigation"
            ref={menuButton}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="modern-navigation-drawer"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            menuButton.current?.focus();
          }}
        >
          <DialogTitle>Explore ZeroDrive</DialogTitle>
          <DialogDescription>
            Your files, sharing, and recovery tools.
          </DialogDescription>
          <NavigationLinks onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

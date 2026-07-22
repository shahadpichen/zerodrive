import { KeyRound } from "lucide-react";
import { Button } from "./ui/button";

type VaultAccessIntent = "share" | "inbox";

interface VaultAccessRequiredProps {
  intent: VaultAccessIntent;
  onSetUpAccess: () => void;
  className?: string;
}

const accessCopy: Record<
  VaultAccessIntent,
  { title: string; description: string; action: string }
> = {
  share: {
    title: "Set up Recovery & Access first",
    description:
      "Create or enter your recovery phrase so ZeroDrive can encrypt this file locally for the recipient.",
    action: "Set up access",
  },
  inbox: {
    title: "Set up Recovery & Access first",
    description:
      "Create or enter your recovery phrase so ZeroDrive can open shared files locally or save encrypted copies to Storage.",
    action: "Set up access",
  },
};

export function VaultAccessRequired({
  intent,
  onSetUpAccess,
  className = "",
}: VaultAccessRequiredProps) {
  const copy = accessCopy[intent];

  return (
    <div className={`border ${className}`}>
      <div className="border-b p-6 sm:p-8">
        <div className="flex h-10 w-10 items-center justify-center border">
          <KeyRound className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-lg font-semibold">{copy.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {copy.description} Set up or recover your key in Recovery &amp;
          Access, then ZeroDrive will bring you back here.
        </p>
      </div>
      <div className="flex flex-col gap-2 p-6 sm:flex-row sm:p-8">
        <Button onClick={onSetUpAccess}>
          <KeyRound />
          {copy.action}
        </Button>
      </div>
    </div>
  );
}

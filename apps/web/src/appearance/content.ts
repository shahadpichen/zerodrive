import { useTheme } from "../components/theme-provider";

type PageCopy = { title: string; description: string };
type ExperienceCopy = {
  storage: PageCopy;
  share: PageCopy;
  inbox: PageCopy;
  recovery: PageCopy;
};
export const interfaceCopy: Record<"creator" | "modern", ExperienceCopy> = {
  creator: {
    storage: {
      title: "Storage",
      description:
        "This is your encrypted vault. Files are encrypted in this browser before the protected copy is saved to your Google Drive.",
    },
    share: {
      title: "Share a file",
      description:
        "Your browser locks the file so only the chosen recipient can unlock it.",
    },
    inbox: {
      title: "Shared with me",
      description:
        "Encrypted files sent to this ZeroDrive account. Your browser unlocks them only after the sender finalizes the share.",
    },
    recovery: {
      title: "Recovery & Access",
      description:
        "Manage the browser access that protects your encrypted vault. Recovery happens locally; your recovery phrase is not sent to the ZeroDrive server.",
    },
  },
  modern: {
    storage: {
      title: "Your files. Your space.",
      description:
        "Organize your files here. We encrypt them in your browser before saving the protected copies to your Google Drive.",
    },
    share: {
      title: "Send a file. Keep it private.",
      description:
        "Choose a file and a recipient. Your browser encrypts it so only their sharing key can unlock it.",
    },
    inbox: {
      title: "A private inbox for your files",
      description:
        "Find the encrypted files people have shared with you. Your browser unlocks them once the sender completes the share.",
    },
    recovery: {
      title: "Your key to getting back in",
      description:
        "Recover access on this browser, create a key for a new vault, or manage your devices. Your recovery phrase stays on your device.",
    },
  },
};
export function useInterfaceCopy() {
  return interfaceCopy[useTheme().interfaceStyle ?? "creator"];
}

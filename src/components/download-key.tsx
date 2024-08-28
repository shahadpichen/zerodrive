import { useEffect, useState } from "react";
import { generateKey, storeKey } from "../utils/cryptoUtils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialogKey";
import { Input } from "./ui/input";
import { useToast } from "./ui/use-toast";
import React from "react";

export const KeyManagement: React.FC = () => {
  const [keyInput, setKeyInput] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedKey = localStorage.getItem("aes-gcm-key");
    if (!storedKey) {
      setIsDialogOpen(true);
    }
  }, []);

  const handleGenerateAndDownloadKey = async () => {
    const key = await generateKey();
    await storeKey(key);

    const keyJWK = JSON.stringify(await crypto.subtle.exportKey("jwk", key));
    const blob = new Blob([keyJWK], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "encryption-key.json";
    a.click();
    URL.revokeObjectURL(url);

    setIsDialogOpen(false);
  };

  const handleKeyChange = async () => {
    if (keyInput) {
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          JSON.parse(keyInput),
          { name: "AES-GCM" },
          true,
          ["encrypt", "decrypt"]
        );
        await storeKey(key);
        toast({
          title: "Encryption key added",
          description: "Your encryption key has been added to storage.",
        });
        setIsDialogOpen(false);
      } catch (error) {
        setError(
          "Invalid key format. Please ensure the key is a valid JSON object and follows the correct structure."
        );
      }
    }
  };

  return (
    <Dialog>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Encryption Key</DialogTitle>
          <DialogDescription>
            Please provide your encryption key to secure your files.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Enter your encryption key"
                value={keyInput || ""}
                onChange={(e) => setKeyInput(e.target.value)}
              />
              <Button onClick={handleKeyChange}>Store Key</Button>
            </div>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
          <p className="text-center">----- or -----</p>
          <Button onClick={handleGenerateAndDownloadKey}>
            Generate Encryption Key
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

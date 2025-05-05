import { useState } from "react";
import { generateKey, storeKey } from "../../utils/cryptoUtils";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import React from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";

interface KeyManagementProps {
  onClose?: () => void;
}

export const KeyManagement: React.FC<KeyManagementProps> = ({ onClose }) => {
  const [error, setError] = useState("");

  const handleGenerateAndDownloadKey = async () => {
    try {
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

      toast.success("Encryption key generated", {
        description: "Your encryption key has been generated and stored.",
      });
      if (onClose) {
        onClose();
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      setError("Failed to generate encryption key. Please try again.");
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const keyJWK = JSON.parse(e.target?.result as string);

          if (
            !keyJWK.kty ||
            keyJWK.kty !== "oct" ||
            !keyJWK.k ||
            !keyJWK.alg ||
            keyJWK.alg !== "A256GCM"
          ) {
            throw new Error("Invalid key format");
          }

          const key = await crypto.subtle.importKey(
            "jwk",
            keyJWK,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"]
          );
          await storeKey(key);
          toast.success("Encryption key added", {
            description: "Your encryption key has been added to storage.",
          });
          if (onClose) {
            onClose();
          } else {
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        } catch (error) {
          setError(
            "Invalid key file. Please ensure the file contains a valid AES-GCM key in JSON format."
          );
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <>
      <div className="fixed z-40 bg-black opacity-75 top-0 left-0 w-full min-h-screen"></div>
      <div className="fixed z-50 flex justify-center top-0 left-0 items-center w-full min-h-screen">
        <Card className="sm:max-w-[425px] relative">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 hover:bg-muted p-1 rounded-full"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
          <CardHeader>
            <CardTitle>Encryption Key Management</CardTitle>
            <CardDescription>
              For first-time users, generate and download your encryption key.
              Store it securely—losing it means losing access to your files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <Button onClick={handleGenerateAndDownloadKey}>
                Generate Encryption Key
              </Button>

              <p className="text-center">----- Already have a key? -----</p>
              <div className="flex flex-col gap-1">
                <Label className="block text-sm bg-foreground text-primary hover:bg-primary hover:text-foreground border border-foreground cursor-pointer p-2 text-center">
                  <span>Upload your encryption key</span>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </Label>
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

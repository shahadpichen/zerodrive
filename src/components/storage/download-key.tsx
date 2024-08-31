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
import { useToast } from "../ui/use-toast";
import React from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export const KeyManagement: React.FC = () => {
  const [error, setError] = useState("");
  const { toast } = useToast();

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

      toast({
        title: "Encryption key generated",
        description: "Your encryption key has been generated and stored.",
      });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
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
          toast({
            title: "Encryption key added",
            description: "Your encryption key has been added to storage.",
          });
          setTimeout(() => {
            window.location.reload();
          }, 2000);
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
      <div className="fixed z-10 bg-black opacity-75 top-0 left-0 w-full min-h-screen"></div>
      <div className="fixed z-10 flex justify-center top-0 left-0 items-center w-full min-h-screen">
        <Card className="sm:max-w-[425px]">
          <CardHeader>
            <CardTitle>Add Encryption Key</CardTitle>
            <CardDescription>
              Please upload your encryption key to secure your files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex flex-col gap-1">
                <Label className="block text-sm cursor-pointer border border-gray-300 rounded-md p-2 text-center bg-white hover:bg-gray-50">
                  <span>Add your encryption key</span>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </Label>
                <p className="text-red-500 text-sm">{error}</p>
              </div>
              <p className="text-center">----- or -----</p>
              <Button onClick={handleGenerateAndDownloadKey}>
                Generate Encryption Key
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

import React, { useState } from "react";
import { FileList } from "../components/storage/file-list";
import { GoogleAuth } from "../components/storage/google-auth";
import { Toaster } from "../components/ui/toaster";

function PrivateStorage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("isAuthenticated") === "true";
  });

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

  return (
    <section className="bg-[#FAF9F6] h-screen">
      <Toaster />
      <header className="flex z-10 justify-between pt-5 items-center gap-4 px-4 lg:h-[60px] lg:px-10">
        <h1 className="text-2xl font-bold">Private Drive</h1>
        <div className="flex gap-2">
          <GoogleAuth
            onAuthChange={handleAuthChange}
            padding={2}
            text={"sm"}
            content={"Login with google"}
          />
        </div>
      </header>

      <div className="flex w-full">
        <main className="flex flex-1 flex-col gap-4 p-4 pt-2 lg:gap-6 lg:p-6 lg:pt-3">
          {isAuthenticated ? (
            <FileList />
          ) : (
            <p>Please log in to see your files.</p>
          )}
        </main>
      </div>
    </section>
  );
}

export default PrivateStorage;

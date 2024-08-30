import React, { useState } from "react";
import { EncryptedFileUploader } from "../components/storage/file-uploader";
import { FileList } from "../components/storage/file-list";
import { GoogleAuth } from "../components/storage/google-auth";

function PrivateStorage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("isAuthenticated") === "true";
  });

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

  return (
    <section>
      <header className="flex z-10 justify-between h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
        <h1 className="font-bold">Private Drive</h1>
        <div className="flex gap-2">
          <GoogleAuth onAuthChange={handleAuthChange} />
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
      {isAuthenticated && <EncryptedFileUploader />}
    </section>
  );
}

export default PrivateStorage;

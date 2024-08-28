import { useState } from "react";
import { EncryptedFileUploader } from "./components/file-uploader";
import { KeyManagement } from "./components/download-key";
import { FileList } from "./components/file-list";
import { GoogleAuth } from "./components/google-auth";
import React from "react";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const handleAuthChange = (authenticated: boolean) => {
    setIsAuthenticated(authenticated);
  };

  return (
    <main>
      <header className="flex justify-between h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
        <h1 className="font-bold">Private Drive</h1>
        <div className="flex gap-2">
          <GoogleAuth onAuthChange={handleAuthChange} />
        </div>
      </header>

      <KeyManagement />
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
    </main>
  );
}

export default App;

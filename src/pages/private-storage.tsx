import React, { useState } from "react";
import Header from "../components/storage/header";
import { FileList } from "../components/storage/file-list";
import { Sidebar } from "../components/storage/sidebar";

type Section = "files" | "favorites" | "trash";

function PrivateStorage() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>("files");

  const renderContent = () => {
    switch (activeSection) {
      case "files":
        return <FileList />;
      case "favorites":
      case "trash":
        return (
          <div className="flex items-center justify-center h-full">
            <p className="text-xl text-muted-foreground">Coming Soon...</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header setIsAuthenticated={setIsAuthenticated} />
      <div className="flex h-[92vh]">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />
        <div className="flex-1 p-6 overflow-auto">{renderContent()}</div>
      </div>
    </div>
  );
}

export default PrivateStorage;

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { PlayCircle } from "lucide-react";

export function VideoDialog() {
  const [videoError, setVideoError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="bg-transparent px-4 py-2 rounded-none flex items-center underline">
          <PlayCircle className="mr-2 h-6 w-6" />
          <span className="text-sm font-medium">Watch Demo</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] p-0 bg-black border-0">
        <DialogTitle className="sr-only">Product Demo Video</DialogTitle>
        <DialogDescription className="sr-only">
          A demonstration video showing the product features
        </DialogDescription>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin  h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
        <video
          controls
          className="w-full "
          preload="metadata"
          playsInline
          onLoadedData={() => setIsLoading(false)}
          onError={(e) => {
            console.error("Video loading error:", e);
            setVideoError(true);
            setIsLoading(false);
          }}
        >
          <source src="/demo.mp4" type="video/mp4" />
          {videoError ? (
            <div className="p-4 text-white text-center">
              Error loading video. Please try again later.
            </div>
          ) : (
            "Your browser does not support the video tag."
          )}
        </video>
      </DialogContent>
    </Dialog>
  );
}

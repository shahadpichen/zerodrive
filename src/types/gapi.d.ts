declare global {
  interface Window {
    gapi: {
      load: (name: string, callback: () => void) => void;
      auth2: {
        getAuthInstance: () => {
          // Define the structure of the auth instance as needed
          isSignedIn: {
            get: () => boolean;
          };
          signIn: () => Promise<any>; // Adjust the return type as needed
        };
      };
    };
  }
}

export {};

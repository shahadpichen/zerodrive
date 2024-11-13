declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          getAuthInstance: () => {
            currentUser: {
              get: () => {
                getBasicProfile: () => {
                  getImageUrl: () => string;
                  getName: () => string;
                };
              };
            };
          };
        };
      };
    };
  }
}

export {};

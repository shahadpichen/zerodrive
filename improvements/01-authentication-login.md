# Authentication & Login Improvements

**File:** `app/src/components/landing-page/google-auth.tsx`, `app/src/pages/google-oauth-callback.tsx`

## Current Issues

- No loading indicator during Google Auth initialization
- No error messages shown to user when login fails
- Using `window.location.href` instead of React Router
- No handling for cancelled OAuth consent screen
- No session timeout warnings
- Hard page refresh on login

---

## Improvements

### **P1: Add loading states**
- [ ] Show spinner while GAPI initializes
- [ ] Disable "Sign in with Google" button until ready
- [ ] Change button text to "Connecting to Google..." during init
- [ ] Add timeout warning if init takes >5 seconds

**Why:** Users see blank button and don't know if app is working

---

### **P1: Show error messages**
- [ ] Display error toast when OAuth fails
- [ ] Show "Retry" button on failure
- [ ] Handle popup blocker errors with instructions
- [ ] Show friendly error: "Could not connect to Google. Please check your internet connection."

**Why:** Users get stuck with no feedback when login fails

---

### **P2: Use React Router navigation**
- [ ] Replace `window.location.href = "/storage"` with `navigate("/storage")`
- [ ] Remove page reloads
- [ ] Preserve app state during navigation

**Why:** Current approach causes full page reload, loses React state

---

### **P2: Handle OAuth cancellation**
- [ ] Detect when user closes OAuth popup without completing
- [ ] Show message: "Login cancelled. Click to try again."
- [ ] Don't change authentication state

**Why:** User closes popup → nothing happens → confusing

---

### **P2: Session timeout handling**
- [ ] Check if Google token is expired
- [ ] Show warning: "Session expires in 5 minutes"
- [ ] Auto-refresh token before expiry
- [ ] Redirect to login when session expires

**Why:** Users get logged out unexpectedly with no warning

---

### **P3: Multi-account support**
- [ ] Add "Switch Account" button in header
- [ ] Show currently logged-in account
- [ ] Handle account switching gracefully
- [ ] Clear previous account data when switching

**Why:** Users with multiple Google accounts need to switch easily

---

### **P3: Remember session**
- [ ] Add "Stay signed in" checkbox
- [ ] Use secure cookie for longer sessions
- [ ] Implement refresh token rotation

**Why:** Users have to login every time they close browser

---

## Code Examples

### Loading State
```tsx
const [isInitializing, setIsInitializing] = useState(true);

useEffect(() => {
  const initClient = async () => {
    setIsInitializing(true);
    try {
      // ... existing init code
    } finally {
      setIsInitializing(false);
    }
  };
  initClient();
}, []);

return (
  <Button disabled={isInitializing}>
    {isInitializing ? "Connecting..." : "Sign in with Google"}
  </Button>
);
```

### Error Handling
```tsx
const handleSignIn = async () => {
  try {
    // ... existing code
  } catch (error) {
    toast.error("Login failed", {
      description: "Could not connect to Google. Please try again.",
      action: {
        label: "Retry",
        onClick: () => handleSignIn()
      }
    });
  }
};
```

---

## Files to Modify

- `app/src/components/landing-page/google-auth.tsx` - Add loading/error states
- `app/src/pages/google-oauth-callback.tsx` - Handle errors better
- `app/src/pages/landing-page.tsx` - Show errors to user
- `app/src/utils/sessionManager.ts` - Add session timeout logic

---

## Testing Checklist

- [ ] Login succeeds and navigates to storage
- [ ] Login failure shows error message
- [ ] Retry button works after failure
- [ ] Popup blocker is detected and handled
- [ ] Button is disabled during initialization
- [ ] Cancelled OAuth shows appropriate message
- [ ] Session timeout warning appears 5 min before expiry

import { useEffect, useRef } from "react";
import { auth } from "../lib/firebase";
import toast from "react-hot-toast";

/**
 * Custom React hook that automatically logs out a user after a specified period of inactivity.
 * It monitors common user interactions (mouse clicks/moves, key presses, scroll, touch, etc.)
 * and keeps the session active. If the user remains completely idle for the configured timeout,
 * they are securely logged out from Firebase.
 *
 * @param user The current authenticated user object
 * @param timeoutMs The inactivity timeout in milliseconds (defaults to 15 minutes)
 */
export function useInactivityLogout(user: any, timeoutMs: number = 15 * 60 * 1000) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveRef = useRef<number>(Date.now());

  useEffect(() => {
    // If no user is logged in, there's no active session to monitor/logout
    if (!user) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    const startTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(async () => {
        try {
          await auth.signOut();
          toast.error(
            "Logged out due to inactivity to secure your session.",
            {
              id: "inactivity-logout-toast",
              duration: 8000,
              icon: "🛡️"
            }
          );
        } catch (error) {
          console.error("Inactivity logout error:", error);
        }
      }, timeoutMs);
    };

    const handleActivity = () => {
      const now = Date.now();
      // Throttle timer resets to once every 2 seconds to optimize performance
      if (now - lastActiveRef.current > 2000) {
        lastActiveRef.current = now;
        startTimer();
      }
    };

    // Initialize the main inactivity timer
    startTimer();

    // Setup typical interaction listeners
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup timers and event listeners
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user, timeoutMs]);
}

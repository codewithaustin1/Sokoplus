import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const lastUserUid = localStorage.getItem("sokoplus_last_user_uid");
      if (lastUserUid) {
        const saved = localStorage.getItem(`sokoplus_theme_${lastUserUid}`);
        if (saved === "light" || saved === "dark") {
          return saved;
        }
      }
      const generic = localStorage.getItem("sokoplus_theme");
      if (generic === "light" || generic === "dark") {
        return generic;
      }
    }
    return "light";
  });

  const themeRef = useRef<Theme>(theme);

  useEffect(() => {
    themeRef.current = theme;
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Handle Firebase user authentication & theme sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (typeof window !== "undefined") {
          localStorage.setItem("sokoplus_last_user_uid", user.uid);
          const cachedUserTheme = localStorage.getItem(`sokoplus_theme_${user.uid}`);
          if (cachedUserTheme === "light" || cachedUserTheme === "dark") {
            setThemeState(cachedUserTheme);
          }
        }

        try {
          const userDocRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.theme === "light" || data.theme === "dark") {
              // Cloud theme exists, sync locally
              setThemeState(data.theme);
              if (typeof window !== "undefined") {
                localStorage.setItem(`sokoplus_theme_${user.uid}`, data.theme);
                localStorage.setItem("sokoplus_theme", data.theme);
              }
            } else {
              // No cloud theme preference yet, save current local theme to Firestore
              await setDoc(userDocRef, { theme: themeRef.current }, { merge: true });
            }
          } else {
            // Document doesn't exist, create it with local theme
            await setDoc(userDocRef, { theme: themeRef.current }, { merge: true });
          }
        } catch (err) {
          console.warn("[ThemeContext] Could not sync theme with Firestore:", err);
        }
      } else {
        // Logged out / signed out: default to light mode
        setThemeState("light");
        if (typeof window !== "undefined") {
          localStorage.removeItem("sokoplus_last_user_uid");
          localStorage.setItem("sokoplus_theme", "light");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("sokoplus_theme", newTheme);
      if (auth.currentUser) {
        localStorage.setItem(`sokoplus_theme_${auth.currentUser.uid}`, newTheme);
      }
    }
    // Also save to Firestore if user is signed in
    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userDocRef, { theme: newTheme }, { merge: true });
      } catch (err) {
        console.warn("[ThemeContext] Could not save theme change to Firestore:", err);
      }
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

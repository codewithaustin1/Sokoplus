import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import {
  TypographyPreset,
  TYPOGRAPHY_PRESETS,
  DEFAULT_TYPOGRAPHY_ID,
  getTypographyById,
  applyTypography,
} from "./typography";

interface TypographyContextType {
  selectedTypographyId: string;
  selectedTypography: TypographyPreset;
  customTypographyNames: Record<string, string>;
  presets: TypographyPreset[];
  selectTypography: (id: string) => Promise<void>;
  assignTypographyName: (id: string, customName: string) => Promise<void>;
  resetTypographyName: (id: string) => Promise<void>;
  loading: boolean;
}

const TypographyContext = createContext<TypographyContextType | undefined>(undefined);

export function TypographyProvider({ children }: { children: React.ReactNode }) {
  const [selectedTypographyId, setSelectedTypographyId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sokoplus_typography_id");
      if (saved) return saved;
    }
    return DEFAULT_TYPOGRAPHY_ID;
  });

  const [customTypographyNames, setCustomTypographyNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Subscribe to real-time homepage settings in Firestore for live global typography sync
  useEffect(() => {
    const settingsRef = doc(db, "settings", "homepage");
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.selectedTypographyId) {
            setSelectedTypographyId(data.selectedTypographyId);
            if (typeof window !== "undefined") {
              localStorage.setItem("sokoplus_typography_id", data.selectedTypographyId);
            }
          }
          if (data.customTypographyNames && typeof data.customTypographyNames === "object") {
            setCustomTypographyNames(data.customTypographyNames);
          }
        }
        setLoading(false);
      },
      (error) => {
        console.warn("[TypographyContext] Firestore snapshot error, using cached typography:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute preset list with custom names applied
  const presets = TYPOGRAPHY_PRESETS.map((preset) => {
    const customName = customTypographyNames[preset.id];
    return customName
      ? { ...preset, name: customName }
      : preset;
  });

  // Current active preset
  const basePreset = getTypographyById(selectedTypographyId);
  const selectedTypography: TypographyPreset = {
    ...basePreset,
    name: customTypographyNames[basePreset.id] || basePreset.name,
  };

  // Apply typography whenever active typography or custom names change
  useEffect(() => {
    applyTypography(selectedTypography);
  }, [selectedTypographyId, customTypographyNames]);

  // Select new typography platform-wide
  const selectTypography = async (id: string) => {
    setSelectedTypographyId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("sokoplus_typography_id", id);
    }
    const targetPreset = getTypographyById(id);
    const activeWithCustom = {
      ...targetPreset,
      name: customTypographyNames[id] || targetPreset.name,
    };
    applyTypography(activeWithCustom);

    try {
      const settingsRef = doc(db, "settings", "homepage");
      await setDoc(settingsRef, { selectedTypographyId: id, updatedAt: new Date() }, { merge: true });
    } catch (err) {
      console.error("Failed to persist selected typography to Firestore:", err);
    }
  };

  // Assign or update custom name for a typography within the list
  const assignTypographyName = async (id: string, customName: string) => {
    const updatedNames = {
      ...customTypographyNames,
      [id]: customName.trim(),
    };
    setCustomTypographyNames(updatedNames);

    try {
      const settingsRef = doc(db, "settings", "homepage");
      await setDoc(settingsRef, { customTypographyNames: updatedNames, updatedAt: new Date() }, { merge: true });
    } catch (err) {
      console.error("Failed to save custom typography name to Firestore:", err);
    }
  };

  // Reset custom assigned name back to default preset name
  const resetTypographyName = async (id: string) => {
    const updatedNames = { ...customTypographyNames };
    delete updatedNames[id];
    setCustomTypographyNames(updatedNames);

    try {
      const settingsRef = doc(db, "settings", "homepage");
      await setDoc(settingsRef, { customTypographyNames: updatedNames, updatedAt: new Date() }, { merge: true });
    } catch (err) {
      console.error("Failed to reset typography name in Firestore:", err);
    }
  };

  return (
    <TypographyContext.Provider
      value={{
        selectedTypographyId,
        selectedTypography,
        customTypographyNames,
        presets,
        selectTypography,
        assignTypographyName,
        resetTypographyName,
        loading,
      }}
    >
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypography() {
  const context = useContext(TypographyContext);
  if (!context) {
    throw new Error("useTypography must be used within a TypographyProvider");
  }
  return context;
}

/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toRgbChannels } from "../lib/brand";
import { apiRequest } from "../lib/api";

export type BrandingSettings = {
  schoolName?: string;
  schoolMotto?: string;
  primaryColor?: string;
  accentColor?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
};

type BrandingContextValue = {
  branding: BrandingSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setBrandingLocal: (value: BrandingSettings) => void;
};

const BRANDING_KEY = "popin_branding";
const DEFAULT_BRANDING: BrandingSettings = {
  schoolName: "POPIN School",
  schoolMotto: "Connected school operations",
  primaryColor: "#1f2937",
  accentColor: "#2563eb",
  email: "admin@popin.school",
  phone: "+27 11 000 0000",
  website: "https://popin.school"
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function readLocal(): BrandingSettings | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(BRANDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BrandingSettings;
  } catch {
    return null;
  }
}

function writeLocal(value: BrandingSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BRANDING_KEY, JSON.stringify(value));
}

function applyBrandingVars(value: BrandingSettings) {
  const root = document.documentElement;
  if (value.primaryColor) {
    const rgb = toRgbChannels(value.primaryColor);
    if (rgb) root.style.setProperty("--brand-primary", rgb);
  }
  if (value.accentColor) {
    const rgb = toRgbChannels(value.accentColor);
    if (rgb) root.style.setProperty("--brand-accent", rgb);
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const value = await apiRequest<BrandingSettings>("/public/branding", { auth: false });
      setBranding(value);
      writeLocal(value);
      applyBrandingVars(value);
    } catch {
      const value = readLocal() || DEFAULT_BRANDING;
      setBranding(value);
      applyBrandingVars(value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === BRANDING_KEY && event.newValue) {
        try {
          const value = JSON.parse(event.newValue) as BrandingSettings;
          setBranding(value);
          applyBrandingVars(value);
        } catch {
          // ignore malformed local data
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setBrandingLocal = (value: BrandingSettings) => {
    setBranding(value);
    writeLocal(value);
    applyBrandingVars(value);
  };

  const value = useMemo(
    () => ({ branding, loading, refresh, setBrandingLocal }),
    [branding, loading]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}

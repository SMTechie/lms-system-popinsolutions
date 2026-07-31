export const fallbackBranding = {
  schoolName: "POPIN School",
  schoolMotto: "Connected school operations",
  primaryColor: "#0f172a",
  accentColor: "#2563eb",
  email: "admin@popin.school",
  phone: "+27 11 000 0000",
  website: "https://popin.school",
  logoUrl: ""
};

export function brandingInitials(name?: string) {
  const value = (name || fallbackBranding.schoolName).trim();
  return value
    .split(/\s+/)
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

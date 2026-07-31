import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useBranding } from "../settings/BrandingContext";

const routeTitles: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: "Dashboard" },
  { match: /^\/login$/, title: "Login" },
  { match: /^\/register$/, title: "Register" },
  { match: /^\/boards$/, title: "Boards" },
  { match: /^\/analytics$/, title: "Analytics" },
  { match: /^\/requisitions$/, title: "Requisitions" },
  { match: /^\/requisitions\/new$/, title: "New Requisition" },
  { match: /^\/requisitions\/[^/]+$/, title: "Requisition Detail" },
  { match: /^\/supply-chain$/, title: "Supply Chain" },
  { match: /^\/inventory$/, title: "Inventory" },
  { match: /^\/store$/, title: "Uniform Store" },
  { match: /^\/tickets$/, title: "Tickets" },
  { match: /^\/discipline$/, title: "Disciplinary Module" },
  { match: /^\/admissions$/, title: "Admissions" },
  { match: /^\/admissions\/form-builder$/, title: "Application Form Builder" },
  { match: /^\/applications\/new$/, title: "Apply Online" },
  { match: /^\/students$/, title: "Students" },
  { match: /^\/hostel$/, title: "Hostel" },
  { match: /^\/parent-portal$/, title: "Parent Portal" },
  { match: /^\/teacher-portal$/, title: "Teacher Portal" },
  { match: /^\/settings$/, title: "Settings" },
  { match: /^\/settings\/identity-integrations$/, title: "Identity Integrations" },
];

function pageTitleFor(pathname: string) {
  const match = routeTitles.find((entry) => entry.match.test(pathname));
  return match?.title || "Workspace";
}

export default function AppDocumentTitle() {
  const location = useLocation();
  const { branding } = useBranding();

  useEffect(() => {
    const schoolName = branding?.schoolName?.trim() || "Your School";
    const pageTitle = pageTitleFor(location.pathname);
    document.title = pageTitle === "Dashboard" ? schoolName : `${schoolName} | ${pageTitle}`;
  }, [branding?.schoolName, location.pathname]);

  return null;
}

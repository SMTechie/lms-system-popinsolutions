'use client';

import dynamic from "next/dynamic";

const SpaApp = dynamic(() => import("../App"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
    </div>
  )
});

export default function SpaShell() {
  return <SpaApp />;
}

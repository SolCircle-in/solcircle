"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";

export default function HeaderWrapper() {
  const pathname = usePathname();
  const hideHeader =
    pathname.startsWith("/register") || pathname.startsWith("/login") || pathname.startsWith("/dashboard");

  if (hideHeader) return null;
  return <Header />;
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { tokenKey } from "./api";

const authEvent = "ameo-auth-changed";
const publicPaths = ["/sign-in"];

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(authEvent));
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function check() {
      const token = window.localStorage.getItem(tokenKey);
      const isPublic = publicPaths.includes(pathname);
      if (!token && !isPublic) {
        setReady(false);
        router.replace("/sign-in");
        return;
      }
      if (token && isPublic) {
        setReady(false);
        router.replace("/");
        return;
      }
      setReady(true);
    }
    check();
    window.addEventListener(authEvent, check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener(authEvent, check);
      window.removeEventListener("storage", check);
    };
  }, [pathname, router]);

  if (!ready) {
    return null;
  }
  return <>{children}</>;
}

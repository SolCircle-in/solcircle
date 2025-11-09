"use client";

import { cn, getUserData, clearUserData } from "@/lib/utils";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface MobileMenuProps {
  className?: string;
}

export const MobileMenu = ({ className }: MobileMenuProps) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Initial check
    const checkAuth = () => {
      const userData = getUserData();
      setIsLoggedIn(!!userData);
    };
    
    checkAuth();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "solana_vote_user") {
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", checkAuth);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", checkAuth);
    };
  }, []);

  const menuItems = [
    { name: "Contact", href: "#contact" },
    { name: "Groups", href: "/groups" },
    ...(isLoggedIn ? [{ name: "Dashboard", href: "/dashboard" }] : []),
  ];

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const handleLogout = () => {
    clearUserData();
    setIsLoggedIn(false);
    setIsOpen(false);
    router.push("/");
  };

  return (
    <Dialog.Root modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <button
          className={cn(
            "group lg:hidden p-2 text-foreground transition-colors",
            className
          )}
          aria-label="Open menu"
        >
          <Menu className="group-[[data-state=open]]:hidden" size={24} />
          <X className="hidden group-[[data-state=open]]:block" size={24} />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <div
          data-overlay="true"
          className="fixed z-30 inset-0 bg-black/50 backdrop-blur-sm"
        />

        <Dialog.Content
          onInteractOutside={(e) => {
            if (
              e.target instanceof HTMLElement &&
              e.target.dataset.overlay !== "true"
            ) {
              e.preventDefault();
            }
          }}
          className="fixed top-0 left-0 w-full z-40 py-28 md:py-40"
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>

          <nav className="flex flex-col space-y-6 container mx-auto">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={handleLinkClick}
                className="text-xl font-mono uppercase text-foreground/60 transition-colors ease-out duration-150 hover:text-foreground/100 py-2"
              >
                {item.name}
              </Link>
            ))}

            <div className="mt-6">
              {isLoggedIn ? (
                <button
                  onClick={handleLogout}
                  className="inline-block text-xl font-mono uppercase text-primary transition-colors ease-out duration-150 hover:text-primary/80 py-2"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={handleLinkClick}
                  className="inline-block text-xl font-mono uppercase text-primary transition-colors ease-out duration-150 hover:text-primary/80 py-2"
                >
                  Log In
                </Link>
              )}
            </div>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

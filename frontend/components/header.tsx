"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { useEffect, useRef, useState } from "react";
import { getUserData, clearUserData } from "@/lib/utils";

export const Header = () => {
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayRef = useRef<number>(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Check if user is logged in and listen for changes
  useEffect(() => {
    // Initial check
    const checkAuth = () => {
      const userData = getUserData();
      setIsLoggedIn(!!userData);
    };
    
    checkAuth();

    // Listen for storage changes (when user logs in/out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "solana_vote_user") {
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Also check when window regains focus
    window.addEventListener("focus", checkAuth);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", checkAuth);
    };
  }, []);

  useEffect(() => {
    const audio = new Audio(
      "/ui-click-menu-modern-interface-select-small-02-230475.mp3"
    );
    audio.preload = "auto";
    audio.volume = 0.9;
    audioRef.current = audio;

    // Unlock audio on first user click or touch
    const unlockAudio = () => {
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
        })
        .catch(() => {});
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Scroll behavior: shrink / blur + hide on fast downward scroll similar to provided sample
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 50);
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleLogout = () => {
    clearUserData();
    setIsLoggedIn(false);
    router.push("/");
  };

  const playHoverSound = () => {
    const now = Date.now();
    if (now - lastPlayRef.current < 80) return;
    lastPlayRef.current = now;

    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  return (
    <header
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out ${isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}
    >
      <div
        className={`flex items-center gap-3 sm:gap-4 lg:gap-6 px-3 sm:px-4 lg:px-6 py-3 rounded-2xl border transition-all duration-300 w-auto max-w-[95vw] ${
          isScrolled
            ? "bg-background/90 backdrop-blur-xl border-border/40 shadow-2xl"
            : "bg-background/95 backdrop-blur-lg border-border/30 shadow-lg"
        }`}
      >
        {/* Logo */}
        <Link 
          href="/" 
          className="transform transition-transform duration-200 hover:scale-105 flex-shrink-0"
        >
          <Logo className="w-[90px] sm:w-[100px] lg:w-[120px]" />
        </Link>

        {/* Spacer to create separation */}
        <div className="hidden lg:block w-px h-6 bg-border/30 flex-shrink-0 mx-2" />

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-3 xl:gap-4 flex-shrink-0">
          <Link
            href="#features"
            className="relative text-foreground/80 hover:text-foreground transition-all duration-300 group px-3 py-1 rounded-lg hover:bg-foreground/5 transform hover:scale-110 hover:rotate-1 hover:skew-x-1 font-mono uppercase text-sm whitespace-nowrap"
            onMouseEnter={playHoverSound}
            onFocus={playHoverSound}
          >
            Features
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-4" />
          </Link>
          <Link
            href="#faq"
            className="relative text-foreground/80 hover:text-foreground transition-all duration-300 group px-3 py-1 rounded-lg hover:bg-foreground/5 transform hover:scale-110 hover:-rotate-1 hover:-skew-x-1 font-mono uppercase text-sm whitespace-nowrap"
            onMouseEnter={playHoverSound}
            onFocus={playHoverSound}
          >
            FAQ
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-4" />
          </Link>
          <Link
            href="/groups"
            className="relative text-foreground/80 hover:text-foreground transition-all duration-300 group px-3 py-1 rounded-lg hover:bg-foreground/5 transform hover:scale-110 hover:rotate-1 hover:skew-x-1 font-mono uppercase text-sm whitespace-nowrap"
            onMouseEnter={playHoverSound}
            onFocus={playHoverSound}
          >
            Groups
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-4" />
          </Link>
          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="relative text-foreground/80 hover:text-foreground transition-all duration-300 group px-3 py-1 rounded-lg hover:bg-foreground/5 transform hover:scale-110 hover:-rotate-1 hover:-skew-x-1 font-mono uppercase text-sm whitespace-nowrap"
              onMouseEnter={playHoverSound}
              onFocus={playHoverSound}
            >
              Dashboard
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-200 group-hover:w-4" />
            </Link>
          )}
          <a
            href="https://tally.so/r/mYEpyJ"
            target="_blank"
            rel="noopener noreferrer"
            className="uppercase inline-block font-mono text-purple-400 border border-purple-500 rounded px-3 xl:px-4 py-1 transition duration-150 ease-out hover:bg-purple-500 hover:text-white drop-shadow-[0_0_4px_rgba(168,85,247,0.5)] animate-glow backdrop-blur-md bg-[rgba(60,0,90,0.25)] text-sm whitespace-nowrap flex-shrink-0"
            style={{
              boxShadow: "0 0 4px 1px rgba(168,85,247,0.5), 0 0 8px 2px rgba(168,85,247,0.15)",
              animation: "glow 1.5s ease-in-out infinite alternate"
            }}
            onMouseEnter={playHoverSound}
            onFocus={playHoverSound}
          >
            Partnership
          </a>
        </nav>

        {/* Spacer to create separation */}
        <div className="hidden lg:block w-px h-6 bg-border/30 flex-shrink-0" />

        {/* Auth Buttons */}
        <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="text-foreground/80 hover:text-white hover:bg-primary/20 border border-primary/40 px-4 py-1 rounded-xl font-mono uppercase transition-all duration-200 text-sm whitespace-nowrap shadow-[0_0_8px_rgba(139,92,246,0.3)] hover:shadow-[0_0_12px_rgba(139,92,246,0.5)]"
              onMouseEnter={playHoverSound}
              onFocus={playHoverSound}
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="text-foreground/80 hover:text-white hover:bg-primary/20 border border-primary/40 px-4 py-1 rounded-xl font-mono uppercase transition-all duration-200 text-sm whitespace-nowrap shadow-[0_0_8px_rgba(139,92,246,0.3)] hover:shadow-[0_0_12px_rgba(139,92,246,0.5)]"
              onMouseEnter={playHoverSound}
              onFocus={playHoverSound}
            >
              Log In
            </Link>
          )}
        </div>

        {/* Mobile Menu */}
        <div className="lg:hidden flex-shrink-0 ml-auto">
          <MobileMenu />
        </div>
      </div>
      <style jsx>{`
        @keyframes glow {
          0% { box-shadow: 0 0 4px 1px rgba(168,85,247,0.5), 0 0 8px 2px rgba(168,85,247,0.15); }
          100% { box-shadow: 0 0 8px 2px rgba(168,85,247,0.7), 0 0 12px 4px rgba(168,85,247,0.2); }
        }
      `}</style>
    </header>
  );
};
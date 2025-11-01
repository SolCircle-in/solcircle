"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { useEffect, useRef, useState } from "react";

export const Header = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayRef = useRef<number>(0);
  const [hasPassedPill, setHasPassedPill] = useState(false);

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

  useEffect(() => {
    const headerEl = document.getElementById("app-header-wrapper");
    const pillEl = document.getElementById("hero-pill");
    if (!headerEl || !pillEl) return;

    let threshold = 0;
    const hysteresis = 12; // px gap to avoid flicker
    const stateRef = { current: hasPassedPill } as { current: boolean };

    const computeThreshold = () => {
      const headerRect = headerEl.getBoundingClientRect();
      const pillRect = pillEl.getBoundingClientRect();
      const headerHeight = headerRect.height;
      threshold = window.scrollY + pillRect.top - headerHeight;
    };

    const applyState = (next: boolean) => {
      if (stateRef.current !== next) {
        stateRef.current = next;
        setHasPassedPill(next);
      }
    };

    const handleScroll = () => {
      const y = window.scrollY;
      if (!stateRef.current && y >= threshold + hysteresis) applyState(true);
      else if (stateRef.current && y < threshold - hysteresis) applyState(false);
    };

    const handleResize = () => {
      computeThreshold();
      handleScroll();
    };

    computeThreshold();
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [hasPassedPill]);

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

  const blurClass = hasPassedPill
    ? "[backdrop-filter:blur(6px)] bg-gradient-to-b from-[rgba(0,0,0,0.45)] via-[rgba(0,0,0,0.25)] to-[rgba(0,0,0,0.05)]"
    : "backdrop-blur-none bg-transparent";

  return (
    <div
      id="app-header-wrapper"
      className={
        "fixed z-50 top-0 left-0 w-full h-16 md:h-20 transition-all duration-1000 ease-out " +
        "[transition-property:backdrop-filter,background-color] " +
        blurClass
      }
    >
      <header className="flex items-center justify-between container h-full">
        <Link href="/">
          <Logo className="w-[100px] md:w-[120px]" />
        </Link>
        <nav className="flex max-lg:hidden absolute left-1/2 -translate-x-1/2 items-center justify-center gap-x-10">
          {['Stats', 'Feature', 'Contact'].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase()}`}
              className={
                "uppercase inline-block font-mono text-foreground/60 transition duration-150 ease-out " +
                "hover:text-[var(--primary)] " +
                "hover:[text-shadow:0_0_14px_rgba(168,85,247,0.55)] " +
                "hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.45)]"
              }
              onMouseEnter={playHoverSound}
              onFocus={playHoverSound}
            >
              {item}
            </Link>
          ))}
          <Link
            href="/groups"
            className={
              "uppercase inline-block font-mono text-foreground/60 transition duration-150 ease-out " +
              "hover:text-[var(--primary)] " +
              "hover:[text-shadow:0_0_14px_rgba(168,85,247,0.55)] " +
              "hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.45)]"
            }
            onMouseEnter={playHoverSound}
            onFocus={playHoverSound}
          >
            Groups
          </Link>
          <a
            href="https://tally.so/r/mYEpyJ"
            target="_blank"
            rel="noopener noreferrer"
            className="uppercase inline-block font-mono text-purple-400 border border-purple-500 rounded px-4 py-1 transition duration-150 ease-out hover:bg-purple-500 hover:text-white ml-2 drop-shadow-[0_0_4px_rgba(168,85,247,0.5)] animate-glow backdrop-blur-md bg-[rgba(60,0,90,0.25)]"
            style={{
              boxShadow: "0 0 4px 1px rgba(168,85,247,0.5), 0 0 8px 2px rgba(168,85,247,0.15)",
              animation: "glow 1.5s ease-in-out infinite alternate"
            }}
            onMouseEnter={playHoverSound}
            onFocus={playHoverSound}
          >
            Partnership
          </a>
        <style jsx>{`
          @keyframes glow {
            0% {
              box-shadow: 0 0 4px 1px rgba(168,85,247,0.5), 0 0 8px 2px rgba(168,85,247,0.15);
            }
            100% {
              box-shadow: 0 0 8px 2px rgba(168,85,247,0.7), 0 0 12px 4px rgba(168,85,247,0.2);
            }
          }
        `}</style>
        </nav>
        <Link
          href="/login"
          className="uppercase max-lg:hidden transition-colors ease-out duration-150 font-mono text-primary hover:text-white border border-primary rounded-full px-4 py-1 backdrop-blur-md bg-[rgba(60,0,90,0.2)] hover:bg-primary"
          onMouseEnter={playHoverSound}
          onFocus={playHoverSound}
        >
          Log In
        </Link>
        <MobileMenu />
      </header>
    </div>
  );
};

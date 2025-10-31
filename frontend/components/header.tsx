"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { useEffect, useRef } from "react";

export const Header = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayRef = useRef<number>(0);

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
    <div className="fixed z-50 pt-8 md:pt-14 top-0 left-0 w-full">
      <header className="flex items-center justify-between container">
        <Link href="/">
          <Logo className="w-[100px] md:w-[120px]" />
        </Link>
        <nav className="flex max-lg:hidden absolute left-1/2 -translate-x-1/2 items-center justify-center gap-x-10">
          {["Features", "Stats", "Community", "Contact"].map((item) => (
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
        </nav>
        <Link
          href="/login"
          className="uppercase max-lg:hidden transition-colors ease-out duration-150 font-mono text-primary hover:text-primary/80"
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

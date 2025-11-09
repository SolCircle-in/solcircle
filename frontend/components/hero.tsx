"use client"

import Link from "next/link"
import { GL } from "./gl"
import { Pill } from "./pill"
import { Button } from "./ui/button"
import { InfiniteSlider } from "./ui/infinite-slider"
import { ProgressiveBlur } from "./ui/progressive-blur"
import { useEffect, useRef, useState } from "react"
import TypingTitle from "./typing-title"
import BgMusic from "./bg-music"

export function Hero() {
  const [hovering, setHovering] = useState(false)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (bgAudioRef.current) {
        try { bgAudioRef.current.pause(); } catch {}
        bgAudioRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative flex flex-col min-h-svh overflow-hidden">
      {/* Replace with your interstellar-style track placed at public/ambient.mp3 */}
      <BgMusic src="/ambient.mp3" volume={0.05} />
      
      {/* 3D Background - contained within hero, scrolls with content */}
      <div className="absolute inset-0 w-full h-full">
        <GL hovering={hovering} />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col h-svh justify-start">
        <div className="pt-64 pb-16 text-center">
          <Pill id="hero-pill" className="mb-6">NEXT GENERATION TRADING</Pill>
          <h1 className="text-7xl sm:text-8xl md:text-9xl font-sentient font-bold">
            <TypingTitle className="inline" words={["Vote.", "Invest.", "Win."]} />
          </h1>
          <p className="font-mono text-sm sm:text-base text-foreground text-balance mt-8 max-w-[540px] mx-auto">
            Pool funds, vote on-chain, and auto‑execute trades on Solana—directly from your Telegram group.
          </p>

          <Link className="contents max-sm:hidden" href="/register">
            <Button
              className="mt-14"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              [Get Started Now]
            </Button>
          </Link>
          <Link className="contents sm:hidden" href="/register">
            <Button
              size="sm"
              className="mt-14"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              [Get Started Now]
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

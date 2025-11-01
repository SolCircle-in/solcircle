"use client"

import Link from "next/link"
import { GL } from "./gl"
import { Pill } from "./pill"
import { Button } from "./ui/button"
import { useEffect, useRef, useState } from "react"
import { TrendingUp, Zap, BarChart3, Rocket } from "lucide-react"
import TypingTitle from "./typing-title"
import BgMusic from "./bg-music"

export function Hero() {
  const [hovering, setHovering] = useState(false)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Execute trades in milliseconds",
    },
    {
      icon: BarChart3,
      title: "Data Driven",
      description: "Real-time analytics & insights",
    },
    {
      icon: TrendingUp,
      title: "Community Powered",
      description: "Collective decision making",
    },
    {
      icon: Rocket,
      title: "Solana Native",
      description: "Built for speed & efficiency",
    },
  ]

  useEffect(() => {
    return () => {
      if (bgAudioRef.current) {
        try { bgAudioRef.current.pause(); } catch {}
        bgAudioRef.current = null
      }
    }
  }, [])

  return (
    <div className="flex flex-col min-h-svh">
      {/* Replace with your interstellar-style track placed at public/ambient.mp3 */}
      <BgMusic src="/ambient.mp3" volume={0.05} />
      <GL hovering={hovering} />

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col h-svh justify-start">
        <div className="pt-64 pb-16 text-center">
          <Pill id="hero-pill" className="mb-6">NEXT GENERATION TRADING</Pill>
          <h1 className="text-7xl sm:text-8xl md:text-9xl font-sentient font-bold">
            <TypingTitle className="inline" words={["Vote.", "Invest.", "Win."]} />
          </h1>
          <p className="font-mono text-sm sm:text-base text-foreground text-balance mt-8 max-w-[540px] mx-auto">
            Join the revolution where Telegram groups become trading powerhouses
            on Solana.
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

      {/* Stats Section */}
      <section
        id="stats"
        className="relative z-10 py-20 border-t border-border"
      >
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-sentient text-primary mb-2">
                1.2K+
              </div>
              <p className="font-mono text-sm text-foreground/60">
                Active Groups
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-sentient text-primary mb-2">
                $42M
              </div>
              <p className="font-mono text-sm text-foreground/60">
                Total Volume
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-sentient text-primary mb-2">
                73%
              </div>
              <p className="font-mono text-sm text-foreground/60">Win Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Session Section */}
      <section className="relative z-10 py-20 border-t border-border">
        <div className="container">
          <div className="text-center mb-12">
            <Pill className="mb-6 justify-center">LIVE SESSION</Pill>
            <h2 className="text-3xl md:text-4xl font-sentient mb-8">
              SOL/USDC
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="border border-border rounded-lg p-6 backdrop-blur-[2px] bg-[rgba(30,0,50,0.06)]">
              <p className="font-mono text-sm text-foreground/60 mb-2">
                VOTING POWER
              </p>
              <div className="text-3xl font-sentient">847 Votes</div>
            </div>
            <div className="border border-border rounded-lg p-6 backdrop-blur-[2px] bg-[rgba(30,0,50,0.06)]">
              <p className="font-mono text-sm text-foreground/60 mb-2">
                SESSION PERFORMANCE
              </p>
              <div className="text-3xl font-sentient text-primary">
                +12% this session
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why SolCircle Section */}
      <section
        id="features"
        className="relative z-10 py-20 border-t border-border"
      >
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-sentient mb-4">
              Why SolCircle?
            </h2>
            <p className="font-mono text-sm text-foreground/60 max-w-[440px] mx-auto">
              The future of trading is collective. Harness the power of your
              community.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="border border-border rounded-lg p-8 backdrop-blur-[2px] bg-[rgba(30,0,50,0.06)]"
                >
                  <Icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="font-sentient text-lg mb-2">
                    {feature.title}
                  </h3>
                  <p className="font-mono text-sm text-foreground/60">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 border-t border-border">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-sentient mb-6">
            Ready to Trade Collectively?
          </h2>
          <p className="font-mono text-sm text-foreground/60 max-w-[440px] mx-auto mb-8">
            Connect your wallet, join a group, and start voting on the next big
            opportunity.
          </p>
          <Link className="contents max-sm:hidden" href="/#launch">
            <Button
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              [Launch App]
            </Button>
          </Link>
          <Link className="contents sm:hidden" href="/#launch">
            <Button
              size="sm"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
            >
              [Launch App]
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

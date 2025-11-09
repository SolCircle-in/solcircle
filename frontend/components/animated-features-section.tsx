"use client"

import type React from "react"
import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { AnimatedGradient } from "./ui/animated-gradient-with-svg"

interface BentoCardProps {
  title: string
  value: string | number
  subtitle?: string
  colors: string[]
  delay: number
}

const BentoCard: React.FC<BentoCardProps> = ({ title, value, subtitle, colors, delay }) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: delay + 0.3,
      },
    },
  }

  const item = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.5 } },
  }

  return (
    <motion.div
      className="relative overflow-hidden h-full bg-black rounded-lg border border-border/20 group"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay }}
      style={{
        filter: "url(#noise)",
      }}
    >
      <AnimatedGradient colors={colors} speed={0.05} blur="medium" />

      <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundSize: "256px 256px",
            mixBlendMode: "overlay",
          }}
        />
      </div>

      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div
          className="w-full h-full animate-pulse"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.05) 1px, transparent 1px),
                             radial-gradient(circle at 75% 75%, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "48px 48px, 64px 64px",
            backgroundPosition: "0 0, 24px 24px",
          }}
        />
      </div>

      <div className="absolute inset-0 opacity-80 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full animate-[shine_4s_ease-in-out_infinite] w-[200%]" />
      </div>

      <motion.div
        className="relative z-10 p-3 sm:p-5 md:p-8 text-foreground backdrop-blur-sm h-full flex flex-col justify-center"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.h3 className="text-sm sm:text-base md:text-lg text-foreground mb-2" variants={item}>
          {title}
        </motion.h3>
        <motion.p className="text-2xl sm:text-4xl md:text-5xl font-medium mb-4 text-foreground" variants={item}>
          {value}
        </motion.p>
        {subtitle && (
          <motion.p className="text-sm text-foreground/80" variants={item}>
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  )
}

export function AnimatedFeaturesSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="features" className="relative py-20 px-4 bg-black" ref={ref}>
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="noise" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence baseFrequency="0.4" numOctaves="2" result="noise" seed="2" type="fractalNoise" />
            <feColorMatrix in="noise" type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="discrete" tableValues="0.02 0.04 0.06" />
            </feComponentTransfer>
            <feComposite operator="over" in2="SourceGraphic" />
          </filter>
        </defs>
      </svg>

      <div className="container mx-auto">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h2 className="text-4xl font-bold text-white mb-4" style={{ fontFamily: "var(--font-playfair)" }}>
            Powerful Features
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Everything you need to take your business to the next level
          </p>
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[600px]"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          <div className="md:col-span-2">
            <BentoCard
              title="Group-Centric Investing"
              value="Invest Together"
              subtitle="Create or join investment groups, pool funds, and make collective investment decisions on the Solana blockchain."
              colors={["#1a1a1a", "#2a2a2a", "#1f1f1f"]}
              delay={isInView ? 0.3 : 0}
            />
          </div>
          <BentoCard
            title="Telegram Integration"
            value="Seamless Control"
            subtitle="Manage your investment group, propose new investments, and vote on proposals directly within your Telegram chat."
            colors={["#151515", "#252525", "#1d1d1d"]}
            delay={isInView ? 0.4 : 0}
          />
          <BentoCard
            title="Decentralized Governance"
            value="Vote on Chain"
            subtitle="All proposals and votes are recorded on the Solana blockchain, ensuring transparent and immutable governance."
            colors={["#1c1c1c", "#2c2c2c", "#181818"]}
            delay={isInView ? 0.5 : 0}
          />
          <div className="md:col-span-2">
            <BentoCard
              title="Real-Time Analytics"
              value="Track Performance"
              subtitle="Monitor your group's portfolio performance with real-time data and comprehensive analytics."
              colors={["#171717", "#272727", "#1b1b1b"]}
              delay={isInView ? 0.6 : 0}
            />
          </div>
          <div className="md:col-span-3">
            <BentoCard
              title="Secure & Transparent"
              value="Solana-Powered"
              subtitle="Leverage the speed and security of the Solana blockchain for all your group's transactions and activities."
              colors={["#131313", "#232323", "#191919"]}
              delay={isInView ? 0.7 : 0}
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

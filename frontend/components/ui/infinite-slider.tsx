"use client"

import { cn } from "@/lib/utils"
import { CSSProperties, ReactNode } from "react"

interface InfiniteSliderProps {
  children: ReactNode
  gap?: number
  duration?: number
  durationOnHover?: number
  direction?: "horizontal" | "vertical"
  reverse?: boolean
  className?: string
}

export function InfiniteSlider({
  children,
  gap = 16,
  duration = 25,
  durationOnHover,
  direction = "horizontal",
  reverse = false,
  className,
}: InfiniteSliderProps) {
  return (
    <div
      className={cn(
        "group relative flex overflow-hidden",
        direction === "vertical" ? "flex-col" : "flex-row",
        className
      )}
      style={
        {
          "--gap": `${gap}px`,
          "--duration": `${duration}s`,
          "--duration-on-hover": `${durationOnHover || duration}s`,
        } as CSSProperties
      }
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-around",
          direction === "vertical" ? "flex-col animate-slide-vertical" : "animate-slide-horizontal",
          reverse && (direction === "vertical" ? "animate-slide-vertical-reverse" : "animate-slide-horizontal-reverse"),
          "group-hover:[animation-play-state:paused]"
        )}
        style={
          {
            gap: `${gap}px`,
          } as CSSProperties
        }
      >
        {children}
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center justify-around",
          direction === "vertical" ? "flex-col animate-slide-vertical" : "animate-slide-horizontal",
          reverse && (direction === "vertical" ? "animate-slide-vertical-reverse" : "animate-slide-horizontal-reverse"),
          "group-hover:[animation-play-state:paused]"
        )}
        style={
          {
            gap: `${gap}px`,
          } as CSSProperties
        }
        aria-hidden="true"
      >
        {children}
      </div>
    </div>
  )
}

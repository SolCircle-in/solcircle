"use client"

import { cn } from "@/lib/utils"
import { CSSProperties } from "react"

interface ProgressiveBlurProps {
  className?: string
  direction?: "left" | "right" | "top" | "bottom"
  blurIntensity?: number
}

export function ProgressiveBlur({
  className,
  direction = "right",
  blurIntensity = 1,
}: ProgressiveBlurProps) {
  const getGradient = () => {
    const color = "rgba(0, 0, 0, 0)"
    const solidColor = "rgba(0, 0, 0, 1)"
    
    switch (direction) {
      case "left":
        return `linear-gradient(to right, ${solidColor}, ${color})`
      case "right":
        return `linear-gradient(to left, ${solidColor}, ${color})`
      case "top":
        return `linear-gradient(to bottom, ${solidColor}, ${color})`
      case "bottom":
        return `linear-gradient(to top, ${solidColor}, ${color})`
      default:
        return `linear-gradient(to left, ${solidColor}, ${color})`
    }
  }

  return (
    <div
      className={cn("pointer-events-none", className)}
      style={
        {
          background: getGradient(),
          backdropFilter: `blur(${blurIntensity * 8}px)`,
          WebkitBackdropFilter: `blur(${blurIntensity * 8}px)`,
          maskImage: getGradient(),
          WebkitMaskImage: getGradient(),
        } as CSSProperties
      }
    />
  )
}

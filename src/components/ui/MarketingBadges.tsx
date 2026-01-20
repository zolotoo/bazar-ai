"use client"

import { useState } from "react"
import { cn } from "../../utils/cn"

interface Badge {
  id: string
  label: string
  color: string
  size: "sm" | "md" | "lg"
  rotation: number
  zIndex: number
  offsetX: number
  offsetY: number
}

interface MarketingBadgesProps {
  badges?: Badge[]
  onBadgeClick?: (label: string) => void
  className?: string
}

// Default badges with orange/amber theme
const defaultBadges: Badge[] = [
  {
    id: "trending",
    label: "trending",
    color: "from-orange-400 to-amber-500",
    size: "lg",
    rotation: -3,
    zIndex: 1,
    offsetX: -20,
    offsetY: -60,
  },
  {
    id: "viral",
    label: "вирусное",
    color: "from-amber-400 to-orange-500",
    size: "sm",
    rotation: 2,
    zIndex: 2,
    offsetX: 60,
    offsetY: -35,
  },
  {
    id: "reels",
    label: "reels",
    color: "from-rose-400 to-pink-500",
    size: "lg",
    rotation: -2,
    zIndex: 3,
    offsetX: -30,
    offsetY: -15,
  },
  {
    id: "контент",
    label: "контент",
    color: "from-amber-300 to-yellow-500",
    size: "lg",
    rotation: 0,
    zIndex: 4,
    offsetX: 0,
    offsetY: 25,
  },
  {
    id: "идеи",
    label: "идеи",
    color: "from-orange-500 to-red-500",
    size: "md",
    rotation: 3,
    zIndex: 5,
    offsetX: -15,
    offsetY: 65,
  },
  {
    id: "AI",
    label: "AI",
    color: "from-yellow-400 to-amber-500",
    size: "sm",
    rotation: -1,
    zIndex: 6,
    offsetX: 50,
    offsetY: 90,
  },
]

const sizeClasses = {
  sm: "px-5 py-2 text-sm",
  md: "px-6 py-2.5 text-base",
  lg: "px-8 py-3 text-lg",
}

export function MarketingBadges({ badges = defaultBadges, onBadgeClick, className }: MarketingBadgesProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [clickedId, setClickedId] = useState<string | null>(null)

  const handleClick = (badge: Badge) => {
    setClickedId(clickedId === badge.id ? null : badge.id)
    onBadgeClick?.(badge.label)
  }

  return (
    <div className={cn("relative flex h-[300px] w-full items-center justify-center", className)}>
      {badges.map((badge) => {
        const isHovered = hoveredId === badge.id
        const isClicked = clickedId === badge.id
        const isOtherHovered = hoveredId !== null && hoveredId !== badge.id

        return (
          <div
            key={badge.id}
            className={cn(
              "absolute cursor-pointer select-none rounded-full font-semibold transition-all duration-500 ease-out",
              "bg-gradient-to-b shadow-lg",
              badge.color,
              sizeClasses[badge.size],
              "hover:shadow-2xl",
            )}
            style={{
              transform: `
                translate(${badge.offsetX}px, ${badge.offsetY}px) 
                rotate(${isHovered ? 0 : badge.rotation}deg)
                scale(${isClicked ? 1.15 : isHovered ? 1.08 : isOtherHovered ? 0.95 : 1})
                translateY(${isHovered ? -8 : 0}px)
              `,
              zIndex: isHovered || isClicked ? 100 : badge.zIndex,
              boxShadow: isHovered
                ? "0 25px 50px -12px rgba(251, 146, 60, 0.35), 0 12px 24px -8px rgba(0, 0, 0, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.3)"
                : isClicked
                  ? "0 30px 60px -15px rgba(251, 146, 60, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4)"
                  : "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 10px -2px rgba(0, 0, 0, 0.1), inset 0 1px 2px rgba(255, 255, 255, 0.2)",
            }}
            onMouseEnter={() => setHoveredId(badge.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => handleClick(badge)}
          >
            <span
              className={cn(
                "relative block transition-transform duration-300",
                "text-slate-800 drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]",
              )}
              style={{
                transform: isHovered ? "translateY(-1px)" : "translateY(0)",
              }}
            >
              {badge.label}
            </span>
            {/* Inner highlight effect */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full opacity-50"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%)",
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

// Search-themed badges for SearchPanel
export const searchBadges: Badge[] = [
  {
    id: "нейросети",
    label: "нейросети",
    color: "from-orange-400 to-amber-500",
    size: "lg",
    rotation: -4,
    zIndex: 1,
    offsetX: -80,
    offsetY: -50,
  },
  {
    id: "маркетинг",
    label: "маркетинг",
    color: "from-amber-400 to-yellow-500",
    size: "md",
    rotation: 3,
    zIndex: 2,
    offsetX: 70,
    offsetY: -30,
  },
  {
    id: "тренды",
    label: "тренды",
    color: "from-rose-400 to-orange-500",
    size: "lg",
    rotation: -2,
    zIndex: 3,
    offsetX: -50,
    offsetY: 10,
  },
  {
    id: "бизнес",
    label: "бизнес",
    color: "from-amber-300 to-orange-400",
    size: "md",
    rotation: 4,
    zIndex: 4,
    offsetX: 50,
    offsetY: 40,
  },
  {
    id: "стартапы",
    label: "стартапы",
    color: "from-orange-500 to-red-400",
    size: "sm",
    rotation: -3,
    zIndex: 5,
    offsetX: -20,
    offsetY: 70,
  },
]

export default MarketingBadges

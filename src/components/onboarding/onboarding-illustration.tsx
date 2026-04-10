"use client"

import { motion, AnimatePresence } from "framer-motion"

interface OnboardingIllustrationProps {
  step: number
  selectedOption: string | null
  bgColor: string
}

/* ---------- floating wrapper ---------- */
function FloatingWrap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  )
}

/* ====================================================================
   STEP 1 ILLUSTRATIONS — Goal
   ==================================================================== */

function CareerIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* stairs */}
      <rect x="40" y="150" width="40" height="30" rx="4" fill="#CC3A3A" opacity="0.2" />
      <rect x="80" y="120" width="40" height="60" rx="4" fill="#CC3A3A" opacity="0.4" />
      <rect x="120" y="90" width="40" height="90" rx="4" fill="#CC3A3A" opacity="0.6" />
      <rect x="160" y="60" width="40" height="120" rx="4" fill="#CC3A3A" opacity="0.85" />
      {/* arrow */}
      <path d="M50 140 L190 50" stroke="#CC3A3A" strokeWidth="3" strokeLinecap="round" />
      <path d="M180 45 L195 50 L185 60" fill="none" stroke="#CC3A3A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* briefcase */}
      <rect x="170" y="25" width="24" height="18" rx="3" fill="#1E1E1E" />
      <rect x="178" y="20" width="8" height="8" rx="2" fill="none" stroke="#1E1E1E" strokeWidth="2" />
      {/* star accents */}
      <circle cx="60" cy="60" r="3" fill="#DFED8C" />
      <circle cx="100" cy="40" r="2" fill="#DFED8C" />
      <circle cx="150" cy="35" r="2.5" fill="#DFED8C" />
    </svg>
  )
}

function ChildIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* open book */}
      <path d="M60 130 Q120 110 120 130 Q120 110 180 130 L180 170 Q120 150 120 170 Q120 150 60 170 Z" fill="white" stroke="#CC3A3A" strokeWidth="2" />
      <line x1="120" y1="115" x2="120" y2="170" stroke="#CC3A3A" strokeWidth="1.5" />
      {/* pages lines */}
      <line x1="75" y1="140" x2="110" y2="135" stroke="#CC3A3A" strokeWidth="1" opacity="0.3" />
      <line x1="75" y1="150" x2="110" y2="145" stroke="#CC3A3A" strokeWidth="1" opacity="0.3" />
      <line x1="130" y1="135" x2="165" y2="140" stroke="#CC3A3A" strokeWidth="1" opacity="0.3" />
      <line x1="130" y1="145" x2="165" y2="150" stroke="#CC3A3A" strokeWidth="1" opacity="0.3" />
      {/* stars */}
      <polygon points="90,80 93,90 103,90 95,96 98,106 90,100 82,106 85,96 77,90 87,90" fill="#DFED8C" />
      <polygon points="150,70 152,77 159,77 154,81 156,88 150,84 144,88 146,81 141,77 148,77" fill="#DFED8C" />
      <polygon points="120,55 122,62 129,62 124,66 126,73 120,69 114,73 116,66 111,62 118,62" fill="#CC3A3A" opacity="0.6" />
      {/* sparkles */}
      <circle cx="70" cy="70" r="2" fill="#CC3A3A" opacity="0.3" />
      <circle cx="170" cy="60" r="2.5" fill="#CC3A3A" opacity="0.3" />
    </svg>
  )
}

function ExamsIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* diploma / paper */}
      <rect x="70" y="40" width="100" height="130" rx="6" fill="white" stroke="#CC3A3A" strokeWidth="2" />
      {/* checklist lines */}
      <rect x="90" y="60" width="12" height="12" rx="2" fill="none" stroke="#CC3A3A" strokeWidth="2" />
      <path d="M93 66 L96 69 L100 63" stroke="#DFED8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="110" y1="66" x2="150" y2="66" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

      <rect x="90" y="85" width="12" height="12" rx="2" fill="none" stroke="#CC3A3A" strokeWidth="2" />
      <path d="M93 91 L96 94 L100 88" stroke="#DFED8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="110" y1="91" x2="145" y2="91" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

      <rect x="90" y="110" width="12" height="12" rx="2" fill="none" stroke="#CC3A3A" strokeWidth="2" />
      <line x1="110" y1="116" x2="140" y2="116" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

      <rect x="90" y="135" width="12" height="12" rx="2" fill="none" stroke="#CC3A3A" strokeWidth="2" />
      <line x1="110" y1="141" x2="148" y2="141" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

      {/* pen accent */}
      <line x1="175" y1="35" x2="185" y2="55" stroke="#CC3A3A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="175" cy="35" r="3" fill="#CC3A3A" />
    </svg>
  )
}

function TravelIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* globe */}
      <circle cx="120" cy="100" r="55" fill="white" stroke="#CC3A3A" strokeWidth="2" />
      <ellipse cx="120" cy="100" rx="25" ry="55" fill="none" stroke="#CC3A3A" strokeWidth="1.5" opacity="0.4" />
      <line x1="65" y1="100" x2="175" y2="100" stroke="#CC3A3A" strokeWidth="1.5" opacity="0.4" />
      <ellipse cx="120" cy="80" rx="45" ry="12" fill="none" stroke="#CC3A3A" strokeWidth="1" opacity="0.3" />
      <ellipse cx="120" cy="120" rx="45" ry="12" fill="none" stroke="#CC3A3A" strokeWidth="1" opacity="0.3" />
      {/* pin */}
      <circle cx="140" cy="75" r="8" fill="#CC3A3A" />
      <path d="M140 83 L140 95" stroke="#CC3A3A" strokeWidth="2" />
      <circle cx="140" cy="75" r="3" fill="white" />
      {/* airplane */}
      <g transform="translate(165, 45) rotate(20)">
        <path d="M0 8 L15 0 L15 5 L25 3 L25 8 L15 10 L15 16 L0 8Z" fill="#DFED8C" />
      </g>
      {/* clouds */}
      <ellipse cx="55" cy="50" rx="15" ry="8" fill="#CC3A3A" opacity="0.1" />
      <ellipse cx="190" cy="140" rx="12" ry="6" fill="#CC3A3A" opacity="0.1" />
    </svg>
  )
}

/* ====================================================================
   STEP 2 ILLUSTRATIONS — Level
   ==================================================================== */

function SproutIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* ground */}
      <ellipse cx="120" cy="170" rx="60" ry="12" fill="#CC3A3A" opacity="0.15" />
      {/* stem */}
      <line x1="120" y1="170" x2="120" y2="120" stroke="#6BBF59" strokeWidth="3" strokeLinecap="round" />
      {/* leaves */}
      <path d="M120 130 Q100 110 120 100 Q140 110 120 130Z" fill="#DFED8C" />
      <path d="M120 145 Q140 130 150 140 Q140 150 120 145Z" fill="#6BBF59" opacity="0.6" />
      {/* soil dots */}
      <circle cx="100" cy="172" r="2" fill="#CC3A3A" opacity="0.2" />
      <circle cx="140" cy="174" r="2.5" fill="#CC3A3A" opacity="0.2" />
      <circle cx="115" cy="176" r="1.5" fill="#CC3A3A" opacity="0.15" />
      {/* sun */}
      <circle cx="180" cy="50" r="15" fill="#DFED8C" />
      <g stroke="#DFED8C" strokeWidth="2" strokeLinecap="round">
        <line x1="180" y1="28" x2="180" y2="22" />
        <line x1="180" y1="72" x2="180" y2="78" />
        <line x1="158" y1="50" x2="152" y2="50" />
        <line x1="202" y1="50" x2="208" y2="50" />
        <line x1="165" y1="35" x2="160" y2="30" />
        <line x1="195" y1="65" x2="200" y2="70" />
      </g>
    </svg>
  )
}

function GrowingTreeIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* ground */}
      <ellipse cx="120" cy="175" rx="70" ry="12" fill="#CC3A3A" opacity="0.12" />
      {/* trunk */}
      <rect x="114" y="120" width="12" height="55" rx="4" fill="#A0522D" />
      {/* canopy */}
      <circle cx="120" cy="90" r="35" fill="#DFED8C" opacity="0.7" />
      <circle cx="100" cy="95" r="22" fill="#6BBF59" opacity="0.5" />
      <circle cx="140" cy="95" r="22" fill="#6BBF59" opacity="0.5" />
      <circle cx="120" cy="75" r="25" fill="#6BBF59" opacity="0.6" />
      {/* branches accent */}
      <line x1="114" y1="135" x2="95" y2="120" stroke="#A0522D" strokeWidth="2" strokeLinecap="round" />
      <line x1="126" y1="135" x2="145" y2="118" stroke="#A0522D" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function FullTreeIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* ground */}
      <ellipse cx="120" cy="178" rx="80" ry="14" fill="#CC3A3A" opacity="0.1" />
      {/* trunk */}
      <rect x="112" y="120" width="16" height="58" rx="5" fill="#A0522D" />
      {/* big canopy */}
      <circle cx="120" cy="80" r="45" fill="#6BBF59" opacity="0.5" />
      <circle cx="95" cy="90" r="28" fill="#DFED8C" opacity="0.6" />
      <circle cx="145" cy="90" r="28" fill="#DFED8C" opacity="0.6" />
      <circle cx="120" cy="60" r="30" fill="#6BBF59" opacity="0.6" />
      {/* fruits */}
      <circle cx="90" cy="78" r="6" fill="#CC3A3A" />
      <circle cx="150" cy="82" r="6" fill="#CC3A3A" />
      <circle cx="110" cy="55" r="5" fill="#CC3A3A" opacity="0.8" />
      <circle cx="135" cy="62" r="5" fill="#CC3A3A" opacity="0.8" />
      <circle cx="120" cy="95" r="5" fill="#CC3A3A" opacity="0.7" />
      {/* branches */}
      <line x1="112" y1="135" x2="85" y2="110" stroke="#A0522D" strokeWidth="3" strokeLinecap="round" />
      <line x1="128" y1="135" x2="155" y2="108" stroke="#A0522D" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function QuestionIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* magnifying glass */}
      <circle cx="110" cy="90" r="40" fill="white" stroke="#CC3A3A" strokeWidth="3" />
      <line x1="138" y1="118" x2="170" y2="155" stroke="#CC3A3A" strokeWidth="6" strokeLinecap="round" />
      {/* question mark inside */}
      <text x="110" y="105" textAnchor="middle" fontSize="45" fontWeight="bold" fill="#CC3A3A" fontFamily="Inter, sans-serif">?</text>
      {/* sparkles */}
      <circle cx="165" cy="60" r="4" fill="#DFED8C" />
      <circle cx="60" cy="55" r="3" fill="#DFED8C" />
      <circle cx="175" cy="100" r="2.5" fill="#DFED8C" />
    </svg>
  )
}

/* ====================================================================
   STEP 3 ILLUSTRATIONS — Frequency
   ==================================================================== */

function CalendarSparse() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* calendar body */}
      <rect x="55" y="50" width="130" height="120" rx="10" fill="white" stroke="#CC3A3A" strokeWidth="2" />
      {/* header */}
      <rect x="55" y="50" width="130" height="30" rx="10" fill="#CC3A3A" />
      <rect x="55" y="70" width="130" height="10" fill="#CC3A3A" />
      {/* hooks */}
      <line x1="90" y1="42" x2="90" y2="58" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" />
      <line x1="150" y1="42" x2="150" y2="58" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" />
      {/* grid - 7 cols, 3 rows */}
      {/* day labels */}
      <text x="72" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Пн</text>
      <text x="90" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Вт</text>
      <text x="108" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Ср</text>
      <text x="126" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Чт</text>
      <text x="144" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Пт</text>
      <text x="162" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Сб</text>
      {/* marked days - just 2 */}
      <circle cx="90" cy="115" r="8" fill="#CC3A3A" opacity="0.2" />
      <circle cx="144" cy="115" r="8" fill="#CC3A3A" opacity="0.2" />
      <text x="90" y="118" fontSize="9" fill="#CC3A3A" textAnchor="middle" fontWeight="bold" fontFamily="Inter">2</text>
      <text x="144" y="118" fontSize="9" fill="#CC3A3A" textAnchor="middle" fontWeight="bold" fontFamily="Inter">5</text>
      {/* empty days */}
      <text x="72" y="118" fontSize="9" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">1</text>
      <text x="108" y="118" fontSize="9" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">3</text>
      <text x="126" y="118" fontSize="9" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">4</text>
      <text x="162" y="118" fontSize="9" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">6</text>
    </svg>
  )
}

function CalendarMedium() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      <rect x="55" y="50" width="130" height="120" rx="10" fill="white" stroke="#CC3A3A" strokeWidth="2" />
      <rect x="55" y="50" width="130" height="30" rx="10" fill="#CC3A3A" />
      <rect x="55" y="70" width="130" height="10" fill="#CC3A3A" />
      <line x1="90" y1="42" x2="90" y2="58" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" />
      <line x1="150" y1="42" x2="150" y2="58" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" />
      <text x="72" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Пн</text>
      <text x="90" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Вт</text>
      <text x="108" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Ср</text>
      <text x="126" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Чт</text>
      <text x="144" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Пт</text>
      <text x="162" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Сб</text>
      {/* 4 marked days */}
      <circle cx="72" cy="115" r="8" fill="#CC3A3A" opacity="0.2" />
      <circle cx="108" cy="115" r="8" fill="#CC3A3A" opacity="0.2" />
      <circle cx="126" cy="115" r="8" fill="#CC3A3A" opacity="0.2" />
      <circle cx="162" cy="115" r="8" fill="#CC3A3A" opacity="0.2" />
      <text x="72" y="118" fontSize="9" fill="#CC3A3A" textAnchor="middle" fontWeight="bold" fontFamily="Inter">1</text>
      <text x="108" y="118" fontSize="9" fill="#CC3A3A" textAnchor="middle" fontWeight="bold" fontFamily="Inter">3</text>
      <text x="126" y="118" fontSize="9" fill="#CC3A3A" textAnchor="middle" fontWeight="bold" fontFamily="Inter">4</text>
      <text x="162" y="118" fontSize="9" fill="#CC3A3A" textAnchor="middle" fontWeight="bold" fontFamily="Inter">6</text>
      {/* empty days */}
      <text x="90" y="118" fontSize="9" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">2</text>
      <text x="144" y="118" fontSize="9" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">5</text>
      {/* check marks */}
      <path d="M68 113 L72 117 L78 111" stroke="#CC3A3A" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function CalendarFull() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      <rect x="55" y="50" width="130" height="120" rx="10" fill="white" stroke="#CC3A3A" strokeWidth="2" />
      <rect x="55" y="50" width="130" height="30" rx="10" fill="#CC3A3A" />
      <rect x="55" y="70" width="130" height="10" fill="#CC3A3A" />
      <line x1="90" y1="42" x2="90" y2="58" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" />
      <line x1="150" y1="42" x2="150" y2="58" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" />
      <text x="72" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Пн</text>
      <text x="90" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Вт</text>
      <text x="108" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Ср</text>
      <text x="126" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Чт</text>
      <text x="144" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Пт</text>
      <text x="162" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Сб</text>
      <text x="174" y="95" fontSize="8" fill="#1E1E1E" opacity="0.4" textAnchor="middle" fontFamily="Inter">Вс</text>
      {/* ALL marked */}
      {[72, 90, 108, 126, 144, 162, 174].map((cx, i) => (
        <g key={i}>
          <circle cx={cx} cy={115} r="8" fill="#CC3A3A" opacity="0.25" />
          <text x={cx} y={118} fontSize="9" fill="#CC3A3A" textAnchor="middle" fontWeight="bold" fontFamily="Inter">{i + 1}</text>
        </g>
      ))}
      {/* fire icon accent */}
      <text x="120" y="155" textAnchor="middle" fontSize="20" fontFamily="Inter">&#x1F525;</text>
    </svg>
  )
}

function ThinkingPersonIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* body */}
      <circle cx="120" cy="85" r="25" fill="#DFED8C" opacity="0.5" />
      {/* head */}
      <circle cx="120" cy="85" r="18" fill="white" stroke="#1E1E1E" strokeWidth="2" />
      {/* eyes */}
      <circle cx="113" cy="82" r="2" fill="#1E1E1E" />
      <circle cx="127" cy="82" r="2" fill="#1E1E1E" />
      {/* mouth - thinking */}
      <path d="M114 92 Q120 90 126 92" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* hand on chin */}
      <path d="M130 95 Q135 100 132 105" stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* thought bubbles */}
      <circle cx="145" cy="65" r="4" fill="#CC3A3A" opacity="0.2" />
      <circle cx="155" cy="50" r="6" fill="#CC3A3A" opacity="0.2" />
      <circle cx="165" cy="35" r="10" fill="#CC3A3A" opacity="0.15" />
      <text x="165" y="39" textAnchor="middle" fontSize="12" fill="#CC3A3A" fontFamily="Inter">?</text>
      {/* body silhouette */}
      <path d="M100 110 Q120 100 140 110 L145 160 Q120 155 95 160 Z" fill="#CC3A3A" opacity="0.15" rx="8" />
    </svg>
  )
}

/* ====================================================================
   STEP 4 ILLUSTRATIONS — Time
   ==================================================================== */

function SunriseIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* horizon */}
      <rect x="30" y="130" width="180" height="50" rx="8" fill="#DFED8C" opacity="0.3" />
      {/* sun half */}
      <circle cx="120" cy="130" r="30" fill="#DFED8C" />
      <rect x="30" y="130" width="180" height="50" fill="#DFED8C" opacity="0.3" />
      {/* rays */}
      <g stroke="#CC3A3A" strokeWidth="2" strokeLinecap="round" opacity="0.6">
        <line x1="120" y1="90" x2="120" y2="78" />
        <line x1="95" y1="100" x2="85" y2="90" />
        <line x1="145" y1="100" x2="155" y2="90" />
        <line x1="82" y1="118" x2="70" y2="115" />
        <line x1="158" y1="118" x2="170" y2="115" />
      </g>
      {/* arrow up */}
      <path d="M120 75 L115 82 M120 75 L125 82" stroke="#CC3A3A" strokeWidth="2" strokeLinecap="round" />
      {/* hills */}
      <path d="M30 150 Q80 120 120 145 Q160 120 210 150 L210 180 L30 180Z" fill="#6BBF59" opacity="0.2" />
    </svg>
  )
}

function DaySunIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* sky gradient feel */}
      <circle cx="120" cy="90" r="35" fill="#DFED8C" />
      <circle cx="120" cy="90" r="25" fill="#DFED8C" opacity="0.8" />
      {/* rays */}
      <g stroke="#CC3A3A" strokeWidth="2.5" strokeLinecap="round" opacity="0.5">
        <line x1="120" y1="45" x2="120" y2="32" />
        <line x1="120" y1="135" x2="120" y2="148" />
        <line x1="75" y1="90" x2="62" y2="90" />
        <line x1="165" y1="90" x2="178" y2="90" />
        <line x1="88" y1="58" x2="79" y2="49" />
        <line x1="152" y1="58" x2="161" y2="49" />
        <line x1="88" y1="122" x2="79" y2="131" />
        <line x1="152" y1="122" x2="161" y2="131" />
      </g>
      {/* clouds */}
      <ellipse cx="60" cy="150" rx="25" ry="10" fill="white" opacity="0.6" />
      <ellipse cx="180" cy="160" rx="20" ry="8" fill="white" opacity="0.6" />
      {/* small smiley on sun */}
      <circle cx="112" cy="86" r="2" fill="#1E1E1E" opacity="0.4" />
      <circle cx="128" cy="86" r="2" fill="#1E1E1E" opacity="0.4" />
      <path d="M112 96 Q120 102 128 96" stroke="#1E1E1E" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4" />
    </svg>
  )
}

function SunsetIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* gradient sky */}
      <rect x="30" y="30" width="180" height="100" rx="10" fill="#CC3A3A" opacity="0.08" />
      <rect x="30" y="90" width="180" height="40" rx="0" fill="#CC3A3A" opacity="0.12" />
      {/* setting sun */}
      <circle cx="120" cy="130" r="28" fill="#CC3A3A" opacity="0.3" />
      <circle cx="120" cy="130" r="20" fill="#DFED8C" opacity="0.8" />
      {/* horizon */}
      <line x1="30" y1="130" x2="210" y2="130" stroke="#CC3A3A" strokeWidth="1.5" opacity="0.3" />
      {/* water reflections */}
      <line x1="100" y1="145" x2="140" y2="145" stroke="#DFED8C" strokeWidth="1" opacity="0.4" />
      <line x1="105" y1="155" x2="135" y2="155" stroke="#DFED8C" strokeWidth="1" opacity="0.3" />
      <line x1="110" y1="165" x2="130" y2="165" stroke="#DFED8C" strokeWidth="1" opacity="0.2" />
      {/* moon crescent hint */}
      <circle cx="170" cy="50" r="10" fill="white" opacity="0.3" />
      <circle cx="174" cy="47" r="9" fill="#CC3A3A" opacity="0.08" />
      {/* stars */}
      <circle cx="60" cy="45" r="1.5" fill="white" opacity="0.5" />
      <circle cx="185" cy="70" r="1.5" fill="white" opacity="0.4" />
    </svg>
  )
}

function WeekendIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      {/* calendar */}
      <rect x="70" y="55" width="100" height="95" rx="8" fill="white" stroke="#CC3A3A" strokeWidth="2" />
      <rect x="70" y="55" width="100" height="25" rx="8" fill="#CC3A3A" opacity="0.8" />
      <rect x="70" y="72" width="100" height="8" fill="#CC3A3A" opacity="0.8" />
      {/* hooks */}
      <line x1="95" y1="48" x2="95" y2="62" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" />
      <line x1="145" y1="48" x2="145" y2="62" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" />
      {/* Сб Вс highlighted */}
      <text x="85" y="95" fontSize="7" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">Пн</text>
      <text x="100" y="95" fontSize="7" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">Вт</text>
      <text x="115" y="95" fontSize="7" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">Ср</text>
      <text x="130" y="95" fontSize="7" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">Чт</text>
      <text x="145" y="95" fontSize="7" fill="#1E1E1E" opacity="0.3" textAnchor="middle" fontFamily="Inter">Пт</text>
      <text x="155" y="95" fontSize="7" fill="#CC3A3A" fontWeight="bold" textAnchor="middle" fontFamily="Inter">Сб</text>
      <text x="165" y="95" fontSize="7" fill="#CC3A3A" fontWeight="bold" textAnchor="middle" fontFamily="Inter">Вс</text>
      {/* weekend cells highlighted */}
      <rect x="150" y="100" width="18" height="14" rx="3" fill="#CC3A3A" opacity="0.15" />
      <rect x="150" y="118" width="18" height="14" rx="3" fill="#CC3A3A" opacity="0.15" />
      <rect x="150" y="136" width="18" height="10" rx="3" fill="#CC3A3A" opacity="0.15" />
      {/* relaxed accent - coffee cup */}
      <rect x="185" y="130" width="18" height="20" rx="4" fill="white" stroke="#CC3A3A" strokeWidth="1.5" />
      <path d="M203 136 Q210 138 203 144" stroke="#CC3A3A" strokeWidth="1.5" fill="none" />
      {/* steam */}
      <path d="M190 125 Q192 120 190 115" stroke="#CC3A3A" strokeWidth="1" opacity="0.3" fill="none" />
      <path d="M196 125 Q198 118 196 113" stroke="#CC3A3A" strokeWidth="1" opacity="0.3" fill="none" />
    </svg>
  )
}

/* ====================================================================
   DEFAULT / FALLBACK
   ==================================================================== */

function DefaultIllustration() {
  return (
    <svg viewBox="0 0 240 200" fill="none" className="h-full w-full max-h-[280px]">
      <circle cx="120" cy="100" r="50" fill="#CC3A3A" opacity="0.1" />
      <circle cx="120" cy="100" r="30" fill="#CC3A3A" opacity="0.15" />
      <text x="120" y="108" textAnchor="middle" fontSize="28" fill="#CC3A3A" fontFamily="Inter" fontWeight="bold">?</text>
    </svg>
  )
}

/* ====================================================================
   ILLUSTRATION MAP
   ==================================================================== */

const illustrationMap: Record<number, Record<string, React.ReactNode>> = {
  1: {
    career: <CareerIllustration />,
    child: <ChildIllustration />,
    exams: <ExamsIllustration />,
    travel: <TravelIllustration />,
  },
  2: {
    beginner: <SproutIllustration />,
    intermediate: <GrowingTreeIllustration />,
    advanced: <FullTreeIllustration />,
    unknown: <QuestionIllustration />,
  },
  3: {
    "1-2": <CalendarSparse />,
    "3-4": <CalendarMedium />,
    daily: <CalendarFull />,
    undecided: <ThinkingPersonIllustration />,
  },
  4: {
    morning: <SunriseIllustration />,
    afternoon: <DaySunIllustration />,
    evening: <SunsetIllustration />,
    weekends: <WeekendIllustration />,
  },
}

const defaultIllustrationMap: Record<number, React.ReactNode> = {
  1: <CareerIllustration />,
  2: <SproutIllustration />,
  3: <CalendarSparse />,
  4: <SunriseIllustration />,
}

/* ====================================================================
   MAIN COMPONENT
   ==================================================================== */

export function OnboardingIllustration({
  step,
  selectedOption,
  bgColor,
}: OnboardingIllustrationProps) {
  const stepIllustrations = illustrationMap[step]
  const illustration =
    (selectedOption && stepIllustrations?.[selectedOption]) ||
    defaultIllustrationMap[step] ||
    <DefaultIllustration />

  const key = `${step}-${selectedOption ?? "default"}`

  return (
    <div
      className="flex h-full w-full items-center justify-center p-8 transition-colors duration-500"
      style={{ backgroundColor: bgColor }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="flex w-full max-w-[340px] items-center justify-center"
        >
          <FloatingWrap>{illustration}</FloatingWrap>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

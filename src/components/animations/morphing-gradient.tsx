"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MorphingGradientProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
}

export function MorphingGradient({
  children,
  className,
  colors = ["#CC3A3A", "#DFED8C", "#1E1E1E"],
}: MorphingGradientProps) {
  const gradient = colors.join(", ");

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        background: `linear-gradient(-45deg, ${gradient})`,
        backgroundSize: "400% 400%",
        animation: "morphGradient 8s ease infinite",
      }}
    >
      <style>{`
        @keyframes morphGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      {children}
    </div>
  );
}

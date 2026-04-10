"use client";

import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";

interface CursorFollowerProps {
  size?: number;
  color?: string;
}

export function CursorFollower({
  size = 32,
  color = "#CC3A3A",
}: CursorFollowerProps) {
  const [visible, setVisible] = useState(false);

  const x = useSpring(0, { stiffness: 200, damping: 25 });
  const y = useSpring(0, { stiffness: 200, damping: 25 });

  useEffect(() => {
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    if (isMobile) return;

    setVisible(true);

    const handleMouseMove = (e: MouseEvent) => {
      x.set(e.clientX - size / 2);
      y.set(e.clientY - size / 2);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [size, x, y]);

  if (!visible) return null;

  return (
    <motion.div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        x,
        y,
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: 0.6,
        mixBlendMode: "difference",
      }}
    />
  );
}

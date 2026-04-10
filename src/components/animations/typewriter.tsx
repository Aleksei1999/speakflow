"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TypeWriterProps {
  text: string;
  speed?: number;
  className?: string;
  delay?: number;
}

export function TypeWriter({
  text,
  speed = 50,
  className,
  delay = 0,
}: TypeWriterProps) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed("");
    startedRef.current = false;

    const delayTimer = setTimeout(() => {
      startedRef.current = true;
      let lastTime = 0;

      const step = (time: number) => {
        if (!startedRef.current) return;
        if (time - lastTime >= speed) {
          lastTime = time;
          indexRef.current += 1;
          setDisplayed(text.slice(0, indexRef.current));
          if (indexRef.current >= text.length) return;
        }
        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    }, delay);

    return () => {
      startedRef.current = false;
      clearTimeout(delayTimer);
    };
  }, [text, speed, delay]);

  return (
    <span className={cn(className)}>
      {displayed}
      {displayed.length < text.length && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  );
}

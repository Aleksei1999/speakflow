"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TestimonialItem {
  text: string;
  author: string;
  role?: string;
}

interface TestimonialCarouselProps {
  items: TestimonialItem[];
  speed?: number;
  className?: string;
}

export function TestimonialCarousel({
  items,
  speed = 4,
  className,
}: TestimonialCarouselProps) {
  const [index, setIndex] = useState(0);

  const advance = useCallback(() => {
    setIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    const timer = setInterval(advance, speed * 1000);
    return () => clearInterval(timer);
  }, [advance, speed]);

  const item = items[index];
  if (!item) return null;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          <blockquote className="text-lg italic">&ldquo;{item.text}&rdquo;</blockquote>
          <div className="mt-4 font-semibold">{item.author}</div>
          {item.role && (
            <div className="text-sm opacity-70">{item.role}</div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

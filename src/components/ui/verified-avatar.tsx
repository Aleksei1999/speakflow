"use client"

import * as React from "react"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * Аватар с verified-бейджем «облачко с галочкой». Бейдж показывается
 * только если `verified === true`. Используется на профилях, карточках
 * преподавателей, в шапке dashboard'а — везде где хотим визуально
 * пометить «email подтверждён» / «верифицированный аккаунт».
 *
 * SVG взят из шаблона Origin UI и адаптирован под наши CSS variables
 * (--surface для fill-background, --primary/var(--red) для checkmark).
 */
export interface VerifiedAvatarProps {
  /** Image URL. Если null/undefined — показывается fallback с initials. */
  src?: string | null
  /** Alt-текст изображения / aria-label fallback. */
  alt?: string
  /** Initials или текст для fallback. */
  fallback?: string | null
  /** Если true — рендерит «облачко с галочкой» в правом-верхнем углу. */
  verified?: boolean
  /** Размер аватара — наследует Avatar API (sm/default/lg). */
  size?: "sm" | "default" | "lg"
  /** Класс на корневой Avatar — для inline-стилей размера/border. */
  className?: string
  /** Класс на бейдж (позиционирование/размер SVG). По умолчанию -end-1 -top-1. */
  badgeClassName?: string
}

export function VerifiedAvatar({
  src,
  alt,
  fallback,
  verified,
  size = "default",
  className,
  badgeClassName,
}: VerifiedAvatarProps) {
  return (
    <div className="relative inline-block">
      <Avatar size={size} className={className}>
        {src ? <AvatarImage src={src} alt={alt ?? ""} /> : null}
        <AvatarFallback aria-label={alt ?? undefined}>
          {fallback ?? "?"}
        </AvatarFallback>
      </Avatar>
      {verified ? (
        <span
          className={cn("absolute -end-1 -top-1 z-10", badgeClassName)}
          aria-hidden="false"
        >
          <span className="sr-only">Подтверждённый аккаунт</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            {/* Outer scalloped cloud */}
            <path
              fill="#FFFFFF"
              d="M3.046 8.277A4.402 4.402 0 0 1 8.303 3.03a4.4 4.4 0 0 1 7.411 0 4.397 4.397 0 0 1 5.19 3.068c.207.713.23 1.466.067 2.19a4.4 4.4 0 0 1 0 7.415 4.403 4.403 0 0 1-3.06 5.187 4.398 4.398 0 0 1-2.186.072 4.398 4.398 0 0 1-7.422 0 4.398 4.398 0 0 1-5.257-5.248 4.4 4.4 0 0 1 0-7.437Z"
            />
            {/* Inner cloud — Instagram-style verified blue */}
            <path
              fill="#0095F6"
              d="M4.674 8.954a3.602 3.602 0 0 1 4.301-4.293 3.6 3.6 0 0 1 6.064 0 3.598 3.598 0 0 1 4.3 4.302 3.6 3.6 0 0 1 0 6.067 3.6 3.6 0 0 1-4.29 4.302 3.6 3.6 0 0 1-6.074 0 3.598 3.598 0 0 1-4.3-4.293 3.6 3.6 0 0 1 0-6.085Z"
            />
            {/* Checkmark */}
            <path
              fill="#FFFFFF"
              d="M15.707 9.293a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L11 12.586l3.293-3.293a1 1 0 0 1 1.414 0Z"
            />
          </svg>
        </span>
      ) : null}
    </div>
  )
}

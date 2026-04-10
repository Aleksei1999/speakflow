"use client"

import {
  Briefcase,
  GraduationCap,
  PenTool,
  Plane,
  Sprout,
  TreeDeciduous,
  TreePine,
  HelpCircle,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Clock,
  Sun,
  Sunset,
  Moon,
  Coffee,
} from "lucide-react"
import type { ReactNode } from "react"

export interface QuizOption {
  id: string
  label: string
  sublabel?: string
  icon: ReactNode
}

export interface QuizStep {
  id: number
  question: string
  bgColor: string
  options: QuizOption[]
}

export const quizSteps: QuizStep[] = [
  {
    id: 1,
    question: "Какая у вас цель?",
    bgColor: "#FFF0F0",
    options: [
      {
        id: "career",
        label: "Карьера и бизнес",
        icon: <Briefcase className="h-5 w-5" />,
      },
      {
        id: "child",
        label: "Для ребёнка",
        icon: <GraduationCap className="h-5 w-5" />,
      },
      {
        id: "exams",
        label: "Экзамены",
        icon: <PenTool className="h-5 w-5" />,
      },
      {
        id: "travel",
        label: "Путешествия и хобби",
        icon: <Plane className="h-5 w-5" />,
      },
    ],
  },
  {
    id: 2,
    question: "Какой у вас уровень?",
    bgColor: "#F0FFF0",
    options: [
      {
        id: "beginner",
        label: "Начинающий",
        sublabel: "A1-A2",
        icon: <Sprout className="h-5 w-5" />,
      },
      {
        id: "intermediate",
        label: "Средний",
        sublabel: "B1-B2",
        icon: <TreeDeciduous className="h-5 w-5" />,
      },
      {
        id: "advanced",
        label: "Продвинутый",
        sublabel: "C1-C2",
        icon: <TreePine className="h-5 w-5" />,
      },
      {
        id: "unknown",
        label: "Не знаю",
        icon: <HelpCircle className="h-5 w-5" />,
      },
    ],
  },
  {
    id: 3,
    question: "Как часто хотите заниматься?",
    bgColor: "#F0F0FF",
    options: [
      {
        id: "1-2",
        label: "1-2 раза в неделю",
        icon: <Calendar className="h-5 w-5" />,
      },
      {
        id: "3-4",
        label: "3-4 раза в неделю",
        icon: <CalendarCheck className="h-5 w-5" />,
      },
      {
        id: "daily",
        label: "Каждый день",
        icon: <CalendarDays className="h-5 w-5" />,
      },
      {
        id: "undecided",
        label: "Пока не решил(а)",
        icon: <Clock className="h-5 w-5" />,
      },
    ],
  },
  {
    id: 4,
    question: "Когда удобно заниматься?",
    bgColor: "#FFFBF0",
    options: [
      {
        id: "morning",
        label: "Утро",
        sublabel: "6:00-12:00",
        icon: <Coffee className="h-5 w-5" />,
      },
      {
        id: "afternoon",
        label: "День",
        sublabel: "12:00-17:00",
        icon: <Sun className="h-5 w-5" />,
      },
      {
        id: "evening",
        label: "Вечер",
        sublabel: "17:00-22:00",
        icon: <Sunset className="h-5 w-5" />,
      },
      {
        id: "weekends",
        label: "Выходные",
        icon: <Moon className="h-5 w-5" />,
      },
    ],
  },
]

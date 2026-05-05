import type { TourStep } from "./OnboardingTour"

export const TEACHER_TOUR_STEPS: TourStep[] = [
  {
    target: "[data-onboarding='tch-stat-month']",
    title: "Здесь твоя статистика",
    text: "Сегодняшние уроки, доход за неделю и рейтинг — следи за прогрессом на этих карточках.",
    placement: "bottom",
  },
  {
    target: "[data-onboarding='nav-schedule']",
    title: "Расписание",
    text: "Поставь часы доступности — студенты увидят свободные слоты и забронируют сами.",
    placement: "right",
  },
  {
    target: "[data-onboarding='nav-students']",
    title: "Мои ученики",
    text: "Все твои студенты — с уровнем, стриком и историей уроков.",
    placement: "right",
  },
  {
    target: "[data-onboarding='nav-materials']",
    title: "Материалы",
    text: "Загружай PDF и видео — они автоматически появятся у студентов в личном кабинете.",
    placement: "right",
  },
  {
    target: "[data-onboarding='nav-payouts']",
    title: "Выплаты",
    text: "Здесь видно, сколько ты заработал за месяц и когда придёт ближайшая выплата.",
    placement: "right",
  },
]

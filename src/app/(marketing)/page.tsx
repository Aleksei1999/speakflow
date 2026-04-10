"use client"

import Link from "next/link"
import {
  Brain,
  Video,
  Trophy,
  Calendar,
  Users,
  TrendingUp,
  Star,
  CheckCircle,
  ArrowRight,
  BookOpen,
  UserCheck,
  CalendarPlus,
  Rocket,
  Quote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  TypeWriter,
  MagneticButton,
  AnimatedCounter,
  CursorFollower,
  MorphingGradient,
  TiltCard,
  RevealText,
  TestimonialCarousel,
  SmoothScroll,
  scrollToSection,
} from "@/components/animations"

/* ---------- data ---------- */

const features = [
  {
    icon: Brain,
    title: "AI-саммари",
    description:
      "Автоматические конспекты каждого урока, ключевые слова и рекомендации от искусственного интеллекта.",
  },
  {
    icon: Video,
    title: "Видеозвонки",
    description:
      "Встроенные видеоуроки высокого качества прямо в платформе -- без сторонних приложений.",
  },
  {
    icon: Trophy,
    title: "Геймификация",
    description:
      "Зарабатывайте баллы, открывайте достижения и соревнуйтесь с другими учениками.",
  },
  {
    icon: Calendar,
    title: "Гибкое расписание",
    description:
      "Выбирайте удобное время занятий. Переносите и отменяйте уроки без штрафов.",
  },
  {
    icon: Users,
    title: "Персональный подход",
    description:
      "Подбор преподавателя под ваши цели, уровень и стиль обучения.",
  },
  {
    icon: TrendingUp,
    title: "Отслеживание прогресса",
    description:
      "Детальная аналитика вашего обучения: словарный запас, грамматика, разговорные навыки.",
  },
]

const steps = [
  {
    icon: BookOpen,
    step: "01",
    title: "Пройдите тест",
    description: "Определите ваш текущий уровень английского за 10 минут.",
  },
  {
    icon: UserCheck,
    step: "02",
    title: "Выберите преподавателя",
    description:
      "Подберите идеального наставника по специализации, рейтингу и цене.",
  },
  {
    icon: CalendarPlus,
    step: "03",
    title: "Запишитесь на урок",
    description: "Выберите удобное время и оплатите занятие онлайн.",
  },
  {
    icon: Rocket,
    step: "04",
    title: "Учитесь и растите",
    description:
      "Занимайтесь по видеосвязи, получайте AI-саммари и отслеживайте прогресс.",
  },
]

const teachers = [
  {
    name: "Анна Петрова",
    initials: "АП",
    rating: 4.9,
    reviews: 124,
    specializations: ["IELTS", "Бизнес-английский", "Грамматика"],
    price: 1800,
    experience: 8,
  },
  {
    name: "Джеймс Уилсон",
    initials: "ДУ",
    rating: 5.0,
    reviews: 89,
    specializations: ["Разговорный", "Произношение", "Native Speaker"],
    price: 2200,
    experience: 12,
  },
  {
    name: "Мария Козлова",
    initials: "МК",
    rating: 4.8,
    reviews: 203,
    specializations: ["Для детей", "ОГЭ/ЕГЭ", "Начальный уровень"],
    price: 1500,
    experience: 6,
  },
]

const testimonials = [
  {
    text: "За 3 месяца я подняла уровень с B1 до B2. AI-саммари после каждого урока — это просто находка!",
    author: "Екатерина М.",
    role: "Маркетолог, изучает бизнес-английский",
  },
  {
    text: "Наконец-то платформа, где всё в одном месте — видеозвонки, материалы, прогресс. Не нужно ничего скачивать.",
    author: "Дмитрий К.",
    role: "Разработчик, готовится к собеседованиям",
  },
  {
    text: "Мой сын занимается 4 месяца. Геймификация работает — он сам просит заниматься!",
    author: "Ольга В.",
    role: "Мама ученика, 10 лет",
  },
  {
    text: "Преподаватель подобрал программу именно под мои цели. Уже через месяц заговорила увереннее.",
    author: "Анастасия Р.",
    role: "Студентка, готовится к IELTS",
  },
]

const stats = [
  { value: 1200, suffix: "+", label: "учеников" },
  { value: 48, suffix: "", label: "преподавателей" },
  { value: 15000, suffix: "+", label: "уроков проведено" },
  { value: 4.9, suffix: "", label: "средний рейтинг" },
]

/* ---------- page ---------- */

export default function MarketingPage() {
  return (
    <SmoothScroll>
      <CursorFollower />

      {/* ===== Hero ===== */}
      <section id="hero" className="relative overflow-hidden">
        <MorphingGradient className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                <TypeWriter
                  text="Учи английский с лучшими преподавателями"
                  speed={40}
                />
              </h1>
              <RevealText
                text="Онлайн-уроки с профессиональными преподавателями, AI-конспекты каждого занятия и игровая система мотивации. Начните говорить по-английски уверенно уже через месяц."
                className="max-w-xl text-lg text-muted-foreground"
              />
              <div className="flex flex-wrap gap-3">
                <MagneticButton>
                  <Button
                    size="lg"
                    className="bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                    render={<Link href="/register" />}
                  >
                    Начать бесплатно
                    <ArrowRight className="ml-1 size-4" />
                  </Button>
                </MagneticButton>
                <MagneticButton>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => scrollToSection("how-it-works")}
                  >
                    Как это работает
                  </Button>
                </MagneticButton>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="size-4 text-green-600" />
                  Бесплатный пробный урок
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="size-4 text-green-600" />
                  Без привязки карты
                </span>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="flex aspect-square items-center justify-center rounded-3xl bg-gradient-to-br from-[#CC3A3A]/10 via-[#CC3A3A]/5 to-transparent">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex size-24 items-center justify-center rounded-full bg-[#CC3A3A]/10">
                    <Video className="size-12" style={{ color: "#CC3A3A" }} />
                  </div>
                  <p className="max-w-[200px] text-sm font-medium text-muted-foreground">
                    Интерактивные видеоуроки с лучшими преподавателями
                  </p>
                </div>
              </div>
            </div>
          </div>
        </MorphingGradient>
      </section>

      {/* ===== Stats ===== */}
      <section className="border-y bg-[#1E1E1E] py-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-8 px-4 sm:px-6 lg:px-8">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center text-center">
              <span className="text-3xl font-bold text-white sm:text-4xl">
                <AnimatedCounter target={stat.value} duration={2} suffix={stat.suffix} />
              </span>
              <span className="mt-1 text-sm text-white/60">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <RevealText
              text="Все для эффективного обучения"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            />
            <p className="mt-4 text-lg text-muted-foreground">
              Современные инструменты, которые делают изучение английского
              удобным, эффективным и увлекательным.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <TiltCard key={feature.title}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div
                      className="mb-2 flex size-10 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "#CC3A3A1a" }}
                    >
                      <feature.icon className="size-5" style={{ color: "#CC3A3A" }} />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how-it-works" className="bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <RevealText
              text="Как это работает"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            />
            <p className="mt-4 text-lg text-muted-foreground">
              Четыре простых шага к свободному английскому
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <TiltCard key={step.step} maxTilt={8}>
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-4">
                    <div
                      className="flex size-16 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: "#CC3A3A1a" }}
                    >
                      <step.icon className="size-7" style={{ color: "#CC3A3A" }} />
                    </div>
                    <span
                      className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: "#CC3A3A" }}
                    >
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Teachers Preview ===== */}
      <section id="teachers" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <RevealText
              text="Наши преподаватели"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            />
            <p className="mt-4 text-lg text-muted-foreground">
              Опытные специалисты, которые помогут вам достичь ваших целей
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {teachers.map((teacher) => (
              <TiltCard key={teacher.name}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar size="lg">
                        <AvatarFallback>{teacher.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>{teacher.name}</CardTitle>
                        <div className="mt-1 flex items-center gap-1">
                          <Star className="size-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">
                            {teacher.rating}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({teacher.reviews} отзывов)
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {teacher.specializations.map((spec) => (
                        <Badge key={spec} variant="secondary">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Опыт: {teacher.experience} лет
                      </span>
                      <span className="text-lg font-bold" style={{ color: "#CC3A3A" }}>
                        {teacher.price} &#8381;
                        <span className="text-sm font-normal text-muted-foreground">
                          /урок
                        </span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TiltCard>
            ))}
          </div>

          <div className="mt-10 text-center">
            <MagneticButton>
              <Button
                variant="outline"
                size="lg"
                render={<Link href="/teachers" />}
              >
                Все преподаватели
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* ===== Testimonials ===== */}
      <section className="bg-muted/30 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <RevealText
              text="Что говорят наши ученики"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            />
          </div>
          <div className="mx-auto mt-12 max-w-2xl">
            <Quote className="mx-auto mb-4 size-8 text-[#CC3A3A]/30" />
            <TestimonialCarousel
              items={testimonials}
              speed={5}
              className="text-center"
            />
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <RevealText
              text="Простые и прозрачные цены"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            />
            <p className="mt-4 text-lg text-muted-foreground">
              Оплачивайте только занятия. Никаких подписок и скрытых платежей.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-3xl gap-6 sm:grid-cols-2">
            <TiltCard maxTilt={6}>
              <Card className="relative h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <Badge variant="secondary" className="w-fit">
                    Первое занятие
                  </Badge>
                  <CardTitle className="mt-2 text-2xl">Пробный урок</CardTitle>
                  <CardDescription>
                    Познакомьтесь с преподавателем и платформой
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold" style={{ color: "#CC3A3A" }}>
                      от 500 &#8381;
                    </span>
                    <span className="text-muted-foreground"> / 30 мин</span>
                  </div>
                  <ul className="flex flex-col gap-3 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      Определение уровня
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      Знакомство с преподавателем
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      Персональный план обучения
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      AI-саммари пробного урока
                    </li>
                  </ul>
                  <MagneticButton className="mt-6">
                    <Button
                      className="w-full bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                      size="lg"
                      render={<Link href="/register" />}
                    >
                      Записаться
                    </Button>
                  </MagneticButton>
                </CardContent>
              </Card>
            </TiltCard>

            <TiltCard maxTilt={6}>
              <Card className="relative h-full ring-2 ring-[#CC3A3A] transition-shadow hover:shadow-md">
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#CC3A3A" }}
                >
                  Популярный
                </div>
                <CardHeader>
                  <Badge
                    variant="outline"
                    className="w-fit border-[#CC3A3A]/30 text-[#CC3A3A]"
                  >
                    Регулярные занятия
                  </Badge>
                  <CardTitle className="mt-2 text-2xl">Стандартный урок</CardTitle>
                  <CardDescription>
                    Полноценное занятие с опытным преподавателем
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <span className="text-4xl font-bold" style={{ color: "#CC3A3A" }}>
                      от 1 500 &#8381;
                    </span>
                    <span className="text-muted-foreground"> / 50 мин</span>
                  </div>
                  <ul className="flex flex-col gap-3 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      Все из пробного урока
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      Домашние задания
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      Материалы урока
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      Отслеживание прогресса
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600" />
                      Система достижений
                    </li>
                  </ul>
                  <MagneticButton className="mt-6">
                    <Button
                      className="w-full bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                      size="lg"
                      render={<Link href="/register" />}
                    >
                      Начать обучение
                    </Button>
                  </MagneticButton>
                </CardContent>
              </Card>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12 sm:py-20"
            style={{
              background:
                "linear-gradient(135deg, #CC3A3A 0%, #a32e2e 50%, #3d1a1e 100%)",
            }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Начните учить английский сегодня
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
              Присоединяйтесь к тысячам учеников, которые уже улучшают свой
              английский с RAW English. Первый урок -- бесплатно.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <MagneticButton>
                <Button
                  size="lg"
                  className="bg-white text-[#CC3A3A] hover:bg-white/90"
                  render={<Link href="/register" />}
                >
                  Начать бесплатно
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </MagneticButton>
              <MagneticButton>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                  render={<Link href="/level-test" />}
                >
                  Пройти тест уровня
                </Button>
              </MagneticButton>
            </div>
          </div>
        </div>
      </section>
    </SmoothScroll>
  )
}

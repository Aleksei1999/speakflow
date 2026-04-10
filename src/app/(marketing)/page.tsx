import Link from "next/link"
import {
  ArrowRight,
  CheckCircle,
  Star,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

/* ===== Block 1: Hero ===== */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#CC3A3A]/5 to-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Английский, на котором вы наконец{" "}
              <span className="text-[#CC3A3A]">заговорите</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
              Платформа, где уроки с преподавателем, разговорные клубы и
              профессиональное сообщество работают вместе. Не просто учите —
              практикуете каждый день с реальными людьми.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                className="bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
                render={<Link href="/get-started" />}
              >
                Узнать свой уровень бесплатно
                <ArrowRight className="ml-1 size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<Link href="/register" />}
              >
                Попробовать Speaking Club
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="size-4 text-green-600" />
                Бесплатный тест уровня
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle className="size-4 text-green-600" />
                Пробный Speaking Club
              </span>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="flex aspect-square items-center justify-center rounded-3xl bg-gradient-to-br from-[#CC3A3A]/10 via-[#DFED8C]/10 to-transparent">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="text-6xl">🗣️</div>
                <p className="max-w-[220px] text-sm font-medium text-muted-foreground">
                  6 человек в видеозвонке, живые лица, обсуждение
                </p>
                <div className="flex items-center gap-2 rounded-full bg-[#1E1E1E] px-4 py-2 text-white text-xs">
                  <span className="text-[#DFED8C]">Medium Rare</span>
                  <div className="h-1.5 w-20 rounded-full bg-white/20">
                    <div className="h-full w-3/5 rounded-full bg-[#DFED8C]" />
                  </div>
                  <span>1250 XP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ===== Block 2: Problem ===== */
function Problem() {
  const problems = [
    { emoji: "📋", title: "«Знаю, но молчу»", text: "На созвоне с иностранными коллегами всё понимаете, но когда приходит ваша очередь — ступор. Переключаетесь на русский или отделываетесь парой фраз." },
    { emoji: "📱", title: "«Duolingo-эффект»", text: "Прошли 200 уровней в приложении, знаете слово «penguin» на пяти языках, но заказать кофе за границей — стресс." },
    { emoji: "💸", title: "«Вечный репетитор»", text: "Третий преподаватель за два года. Каждый раз начинаете с грамматики, каждый раз бросаете через 3 месяца. Потому что грамматика без практики — мёртвый груз." },
    { emoji: "🌍", title: "«Google Translate»", text: "За границей общаетесь через переводчик в телефоне. Хотите спросить дорогу — набираете текст. Это не общение, это выживание." },
  ]
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Знакомо?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Вы учите английский годами, но по-прежнему не можете свободно
            говорить. Это не потому, что вы ленивый. Это потому, что старые
            методы дают знания, но не дают навык.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {problems.map((p) => (
            <div key={p.title} className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 text-3xl">{p.emoji}</div>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-muted-foreground">
          Проблема не в вас. Проблема в том, что вам не хватает среды, где
          можно говорить. Регулярно, без стресса, с людьми своего уровня.
        </p>
      </div>
    </section>
  )
}

/* ===== Block 3: Solution ===== */
function Solution() {
  const features = [
    { emoji: "🗣️", title: "Практика с первого дня", text: "Начинаете говорить сразу — в Speaking Clubs с людьми своего уровня. 6–8 человек, модератор, комфортная атмосфера." },
    { emoji: "👨‍🏫", title: "Уроки + сообщество", text: "Индивидуальные занятия дают структуру, а клубы — реальную практику. Одно без другого не работает. У нас — работает вместе." },
    { emoji: "🎯", title: "Английский для вашей сферы", text: "Business, IT, Travel, Medical — нишевые клубы с носителями языка из вашей индустрии." },
    { emoji: "🤖", title: "AI-отчёт после каждого урока", text: "Ваши ошибки, новая лексика, персональные упражнения на закрепление. Прогресс — в цифрах." },
    { emoji: "👥", title: "Сообщество, которое держит", text: "Чат на английском, челленджи, события. Когда учишь язык в среде — бросить сложнее, чем продолжить." },
  ]
  return (
    <section className="bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            RAW English — платформа, где вы учитесь говорить, а не молчать
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Мы объединили индивидуальные уроки, разговорные клубы, сообщество и
            технологии. Всё в одном месте, в одной подписке.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 text-3xl">{f.emoji}</div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===== Block 4: How it works ===== */
function HowItWorks() {
  const steps = [
    { num: "01", title: "Регистрация", text: "Создайте аккаунт за 2 минуты. Без оплаты, без обязательств." },
    { num: "02", title: "Тест уровня", text: "Узнаете свой уровень по системе RAW English (от Raw до Well Done) и получите рекомендации." },
    { num: "03", title: "Подбор программы", text: "Подберём преподавателя, клубы и расписание. Всё гибко — меняйте в любой момент." },
    { num: "04", title: "Первое занятие", text: "Speaking Club или индивидуальный урок. После первого занятия поймёте, как это работает." },
  ]
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Начать легко. 4 шага — и вы уже практикуете.
          </h2>
        </div>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.num} className="flex flex-col items-center text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#CC3A3A] text-lg font-bold text-white">
                {s.num}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button
            size="lg"
            className="bg-[#CC3A3A] text-white hover:bg-[#a32e2e]"
            render={<Link href="/get-started" />}
          >
            Пройти тест уровня
            <ArrowRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ===== Block 5: Formats ===== */
function Formats() {
  const formats = [
    { emoji: "👨‍🏫", title: "Индивидуальные уроки", tags: ["50 мин", "Видеозвонок", "AI-саммари"], text: "Персональные занятия с профессиональным преподавателем. Программа адаптируется под ваши цели." },
    { emoji: "🗣️", title: "Speaking Clubs", tags: ["6–8 чел.", "45–60 мин", "По уровням"], text: "Групповые разговорные клубы с модератором. Новая тема каждую неделю: дискуссии, ролевые игры, дебаты." },
    { emoji: "🎯", title: "Тематические клубы", tags: ["Business", "IT", "Travel", "Medical"], text: "Английский в контексте вашей профессии. Ведут носители языка с реальным опытом в индустрии." },
    { emoji: "🎪", title: "Events и челленджи", tags: ["Мастер-классы", "Networking", "Командные"], text: "Тематические вечера, networking-сессии, ежемесячные сессии с психологом по преодолению языкового барьера." },
  ]
  return (
    <section id="formats" className="bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Выберите свой формат. Или совмещайте все.
          </h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {formats.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6">
              <div className="mb-3 text-3xl">{f.emoji}</div>
              <h3 className="text-xl font-bold">{f.title}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.tags.map((t) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button size="lg" variant="outline" render={<Link href="/register" />}>
            Записаться на пробный урок — бесплатно
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ===== Block 6: Level System ===== */
function LevelSystem() {
  const levels = [
    { name: "Raw", sub: "A0–A1", color: "#CC3A3A" },
    { name: "Rare", sub: "A2", color: "#d44" },
    { name: "Medium Rare", sub: "B1", color: "#e67" },
    { name: "Medium", sub: "B2", color: "#c2a832" },
    { name: "Medium Well", sub: "C1", color: "#8bb83a" },
    { name: "Well Done", sub: "C2", color: "#DFED8C" },
  ]
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ваш путь: от Raw до Well Done
          </h2>
          <p className="mt-4 text-muted-foreground">
            Своя система уровней — понятная, наглядная и привязанная к реальному
            прогрессу.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="flex overflow-x-auto gap-1 rounded-2xl bg-gradient-to-r from-[#CC3A3A] to-[#DFED8C] p-1">
            {levels.map((l) => (
              <div
                key={l.name}
                className="flex flex-1 min-w-[100px] flex-col items-center rounded-xl bg-white/90 p-3 text-center"
              >
                <span className="text-lg">🥩</span>
                <span className="mt-1 text-sm font-bold text-[#1E1E1E]">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.sub}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-lg font-bold text-[#CC3A3A]">
            Make it Well Done.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ===== Block 7: Teachers ===== */
function Teachers() {
  const teachers = [
    { name: "Имя Фамилия", initials: "ИФ", spec: "General English, Speaking", exp: "8 лет, жил в Великобритании", levels: "Raw → Medium", quote: "Мой подход — разговорить вас за первые 10 минут." },
    { name: "Зубрицкая Анастасия", initials: "ЗА", spec: "Business English, интервью", exp: "5 лет, корпоративные клиенты", levels: "Medium Rare → Well Done", quote: "Я учу не просто говорить — а говорить так, чтобы вас слышали." },
    { name: "Перевозчиков Олег", initials: "ПО", spec: "IT English, Technical Communication", exp: "6 лет, билингвальная среда", levels: "Rare → Medium Well", quote: "Если вы можете объяснить архитектуру на английском — вы можете всё." },
    { name: "Native Speaker", initials: "NS", spec: "Speaking Clubs, Travel English", exp: "Носитель языка (UK/US)", levels: "Все уровни", quote: "Real conversations. Real progress. No textbooks." },
  ]
  return (
    <section className="bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Люди, а не роботы. Профессионалы, а не случайные носители.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Русскоязычные специалисты с педагогическим образованием и носители с
            опытом в конкретных областях. Каждый прошёл отбор.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {teachers.map((t) => (
            <div key={t.name} className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <Avatar size="lg"><AvatarFallback>{t.initials}</AvatarFallback></Avatar>
                <div>
                  <h3 className="font-semibold">{t.name}</h3>
                  <p className="text-xs text-muted-foreground">{t.spec}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t.exp}</p>
              <Badge variant="secondary" className="mt-2">{t.levels}</Badge>
              <p className="mt-3 text-sm italic text-muted-foreground">&laquo;{t.quote}&raquo;</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Button variant="outline" size="lg" render={<Link href="/teachers" />}>
            Все преподаватели <ArrowRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ===== Block 8: Target Audience ===== */
function Audience() {
  const personas = [
    { emoji: "💼", title: "Молодой специалист", text: "Грамматику знаете, а на собеседовании — ступор. Вам нужна уверенность в разговоре." },
    { emoji: "💻", title: "IT-специалист", text: "Документацию читаете свободно, а на daily standup переключаетесь на русский." },
    { emoji: "👩‍👧", title: "Мама в декрете", text: "Хотите инвестировать в себя, пока есть время. Гибкое расписание и сообщество." },
    { emoji: "📊", title: "Предприниматель", text: "Бизнес выходит на международный рынок. Вам нужен Business English для переговоров." },
    { emoji: "✈️", title: "Путешественник", text: "Хотите свободно общаться за границей — без стресса и разговорника." },
  ]
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Узнаёте себя?</h2>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((p) => (
            <div key={p.title} className="rounded-2xl border bg-card p-5">
              <div className="mb-2 text-2xl">{p.emoji}</div>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===== Block 9: Pricing ===== */
function Pricing() {
  return (
    <section id="pricing" className="bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Платите только за уроки. Остальное — по желанию.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Никаких пакетов и обязательных подписок.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-3">
          {/* Individual */}
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-xl font-bold">Индивидуальные уроки</h3>
            <div className="mt-3">
              <span className="text-3xl font-bold text-[#CC3A3A]">от 1 000 ₽</span>
              <span className="text-muted-foreground"> / час</span>
            </div>
            <ul className="mt-6 flex flex-col gap-3 text-sm">
              {["Выбор преподавателя из каталога", "Оплата за каждый урок отдельно", "Встроенная видеосвязь", "Гибкое расписание", "Запись урока сохраняется"].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
                  {item}
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" variant="outline" render={<Link href="/teachers" />}>
              Выбрать преподавателя
            </Button>
          </div>

          {/* RAW Boost */}
          <div className="relative rounded-2xl border-2 border-[#CC3A3A] bg-card p-6">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#CC3A3A] px-3 py-0.5 text-xs font-semibold text-white">
              Рекомендуем
            </div>
            <h3 className="text-xl font-bold">RAW Boost</h3>
            <div className="mt-3">
              <span className="text-3xl font-bold text-[#CC3A3A]">1 490 ₽</span>
              <span className="text-muted-foreground"> / мес</span>
            </div>
            <p className="text-xs text-muted-foreground">или 990 ₽/мес при оплате за год</p>
            <ul className="mt-6 flex flex-col gap-3 text-sm">
              {["🤖 AI-саммари после каждого урока", "📚 Библиотека записей без лимита", "🎮 Геймификация и streak", "📊 Детальная аналитика прогресса"].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5">{item.slice(0, 2)}</span>
                  {item.slice(3)}
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full bg-[#CC3A3A] text-white hover:bg-[#a32e2e]" render={<Link href="/register" />}>
              Попробовать Boost
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">Первые 7 дней — бесплатно</p>
          </div>

          {/* Corporate */}
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-xl font-bold">Для компаний</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Корпоративное обучение с дашбордом для HR и кастомными программами.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-sm">
              {["Пул уроков для команды", "Отчёты по прогрессу", "Нишевые программы: IT, Business", "Персональный менеджер", "RAW Boost включён"].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
                  {item}
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" variant="outline">
              Обсудить корпоративное обучение
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ===== Block 10: Social Proof ===== */
function SocialProof() {
  const stats = [
    { value: "1 200+", label: "учеников" },
    { value: "15 000+", label: "часов практики" },
    { value: "+1 уровень", label: "за 3 месяца" },
    { value: "94%", label: "довольных" },
  ]
  const reviews = [
    { name: "Алексей, 27", role: "разработчик", quote: "Три года читал документацию на английском, а на daily переключался на русский. За 2 месяца на RAW English — впервые провёл ретро полностью на английском.", level: "Rare → Medium Rare" },
    { name: "Мария, 31", role: "маркетолог", quote: "Бросала репетиторов трижды. Здесь осталась, потому что это не «уроки» — это среда. Speaking Club по пятницам стал моим ритуалом.", level: "Raw → Rare" },
    { name: "Дмитрий, 38", role: "предприниматель", quote: "За 4 месяца — провёл первые переговоры без переводчика. Окупилось в первой же сделке.", level: "Medium Rare → Medium" },
  ]
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Результаты, а не обещания
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-[#1E1E1E] p-5 text-center text-white">
              <div className="text-2xl font-bold sm:text-3xl">{s.value}</div>
              <div className="mt-1 text-sm text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.name} className="rounded-2xl border bg-card p-6">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="size-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="mt-3 text-sm italic text-muted-foreground leading-relaxed">
                &laquo;{r.quote}&raquo;
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.role}</p>
                </div>
                <Badge variant="secondary">{r.level}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===== Block 11: FAQ ===== */
function FAQ() {
  const faqs = [
    { q: "Чем RAW English отличается от других?", a: "Мы совмещаем индивидуальные уроки с преподавателем и регулярную разговорную практику в Speaking Clubs. Плюс нишевые клубы (Business, IT, Travel), AI-саммари после каждого урока и сообщество, которое мотивирует продолжать." },
    { q: "Я совсем начинающий. Мне подойдёт?", a: "Да. Тест уровня определит вашу точку старта, и вы попадёте в группу своего уровня. На начальных этапах преподаватели — русскоязычные, так что языковой барьер не помешает." },
    { q: "Сколько времени в неделю нужно уделять?", a: "Минимум — 2–3 часа в неделю (1 урок + 1 Speaking Club). Для заметного прогресса рекомендуем 4–5 часов. Расписание гибкое — занимайтесь, когда удобно." },
    { q: "Можно ли заниматься из другого часового пояса?", a: "Да. В расписании есть утренние, дневные и вечерние слоты. Наши ученики занимаются из России, Европы, ОАЭ, Юго-Восточной Азии." },
    { q: "Что такое AI-саммари?", a: "После каждого урока вы получаете отчёт: ключевые ошибки, новая лексика, рекомендации и персональные упражнения для закрепления. Это ваш прогресс в цифрах." },
    { q: "Могу ли я сменить преподавателя?", a: "Да, в любой момент. В каталоге преподавателей вы видите специализацию, расписание и отзывы других учеников." },
    { q: "Есть ли пробный период?", a: "Бесплатный тест уровня и один пробный Speaking Club — без обязательств и без привязки карты." },
    { q: "Как работают Speaking Clubs?", a: "Группа из 6–8 человек + модератор. Новая тема каждую неделю. Формат: дискуссии, ролевые игры, дебаты. Места ограничены, бронирование через платформу." },
    { q: "Подходит ли для IELTS/TOEFL?", a: "Платформа усиливает speaking и listening — части, на которых многие теряют баллы. Для целенаправленной подготовки совместите с преподавателем, который специализируется на экзаменах." },
  ]
  return (
    <section id="faq" className="bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Частые вопросы
        </h2>
        <div className="mt-10 flex flex-col gap-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ===== Block 12: Final CTA ===== */
function FinalCTA() {
  return (
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
            Хватит учить английский. Начните на нём говорить.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            Первый шаг — самый сложный. Мы его упростили: бесплатный тест уровня
            и пробный Speaking Club. Без оплаты, без обязательств.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              className="bg-white text-[#CC3A3A] hover:bg-white/90"
              render={<Link href="/get-started" />}
            >
              Пройти тест и попасть на Speaking Club
              <ArrowRight className="ml-1 size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
            >
              Есть вопросы? Напишите нам
            </Button>
          </div>
          <p className="mt-6 text-sm text-white/50">
            Уже 1 200+ человек учатся говорить на RAW English
          </p>
        </div>
      </div>
    </section>
  )
}

/* ===== Page ===== */
export default function MarketingPage() {
  return (
    <>
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <Formats />
      <LevelSystem />
      <Teachers />
      <Audience />
      <Pricing />
      <SocialProof />
      <FAQ />
      <FinalCTA />
    </>
  )
}

// @ts-nocheck
import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const CSS = `
.adm-stub{max-width:900px;margin:0 auto;padding:20px 0}
.adm-stub .page-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.adm-stub .page-hdr h1{font-size:30px;font-weight:800;letter-spacing:-1px;line-height:1.1;color:var(--text)}
.adm-stub .page-hdr .sub{font-size:13px;color:var(--muted);margin-top:4px}
.adm-stub .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s ease;cursor:pointer;border:none;text-decoration:none;background:var(--surface);border:1px solid var(--border);color:var(--text)}
.adm-stub .btn:hover{border-color:var(--text)}
.adm-stub .hero{background:linear-gradient(135deg,var(--surface) 0%,var(--surface-2) 100%);border:1px solid var(--border);border-radius:20px;padding:50px 40px;text-align:center;position:relative;overflow:hidden}
.adm-stub .hero::before{content:'';position:absolute;top:-50%;right:-10%;width:320px;height:320px;background:radial-gradient(circle,rgba(216,242,106,.12),transparent 60%);pointer-events:none}
.adm-stub .hero .badge{display:inline-block;background:var(--lime);color:#0A0A0A;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:16px;position:relative;z-index:1}
.adm-stub .hero h2{font-size:28px;font-weight:800;letter-spacing:-.8px;color:var(--text);margin-bottom:10px;position:relative;z-index:1}
.adm-stub .hero p{font-size:14px;color:var(--muted);max-width:540px;margin:0 auto;line-height:1.6;position:relative;z-index:1}
.adm-stub .hero .icon{font-size:48px;margin-bottom:14px;position:relative;z-index:1}
.adm-stub .feats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px}
.adm-stub .feat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;font-size:12px;color:var(--muted);text-align:center}
.adm-stub .feat b{display:block;color:var(--text);font-size:13px;margin-bottom:4px;font-weight:800}
@media(max-width:700px){.adm-stub .feats{grid-template-columns:1fr}.adm-stub .hero{padding:32px 20px}.adm-stub .hero h2{font-size:22px}}
`

export default async function AdminReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
  if (!profile) redirect("/login")
  if (profile.role === "student") redirect("/student")
  if (profile.role === "teacher") redirect("/teacher")
  if (profile.role !== "admin") redirect("/login")

  return (
    <div className="adm-stub">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="page-hdr">
        <div>
          <h1>Аналитика и <span className="gl">reports</span></h1>
          <div className="sub">Аналитика и выгрузки по платформе</div>
        </div>
        <Link href="/admin" className="btn">
          ← На главную
        </Link>
      </div>
      <div className="hero">
        <div className="icon">📊</div>
        <span className="badge">Скоро</span>
        <h2>Модуль отчётов в разработке</h2>
        <p>
          Сводные отчёты по выручке, активности учеников, нагрузке преподавателей,
          конверсии воронки пробных уроков и финансовые выгрузки для бухгалтерии.
        </p>
      </div>
      <div className="feats">
        <div className="feat">
          <b>Финансовые</b>
          Выручка, выплаты, возвраты, налоговые выгрузки
        </div>
        <div className="feat">
          <b>Маркетинг</b>
          Воронка, конверсии, источники трафика
        </div>
        <div className="feat">
          <b>Операционные</b>
          Нагрузка, рейтинги, удержание, NPS
        </div>
      </div>
    </div>
  )
}

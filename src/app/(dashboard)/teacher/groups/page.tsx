// @ts-nocheck
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import TeacherGroupsClient from "./TeacherGroupsClient"

const CSS = `
.tch-grp{max-width:1100px;margin:0 auto}
.tch-grp .dash-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.tch-grp .dash-hdr h1{font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.1}
.tch-grp .dash-hdr .sub{font-size:14px;color:var(--muted);margin-top:4px}

.tch-grp .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;transition:all .15s;cursor:pointer;border:none;text-decoration:none}
.tch-grp .btn:active{transform:scale(.97)}
.tch-grp .btn-sm{padding:6px 14px;font-size:12px}
.tch-grp .btn-secondary{background:var(--surface);border:1px solid var(--border);color:var(--text)}
.tch-grp .btn-secondary:hover{border-color:var(--text)}
.tch-grp .btn-primary{background:var(--accent-dark);color:#fff}
.tch-grp .btn-primary:hover{background:var(--red)}
.tch-grp .btn-danger{background:transparent;border:1px solid var(--border);color:var(--muted)}
.tch-grp .btn-danger:hover{color:var(--red);border-color:var(--red)}

.tch-grp .g-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden}

.tch-grp .g-empty{padding:60px 22px;text-align:center;color:var(--muted);font-size:14px}
.tch-grp .g-empty b{display:block;color:var(--text);font-size:16px;font-weight:800;margin-bottom:4px}

.tch-grp .g-tbl{width:100%;border-collapse:collapse}
.tch-grp .g-tbl th{text-align:left;padding:12px 16px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;border-bottom:1px solid var(--border);background:var(--surface-2)}
.tch-grp .g-tbl td{padding:14px 16px;font-size:14px;border-bottom:1px solid var(--border);vertical-align:middle}
.tch-grp .g-tbl tr:last-child td{border-bottom:none}
.tch-grp .g-tbl tr.clickable{cursor:pointer;transition:background .12s}
.tch-grp .g-tbl tr.clickable:hover{background:var(--surface-2)}
.tch-grp .g-name{font-weight:700}
.tch-grp .g-desc{font-size:12px;color:var(--muted);margin-top:2px}
.tch-grp .g-count{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:var(--surface-2);border-radius:999px;font-size:12px;font-weight:600}
.tch-grp .g-actions{display:flex;gap:6px;justify-content:flex-end}

/* Modal */
.tch-grp .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;animation:grpFade .15s ease}
@keyframes grpFade{from{opacity:0}to{opacity:1}}
.tch-grp .modal-card{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:100%;max-width:520px;max-height:90vh;overflow:auto;padding:24px}
.tch-grp .modal-card h2{font-size:22px;font-weight:800;letter-spacing:-.4px;margin-bottom:4px}
.tch-grp .modal-sub{font-size:13px;color:var(--muted);margin-bottom:20px}

.tch-grp .field{margin-bottom:14px}
.tch-grp .field label{display:block;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.tch-grp .field input,.tch-grp .field textarea{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);font-family:inherit}
.tch-grp .field input:focus,.tch-grp .field textarea:focus{outline:none;border-color:var(--text)}
.tch-grp .field textarea{resize:vertical;min-height:60px}

.tch-grp .mem-list{max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}
.tch-grp .mem-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s}
.tch-grp .mem-item:last-child{border-bottom:none}
.tch-grp .mem-item:hover{background:var(--bg)}
.tch-grp .mem-item.checked{background:rgba(230,57,70,.06)}
.tch-grp .mem-item .chk{width:18px;height:18px;border-radius:5px;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;background:var(--surface);flex-shrink:0}
.tch-grp .mem-item.checked .chk{background:var(--red);border-color:var(--red);color:#fff}
.tch-grp .mem-item .chk svg{width:10px;height:10px;display:none}
.tch-grp .mem-item.checked .chk svg{display:block}
.tch-grp .mem-item .av{width:28px;height:28px;border-radius:50%;background:var(--red);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;flex-shrink:0;object-fit:cover}
.tch-grp .mem-item .nm{flex:1;font-size:13px;font-weight:600}
.tch-grp .mem-item .lvl{font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(230,57,70,.1);color:var(--red);font-weight:700}

.tch-grp .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
`

export default async function TeacherGroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  const { data: profile } = await (supabase as any).from("profiles").select("role").eq("id", user.id).single()
  if (!profile || profile.role !== "teacher") redirect("/student")

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tch-grp">
        <div className="dash-hdr">
          <div>
            <h1>Мои <span className="gl">группы</span></h1>
            <div className="sub">Объединяй учеников в группы — удобно рассылать материалы и домашки</div>
          </div>
        </div>
        <TeacherGroupsClient />
      </div>
    </>
  )
}

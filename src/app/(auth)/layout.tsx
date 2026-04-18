import type { Metadata } from 'next'
import Link from 'next/link'

import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'RAW English — Авторизация',
  description: 'Вход и регистрация на платформе RAW English',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Scoped design tokens for the (auth) section. Not touching globals.css. */}
      <style>{`
        .auth-scope {
          --auth-bg: #FAFAF8;
          --auth-dark: #1E1E1E;
          --auth-card: #FFFFFF;
          --auth-border: rgba(0,0,0,.06);
          --auth-text: #1A1A1A;
          --auth-text2: #555;
          --auth-text3: #999;
          --auth-red: #E63946;
          --auth-lime: #D8F26A;
          --auth-lime-dark: #5A7A00;
          --auth-input-bg: #F5F5F3;
        }
        .auth-scope { min-height: 100vh; background: var(--auth-dark); color: var(--auth-text); display: flex; align-items: center; justify-content: center; padding: 20px; }

        .auth-modal { width: 100%; max-width: 460px; background: var(--auth-card); border-radius: 28px; box-shadow: 0 8px 0 var(--auth-border), 0 30px 80px rgba(0,0,0,.15); position: relative; overflow: hidden; }
        .auth-modal::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--auth-red), var(--auth-lime)); z-index: 5; }

        .auth-header { padding: 24px 28px 0; display: flex; align-items: center; justify-content: space-between; }
        .auth-logo { font-family: var(--font-gluten), cursive; font-size: 1.1rem; color: var(--auth-red); font-weight: 600; line-height: 1; }
        .auth-logo span { font-family: var(--font-sans), sans-serif; font-weight: 600; font-size: .75rem; color: var(--auth-text); margin-left: 4px; }

        .auth-close { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--auth-border); background: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--auth-text3); font-size: 1.1rem; transition: all .2s; text-decoration: none; }
        .auth-close:hover { border-color: var(--auth-red); color: var(--auth-red); }

        .auth-body { padding: 24px 28px 28px; }

        .auth-tabs { display: flex; background: var(--auth-input-bg); border-radius: 12px; padding: 3px; margin-bottom: 24px; }
        .auth-tab { flex: 1; padding: 10px; border: none; border-radius: 10px; font-family: inherit; font-size: .82rem; font-weight: 600; cursor: pointer; transition: all .25s; background: transparent; color: var(--auth-text3); text-align: center; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
        .auth-tab.active { background: var(--auth-card); color: var(--auth-text); box-shadow: 0 2px 8px rgba(0,0,0,.06); }

        .auth-level { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--auth-input-bg); border-radius: 14px; margin-bottom: 16px; }
        .auth-level-icon { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; background: var(--auth-red); box-shadow: 0 3px 0 rgba(180,30,45,.3); color: #fff; }
        .auth-level-info { flex: 1; min-width: 0; }
        .auth-level-name { font-size: .82rem; font-weight: 700; color: var(--auth-text); }
        .auth-level-name .gl { font-family: var(--font-gluten), cursive; color: var(--auth-red); font-weight: 600; }
        .auth-level-sub { font-size: .7rem; color: var(--auth-text3); margin-top: 1px; }
        .auth-level-xp { padding: 4px 10px; border-radius: 8px; background: rgba(230,57,70,.08); color: var(--auth-red); font-size: .65rem; font-weight: 700; white-space: nowrap; }

        .auth-quiz-cta { width: 100%; padding: 14px 16px; border-radius: 14px; background: var(--auth-input-bg); border: 1px dashed rgba(230,57,70,.3); cursor: pointer; display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-family: inherit; text-align: left; transition: all .2s; }
        .auth-quiz-cta:hover { border-color: var(--auth-red); background: #fff; }
        .auth-quiz-cta-icon { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; background: var(--auth-lime); box-shadow: 0 3px 0 rgba(140,180,40,.3); }
        .auth-quiz-cta-text { flex: 1; }
        .auth-quiz-cta-title { font-size: .82rem; font-weight: 700; color: var(--auth-text); }
        .auth-quiz-cta-sub { font-size: .7rem; color: var(--auth-text3); margin-top: 1px; }

        .trial-banner { padding: 16px; border-radius: 16px; background: linear-gradient(135deg, rgba(230,57,70,.06), rgba(216,242,106,.08)); border: 1px solid rgba(230,57,70,.08); margin-bottom: 20px; display: flex; align-items: center; gap: 12px; }
        .trial-icon { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; background: var(--auth-lime); display: flex; align-items: center; justify-content: center; font-size: 1rem; box-shadow: 0 2px 0 rgba(140,180,40,.3); }
        .trial-text { flex: 1; }
        .trial-title { font-size: .82rem; font-weight: 700; margin-bottom: 2px; color: var(--auth-text); }
        .trial-sub { font-size: .7rem; color: var(--auth-text2); line-height: 1.4; }
        .trial-badge { padding: 4px 10px; border-radius: 8px; background: var(--auth-lime); color: var(--auth-dark); font-size: .6rem; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 0 rgba(140,180,40,.3); }

        .auth-form { display: flex; flex-direction: column; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field-label { font-size: .72rem; font-weight: 700; color: var(--auth-text2); letter-spacing: .3px; }
        .field-row { display: flex; gap: 10px; }
        .field-row .field { flex: 1; min-width: 0; }

        .field-input { width: 100%; padding: 13px 16px; background: var(--auth-input-bg); border: 2px solid transparent; border-radius: 12px; font-family: inherit; font-size: .88rem; font-weight: 500; color: var(--auth-text); outline: none; transition: all .2s; }
        .field-input::placeholder { color: var(--auth-text3); font-weight: 400; }
        .field-input:focus { border-color: var(--auth-red); background: var(--auth-card); box-shadow: 0 0 0 4px rgba(230,57,70,.06); }
        .field-input[aria-invalid="true"] { border-color: var(--auth-red); }

        .phone-wrap { display: flex; align-items: center; gap: 0; background: var(--auth-input-bg); border-radius: 12px; border: 2px solid transparent; transition: all .2s; }
        .phone-wrap:focus-within { border-color: var(--auth-red); background: var(--auth-card); box-shadow: 0 0 0 4px rgba(230,57,70,.06); }
        .phone-wrap[data-invalid="true"] { border-color: var(--auth-red); }
        .phone-flag { padding: 13px 0 13px 16px; font-size: .9rem; flex-shrink: 0; }
        .phone-input { flex: 1; padding: 13px 16px 13px 8px; background: transparent; border: none; font-family: inherit; font-size: .88rem; font-weight: 500; color: var(--auth-text); outline: none; min-width: 0; }
        .phone-input::placeholder { color: var(--auth-text3); font-weight: 400; }

        .pass-wrap { position: relative; }
        .pass-wrap .field-input { padding-right: 44px; }
        .pass-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--auth-text3); display: flex; align-items: center; padding: 4px; transition: color .2s; }
        .pass-toggle:hover { color: var(--auth-red); }
        .pass-toggle svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

        .role-row { display: flex; gap: 8px; }
        .role-opt { flex: 1; padding: 12px; border-radius: 12px; background: var(--auth-input-bg); border: 2px solid transparent; cursor: pointer; font-family: inherit; font-size: .8rem; font-weight: 600; color: var(--auth-text2); transition: all .2s; text-align: center; }
        .role-opt:hover { border-color: rgba(230,57,70,.2); }
        .role-opt[data-active="true"] { background: var(--auth-card); border-color: var(--auth-red); color: var(--auth-red); box-shadow: 0 2px 8px rgba(230,57,70,.12); }

        .check-row { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; user-select: none; }
        .check-box { width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0; border: 2px solid var(--auth-border); background: var(--auth-input-bg); display: flex; align-items: center; justify-content: center; transition: all .2s; margin-top: 1px; }
        .check-box[data-checked="true"] { background: var(--auth-red); border-color: var(--auth-red); }
        .check-box svg { width: 12px; height: 12px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; opacity: 0; transition: opacity .2s; }
        .check-box[data-checked="true"] svg { opacity: 1; }
        .check-label { font-size: .75rem; color: var(--auth-text2); line-height: 1.4; }
        .check-label a { color: var(--auth-red); text-decoration: underline; font-weight: 600; }

        .auth-divider { display: flex; align-items: center; gap: 12px; margin: 4px 0; }
        .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--auth-border); }
        .auth-divider span { font-size: .7rem; color: var(--auth-text3); font-weight: 500; }

        .social-btns { display: flex; gap: 8px; }
        .social-btn { flex: 1; padding: 12px; border: 1px solid var(--auth-border); border-radius: 12px; background: var(--auth-card); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; font-size: .78rem; font-weight: 600; color: var(--auth-text); transition: all .2s; }
        .social-btn:hover:not(:disabled) { border-color: var(--auth-text3); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.04); }
        .social-btn:disabled { opacity: .55; cursor: not-allowed; }
        .social-btn svg { width: 18px; height: 18px; }

        .auth-submit { width: 100%; padding: 15px; border: none; border-radius: 14px; font-family: inherit; font-size: .92rem; font-weight: 700; cursor: pointer; transition: all .3s; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; }
        .auth-submit:disabled { opacity: .7; cursor: not-allowed; transform: none !important; }
        .auth-submit--red { background: var(--auth-red); color: #fff; box-shadow: 0 4px 0 rgba(180,30,45,.4), 0 8px 24px rgba(230,57,70,.12); }
        .auth-submit--red:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 0 rgba(180,30,45,.4), 0 14px 36px rgba(230,57,70,.15); }
        .auth-submit--lime { background: var(--auth-lime); color: var(--auth-dark); box-shadow: 0 4px 0 rgba(140,180,40,.45), 0 8px 24px rgba(216,242,106,.12); }
        .auth-submit--lime:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 0 rgba(140,180,40,.45), 0 14px 36px rgba(216,242,106,.15); }
        .auth-submit--ghost { background: var(--auth-input-bg); color: var(--auth-text); box-shadow: none; }
        .auth-submit--ghost:hover:not(:disabled) { background: #EDEDEA; }
        .auth-submit svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }

        .auth-bottom { text-align: center; margin-top: 16px; font-size: .78rem; color: var(--auth-text3); }
        .auth-bottom a { color: var(--auth-red); font-weight: 700; text-decoration: none; cursor: pointer; }
        .auth-bottom a:hover { text-decoration: underline; }

        .forgot-link { font-size: .72rem; color: var(--auth-red); font-weight: 600; text-decoration: none; text-align: right; margin-top: -6px; align-self: flex-end; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
        .forgot-link:hover { text-decoration: underline; }

        .auth-error { background: rgba(230,57,70,.08); border: 1px solid rgba(230,57,70,.2); color: var(--auth-red); padding: 10px 14px; border-radius: 12px; font-size: .78rem; font-weight: 500; }
        .auth-field-error { font-size: .68rem; color: var(--auth-red); font-weight: 600; margin-top: 2px; }

        .auth-success { text-align: center; padding: 20px 0; }
        .success-icon { width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 16px; background: var(--auth-lime); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; box-shadow: 0 4px 0 rgba(140,180,40,.4), 0 0 30px rgba(216,242,106,.15); animation: sPop .5s cubic-bezier(.16,1,.3,1) both; }
        @keyframes sPop { from { transform: scale(0) rotate(-20deg); } to { transform: scale(1) rotate(0); } }
        .auth-success h3 { font-size: 1.2rem; font-weight: 800; margin-bottom: 6px; color: var(--auth-text); }
        .auth-success h3 .gl { font-family: var(--font-gluten), cursive; color: var(--auth-red); font-weight: 600; }
        .auth-success p { font-size: .85rem; color: var(--auth-text2); line-height: 1.6; max-width: 340px; margin: 0 auto 20px; }
        .success-details { padding: 16px; background: var(--auth-input-bg); border-radius: 14px; text-align: left; margin-bottom: 16px; }
        .sd-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; }
        .sd-row + .sd-row { border-top: 1px solid var(--auth-border); }
        .sd-icon { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: .8rem; }
        .sd-icon--red { background: rgba(230,57,70,.08); }
        .sd-icon--lime { background: rgba(216,242,106,.15); }
        .sd-label { font-size: .72rem; color: var(--auth-text3); }
        .sd-val { font-size: .82rem; font-weight: 700; margin-top: 1px; color: var(--auth-text); }

        .fade-in { animation: authFadeIn .35s ease both; }
        @keyframes authFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 500px) {
          .auth-scope { padding: 0; align-items: flex-end; }
          .auth-modal { border-radius: 24px 24px 0 0; max-height: 96vh; overflow-y: auto; }
          .auth-header { padding: 20px 20px 0; }
          .auth-body { padding: 20px; }
          .field-row { flex-direction: column; gap: 14px; }
          .social-btns { flex-direction: column; }
        }
      `}</style>

      <div className="auth-scope">
        <div className="auth-modal">
          <div className="auth-header">
            <div className="auth-logo">
              Raw <span>english</span>
            </div>
            <Link href="/" className="auth-close" aria-label="Закрыть">
              ✕
            </Link>
          </div>
          <div className="auth-body">{children}</div>
        </div>
      </div>
      <Toaster />
    </>
  )
}

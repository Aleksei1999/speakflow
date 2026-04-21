/* ========================================================
   3D ICON LIBRARY — inline SVG icons
   Usage in HTML: <i3 kind="steak-raw" size="lg"></i3>
   Kinds: steak-raw, steak-rare, steak-mr, steak-medium, steak-mw, steak-wd,
          xp-star, fire, trophy, mic, sword, wine, book, briefcase, party,
          target, controller, chart, robot, shield, timer, flag, ai, heart,
          clubs, level-badge, face-m1..face-m4  (person avatars)
   ======================================================== */
(function(){
'use strict';

/* ---- STEAK builder: oval slab w/ 3D shade, fat rim, grill marks ----
   fill: surface color (raw→wd). Grill opacity changes doneness vibe. */
function steak(fill, grill, ring){
  return `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="sk-hl-${fill.replace('#','')}" cx="35%" cy="25%" r="60%">
        <stop offset="0%" stop-color="#fff" stop-opacity=".5"/>
        <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="sk-side-${fill.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${shade(fill,-18)}"/>
        <stop offset="100%" stop-color="${shade(fill,-45)}"/>
      </linearGradient>
      <filter id="sk-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation=".6"/>
      </filter>
    </defs>
    <!-- bottom shadow -->
    <ellipse cx="50" cy="86" rx="36" ry="6" fill="rgba(0,0,0,.28)" filter="url(#sk-soft)"/>
    <!-- side (thickness) -->
    <path d="M14,62 a36,22 0 0,0 72,0 v-8 a36,22 0 0,1 -72,0 z" fill="url(#sk-side-${fill.replace('#','')})"/>
    <!-- top slab -->
    <ellipse cx="50" cy="54" rx="36" ry="22" fill="${fill}"/>
    <!-- fat rim (outer ring) -->
    <path d="M50,32 a36,22 0 0,1 0,44 a36,22 0 0,1 0,-44 z" fill="none" stroke="${ring}" stroke-width="2.5" opacity=".7"/>
    <!-- grill marks (two diagonal stripes) -->
    <g opacity="${grill}" stroke="#2a1b0f" stroke-width="2.2" stroke-linecap="round" fill="none">
      <path d="M30,48 Q50,54 70,60"/>
      <path d="M30,58 Q50,64 70,70"/>
    </g>
    <!-- highlight -->
    <ellipse cx="50" cy="54" rx="36" ry="22" fill="url(#sk-hl-${fill.replace('#','')})"/>
    <!-- small inner fat streak -->
    <path d="M28,52 Q36,48 44,52" stroke="${shade(ring,+20)}" stroke-width="1.6" fill="none" opacity=".5" stroke-linecap="round"/>
  </svg>`;
}

/* lighten/darken hex color by percent (-100..100) */
function shade(hex,p){
  const c=hex.replace('#','');
  const r=parseInt(c.substring(0,2),16),g=parseInt(c.substring(2,4),16),b=parseInt(c.substring(4,6),16);
  const t=p<0?0:255, P=Math.abs(p)/100;
  const R=Math.round((t-r)*P)+r,G=Math.round((t-g)*P)+g,B=Math.round((t-b)*P)+b;
  return '#'+[R,G,B].map(x=>x.toString(16).padStart(2,'0')).join('');
}

const ICONS = {
  /* ---- STEAK rarity ladder (Raw → Well Done) ---- */
  'steak-raw':    steak('#E63946','.05','#C84A3B'),
  'steak-rare':   steak('#EF505E','.2','#C84A3B'),
  'steak-mr':     steak('#F06A52','.4','#A83F2E'),
  'steak-medium': steak('#D4A040','.6','#8A5A1A'),
  'steak-mw':     steak('#B8D050','.78','#6B8F00'),
  'steak-wd':     steak('#D8F26A','.92','#6B8F00'),

  /* ---- XP STAR (golden 3D star) ---- */
  'xp-star': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="xp-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FFE680"/>
        <stop offset="55%" stop-color="#FFC940"/>
        <stop offset="100%" stop-color="#C89000"/>
      </linearGradient>
      <radialGradient id="xp-hl" cx="38%" cy="30%" r="40%">
        <stop offset="0%" stop-color="#fff" stop-opacity=".85"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="50" cy="88" rx="28" ry="4" fill="rgba(0,0,0,.25)"/>
    <path d="M50,10 L62,40 L94,44 L70,64 L78,94 L50,77 L22,94 L30,64 L6,44 L38,40 Z" fill="url(#xp-g)" stroke="#8A6400" stroke-width="2"/>
    <path d="M50,18 L60,42 L80,44 L65,57 L50,50 L35,57 L20,44 L40,42 Z" fill="url(#xp-hl)"/>
  </svg>`,

  /* ---- FIRE (streak) ---- */
  'fire': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="fi-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFE27A"/>
        <stop offset="45%" stop-color="#FF8A3D"/>
        <stop offset="100%" stop-color="#E63946"/>
      </linearGradient>
      <linearGradient id="fi-in" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFF1B5"/>
        <stop offset="100%" stop-color="#FFB02A"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <path d="M50,8 C62,24 78,32 76,56 C74,80 58,90 50,90 C42,90 26,80 24,58 C22,40 36,38 38,24 C40,30 44,34 50,30 C50,22 50,14 50,8 Z" fill="url(#fi-g)" stroke="#B81E2E" stroke-width="1.6"/>
    <path d="M50,32 C58,42 66,48 64,62 C62,76 54,82 50,82 C46,82 38,76 36,64 C34,52 44,50 46,42 C46,46 48,48 50,46 Z" fill="url(#fi-in)"/>
  </svg>`,

  /* ---- TROPHY ---- */
  'trophy': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="tr-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FFE680"/>
        <stop offset="55%" stop-color="#FFC940"/>
        <stop offset="100%" stop-color="#B8860B"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="24" ry="4" fill="rgba(0,0,0,.25)"/>
    <rect x="38" y="76" width="24" height="10" rx="2" fill="#8A6400"/>
    <rect x="32" y="84" width="36" height="6" rx="2" fill="#B8860B"/>
    <path d="M30,22 L70,22 L68,48 C68,62 62,70 50,70 C38,70 32,62 32,48 Z" fill="url(#tr-g)" stroke="#8A6400" stroke-width="1.8"/>
    <!-- handles -->
    <path d="M30,28 C20,28 16,34 18,44 C20,52 26,52 30,50" fill="none" stroke="#B8860B" stroke-width="4" stroke-linecap="round"/>
    <path d="M70,28 C80,28 84,34 82,44 C80,52 74,52 70,50" fill="none" stroke="#B8860B" stroke-width="4" stroke-linecap="round"/>
    <rect x="46" y="70" width="8" height="8" fill="#8A6400"/>
    <path d="M36,28 L64,28 L62,42 C62,52 57,58 50,58 C43,58 38,52 38,42 Z" fill="#fff" opacity=".25"/>
  </svg>`,

  /* ---- MICROPHONE ---- */
  'mic': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="mc-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#E63946"/>
        <stop offset="100%" stop-color="#8A1E28"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <rect x="44" y="72" width="12" height="14" rx="2" fill="#4A4A46"/>
    <rect x="36" y="84" width="28" height="4" rx="2" fill="#2A2A26"/>
    <rect x="30" y="16" width="40" height="58" rx="20" fill="url(#mc-g)" stroke="#5A1018" stroke-width="1.6"/>
    <g stroke="#8A1E28" stroke-width="1.2" opacity=".6">
      <line x1="34" y1="28" x2="66" y2="28"/>
      <line x1="34" y1="38" x2="66" y2="38"/>
      <line x1="34" y1="48" x2="66" y2="48"/>
      <line x1="34" y1="58" x2="66" y2="58"/>
    </g>
    <path d="M30,24 C30,18 36,14 50,14 C54,14 58,15 60,16 L30,40 Z" fill="#fff" opacity=".22"/>
  </svg>`,

  /* ---- SWORD (debate) ---- */
  'sword': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="sw-g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#F0F0F0"/>
        <stop offset="50%" stop-color="#AFAFAF"/>
        <stop offset="100%" stop-color="#6A6A6A"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <path d="M50,8 L58,60 L42,60 Z" fill="url(#sw-g)" stroke="#555" stroke-width="1.5"/>
    <rect x="32" y="60" width="36" height="6" rx="1" fill="#8A5A1A"/>
    <rect x="45" y="66" width="10" height="18" fill="#B8860B"/>
    <circle cx="50" cy="86" r="6" fill="#FFC940" stroke="#8A6400" stroke-width="1.5"/>
    <path d="M50,12 L52,56 L48,56 Z" fill="#fff" opacity=".4"/>
  </svg>`,

  /* ---- WINE GLASS ---- */
  'wine': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="wn-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#E63946"/>
        <stop offset="100%" stop-color="#5A0E18"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <path d="M28,14 L72,14 C72,42 62,58 50,58 C38,58 28,42 28,14 Z" fill="url(#wn-g)" stroke="#5A0E18" stroke-width="1.8"/>
    <path d="M32,18 L68,18 C68,26 66,32 64,36 L36,36 C34,32 32,26 32,18 Z" fill="#fff" opacity=".18"/>
    <rect x="48" y="58" width="4" height="26" fill="#D0C8B8"/>
    <ellipse cx="50" cy="86" rx="16" ry="3" fill="#D0C8B8"/>
  </svg>`,

  /* ---- BOOK (1-on-1 lessons) ---- */
  'book': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bk-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#D8F26A"/>
        <stop offset="100%" stop-color="#6B8F00"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <path d="M18,22 L50,18 L82,22 L82,82 L50,78 L18,82 Z" fill="url(#bk-g)" stroke="#4A6400" stroke-width="1.8"/>
    <path d="M50,18 L50,78" stroke="#4A6400" stroke-width="1.8"/>
    <g stroke="#4A6400" stroke-width="1" opacity=".5">
      <line x1="24" y1="32" x2="44" y2="30"/>
      <line x1="24" y1="40" x2="44" y2="38"/>
      <line x1="24" y1="48" x2="40" y2="46"/>
      <line x1="56" y1="30" x2="76" y2="32"/>
      <line x1="56" y1="38" x2="76" y2="40"/>
      <line x1="56" y1="46" x2="72" y2="48"/>
    </g>
    <path d="M18,22 L50,18 L50,26 L18,30 Z" fill="#fff" opacity=".25"/>
  </svg>`,

  /* ---- BRIEFCASE (business) ---- */
  'briefcase': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="bc-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#E63946"/>
        <stop offset="100%" stop-color="#8A1E28"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <rect x="38" y="22" width="24" height="10" rx="2" fill="none" stroke="#4A4A46" stroke-width="3"/>
    <rect x="16" y="32" width="68" height="50" rx="5" fill="url(#bc-g)" stroke="#5A1018" stroke-width="1.8"/>
    <rect x="16" y="48" width="68" height="4" fill="#5A1018"/>
    <rect x="44" y="46" width="12" height="10" rx="2" fill="#FFC940" stroke="#8A6400" stroke-width="1.2"/>
    <rect x="16" y="32" width="68" height="10" fill="#fff" opacity=".18"/>
  </svg>`,

  /* ---- PARTY (events) ---- */
  'party': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="pt-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFC940"/>
        <stop offset="100%" stop-color="#E63946"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <path d="M20,82 L66,22 L82,38 L36,86 Z" fill="url(#pt-g)" stroke="#8A1E28" stroke-width="1.8"/>
    <path d="M20,82 L36,86 L30,72 Z" fill="#5A1018"/>
    <g fill="#D8F26A" stroke="#6B8F00" stroke-width=".8">
      <circle cx="66" cy="24" r="3"/><circle cx="78" cy="34" r="2.5"/>
      <circle cx="56" cy="44" r="2.5"/><circle cx="62" cy="54" r="2"/>
      <circle cx="44" cy="62" r="2.5"/>
    </g>
    <g fill="#A855F7" stroke="#6D28D9" stroke-width=".8">
      <circle cx="72" cy="48" r="2"/><circle cx="52" cy="32" r="2"/>
    </g>
  </svg>`,

  /* ---- TARGET ---- */
  'target': `
  <svg viewBox="0 0 100 100">
    <defs>
      <radialGradient id="tg-g" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFF5D0"/>
        <stop offset="40%" stop-color="#FFC940"/>
        <stop offset="100%" stop-color="#8A6400"/>
      </radialGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <circle cx="50" cy="50" r="40" fill="#fff" stroke="#4A4A46" stroke-width="2"/>
    <circle cx="50" cy="50" r="30" fill="#E63946" stroke="#8A1E28" stroke-width="1.5"/>
    <circle cx="50" cy="50" r="20" fill="#fff" stroke="#4A4A46" stroke-width="1.5"/>
    <circle cx="50" cy="50" r="10" fill="url(#tg-g)" stroke="#8A6400" stroke-width="1.5"/>
    <path d="M20,20 L50,50" stroke="#4A4A46" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M14,24 L20,20 L22,26 Z" fill="#4A4A46"/>
  </svg>`,

  /* ---- CONTROLLER (gamepad) ---- */
  'controller': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="ct-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#4A4A46"/>
        <stop offset="100%" stop-color="#1A1A16"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="88" rx="30" ry="4" fill="rgba(0,0,0,.25)"/>
    <path d="M14,56 C14,40 24,30 36,34 L64,34 C76,30 86,40 86,56 C86,70 78,78 70,74 C64,72 60,68 58,64 L42,64 C40,68 36,72 30,74 C22,78 14,70 14,56 Z" fill="url(#ct-g)" stroke="#000" stroke-width="1.6"/>
    <!-- D-pad -->
    <rect x="24" y="50" width="14" height="4" rx="1" fill="#D8F26A"/>
    <rect x="29" y="45" width="4" height="14" rx="1" fill="#D8F26A"/>
    <!-- buttons -->
    <circle cx="68" cy="46" r="3" fill="#E63946"/>
    <circle cx="76" cy="54" r="3" fill="#D8F26A"/>
    <circle cx="68" cy="62" r="3" fill="#22D3EE"/>
    <circle cx="60" cy="54" r="3" fill="#FFC940"/>
    <path d="M18,44 L80,44 C82,44 82,42 80,40 C70,36 60,34 50,34 C40,34 30,36 20,40 C18,42 18,44 18,44 Z" fill="#fff" opacity=".18"/>
  </svg>`,

  /* ---- CHART ---- */
  'chart': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="ch-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#D8F26A"/>
        <stop offset="100%" stop-color="#6B8F00"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <rect x="14" y="14" width="72" height="72" rx="6" fill="#fff" stroke="#4A4A46" stroke-width="2"/>
    <rect x="24" y="58" width="10" height="22" fill="url(#ch-g)"/>
    <rect x="40" y="44" width="10" height="36" fill="url(#ch-g)"/>
    <rect x="56" y="34" width="10" height="46" fill="url(#ch-g)"/>
    <rect x="72" y="24" width="10" height="56" fill="#E63946"/>
    <path d="M20,66 L34,52 L50,44 L66,30 L82,22" stroke="#E63946" stroke-width="2" fill="none"/>
    <circle cx="82" cy="22" r="3" fill="#E63946"/>
  </svg>`,

  /* ---- ROBOT (AI) ---- */
  'robot': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="rb-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F5F5F5"/>
        <stop offset="100%" stop-color="#A0A09A"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <rect x="44" y="10" width="4" height="10" fill="#4A4A46"/>
    <circle cx="46" cy="10" r="3" fill="#E63946"/>
    <rect x="20" y="22" width="52" height="42" rx="8" fill="url(#rb-g)" stroke="#4A4A46" stroke-width="2"/>
    <rect x="28" y="32" width="36" height="16" rx="3" fill="#1A1A16"/>
    <circle cx="36" cy="40" r="3" fill="#D8F26A"/>
    <circle cx="56" cy="40" r="3" fill="#D8F26A"/>
    <path d="M38,54 Q46,58 54,54" stroke="#E63946" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <rect x="30" y="64" width="32" height="20" rx="3" fill="url(#rb-g)" stroke="#4A4A46" stroke-width="1.5"/>
    <rect x="14" y="28" width="6" height="22" rx="2" fill="#4A4A46"/>
    <rect x="72" y="28" width="6" height="22" rx="2" fill="#4A4A46"/>
    <path d="M20,22 L72,22 L72,28 L20,28 Z" fill="#fff" opacity=".35"/>
  </svg>`,

  /* ---- SHIELD (achievements) ---- */
  'shield': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="sh-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FFC940"/>
        <stop offset="100%" stop-color="#8A6400"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <path d="M50,8 L82,18 L80,54 C78,72 66,84 50,90 C34,84 22,72 20,54 L18,18 Z" fill="url(#sh-g)" stroke="#6A4A00" stroke-width="2"/>
    <path d="M50,16 L74,24 L72,52 C70,66 62,76 50,80 Z" fill="#fff" opacity=".25"/>
    <path d="M50,32 L56,48 L72,48 L60,58 L64,74 L50,65 L36,74 L40,58 L28,48 L44,48 Z" fill="#E63946" stroke="#8A1E28" stroke-width="1.5"/>
  </svg>`,

  /* ---- HEART ---- */
  'heart': `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="ht-g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FF6B78"/>
        <stop offset="100%" stop-color="#8A1E28"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <path d="M50,88 C20,68 10,48 18,32 C24,20 40,18 50,32 C60,18 76,20 82,32 C90,48 80,68 50,88 Z" fill="url(#ht-g)" stroke="#5A1018" stroke-width="2"/>
    <path d="M32,28 C28,34 30,42 36,48" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".5"/>
  </svg>`,

  /* ---- PERSON FACES (for social proof + floating people) ----
     Use initials on a color plate. */
  'face-m1': personFace('A','#E63946','#FFC940'),
  'face-m2': personFace('M','#D8F26A','#8A1E28'),
  'face-m3': personFace('K','#FFC940','#E63946'),
  'face-m4': personFace('V','#A855F7','#FFF'),
  'face-m5': personFace('D','#22D3EE','#1A1A16'),

  /* ---- LEVEL BADGE (circle w/ level number, used in HUD) ---- */
  'level-badge': `
  <svg viewBox="0 0 100 100">
    <defs>
      <radialGradient id="lb-g" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stop-color="#FF6B78"/>
        <stop offset="100%" stop-color="#8A1E28"/>
      </radialGradient>
    </defs>
    <ellipse cx="50" cy="90" rx="24" ry="4" fill="rgba(0,0,0,.25)"/>
    <circle cx="50" cy="50" r="40" fill="url(#lb-g)" stroke="#5A1018" stroke-width="2"/>
    <circle cx="50" cy="50" r="32" fill="none" stroke="#FFC940" stroke-width="2" stroke-dasharray="4 3"/>
    <path d="M28,26 C36,22 58,22 72,30" stroke="#fff" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>
  </svg>`,
};

function personFace(initial, bg, fg){
  return `
  <svg viewBox="0 0 100 100">
    <defs>
      <linearGradient id="pf-${initial}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="${shade(bg,-30)}"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="92" rx="22" ry="3" fill="rgba(0,0,0,.25)"/>
    <circle cx="50" cy="50" r="40" fill="url(#pf-${initial})" stroke="${shade(bg,-35)}" stroke-width="2"/>
    <path d="M20,36 C28,24 50,20 72,28" stroke="#fff" stroke-width="4" fill="none" opacity=".35" stroke-linecap="round"/>
    <text x="50" y="62" text-anchor="middle" font-family="Gluten, cursive" font-size="42" font-weight="700" fill="${fg}">${initial}</text>
  </svg>`;
}

/* ---- Replace <i3 kind="..." size="..."> with inline SVG on DOM load ---- */
function hydrate(root){
  (root||document).querySelectorAll('i3[kind]').forEach(el=>{
    if(el.dataset.hydrated) return;
    const kind=el.getAttribute('kind');
    const svg=ICONS[kind];
    if(!svg){ el.innerHTML='?'; el.dataset.hydrated='1'; return; }
    const size=el.getAttribute('size')||el.getAttribute('data-size')||'md';
    el.classList.add('i3','i3-'+size);
    if(el.hasAttribute('stand')||el.hasAttribute('data-stand')) el.classList.add('i3-stand');
    if(el.hasAttribute('float')||el.hasAttribute('data-float')) el.classList.add('i3-float');
    if(el.hasAttribute('tilt')||el.hasAttribute('data-tilt')) el.classList.add('i3-tilt');
    el.innerHTML=svg;
    el.dataset.hydrated='1';
  });
}

window.I3 = { hydrate, icons: ICONS };
document.addEventListener('DOMContentLoaded',()=>hydrate());
})();

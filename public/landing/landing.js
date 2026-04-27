(() => {
let disposer = null;

function landingInit() {
  if (disposer) { try { disposer(); } catch(e) {} }
  const cleanups = [];

const toggle=document.getElementById('themeToggle'),knob=document.getElementById('themeKnob'),html=document.documentElement;
if(!toggle||!knob)return; // DOM not ready
const onToggle=()=>{const d=html.dataset.theme==='dark';html.dataset.theme=d?'light':'dark';knob.textContent=d?'☀️':'🌙'};
toggle.addEventListener('click',onToggle);
cleanups.push(()=>toggle.removeEventListener('click',onToggle));

/* Nav scroll */
const nav=document.getElementById('navbar');
const onScroll=()=>{nav.classList.toggle('scrolled',scrollY>50)};
window.addEventListener('scroll',onScroll);
cleanups.push(()=>window.removeEventListener('scroll',onScroll));

/* Reveal */
const obs=new IntersectionObserver(e=>e.forEach(x=>{if(x.isIntersecting)x.target.classList.add('visible')}),{threshold:0.1,rootMargin:'0px 0px -40px 0px'});
document.querySelectorAll('.reveal,.level-card').forEach(el=>obs.observe(el));
cleanups.push(()=>obs.disconnect());

/* ===== GAME ENGINE ===== */
/* Persisted landing XP — survives refreshes and is claimed after login. */
const LANDING_XP_KEY='raw_landing_xp_pending';
function loadPersistedXP(){
  // Persist only `xp` (claimed after register). Always reset `lvl` to 0 so
  // the level-up overlay fires on every visit when the user re-scrolls.
  try{const raw=localStorage.getItem(LANDING_XP_KEY);if(!raw)return{xp:0,lvl:0};const p=JSON.parse(raw);return{xp:Math.max(0,Math.min(100,+p.xp||0)),lvl:0};}catch{return{xp:0,lvl:0};}
}
function savePersistedXP(){
  try{localStorage.setItem(LANDING_XP_KEY,JSON.stringify({xp,lvl:gameLevel,ts:Date.now()}));}catch{}
}
const _persisted=loadPersistedXP();
let xp=_persisted.xp,gameLevel=_persisted.lvl;
const gbFill=document.getElementById('gbFill');
const gbXP=document.getElementById('gbXP');
const gbLvl=document.getElementById('gbLvl');
const gameBar=document.getElementById('gameBar');
const luOverlay=document.getElementById('luOverlay');
let barShown=xp>0||gameLevel>0;
if(barShown&&gameBar){gameBar.classList.add('show');if(nav)nav.classList.add('pushed');}

function updateGameBar(){
  gbFill.style.width=xp+'%';
  gbXP.textContent=xp;
  gbLvl.textContent=gameLevel;
  savePersistedXP();
}
updateGameBar();

function floatXP(amt,x,y){
  const f=document.createElement('div');
  f.className='xp-float';f.textContent='+'+amt+' XP';
  f.style.left=x+'px';f.style.top=y+'px';
  document.body.appendChild(f);
  setTimeout(()=>f.remove(),1200);
}

function addXP(amt,x,y){
  xp=Math.min(100,xp+amt);
  updateGameBar();
  if(x&&y)floatXP(amt,x,y);
}

function levelUp(lvl,text){
  gameLevel=lvl;
  updateGameBar();
  document.getElementById('luEmoji').textContent=['target','xp-star','shield','controller','fire','mic','trophy','level-badge'][lvl-1]||'⭐';
  document.getElementById('luName').textContent='Level '+lvl;
  document.getElementById('luSub').textContent=text||'';
  luOverlay.classList.add('show');
  fireConfetti();
  setTimeout(()=>luOverlay.classList.remove('show'),900);
  nav.classList.add('pushed');
}

/* Section XP triggers */
const sectionDone=new Set();
const secObs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting&&!sectionDone.has(e.target)){
      sectionDone.add(e.target);
      const lvl=parseInt(e.target.dataset.level);
      const xpAmt=parseInt(e.target.dataset.xp)||10;
      const luText=e.target.dataset.lu;
      if(!barShown&&lvl>=1){gameBar.classList.add('show');barShown=true;nav.classList.add('pushed');}
      const r=e.target.getBoundingClientRect();
      addXP(xpAmt,r.left+r.width/2,r.top+80);
      if(lvl>gameLevel&&luText)setTimeout(()=>levelUp(lvl,luText),200);
      else if(lvl>gameLevel)gameLevel=lvl;
      updateGameBar();
    }
  });
},{threshold:0.25});
document.querySelectorAll('section[data-level]').forEach(s=>secObs.observe(s));
cleanups.push(()=>secObs.disconnect());

/* Click XP on interactive cards */
document.querySelectorAll('.platform-card,.level-card,.fmt-card,.xp-card,.testimonial').forEach(el=>{
  let done=false;
  el.addEventListener('click',function(e){
    if(!done&&barShown){done=true;addXP(2,e.clientX,e.clientY);}
  });
});

/* Mini quiz is now a React component — see src/app/(marketing)/_landing/MiniBattleQuiz.tsx */
/* ===== CONFETTI ===== */
const cc=document.getElementById('confetti');
if(!cc)return;
const cx=cc.getContext('2d');
let parts=[];
function resizeC(){cc.width=innerWidth;cc.height=innerHeight}
resizeC();
window.addEventListener('resize',resizeC);
cleanups.push(()=>window.removeEventListener('resize',resizeC));
let cAnim=false;
function fireConfetti(){
  const cols=['#E63946','#D8F26A','#FFD700','#A855F7','#22C55E','#fff'];
  for(let i=0;i<80;i++)parts.push({x:innerWidth/2+(Math.random()-.5)*200,y:innerHeight/2,vx:(Math.random()-.5)*14,vy:Math.random()*-16-4,s:Math.random()*6+3,c:cols[Math.floor(Math.random()*cols.length)],l:1,d:Math.random()*.015+.008,r:Math.random()*360,rs:Math.random()*10-5});
  if(!cAnim){cAnim=true;animC();}
}
function animC(){
  cx.clearRect(0,0,cc.width,cc.height);
  parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.3;p.l-=p.d;p.r+=p.rs;if(p.l>0){cx.save();cx.translate(p.x,p.y);cx.rotate(p.r*Math.PI/180);cx.fillStyle=p.c;cx.globalAlpha=p.l;cx.fillRect(-p.s/2,-p.s/2,p.s,p.s);cx.restore();}});
  parts=parts.filter(p=>p.l>0);
  if(parts.length)requestAnimationFrame(animC);else cAnim=false;
}

  disposer = () => { cleanups.forEach(fn => { try { fn(); } catch(e) {} }); disposer = null; };
}

window.__landingInit = landingInit;
window.__landingDispose = () => { if (disposer) disposer(); };
})();

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
  try{const raw=localStorage.getItem(LANDING_XP_KEY);if(!raw)return{xp:0,lvl:0};const p=JSON.parse(raw);return{xp:Math.max(0,Math.min(100,+p.xp||0)),lvl:Math.max(0,Math.min(8,+p.lvl||0))};}catch{return{xp:0,lvl:0};}
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

/* ===== MINI QUIZ — DUOLINGO STYLE ===== */
/* Character SVG — little steak mascot */
const CHAR_SVG=`<svg viewBox="0 0 110 130" xmlns="http://www.w3.org/2000/svg">
  <g class="qchar-body">
    <ellipse cx="55" cy="122" rx="32" ry="5" fill="rgba(0,0,0,.15)"/>
    <!-- body/steak -->
    <path d="M20 55 Q15 30 40 22 Q55 12 75 22 Q98 32 95 58 Q98 85 78 100 Q55 112 32 100 Q12 85 20 55 Z" fill="#CC3A3A" stroke="#1E1E1E" stroke-width="3"/>
    <!-- marbling -->
    <path d="M35 50 Q42 46 48 52 M60 40 Q68 44 70 52 M40 75 Q48 72 54 78 M65 72 Q74 68 78 76" stroke="#8f2129" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".6"/>
    <!-- eyes -->
    <circle cx="42" cy="55" r="7" fill="#fff"/>
    <circle cx="70" cy="55" r="7" fill="#fff"/>
    <circle cx="43" cy="57" r="3.5" fill="#1E1E1E" class="qchar-pupil-l"/>
    <circle cx="71" cy="57" r="3.5" fill="#1E1E1E" class="qchar-pupil-r"/>
    <circle cx="44" cy="56" r="1.2" fill="#fff"/>
    <circle cx="72" cy="56" r="1.2" fill="#fff"/>
    <!-- mouth -->
    <path d="M46 72 Q56 80 66 72" stroke="#1E1E1E" stroke-width="3" fill="none" stroke-linecap="round" class="qchar-mouth"/>
    <!-- cheeks -->
    <circle cx="34" cy="68" r="4" fill="#DFED8C" opacity=".6"/>
    <circle cx="78" cy="68" r="4" fill="#DFED8C" opacity=".6"/>
  </g>
</svg>`;

function renderChar(el,mood){
  if(!el)return;
  el.innerHTML=CHAR_SVG;
  const wrap=el.querySelector('.qchar-body')?.parentElement;
  if(wrap){wrap.parentElement.className='quiz-char '+(mood||'');wrap.parentElement.classList.remove('qchar');}
}

/* Question bank — mixed types */
const qBank=[
  {type:'choice',bubble:'Привет! Начнём с лёгкого.',prompt:'If it <code>___</code> tomorrow, I\'ll stay home.',opts:['rains','will rain','rained','raining'],correct:0,note:'В условных I типа — Present Simple.'},
  {type:'build',bubble:'Собери фразу из слов.',prompt:'Переведи: «Я изучаю английский уже 3 года»',bank:['English','learning','been','for','I\'ve','three','years'],answer:['I\'ve','been','learning','English','for','three','years'],note:'Present Perfect Continuous + for.'},
  {type:'choice',bubble:'А это — классика.',prompt:'She <code>___</code> to London three times.',opts:['has been','have been','was','is'],correct:0,note:'Опыт в жизни — Present Perfect.'},
  {type:'listen',bubble:'Послушай и выбери, что ты услышал.',prompt:'Нажми на динамик и выбери фразу',audio:'I\'d love to grab a coffee with you.',opts:['I love to grab coffee with you.','I\'d love to grab a coffee with you.','I love grab a coffee with you.'],correct:1,note:'«I\'d» = I would — вежливое предложение.'},
  {type:'match',bubble:'Соедини пары — слово и его значение.',prompt:'Найди пары',pairs:[['to nail it','справиться на отлично'],['a piece of cake','очень легко'],['hit the books','засесть за учёбу'],['break the ice','растопить лёд']],note:'Идиомы встречаются в живой речи постоянно.'},
  {type:'choice',bubble:'Последний — на разговорный.',prompt:'Друг спрашивает: "How\'s it going?". Что ответишь естественно?',opts:['I am very well, thank you.','Not bad, you?','It is going normally.','Going good, brother.'],correct:1,note:'Разговорный английский — короткий и живой.'}
];

let qIdx=0,qScore=0,qHearts=3,qAnswered=false,qCurrentCorrect=false,qState={};
const qEl={intro:null,game:null,result:null,body:null,check:null,bar:null,hearts:null,fb:null};

function quizInit(){
  qEl.intro=document.getElementById('quizIntro');
  qEl.game=document.getElementById('quizGame');
  qEl.result=document.getElementById('quizResult');
  qEl.body=document.getElementById('quizBody');
  qEl.check=document.getElementById('quizCheck');
  qEl.bar=document.getElementById('quizBarFill');
  qEl.hearts=document.getElementById('quizHearts');
  qEl.fb=document.getElementById('quizFeedback');
  if(!qEl.intro)return;
  renderChar(document.getElementById('quizIntroChar'),'happy');
  document.getElementById('quizStartBtn').onclick=startQuiz;
  document.getElementById('quizClose').onclick=()=>{if(confirm('Выйти из боя? Прогресс не сохранится.'))resetQuiz();};
  document.getElementById('quizSkip').onclick=()=>{qScore--;handleAnswer(false,'—');};
  document.getElementById('quizCheck').onclick=checkAnswer;
  document.getElementById('qfBtn').onclick=nextQuestion;
  document.getElementById('quizRestart').onclick=resetQuiz;
}

function startQuiz(){
  qIdx=0;qScore=0;qHearts=3;
  qEl.intro.style.display='none';
  qEl.result.classList.remove('show');
  qEl.game.classList.add('show');
  renderHearts();
  renderQuestion();
}

function resetQuiz(){
  qEl.game.classList.remove('show');
  qEl.result.classList.remove('show');
  qEl.intro.style.display='block';
}

function renderHearts(){
  qEl.hearts.innerHTML=Array(3).fill(0).map((_,i)=>`<div class="qheart ${i>=qHearts?'lost':''}"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-9.5-9C.8 8.5 2.5 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4.5 0 6.2 4.5 4.5 8-2.5 4.5-9.5 9-9.5 9z"/></svg></div>`).join('');
}

function updateQuizBar(){
  qEl.bar.style.width=((qIdx)/qBank.length*100)+'%';
}

function renderQuestion(){
  updateQuizBar();
  qAnswered=false;
  qState={};
  qEl.fb.classList.remove('show','good','bad');
  qEl.check.classList.remove('ready');
  qEl.check.textContent='Проверить';
  const q=qBank[qIdx];
  let html=`<div class="quiz-scene"><div class="quiz-char thinking" id="qCharEl"></div><div class="quiz-bubble"><div class="qbubble-text">${q.bubble}</div></div></div><div class="quiz-q-area"><div class="quiz-q-label">Задание ${qIdx+1} из ${qBank.length}</div><div class="quiz-q-prompt">${q.prompt}</div>`;
  if(q.type==='choice'){
    html+=`<div class="quiz-opts ${q.opts.length<3?'single':''}">${q.opts.map((o,i)=>`<div class="quiz-opt" data-i="${i}" data-key="${String.fromCharCode(65+i)}">${o}</div>`).join('')}</div>`;
  }else if(q.type==='build'){
    const shuffled=[...q.bank].map((w,i)=>({w,i})).sort(()=>Math.random()-.5);
    qState.placed=[];qState.bank=shuffled;
    html+=`<div class="quiz-bank-target" id="qBankTarget"></div><div class="quiz-bank" id="qBank">${shuffled.map(x=>`<div class="qword" data-w="${x.w}">${x.w}</div>`).join('')}</div>`;
  }else if(q.type==='listen'){
    qState.played=false;
    html+=`<div class="quiz-listen"><button class="quiz-speaker" id="qSpeaker"><svg viewBox="0 0 24 24"><path d="M8 18H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h4l5-4v20l-5-4zm8-5a3 3 0 0 0-1.5-2.6v5.2A3 3 0 0 0 16 13zm-2-7.7v1.5a5 5 0 0 1 0 9.4v1.5a6.5 6.5 0 0 0 0-12.4z"/></svg></button><div class="quiz-listen-hint">Нажми, чтобы послушать</div></div><div class="quiz-opts single" style="margin-top:16px">${q.opts.map((o,i)=>`<div class="quiz-opt" data-i="${i}" data-key="${String.fromCharCode(65+i)}">${o}</div>`).join('')}</div>`;
  }else if(q.type==='match'){
    const lefts=q.pairs.map((p,i)=>({t:p[0],id:i}));
    const rights=q.pairs.map((p,i)=>({t:p[1],id:i})).sort(()=>Math.random()-.5);
    qState.matched=[];qState.active=null;qState.pairs=q.pairs;
    html+=`<div class="quiz-match"><div class="qmatch-col">${lefts.map(x=>`<div class="qmatch-item" data-side="l" data-id="${x.id}">${x.t}</div>`).join('')}</div><div class="qmatch-col">${rights.map(x=>`<div class="qmatch-item" data-side="r" data-id="${x.id}">${x.t}</div>`).join('')}</div></div>`;
  }
  html+=`</div>`;
  qEl.body.innerHTML=html;
  renderChar(document.getElementById('qCharEl'),'thinking');
  attachHandlers();
}

function attachHandlers(){
  const q=qBank[qIdx];
  if(q.type==='choice'||q.type==='listen'){
    qEl.body.querySelectorAll('.quiz-opt').forEach(o=>{
      o.onclick=()=>{
        if(qAnswered)return;
        qEl.body.querySelectorAll('.quiz-opt').forEach(x=>x.classList.remove('selected'));
        o.classList.add('selected');
        qState.selected=parseInt(o.dataset.i);
        qEl.check.classList.add('ready');
      };
    });
  }
  if(q.type==='listen'){
    document.getElementById('qSpeaker').onclick=function(){
      this.classList.add('playing');
      try{
        const u=new SpeechSynthesisUtterance(q.audio);u.lang='en-US';u.rate=.9;
        u.onend=()=>this.classList.remove('playing');
        speechSynthesis.speak(u);
      }catch(e){setTimeout(()=>this.classList.remove('playing'),1500);}
      qState.played=true;
    };
  }
  if(q.type==='build'){
    const bank=document.getElementById('qBank'),target=document.getElementById('qBankTarget');
    bank.querySelectorAll('.qword').forEach(w=>{
      w.onclick=()=>{
        if(qAnswered||w.classList.contains('placed'))return;
        w.classList.add('placed');
        const word=w.dataset.w;
        qState.placed.push(word);
        const p=document.createElement('div');p.className='qword-placed';p.textContent=word;p.dataset.w=word;
        p.onclick=()=>{
          if(qAnswered)return;
          w.classList.remove('placed');
          qState.placed=qState.placed.filter(x=>x!==word||qState.placed.indexOf(x)!==qState.placed.lastIndexOf(word));
          // simpler: rebuild
          const idx=qState.placed.indexOf(word);if(idx>-1)qState.placed.splice(idx,1);
          p.remove();
          qEl.check.classList.toggle('ready',qState.placed.length===qBank[qIdx].answer.length);
        };
        target.appendChild(p);
        qEl.check.classList.toggle('ready',qState.placed.length===q.answer.length);
      };
    });
  }
  if(q.type==='match'){
    qEl.body.querySelectorAll('.qmatch-item').forEach(item=>{
      item.onclick=()=>{
        if(qAnswered||item.classList.contains('matched'))return;
        if(qState.active&&qState.active.side===item.dataset.side){
          qState.active.el.classList.remove('active');
          qState.active={side:item.dataset.side,id:item.dataset.id,el:item};
          item.classList.add('active');return;
        }
        if(qState.active){
          if(qState.active.id===item.dataset.id){
            item.classList.add('matched');qState.active.el.classList.add('matched');qState.active.el.classList.remove('active');
            qState.matched.push(+item.dataset.id);
            qState.active=null;
            if(qState.matched.length===q.pairs.length){qEl.check.classList.add('ready');qEl.check.textContent='Готово!';}
          }else{
            item.classList.add('wrong');qState.active.el.classList.add('wrong');
            setTimeout(()=>{item.classList.remove('wrong','active');qState.active&&qState.active.el.classList.remove('wrong','active');qState.active=null;},500);
          }
        }else{
          qState.active={side:item.dataset.side,id:item.dataset.id,el:item};
          item.classList.add('active');
        }
      };
    });
  }
}

function checkAnswer(){
  if(qAnswered||!qEl.check.classList.contains('ready'))return;
  qAnswered=true;
  const q=qBank[qIdx];let correct=false,correctText='';
  if(q.type==='choice'||q.type==='listen'){
    correct=qState.selected===q.correct;
    correctText=q.opts[q.correct];
    qEl.body.querySelectorAll('.quiz-opt').forEach((o,i)=>{
      o.style.pointerEvents='none';
      if(i===q.correct)o.classList.add('correct');
      else if(i===qState.selected&&!correct)o.classList.add('wrong');
    });
  }else if(q.type==='build'){
    const userAns=qState.placed.join(' ').toLowerCase();
    const right=q.answer.join(' ').toLowerCase();
    correct=userAns===right;
    correctText=q.answer.join(' ');
    document.getElementById('qBankTarget').classList.add(correct?'correct':'wrong');
  }else if(q.type==='match'){
    correct=qState.matched.length===q.pairs.length;
    correctText='Все пары найдены';
  }
  showFeedback(correct,correctText,q.note);
  qCurrentCorrect=correct;
  if(correct){qScore++;addXP(5,window.innerWidth/2,window.innerHeight/2);}
  else{qHearts--;renderHearts();}
  const ch=document.getElementById('qCharEl');
  if(ch)renderChar(ch,correct?'happy':'sad');
}

function showFeedback(ok,corr,note){
  qEl.fb.classList.add('show',ok?'good':'bad');
  document.getElementById('qfIcon').textContent=ok?'✓':'✕';
  document.getElementById('qfTitle').textContent=ok?['Отлично!','В точку!','Умница!','Красиво!'][Math.floor(Math.random()*4)]:'Не совсем';
  document.getElementById('qfCorrect').innerHTML=ok?note:`Верно: <b>${corr}</b>. ${note||''}`;
  document.getElementById('qfBtn').textContent=ok?'Продолжить':'Понятно';
}

function nextQuestion(){
  qEl.fb.classList.remove('show');
  qIdx++;
  if(qHearts<=0||qIdx>=qBank.length){
    setTimeout(finishQuiz,400);return;
  }
  setTimeout(renderQuestion,300);
}

function finishQuiz(){
  qEl.game.classList.remove('show');
  updateQuizBar();qEl.bar.style.width='100%';
  const pct=Math.round(qScore/qBank.length*100);
  let lvl,cefr,tag,steps;
  if(pct>=85){lvl='Medium Well';cefr='B2';tag='Ты готов к беглой речи. Осталось отточить произношение и идиомы — и ты Well Done.';
    steps=[['Speaking Club — Advanced','Живые дискуссии с native speakers 2 раза в неделю.','Практика','lime'],['Курс «Business English»','Переговоры, презентации, письма. Для карьеры.','Курс',''],['Подкаст-клуб','Слушаем эпизоды TED и обсуждаем. Тренируешь уши и словарь.','Бонус','']];
  }else if(pct>=60){lvl='Medium Rare';cefr='B1';tag='Ты уверенно держишь базу, но грамматика и разговорная беглость хромают. Самое время — на сковородку.';
    steps=[['Пробное занятие 30 мин','Сверим уровень с преподавателем и соберём план.','Бесплатно','lime'],['Курс «Grammar Fix»','12 уроков — закроем пробелы в временах и условных.','Курс',''],['Speaking Club — Intermediate','Говорим по темам: работа, путешествия, кино.','Практика',''],['General English 1-on-1','Персональный трек под твои цели.','Формат','']];
  }else if(pct>=35){lvl='Rare';cefr='A2';tag='База есть, но нужна ежедневная практика. Не паникуй — мы проведём тебя за руку.';
    steps=[['Пробное занятие 30 мин','Бесплатная встреча — проверим уровень вживую.','Бесплатно','lime'],['Курс «Pre-Intermediate»','24 урока — от настоящих времён до сложных диалогов.','Курс',''],['Ежедневные упражнения','10 минут в день на платформе. Стрики и XP держат в тонусе.','Практика',''],['Клуб Beginners','Говорим просто и без стыда. Без native-speakers.','Клуб','']];
  }else{lvl='Raw';cefr='A1';tag='Почти с нуля — и это окей. За 3 месяца с нами ты заговоришь.';
    steps=[['Пробное занятие 30 мин','Познакомимся, проверим уровень, покажем платформу.','Бесплатно','lime'],['Курс «Английский с нуля»','36 уроков — алфавит, базовая грамматика, первые фразы.','Курс',''],['Личный преподаватель','1-on-1 занятия 2 раза в неделю. Мягкий старт.','Формат',''],['Daily Drills','10 минут в день. Слова, произношение, слушание.','Практика','']];
  }
  document.getElementById('qresLevel').textContent=lvl;
  document.getElementById('qresTagline').textContent=tag;
  document.getElementById('qresCefr').textContent=cefr;
  document.getElementById('qresScore').textContent=qScore+'/'+qBank.length;
  document.getElementById('qresXp').textContent='+'+qScore*5+' XP';
  const rm=document.getElementById('qresRoadmap');
  rm.innerHTML=steps.map((s,i)=>`<div class="qres-step"><div class="qres-step-num">${i+1}</div><div class="qres-step-body"><div class="qres-step-title">${s[0]}</div><div class="qres-step-desc">${s[1]}</div><span class="qres-step-tag ${s[3]}">${s[2]}</span></div></div>`).join('');
  renderChar(document.getElementById('qresChar'),'happy');
  qEl.result.classList.add('show');
  addXP(qScore*5,window.innerWidth/2,window.innerHeight/2);
  // confetti for any result
  if(typeof fireConfetti==='function')fireConfetti();
}

quizInit();

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

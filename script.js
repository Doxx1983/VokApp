
'use strict';
/* ================= LOGIK (ohne Oberfläche, wird separat getestet) ================= */
//LOGIC-START
const DAY=86400000;
const BOX_DAYS=[0,0,1,3,7,14];
const RARITIES=[
  {k:'n',label:'Normal',w:62,stars:1},
  {k:'s',label:'Selten',w:26,stars:2},
  {k:'e',label:'Episch',w:10,stars:3},
  {k:'l',label:'Legendär',w:2,stars:4}
];
const SPECIAL_PACKS={big:{name:'Big-Pack',n:5,desc:'5 Karten'},mega:{name:'Mega-Pack',n:7,desc:'7 Karten'},epic:{name:'Epic-Pack',n:3,only:'e',desc:'3 epische Karten'},legend:{name:'Legend-Pack',n:1,only:'l',desc:'1 legendäre Karte'}};
function norm(s){
  return String(s).normalize('NFC').toLowerCase().trim().replace(/[.!?¡¿,]+$/g,'').replace(/\s+/g,' ').trim();
}
function variants(ans){
  const out=new Set();
  String(ans).split(/\s*[\/;]\s*/).forEach(part=>{
    part=part.trim(); if(!part) return;
    const forms=[part,part.replace(/\([^)]*\)/g,' '),part.replace(/[()]/g,'')];
    forms.forEach(f=>{
      const n=norm(f); if(!n) return;
      out.add(n);
      if(n.startsWith('to ')) out.add(n.slice(3));
    });
  });
  return [...out];
}
function lev(a,b){
  const m=a.length,n=b.length; if(!m) return n; if(!n) return m;
  let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){
    const cur=[i];
    for(let j=1;j<=n;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    }
    prev=cur;
  }
  return prev[n];
}
function checkAnswer(input,answer){
  const x=norm(input); if(!x) return 'wrong';
  const vs=variants(answer);
  if(vs.includes(x)) return 'right';
  for(const v of vs){
    const tol=v.length>=8?2:(v.length>=4?1:0);
    if(tol&&lev(x,v)<=tol) return 'almost';
  }
  return 'wrong';
}
/* Gesprochene Antwort: mehrere Erkennungsvarianten; ein ganzes Wort im Satz zählt ("the dog"). */
function evalSpeech(alts,answer){
  let best='wrong';
  const vs=variants(answer);
  for(const t of alts){
    const k=checkAnswer(t,answer);
    if(k==='right') return 'right';
    const x=' '+norm(t)+' ';
    if(vs.some(v=>x.includes(' '+v+' '))) return 'right';
    if(k==='almost') best='almost';
  }
  return best;
}
function dueFor(box,now){return box<=1?now:now+BOX_DAYS[box]*DAY}
function applyFirstTry(w,kind,hinted,now){
  w.seen=(w.seen||0)+1;
  if(kind==='right'&&!hinted){w.right=(w.right||0)+1;w.box=Math.min(5,(w.box||1)+1);w.due=dueFor(w.box,now);}
  else if(kind==='right'||kind==='almost'){w.due=now;}
  else{w.wrong=(w.wrong||0)+1;w.box=1;w.due=now;}
}
function normTag(s){return String(s==null?'':s).replace(/^[#\s]+/,'').replace(/\s+/g,' ').trim().slice(0,40);}
function splitTags(s){const out=[];for(const p of String(s==null?'':s).split(/#|,/)){const t=normTag(p);if(t&&!out.some(x=>x.toLowerCase()===t.toLowerCase()))out.push(t);}return out;}
function tagsOf(w){return Array.isArray(w.tags)?w.tags:(w.unit?[w.unit]:[]);}
function pickSession(vocab,unit,size,now,rnd){
  rnd=rnd||Math.random;
  const sel=Array.isArray(unit)?unit:(unit?[unit]:[]);
  const pool=vocab.filter(w=>!sel.length||tagsOf(w).some(t=>sel.includes(t)));
  const sc=w=>(6-w.box)*10+Math.min(w.wrong||0,5)*2+((w.seen||0)===0?4:0)+rnd()*8;
  const due=pool.filter(w=>w.due<=now).map(w=>({w,s:sc(w)})).sort((a,b)=>b.s-a.s).map(o=>o.w);
  let pick=due.slice(0,size);
  if(pick.length<size){
    const rest=pool.filter(w=>w.due>now).map(w=>({w,r:rnd()})).sort((a,b)=>a.w.due-b.w.due||a.r-b.r).map(o=>o.w);
    pick=pick.concat(rest.slice(0,size-pick.length));
  }
  for(let i=pick.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[pick[i],pick[j]]=[pick[j],pick[i]];}
  return pick.map(w=>w.id);
}
/* Karten und Text-Belohnungen liegen im selben Topf; die Seltenheit bestimmt die Wahrscheinlichkeit. */
function drawCards(items,n,rnd){
  rnd=rnd||Math.random;
  let pool=items.slice();const out=[];
  for(let i=0;i<n;i++){
    const avail=RARITIES.filter(r=>pool.some(c=>c.rarity===r.k));
    if(!avail.length) break;
    const tot=avail.reduce((s,r)=>s+r.w,0);
    let x=rnd()*tot,pick=avail[avail.length-1];
    for(const r of avail){if(x<r.w){pick=r;break;}x-=r.w;}
    const group=pool.filter(c=>c.rarity===pick.k);
    const it=group[Math.floor(rnd()*group.length)];
    out.push(it);
    if(it.once) pool=pool.filter(c=>c!==it);
  }
  return out;
}
function packDraw(t,pool,rnd){
  const sp=SPECIAL_PACKS[t];if(!sp)return null;
  let p=pool;if(sp.only){const f=pool.filter(c=>c.rarity===sp.only);if(f.length)p=f;}
  return drawCards(p,sp.n,rnd);
}
function chances(items){
  const avail=RARITIES.filter(r=>items.some(i=>i.rarity===r.k));
  const tot=avail.reduce((s,r)=>s+r.w,0),out={};
  for(const r of avail){const g=items.filter(i=>i.rarity===r.k);g.forEach(i=>{out[i.id]=r.w/tot/g.length;});}
  return out;
}
function fmtPct(p){const v=p*100;return (v>=10?String(Math.round(v)):v.toFixed(1).replace('.',','))+' %';}
function addPoints(L,n){
  let packs=0; L.points+=n; L.totalPoints=(L.totalPoints||0)+n;
  while(L.points>=L.goal){L.points-=L.goal;L.packs++;packs++;}
  return packs;
}
function parseVocab(text){
  const items=[];let skipped=0;
  for(const raw of String(text).split(/\r?\n/)){
    const line=raw.trim(); if(!line) continue;
    const m=line.match(/^(.+?)\s*(?:=|\t|\s[-–—]\s)\s*(.+)$/);
    if(!m){skipped++;continue;}
    const f=m[1].trim(),d=m[2].trim();
    if(!f||!d){skipped++;continue;}
    let dd=d,tags=[];const hi=d.search(/\s#/);
    if(hi>=0){tags=splitTags(d.slice(hi));dd=d.slice(0,hi).trim();}
    if(!dd){skipped++;continue;}
    items.push({f,d:dd,tags});
  }
  return {items,skipped};
}
/* „# Name“ setzt Tags für die folgenden Zeilen; „#Tag“ am Zeilenende (Überschrift hat Vorrang nur ohne Zeilen-Tags). */
function parseSections(text,def){
  let cur=def&&def.length?def:['Allgemein'];const items=[];let skipped=0,buf=[];
  const flush=()=>{const r=parseVocab(buf.join('\n'));skipped+=r.skipped;for(const it of r.items)items.push({f:it.f,d:it.d,tags:it.tags.length?it.tags:cur});buf=[];};
  for(const raw of String(text).split(/\r?\n/)){
    const m=raw.match(/^\s*#+\s*(.+?)\s*$/);
    if(m){flush();const t=splitTags(m[1]);cur=t.length?t:cur;}else buf.push(raw);
  }
  flush();
  return {items,skipped};
}
const cardKey=n=>String(n).toLowerCase().replace(/[^a-z0-9äöüß]/g,'');
function cleanCardName(fn){
  const s=String(fn).replace(/\.[^.]+$/,'').replace(/[_\-+]+/g,' ').replace(/\s+/g,' ').trim();
  if(!s) return 'Karte';
  return s.replace(/(^|\s)(\S)/g,(m,a,b)=>a+b.toUpperCase());
}
function primaryAnswer(a){
  const first=String(a).split(/\s*[\/;]\s*/)[0]||String(a);
  return first.replace(/[()]/g,'').trim();
}
function hintText(a,h){
  const p=primaryAnswer(a);let shown=0;
  return [...p].map(ch=>{if(ch===' ')return ' ';shown++;return shown<=h?ch:'_';}).join(' ');
}
/* Sortierung der Vokabelliste: col = 'f' (Fremdsprache), 'd' (Deutsch), 'u' (Kategorie) */
function wLevel(w){return (w.seen>0)?Math.max(1,Math.min(5,w.box||1)):0;}
function sortWords(list,col,dir){
  const cf=new Intl.Collator('en',{sensitivity:'base',numeric:true}),cd=new Intl.Collator('de',{sensitivity:'base',numeric:true});
  const fkey=w=>String(w.f).replace(/^to\s+/i,'');
  const key=w=>col==='d'?w.d:col==='u'?tagsOf(w).join(' '):col==='k'?String(wLevel(w)):fkey(w);
  const c=col==='f'?cf:cd;
  return list.slice().sort((a,b)=>(c.compare(key(a),key(b))*dir)||cf.compare(fkey(a),fkey(b)));
}
function speechLangFor(name){
  const n=String(name).toLowerCase();
  const map=[[/franz|french|fran[cç]/,'fr-FR'],[/spani|spanish|espa/,'es-ES'],[/ital/,'it-IT'],[/deutsch|german/,'de-DE'],
    [/t[üu]rk/,'tr-TR'],[/poln|polish|polski/,'pl-PL'],[/russ/,'ru-RU'],[/niederl|dutch|nederl/,'nl-NL'],[/portug/,'pt-PT'],[/amerik|american|\bus\b/,'en-US']];
  for(const [re,code] of map) if(re.test(n)) return code;
  return 'en-GB';
}
function resolveSpeechLang(L){return L.speechLang&&L.speechLang!=='auto'?L.speechLang:speechLangFor(L.name);}
/* Schwarzen Hintergrund eines Bildes (RGBA-Daten) transparent machen. Gibt [x0,y0,x1,y1] des Inhalts zurück oder null. */
function cutoutBlack(d,w,h){
  const lum=i=>d[i*4]+d[i*4+1]+d[i*4+2];
  const seen=new Uint8Array(w*h),stack=[];
  const push=i=>{if(!seen[i]&&lum(i)<45){seen[i]=1;stack.push(i);}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
  for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
  let n=0;
  while(stack.length){const i=stack.pop();n++;const x=i%w,y=(i-x)/w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);}
  if(n<w*h*0.02) return null;
  const edge=[];
  for(let i=0;i<w*h;i++){
    if(seen[i]||lum(i)>=150) continue;
    const x=i%w,y=(i-x)/w;
    if((x>0&&seen[i-1])||(x<w-1&&seen[i+1])||(y>0&&seen[i-w])||(y<h-1&&seen[i+w])) edge.push(i);
  }
  edge.forEach(i=>{seen[i]=1;});
  let x0=w,y0=h,x1=-1,y1=-1;
  for(let i=0;i<w*h;i++){
    if(seen[i]){d[i*4+3]=0;continue;}
    const x=i%w,y=(i-x)/w;
    if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
  }
  return x1<0?null:[x0,y0,x1+1,y1+1];
}
/* Farbschemata: Helligkeit und Sättigung folgen dem blauen Original; "Hell…" ist je eine hellere Variante */
const hsl2rgb=(h,s,l)=>{s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return [f(0),f(8),f(4)].map(x=>Math.round(x*255));};
const rgbHex=c=>'#'+c.map(x=>x.toString(16).padStart(2,'0')).join('');
const lum=c=>{const [r,g,b]=c.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4);});return .2126*r+.7152*g+.0722*b;};
const THEME_DEFS=[
  {k:'blau',n:'Blau',h:217},
  {k:'gelb',n:'Gelb',h:48,a:[100,50]},{k:'hellgelb',n:'Hellgelb',h:48,light:1},
  {k:'grau',n:'Grau',h:215,gray:1,a:[100,48]},{k:'hellgrau',n:'Hellgrau',h:215,gray:1,light:1},
  {k:'gruen',n:'Grün',h:145,a:[85,38]},{k:'hellgruen',n:'Hellgrün',h:110,light:1},
  {k:'hellblau',n:'Hellblau',h:205,light:1},
  {k:'lila',n:'Lila',orig:1,hex:'#8c83ff'},{k:'helllila',n:'Helllila',h:255,light:1},
  {k:'orange',n:'Orange',h:27,a:[100,50]},{k:'hellorange',n:'Hellorange',h:27,light:1},
  {k:'rosa',n:'Rosa',h:330,a:[90,58]},{k:'hellrosa',n:'Hellrosa',h:330,light:1},
  {k:'rot',n:'Rot',h:4,a:[85,50]},{k:'hellrot',n:'Hellrot',h:4,light:1},
  {k:'schwarz',n:'Schwarz',hex:'#0b0b0c',dark:1},
  {k:'weiss',n:'Weiß',hex:'#ffffff',white:1}
];
function accOf(t){
  return t.light?[90,72]:[100,68];
}
function themeVarsRaw(k){
  const t=THEME_DEFS.find(x=>x.k===k);if(!t)return null;
  if(t.orig)return {'--bg':'#13112a','--surface':'#1e1b3d','--surface-2':'#2a2650','--ink':'#f0eeff','--muted':'#a5a2cc','--line':'#37326a','--accent':'#8c83ff','--accent-2':'#b3adff','--accent-dark':'#3d35b8','--accent-ink':'#13112a','--accent-text':'#8c83ff','--accent-soft':'#2e2a63','--good':'#4cd49b','--good-bg':'#12352a','--bad':'#ff8077','--bad-bg':'#401a1a','--warn':'#ffd36b','--warn-bg':'#3d3010','--shadow':'0 6px 18px rgba(0,0,0,.35)','--streak':'#ffd23f','color-scheme':'dark'};
  if(t.dark)return {'--bg':'#0b0b0c','--surface':'#1a1a1c','--surface-2':'#27272b','--ink':'#f2f2f2','--muted':'#a2a2aa','--line':'#36363c','--accent':'#f2f2f2','--accent-2':'#cfcfd6','--accent-dark':'#6b6b74','--accent-ink':'#0b0b0c','--accent-text':'#f2f2f2','--accent-soft':'#2d2d33','--good':'#4cd49b','--good-bg':'#12352a','--bad':'#ff8077','--bad-bg':'#401a1a','--warn':'#ffd36b','--warn-bg':'#3d3010','--shadow':'0 6px 18px rgba(0,0,0,.5)','--streak':'#ffd23f','color-scheme':'dark'};
  if(t.white)return {'--bg':'#ffffff','--surface':'#f3f4f6','--surface-2':'#e8eaee','--ink':'#1c1c1e','--muted':'#666b73','--line':'#d9dce2','--accent':'#3a3d44','--accent-2':'#6b7078','--accent-dark':'#1c1c1e','--accent-ink':'#ffffff','--accent-text':'#1c1c1e','--accent-soft':'#e8eaee','--shadow':'0 1px 0 rgba(0,0,0,.05),0 6px 18px rgba(0,0,0,.08)','--streak':'#ff7a00','color-scheme':'light'};
  const g=t.gray?(t.light?.2:.32):1,H=t.h,P=(s,l,hh)=>`hsl(${hh===undefined?H:hh} ${Math.round(s*g)}% ${l}%)`;
  if(!t.light){const d=(s,l,hh)=>`hsl(${hh===undefined?H:hh} ${Math.round(s*g)}% ${l}%)`;
    return {'--bg':d(67,11),'--surface':d(60,18),'--surface-2':d(57,25),'--ink':d(100,96),'--muted':d(40,74),'--line':d(48,32),'--accent':d(100,68),'--accent-2':d(100,76,(H+343)%360),'--accent-dark':d(73,38),'--accent-ink':d(80,9),'--accent-text':d(100,68),'--accent-soft':d(60,28),'--good':'#4cd49b','--good-bg':'#12352a','--bad':'#ff8077','--bad-bg':'#401a1a','--warn':'#ffd36b','--warn-bg':'#3d3010','--shadow':'0 6px 18px rgba(0,0,0,.4)','--streak':'#ffd23f','color-scheme':'dark'};}
  const [as,al]=accOf(t);
  const [bs,bl,s2s,s2l,ls,ll,ss,sl,ds,dl]=t.light?[60,98,60,95,45,91,80,94,70,42]:[100,95,90,90,70,84,100,89,95,28];
  const acc=hsl2rgb(H,as*g,al),ink=lum(acc)>.22?P(60,10):'#ffffff';
  return {'--bg':P(bs,bl),'--surface':'#ffffff','--surface-2':P(s2s,s2l),'--ink':P(t.light?50:64,t.light?14:15),'--muted':P(t.light?22:30,t.light?42:42),'--line':P(ls,ll),'--accent':P(as,al),'--accent-2':P(100,t.light?78:62,(H+346)%360),'--accent-dark':P(ds,dl),'--accent-ink':ink,'--accent-text':P(as,32),'--accent-soft':P(ss,sl),'--good':'#147a52','--good-bg':'#dcf4e8','--bad':'#c4352b','--bad-bg':'#fde4e1','--warn':'#7d5200','--warn-bg':'#fff0c4','--shadow':'0 1px 0 rgba(0,0,0,.05),0 6px 18px rgba(0,0,0,.08)','--streak':'#ff7a00','color-scheme':'light'};
}
const parseCol=c=>{c=String(c).trim();if(c[0]==='#'){const v=c.length===4?[...c.slice(1)].map(x=>x+x):c.slice(1).match(/../g);return v.map(x=>parseInt(x,16));}const m=c.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);return m?hsl2rgb(+m[1],+m[2],+m[3]):[128,128,128];};
const contrastOf=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
/* Nebentext (--muted) bekommt mindestens 5,5:1 gegen Hintergrund und Flächen, indem er Richtung Textfarbe gemischt wird. */
function themeVars(k){
  const v=themeVarsRaw(k);if(!v)return v;
  const bgs=['--bg','--surface','--surface-2'].map(n=>parseCol(v[n])),ink=parseCol(v['--ink']),m0=parseCol(v['--muted']);
  const ok=c=>Math.min(...bgs.map(b=>contrastOf(c,b)))>=5.5;
  let t=0,c=m0;while(!ok(c)&&t<1){t+=.05;c=m0.map((x,i)=>Math.round(x+(ink[i]-x)*t));}
  v['--muted']=rgbHex(c);return v;
}
const themeHex=t=>{const [s,l]=accOf(t),g=t.gray?(t.light?.2:.32):1;return rgbHex(hsl2rgb(t.h,s*g,l));};
const themeKey=n=>n.replace(/^Hell/,'').toLowerCase()+(n.startsWith('Hell')?'1':'0');
const BACKS=['Sternenhimmel','Dschungel','Ozean','Feuer','Neon','Regenbogen','Kristalle','Weltraum','Pixel','Einhorn'];
const THEMES=THEME_DEFS.map(t=>({k:t.k,n:t.n,hex:t.hex||themeHex(t)})).sort((a,b)=>themeKey(a.n).localeCompare(themeKey(b.n),'de'));
/* ZIP lesen (gespeichert oder deflate), ohne Bibliothek */
function zipList(buf){
  const u=new Uint8Array(buf),dv=new DataView(buf);let e=-1;
  for(let i=u.length-22;i>=Math.max(0,u.length-65558);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break;}}
  if(e<0)throw new Error('kein ZIP');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[];
  for(let k=0;k<n;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const meth=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    const name=new TextDecoder('utf-8').decode(u.subarray(p+46,p+46+nl));p+=46+nl+el+cl;
    if(name.endsWith('/'))continue;
    const ds=off+30+dv.getUint16(off+26,true)+dv.getUint16(off+28,true);
    out.push({name,meth,raw:u.subarray(ds,ds+cs)});
  }
  return out;
}
async function zipData(en){
  if(en.meth===0)return en.raw;
  if(en.meth!==8)throw new Error('Format nicht unterstützt');
  return new Uint8Array(await new Response(new Blob([en.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}
function zipImage(name){
  if(/(^|\/)(__MACOSX|\.)/.test(name)||/(^|\/)\./.test(name))return null;
  const m=name.toLowerCase().match(/\.(jpe?g|png|webp|gif|bmp|avif)$/);
  return m?'image/'+(m[1]==='jpg'?'jpeg':m[1]):null;
}
function zipRarity(path,def){
  const segs=path.toLowerCase().split('/').slice(0,-1);
  for(const s of segs.reverse()){
    if(s.startsWith('normal'))return 'n';if(s.startsWith('selten'))return 's';if(s.startsWith('episch'))return 'e';if(s.startsWith('legend'))return 'l';
  }
  return def;
}
/* Serie: alle cfg.days Tage in Folge ist eine Serie abgeschlossen */
function streakDue(count,days){return count>0&&days>0&&count%days===0;}
function nextStreakTarget(count,days){return (Math.floor(count/days)+1)*days;}
function migrate(s){
  s.mode=s.mode==='speak'?'speak':'write';
  s.rewards=Array.isArray(s.rewards)?s.rewards:[];
  s.cardBack=Math.min(Math.max(Math.round(+s.cardBack)||1,1),BACKS.length);
  s.pomo=s.pomo&&typeof s.pomo==='object'&&+s.pomo.start?s.pomo:null;
  if(s.pomo&&s.pomo.lock&&!(+s.pomo.until>0))s.pomo.until=Date.now()+(+s.pomo.left>0?s.pomo.left*1000:300000);
  const pc=s.pomoCfg=s.pomoCfg||{};pc.work=Math.min(90,Math.max(1,Math.round(+pc.work)||25));pc.brk=Math.min(30,Math.max(1,Math.round(+pc.brk)||5));pc.idle=Math.min(30,Math.max(1,Math.round(+pc.idle)||5));
  s.streak=s.streak||{last:null,count:0};s.streak.best=Math.max(s.streak.best||0,s.streak.count||0);
  s.theme=THEME_DEFS.some(t=>t.k===s.theme)?s.theme:'blau';
  delete s.streakRewards;
  const c=s.streakCfg=s.streakCfg||{};c.days=Math.max(1,Math.min(365,+c.days||5));
  c.def=c.def||{};c.def.active=!!c.def.active;c.def.kind=(c.def.kind==='text'||SPECIAL_PACKS[c.def.kind])?c.def.kind:'pack';c.def.packs=Math.max(1,Math.min(10,+c.def.packs||1));c.def.rid=c.def.rid||'';
  c.nextRid=c.nextRid||'';c.nextPack=SPECIAL_PACKS[c.nextPack]?c.nextPack:'';if(c.nextPack)c.nextRid='';
  s.streak=s.streak||{last:null,count:0};
  s.langs.forEach(l=>{
    l.log=l.log&&typeof l.log==='object'?l.log:{};l.wins=l.wins||[];l.owned=l.owned||{};l.cards=l.cards||[];l.vocab=l.vocab||[];
    l.speechLang=(!l.speechLang||l.speechLang==='auto'||l.speechLang===speechLangFor(l.name))?'auto':l.speechLang;
    l.goal=l.goal||100;l.ppr=l.ppr||10;l.packSize=l.packSize||3;l.sessionSize=Math.min(30,Math.max(10,Math.round((+l.sessionSize||10)/10)*10));l.dir=l.dir||'mix';
    l.vocab.forEach(w=>{w.tags=splitTags(Array.isArray(w.tags)?w.tags.join('#'):(w.unit||''));if(!w.tags.length)w.tags=['Allgemein'];delete w.unit;});
    l.points=l.points||0;l.packs=l.packs||0;l.sp=(Array.isArray(l.sp)?l.sp:[]).filter(t=>SPECIAL_PACKS[t]);l.totalPoints=l.totalPoints||0;
  });
  if(!s.langs.find(l=>l.id===s.activeLang)) s.activeLang=s.langs[0]?s.langs[0].id:null;
  return s;
}
/* Lernprotokoll pro Tag: p Punkte, s Sekunden, a beantwortete Wörter, r davon beim ersten Versuch richtig */
const WD=['Mo','Di','Mi','Do','Fr','Sa','So'];
const MONTHS=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const dKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function logAdd(L,d,add){L.log=L.log||{};const k=dKey(d),e=L.log[k]||(L.log[k]={p:0,s:0,a:0,r:0});for(const f in add)e[f]=(e[f]||0)+add[f];}
function logSum(log,from,to){
  const t={p:0,s:0,a:0,r:0,days:0};
  for(let d=new Date(from);d<=to;d.setDate(d.getDate()+1)){
    const e=log[dKey(d)];if(!e)continue;
    t.p+=e.p||0;t.s+=e.s||0;t.a+=e.a||0;t.r+=e.r||0;if((e.s||0)>0||(e.a||0)>0)t.days++;
  }
  return t;
}
function weekRange(now){const a=new Date(now.getFullYear(),now.getMonth(),now.getDate());a.setDate(a.getDate()-(a.getDay()+6)%7);const b=new Date(a);b.setDate(b.getDate()+6);return [a,b];}
function monthRange(now){return [new Date(now.getFullYear(),now.getMonth(),1),new Date(now.getFullYear(),now.getMonth()+1,0)];}
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/864e5+1)/7);}
function seriesDays(log,now,n){
  const out=[];
  for(let i=n-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i),e=log[dKey(d)]||{};
    out.push({lab:WD[(d.getDay()+6)%7],sub:d.getDate()+'.',p:e.p||0,s:e.s||0,cur:i===0});}
  return out;
}
function seriesWeeks(log,now,n){
  const w0=weekRange(now)[0],out=[];
  for(let i=n-1;i>=0;i--){const a=new Date(w0.getFullYear(),w0.getMonth(),w0.getDate()-7*i),b=new Date(a.getFullYear(),a.getMonth(),a.getDate()+6),t=logSum(log,a,b);
    out.push({lab:'KW'+isoWeek(a),sub:a.getDate()+'.'+(a.getMonth()+1)+'.',p:t.p,s:t.s,cur:i===0});}
  return out;
}
function fmtDur(s){s=Math.round(s||0);if(s<60)return s+' Sek.';const m=Math.round(s/60);if(m<60)return m+' Min.';return Math.floor(m/60)+':'+String(m%60).padStart(2,'0')+' Std.';}
/* Pomodoro: 25 Min. Lernzeit, dann 5 Min. gesperrte Pause. Pause nach Ende einer Runde > 5 Min. setzt den Timer zurück. */
/* cfg in Millisekunden: {work,brk,idle}. Die Pause endet zum Zeitpunkt p.until (vertrauenswürdige Zeit) und beginnt erst nach einer Runde. */
function pomoStep(p,now,inQuiz,tnow,cfg){
  if(!p)return null;
  if(p.lock)return tnow>=p.until?null:p;
  if(p.idle!=null&&now-p.idle>=cfg.idle)return null;
  if(now-p.start>=cfg.work&&!inQuiz)return {...p,lock:true,until:tnow+cfg.brk};
  return p;
}
function pomoOnStart(p,now,cfg){p=pomoStep(p,now,false,0,cfg);if(p&&p.lock)return p;return p?{...p,idle:null}:{start:now,idle:null};}
function pomoOnEnd(p,now){return p&&!p.lock?{...p,idle:now}:p;}
//LOGIC-END

/* ================= Hilfen ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const rar=k=>RARITIES.find(r=>r.k===k)||RARITIES[0];
const SRClass=()=>window.SpeechRecognition||window.webkitSpeechRecognition||null;
const fmtDate=ts=>new Date(ts).toLocaleDateString('de-DE');
function dateKey(off){const d=new Date();d.setDate(d.getDate()+(off||0));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function hashPin(p){let h=5381;const s='ws|'+p;for(let i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;return String(h);}
let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600);}
const ICON_FLAME='<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M12 2c.6 3.2-1 5-2.4 6.8C8.2 10.600 7 12 7 14.500 7 17.500 9.200 20 12 20s5-2.500 5-5.500c0-2-.9-3.300-2-4.500-.2 1.300-.9 2.200-1.700 2.700C13.700 9 13.300 4.500 12 2Z"/></svg>';
const ICON_PEN='<svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/></svg>';
const PACK_KEY='packimg';
const packPic=()=>IMG[PACK_KEY]?`<img src="${IMG[PACK_KEY]}" alt="Päckchen">`:`<div class="packdef"></div>`;
const winLabel=w=>w.src==='streak'?'Serie · '+w.days+' Tage':rar(w.rarity).label;
const ICON_MIC='<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

/* ================= Daten ================= */
const KEY='woerter-sammler-v1';
function newLang(name){
  return {id:uid(),name,dir:'mix',sessionSize:10,goal:100,packSize:3,ppr:10,speechLang:'auto',points:0,totalPoints:0,packs:0,sp:[],vocab:[],cards:[],owned:{},wins:[],log:{}};
}
function seed(){
  const L=newLang('Englisch');
  const ex=[['dog','Hund'],['cat','Katze'],['house','Haus'],['apple','Apfel'],['red','rot'],['school','Schule'],['book','Buch'],['friend','Freund'],['water','Wasser'],['to run','rennen']];
  ex.forEach(([f,d])=>L.vocab.push({id:uid(),f,d,tags:['Beispiel'],box:1,due:0,seen:0,right:0,wrong:0}));
  return migrate({v:1,pinHash:null,mode:'write',rewards:[],streak:{last:null,count:0},activeLang:L.id,langs:[L]});
}
function load(){
  try{const r=localStorage.getItem(KEY);if(r){const s=JSON.parse(r);if(s&&Array.isArray(s.langs))return migrate(s);}}catch(e){}
  return seed();
}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){toast('Speichern nicht möglich');}}
const curLang=()=>S.langs.find(l=>l.id===S.activeLang)||S.langs[0]||null;
const unitsOf=L=>[...new Set(L.vocab.flatMap(tagsOf))].sort(new Intl.Collator('de',{sensitivity:'base',numeric:true}).compare);
const hasTag=(w,t)=>tagsOf(w).includes(t);
const rewardsFor=L=>S.rewards.filter(r=>r.active&&(r.lang==='all'||r.lang===L.id));

/* Bilder in IndexedDB */
let db=null;const IMG={},BLOBS={};
function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open('woerter-sammler',1);r.onupgradeneeded=()=>r.result.createObjectStore('img');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function idbTx(mode,fn){return new Promise((res,rej)=>{if(!db)return rej(new Error('kein Speicher'));const tx=db.transaction('img',mode);const rq=fn(tx.objectStore('img'));tx.oncomplete=()=>res(rq&&rq.result);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);});}
const idbPut=(k,b)=>idbTx('readwrite',s=>s.put(b,k));
const idbDel=k=>idbTx('readwrite',s=>s.delete(k));
const idbClear=()=>idbTx('readwrite',s=>s.clear());
function idbAll(){return new Promise((res,rej)=>{if(!db)return res({});const out={};const tx=db.transaction('img');const rq=tx.objectStore('img').openCursor();rq.onsuccess=()=>{const c=rq.result;if(c){out[c.key]=c.value;c.continue();}else res(out);};rq.onerror=()=>rej(rq.error);});}
async function putImg(id,blob){
  BLOBS[id]=blob;if(IMG[id])URL.revokeObjectURL(IMG[id]);IMG[id]=URL.createObjectURL(blob);
  try{await idbPut(id,blob);}catch(e){toast('Bild konnte nicht dauerhaft gespeichert werden');}
}
async function delImg(id){delete BLOBS[id];if(IMG[id]){URL.revokeObjectURL(IMG[id]);delete IMG[id];}try{await idbDel(id);}catch(e){}}
async function fileToBlob(file,maxSide){
  maxSide=maxSide||520;
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Bild nicht lesbar'));i.src=url;});
    const sc=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
    const w=Math.max(1,Math.round(img.naturalWidth*sc)),h=Math.max(1,Math.round(img.naturalHeight*sc));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
    return await new Promise(res=>c.toBlob(res,'image/jpeg',0.86));
  }finally{URL.revokeObjectURL(url);}
}
async function packImageBlob(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Bild nicht lesbar'));i.src=url;});
    const sc=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));
    const w=Math.max(1,Math.round(img.naturalWidth*sc)),h=Math.max(1,Math.round(img.naturalHeight*sc));
    const c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d');g.drawImage(img,0,0,w,h);
    const id=g.getImageData(0,0,w,h);
    const box=cutoutBlack(id.data,w,h)||[0,0,w,h];
    g.putImageData(id,0,0);
    const bw=box[2]-box[0],bh=box[3]-box[1],k=Math.min(1,640/bh);
    const o=document.createElement('canvas');o.width=Math.max(1,Math.round(bw*k));o.height=Math.max(1,Math.round(bh*k));
    o.getContext('2d').drawImage(c,box[0],box[1],bw,bh,0,0,o.width,o.height);
    return await new Promise(res=>o.toBlob(res,'image/webp',0.88));
  }finally{URL.revokeObjectURL(url);}
}
const STARTER=[
  ['🦊','Fuchs','n','#ff9a4d'],['🐢','Schildkröte','n','#5dc27a'],['🐙','Oktopus','n','#e5679a'],['🦉','Eule','n','#a98467'],
  ['🐧','Pinguin','n','#5aa9e6'],['🐬','Delfin','n','#4f86f7'],['🐼','Panda','n','#8e9aaf'],['🐸','Frosch','s','#7bc950'],
  ['🦋','Schmetterling','s','#b57bee'],['🦁','Löwe','s','#f2b134'],['🦄','Einhorn','e','#ff7fc8'],['🐉','Drache','l','#e5483d']
];
function starterBlob(emoji,color){
  const c=document.createElement('canvas');c.width=360;c.height=504;const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,360,504);gr.addColorStop(0,color);gr.addColorStop(1,'#0f2144');
  g.fillStyle=gr;g.fillRect(0,0,360,504);
  g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.roundRect(28,28,304,380,22);g.fill();
  g.font='190px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.fillStyle='#000';g.fillText(emoji,180,218);
  return new Promise(res=>c.toBlob(res,'image/jpeg',0.88));
}

/* ================= Zustand der Oberfläche ================= */
const ui={view:'home',selMode:false,cardSel:[],setupErr:'',lockErr:'',lockPin:false,sm:'p',sg:'d',unit:[],catOpen:'',pscope:'one',unlocked:false,sec:'vocab',vtext:'',vunit:'',openUnit:'',imprar:'n',modal:null,confirm:null,busy:'',pack:null,pendingImport:null,pinErr:'',lf:[],ls:{col:'f',dir:1},cats:false};
let Q=null,deferredInstall=null,confirmT,rec=null;

/* ================= Hilfe ================= */
const HELP={
  home:['Lernen',[
    'Sprache: Oben wählst du die Sprache im Auswahlfeld. Jede Sprache hat eigene Punkte, Karten und Päckchen.',
    'Päckchen: Sammle Punkte beim Lernen. Ist das Punkteziel erreicht, kannst du ein Päckchen öffnen und bekommst Karten für dein Album.',
    'Serie: Zeigt, an wie vielen Tagen hintereinander du gelernt hast. Bei aktiver Serie leuchtet der Start-Button. Erreichst du ein Serienziel, wartet eine Belohnung.',
    'Kategorien: Wähle eine oder mehrere Kategorien aus, oder lass dich über „Alle Wörter“ abfragen. Ein Wort kann in mehreren Kategorien stehen.',
    'Schreiben / Sprechen: Beim Schreiben tippst du die Antwort, beim Sprechen sagst du sie laut (braucht Mikrofon).',
    '10 / 20 / 30: So viele Wörter hat eine Lerneinheit.',
    'Lernen starten: Beginnt die Runde. Falsche Wörter kommen öfter wieder, gewusste seltener.',
    'Pause: Nach einigen Runden erscheint „Mach mal Pause!“. Mit dem Eltern-PIN lässt sie sich vorzeitig beenden.']],
  quiz:['Lernrunde',[
    'Lies das Wort oben und gib die Übersetzung ein. Mit „Prüfen“ siehst du, ob es stimmt.',
    'Kleine Tippfehler werden erkannt und als richtig gewertet.',
    'Falsche Wörter kommen in der Runde noch einmal vor.',
    'Richtige Antworten bringen Punkte für das nächste Päckchen.']],
  list:['Vokabeln',[
    'Hier siehst du alle Wörter der gewählten Sprache.',
    'Kategorien: Mit dem Auswahlfeld filterst du die Liste. Du kannst mehrere Kategorien wählen, es erscheinen alle Wörter, die in mindestens einer davon stehen.',
    'Stand: Zeigt, wie gut du ein Wort kannst. Keine Balken = noch neu. Je mehr Balken, desto sicherer; grüne Balken heißen sicher gelernt. Falsche Antworten setzen den Stand zurück.',
    'Sortieren: Tippe auf eine Spaltenüberschrift (auch „Kategorie“ und „Stand“). Nochmal tippen dreht die Reihenfolge um.',
    'Die Liste dient zum Nachschlagen und Üben. Bearbeiten können nur die Eltern im Elternbereich.']],
  album:['Album',[
    'Hier siehst du alle Karten, die du in der ausgewählten Sprache schon gesammelt hast.',
    'Tippe auf eine Karte, um sie groß zu sehen.',
    'Oben steht, wie viele Karten du schon hast.',
    'Fehlen Bilder, können die Eltern sie im Elternbereich unter „Karten“ wiederherstellen.']],
  stats:['Statistik',[
    'Wörter: Anzahl aller Vokabeln in dieser Sprache.',
    'Sicher gelernt: Wörter, die du mehrmals hintereinander richtig hattest und die nur noch selten abgefragt werden.',
    'Heute dran: Wörter, die jetzt zur Wiederholung fällig sind. Neue und falsch beantwortete Wörter kommen früh wieder.',
    'Richtig: Anteil richtiger Antworten an allen bisherigen Antworten (in Prozent).',
    'Karten: Gesammelte Karten von allen Karten im Album.',
    'Serie: Tage in Folge, an denen du gelernt hast. In Klammern steht dein Rekord.',
    'Diese Woche / Dieser Monat: Punkte, Lernzeit und Lerntage (Tage mit Lernen). Die Woche geht von Montag bis Sonntag, der Monat ist der Kalendermonat.',
    'Verlauf: Diagramm der Punkte oder der Lernzeit in Minuten. Mit Tage / Wochen wählst du die letzten 14 Tage oder 12 Wochen. Der aktuelle Balken ist kräftiger.',
    'Wissensstand: Balken mit Sicher, Lerne ich und Neu. „Neu“ sind Wörter, die noch nie abgefragt wurden.',
    'Knifflige Wörter: Die 5 Wörter mit den meisten Fehlern, mit der Zahl der Fehler.',
    'Jede Sprache hat ihre eigene Statistik.']],
  options:['Optionen',[
    'Farbschema: Wähle in der Liste dein Lieblingsdesign.',
    'Kartenrücken: Wische oder tippe auf ‹ ›, und tippe auf einen Rücken, um ihn zu wählen. So sehen Karten im Päckchen aus.',
    'Einstellungen gelten für dieses Gerät.']],
  parent:['Elternbereich',[
    'Der Bereich ist mit einer PIN geschützt. „Sperren“ schließt ihn wieder.',
    'Alle Sprachen / Einzelne Sprache: Bei „Alle Sprachen“ gelten Punkte & Abfrage für jede Sprache. Bei „Einzelne Sprache“ wählst du im Dropdown die Sprache und kannst deren Vokabeln, Karten und Belohnungen bearbeiten.',
    'Tippe auf einen Abschnitt, um ihn zu öffnen. Bei jedem Abschnitt gibt es eine eigene Hilfe.',
    'Einmal im Monat sollte unter „Sicherung & PIN“ eine Sicherung gespeichert werden.']],
  lang:['Sprachen',[
    'Lege hier Sprachen an, z. B. „Französisch“.',
    'Jede Sprache hat eigene Vokabeln, Punkte, Karten und Statistik.',
    'Löschen entfernt die Sprache mit allen Daten. Dafür zweimal tippen.']],
  vocab:['Vokabeln (Eltern)',[
    'Füge Wörter ein, eine Zeile pro Wort im Format „Fremdwort = Deutsch“.',
    'Tags: Mit Tags (#Tiere, #Verben …) gruppierst du Wörter. Ein Wort darf mehrere Tags haben. Im Feld „Tags für die neuen Wörter“ stehen die Tags für Zeilen ohne eigenen Tag.',
    'Import mit Tags: Schreibe sie ans Zeilenende, z. B. „to eat = essen #Essen #Verben“. Eine Zeile „# Tagname“ gilt für alle folgenden Zeilen ohne eigenen Tag.',
    'Vorhandene Tags: „Ansehen“ zeigt die Wörter, „Umbenennen“ benennt einen Tag um (gleiche Namen werden zusammengelegt). „Löschen“ entfernt den Tag; Wörter, die nur diesen Tag hatten, werden gelöscht.',
    'Wort bearbeiten: Tippe auf ✎. Tags kannst du eintippen oder aus der Liste antippen.',
    'Ein Wort mit gleichem Paar wird nicht doppelt angelegt, sondern bekommt die neuen Tags dazu.',
    'Mehrere richtige Antworten trennst du mit „/“.']],
  cards:['Karten',[
    'Bilder importieren: Aus der Galerie (mehrere auswählen) oder als ZIP-Datei mit vielen Bildern.',
    'Dateiname = Kartenname. Erneutes Importieren mit gleichem Namen ergänzt fehlende Bilder.',
    'Seltenheit: Wähle vor dem Import, wie selten die Karten sind.',
    'Päckchenbild: Eigenes Bild für das Päckchen.',
    'Doppelte zusammenführen: Fasst gleichnamige Karten zusammen.',
    'Markieren: Wähle mehrere Karten aus und lösche sie gesammelt.',
    'Karte antippen: Name, Seltenheit und Bild bearbeiten.']],
  prizes:['Spezielle Belohnungen',[
    'Lege eigene Belohnungen als Text an, z. B. „Eis essen“.',
    'Sie können als Preise für Päckchen oder Serien verwendet werden.',
    'Im Album erscheinen sie als besondere Karten.']],
  streak:['Serien-Belohnung',[
    'Länge einer Serie: Nach so vielen Tagen in Folge gibt es die Belohnung.',
    'Belohnung: Päckchen, Big-Pack (5 Karten), Mega-Pack (7 Karten), Epic-Pack (3 epische Karten), Legend-Pack (1 legendäre Karte) oder eine spezielle Belohnung.',
    'Nächste Serie: Eine eigene Belohnung, die einmalig die Standard-Belohnung ersetzt.',
    'Die Belohnung geht an die Sprache, mit der zuletzt geübt wurde.']],
  pomo:['Lernpause',[
    'Nach der eingestellten Lernzeit sperrt die App nach der Runde für eine Pause („Mach mal Pause!“).',
    'Lernzeit, Pausenlänge und Leerlauf-Zeit lassen sich einstellen.',
    'Die Pause läuft mit Serverzeit weiter, auch wenn die App geschlossen ist.',
    'Entsperren geht nur mit dem Eltern-PIN.',
    'Testen: Mit dem Testknopf siehst du die Pause sofort.']],
  reward:['Punkte & Abfrage',[
    'Punkte pro Päckchen: So viele Punkte braucht man für ein Päckchen.',
    'Punkte pro richtiger Antwort: Wie viele Punkte eine richtige Antwort bringt.',
    'Karten pro Päckchen: Wie viele Karten ein Päckchen enthält.',
    'Abfrage beim Schreiben: Richtung der Abfrage (Fremdwort → Deutsch, Deutsch → Fremdwort oder gemischt).',
    'Spracherkennung: Sprache für den Sprechen-Modus, meist automatisch.',
    '1 Päckchen schenken: Gibt der Sprache sofort ein Päckchen.']],
  backup:['Sicherung & PIN',[
    'App installieren: Legt die App als Symbol auf dem Startbildschirm an.',
    'Sicherung speichern: Erstellt eine Datei mit Wörtern, Karten, Bildern und Fortschritt. Bitte regelmäßig machen und sicher aufbewahren.',
    'Sicherung laden: Stellt eine Sicherung wieder her, z. B. nach Löschen der Browserdaten oder auf einem neuen Handy. Vorhandene Daten werden ersetzt.',
    'PIN ändern: Neue PIN (4 bis 8 Ziffern) für Elternbereich und Pausen-Entsperrung.']]
};
function helpBtn(k){return `<button class="btn small helpb" data-a="help" data-k="${k}" aria-label="Hilfe">? Hilfe</button>`;}
function helpModal(k){
  const e=HELP[k]||HELP.home;
  return `<div class="modal" data-a="backdrop"><div class="mbox"><h3>${esc(e[0])}</h3><ul class="helplist">${e[1].map(t=>{const i=t.indexOf(': ');return `<li>${i>0&&i<28?`<b>${esc(t.slice(0,i))}</b>: ${esc(t.slice(i+2))}`:esc(t)}</li>`;}).join('')}</ul>
  <button class="btn primary block" data-a="close-modal">Schließen</button></div></div>`;
}

/* ================= Ansichten ================= */
function langChips(noHelp){
  if(!S.langs.length) return '';
  const open=ui.catOpen==='lang',cur=curLang();
  return `<div class="catdrop"><div class="row" style="flex-wrap:nowrap"><button class="themesel grow" data-a="cat-open" data-k="lang" aria-expanded="${open}"><span class="grow">${esc(cur.name)}</span><span>${open?'▲':'▼'}</span></button>${noHelp?'':helpBtn(ui.view)}</div>
  ${open?`<div class="themelist">${S.langs.map(l=>`<button class="theme ${l.id===cur.id?'on':''}" data-a="lang" data-id="${l.id}">${esc(l.name)}</button>`).join('')}</div>`:''}</div>`;
}
function scopeBar(){
  if(!S.langs.length)return '';
  const one=ui.pscope!=='all';
  return `<div class="seg" role="group" aria-label="Einstellungen für" style="margin:8px 0"><button class="${!one?'on':''}" data-a="pscope" data-v="all">Alle Sprachen</button><button class="${one?'on':''}" data-a="pscope" data-v="one">Einzelne Sprache</button></div>${one?langChips(true):''}`;
}
function langTabs(){
  if(!S.langs.length) return '';
  return `<div class="chips" role="tablist">${S.langs.map(l=>`<button class="chip ${l.id===curLang().id?'on':''}" data-a="lang" data-id="${l.id}">${esc(l.name)}</button>`).join('')}</div>`;
}
const packCount=L=>(L.packs||0)+((L.sp||[]).length);
function streakNow(){const s=S.streak;if(!s||!s.last)return 0;return (s.last===dateKey(0)||s.last===dateKey(-1))?s.count:0;}

function catDrop(key,sel,units,allLabel){
  const open=ui.catOpen===key,cb=on=>`<span class="cb ${on?'on':''}">${on?'✓':''}</span>`;
  const label=!sel.length?allLabel:sel.length<=2?sel.join(', '):sel.length+' Kategorien';
  return `<div class="catdrop"><button class="themesel" data-a="cat-open" data-k="${key}" aria-expanded="${open}"><span class="grow">${esc(label)}</span><span>${open?'▲':'▼'}</span></button>
  ${open?`<div class="themelist"><button class="theme ${!sel.length?'on':''}" data-a="cat-pick" data-k="${key}" data-u="">${cb(!sel.length)}${allLabel}</button>${units.map(u=>`<button class="theme ${sel.includes(u)?'on':''}" data-a="cat-pick" data-k="${key}" data-u="${esc(u)}">${cb(sel.includes(u))}${esc(u)}</button>`).join('')}</div>`:''}</div>`;
}
function vHome(){
  const L=curLang();
  if(!L) return `<div class="panel center"><h2>Willkommen!</h2><p class="muted">Lege im Elternbereich eine Sprache an.</p><button class="btn primary" data-a="nav" data-v="parent">Zum Elternbereich</button></div>`;
  const now=Date.now(),total=L.vocab.length;
  const units=unitsOf(L);ui.unit=ui.unit.filter(u=>units.includes(u));
  const pool=ui.unit.length?L.vocab.filter(w=>tagsOf(w).some(t=>ui.unit.includes(t))).length:total;
  const n=Math.min(L.sessionSize,pool);
  const pct=Math.min(100,Math.round(L.points/L.goal*100));
  const st=streakNow(),nextT=(S.streakCfg.def.active||S.streakCfg.nextRid||S.streakCfg.nextPack)?nextStreakTarget(st,S.streakCfg.days):0;
  return `${langChips()}
  <div class="panel">
    <div class="packbox">
      <div class="packimg">${packPic()}${packCount(L)>0?`<span class="badge">${packCount(L)}</span>`:''}</div>
      <div class="grow">
        <h3>${packCount(L)>0?(packCount(L)===1?'1 Päckchen wartet!':packCount(L)+' Päckchen warten!'):'Nächstes Päckchen'}</h3>
        <div class="bar gold" aria-label="Fortschritt"><i style="width:${pct}%"></i></div>
        <p class="note" style="margin:6px 0 0">Noch ${L.goal-L.points} Punkte bis zum nächsten Päckchen</p>
      </div>
    </div>
    ${packCount(L)>0?`<button class="btn gold block" style="margin-top:12px" data-a="open-pack">Päckchen öffnen</button>`:''}
  </div>
  <div class="panel ${st>0?'streak':''}"><div class="row" style="flex-wrap:nowrap"><span class="flame" style="${st>0?'':'color:var(--muted);filter:none'}">${ICON_FLAME}</span><div class="grow"><b>${st>0?`Du hast ${st} ${st===1?'Tag':'Tage'} hintereinander Vokabeln gelernt!`:'Starte heute eine neue Serie!'}</b>${st>0&&nextT?`<div class="note">Nächste Serien-Belohnung nach ${nextT} Tagen</div>`:''}</div></div></div>
  ${total?`
  ${units.length>1?catDrop('home',ui.unit,units,'Alle Wörter'):''}
  <div class="seg" role="group" aria-label="Übungsart">
    <button class="${S.mode==='write'?'on':''}" data-a="mode" data-m="write">${ICON_PEN} Schreiben</button>
    <button class="${S.mode==='speak'?'on':''}" data-a="mode" data-m="speak">${ICON_MIC} Sprechen</button>
  </div>
  <div class="seg seg3" role="group" aria-label="Wörter pro Lerneinheit">${[10,20,30].map(k=>`<button class="${L.sessionSize===k?'on':''}" data-a="size" data-n="${k}">${k} Wörter</button>`).join('')}</div>
  ${S.mode==='speak'&&!SRClass()?`<p class="note">Auf diesem Gerät gibt es keine Spracherkennung. Du sagst das Wort laut und bewertest dich danach selbst.</p>`:''}
  <div style="height:var(--startgap,100px)"></div>
  <div class="startbar"><button class="btn primary block ${st>0?'streakon':''}" style="font-size:22px;min-height:96px" data-a="start">Lernen starten</button></div>`
  :`<div class="panel center"><h3>Noch keine Vokabeln</h3><p class="muted">Mama oder Papa tragen sie im Elternbereich ein.</p><button class="btn primary" data-a="nav" data-v="parent">Zum Elternbereich</button></div>`}`;
}

function barChart(ser,metric){
  const n=ser.length,W=340,H=176,top=22,bot=40,ch=H-top-bot;
  const val=x=>metric==='p'?x.p:x.s/60;
  const mx=Math.max(1,...ser.map(val)),bw=W/n,w=Math.min(bw*.62,34);
  const lbl=x=>{const v=val(x);if(metric==='p')return v>0?String(v):'';return x.s<=0?'':(v<1?'<1':String(Math.round(v)));};
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf">
  <line x1="0" x2="${W}" y1="${top+ch}" y2="${top+ch}" stroke="var(--line)" stroke-width="2"/>
  ${ser.map((x,i)=>{const v=val(x),bh=v>0?Math.max(4,v/mx*ch):0,cx=bw*i+bw/2,y=top+ch-bh;
    return `${bh?`<rect x="${(cx-w/2).toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="var(--accent)" opacity="${x.cur?1:.55}"/>`:''}
    <text x="${cx.toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="var(--ink)">${lbl(x)}</text>
    <text x="${cx.toFixed(1)}" y="${top+ch+16}" text-anchor="middle" font-size="${n>10?9.5:11}" font-weight="800" fill="${x.cur?'var(--ink)':'var(--muted)'}">${x.lab}</text>
    <text x="${cx.toFixed(1)}" y="${top+ch+30}" text-anchor="middle" font-size="${n>10?8.5:10}" fill="var(--muted)">${x.sub}</text>`;}).join('')}
  </svg>`;
}
function periodPanel(title,t){
  return `<div class="panel"><h3>${title}</h3><div class="stats" style="margin:8px 0 0">
  <div class="stat"><b>${t.p}</b><span>Punkte</span></div>
  <div class="stat"><b style="font-size:19px">${fmtDur(t.s)}</b><span>Lernzeit</span></div>
  <div class="stat"><b>${t.days}</b><span>Lerntage</span></div></div></div>`;
}
function vStats(){
  const L=curLang();
  if(!L) return `<div class="panel center"><p>Noch keine Sprache angelegt.</p></div>`;
  const now=new Date(),nowMs=Date.now(),log=L.log||(L.log={});
  const total=L.vocab.length,dueN=L.vocab.filter(w=>w.due<=nowMs).length,known=L.vocab.filter(w=>w.box>=4&&w.seen>0).length,fresh=L.vocab.filter(w=>!(w.seen>0)).length,learn=total-known-fresh;
  const rt=L.vocab.reduce((a,w)=>a+(w.right||0),0),wr=L.vocab.reduce((a,w)=>a+(w.wrong||0),0);
  const quote=rt+wr?Math.round(rt/(rt+wr)*100)+' %':'–';
  const have=L.cards.filter(c=>L.owned[c.id]>0).length;
  const [w0,w1]=weekRange(now),[m0,m1]=monthRange(now);
  const wk=logSum(log,w0,w1),mo=logSum(log,m0,m1);
  const ser=ui.sg==='w'?seriesWeeks(log,now,12):seriesDays(log,now,14);
  const pc=n=>total?Math.round(n/total*100):0;
  const hard=L.vocab.filter(w=>(w.wrong||0)>0).sort((a,b)=>(b.wrong||0)-(a.wrong||0)).slice(0,5);
  const stt=streakNow(),best=Math.max(S.streak.best||0,stt);
  return `${langChips()}<h2>Statistik</h2>
  <div class="stats">
    <div class="stat"><b>${total}</b><span>Wörter</span></div>
    <div class="stat"><b>${known}</b><span>sicher gelernt</span></div>
    <div class="stat"><b>${dueN}</b><span>heute dran</span></div>
    <div class="stat"><b>${quote}</b><span>richtig</span></div>
    <div class="stat"><b>${have}/${L.cards.length}</b><span>Karten</span></div>
    <div class="stat ${stt>0?'streakon':''}"><b>${stt}</b><span>Serie (Rekord ${best})</span></div>
  </div>
  ${periodPanel('Diese Woche <span class="muted sm">Mo–So</span>',wk)}
  ${periodPanel('Dieser Monat <span class="muted sm">'+MONTHS[now.getMonth()]+'</span>',mo)}
  <div class="panel"><h3>Verlauf</h3>
    <div class="seg" role="group" aria-label="Kennzahl" style="margin:8px 0"><button class="${ui.sm==='p'?'on':''}" data-a="sm" data-v="p">Punkte</button><button class="${ui.sm==='s'?'on':''}" data-a="sm" data-v="s">Lernzeit (Min.)</button></div>
    <div class="seg" role="group" aria-label="Zeitraum" style="margin:8px 0"><button class="${ui.sg==='d'?'on':''}" data-a="sg" data-v="d">Tage</button><button class="${ui.sg==='w'?'on':''}" data-a="sg" data-v="w">Wochen</button></div>
    ${barChart(ser,ui.sm)}
    <p class="note center">${ui.sg==='w'?'Letzte 12 Wochen':'Letzte 14 Tage'} · aktueller ${ui.sg==='w'?'Woche':'Tag'} kräftig</p></div>
  <div class="panel"><h3>Wissensstand</h3>
    <div class="stack" role="img" aria-label="Neu ${fresh}, Lerne ich ${learn}, Sicher ${known}"><i style="width:${pc(known)}%;background:var(--good)"></i><i style="width:${pc(learn)}%;background:var(--accent)"></i><i style="width:${pc(fresh)}%;background:var(--line)"></i></div>
    <div class="legend"><span><i style="background:var(--good)"></i>Sicher ${known}</span><span><i style="background:var(--accent)"></i>Lerne ich ${learn}</span><span><i style="background:var(--line)"></i>Neu ${fresh}</span></div></div>
  ${hard.length?`<div class="panel"><h3>Knifflige Wörter</h3>${hard.map(w=>`<div class="urow"><div class="t"><b>${esc(w.f)}</b><div class="note">${esc(w.d)}</div></div><span class="pill gold">${w.wrong}× falsch</span></div>`).join('')}</div>`:''}`;
}
function lvl(w){const n=wLevel(w),t=n===0?'Neu':['','Anfang','Übung','Gut','Sicher','Sehr sicher'][n];return `<span class="lvl" role="img" aria-label="${t}" title="${t}">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}${n>=4&&i<=n?' top':''}"></i>`).join('')}</span>`;}
function vList(){
  const L=curLang();
  if(!L) return `<div class="panel center"><p>Noch keine Sprache angelegt.</p></div>`;
  const units=unitsOf(L);ui.lf=ui.lf.filter(u=>units.includes(u));
  const ws=sortWords(L.vocab.filter(w=>!ui.lf.length||tagsOf(w).some(t=>ui.lf.includes(t))),ui.ls.col,ui.ls.dir);
  const ar=c=>ui.ls.col===c?(ui.ls.dir>0?' ▲':' ▼'):'';
  return `<div class="row"><h2 class="grow" style="margin:0">Vokabeln</h2><span class="pill">${ws.length} Wörter</span></div>
  <div style="height:10px"></div>${langChips()}
  ${L.vocab.some(w=>tagsOf(w).includes('Beispiel'))?'<p class="note">Das sind nur Beispielwörter. Mama oder Papa können sie im Elternbereich löschen.</p>':''}
  ${units.length>1?catDrop('list',ui.lf,units,'Alle Kategorien'):''}
  <div class="panel lt">
    <div class="lrow lhead"><button class="c-f" data-a="list-sort" data-c="f">${esc(L.name)}${ar('f')}</button><button class="c-d" data-a="list-sort" data-c="d">Deutsch${ar('d')}</button><button class="c-u" data-a="list-sort" data-c="u">Kategorie${ar('u')}</button><button class="c-s" data-a="list-sort" data-c="k">Stand${ar('k')}</button></div>
    ${ws.length?ws.map(w=>`<div class="lrow"><b class="c-f">${esc(w.f)}</b><span class="c-d">${esc(w.d)}</span><span class="c-u muted sm">${tagsOf(w).map(esc).join(', ')}</span>${lvl(w).replace('class="lvl"','class="lvl c-s"')}</div>`).join(''):'<div class="lrow"><span class="muted">Keine Wörter.</span></div>'}
  </div>`;
}

function qLabel(L,dir,speak){
  if(speak) return 'Sage auf '+esc(L.name)+':';
  return dir==='f2d'?'Wie heißt das auf Deutsch?':'Wie heißt das auf '+esc(L.name)+'?';
}
function vQuiz(){
  const L=curLang(),it=Q.phase==='fb'?Q.last:Q.queue[0],w=L.vocab.find(x=>x.id===it.id);
  const speak=Q.mode==='speak',hasSR=!!SRClass();
  const q=it.dir==='f2d'?w.f:w.d,ans=it.dir==='f2d'?w.d:w.f;
  const pct=Math.round((Q.total-Q.queue.length)/Q.total*100);
  let body;
  if(Q.phase==='ask'&&!speak){
    body=`<div class="field"><input id="ans" class="in ans" type="text" inputmode="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Antwort eintippen"></div>
    <button class="btn primary block" style="min-height:60px;font-size:19px" data-a="check">Prüfen</button>
    <div class="row" style="margin-top:10px"><button class="btn small grow" data-a="hint">Tipp</button><button class="btn small grow" data-a="skip">Weiß ich nicht</button></div>`;
  }else if(Q.phase==='ask'&&speak&&hasSR){
    body=`<button class="mic ${Q.listening?'on':''}" data-a="listen" aria-label="Sprechen">${ICON_MIC}</button>
    <p class="center ${Q.speechMsg?'':'muted'}" style="font-weight:700">${Q.listening?'Ich höre zu … Sprich jetzt!':(esc(Q.speechMsg)||'Tippe aufs Mikrofon und sag das Wort.')}</p>
    <div class="row"><button class="btn small grow" data-a="hint">Tipp</button><button class="btn small grow" data-a="skip">Weiß ich nicht</button></div>`;
  }else if(Q.phase==='ask'&&speak){
    body=`<p class="center muted">Sag das Wort laut. Dann zeige die Lösung und bewerte dich ehrlich.</p>
    <button class="btn primary block" style="min-height:60px;font-size:19px" data-a="show-answer">Lösung zeigen</button>`;
  }else if(Q.phase==='reveal'){
    body=`<div class="fb almost"><div class="muted" style="font-weight:700">Richtig ist:</div><div class="corr">${esc(ans)}</div></div>
    <div class="row"><button class="btn primary grow" data-a="self-yes">Hab ich gewusst</button><button class="btn grow" data-a="self-no">Nicht gewusst</button></div>`;
  }else{
    const f=Q.fb;
    const t=f.kind==='right'?(f.retry?'Richtig, gut gemerkt!':'Richtig!'):f.kind==='almost'?'Fast richtig!':'Leider nicht.';
    const sub=f.kind==='right'?(f.pts?`+${f.pts} Punkte${f.hinted?' (mit Tipp)':''}`:''):
      (f.dropped?'Das üben wir später weiter.':'Das Wort kommt gleich nochmal.');
    body=`<div class="fb ${f.kind}"><h3>${t}</h3>${f.heard?`<div class="muted" style="font-weight:700">Verstanden: „${esc(f.heard)}“</div>`:''}${f.kind!=='right'?`<div class="muted" style="font-weight:700">Richtig ist:</div><div class="corr">${esc(ans)}</div>`:''}${sub?`<div style="margin-top:6px">${sub}${f.kind==='almost'&&f.pts?` · +${f.pts} Punkte`:''}</div>`:''}</div>
    <button id="nextbtn" class="btn primary block" style="min-height:60px;font-size:19px" data-a="next">${Q.queue.length?'Weiter':'Fertig'}</button>`;
  }
  return `<div class="qtop"><button class="icon-btn" data-a="quit" aria-label="Beenden">✕</button><div class="bar grow"><i style="width:${pct}%"></i></div><span class="pill">+${Q.earned}</span></div>
  <div class="qcard"><div class="qlabel">${qLabel(L,it.dir,speak)}</div><div class="qword">${esc(q)}</div>${Q.phase==='ask'&&Q.hint>0?`<div class="qhint">${esc(hintText(ans,Q.hint))}</div>`:''}</div>${body}`;
}

function vSummary(){
  const L=curLang();const pct=Math.min(100,Math.round(L.points/L.goal*100));
  const good=Q.rightFirst/Q.total>=0.8;
  return `<div class="panel center"><div class="big">${Q.rightFirst}/${Q.total}</div>
  <h2>${good?'Super gemacht!':'Gut geübt!'}</h2><p class="muted">So viele Wörter hast du gleich beim ersten Mal gewusst.</p>
  <p><span class="pill gold">+${Q.earned} Punkte</span></p>
  ${Q.packs?`<div class="packimg" style="margin:6px auto 12px">${packPic()}<span class="badge">${Q.packs}</span></div><p><b>${Q.packs===1?'Du hast ein neues Päckchen verdient!':'Du hast '+Q.packs+' neue Päckchen verdient!'}</b></p>`:''}
  <div class="bar gold" style="margin:12px 0 6px"><i style="width:${pct}%"></i></div>
  <p class="note">Noch ${L.goal-L.points} Punkte bis zum nächsten Päckchen</p></div>
  ${Q.streakAwards&&Q.streakAwards.length?`<div class="panel center"><h3>Serien-Belohnung!</h3>${Q.streakAwards.map(a=>`<p style="margin:4px 0"><b>${a.days} Tage in Folge:</b> ${a.kind==='pack'?(a.label?(a.packs===1?a.label:a.packs+'× '+a.label):(a.packs===1?'1 Päckchen':a.packs+' Päckchen')):esc(a.text)}</p>`).join('')}</div>`:''}
  ${packCount(L)>0?`<button class="btn gold block" data-a="open-pack">Päckchen öffnen (${packCount(L)})</button>`:''}
  <div class="row" style="margin-top:10px"><button class="btn block grow" data-a="start">Nochmal</button><button class="btn primary block grow" data-a="nav" data-v="home">Fertig</button></div>`;
}

function cardFace(c,isNew,count){
  const r=rar(c.rarity);
  if(c.kind==='reward') return `<div class="tcard rw r-${r.k}"><span class="rl">Belohnung</span><span class="rt">${esc(c.text)}</span><span class="st">${'★'.repeat(r.stars)}</span>${isNew?'<span class="new">NEU</span>':''}</div>`;
  return `<div class="tcard r-${r.k}"><img src="${IMG[c.id]||''}" alt="${esc(c.name)}">${isNew?'<span class="new">NEU</span>':''}${count>1?`<span class="badge cnt">×${count}</span>`:''}<div class="cap"><div>${esc(c.name)}</div><span>${'★'.repeat(r.stars)}</span></div></div>`;
}
function packActions(){
  const P=ui.pack,L=curLang(),all=P.items.every(i=>i.on);
  return all?`<div class="row" style="margin-top:6px">${packCount(L)>0?`<button class="btn gold grow" data-a="open-pack">Nächstes Päckchen (${packCount(L)})</button>`:''}<button class="btn primary grow" data-a="nav" data-v="album">Zum Album</button></div>`
  :`<button class="btn block" data-a="flip-all">Alle aufdecken</button>`;
}
function vPack(){
  const P=ui.pack,all=P.items.every(i=>i.on);
  if(!P.opened) return `<h2 class="center">Dein ${esc(P.name||'Päckchen')}</h2><p class="center muted">Tippe aufs Päckchen, um es zu öffnen.</p>
  <button class="packbig" data-a="tear" aria-label="Päckchen öffnen">${packPic()}</button>`;
  return `<h2 class="center">Dein ${esc(P.name||'Päckchen')}</h2><p class="center muted" id="packhint">${all?'Das sind deine neuen Karten!':'Tippe auf die Karten zum Aufdecken.'}</p>
  <div class="packgrid">${P.items.map((it,i)=>`<button class="flip ${it.on?'on':''} ${it.card.kind==='reward'||it.card.rarity==='e'||it.card.rarity==='l'?'hi':''}" data-a="flip" data-i="${i}" aria-label="Karte ${i+1}"><div class="flip-in"><div class="face back" style="background:url(backs/${S.cardBack}.svg) center/cover no-repeat"></div><div class="face front">${cardFace(it.card,it.isNew)}</div></div></button>`).join('')}</div>
  <div id="packact">${packActions()}</div>`;
}

function vAlbum(){
  const L=curLang();
  if(!L) return `<div class="panel center"><p>Noch keine Sprache angelegt.</p></div>`;
  const have=L.cards.filter(c=>L.owned[c.id]>0).length;
  const wins=L.wins.slice().reverse();
  return `${langChips()}<div class="row spread"><h2>Album</h2><span class="pill">${have} / ${L.cards.length} Karten</span></div>
  ${missingImgs(L)?`<div class="panel"><p style="margin:0"><b>Bei ${missingImgs(L)} Karten fehlt das Bild.</b> Mama oder Papa können es im Elternbereich unter „Karten“ wiederherstellen.</p></div>`:''}
  ${wins.length?`<div class="panel"><h3>Meine Belohnungen</h3>${wins.map(w=>`<div class="urow"><div class="t"><b>${esc(w.text)}</b><div class="note">${fmtDate(w.ts)} · ${winLabel(w)}</div></div><span class="pill ${w.redeemed?'ok':'gold'}">${w.redeemed?'eingelöst':'offen'}</span></div>`).join('')}</div>`:''}
  ${L.cards.length?`<div class="grid" style="margin-top:12px">${L.cards.map((c,i)=>{const n=L.owned[c.id]||0;
    return n>0?`<button class="tile" data-a="view-card" data-id="${c.id}">${cardFace(c,false,n)}</button>`
    :`<div class="tcard unk"><b>?<br><small>#${String(i+1).padStart(2,'0')}</small></b></div>`;}).join('')}</div>`
  :`<div class="panel center"><p><b>Hier sammelst du bald Karten!</b></p><p class="muted">Lerne Vokabeln, sammle Punkte und öffne Päckchen. Mama oder Papa fügen die Karten im Elternbereich hinzu.</p></div>`}`;
}

function secBtn(k,t){return `<button class="sechead ${ui.sec===k?'on':''}" data-a="sec" data-k="${k}"><span class="grow">${t}</span><span class="hq" data-a="help" data-k="${k}" role="button" aria-label="Hilfe">?</span><span>${ui.sec===k?'−':'+'}</span></button>`;}
function confBtn(key,label,cls,attrs){const on=ui.confirm===key;return `<button class="btn small ${on?'danger':cls||''}" ${attrs||''} data-a="${key.split(':')[0]}" data-key="${esc(key)}">${on?'Wirklich?':label}</button>`;}
const rarOptions=sel=>RARITIES.map(r=>`<option value="${r.k}" ${sel===r.k?'selected':''}>${r.label}</option>`).join('');

function vParent(){
  if(!ui.unlocked){
    if(!S.pinHash) return `<div class="panel"><h2>PIN festlegen</h2><p class="muted">Der Elternbereich ist mit einer PIN geschützt, damit nur ihr daran ändern könnt.</p>
      <div class="field"><label for="pin1">Neue PIN (4 bis 8 Ziffern)</label><input id="pin1" class="in" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></div>
      <div class="field"><label for="pin2">PIN wiederholen</label><input id="pin2" class="in" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></div>
      ${ui.pinErr?`<p style="color:var(--bad);font-weight:800">${esc(ui.pinErr)}</p>`:''}
      <button class="btn primary block" data-a="pin-set">PIN speichern</button></div>`;
    return `<div class="panel"><h2>Elternbereich</h2><p class="muted">Bitte PIN eingeben.</p>
      <div class="field"><input id="pin" class="in ans" type="password" inputmode="numeric" maxlength="8" autocomplete="off" aria-label="PIN"></div>
      ${ui.pinErr?`<p style="color:var(--bad);font-weight:800">${esc(ui.pinErr)}</p>`:''}
      <button class="btn primary block" data-a="pin-go">Entsperren</button></div>`;
  }
  const L=curLang();
  let h=`<div class="row spread"><h2>Elternbereich</h2><span class="row" style="gap:8px">${helpBtn('parent')}<button class="btn small" data-a="lock">Sperren</button></span></div>${scopeBar()}`;
  if(L&&(L.cards.length||L.vocab.length)&&(!S.lastBackup||Date.now()-S.lastBackup>14*864e5))h+=`<div class="busy">Die letzte Sicherung ist ${S.lastBackup?'älter als 14 Tage':'noch nicht gemacht'}. Bitte unter „Sicherung &amp; PIN“ eine Sicherung speichern, damit Karten und Fortschritt nicht verloren gehen.</div>`;
  h+=secBtn('lang','Sprachen');if(ui.sec==='lang')h+=pLang();
  if(ui.pscope==='all')h+=`<p class="note">Vokabeln, Karten und Spezielle Belohnungen gehören zu einer Sprache. Wähle dafür „Einzelne Sprache“.</p>`;
  else{
  h+=secBtn('vocab','Vokabeln');if(ui.sec==='vocab')h+=L?pVocab(L):noLang();
  h+=secBtn('cards','Karten');if(ui.sec==='cards')h+=L?pCards(L):noLang();
  h+=secBtn('prizes','Spezielle Belohnungen');if(ui.sec==='prizes')h+=L?pPrizes(L):noLang();
  }
  h+=secBtn('streak','Serien-Belohnung');if(ui.sec==='streak')h+=pStreak();
  h+=secBtn('pomo','Lernpause');if(ui.sec==='pomo')h+=pPomo();
  h+=secBtn('reward','Punkte &amp; Abfrage');if(ui.sec==='reward')h+=L?pReward(L):noLang();
  h+=secBtn('backup','Sicherung &amp; PIN');if(ui.sec==='backup')h+=pBackup();
  return h;
}
const sh=k=>`<div class="helprow in">${helpBtn(k)}</div>`;
const noLang=()=>`<div class="secbody"><p class="muted">Lege zuerst unter „Sprachen“ eine Sprache an.</p></div>`;
function pLang(){
  return `<div class="secbody"><div class="field"><label for="newlang">Neue Sprache</label><div class="row"><input id="newlang" class="in grow" placeholder="z. B. Französisch" maxlength="30"><button class="btn primary" data-a="add-lang">Anlegen</button></div></div>
  <p class="note">Jede Sprache hat ihre eigenen Vokabeln, Punkte und ihr eigenes Album.</p>
  ${S.langs.map(l=>`<div class="urow"><div class="t"><b>${esc(l.name)}</b><div class="note">${l.vocab.length} Wörter · ${l.cards.length} Karten</div></div>${confBtn('del-lang:'+l.id,'Löschen','')}</div>`).join('')}</div>`;
}
function pVocab(L){
  const units=unitsOf(L);
  return `<div class="secbody">
  <div class="field"><label for="vunit">Tags für die neuen Wörter</label><input id="vunit" class="in" data-input="vunit" value="${esc(ui.vunit)}" placeholder="z. B. #Möbel #Zuhause" maxlength="120"></div>
  <div class="field"><label for="vtext">Vokabeln, eine pro Zeile: Fremdwort = Deutsch</label><textarea id="vtext" class="in" rows="7" data-input="vtext" placeholder="dog = Hund&#10;to run = rennen&#10;trousers = Hose / Hosen">${esc(ui.vtext)}</textarea></div>
  <p class="note">Tags pro Wort: <b>dog = Hund #Tiere #Haustiere</b>. Mehrere Gruppen auf einmal: Zeile „# Tagname“ vor die Gruppe setzen.</p>
  <p class="note">Mehrere richtige Antworten trennst du mit „/“. Text in Klammern ist optional, z. B. „(to) go“.</p>
  <button class="btn primary block" data-a="add-vocab">Hinzufügen</button>
  <button class="subhead" data-a="toggle-cats" aria-expanded="${ui.cats}"><span>Vorhandene Tags (${units.length})</span><span>${ui.cats?'−':'+'}</span></button>
  ${!ui.cats?'':units.length?units.map(u=>{const ws=L.vocab.filter(w=>hasTag(w,u));const open=ui.openUnit===u;
    return `<div class="urow cat"><div class="t"><b>#${esc(u)}</b><div class="note">${ws.length} Wörter</div></div><button class="btn small" data-a="open-unit" data-u="${esc(u)}">${open?'Zuklappen':'Ansehen'}</button><button class="btn small" data-a="rename-unit" data-u="${esc(u)}">Umbenennen</button>${confBtn('del-unit:'+u,'Löschen','')}</div>
    ${open?ws.map(w=>`<div class="wrow"><div class="t">${esc(w.f)} = ${esc(w.d)}</div><button class="x edit" data-a="edit-word" data-id="${w.id}" aria-label="Wort bearbeiten">✎</button><button class="x" data-a="del-word" data-id="${w.id}" aria-label="Wort löschen">✕</button></div>`).join(''):''}`;}).join(''):'<p class="muted">Noch keine Vokabeln.</p>'}
  ${L.vocab.length?`<div style="margin-top:14px">${confBtn('reset-learn:x','Lernstand zurücksetzen','')}</div><p class="note">Setzt nur den Lernfortschritt der Wörter zurück. Punkte und Karten bleiben.</p>`:''}
  </div>`;
}
const missingImgs=L=>L.cards.filter(c=>!IMG[c.id]).length;
function pCards(L){
  const cnt=RARITIES.map(r=>`${r.label}: ${L.cards.filter(c=>c.rarity===r.k).length}`).join(' · ');
  return `<div class="secbody">
  ${missingImgs(L)?`<div class="busy">Bei ${missingImgs(L)} Karten fehlt das Bild. Wähle die Bilder oder die ZIP-Datei einfach noch einmal aus: Bilder mit gleichem Namen werden den vorhandenen Karten wieder zugeordnet. Oder lade eine Sicherung.</div>`:''}
  <div class="field"><label for="imprar">Seltenheit der neuen Karten</label><select id="imprar" class="in" data-change="imprar">${rarOptions(ui.imprar)}</select></div>
  <label class="btn primary block" for="filein">Bilder aus der Galerie wählen</label>
  <input id="filein" type="file" accept="image/*" multiple hidden data-change="files">
  <label class="btn block" for="zipin" style="margin-top:8px">ZIP-Datei mit Bildern wählen</label>
  <input id="zipin" type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden data-change="files">
  <p class="note">Der Dateiname wird zum Kartennamen. Jede Seltenheit am besten in einem eigenen Schwung hinzufügen. In einer ZIP-Datei bestimmen Ordner namens „normal“, „selten“, „episch“ oder „legendär“ die Seltenheit; alle anderen Bilder bekommen die oben gewählte.</p>
  <button class="btn block" data-a="starter">Platzhalter-Karten hinzufügen (12 Tiere)</button>
  <h3 style="margin-top:18px">Päckchen-Bild</h3>
  <div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div class="packimg" style="width:56px">${packPic()}</div>
  <div class="grow"><label class="btn small block" for="packin">${IMG[PACK_KEY]?'Anderes Bild wählen':'Bild wählen'}</label><input id="packin" type="file" accept="image/*" hidden data-change="packimg">
  ${IMG[PACK_KEY]?`<div style="margin-top:8px">${confBtn('del-packimg:x','Zurücksetzen','block')}</div>`:''}</div></div>
  <p class="note">Wird auf der Startseite und beim Öffnen der Päckchen gezeigt. Ein schwarzer Hintergrund wird automatisch entfernt. Das Bild bleibt auf diesem Handy und ist in der Sicherung enthalten.</p>
  <div id="busy" class="busy" ${ui.busy?'':'hidden'}>${esc(ui.busy)}</div>
  <p class="note" style="margin-top:12px">${L.cards.length} Karten · ${cnt}</p>
  ${missingImgs(L)?`<button class="btn block" data-a="merge-dups" style="margin-bottom:8px">Doppelte Karten zusammenführen</button><p class="note">Hat eine Karte ohne Bild eine gleichnamige Karte mit Bild, bekommt sie deren Bild. Das Duplikat verschwindet, Seltenheit und gesammelte Karten bleiben erhalten.</p>`:''}
  <div class="row" style="margin:8px 0"><button class="btn small ${ui.selMode?'primary':''}" data-a="sel-mode">${ui.selMode?'Auswahl beenden':'Auswählen'}</button>
  ${ui.selMode?`<button class="btn small" data-a="sel-all">Alle</button><button class="btn small" data-a="sel-missing">Ohne Bild (${missingImgs(L)})</button><button class="btn small" data-a="sel-none">Keine</button>`:''}</div>
  ${ui.selMode?`<div class="row" style="margin-bottom:8px"><span class="pill">${ui.cardSel.length} ausgewählt</span>${ui.cardSel.length?confBtn('del-sel:x','Ausgewählte löschen (' + ui.cardSel.length + ')'):''}</div>`:''}
  <div class="grid">${L.cards.map(c=>ui.selMode?`<button class="tile ${ui.cardSel.includes(c.id)?'selected':''}" data-a="sel-card" data-id="${c.id}" aria-pressed="${ui.cardSel.includes(c.id)}">${cardFace(c,false,0)}<span class="selmark">${ui.cardSel.includes(c.id)?'✓':''}</span></button>`:`<button class="tile" data-a="edit-card" data-id="${c.id}">${cardFace(c,false,0)}</button>`).join('')}</div>
  </div>`;
}
function pPrizes(L){
  const rs=S.rewards.filter(r=>r.lang==='all'||r.lang===L.id);
  const ch=chances(L.cards.concat(rs.filter(r=>r.active)));
  const open=L.wins.filter(w=>!w.redeemed);
  return `<div class="secbody">
  <p class="note">Diese Texte können statt einer Karte in einem Päckchen auftauchen. Die Seltenheit bestimmt die Wahrscheinlichkeit, genau wie bei den Karten.</p>
  <div class="field"><label for="pz-text">Belohnung</label><input id="pz-text" class="in" maxlength="80" placeholder="z. B. Eis essen gehen"></div>
  <div class="field"><label for="pz-rar">Seltenheit</label><select id="pz-rar" class="in">${rarOptions('s')}</select></div>
  <div class="field"><label for="pz-scope">Gilt für</label><select id="pz-scope" class="in"><option value="one">nur ${esc(L.name)}</option><option value="all">alle Sprachen</option></select></div>
  <label class="chk"><input type="checkbox" id="pz-once"> Nur einmal gewinnbar</label>
  <button class="btn primary block" data-a="add-prize">Hinzufügen</button>
  <h3 style="margin-top:18px">Hinterlegte Belohnungen</h3>
  ${rs.length?rs.map(r=>`<div class="urow"><div class="t"><b>${esc(r.text)}</b><div class="note">${rar(r.rarity).label}${r.once?' · einmalig':''}${r.lang==='all'?' · alle Sprachen':''} · ${r.active&&ch[r.id]?'ca. '+fmtPct(ch[r.id])+' pro Karte':'pausiert'}</div></div><button class="tog ${r.active?'on':''}" data-a="toggle-prize" data-id="${r.id}">${r.active?'Aktiv':'Aus'}</button><button class="x edit" data-a="edit-prize" data-id="${r.id}" aria-label="Bearbeiten">✎</button></div>`).join(''):'<p class="muted">Noch keine Belohnungen.</p>'}
  <h3 style="margin-top:18px">Gewonnen, noch nicht eingelöst</h3>
  ${open.length?open.map(w=>`<div class="urow"><div class="t"><b>${esc(w.text)}</b><div class="note">${fmtDate(w.ts)} · ${winLabel(w)}</div></div><button class="btn small primary" data-a="redeem" data-id="${w.id}">Eingelöst</button></div>`).join(''):'<p class="muted">Nichts offen.</p>'}
  </div>`;
}
function rewardOpts(sel){
  return '<option value="">– keine –</option>'+S.rewards.map(r=>`<option value="${r.id}" ${r.id===sel?'selected':''}>${esc(r.text)}${r.active?'':' (pausiert)'}</option>`).join('');
}
function pPomo(){
  const c=S.pomoCfg,p=S.pomo;
  const st=!p?'Der Timer läuft nicht.':p.lock?'Pause läuft.':'Der Timer läuft seit '+Math.floor((Date.now()-p.start)/60000)+' Min.';
  return `<div class="secbody"><p class="note">Nach der eingestellten Lernzeit wird die App nach der laufenden Runde für die Pause gesperrt. Entsperren geht nur mit der PIN. Die Pause zählt auch bei geschlossener App weiter. ${st}</p>
  <div class="field"><label for="pm-work">Lernzeit bis zur Pause (Minuten)</label><input id="pm-work" class="in" type="number" inputmode="numeric" min="1" max="90" value="${c.work}" data-change="pomo" data-k="work"></div>
  <div class="field"><label for="pm-brk">Dauer der Pause (Minuten)</label><input id="pm-brk" class="in" type="number" inputmode="numeric" min="1" max="30" value="${c.brk}" data-change="pomo" data-k="brk"></div>
  <div class="field"><label for="pm-idle">Neustart des Timers nach Lernpause von (Minuten)</label><input id="pm-idle" class="in" type="number" inputmode="numeric" min="1" max="30" value="${c.idle}" data-change="pomo" data-k="idle"></div>
  <div class="row"><button class="btn grow" data-a="pomo-test">Pause jetzt testen</button><button class="btn grow" data-a="pomo-reset">Timer zurücksetzen</button></div>
  <p class="note">Zum Testen: Lernzeit und Pause auf 1 Minute stellen oder „Pause jetzt testen“ tippen. Danach die Werte wieder auf z. B. 25 und 5 setzen.</p></div>`;
}
function pStreak(){
  const c=S.streakCfg,d=c.def,sr=S.rewards.find(r=>r.id===c.nextRid);
  return `<div class="secbody">
  <p class="note">Eine Serie ist abgeschlossen, wenn so viele Tage hintereinander geübt wurde. Die Belohnung geht an die Sprache, mit der gerade geübt wurde. Aktuelle Serie: ${streakNow()} ${streakNow()===1?'Tag':'Tage'}.</p>
  <div class="field"><label for="sc-days">Länge einer Serie in Tagen</label><input id="sc-days" class="in" type="number" inputmode="numeric" min="1" max="365" value="${c.days}" data-change="scfg" data-k="days"></div>
  <h3 style="margin-top:14px">Standard-Belohnung</h3>
  <div class="urow"><div class="t"><b>Nach jeder Serie</b></div><button class="tog ${d.active?'on':''}" data-a="toggle-sdef">${d.active?'Aktiv':'Aus'}</button></div>
  <div class="field"><label for="sc-kind">Belohnung</label><select id="sc-kind" class="in" data-change="scfg" data-k="kind"><option value="pack" ${d.kind==='pack'?'selected':''}>Päckchen</option><option value="big" ${d.kind==='big'?'selected':''}>${SPECIAL_PACKS.big.name} (${SPECIAL_PACKS.big.desc})</option><option value="mega" ${d.kind==='mega'?'selected':''}>${SPECIAL_PACKS.mega.name} (${SPECIAL_PACKS.mega.desc})</option><option value="epic" ${d.kind==='epic'?'selected':''}>${SPECIAL_PACKS.epic.name} (${SPECIAL_PACKS.epic.desc})</option><option value="legend" ${d.kind==='legend'?'selected':''}>${SPECIAL_PACKS.legend.name} (${SPECIAL_PACKS.legend.desc})</option><option value="text" ${d.kind==='text'?'selected':''}>Spezielle Belohnung</option></select></div>
  ${d.kind!=='text'?`<div class="field"><label for="sc-packs">Anzahl</label><input id="sc-packs" class="in" type="number" inputmode="numeric" min="1" max="10" value="${d.packs}" data-change="scfg" data-k="packs"></div>`
   :`<div class="field"><label for="sc-rid">Spezielle Belohnung</label><select id="sc-rid" class="in" data-change="scfg" data-k="rid">${rewardOpts(d.rid)}</select></div>${S.rewards.length?'':'<p class="muted">Lege erst unter „Spezielle Belohnungen“ eine an.</p>'}`}
  <h3 style="margin-top:18px">Für die nächste Serie</h3>
  <p class="note">Ersetzt die Standard-Belohnung einmalig. Danach gilt wieder die Standard-Belohnung.</p>
  <div class="field"><label for="sc-next">Belohnung</label><select id="sc-next" class="in" data-change="scfg" data-k="next"><option value="">– keine –</option><optgroup label="Päckchen">${Object.keys(SPECIAL_PACKS).map(k=>`<option value="pack:${k}" ${c.nextPack===k?'selected':''}>${SPECIAL_PACKS[k].name} (${SPECIAL_PACKS[k].desc})</option>`).join('')}</optgroup><optgroup label="Spezielle Belohnung">${S.rewards.map(r=>`<option value="${r.id}" ${r.id===c.nextRid?'selected':''}>${esc(r.text)}${r.active?'':' (pausiert)'}</option>`).join('')}</optgroup></select></div>
  </div>`;
}
function pReward(L){
  if(ui.pscope==='all')L=S.langs[0];
  const sl=[['auto','Automatisch (passend zur Sprache)'],['en-GB','Englisch (UK)'],['en-US','Englisch (US)'],['fr-FR','Französisch'],['es-ES','Spanisch'],['it-IT','Italienisch'],['tr-TR','Türkisch'],['pl-PL','Polnisch'],['ru-RU','Russisch'],['nl-NL','Niederländisch'],['pt-PT','Portugiesisch']];
  const all=ui.pscope==='all';
  return `<div class="secbody">${all?'<p class="note">Gilt für alle Sprachen. Angezeigt werden die Werte der ersten Sprache.</p>':''}
  <div class="field"><label for="s-goal">Punkte pro Päckchen</label><input id="s-goal" class="in" type="number" inputmode="numeric" min="10" max="2000" value="${L.goal}" data-change="set" data-k="goal"></div>
  <div class="field"><label for="s-ppr">Punkte pro richtiger Antwort</label><input id="s-ppr" class="in" type="number" inputmode="numeric" min="1" max="100" value="${L.ppr}" data-change="set" data-k="ppr"></div>
  <div class="field"><label for="s-pack">Karten pro Päckchen</label><input id="s-pack" class="in" type="number" inputmode="numeric" min="1" max="9" value="${L.packSize}" data-change="set" data-k="packSize"></div>
  <div class="field"><label for="s-dir">Abfrage beim Schreiben</label><select id="s-dir" class="in" data-change="set" data-k="dir">
    <option value="mix" ${L.dir==='mix'?'selected':''}>Gemischt</option>
    <option value="f2d" ${L.dir==='f2d'?'selected':''}>${all?'Fremdsprache':esc(L.name)} → Deutsch</option>
    <option value="d2f" ${L.dir==='d2f'?'selected':''}>Deutsch → ${all?'Fremdsprache':esc(L.name)}</option></select></div>
  ${all?'':`<div class="field"><label for="s-sl">Spracherkennung beim Sprechen (automatisch: ${esc(resolveSpeechLang(L))})</label><select id="s-sl" class="in" data-change="set" data-k="speechLang">${sl.map(([v,t])=>`<option value="${v}" ${L.speechLang===v?'selected':''}>${t}</option>`).join('')}</select></div>`}
  <p class="note">Beim Sprechen wird immer das deutsche Wort vorgegeben. Mit den Standardwerten sind 10 richtige Antworten ein Päckchen mit 3 Karten. Seltenheit: Normal 62 %, Selten 26 %, Episch 10 %, Legendär 2 %.</p>
  ${all?'':'<button class="btn block" data-a="gift">1 Päckchen schenken</button>'}</div>`;
}
function pBackup(){
  return `<div class="secbody">
  ${deferredInstall?`<button class="btn primary block" data-a="install" style="margin-bottom:12px">App auf dem Handy installieren</button>`:''}
  <p class="note" style="margin-top:0">Speicherschutz: <b>${ui.persisted?'aktiv ✓':'nicht aktiv'}</b>${ui.persisted?'':' – Wird die App wie eine normale App installiert („Zum Startbildschirm hinzufügen“), löscht der Browser ihre Daten nicht beim Aufräumen.'}<br>Letzte Sicherung: <b>${S.lastBackup?fmtDate(S.lastBackup):'noch nie'}</b></p>
  <button class="btn block" data-a="export">Sicherung speichern</button>
  <p class="note">Speichert alle Sprachen, Vokabeln, Fortschritt und Karten in einer Datei. Am besten ab und zu machen.</p>
  <label class="btn block" for="bkin">Sicherung laden</label><input id="bkin" type="file" accept=".json,application/json" hidden data-change="import">
  ${ui.pendingImport?`<div class="busy">Sicherung gefunden: ${ui.pendingImport.state.langs.length} Sprache(n), ${Object.keys(ui.pendingImport.images||{}).length} Bilder. Alle aktuellen Daten werden ersetzt.<div class="row" style="margin-top:8px"><button class="btn small danger" data-a="import-yes">Ja, ersetzen</button><button class="btn small" data-a="import-no">Abbrechen</button></div></div>`:''}
  <h3 style="margin-top:18px">PIN ändern</h3>
  <div class="field"><label for="pn1">Neue PIN (4 bis 8 Ziffern)</label><input id="pn1" class="in" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></div>
  <button class="btn block" data-a="pin-change">PIN ändern</button></div>`;
}

function vModal(){
  if(ui.modal&&ui.modal.t==='help')return helpModal(ui.modal.k);
  const L=curLang(),m=ui.modal;if(!L)return '';
  const wrap=inner=>`<div class="modal" data-a="backdrop"><div class="mbox">${inner}</div></div>`;
  if(m.t==='word'){
    const w=L.vocab.find(x=>x.id===m.id);if(!w)return '';
    return wrap(`<h3>Wort bearbeiten</h3>
    <div class="field"><label for="we-f">${esc(L.name)}</label><input id="we-f" class="in" value="${esc(w.f)}" maxlength="80"></div>
    <div class="field"><label for="we-d">Deutsch</label><input id="we-d" class="in" value="${esc(w.d)}" maxlength="80"></div>
    <div class="field"><label for="we-u">Tags</label><input id="we-u" class="in" value="${esc(tagsOf(w).map(t=>'#'+t).join(' '))}" maxlength="200">
    <div class="tagpick">${unitsOf(L).map(u=>`<button type="button" class="tagchip ${hasTag(w,u)?'on':''}" data-a="wtag" data-t="${esc(u)}">#${esc(u)}</button>`).join('')}</div></div>
    <div class="row"><button class="btn primary grow" data-a="save-word" data-id="${w.id}">Speichern</button>${confBtn('del-wordm:'+w.id,'Löschen','')}</div>
    <button class="btn block" style="margin-top:8px" data-a="close-modal">Abbrechen</button>`);
  }
  if(m.t==='unit'){
    return wrap(`<h3>Tag umbenennen</h3>
    <div class="field"><label for="ue-name">Neuer Name</label><input id="ue-name" class="in" value="${esc(m.u)}" maxlength="40"></div>
    <p class="note">Gibt es den Namen schon, werden beide Tags zusammengelegt.</p>
    <button class="btn primary block" data-a="save-unit" data-u="${esc(m.u)}">Speichern</button>
    <button class="btn block" style="margin-top:8px" data-a="close-modal">Abbrechen</button>`);
  }
  if(m.t==='prize'){
    const r=S.rewards.find(x=>x.id===m.id);if(!r)return '';
    return wrap(`<h3>Belohnung bearbeiten</h3>
    <div class="field"><label for="pe-text">Text</label><input id="pe-text" class="in" value="${esc(r.text)}" maxlength="80"></div>
    <div class="field"><label for="pe-rar">Seltenheit</label><select id="pe-rar" class="in">${rarOptions(r.rarity)}</select></div>
    <div class="field"><label for="pe-scope">Gilt für</label><select id="pe-scope" class="in"><option value="one" ${r.lang!=='all'?'selected':''}>nur ${esc(L.name)}</option><option value="all" ${r.lang==='all'?'selected':''}>alle Sprachen</option></select></div>
    <label class="chk"><input type="checkbox" id="pe-once" ${r.once?'checked':''}> Nur einmal gewinnbar</label>
    <div class="row"><button class="btn primary grow" data-a="save-prize" data-id="${r.id}">Speichern</button>${confBtn('del-prize:'+r.id,'Löschen','')}</div>
    <button class="btn block" style="margin-top:8px" data-a="close-modal">Abbrechen</button>`);
  }
  const c=L.cards.find(x=>x.id===m.id);if(!c)return '';
  if(m.t==='view'){
    return wrap(`<div style="max-width:260px;margin:0 auto 12px">${cardFace(c,false,L.owned[c.id]||0)}</div>
    <p class="center"><b>${esc(c.name)}</b><br><span class="muted">${rar(c.rarity).label} · ${L.owned[c.id]||0}× gesammelt</span></p>
    <button class="btn primary block" data-a="close-modal">Schließen</button>`);
  }
  return wrap(`<div style="max-width:200px;margin:0 auto 12px">${cardFace(c,false,0)}</div>
  <div class="field"><label for="ced-name">Name</label><input id="ced-name" class="in" value="${esc(c.name)}" maxlength="40"></div>
  <div class="field"><label for="ced-rar">Seltenheit</label><select id="ced-rar" class="in">${rarOptions(c.rarity)}</select></div>
  <div class="row"><button class="btn primary grow" data-a="save-card" data-id="${c.id}">Speichern</button>${confBtn('del-card:'+c.id,'Löschen','')}</div>
  <button class="btn block" style="margin-top:8px" data-a="close-modal">Abbrechen</button>`);
}

let lastView=null;
const THEME_PROPS=['--streak','--accent-text','--bg','--surface','--surface-2','--ink','--muted','--line','--accent','--accent-2','--accent-dark','--accent-ink','--accent-soft','--good','--good-bg','--bad','--bad-bg','--warn','--warn-bg','--shadow','color-scheme'];
const POMO_HB='ws-pomo-hb';
let popping=false;
function pushHist(){try{history.pushState({v:ui.view},'');}catch(e){}}
function renderLock(){
  const el=$('#lock'),p=S.pomo,setup=!S.pinHash,on=setup||!!(p&&p.lock),app=$('#app'),nav=document.querySelector('nav');
  if(app)app.inert=on;if(nav)nav.inert=on;
  if(!on){if(el)el.hidden=true;return;}
  if(setup){
    const sig='s'+ui.setupErr;
    if(el.hidden||el.dataset.sig!==sig){
      el.hidden=false;el.dataset.sig=sig;
      el.innerHTML=`<div class="lockbox" role="dialog" aria-labelledby="lt"><h1 id="lt">Willkommen!</h1><p class="muted">Eltern: Legt jetzt eine PIN fest (4 bis 8 Ziffern). Sie schützt den Elternbereich und die Lernpause.</p><p class="note">Kind? Bitte hol Mama oder Papa. Danach kannst du gleich loslegen!</p>
      <div class="field"><input id="fp1" class="in ans" type="password" inputmode="numeric" maxlength="8" autocomplete="off" aria-label="PIN" placeholder="PIN"></div>
      <div class="field"><input id="fp2" class="in ans" type="password" inputmode="numeric" maxlength="8" autocomplete="off" aria-label="PIN wiederholen" placeholder="PIN wiederholen"></div>
      ${ui.setupErr?`<p class="err">${ui.setupErr}</p>`:''}<button class="btn primary block" data-a="pin-first">PIN festlegen</button></div>`;
      const i=$('#fp1');if(i&&i.focus)i.focus();
    }
    return;
  }
  const left=Math.max(0,Math.ceil((p.until-tNow())/1000)),t=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  const sig=(ui.lockPin?'p':'b')+ui.lockErr;
  if(el.hidden||el.dataset.sig!==sig){
    el.hidden=false;el.dataset.sig=sig;
    el.innerHTML=`<div class="lockbox" role="alertdialog" aria-labelledby="lt"><h1 id="lt">Mach mal Pause!</h1><div class="lcount" id="lcount"></div>${ui.lockPin?`<div class="field"><input id="lpin" class="in ans" type="password" inputmode="numeric" maxlength="8" autocomplete="off" aria-label="PIN" placeholder="PIN"></div>${ui.lockErr?`<p class="err">${ui.lockErr}</p>`:''}<button class="btn primary block" data-a="unlock-go">OK</button>`:`<button class="btn block" data-a="unlock">Entsperren</button>`}</div>`;
    const i=$('#lpin');if(i&&i.focus)i.focus();
  }
  const c=$('#lcount');if(c)c.textContent=t;
}
function endPause(){
  S.pomo=null;ui.lockPin=false;ui.lockErr='';save();renderLock();render();
}
/* Vertrauenswürdige Zeit: beim Öffnen wird die Serverzeit (Date-Header) geholt; danach läuft sie monoton weiter. Ohne Netz gilt die Handy-Uhr. */
let srv0=0,perf0=0,synced=false,timeReady=false;
const perfNow=()=>(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
const tNow=()=>synced?srv0+(perfNow()-perf0):Date.now();
async function syncTime(){
  try{
    const t0=perfNow(),ac=typeof AbortController!=='undefined'?new AbortController():null,to=ac?setTimeout(()=>ac.abort(),4000):0;
    const r=await fetch(location.pathname+'?t='+Date.now(),{method:'HEAD',cache:'no-store',signal:ac?ac.signal:undefined});
    if(to)clearTimeout(to);
    const d=r.headers.get('date'),s=d?Date.parse(d):0,t1=perfNow();
    if(s>0){srv0=s+(t1-t0)/2;perf0=t1;synced=true;}
  }catch(e){}
  timeReady=true;pomoTick();
}
function pomoCfgMs(){const c=S.pomoCfg;return {work:c.work*60000,brk:c.brk*60000,idle:c.idle*60000};}
function pomoTick(){
  const now=Date.now(),before=S.pomo,wasLocked=!!(before&&before.lock);
  let p=before;
  if(!(wasLocked&&!timeReady))p=pomoStep(before,now,ui.view==='quiz',tNow(),pomoCfgMs());
  S.pomo=p;
  const isLocked=!!(p&&p.lock);
  if(p!==before){save();if(wasLocked&&!isLocked)render();}
  if(isLocked&&!wasLocked){if(Q&&Q.listening)stopListen();ui.lockPin=false;ui.lockErr='';}
  renderLock();
  if(!isLocked){try{localStorage.setItem(POMO_HB,String(now));}catch(e){}}
}
const STREAK_OVR={gelb:'#ff7a00',hellorange:'#ffcc00'};
function applyTheme(){
  const st=document.documentElement.style,v=themeVars(S.theme);
  THEME_PROPS.forEach(p=>st.removeProperty(p));
  if(v)Object.keys(v).forEach(p=>st.setProperty(p,v[p]));
  if(STREAK_OVR[S.theme])st.setProperty('--streak',STREAK_OVR[S.theme]);
  const m=document.querySelector('meta[name="theme-color"]'),t=THEMES.find(x=>x.k===S.theme);
  if(m&&t)m.setAttribute('content',t.hex);
}
function vOptions(){
  const cur=THEMES.find(t=>t.k===S.theme)||THEMES[0];
  return `<h2>Optionen</h2>
  <div class="panel"><h3>Farbschema</h3>
  <button class="themesel" data-a="theme-toggle" aria-expanded="${!!ui.themeOpen}"><span class="dot" style="background:${cur.hex}"></span><span class="grow">${cur.n}</span><span>${ui.themeOpen?'▲':'▼'}</span></button>
  ${ui.themeOpen?`<div class="themelist">${THEMES.map(t=>`<button class="theme ${S.theme===t.k?'on':''}" data-a="theme" data-k="${t.k}"><span class="dot" style="background:${t.hex}"></span>${t.n}</button>`).join('')}</div>`:''}</div>
  <div class="panel"><h3>Kartenrücken</h3>
  <div class="row" style="flex-wrap:nowrap"><button class="icon-btn" data-a="back-step" data-d="-1" aria-label="Zurück">‹</button>
  <div class="carousel grow" id="carousel">${BACKS.map((n,i)=>`<button class="bk ${S.cardBack===i+1?'on':''}" data-a="back" data-n="${i+1}" aria-pressed="${S.cardBack===i+1}"><img src="backs/${i+1}.svg" alt="" loading="lazy"><span>${S.cardBack===i+1?'✓ ':''}${n}</span></button>`).join('')}</div>
  <button class="icon-btn" data-a="back-step" data-d="1" aria-label="Weiter">›</button></div>
  <p class="note center">Wische oder tippe auf ‹ ›. So sehen die Karten im Päckchen aus, bevor sie aufgedeckt werden.</p></div>`;
}
function confetti(n){try{
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const cols=['var(--gold)','var(--accent)','var(--accent-2)','var(--streak)'];
  for(let i=0;i<(n||28);i++){const e=document.createElement('i');e.className='conf';
    e.style.background=cols[i%cols.length];
    e.style.setProperty('--dx',(Math.random()*320-160)+'px');
    e.style.setProperty('--dy',(Math.random()*260+60)+'px');
    e.style.setProperty('--rot',(Math.random()*720-360)+'deg');
    e.style.animationDelay=(Math.random()*.15)+'s';
    document.body.appendChild(e);setTimeout(()=>e.remove(),1700);}
}catch(_){}}
function render(){
  applyTheme();
  let h='';
  switch(ui.view){
    case 'quiz':h=vQuiz();break;
    case 'summary':h=vSummary();break;
    case 'pack':h=vPack();break;
    case 'album':h=vAlbum();break;
    case 'options':h=vOptions();break;
    case 'stats':h=vStats();break;
    case 'list':h=vList();break;
    case 'parent':h=vParent();break;
    default:h=vHome();
  }
  if(ui.view!=='summary'&&ui.view!=='pack'&&!h.includes('class="btn small helpb"'))h=`<div class="helprow">${helpBtn(ui.view)}</div>`+h;
  const appEl=$('#app');appEl.innerHTML=h+(ui.modal?vModal():'');
  appEl.classList.toggle('vin',lastView!==ui.view);
  if(lastView!==ui.view&&ui.view==='summary'&&Q&&(Q.packs||(Q.streakAwards&&Q.streakAwards.length)))setTimeout(()=>confetti(36),250);
  document.body.classList.toggle('immersive',ui.view==='quiz'||ui.view==='pack');
  const tab=({album:'album',parent:'parent',options:'options',stats:'stats',list:'list'})[ui.view]||'home';
  ['home','list','album','stats','options','parent'].forEach(k=>$('#n-'+k).classList.toggle('on',k===tab));
  if(ui.view==='options'){const b=document.querySelector('.bk.on');if(b&&b.scrollIntoView)b.scrollIntoView({inline:'center',block:'nearest'});}
  if(lastView==='quiz'&&ui.view!=='quiz'&&S.pomo&&!S.pomo.lock){S.pomo=pomoOnEnd(S.pomo,Date.now());save();}
  if(lastView!==ui.view){window.scrollTo(0,0);if(lastView!==null&&!popping)pushHist();lastView=ui.view;}
  if(ui.view==='quiz'){
    if(Q.phase==='ask'){const a=$('#ans');if(a)a.focus();}else if(Q.phase==='fb'){const b=$('#nextbtn');if(b)b.focus();}
  }
}

/* ================= Lernen ================= */
function stopListen(){try{if(rec){rec.onend=null;rec.onerror=null;rec.onresult=null;rec.abort();}}catch(e){}rec=null;if(Q)Q.listening=false;}
function startQuiz(){
  const L=curLang();if(!L||!L.vocab.length)return;
  const ids=pickSession(L.vocab,ui.unit,L.sessionSize,Date.now());
  if(!ids.length){toast('Keine Wörter in dieser Liste');return;}
  if(S.pomo&&S.pomo.lock)return;
  S.pomo=pomoOnStart(S.pomo,Date.now(),pomoCfgMs());
  const speak=S.mode==='speak';
  const dirOf=()=>speak?'d2f':(L.dir==='mix'?(Math.random()<.5?'f2d':'d2f'):L.dir);
  Q={langId:L.id,mode:speak?'speak':'write',queue:ids.map(id=>({id,dir:dirOf(),first:true,attempts:0})),total:ids.length,t0:Date.now(),phase:'ask',hint:0,earned:0,rightFirst:0,packs:0,fb:null,last:null,listening:false,speechMsg:''};
  ui.view='quiz';render();
}
function resolveAnswer(kind,heard){
  const L=curLang(),it=Q.queue.shift();Q.last=it;
  const w=L.vocab.find(x=>x.id===it.id);
  let pts=0;const hinted=Q.hint>0,retry=!it.first,first=it.first;
  if(it.first){
    applyFirstTry(w,kind,hinted,Date.now());
    if(kind==='right'&&!hinted){pts=L.ppr;Q.rightFirst++;}
    else if(kind==='right'||kind==='almost'){pts=Math.round(L.ppr/2);}
    it.first=false;
  }
  it.attempts++;
  let dropped=false;
  if(kind!=='right'){
    if(it.attempts<3)Q.queue.splice(Math.min(2,Q.queue.length),0,it);else dropped=true;
  }
  if(pts){Q.packs+=addPoints(L,pts);Q.earned+=pts;}
  logAdd(L,new Date(),{p:pts,s:Math.min(Math.max((Date.now()-(Q.t0||Date.now()))/1000,0),60),a:first?1:0,r:first&&kind==='right'?1:0});
  save();
  Q.fb={kind,pts,hinted,retry,dropped,heard:heard||''};Q.phase='fb';Q.speechMsg='';render();
}
function nextQuestion(){
  Q.hint=0;Q.phase='ask';Q.speechMsg='';Q.t0=Date.now();
  if(!Q.queue.length){finishQuiz();return;}
  render();
}
function finishQuiz(){
  const t=dateKey(0),s=S.streak;Q.streakAwards=[];
  if(s.last!==t){
    s.count=(s.last===dateKey(-1))?s.count+1:1;s.last=t;s.best=Math.max(s.best||0,s.count);
    const L=curLang();
    const c=S.streakCfg;
    if(streakDue(s.count,c.days)){
      const sp=c.nextRid&&S.rewards.find(r=>r.id===c.nextRid);
      let g=null;
      if(c.nextPack)g={kind:'pack',t:c.nextPack,n:1};
      else if(sp)g={kind:'text',rid:sp.id};
      else if(c.def.active)g=c.def.kind==='text'?(S.rewards.find(r=>r.id===c.def.rid)?{kind:'text',rid:c.def.rid}:null):{kind:'pack',t:SPECIAL_PACKS[c.def.kind]?c.def.kind:'',n:c.def.packs||1};
      if(sp||c.nextPack){c.nextRid='';c.nextPack='';}
      if(g&&g.kind==='pack'){const n=g.n||1;if(g.t){for(let i=0;i<n;i++)L.sp.push(g.t);}else L.packs+=n;Q.streakAwards.push({kind:'pack',packs:n,label:g.t?SPECIAL_PACKS[g.t].name:'',days:s.count});}
      else if(g){const r=S.rewards.find(x=>x.id===g.rid);L.wins.push({id:uid(),rid:r.id,text:r.text,rarity:r.rarity,src:'streak',days:s.count,ts:Date.now(),redeemed:false});if(r.once)r.active=false;Q.streakAwards.push({kind:'text',text:r.text,days:s.count});}
    }
  }
  save();ui.view='summary';render();
}
function startListen(){
  const SRC=SRClass();if(!SRC||!Q)return;
  if(Q.listening){try{rec.stop();}catch(e){}return;}
  const L=curLang();let got=null,err='';
  rec=new SRC();rec.lang=resolveSpeechLang(L);rec.interimResults=false;rec.maxAlternatives=5;rec.continuous=false;
  rec.onresult=e=>{got=[...e.results[0]].map(a=>a.transcript);};
  rec.onerror=e=>{err=e.error||'';};
  rec.onend=()=>{
    Q.listening=false;rec=null;
    if(got&&got.length){
      const it=Q.queue[0],w=L.vocab.find(x=>x.id===it.id);
      resolveAnswer(evalSpeech(got,it.dir==='f2d'?w.d:w.f),got[0]);return;
    }
    Q.speechMsg=(err==='not-allowed'||err==='service-not-allowed')?'Das Mikrofon ist nicht erlaubt. Erlaube es in den Chrome-Einstellungen für diese Seite.'
      :err==='network'?'Dafür brauchst du Internet.':'Ich habe nichts gehört. Versuch es nochmal.';
    render();
  };
  try{rec.start();Q.listening=true;Q.speechMsg='';render();}catch(e){Q.speechMsg='Das hat nicht geklappt. Versuch es nochmal.';render();}
}

/* ================= Päckchen ================= */
function openPack(){
  const L=curLang();if(!L||packCount(L)<1)return;
  const pool=L.cards.concat(rewardsFor(L));
  if(!pool.length){toast('Noch keine Karten im Album. Bitte Mama oder Papa fragen.');return;}
  const t=(L.sp||[]).length?L.sp.shift():'';
  const drawn=t?packDraw(t,pool):drawCards(pool,L.packSize);
  if(!t)L.packs--;
  const items=drawn.map(c=>{
    if(c.kind==='reward'){
      L.wins.push({id:uid(),rid:c.id,text:c.text,rarity:c.rarity,ts:Date.now(),redeemed:false});
      if(c.once)c.active=false;
      return {card:c,isNew:true,on:false};
    }
    const isNew=!(L.owned[c.id]>0);L.owned[c.id]=(L.owned[c.id]||0)+1;return {card:c,isNew,on:false};
  });
  save();ui.pack={items,opened:false,name:t?SPECIAL_PACKS[t].name:'Päckchen'};ui.view='pack';render();
}

/* ================= Sicherung ================= */
const blobToDataURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b);});
async function exportBackup(){
  try{
    const images={};for(const id of Object.keys(BLOBS))images[id]=await blobToDataURL(BLOBS[id]);
    const blob=new Blob([JSON.stringify({app:'woerter-sammler',v:1,state:S,images})],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='woerter-sammler-sicherung-'+dateKey(0)+'.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    S.lastBackup=Date.now();save();render();toast('Sicherung gespeichert');
  }catch(e){toast('Sicherung fehlgeschlagen');}
}
async function applyImport(){
  const d=ui.pendingImport;ui.pendingImport=null;if(!d)return;
  try{
    try{await idbClear();}catch(e){}
    Object.keys(IMG).forEach(k=>{URL.revokeObjectURL(IMG[k]);delete IMG[k];delete BLOBS[k];});
    for(const id of Object.keys(d.images||{})){const b=await (await fetch(d.images[id])).blob();await putImg(id,b);}
    S=migrate(d.state);save();ui.unlocked=true;toast('Sicherung geladen');
  }catch(e){toast('Laden fehlgeschlagen');}
  render();
}

/* ================= Ereignisse ================= */
function ask(key){
  if(ui.confirm!==key){ui.confirm=key;clearTimeout(confirmT);confirmT=setTimeout(()=>{ui.confirm=null;render();},4000);render();return false;}
  ui.confirm=null;clearTimeout(confirmT);return true;
}
async function mergeDuplicates(L){
  let n=0;
  for(const m of L.cards.slice()){
    if(!L.cards.includes(m)||IMG[m.id])continue;
    const x=L.cards.find(c=>c!==m&&IMG[c.id]&&cardKey(c.name)===cardKey(m.name));
    if(!x)continue;
    await putImg(m.id,BLOBS[x.id]);
    L.owned[m.id]=(L.owned[m.id]||0)+(L.owned[x.id]||0);delete L.owned[x.id];
    L.cards=L.cards.filter(c=>c!==x);await delImg(x.id);n++;
  }
  return n;
}
const IMPSTAT={n:0,r:0};
async function addOrRestore(L,fname,blob,rarity){
  const nm=cleanCardName(fname),k=cardKey(nm),ex=L.cards.find(c=>!IMG[c.id]&&cardKey(c.name)===k);
  if(ex){await putImg(ex.id,blob);IMPSTAT.r++;return;}
  const id=uid();await putImg(id,blob);L.cards.push({id,name:nm,rarity});IMPSTAT.n++;
}
async function importZip(f){
  const L=curLang();
  try{
    const list=zipList(await f.arrayBuffer()).filter(en=>zipImage(en.name));let i=0;
    for(const en of list){
      setBusy(`Importiere ${++i} von ${list.length} …`);
      try{
        const data=await zipData(en);
        const blob=await fileToBlob(new Blob([data],{type:zipImage(en.name)}));
        await addOrRestore(L,en.name.split('/').pop(),blob,zipRarity(en.name,ui.imprar));
      }catch(e){}
    }
  }catch(e){setBusy('');toast('Die ZIP-Datei konnte nicht gelesen werden.');return false;}
  return true;
}
async function importFiles(files){
  const L=curLang();if(!L||!files.length)return;
  const zips=files.filter(f=>/\.zip$/i.test(f.name)),imgs=files.filter(f=>!/\.zip$/i.test(f.name));
  IMPSTAT.n=0;IMPSTAT.r=0;
  for(const z of zips){if(!(await importZip(z)))return;}
  let i=0;
  for(const f of imgs){
    setBusy(`Importiere ${++i} von ${imgs.length} …`);
    try{await addOrRestore(L,f.name,await fileToBlob(f),ui.imprar);}catch(e){}
  }
  save();setBusy('');toast(IMPSTAT.n+' Karten hinzugefügt'+(IMPSTAT.r?', '+IMPSTAT.r+' Bilder wiederhergestellt':''));render();
}
function setBusy(t){ui.busy=t;const b=$('#busy');if(b){b.textContent=t;b.hidden=!t;}}
async function addStarter(){
  const L=curLang();if(!L)return;
  setBusy('Karten werden erstellt …');
  for(const [emoji,name,r,color] of STARTER){const id=uid();await putImg(id,await starterBlob(emoji,color));L.cards.push({id,name,rarity:r});}
  save();setBusy('');toast('12 Platzhalter-Karten hinzugefügt');render();
}
function clamp(v,a,b){v=Math.round(Number(v));if(!isFinite(v))v=a;return Math.min(b,Math.max(a,v));}
const val=sel=>{const e=$(sel);return e?e.value:'';};

document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-a]');if(!el)return;
  const d=el.dataset,L=curLang();
  switch(d.a){
    case 'nav':if(Q&&Q.listening)stopListen();if(ui.view==='parent'&&d.v!=='parent')ui.unlocked=false;ui.view=d.v;ui.modal=null;ui.pinErr='';render();break;
    case 'lang':S.activeLang=d.id;ui.cardSel=[];ui.unit=[];ui.lf=[];ui.catOpen='';save();render();break;
    case 'cat-open':ui.catOpen=ui.catOpen===d.k?'':d.k;render();break;
    case 'cat-pick':{const a=d.k==='home'?ui.unit:ui.lf;if(d.u==='')a.length=0;else{const i=a.indexOf(d.u);if(i<0)a.push(d.u);else a.splice(i,1);}render();break;}
    case 'mode':S.mode=d.m==='speak'?'speak':'write';save();render();break;
    case 'start':startQuiz();break;
    case 'quit':stopListen();ui.view='home';render();break;
    case 'unlock':if(!S.pinHash){endPause();}else{ui.lockPin=true;ui.lockErr='';renderLock();}break;
    case 'pin-first':{
      const a=val('#fp1'),b=val('#fp2');
      if(!/^\d{4,8}$/.test(a))ui.setupErr=/\D/.test(a)?'Bitte nur Ziffern (0–9) in das erste Feld.':a.length<4?'Die PIN ist zu kurz: mindestens 4 Ziffern.':'Die PIN ist zu lang: höchstens 8 Ziffern.';
      else if(a!==b)ui.setupErr='Das zweite Feld passt nicht zum ersten. Bitte die PIN genau wiederholen.';
      else{S.pinHash=hashPin(a);ui.setupErr='';save();render();}
      renderLock();break;}
    case 'unlock-go':if(hashPin(val('#lpin'))===S.pinHash){endPause();}else{ui.lockErr='Falsche PIN.';renderLock();}break;
    case 'size':if(L){L.sessionSize=[10,20,30].includes(+d.n)?+d.n:10;save();render();}break;
    case 'sm':ui.sm=d.v;render();break;
    case 'sg':ui.sg=d.v;render();break;
    case 'list-sort':ui.ls=ui.ls.col===d.c?{col:d.c,dir:-ui.ls.dir}:{col:d.c,dir:1};render();break;
    case 'check':{
      const v=val('#ans');
      if(!v.trim()){toast('Schreibe zuerst eine Antwort.');break;}
      const it=Q.queue[0],w=L.vocab.find(x=>x.id===it.id);
      resolveAnswer(checkAnswer(v,it.dir==='f2d'?w.d:w.f));break;}
    case 'skip':stopListen();resolveAnswer('wrong');break;
    case 'listen':startListen();break;
    case 'show-answer':Q.phase='reveal';render();break;
    case 'self-yes':resolveAnswer('right');break;
    case 'self-no':resolveAnswer('wrong');break;
    case 'hint':{
      const it=Q.queue[0],w=L.vocab.find(x=>x.id===it.id);
      const letters=[...primaryAnswer(it.dir==='f2d'?w.d:w.f)].filter(c=>c!==' ').length;
      if(Q.hint<letters-1)Q.hint++;
      const v=val('#ans');render();const a=$('#ans');if(a){a.value=v;a.focus();}break;}
    case 'next':nextQuestion();break;
    case 'open-pack':openPack();break;
    case 'tear':{if(navigator.vibrate)navigator.vibrate(30);const go=()=>{ui.pack.opened=true;render();};if(window.matchMedia&&!matchMedia('(prefers-reduced-motion:reduce)').matches){el.classList.add('tearing');setTimeout(go,420);}else go();break;}
    case 'flip':{
      const it=ui.pack.items[+d.i];if(it.on)break;
      it.on=true;el.classList.add('on');
      if(it.card.kind==='reward'||it.card.rarity==='e'||it.card.rarity==='l'){if(navigator.vibrate)navigator.vibrate(40);confetti(22);}
      $('#packact').innerHTML=packActions();
      if(ui.pack.items.every(i=>i.on))$('#packhint').textContent='Das sind deine neuen Karten!';
      break;}
    case 'flip-all':{
      ui.pack.items.forEach(i=>i.on=true);
      document.querySelectorAll('.flip').forEach(f=>f.classList.add('on'));
      $('#packact').innerHTML=packActions();$('#packhint').textContent='Das sind deine neuen Karten!';break;}
    case 'view-card':ui.modal={t:'view',id:d.id};render();break;
    case 'edit-card':ui.modal={t:'edit',id:d.id};render();break;
    case 'pscope':ui.pscope=d.v==='all'?'all':'one';ui.catOpen='';if(ui.pscope==='all'&&['vocab','cards','prizes'].includes(ui.sec))ui.sec='reward';render();break;
    case 'help':ui.modal={t:'help',k:d.k};render();break;
    case 'close-modal':ui.modal=null;ui.confirm=null;render();break;
    case 'backdrop':if(e.target===el){ui.modal=null;ui.confirm=null;render();}break;
    case 'save-card':{
      const c=L.cards.find(x=>x.id===d.id);if(!c)break;
      c.name=val('#ced-name').trim()||c.name;c.rarity=val('#ced-rar');
      save();ui.modal=null;render();break;}
    case 'sel-mode':ui.selMode=!ui.selMode;ui.cardSel=[];render();break;
    case 'sel-card':{const i=ui.cardSel.indexOf(d.id);if(i<0)ui.cardSel.push(d.id);else ui.cardSel.splice(i,1);render();break;}
    case 'sel-all':if(L){ui.cardSel=L.cards.map(c=>c.id);render();}break;
    case 'sel-none':ui.cardSel=[];render();break;
    case 'sel-missing':if(L){ui.cardSel=L.cards.filter(c=>!IMG[c.id]).map(c=>c.id);render();}break;
    case 'del-sel':{
      if(!L||!ask(d.key))break;
      const ids=new Set(ui.cardSel);
      L.cards=L.cards.filter(c=>!ids.has(c.id));
      for(const id of ids){delete L.owned[id];await delImg(id);}
      const n=ids.size;ui.cardSel=[];ui.selMode=false;save();render();toast(n+' Karten gelöscht');break;}
    case 'merge-dups':if(L){setBusy('Führe zusammen …');const n=await mergeDuplicates(L);save();setBusy('');render();toast(n?n+' Karten zusammengeführt':'Keine passenden Doppelten gefunden');}break;
    case 'del-card':{
      if(!ask(d.key))break;
      const id=d.key.split(':')[1];L.cards=L.cards.filter(c=>c.id!==id);delete L.owned[id];await delImg(id);
      save();ui.modal=null;render();break;}
    case 'pin-set':{
      const a=val('#pin1'),b=val('#pin2');
      if(!/^\d{4,8}$/.test(a)){ui.pinErr='Die PIN braucht 4 bis 8 Ziffern.';render();break;}
      if(a!==b){ui.pinErr='Die beiden PINs sind verschieden.';render();break;}
      S.pinHash=hashPin(a);save();ui.unlocked=true;ui.pinErr='';render();break;}
    case 'pin-go':{
      if(hashPin(val('#pin'))===S.pinHash){ui.unlocked=true;ui.pinErr='';}else ui.pinErr='Falsche PIN.';
      render();break;}
    case 'pin-change':{
      const a=val('#pn1');
      if(!/^\d{4,8}$/.test(a)){toast('Die PIN braucht 4 bis 8 Ziffern.');break;}
      S.pinHash=hashPin(a);save();$('#pn1').value='';toast('PIN geändert');break;}
    case 'lock':ui.unlocked=false;render();break;
    case 'sec':ui.sec=ui.sec===d.k?'':d.k;render();break;
    case 'add-lang':{
      const n=val('#newlang').trim();if(!n){toast('Bitte einen Namen eingeben.');break;}
      const nl=newLang(n);S.langs.push(nl);S.activeLang=nl.id;save();render();toast(n+' angelegt');break;}
    case 'del-lang':{
      if(!ask(d.key))break;
      const id=d.key.split(':')[1],l=S.langs.find(x=>x.id===id);
      if(l)for(const c of l.cards)await delImg(c.id);
      S.langs=S.langs.filter(x=>x.id!==id);S.rewards=S.rewards.filter(r=>r.lang!==id);
      if(S.activeLang===id)S.activeLang=S.langs[0]?S.langs[0].id:null;
      save();render();break;}
    case 'add-vocab':{
      if(!L)break;
      const def=splitTags(ui.vunit);
      const r=parseSections(ui.vtext,def.length?def:['Allgemein']);let n=0,dup=0,upd=0;
      for(const it of r.items){
        const ex=L.vocab.find(w=>w.f.toLowerCase()===it.f.toLowerCase()&&w.d.toLowerCase()===it.d.toLowerCase());
        if(ex){const add=it.tags.filter(t=>!ex.tags.some(x=>x.toLowerCase()===t.toLowerCase()));if(add.length){ex.tags=ex.tags.concat(add);upd++;}else dup++;continue;}
        L.vocab.push({id:uid(),f:it.f,d:it.d,tags:it.tags.slice(),box:1,due:0,seen:0,right:0,wrong:0});n++;
      }
      if(!r.items.length){toast('Keine Zeile mit „=“ gefunden.');break;}
      ui.vtext='';save();render();
      toast(n+' hinzugefügt'+(upd?`, ${upd} um Tags ergänzt`:'')+(dup?`, ${dup} schon vorhanden`:'')+(r.skipped?`, ${r.skipped} Zeile(n) übersprungen`:''));break;}
    case 'theme':S.theme=THEMES.some(t=>t.k===d.k)?d.k:'blau';ui.themeOpen=false;save();render();break;
    case 'back':S.cardBack=clamp(d.n,1,BACKS.length);save();render();break;
    case 'back-step':S.cardBack=((S.cardBack-1+(+d.d)+BACKS.length)%BACKS.length)+1;save();render();break;
    case 'theme-toggle':ui.themeOpen=!ui.themeOpen;render();break;
    case 'toggle-cats':ui.cats=!ui.cats;render();break;
    case 'open-unit':ui.openUnit=ui.openUnit===d.u?'':d.u;render();break;
    case 'rename-unit':ui.modal={t:'unit',u:d.u};render();break;
    case 'save-unit':{
      const nn=val('#ue-name').trim();if(!nn){toast('Der Name darf nicht leer sein.');break;}
      const nt=normTag(nn);if(!nt){toast('Der Name darf nicht leer sein.');break;}
      L.vocab.forEach(w=>{if(hasTag(w,d.u)){w.tags=splitTags(w.tags.map(t=>t===d.u?nt:t).join('#'));}});
      if(ui.openUnit===d.u)ui.openUnit=nn;ui.unit=[];ui.lf=[];ui.modal=null;save();render();toast('Umbenannt');break;}
    case 'del-unit':{
      if(!ask(d.key))break;
      const u=d.key.slice('del-unit:'.length);L.vocab=L.vocab.filter(w=>!(hasTag(w,u)&&w.tags.length===1));L.vocab.forEach(w=>{w.tags=w.tags.filter(t=>t!==u);});if(ui.openUnit===u)ui.openUnit='';save();render();break;}
    case 'wtag':{const i=$('#we-u');if(!i)break;let t=splitTags(i.value);const k=t.findIndex(x=>x.toLowerCase()===d.t.toLowerCase());if(k>=0)t.splice(k,1);else t.push(d.t);i.value=t.map(x=>'#'+x).join(' ');el.classList.toggle('on',k<0);break;}
    case 'edit-word':ui.modal={t:'word',id:d.id};render();break;
    case 'save-word':{
      const w=L.vocab.find(x=>x.id===d.id);if(!w)break;
      const f=val('#we-f').trim(),dd=val('#we-d').trim(),u=splitTags(val('#we-u'));
      if(!f||!dd){toast('Beide Wörter müssen ausgefüllt sein.');break;}
      w.f=f;w.d=dd;w.tags=u.length?u:['Allgemein'];save();ui.modal=null;render();toast('Gespeichert');break;}
    case 'del-wordm':{
      if(!ask(d.key))break;
      const id=d.key.split(':')[1];L.vocab=L.vocab.filter(w=>w.id!==id);save();ui.modal=null;render();break;}
    case 'del-word':L.vocab=L.vocab.filter(w=>w.id!==d.id);save();render();break;
    case 'reset-learn':{
      if(!ask(d.key))break;
      L.vocab.forEach(w=>{w.box=1;w.due=0;w.seen=0;w.right=0;w.wrong=0;});save();render();toast('Lernstand zurückgesetzt');break;}
    case 'add-prize':{
      const text=val('#pz-text').trim();if(!text){toast('Bitte einen Text eingeben.');break;}
      S.rewards.push({id:uid(),kind:'reward',text,rarity:val('#pz-rar')||'s',lang:val('#pz-scope')==='all'?'all':L.id,active:true,once:!!($('#pz-once')&&$('#pz-once').checked)});
      save();render();toast('Belohnung hinterlegt');break;}
    case 'toggle-prize':{
      const r=S.rewards.find(x=>x.id===d.id);if(r){r.active=!r.active;save();render();}break;}
    case 'edit-prize':ui.modal={t:'prize',id:d.id};render();break;
    case 'save-prize':{
      const r=S.rewards.find(x=>x.id===d.id);if(!r)break;
      const text=val('#pe-text').trim();if(!text){toast('Der Text darf nicht leer sein.');break;}
      r.text=text;r.rarity=val('#pe-rar')||r.rarity;r.lang=val('#pe-scope')==='all'?'all':L.id;r.once=!!($('#pe-once')&&$('#pe-once').checked);
      save();ui.modal=null;render();break;}
    case 'del-prize':{
      if(!ask(d.key))break;
      const id=d.key.split(':')[1];S.rewards=S.rewards.filter(r=>r.id!==id);save();ui.modal=null;render();break;}
    case 'redeem':{
      const w=L.wins.find(x=>x.id===d.id);if(w){w.redeemed=true;w.redeemedTs=Date.now();save();render();}break;}
    case 'pomo-test':S.pomo={lock:true,until:tNow()+S.pomoCfg.brk*60000,start:Date.now(),idle:null};save();pomoTick();break;
    case 'pomo-reset':S.pomo=null;save();toast('Timer zurückgesetzt');render();break;
    case 'toggle-sdef':S.streakCfg.def.active=!S.streakCfg.def.active;save();render();break;
    case 'del-packimg':{if(!ask(d.key))break;await delImg(PACK_KEY);render();toast('Standard-Päckchen wird gezeigt');break;}
    case 'starter':addStarter();break;
    case 'gift':if(L){L.packs++;save();toast('1 Päckchen geschenkt');}break;
    case 'export':exportBackup();break;
    case 'import-yes':applyImport();break;
    case 'import-no':ui.pendingImport=null;render();break;
    case 'install':if(deferredInstall){deferredInstall.prompt();deferredInstall=null;render();}break;
  }
});
document.addEventListener('change',async e=>{
  const el=e.target,k=el.dataset&&el.dataset.change;if(!k)return;
  const L=curLang();
  if(k==='imprar')ui.imprar=el.value;
  else if(k==='pomo'){const key=el.dataset.k,lim={work:[1,90],brk:[1,30],idle:[1,30]}[key];if(lim){S.pomoCfg[key]=clamp(el.value,lim[0],lim[1]);save();render();}}
  else if(k==='scfg'){
    const c=S.streakCfg,key=el.dataset.k;
    if(key==='days')c.days=clamp(el.value,1,365);
    else if(key==='kind')c.def.kind=(el.value==='text'||SPECIAL_PACKS[el.value])?el.value:'pack';
    else if(key==='packs')c.def.packs=clamp(el.value,1,10);
    else if(key==='rid')c.def.rid=el.value;
    else if(key==='next'){const v=el.value;if(v.startsWith('pack:')){c.nextPack=SPECIAL_PACKS[v.slice(5)]?v.slice(5):'';c.nextRid='';}else{c.nextRid=v;c.nextPack='';}}
    save();render();
  }
  else if(k==='packimg'){
    const f=el.files[0];el.value='';if(!f)return;
    try{const b=await packImageBlob(f);await putImg(PACK_KEY,b);toast('Päckchen-Bild gespeichert');}catch(err){toast('Das Bild konnte nicht gelesen werden.');}
    render();
  }
  else if(k==='files'){const files=[...el.files];el.value='';await importFiles(files);}
  else if(k==='set'&&L){
    const key=el.dataset.k;
    for(const T of (ui.pscope==='all'&&key!=='speechLang'?S.langs:[L])){
    if(key==='goal')T.goal=clamp(el.value,10,2000);
    else if(key==='ppr')T.ppr=clamp(el.value,1,100);
    else if(key==='packSize')T.packSize=clamp(el.value,1,9);
    else if(key==='dir')T.dir=el.value;
    else if(key==='speechLang')T.speechLang=el.value;
    while(T.points>=T.goal){T.points-=T.goal;T.packs++;}}
    save();render();toast('Gespeichert');
  }else if(k==='import'){
    const f=el.files[0];el.value='';if(!f)return;
    try{
      const d=JSON.parse(await f.text());
      if(d.app!=='woerter-sammler'||!d.state||!Array.isArray(d.state.langs))throw new Error('x');
      ui.pendingImport=d;render();
    }catch(err){toast('Das ist keine gültige Sicherung.');}
  }
});
document.addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.input;
  if(k==='vtext')ui.vtext=e.target.value;else if(k==='vunit')ui.vunit=e.target.value;
});
document.addEventListener('keydown',e=>{
  if(!S.pinHash||(S.pomo&&S.pomo.lock)){if(e.key==='Enter'){const b=document.querySelector('[data-a="unlock-go"],[data-a="pin-first"]');if(b)b.click();}return;}
  if(e.key!=='Enter')return;
  if(ui.view==='quiz'&&Q){
    if(Q.phase==='ask'&&Q.mode==='write'){e.preventDefault();const b=document.querySelector('[data-a="check"]');if(b)b.click();}
    else if(Q.phase==='fb'){e.preventDefault();nextQuestion();}
  }
  else if(ui.view==='parent'&&!ui.unlocked){const b=document.querySelector('[data-a="pin-go"],[data-a="pin-set"]');if(b)b.click();}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();else syncTime();});
window.addEventListener('pagehide',()=>save());
window.addEventListener('popstate',e=>{
  if(!S.pinHash||(S.pomo&&S.pomo.lock)){pushHist();return;}
  if(ui.modal||ui.catOpen||ui.themeOpen||ui.confirm){ui.modal=null;ui.catOpen='';ui.themeOpen=false;ui.confirm=null;pushHist();render();return;}
  let v=(e.state&&e.state.v)||'home';
  if(!({home:1,list:1,album:1,stats:1,options:1,parent:1})[v])v='home';
  if(Q&&Q.listening)stopListen();
  if(ui.view==='parent'&&v!=='parent')ui.unlocked=false;
  popping=true;ui.view=v;ui.modal=null;ui.pinErr='';render();popping=false;
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});

/* ================= Start ================= */
(async function init(){
  try{db=await idbOpen();const all=await idbAll();for(const id of Object.keys(all)){BLOBS[id]=all[id];IMG[id]=URL.createObjectURL(all[id]);}}catch(e){db=null;}
  try{if(navigator.storage&&navigator.storage.persist){ui.persisted=await navigator.storage.persist();}}catch(e){}
  try{const hb=+(localStorage.getItem(POMO_HB)||0);if(S.pomo&&!S.pomo.lock&&S.pomo.idle==null&&hb)S.pomo.idle=hb;}catch(e){}
  try{history.replaceState({v:'home'},'');}catch(e){}
  pomoTick();save();render();setInterval(pomoTick,1000);syncTime();
  if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();

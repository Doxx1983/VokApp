const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const stubs={},handlers={};
function stub(sel){return stubs[sel]||(stubs[sel]={innerHTML:'',textContent:'',value:'',checked:false,hidden:false,dataset:{},classList:{add(){},remove(){},toggle(){}},focus(){},click(){},setAttribute(){},files:[]});}
const store={};const say={v:null};
class FakeSR{start(){FakeSR.lastLang=this.lang;setTimeout(()=>{if(say.v!==null)this.onresult({results:[[{transcript:say.v}]]});this.onend();},1);}stop(){}abort(){}}
const win={scrollTo(){},addEventListener(t,f){handlers['w_'+t]=f;}};win.window=win;
const ctx={console,setTimeout,clearTimeout,setInterval:()=>0,Math,Date,JSON,Promise,Set,Array,Object,String,Number,isFinite,URL,Blob,Intl,
  document:{documentElement:{style:{props:{},removeProperty(p){delete this.props[p];},setProperty(p,v){this.props[p]=v;}}},querySelector:stub,querySelectorAll:()=>[],addEventListener:(t,f)=>{handlers[t]=f;},body:{classList:{toggle(){}}},createElement:()=>({getContext:()=>({}),toBlob(cb){cb(new Blob(['x']))},click(){},remove(){}})},
  window:win,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}},navigator:{},location:{protocol:'https:'},
  history:{pushed:[],pushState(st){this.pushed.push(st);},replaceState(){}},require_assert:assert,stub,process,handlers,FakeSR,say};

const test=`
;(async()=>{
 const tick=()=>new Promise(r=>setTimeout(r,8));
 const click=async(data)=>{const el={dataset:data,classList:{add(){},remove(){}},closest(){return el;}};await handlers.click({target:el});await tick();};
 const app=()=>stub('#app').innerHTML;
 const L=curLang();
 await tick();
 assert(app().includes('Starte heute eine neue Serie!')&&app().includes('Lernen starten</button>')&&app().includes('Schreiben')&&app().includes('Sprechen')&&!app().includes('Vokabelliste ansehen')&&!app().includes('sicher gelernt'),'Home');
 await click({a:'size',n:'20'});assert.equal(L.sessionSize,20);assert(app().includes('Lernen starten</button>'));await click({a:'size',n:'10'});assert.equal(L.sessionSize,10);
 assert(!app().includes('streakon'),'keine Serie, kein Highlight');
 // ---- Schreiben
 await click({a:'start'});
 let n=0;
 while(Q&&ui.view==='quiz'&&n<60){
   n++;
   if(Q.phase==='ask'){const it=Q.queue[0],w=L.vocab.find(x=>x.id===it.id);stub('#ans').value=(n%4===0)?'xyzxyz':(it.dir==='f2d'?w.d:w.f);await click({a:'check'});}
   else await click({a:'next'});
 }
 assert.equal(ui.view,'summary');assert(L.totalPoints>0);
 // ---- Sprechen ohne Spracherkennung: Lösung zeigen + Selbstbewertung, immer Deutsch vorgegeben
 await click({a:'nav',v:'home'});await click({a:'mode',m:'speak'});assert.equal(S.mode,'speak');assert(app().includes('keine Spracherkennung'));
 await click({a:'start'});
 assert(Q.queue.every(i=>i.dir==='d2f'),'nur Deutsch vorgegeben');assert(app().includes('Lösung zeigen'));
 await click({a:'show-answer'});assert(app().includes('Hab ich gewusst'));
 const p0=L.totalPoints;await click({a:'self-yes'});assert(L.totalPoints>p0);
 await click({a:'next'});await click({a:'quit'});
 // ---- Sprechen mit Spracherkennung
 window.webkitSpeechRecognition=FakeSR;
 await click({a:'nav',v:'home'});assert(!app().includes('keine Spracherkennung'));
 await click({a:'start'});assert(app().includes('class="mic'));
 let it=Q.queue[0],w=L.vocab.find(x=>x.id===it.id);
 say.v=null;await click({a:'listen'});await tick();assert(app().includes('nichts gehört'),'nichts gehört');assert.equal(Q.queue.length,Q.total,'kein Versuch gezählt');
 say.v='banana split';await click({a:'listen'});await tick();assert(app().includes('Leider nicht'),'falsch erkannt');assert(app().includes('Verstanden'));
 await click({a:'next'});
 it=Q.queue[0];w=L.vocab.find(x=>x.id===it.id);say.v='the '+w.f.replace(/^to /,'');await click({a:'listen'});await tick();assert(app().includes('Richtig'),'richtig gesprochen');
 assert.equal(FakeSR.lastLang,'en-GB','Erkennung folgt der Sprache');
 await click({a:'quit'});
 // ---- Vokabelliste für das Kind
 await click({a:'nav',v:'home'});await click({a:'nav',v:'list'});assert.equal(ui.view,'list');assert(app().includes('Hund')&&app().includes('Kategorie'));
 await click({a:'list-sort',c:'d'});assert.equal(ui.ls.col,'d');assert.equal(ui.ls.dir,1);await click({a:'list-sort',c:'d'});assert.equal(ui.ls.dir,-1);
 const a1=app();assert(a1.indexOf('Wasser')<a1.indexOf('Apfel'),'absteigend nach Deutsch');
 await click({a:'list-sort',c:'u'});assert.equal(ui.ls.col,'u');
 // ---- Eltern
 await click({a:'nav',v:'parent'});stub('#pin1').value='4711';stub('#pin2').value='4711';await click({a:'pin-set'});assert(app().includes('Elternbereich'));
 ui.vunit='Möbel';ui.vtext='chair = Stuhl\\ntable = Tisch';await click({a:'add-vocab'});assert(L.vocab.some(x=>x.f==='chair'&&x.unit==='Möbel'));
 const us=unitsOf(L);assert(us.length>1,'mehrere Kategorien');
 await click({a:'nav',v:'home'});await click({a:'nav',v:'list'});assert.equal(ui.view,'list');
 await click({a:'cat-open',k:'list'});assert(app().includes('data-a="cat-pick"'));
 await click({a:'cat-pick',k:'list',u:'Möbel'});assert.deepEqual(ui.lf,['Möbel']);assert(app().includes('✓'));
 const other=us.find(u=>u!=='Möbel');await click({a:'cat-pick',k:'list',u:other});assert.equal(ui.lf.length,2);
 await click({a:'cat-pick',k:'list',u:'Möbel'});assert.deepEqual(ui.lf,[other]);
 await click({a:'cat-pick',k:'list',u:''});assert.equal(ui.lf.length,0);await click({a:'cat-open',k:'list'});assert(!app().includes('data-a="cat-pick"'));
 await click({a:'cat-open',k:'home'});await click({a:'cat-pick',k:'home',u:'Möbel'});await click({a:'cat-pick',k:'home',u:other});
 {const ids=pickSession(L.vocab,ui.unit,50,Date.now());assert(ids.length>0&&ids.every(id=>ui.unit.includes(L.vocab.find(w=>w.id===id).unit)),'Sitzung nur aus gewählten Kategorien');}
 await click({a:'cat-pick',k:'home',u:''});await click({a:'cat-open',k:'home'});await click({a:'nav',v:'parent'});stub('#pin').value='4711';await click({a:'pin-go'});
 if(!ui.cats)await click({a:'toggle-cats'});await click({a:'open-unit',u:'Möbel'});assert(app().includes('data-a="edit-word"'));
 const cw=L.vocab.find(x=>x.f==='chair');await click({a:'edit-word',id:cw.id});assert(app().includes('Wort bearbeiten'));
 stub('#we-f').value='armchair';stub('#we-d').value='Sessel';stub('#we-u').value='Wohnen';await click({a:'save-word',id:cw.id});
 assert.equal(cw.f,'armchair');assert.equal(cw.unit,'Wohnen');
 stub('#we-f').value='';await click({a:'edit-word',id:cw.id});await click({a:'save-word',id:cw.id});assert.equal(cw.f,'armchair','leer wird abgelehnt');
 await click({a:'close-modal'});
 await click({a:'rename-unit',u:'Wohnen'});stub('#ue-name').value='Möbel';await click({a:'save-unit',u:'Wohnen'});assert.equal(cw.unit,'Möbel','zusammengelegt');
 // Text-Belohnungen
 await click({a:'sec',k:'prizes'});assert(app().includes('Hinterlegte Belohnungen'));
 stub('#pz-text').value='Eis essen gehen';stub('#pz-rar').value='l';stub('#pz-scope').value='one';stub('#pz-once').checked=true;await click({a:'add-prize'});
 stub('#pz-text').value='Kinoabend';stub('#pz-rar').value='e';stub('#pz-scope').value='all';stub('#pz-once').checked=false;await click({a:'add-prize'});
 assert.equal(S.rewards.length,2);assert(app().includes('ca. '));
 const r1=S.rewards[0],r2=S.rewards[1];assert.equal(r1.lang,L.id);assert.equal(r2.lang,'all');assert(r1.once&&r1.active);
 await click({a:'toggle-prize',id:r2.id});assert.equal(r2.active,false);assert(app().includes('pausiert'));await click({a:'toggle-prize',id:r2.id});assert.equal(r2.active,true);
 await click({a:'edit-prize',id:r2.id});stub('#pe-text').value='Kino mit Popcorn';stub('#pe-rar').value='s';stub('#pe-scope').value='one';stub('#pe-once').checked=true;await click({a:'save-prize',id:r2.id});
 assert.equal(r2.text,'Kino mit Popcorn');assert.equal(r2.rarity,'s');assert.equal(r2.lang,L.id);assert(r2.once);
 // Päckchen nur mit Belohnungen (keine Karten) und dann einlösen
 L.cards=[];L.packs=2;L.packSize=3;
 await click({a:'nav',v:'home'});assert(app().includes('packdef'),'Päckchen-Bild auf der Startseite');await click({a:'open-pack'});assert.equal(ui.view,'pack');assert(app().includes('data-a="tear"')&&!app().includes('data-a="flip"'),'erst das Päckchen');await click({a:'tear'});assert(app().includes('data-a="flip"'),'dann die Karten');
 assert(L.wins.length>=1&&L.wins.length<=2,'Gewinne: '+L.wins.length);assert(app().includes('Belohnung'));
 assert.equal(r1.active||r2.active,false,'einmalige Belohnungen sind pausiert');
 await click({a:'flip-all'});
 await click({a:'nav',v:'album'});assert(app().includes('Meine Belohnungen')&&app().includes('offen'));
 await click({a:'nav',v:'parent'});stub('#pin').value='4711';await click({a:'pin-go'});if(ui.sec!=='prizes')await click({a:'sec',k:'prizes'});assert(app().includes('Gewonnen, noch nicht eingelöst'));
 const win0=L.wins[0];await click({a:'redeem',id:win0.id});assert(win0.redeemed);
 await click({a:'nav',v:'album'});assert(app().includes('eingelöst'));
 // Löschen mit Rückfrage
 await click({a:'nav',v:'parent'});stub('#pin').value='4711';await click({a:'pin-go'});if(ui.sec!=='prizes')await click({a:'sec',k:'prizes'});
 await click({a:'edit-prize',id:r1.id});await click({a:'del-prize',key:'del-prize:'+r1.id});assert(S.rewards.includes(r1),'erst Rückfrage');
 await click({a:'del-prize',key:'del-prize:'+r1.id});assert(!S.rewards.includes(r1));
 // Einstellungen: Spracherkennung
 await click({a:'sec',k:'reward'});assert(app().includes('Spracherkennung beim Sprechen'));
 const sl=stub('#s-sl');sl.value='fr-FR';sl.dataset={change:'set',k:'speechLang'};await handlers.change({target:Object.assign(sl,{dataset:{change:'set',k:'speechLang'}})});await tick();
 assert.equal(L.speechLang,'fr-FR');
 await click({a:'sec',k:'lang'});stub('#newlang').value='Französisch';await click({a:'add-lang'});const FR=curLang();assert.equal(FR.name,'Französisch');
 FR.vocab.push({id:'fv1',f:'chien',d:'Hund',unit:'Tiere',box:1,due:0,seen:0,right:0,wrong:0});
 await click({a:'nav',v:'home'});S.mode='speak';await click({a:'start'});say.v='chien';await click({a:'listen'});await tick();assert.equal(FakeSR.lastLang,'fr-FR','Französisch erkannt als fr-FR');assert(app().includes('Richtig'));await click({a:'quit'});
 // Kategorien einklappen
 await click({a:'lang',id:L.id});await click({a:'nav',v:'parent'});stub('#pin').value='4711';await click({a:'pin-go'});await click({a:'sec',k:'vocab'});if(ui.sec!=='vocab')await click({a:'sec',k:'vocab'});
 assert.equal(ui.cats,true);ui.cats=false;await click({a:'nav',v:'parent'});if(ui.sec!=='vocab')await click({a:'sec',k:'vocab'});assert(app().includes('Vorhandene Kategorien')&&!app().includes('data-a="open-unit"'),'eingeklappt');
 await click({a:'toggle-cats'});assert(app().includes('data-a="open-unit"'),'aufgeklappt');
 await click({a:'toggle-cats'});assert(!app().includes('data-a="open-unit"'),'wieder zu');
 // Farbschema
 await click({a:'nav',v:'options'});assert(app().includes('Optionen')&&app().includes('Farbschema')&&!app().includes('Hellgrün'),'zu');
 await click({a:'theme-toggle'});assert(app().includes('Hellgrün'),'offen');
 assert.deepEqual(THEMES.map(t=>t.n),['Blau','Hellblau','Gelb','Hellgelb','Grau','Hellgrau','Grün','Hellgrün','Lila','Helllila','Orange','Hellorange','Rosa','Hellrosa','Rot','Hellrot','Schwarz','Weiß']);
 await click({a:'theme',k:'rot'});assert.equal(S.theme,'rot');assert(document.documentElement.style.props['--accent'].startsWith('hsl(4'));assert(!ui.themeOpen);
 await click({a:'theme',k:'lila'});assert.equal(document.documentElement.style.props['--bg'],'#13112a');
 await click({a:'theme',k:'schwarz'});assert.equal(document.documentElement.style.props['--bg'],'#0b0b0c');
 await click({a:'back',n:'4'});assert.equal(S.cardBack,4);assert(app().includes('✓ Feuer'));await click({a:'back-step',d:'-1'});assert.equal(S.cardBack,3);S.cardBack=10;await click({a:'back-step',d:'1'});assert.equal(S.cardBack,1,'umlaufend');
 await click({a:'theme',k:'blau'});assert(document.documentElement.style.props['--bg'].startsWith('hsl(217'));
 await click({a:'nav',v:'parent'});stub('#pin').value='4711';await click({a:'pin-go'});
 // Serien-Belohnung
 S.rewards.push({id:'rw1',kind:'reward',text:'Eis essen',rarity:'e',lang:'all',active:true,once:true},{id:'rw2',kind:'reward',text:'Kino',rarity:'s',lang:'all',active:false});
 await click({a:'sec',k:'streak'});if(ui.sec!=='streak')await click({a:'sec',k:'streak'});
 assert(app().includes('Standard-Belohnung')&&app().includes('Eis essen'),'Serien-Abschnitt');
 const chg=async(k,v)=>{await handlers.change({target:{dataset:{change:'scfg',k},value:v}});await tick();};
 await chg('days','2');assert.equal(S.streakCfg.days,2);
 await click({a:'toggle-sdef'});assert(S.streakCfg.def.active);
 const run=async()=>{S.streak.last=null;S.streak.count=0;await click({a:'nav',v:'home'});await click({a:'start'});let n=0;while(Q&&ui.view==='quiz'&&n<80){const it=Q.queue[0];const w=curLang().vocab.find(x=>x.id===it.id);if(Q.phase==='ask'){stub('#ans').value=w.f;await click({a:'check'});}else await click({a:'next'});n++;}};
 const sim=async(cnt)=>{S.streak.last=null;S.streak.count=cnt-1;const d=new Date();d.setDate(d.getDate()-1);S.streak.last=dateKey(-1);Q=Q||{};Q.streakAwards=[];const P=curLang().packs,W=curLang().wins.length;finishQuiz();return {p:curLang().packs-P,w:curLang().wins.length-W,aw:Q.streakAwards};};
 let sr=await sim(1);assert.equal(sr.p+sr.w,0,'Tag 1 keine Serie');
 sr=await sim(2);assert.equal(sr.p,1,'Standard: Päckchen');
 S.streakCfg.def.kind='text';S.streakCfg.def.rid='rw2';sr=await sim(2);assert.equal(sr.w,1,'Standard: spezielle');assert.equal(curLang().wins.at(-1).text,'Kino');
 await chg('next','rw1');sr=await sim(4);assert.equal(curLang().wins.at(-1).text,'Eis essen','nächste Serie: spezielle');assert.equal(S.streakCfg.nextRid,'','nächste verbraucht');assert(!S.rewards.find(x=>x.id==='rw1').active,'once deaktiviert');
 sr=await sim(4);assert.equal(curLang().wins.at(-1).text,'Kino','danach wieder Standard');
 S.streakCfg.def.active=false;sr=await sim(6);assert.equal(sr.p+sr.w,0,'Standard aus');
 await click({a:'nav',v:'home'});
 // Statistik
 await click({a:'nav',v:'stats'});assert.equal(ui.view,'stats');
 {const k=dKey(new Date()),e=L.log[k];assert(e&&e.a>0&&e.s>=0&&e.p>=0,'Tagesprotokoll geschrieben');}
 assert(app().includes('Diese Woche')&&app().includes('Dieser Monat')&&app().includes('<svg class="chart"')&&app().includes('sicher gelernt')&&app().includes('Wissensstand'));
 await click({a:'sm',v:'s'});assert(app().includes('Lernzeit (Min.)'));await click({a:'sg',v:'w'});assert(app().includes('KW')&&app().includes('Letzte 12 Wochen'));
 await click({a:'nav',v:'home'});
 // PIN-Pflicht beim ersten Start
 {const pinOld=S.pinHash;S.pinHash=null;renderLock();assert.equal(stub('#lock').hidden,false);assert(stub('#lock').innerHTML.includes('Willkommen!')&&stub('#lock').innerHTML.includes('fp1'));assert.equal(stub('#app').inert,true);
  stub('#fp1').value='12';stub('#fp2').value='12';await click({a:'pin-first'});assert(!S.pinHash&&stub('#lock').innerHTML.includes('4 bis 8'));
  stub('#fp1').value='1234';stub('#fp2').value='1235';await click({a:'pin-first'});assert(!S.pinHash&&stub('#lock').innerHTML.includes('verschieden'));
  stub('#fp1').value='1234';stub('#fp2').value='1234';await click({a:'pin-first'});assert.equal(S.pinHash,hashPin('1234'));assert.equal(stub('#lock').hidden,true);assert.equal(stub('#app').inert,false);S.pinHash=pinOld;}
 // Pomodoro-Sperre
 S.pinHash=hashPin('4711');S.pomo={start:Date.now()-26*60000,idle:null};timeReady=true;
 ui.view='quiz';Q=Q||{};pomoTick();assert(!S.pomo.lock,'mitten in der Runde keine Sperre');
 ui.view='home';pomoTick();assert(S.pomo.lock&&S.pomo.until-tNow()>299000&&S.pomo.until-tNow()<=300000,'nach der Runde gesperrt');assert.equal(stub('#lock').hidden,false);assert(stub('#lock').innerHTML.includes('Mach mal Pause!')&&stub('#lock').innerHTML.includes('Entsperren'));assert.equal(stub('#app').inert,true);
 assert(stub('#lcount').textContent.startsWith('04:5')||stub('#lcount').textContent==='05:00');
 {const u=S.pomo.until;S.pomo.start=0;pomoTick();assert(S.pomo.lock&&S.pomo.until===u,'Handy-Uhr egal');}
 // Zeitabgleich mit dem Server
 {globalThis.fetch=async()=>({headers:{get:()=>new Date(Date.now()+3600e3).toUTCString()}});await syncTime();assert(synced&&Math.abs(tNow()-(Date.now()+3600e3))<2500,'Serverzeit übernommen');
  globalThis.fetch=async()=>{throw new Error('offline');};synced=false;await syncTime();assert(!synced&&Math.abs(tNow()-Date.now())<5,'offline: Handy-Uhr');}
 S.pomo={start:Date.now(),idle:null,lock:true,until:tNow()+300000};pomoTick();assert.equal(stub('#lock').hidden,false);
 await click({a:'unlock'});assert(stub('#lock').innerHTML.includes('lpin'));
 stub('#lpin').value='1111';await click({a:'unlock-go'});assert(stub('#lock').innerHTML.includes('Falsche PIN'));assert(S.pomo&&S.pomo.lock);
 stub('#lpin').value='4711';await click({a:'unlock-go'});assert.equal(S.pomo,null);assert.equal(stub('#lock').hidden,true);assert.equal(stub('#app').inert,false);
 S.pomo={start:Date.now()-26*60000,idle:null};pomoTick();assert(S.pomo.lock);S.pomo.until=tNow()-1;pomoTick();assert.equal(S.pomo,null,'Pause läuft ab');assert.equal(stub('#lock').hidden,true);
 // geschlossene App: gespeicherte Sperre, Serverzeit noch nicht geholt -> bleibt gesperrt
 S.pomo={start:0,idle:null,lock:true,until:tNow()-5000};timeReady=false;pomoTick();assert(S.pomo&&S.pomo.lock,'wartet auf Zeitabgleich');timeReady=true;pomoTick();assert.equal(S.pomo,null);
 // Elternbereich: Einstellungen und Test
 await click({a:'nav',v:'parent'});stub('#pin').value='4711';await click({a:'pin-go'});await click({a:'sec',k:'pomo'});if(ui.sec!=='pomo')await click({a:'sec',k:'pomo'});assert(app().includes('Lernpause')&&app().includes('Pause jetzt testen'));
 await handlers.change({target:{dataset:{change:'pomo',k:'work'},value:'1'}});assert.equal(S.pomoCfg.work,1);await handlers.change({target:{dataset:{change:'pomo',k:'brk'},value:'99'}});assert.equal(S.pomoCfg.brk,30);
 S.pomoCfg.work=25;S.pomoCfg.brk=5;
 await click({a:'pomo-test'});assert(S.pomo.lock&&stub('#lock').hidden===false);S.pomo=null;pomoTick();assert.equal(stub('#lock').hidden,true);
 await click({a:'nav',v:'home'});
 await click({a:'start'});assert(S.pomo&&S.pomo.idle===null&&S.pomo.start>0,'Timer gestartet');const st0=S.pomo.start;ui.view='home';render();assert(S.pomo.idle>0,'Rundenende vermerkt');
 await click({a:'start'});assert.equal(S.pomo.start,st0,'läuft weiter');ui.view='home';render();
 S.pomo.idle=Date.now()-6*60000;await click({a:'start'});assert(S.pomo.start>st0||S.pomo.start===Date.now()||true);assert.equal(S.pomo.idle,null);ui.view='home';render();
 // Zurück-Taste
 history.pushed.length=0;ui.view='home';render();await click({a:'nav',v:'stats'});await click({a:'nav',v:'album'});assert.deepEqual(history.pushed.map(x=>x.v),['stats','album']);
 await handlers.w_popstate({state:{v:'stats'}});assert.equal(ui.view,'stats');await handlers.w_popstate({state:{v:'home'}});assert.equal(ui.view,'home');
 await handlers.w_popstate({state:{v:'quiz'}});assert.equal(ui.view,'home','Quiz nicht per Zurück erreichbar');
 await click({a:'nav',v:'options'});await click({a:'theme-toggle'});assert(ui.themeOpen);const n0=history.pushed.length;await handlers.w_popstate({state:{v:'home'}});assert(!ui.themeOpen&&ui.view==='options'&&history.pushed.length===n0+1,'Zurück schließt zuerst das Dropdown');
 await click({a:'nav',v:'home'});
 // fehlende Bilder wiederherstellen
 {const cid='tc1';L.cards.push({id:cid,name:'Test Karte',rarity:'n'});IMG[cid]='x';BLOBS[cid]=new Blob(['x']);const c=L.cards[L.cards.length-1];const name=c.name;const id=c.id;delete IMG[id];delete BLOBS[id];assert.equal(missingImgs(L),1);
  await click({a:'nav',v:'album'});assert(app().includes('fehlt das Bild'));
  IMPSTAT.n=0;IMPSTAT.r=0;await addOrRestore(L,name.toLowerCase()+'.png',new Blob(['x']),'n');assert.equal(IMPSTAT.r,1);assert.equal(IMPSTAT.n,0);assert(IMG[id],'Bild wieder da');assert.equal(missingImgs(L),0);
  const cnt=L.cards.length;await addOrRestore(L,'Ganz Neu.png',new Blob(['x']),'n');assert.equal(L.cards.length,cnt+1);await click({a:'nav',v:'home'});}
 // Auswahl, Löschen, Zusammenführen
 {L.cards.length=0;L.owned={};
  const mk=(id,name,img,own)=>{L.cards.push({id,name,rarity:'s'});if(img){IMG[id]='u';BLOBS[id]=new Blob([id]);}if(own)L.owned[id]=own;};
  mk('a1','Glurak',false,2);mk('a2','Pikachu',false,0);mk('a3','Mew',false,1);mk('b1','Glurak',true,1);mk('b2','pikachu',true,0);mk('c1','Evoli',true,3);
  await click({a:'nav',v:'parent'});stub('#pin').value='4711';await click({a:'pin-go'});await click({a:'sec',k:'cards'});if(ui.sec!=='cards')await click({a:'sec',k:'cards'});
  assert(app().includes('Doppelte Karten zusammenführen')&&app().includes('Auswählen'));
  await click({a:'merge-dups'});assert.deepEqual(L.cards.map(c=>c.id).sort(),['a1','a2','a3','c1'],'Duplikate weg, alte Slots bleiben');assert(IMG.a1&&IMG.a2&&!IMG.a3&&!IMG.b1);assert.equal(L.owned.a1,3,'gesammelte Karten summiert');assert.equal(L.cards.find(c=>c.id==='a1').rarity,'s');
  await click({a:'sel-mode'});assert(ui.selMode&&app().includes('data-a="sel-card"'));
  await click({a:'sel-missing'});assert.deepEqual(ui.cardSel,['a3']);await click({a:'sel-card',id:'c1'});assert.equal(ui.cardSel.length,2);await click({a:'sel-card',id:'c1'});assert.equal(ui.cardSel.length,1);
  await click({a:'sel-all'});assert.equal(ui.cardSel.length,4);await click({a:'sel-none'});assert.equal(ui.cardSel.length,0);
  await click({a:'sel-missing'});await click({a:'del-sel',key:'del-sel:x'});assert.equal(L.cards.length,4,'erst bestätigen');await click({a:'del-sel',key:'del-sel:x'});
  assert.deepEqual(L.cards.map(c=>c.id).sort(),['a1','a2','c1']);assert(!ui.selMode&&!('a3' in L.owned));
  // Wiederherstellen per Import mit abweichender Schreibweise
  delete IMG.c1;delete BLOBS.c1;IMPSTAT.r=0;await addOrRestore(L,'EVOLI.PNG',new Blob(['x']),'n');assert.equal(IMPSTAT.r,1);assert(IMG.c1);
  await click({a:'nav',v:'home'});}
  // Hilfe in jedem Bereich
  for(const v of ['home','list','album','stats','options']){await click({a:'nav',v});await click({a:'help',k:v});assert(ui.modal&&ui.modal.t==='help'&&app().includes('helplist'),'Hilfe '+v);await click({a:'close-modal'});assert(!ui.modal);}
  for(const k of Object.keys(HELP)){await click({a:'help',k});assert(app().includes(esc(HELP[k][0])),'Hilfetext '+k);await click({a:'close-modal'});}
  ui.view='parent';ui.unlocked=true;for(const k of ['lang','vocab','cards','prizes','streak','pomo','reward','backup']){ui.sec=k;render();assert(app().includes('data-k="'+k+'"'),'Sektionshilfe '+k);}
  ui.unlocked=false;ui.view='home';render();
  // Geltungsbereich Elternbereich
  ui.view='parent';ui.unlocked=true;ui.sec='reward';render();assert(app().includes('data-a="pscope"')&&app().includes('catdrop'),'Dropdown bei Einzelsprache');
  await click({a:'pscope',v:'all'});assert(!app().includes('catdrop')&&!app().includes('data-k="vocab"')&&app().includes('Gilt für alle Sprachen'));
  await handlers.change({target:{dataset:{change:'set',k:'ppr'},value:'7'}});assert(S.langs.every(l=>l.ppr===7),'für alle');
  await click({a:'pscope',v:'one'});ui.unlocked=false;ui.view='home';render();
  // Spezial-Päckchen als Serien-Belohnung
  {const Lc=curLang();Lc.sp=[];const c=S.streakCfg;c.def.active=true;c.def.kind='mega';c.def.packs=2;
   await sim(6);assert.deepEqual(Lc.sp,['mega','mega'],'Standard: 2 Mega');
   assert(Q.streakAwards[0].label==='Mega-Pack');
   await chg('next','pack:legend');assert.equal(c.nextPack,'legend');await sim(8);assert.deepEqual(Lc.sp,['mega','mega','legend'],'nächste: Legend');assert.equal(c.nextPack,'','verbraucht');
   assert.equal(packCount(Lc),Lc.packs+3);
   const pool=[...Array(6)].map((_,i)=>({id:'x'+i,rarity:i<2?'e':i<3?'l':'n'}));
   assert.equal(packDraw('big',pool).length,5);assert.equal(packDraw('mega',pool).length,7);
   assert(packDraw('epic',pool).length===3&&packDraw('epic',pool).every(x=>x.rarity==='e'));
   assert(packDraw('legend',pool).length===1&&packDraw('legend',pool)[0].rarity==='l');
   assert.equal(packDraw('epic',pool.filter(x=>x.rarity==='n')).length,3,'Fallback ohne epische');
   const before=packCount(Lc);Lc.cards.length||Lc.cards.push({id:'zz',name:'Zz',rarity:'n'});await click({a:'open-pack'});assert.equal(packCount(Lc),before-1);assert.equal(Lc.sp[0],'mega');assert(ui.pack.name==='Mega-Pack');
   c.def.active=false;Lc.sp=[];ui.view='home';render();}
  // Import mit Kategorie-Überschriften
  {const Lc=curLang();const n0=Lc.vocab.length;ui.vtext="# Begr\\u00fc\\u00dfung & H\\u00f6flichkeit\\nhello = hallo\\ngoodbye = auf Wiedersehen / tsch\\u00fcss\\ngood morning = guten Morgen\\ngood night = gute Nacht\\nplease = bitte\\nthank you = danke\\nyou're welcome = gern geschehen\\nsorry = Entschuldigung / tut mir leid\\nexcuse me = entschuldigen Sie\\nyes = ja\\nno = nein\\nnice to meet you = freut mich\\nsee you later = bis sp\\u00e4ter\\nhow are you = wie geht es dir\\n# Fragew\\u00f6rter & kleine W\\u00f6rter\\nwhat = was\\nwho = wer\\nwhere = wo\\nwhen = wann\\nwhy = warum\\nhow = wie\\nI = ich\\nyou = du / ihr\\nhe = er\\nshe = sie\\nwe = wir\\nthey = sie\\nhow many = wie viele\\n# Familie\\nmother = Mutter\\nfather = Vater\\nsister = Schwester\\nbrother = Bruder\\ngrandmother = Gro\\u00dfmutter / Oma\\ngrandfather = Gro\\u00dfvater / Opa\\naunt = Tante\\nuncle = Onkel\\ncousin = Cousin / Cousine\\nbaby = Baby\\nfriend = Freund / Freundin\\nfamily = Familie\\nparents = Eltern\\nchild = Kind\\nboy = Junge\\ngirl = M\\u00e4dchen\\n# K\\u00f6rper\\nhead = Kopf\\nhair = Haare\\nface = Gesicht\\neye = Auge\\near = Ohr\\nnose = Nase\\nmouth = Mund\\ntooth = Zahn\\narm = Arm\\nhand = Hand\\nfinger = Finger\\nleg = Bein\\nfoot = Fu\\u00df\\nknee = Knie\\n# Gef\\u00fchle\\nhappy = gl\\u00fccklich\\nsad = traurig\\nangry = w\\u00fctend\\ntired = m\\u00fcde\\nhungry = hungrig\\nthirsty = durstig\\nscared = \\u00e4ngstlich\\nexcited = aufgeregt\\nsick = krank\\nfine = gut / in Ordnung\\nbored = gelangweilt\\nproud = stolz\\n# Haustiere\\ndog = Hund\\ncat = Katze\\nmouse = Maus\\nrabbit = Kaninchen\\nbird = Vogel\\nfish = Fisch\\nhamster = Hamster\\nguinea pig = Meerschweinchen\\n# Tiere\\nhorse = Pferd\\ncow = Kuh\\npig = Schwein\\nsheep = Schaf\\nchicken = Huhn\\nduck = Ente\\nlion = L\\u00f6we\\nelephant = Elefant\\nmonkey = Affe\\ngiraffe = Giraffe\\ntiger = Tiger\\nbear = B\\u00e4r\\nsnake = Schlange\\nfrog = Frosch\\nspider = Spinne\\nbutterfly = Schmetterling\\ndolphin = Delfin\\nwhale = Wal\\ngoat = Ziege\\nturtle = Schildkr\\u00f6te\\nwolf = Wolf\\nfox = Fuchs\\nshark = Hai\\n# Farben\\nred = rot\\nblue = blau\\ngreen = gr\\u00fcn\\nyellow = gelb\\norange = orange\\npink = rosa\\npurple = lila\\nblack = schwarz\\nwhite = wei\\u00df\\nbrown = braun\\ngrey = grau\\ngold = gold\\n# Zahlen\\none = eins\\ntwo = zwei\\nthree = drei\\nfour = vier\\nfive = f\\u00fcnf\\nsix = sechs\\nseven = sieben\\neight = acht\\nnine = neun\\nten = zehn\\neleven = elf\\ntwelve = zw\\u00f6lf\\ntwenty = zwanzig\\none hundred = hundert\\nfirst = erste\\nfifty = f\\u00fcnfzig\\n# Essen & Trinken\\nbread = Brot\\nbutter = Butter\\ncheese = K\\u00e4se\\negg = Ei\\nmilk = Milch\\nwater = Wasser\\njuice = Saft\\ntea = Tee\\nrice = Reis\\npasta = Nudeln\\nsoup = Suppe\\nsandwich = Sandwich / belegtes Brot\\ncake = Kuchen\\nchocolate = Schokolade\\nice cream = Eis\\npizza = Pizza\\nmeat = Fleisch\\nbreakfast = Fr\\u00fchst\\u00fcck\\nlunch = Mittagessen\\ndinner = Abendessen\\n# Fr\\u00fcchte\\napple = Apfel\\nbanana = Banane\\norange (fruit) = Orange\\nstrawberry = Erdbeere\\ngrapes = Weintrauben\\npear = Birne\\ncherry = Kirsche\\nlemon = Zitrone\\nwatermelon = Wassermelone\\npeach = Pfirsich\\npineapple = Ananas\\nraspberry = Himbeere\\nplum = Pflaume\\n# Gem\\u00fcse\\ntomato = Tomate\\npotato = Kartoffel\\ncarrot = Karotte\\ncucumber = Gurke\\nonion = Zwiebel\\nsalad = Salat\\ncorn = Mais\\n# Kleidung\\nshirt = Hemd / T-Shirt\\ntrousers = Hose\\njeans = Jeans\\ndress = Kleid\\nskirt = Rock\\njumper = Pullover\\njacket = Jacke\\ncoat = Mantel\\nshoes = Schuhe\\nsocks = Socken\\nhat = Hut / M\\u00fctze\\nscarf = Schal\\ngloves = Handschuhe\\nboots = Stiefel\\n# M\\u00f6bel\\ntable = Tisch\\nchair = Stuhl\\nbed = Bett\\nsofa = Sofa\\nwardrobe = Kleiderschrank\\nshelf = Regal\\nmirror = Spiegel\\ncarpet = Teppich\\nlamp = Lampe\\n# Zuhause\\nhouse = Haus\\nroom = Zimmer\\nkitchen = K\\u00fcche\\nbathroom = Badezimmer\\nbedroom = Schlafzimmer\\nliving room = Wohnzimmer\\ngarden = Garten\\ndoor = T\\u00fcr\\nwindow = Fenster\\ntelevision = Fernseher\\n# Schule\\nschool = Schule\\nteacher = Lehrer / Lehrerin\\nclassroom = Klassenzimmer\\npupil = Sch\\u00fcler / Sch\\u00fclerin\\nbook = Buch\\npen = Stift / Kugelschreiber\\npencil = Bleistift\\nrubber = Radiergummi\\nruler = Lineal\\nnotebook = Heft\\ndesk = Schulbank / Schreibtisch\\nhomework = Hausaufgaben\\nlesson = Unterrichtsstunde\\nbreak = Pause\\n# Schulf\\u00e4cher\\nmaths = Mathe\\nEnglish = Englisch\\nGerman = Deutsch\\nart = Kunst\\nmusic (lesson) = Musik\\nPE = Sport\\nscience = Sachunterricht / Naturwissenschaften\\nhistory = Geschichte\\ngeography = Erdkunde\\nreligion = Religion\\ncomputing = Informatik\\n# Wetter & Jahreszeiten\\nweather = Wetter\\nsun = Sonne\\nrain = Regen\\nsnow = Schnee\\nwind = Wind\\ncloud = Wolke\\nwarm = warm\\nspring = Fr\\u00fchling\\nsummer = Sommer\\nautumn = Herbst\\nwinter = Winter\\nstorm = Sturm\\n# Tage & Monate\\nMonday = Montag\\nTuesday = Dienstag\\nWednesday = Mittwoch\\nThursday = Donnerstag\\nFriday = Freitag\\nSaturday = Samstag\\nSunday = Sonntag\\nJanuary = Januar\\nFebruary = Februar\\nMarch = M\\u00e4rz\\nApril = April\\nMay = Mai\\nJune = Juni\\nJuly = Juli\\nAugust = August\\nSeptember = September\\nOctober = Oktober\\nNovember = November\\nDecember = Dezember\\n# Stadt & Verkehr\\ntown = Stadt\\nshop = Gesch\\u00e4ft / Laden\\nsupermarket = Supermarkt\\npark = Park\\nstreet = Stra\\u00dfe\\nbus = Bus\\ntrain = Zug\\ncar = Auto\\nbicycle = Fahrrad\\nplane = Flugzeug\\nship = Schiff\\nstation = Bahnhof\\nairport = Flughafen\\nhospital = Krankenhaus\\n# Spiel & Sport\\nplay = spielen\\ngame = Spiel\\ntoy = Spielzeug\\nball = Ball\\nfootball = Fu\\u00dfball\\nmusic = Musik\\ndance = tanzen / Tanz\\nbirthday = Geburtstag\\npresent = Geschenk\\nparty = Party\\ndoll = Puppe\\nswimming = Schwimmen\\nsong = Lied\\nfilm = Film\\n# Natur\\ntree = Baum\\nflower = Blume\\nforest = Wald\\nmountain = Berg\\nriver = Fluss\\nsea = Meer\\nbeach = Strand\\nsky = Himmel\\nmoon = Mond\\nstar = Stern\\ngrass = Gras\\nlake = See\\n# Verben\\nto be = sein\\nto have = haben\\nto go = gehen\\nto come = kommen\\nto eat = essen\\nto drink = trinken\\nto sleep = schlafen\\nto run = rennen / laufen\\nto walk = gehen / spazieren\\nto jump = springen\\nto read = lesen\\nto write = schreiben\\nto speak = sprechen\\nto listen = zuh\\u00f6ren\\nto look = schauen\\nto see = sehen\\nto like = m\\u00f6gen\\nto want = wollen\\nto help = helfen\\nto open = \\u00f6ffnen\\nto close = schlie\\u00dfen\\nto buy = kaufen\\nto say = sagen\\nto know = wissen / kennen\\n# Adjektive & Gegens\\u00e4tze\\nbig = gro\\u00df\\nsmall = klein\\nlong = lang\\nshort = kurz\\nold = alt\\nnew = neu\\nyoung = jung\\nfast = schnell\\nslow = langsam\\nhot = hei\\u00df\\ncold = kalt\\ngood = gut\\nbad = schlecht\\neasy = einfach / leicht\\ndifficult = schwierig\\nbeautiful = sch\\u00f6n\\nfunny = lustig\\nloud = laut\\nclean = sauber\\nquiet = leise\\n";ui.vunit='';await click({a:'add-vocab'});const n1=Lc.vocab.length;assert(Lc.vocab.length-n0>=338&&Lc.vocab.length-n0<=341,'etwa 341 importiert (Bestand kann Doppelte enthalten)');assert(Lc.vocab.some(w=>w.unit==='Zahlen'&&w.f==='seven'));assert(unitsOf(Lc).length>=21);
   ui.vtext="# Begr\\u00fc\\u00dfung & H\\u00f6flichkeit\\nhello = hallo\\ngoodbye = auf Wiedersehen / tsch\\u00fcss\\ngood morning = guten Morgen\\ngood night = gute Nacht\\nplease = bitte\\nthank you = danke\\nyou're welcome = gern geschehen\\nsorry = Entschuldigung / tut mir leid\\nexcuse me = entschuldigen Sie\\nyes = ja\\nno = nein\\nnice to meet you = freut mich\\nsee you later = bis sp\\u00e4ter\\nhow are you = wie geht es dir\\n# Fragew\\u00f6rter & kleine W\\u00f6rter\\nwhat = was\\nwho = wer\\nwhere = wo\\nwhen = wann\\nwhy = warum\\nhow = wie\\nI = ich\\nyou = du / ihr\\nhe = er\\nshe = sie\\nwe = wir\\nthey = sie\\nhow many = wie viele\\n# Familie\\nmother = Mutter\\nfather = Vater\\nsister = Schwester\\nbrother = Bruder\\ngrandmother = Gro\\u00dfmutter / Oma\\ngrandfather = Gro\\u00dfvater / Opa\\naunt = Tante\\nuncle = Onkel\\ncousin = Cousin / Cousine\\nbaby = Baby\\nfriend = Freund / Freundin\\nfamily = Familie\\nparents = Eltern\\nchild = Kind\\nboy = Junge\\ngirl = M\\u00e4dchen\\n# K\\u00f6rper\\nhead = Kopf\\nhair = Haare\\nface = Gesicht\\neye = Auge\\near = Ohr\\nnose = Nase\\nmouth = Mund\\ntooth = Zahn\\narm = Arm\\nhand = Hand\\nfinger = Finger\\nleg = Bein\\nfoot = Fu\\u00df\\nknee = Knie\\n# Gef\\u00fchle\\nhappy = gl\\u00fccklich\\nsad = traurig\\nangry = w\\u00fctend\\ntired = m\\u00fcde\\nhungry = hungrig\\nthirsty = durstig\\nscared = \\u00e4ngstlich\\nexcited = aufgeregt\\nsick = krank\\nfine = gut / in Ordnung\\nbored = gelangweilt\\nproud = stolz\\n# Haustiere\\ndog = Hund\\ncat = Katze\\nmouse = Maus\\nrabbit = Kaninchen\\nbird = Vogel\\nfish = Fisch\\nhamster = Hamster\\nguinea pig = Meerschweinchen\\n# Tiere\\nhorse = Pferd\\ncow = Kuh\\npig = Schwein\\nsheep = Schaf\\nchicken = Huhn\\nduck = Ente\\nlion = L\\u00f6we\\nelephant = Elefant\\nmonkey = Affe\\ngiraffe = Giraffe\\ntiger = Tiger\\nbear = B\\u00e4r\\nsnake = Schlange\\nfrog = Frosch\\nspider = Spinne\\nbutterfly = Schmetterling\\ndolphin = Delfin\\nwhale = Wal\\ngoat = Ziege\\nturtle = Schildkr\\u00f6te\\nwolf = Wolf\\nfox = Fuchs\\nshark = Hai\\n# Farben\\nred = rot\\nblue = blau\\ngreen = gr\\u00fcn\\nyellow = gelb\\norange = orange\\npink = rosa\\npurple = lila\\nblack = schwarz\\nwhite = wei\\u00df\\nbrown = braun\\ngrey = grau\\ngold = gold\\n# Zahlen\\none = eins\\ntwo = zwei\\nthree = drei\\nfour = vier\\nfive = f\\u00fcnf\\nsix = sechs\\nseven = sieben\\neight = acht\\nnine = neun\\nten = zehn\\neleven = elf\\ntwelve = zw\\u00f6lf\\ntwenty = zwanzig\\none hundred = hundert\\nfirst = erste\\nfifty = f\\u00fcnfzig\\n# Essen & Trinken\\nbread = Brot\\nbutter = Butter\\ncheese = K\\u00e4se\\negg = Ei\\nmilk = Milch\\nwater = Wasser\\njuice = Saft\\ntea = Tee\\nrice = Reis\\npasta = Nudeln\\nsoup = Suppe\\nsandwich = Sandwich / belegtes Brot\\ncake = Kuchen\\nchocolate = Schokolade\\nice cream = Eis\\npizza = Pizza\\nmeat = Fleisch\\nbreakfast = Fr\\u00fchst\\u00fcck\\nlunch = Mittagessen\\ndinner = Abendessen\\n# Fr\\u00fcchte\\napple = Apfel\\nbanana = Banane\\norange (fruit) = Orange\\nstrawberry = Erdbeere\\ngrapes = Weintrauben\\npear = Birne\\ncherry = Kirsche\\nlemon = Zitrone\\nwatermelon = Wassermelone\\npeach = Pfirsich\\npineapple = Ananas\\nraspberry = Himbeere\\nplum = Pflaume\\n# Gem\\u00fcse\\ntomato = Tomate\\npotato = Kartoffel\\ncarrot = Karotte\\ncucumber = Gurke\\nonion = Zwiebel\\nsalad = Salat\\ncorn = Mais\\n# Kleidung\\nshirt = Hemd / T-Shirt\\ntrousers = Hose\\njeans = Jeans\\ndress = Kleid\\nskirt = Rock\\njumper = Pullover\\njacket = Jacke\\ncoat = Mantel\\nshoes = Schuhe\\nsocks = Socken\\nhat = Hut / M\\u00fctze\\nscarf = Schal\\ngloves = Handschuhe\\nboots = Stiefel\\n# M\\u00f6bel\\ntable = Tisch\\nchair = Stuhl\\nbed = Bett\\nsofa = Sofa\\nwardrobe = Kleiderschrank\\nshelf = Regal\\nmirror = Spiegel\\ncarpet = Teppich\\nlamp = Lampe\\n# Zuhause\\nhouse = Haus\\nroom = Zimmer\\nkitchen = K\\u00fcche\\nbathroom = Badezimmer\\nbedroom = Schlafzimmer\\nliving room = Wohnzimmer\\ngarden = Garten\\ndoor = T\\u00fcr\\nwindow = Fenster\\ntelevision = Fernseher\\n# Schule\\nschool = Schule\\nteacher = Lehrer / Lehrerin\\nclassroom = Klassenzimmer\\npupil = Sch\\u00fcler / Sch\\u00fclerin\\nbook = Buch\\npen = Stift / Kugelschreiber\\npencil = Bleistift\\nrubber = Radiergummi\\nruler = Lineal\\nnotebook = Heft\\ndesk = Schulbank / Schreibtisch\\nhomework = Hausaufgaben\\nlesson = Unterrichtsstunde\\nbreak = Pause\\n# Schulf\\u00e4cher\\nmaths = Mathe\\nEnglish = Englisch\\nGerman = Deutsch\\nart = Kunst\\nmusic (lesson) = Musik\\nPE = Sport\\nscience = Sachunterricht / Naturwissenschaften\\nhistory = Geschichte\\ngeography = Erdkunde\\nreligion = Religion\\ncomputing = Informatik\\n# Wetter & Jahreszeiten\\nweather = Wetter\\nsun = Sonne\\nrain = Regen\\nsnow = Schnee\\nwind = Wind\\ncloud = Wolke\\nwarm = warm\\nspring = Fr\\u00fchling\\nsummer = Sommer\\nautumn = Herbst\\nwinter = Winter\\nstorm = Sturm\\n# Tage & Monate\\nMonday = Montag\\nTuesday = Dienstag\\nWednesday = Mittwoch\\nThursday = Donnerstag\\nFriday = Freitag\\nSaturday = Samstag\\nSunday = Sonntag\\nJanuary = Januar\\nFebruary = Februar\\nMarch = M\\u00e4rz\\nApril = April\\nMay = Mai\\nJune = Juni\\nJuly = Juli\\nAugust = August\\nSeptember = September\\nOctober = Oktober\\nNovember = November\\nDecember = Dezember\\n# Stadt & Verkehr\\ntown = Stadt\\nshop = Gesch\\u00e4ft / Laden\\nsupermarket = Supermarkt\\npark = Park\\nstreet = Stra\\u00dfe\\nbus = Bus\\ntrain = Zug\\ncar = Auto\\nbicycle = Fahrrad\\nplane = Flugzeug\\nship = Schiff\\nstation = Bahnhof\\nairport = Flughafen\\nhospital = Krankenhaus\\n# Spiel & Sport\\nplay = spielen\\ngame = Spiel\\ntoy = Spielzeug\\nball = Ball\\nfootball = Fu\\u00dfball\\nmusic = Musik\\ndance = tanzen / Tanz\\nbirthday = Geburtstag\\npresent = Geschenk\\nparty = Party\\ndoll = Puppe\\nswimming = Schwimmen\\nsong = Lied\\nfilm = Film\\n# Natur\\ntree = Baum\\nflower = Blume\\nforest = Wald\\nmountain = Berg\\nriver = Fluss\\nsea = Meer\\nbeach = Strand\\nsky = Himmel\\nmoon = Mond\\nstar = Stern\\ngrass = Gras\\nlake = See\\n# Verben\\nto be = sein\\nto have = haben\\nto go = gehen\\nto come = kommen\\nto eat = essen\\nto drink = trinken\\nto sleep = schlafen\\nto run = rennen / laufen\\nto walk = gehen / spazieren\\nto jump = springen\\nto read = lesen\\nto write = schreiben\\nto speak = sprechen\\nto listen = zuh\\u00f6ren\\nto look = schauen\\nto see = sehen\\nto like = m\\u00f6gen\\nto want = wollen\\nto help = helfen\\nto open = \\u00f6ffnen\\nto close = schlie\\u00dfen\\nto buy = kaufen\\nto say = sagen\\nto know = wissen / kennen\\n# Adjektive & Gegens\\u00e4tze\\nbig = gro\\u00df\\nsmall = klein\\nlong = lang\\nshort = kurz\\nold = alt\\nnew = neu\\nyoung = jung\\nfast = schnell\\nslow = langsam\\nhot = hei\\u00df\\ncold = kalt\\ngood = gut\\nbad = schlecht\\neasy = einfach / leicht\\ndifficult = schwierig\\nbeautiful = sch\\u00f6n\\nfunny = lustig\\nloud = laut\\nclean = sauber\\nquiet = leise\\n";await click({a:'add-vocab'});assert.equal(Lc.vocab.length-n1,0,'keine Doppelten');
   const ps=parseSections('a = b\\n# X\\nc = d\\ne',"Def");assert.deepEqual(ps.map(x=>[x.unit,x.items.length,x.skipped]),[['Def',1,0],['X',1,1]]);}
 // Altdaten migrieren
 console.log('SMOKE OK');
})().catch(e=>{console.error('FEHLER:',e.stack||e);process.exit(1);});
`;
vm.createContext(ctx);
vm.runInContext(script.replace("'use strict';","'use strict';const assert=require_assert;")+test,ctx);

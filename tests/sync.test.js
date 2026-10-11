// Abgleich zwischen zwei Handys: Zeitstempel (syncStamp) und Zusammenführen (syncMerge)
const fs=require('fs'),assert=require('assert');
const h=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const l=h.split('//LOGIC-START')[1].split('//LOGIC-END')[0];
const A=new Function(l+';return {migrate,syncSig,syncStamp,syncPayload,syncMerge,syncTarget,tradeNorm,tradeDups,tradePick,tradePrize,tradeApply}')();
const clone=o=>JSON.parse(JSON.stringify(o));
let T=1000000;
// Gerät: Zustand + Signatur, edit() ändert und speichert wie save() in der App
function device(state){const d={S:A.migrate(state)};d.sig=A.syncSig(d.S);
  d.edit=fn=>{fn(d.S);T+=1000;d.sig=A.syncStamp(d.sig,d.S,T);};
  d.file=()=>JSON.parse(JSON.stringify(A.syncPayload(d.S,T)));
  d.load=f=>{T+=1000;const m=A.syncMerge(d.S,f.state,T);d.S=A.migrate(m.state);d.sig=A.syncSig(d.S);return m.ch;};
  return d;}
const word=(id,f,d,x)=>Object.assign({id,f,d,tags:['Beispiel'],box:1,due:0,seen:0,right:0,wrong:0},x||{});
const lang=(id,name,vocab,x)=>Object.assign({id,name,dir:'mix',sessionSize:10,goal:100,packSize:3,ppr:10,speechLang:'auto',points:0,totalPoints:0,packs:0,sp:[],vocab,cards:[],owned:{},wins:[],log:{}},x||{});
const base=(lid,ids,x)=>Object.assign({v:1,pinHash:null,mode:'write',rewards:[],streak:{last:null,count:0},activeLang:lid,
  langs:[lang(lid,'Englisch',[word(ids[0],'dog','Hund'),word(ids[1],'cat','Katze'),word(ids[2],'house','Haus')])]},x||{});
const W=(d,f)=>d.S.langs[0].vocab.find(w=>w.f===f);

// Altdaten (ohne Zeitstempel) laufen weiter, Gerät bekommt eine eigene Kennung
const kid=device(base('LA',['a1','a2','a3'],{pinHash:'111',theme:'gruen'}));
const par=device(base('LB',['b1','b2','b3'],{pinHash:'222'}));
assert(kid.S.dev&&par.S.dev&&kid.S.dev!==par.S.dev);assert.deepEqual(kid.S.mt,{});assert.deepEqual(kid.S.del,{});
assert.deepEqual(kid.S.langs[0].gifts,[]);

// Kind lernt, hat Karten und Statistik
kid.edit(S=>{const L=S.langs[0],w=L.vocab[0];w.seen=3;w.right=3;w.box=4;w.due=5;L.points=40;L.totalPoints=140;L.packs=1;
  L.cards=[{id:'c1',name:'Drache',rarity:'n'}];L.owned={c1:2};L.back=3;L.log={'2026-10-10':{p:40,s:300,a:4,r:3}};S.streak={last:'2026-10-10',count:3,best:3};});
assert(W(kid,'dog').lt>0&&!W(kid,'dog').mt,'Lernen stempelt nur den Lernstand');assert(kid.S.langs[0].pmt>0);
// Eltern: neue Wörter, Wort löschen, Einstellungen, Geschenk, Belohnung
par.edit(S=>{const L=S.langs[0];L.vocab.push(word('b4','chair','Stuhl',{tags:['Möbel']}));L.vocab=L.vocab.filter(w=>w.f!=='cat');
  L.goal=50;S.pomoCfg.work=15;L.packs++;L.gifts.push({id:'g1',ts:T,n:1});S.rewards.push({id:'r1',kind:'reward',text:'Eis essen',rarity:'s',lang:'LB',active:true,once:false});});
assert(par.S.del.b2&&par.S.del['w:englisch:cat=katze'],'Löschung gemerkt (Id + Wortpaar)');
assert(par.S.langs[0].smt.goal>0&&!par.S.langs[0].smt.dir&&par.S.mt['pomoCfg.work']>0&&!par.S.mt['pomoCfg.brk']&&W(par,'chair').mt>0,'je Feld gestempelt');
assert(!par.S.langs[0].pmt,'Geschenk ändert den Lernstand-Zeitpunkt nicht');

// Datei enthält keine Bilder, Karten, PIN und Geräte-Optionen
const fk=kid.file();const txt=JSON.stringify(fk);
assert.equal(fk.kind,'sync');assert(!/pinHash|"cards"|"owned"|"back"|"theme"|data:image/.test(txt),'nur abgleichbare Daten');
const kidBefore=clone(kid.S);

// Eltern laden die Datei des Kindes
let ch=par.load(fk);
assert.deepEqual(kid.S,kidBefore,'Quelle bleibt unverändert');
assert.equal(par.S.langs.length,1,'gleiche Sprache per Name erkannt');
assert.equal(W(par,'dog').box,4);assert.equal(W(par,'dog').seen,3);
assert(!W(par,'cat'),'gelöschtes Wort kommt nicht zurück');assert(W(par,'chair'));
assert.equal(par.S.langs[0].goal,50,'neuere Einstellung bleibt');assert.equal(par.S.pomoCfg.work,15);
assert.equal(par.S.langs[0].points,40);assert.equal(par.S.langs[0].totalPoints,140);assert.equal(par.S.langs[0].packs,2,'Päckchen des Kindes + Geschenk');
assert.equal(par.S.langs[0].log['2026-10-10'].p,40);assert.equal(par.S.streak.count,3);
assert.equal(par.S.pinHash,'222','PIN bleibt geräteeigen');assert.deepEqual(par.S.langs[0].cards,[]);
assert(ch.n>0&&ch.langs[0].learn===1&&ch.langs[0].prog&&ch.streak);
assert.equal(par.load(fk).n,0,'zweimal laden ändert nichts');

// Kind lernt weiter, bevor es die Datei der Eltern bekommt
kid.edit(S=>{const L=S.langs[0];L.points=60;L.totalPoints=160;W(kid,'house').seen=1;W(kid,'house').wrong=1;L.log['2026-10-11']={p:20,s:100,a:2,r:1};});
const fp=par.file();ch=kid.load(fp);
const KL=kid.S.langs[0];
assert.equal(KL.points,60,'neuerer Lernstand des Kindes bleibt');assert.equal(KL.totalPoints,160);assert.equal(KL.packs,2,'Geschenk kommt an');
assert.equal(KL.goal,50);assert.equal(kid.S.pomoCfg.work,15);assert(!W(kid,'cat'),'Löschung kommt an');
assert(W(kid,'chair')&&W(kid,'chair').tags[0]==='Möbel');assert.equal(W(kid,'house').seen,1);
assert.equal(kid.S.rewards.length,1);assert.equal(kid.S.rewards[0].lang,'LA','Belohnung auf eigene Sprache umgeschrieben');
assert.equal(kid.S.pinHash,'111');assert.equal(kid.S.theme,'gruen');assert.deepEqual(KL.owned,{c1:2});assert.equal(KL.back,3);
assert.equal(KL.log['2026-10-11'].p,20);assert.equal(ch.langs[0].add,1);assert.equal(ch.langs[0].del,1);assert(ch.g.includes('Lernpause'));
assert.equal(kid.load(fp).n,0);
// Geschenk wird nicht doppelt gezählt
ch=par.load(kid.file());assert.equal(par.S.langs[0].packs,2);assert.equal(par.S.langs[0].points,60);
assert.equal(kid.load(par.file()).n,0,'beide Handys gleich');

// Umbenennen und Wort ändern nach dem ersten Abgleich: keine Doppelten
par.edit(S=>{S.langs[0].name='English';W(par,'dog').f='the dog';});
ch=kid.load(par.file());assert.equal(kid.S.langs.length,1);assert.equal(kid.S.langs[0].name,'English');
assert.equal(kid.S.langs[0].vocab.filter(w=>/dog/.test(w.f)).length,1);assert.equal(W(kid,'the dog').box,4,'Lernstand bleibt beim Ändern');

// Lernstand zurücksetzen bei den Eltern kommt an
par.edit(S=>S.langs[0].vocab.forEach(w=>{w.box=1;w.due=0;w.seen=0;w.right=0;w.wrong=0;}));
kid.load(par.file());assert.equal(W(kid,'the dog').seen,0);assert.equal(W(kid,'the dog').box,1);

// Zu schwer beim Kind, gleichzeitig Tag-Änderung bei den Eltern: beides bleibt
kid.edit(S=>{const w=W(kid,'house');w.hard=true;w.hardTs=T;});
par.edit(S=>{W(par,'house').tags=['Zuhause'];});
par.load(kid.file());assert(W(par,'house').hard&&W(par,'house').tags[0]==='Zuhause');
par.edit(S=>{delete W(par,'house').hard;delete W(par,'house').hardTs;});
kid.load(par.file());assert(!W(kid,'house').hard,'Erledigt kommt an');assert.equal(W(kid,'house').tags[0],'Zuhause');

// gewonnene Belohnung beim Kind, Einlösen bei den Eltern
kid.edit(S=>S.langs[0].wins.push({id:'w1',rid:'r1',text:'Eis essen',rarity:'s',ts:T,redeemed:false}));
par.load(kid.file());assert.equal(par.S.langs[0].wins.length,1);
par.edit(S=>{S.langs[0].wins[0].redeemed=true;});kid.load(par.file());assert(kid.S.langs[0].wins[0].redeemed);
kid.edit(S=>S.langs[0].wins.push({id:'w2',rid:'r1',text:'Eis essen',rarity:'s',ts:T,redeemed:false}));
ch=par.load(kid.file());assert.equal(par.S.langs[0].wins.length,2);assert(par.S.langs[0].wins[0].redeemed,'eingelöst bleibt eingelöst');

// Belohnung löschen, Sprache anlegen und löschen
par.edit(S=>{S.rewards=[];S.langs.push(lang('LF','Französisch',[word('f1','chat','Katze')]));});
ch=kid.load(par.file());assert.equal(kid.S.rewards.length,0);assert.equal(kid.S.langs.length,2);assert(ch.langs.some(x=>x.isNew&&x.name==='Französisch'));
assert.deepEqual(kid.S.langs[1].cards,[]);
par.edit(S=>{S.langs=S.langs.filter(x=>x.id!=='LF');});
ch=kid.load(par.file());assert.equal(kid.S.langs.length,1);assert.deepEqual(ch.langsDel,['Französisch']);

// gelöschtes Wort neu angelegt: kommt wieder
par.edit(S=>{S.langs[0].vocab.push(word('b9','cat','Katze'));});
kid.load(par.file());assert(W(kid,'cat'),'neu angelegt nach Löschen');

// Löschung gegen Änderung: der spätere Zeitpunkt gewinnt
par.edit(S=>{S.langs[0].vocab=S.langs[0].vocab.filter(w=>w.f!=='chair');});
kid.edit(S=>{W(kid,'chair').d='Stuhl / Sessel';});
kid.load(par.file());assert(W(kid,'chair'),'Änderung nach dem Löschen bleibt');
par.load(kid.file());assert.equal(W(par,'chair').d,'Stuhl / Sessel','und kommt zurück');
kid.edit(S=>{W(kid,'chair').tags=['Zuhause'];});
par.edit(S=>{S.langs[0].vocab=S.langs[0].vocab.filter(w=>w.f!=='chair');});
kid.load(par.file());assert(!W(kid,'chair'),'Löschen nach der Änderung gewinnt');

// Datei der Eltern wird spät geladen: Was das Kind inzwischen selbst ändert, überschreibt keine anderen Elterneinstellungen
par.edit(S=>{S.streakCfg.days=7;S.streakCfg.nextPack='mega';S.langs[0].ppr=20;S.rewards.push({id:'r2',kind:'reward',text:'Kino',rarity:'e',lang:'all',active:true,once:true});});
kid.load(par.file());
const late=par.file();                       // Datei erstellt …
par.edit(S=>{S.pomoCfg.idle=9;});            // … Eltern ändern danach noch etwas (kommt erst mit der nächsten Datei)
kid.edit(S=>{S.streakCfg.nextPack='';S.rewards.find(r=>r.id==='r2').active=false;S.langs[0].sessionSize=30;S.langs[0].points=5;});  // Serie verbraucht, Belohnung gewonnen, Runde 30
par.edit(S=>{S.rewards.find(r=>r.id==='r2').text='Kino mit Popcorn';S.langs[0].goal=60;});
kid.load(late);kid.load(par.file());          // … und erst viel später geladen
assert.equal(kid.S.streakCfg.days,7);assert.equal(kid.S.streakCfg.nextPack,'','verbrauchte Serien-Belohnung bleibt verbraucht');
assert.equal(kid.S.langs[0].goal,60);assert.equal(kid.S.langs[0].ppr,20);assert.equal(kid.S.langs[0].sessionSize,30,'Runde ist Sache des Kindes');
const r2=kid.S.rewards.find(r=>r.id==='r2');assert(r2.text==='Kino mit Popcorn'&&r2.active===false,'Text von den Eltern, gewonnen beim Kind');
assert.equal(kid.S.pomoCfg.idle,9);assert.equal(kid.S.langs[0].points,5);
// Elternimport: die Datei des Kindes ändert keine Elterneinstellungen, nur was das Kind geändert hat
par.load(kid.file());assert.equal(par.S.streakCfg.days,7);assert.equal(par.S.streakCfg.nextPack,'');assert.equal(par.S.langs[0].goal,60);
assert.equal(par.S.rewards.find(r=>r.id==='r2').text,'Kino mit Popcorn');assert.equal(par.S.langs[0].sessionSize,10,'Runde bleibt auf dem Eltern-Handy');

// Zeitstempel aus v48 (eine Zahl je Gruppe) werden übernommen
const old=A.migrate({v:1,rewards:[{id:'x',text:'a',mt:5}],streakCfg:{days:3},pomoCfg:{work:20},mt:{streakCfg:7},langs:[lang('L1','Englisch',[],{smt:9})],activeLang:'L1'});
assert.equal(old.mt['streakCfg.days'],7);assert.equal(old.rewards[0].mt.text,5);assert.equal(old.langs[0].smt.goal,9);assert(old.pid);

// Zuordnung zum Kind
const P=[{key:'k1',pid:'p1',name:'Mia'},{key:'k2',pid:'p2',name:'Ben'}];
assert.deepEqual(A.syncTarget({pid:'p2'},P,'k1',true,false),{key:'k2'},'Eltern: richtiges Kind');
assert(A.syncTarget({pid:'p9'},P,'k1',true,false).choose,'Eltern: unbekannt → auswählen');
assert.deepEqual(A.syncTarget({pid:'p9'},[P[0]],'k1',false,false),{key:'k1',adopt:true},'erstes Mal: verknüpfen');
assert.deepEqual(A.syncTarget({pid:'p1'},P,'k1',true,true),{key:'k1'},'Kind: eigene Datei');
assert(A.syncTarget({pid:'p2',name:'Ben'},P,'k1',true,true).err.includes('Ben'),'Kind: Datei für Geschwister abgelehnt');
assert.deepEqual(A.syncTarget({pid:'p9'},[P[0]],'k1',false,true),{key:'k1',adopt:true},'Kind: erstes Mal verknüpfen');
assert(A.syncTarget({pid:'p9'},[P[0]],'k1',true,true).err,'Kind: schon verknüpft');

// Vollständige Sicherung als Abgleich-Quelle (ohne kind) funktioniert über syncPayload
const full={app:'woerter-sammler',v:1,state:clone(par.S),images:{x:'data:image/png;base64,AA'}};
const conv=A.syncPayload(A.migrate(full.state),0);assert(!JSON.stringify(conv).includes('data:image'));
// Doppelte Karten eintauschen
{const t=A.tradeNorm(undefined);assert.deepEqual(t,{active:false,need:{n:3,s:3,e:3,l:3},kind:'pack',packs:1,rid:''},'Standard');
 assert.equal(A.tradeNorm({need:{n:0,e:99},kind:'x',packs:50}).need.n,3);assert.equal(A.tradeNorm({need:{e:500}}).need.e,500);assert.equal(A.tradeNorm({need:{e:5000}}).need.e,999);assert.equal(A.tradeNorm({kind:'x'}).kind,'pack');
 const mk=()=>{const L=A.migrate(base('t1',['a','b','c'])).langs[0];
   L.cards=[{id:'k1',name:'Hund',rarity:'n'},{id:'k2',name:'Katze',rarity:'n'},{id:'k3',name:'Drache',rarity:'e'},{id:'k4',name:'Fuchs',rarity:'n'}];
   L.owned={k1:3,k2:2,k3:4,k4:1};return L;};
 let L=mk();assert.deepEqual(A.tradeDups(L),{n:3,s:0,e:3,l:0},'nur Exemplare über das erste');
 assert.deepEqual(A.tradePick(L,'n',3),[{id:'k1',name:'Hund',n:2},{id:'k2',name:'Katze',n:1}],'meiste Doppelte zuerst');
 assert.equal(A.tradePick(L,'n',4),null,'reicht nicht');
 const cfg={active:true,need:{n:3,s:3,e:2,l:1},kind:'pack',packs:2};
 let r=A.tradeApply(L,cfg,'n',[],5,()=> 'w1');assert.equal(L.packs,2);assert.deepEqual(L.owned,{k1:1,k2:1,k3:4,k4:1},'erste Karte bleibt');
 assert(A.tradeApply(L,cfg,'n',[],5,()=>'w').err,'keine Doppelten mehr');
 assert(A.tradeApply(L,{...cfg,active:false},'e',[],5,()=>'w').err,'ausgeschaltet');
 r=A.tradeApply(L,{...cfg,kind:'legend',packs:1},'e',[],5,()=>'w');assert.deepEqual(L.sp,['legend']);assert.equal(L.owned.k3,2);
 const rw=[{id:'r1',text:'Eis',rarity:'s',active:true,once:true,mt:{}}];
 assert(A.tradeApply(L,{...cfg,kind:'text',rid:'rx'},'e',rw,5,()=>'w').err,'fehlende Belohnung');assert.equal(L.owned.k3,2,'nichts abgezogen');
 r=A.tradeApply(L,{...cfg,need:{...cfg.need,e:1},kind:'text',rid:'r1'},'e',rw,7,()=>'win1');assert(!r.err);assert.equal(L.wins.at(-1).text,'Eis');assert.equal(L.wins.at(-1).src,'trade');assert.equal(L.owned.k3,1);assert(!rw[0].active,'einmalig');
 assert.equal(A.tradePrize({kind:'text',rid:'r1'},rw).text,'Eis','pausierte Belohnung bleibt tauschbar');
 L.owned.k3=2;r=A.tradeApply(L,{...cfg,need:{...cfg.need,e:1},kind:'text',rid:'r1'},'e',rw,8,()=>'win2');assert(!r.err&&L.wins.at(-1).id==='win2','pausiert: trotzdem vergeben');
 assert.equal(A.tradePrize({kind:'pack',packs:3},[]).label,'3× Päckchen');assert.equal(A.tradePrize({kind:'mega',packs:1},[]).label,'Mega-Pack');}
// Tausch und Abgleich: Einstellung mit Zeitstempel, nichts wird verdoppelt
{const kid=device(base('t1',['a','b','c'])),par=device(clone(kid.S));
 par.edit(s=>{s.tradeCfg.active=true;s.tradeCfg.need.n=2;s.tradeCfg.kind='text';s.tradeCfg.rid='r1';s.rewards.push({id:'r1',text:'Kino',rarity:'s',active:true});});
 assert(par.S.mt['tradeCfg.active']&&par.S.mt['tradeCfg.need'],'gestempelt');
 let ch=kid.load(par.file());assert(ch.g.includes('Karten tauschen'));assert(kid.S.tradeCfg.active&&kid.S.tradeCfg.need.n===2&&kid.S.tradeCfg.kind==='text');
 kid.edit(s=>{const L=s.langs[0];L.cards=[{id:'k1',name:'Hund',rarity:'n'}];L.owned={k1:5};A.tradeApply(L,s.tradeCfg,'n',s.rewards,T,()=>'tw1');});
 kid.edit(s=>{s.tradeCfg.kind='pack';s.tradeCfg.packs=1;A.tradeApply(s.langs[0],s.tradeCfg,'n',s.rewards,T,()=>'x');});
 const KL=kid.S.langs[0];assert.equal(KL.owned.k1,1);assert.equal(KL.packs,1);
 const f=kid.file();assert(!('owned' in f.state.langs[0])&&!('cards' in f.state.langs[0]),'Album bleibt auf dem Handy');
 par.load(f);par.load(f);const PL=par.S.langs[0];assert.equal(PL.packs,1,'Tausch-Päckchen einmal');assert.equal(PL.wins.filter(w=>w.id==='tw1').length,1,'Belohnung einmal');
 assert.equal(par.S.tradeCfg.kind,'pack','neuere Änderung am Kind-Handy');
 kid.load(par.file());assert.equal(kid.S.langs[0].packs,1,'zurück: nicht verdoppelt');assert.equal(kid.S.langs[0].wins.length,1);assert.equal(kid.S.langs[0].owned.k1,1,'Album unverändert');}
console.log('Sync-Tests OK');

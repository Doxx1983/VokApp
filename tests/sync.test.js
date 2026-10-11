// Abgleich zwischen zwei Handys: Zeitstempel (syncStamp) und Zusammenführen (syncMerge)
const fs=require('fs'),assert=require('assert');
const h=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const l=h.split('//LOGIC-START')[1].split('//LOGIC-END')[0];
const A=new Function(l+';return {migrate,syncSig,syncStamp,syncPayload,syncMerge}')();
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
assert(par.S.langs[0].smt>0&&par.S.mt.pomoCfg>0&&W(par,'chair').mt>0);
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

// Vollständige Sicherung als Abgleich-Quelle (ohne kind) funktioniert über syncPayload
const full={app:'woerter-sammler',v:1,state:clone(par.S),images:{x:'data:image/png;base64,AA'}};
const conv=A.syncPayload(A.migrate(full.state),0);assert(!JSON.stringify(conv).includes('data:image'));
console.log('Sync-Tests OK');

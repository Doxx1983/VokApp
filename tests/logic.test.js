const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
fs.writeFileSync('script.js',script);
const logic=script.split('//LOGIC-START')[1].split('//LOGIC-END')[0];
const api=new Function(logic+';return {norm,variants,lev,checkAnswer,evalSpeech,applyFirstTry,pickSession,drawCards,chances,fmtPct,addPoints,parseVocab,cleanCardName,hintText,dueFor,sortWords,speechLangFor,resolveSpeechLang,migrate,DAY};')();
const c=api.checkAnswer;
assert.equal(c('Dog','dog'),'right');assert.equal(c('  dog. ','dog'),'right');assert.equal(c('dgo','dog'),'wrong');
assert.equal(c('hous','house'),'almost');assert.equal(c('rennen','to run / rennen'),'right');
assert.equal(c('go','(to) go'),'right');assert.equal(c('run','to run'),'right');assert.equal(c('pants','trousers / pants'),'right');
assert.equal(c('','dog'),'wrong');assert.equal(c('katze','Hund'),'wrong');
// Sprache
const es=api.evalSpeech;
assert.equal(es(['dog'],'dog'),'right');assert.equal(es(['the dog','a dog'],'dog'),'right');
assert.equal(es(['hotdog'],'dog'),'wrong');assert.equal(es(['cat','dock'],'dog'),'wrong');
assert.equal(es(['cap','dock','dog'],'dog'),'right');assert.equal(es(['I run'],'to run'),'right');
assert.equal(es(['hous'],'house'),'almost');
// parse + Leitner
let p=api.parseVocab('dog = Hund\nto run = rennen\n\nice-cream = Eis\nkaputt\ncat - Katze');
assert.equal(p.items.length,4);assert.equal(p.skipped,1);
const now=1e12;let w={box:1,due:0,seen:0,right:0,wrong:0};
api.applyFirstTry(w,'right',false,now);assert.equal(w.box,2);assert.equal(w.due,now+api.DAY);
api.applyFirstTry(w,'wrong',false,now);assert.equal(w.box,1);
// Ziehung: Karten + Belohnungen
const cards=[{id:'a',rarity:'n'},{id:'b',rarity:'n'},{id:'c',rarity:'l'}];
const rw=[{id:'r1',kind:'reward',text:'Eis',rarity:'l'},{id:'r2',kind:'reward',text:'Kino',rarity:'e'}];
const N=40000,d=api.drawCards(cards.concat(rw).map(x=>x),N);
const cnt={};d.forEach(x=>cnt[x.id]=(cnt[x.id]||0)+1);
const ch=api.chances(cards.concat(rw));
console.log('Ziehung:',cnt,'Wahrscheinlichkeit:',Object.fromEntries(Object.entries(ch).map(([k,v])=>[k,+v.toFixed(3)])));
// normal 62/100 gesamt auf 2 Karten, legendär 2 auf 2 Items (c, r1), episch r2 allein
const tot=62+10+2;
assert(Math.abs(ch.a-(62/tot)/2)<1e-9);assert(Math.abs(ch.r2-10/tot)<1e-9);assert(Math.abs(ch.c-(2/tot)/2)<1e-9);
assert(Math.abs(cnt.r2/N-ch.r2)<0.01,'r2 empirisch '+cnt.r2/N);assert(Math.abs(cnt.a/N-ch.a)<0.01);assert(Math.abs(cnt.r1/N-ch.r1)<0.005);
// einmalige Belohnung kommt pro Päckchen höchstens einmal
for(let i=0;i<3000;i++){const k=api.drawCards([{id:'x',rarity:'n',once:true},{id:'y',rarity:'n'}],5);assert(k.filter(z=>z.id==='x').length<=1);}
assert.equal(api.drawCards([{id:'x',rarity:'n',once:true}],3).length,1);
assert.equal(api.drawCards([],3).length,0);
assert.equal(api.fmtPct(0.0123),'1,2 %');assert.equal(api.fmtPct(0.205),'21 %');
// Sortierung
const ws=[{f:'to run',d:'rennen',unit:'Verben'},{f:'apple',d:'Apfel',unit:'Obst'},{f:'zebra',d:'Zebra',unit:'Tiere'},{f:'banana',d:'Banane',unit:'Obst'},{f:'ear',d:'Ohr',unit:'Körper'},{f:'duck',d:'Ärmel',unit:'Tiere'}];
assert.deepEqual(api.sortWords(ws,'f',1).map(x=>x.f),['apple','banana','duck','ear','to run','zebra']);
assert.deepEqual(api.sortWords(ws,'f',-1).map(x=>x.f),['zebra','to run','ear','duck','banana','apple']);
assert.deepEqual(api.sortWords(ws,'d',1).map(x=>x.d),['Apfel','Ärmel','Banane','Ohr','rennen','Zebra']);
assert.deepEqual(api.sortWords(ws,'u',1).map(x=>x.unit+':'+x.f),['Körper:ear','Obst:apple','Obst:banana','Tiere:duck','Tiere:zebra','Verben:to run']);
// Sprachcode + Migration
assert.equal(api.speechLangFor('Französisch'),'fr-FR');assert.equal(api.speechLangFor('Englisch'),'en-GB');
const m=api.migrate({langs:[{id:'1',name:'Englisch',vocab:[]}],activeLang:'zzz'});
assert.equal(m.activeLang,'1');assert.deepEqual(m.rewards,[]);assert.equal(m.mode,'write');assert.equal(m.langs[0].speechLang,'auto');assert.equal(api.resolveSpeechLang(m.langs[0]),'en-GB');
assert.equal(api.migrate({langs:[{id:'1',name:'Englisch',vocab:[],speechLang:'en-US'}]}).langs[0].speechLang,'en-US','manuelle Wahl bleibt');
assert.equal(api.resolveSpeechLang({name:'Französisch',speechLang:'auto'}),'fr-FR');assert.equal(api.resolveSpeechLang({name:'Spanisch'}),'es-ES');assert.equal(api.resolveSpeechLang({name:'Italienisch',speechLang:'auto'}),'it-IT');assert.equal(api.resolveSpeechLang({name:'Englisch',speechLang:'en-US'}),'en-US');assert.deepEqual(m.langs[0].wins,[]);assert.equal(m.langs[0].goal,100);
console.log('Logik-Tests OK');

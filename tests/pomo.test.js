const fs=require('fs'),assert=require('assert');
const h=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const l=h.split('//LOGIC-START')[1].split('//LOGIC-END')[0];
const P=new Function(l+';return {pomoStep,pomoOnStart,pomoOnEnd}')();
const M=60000,C={work:25*M,brk:5*M,idle:5*M};
let p=P.pomoOnStart(null,0,C);assert.deepEqual(p,{start:0,idle:null});
assert.equal(P.pomoStep(p,24*M,false,24*M,C),p,'läuft');
assert.equal(P.pomoStep(p,26*M,true,26*M,C),p,'in einer Runde keine Sperre');
let q=P.pomoStep(p,26*M,false,1000*M,C);assert(q.lock&&q.until===1005*M,'Sperre erst nach der Runde, Ende = vertrauenswürdige Zeit + Pause');
assert.equal(P.pomoStep(q,0,false,1004*M+59999,C),q,'unabhängig von der Handy-Uhr');
assert.equal(P.pomoStep(q,0,false,1005*M,C),null,'Pause vorbei (auch bei geschlossener App)');
assert.equal(P.pomoStep(q,0,false,9999*M,C),null);
// andere Dauern (zum Testen)
const T1={work:M,brk:M,idle:M};let t=P.pomoOnStart(null,0,T1);t=P.pomoStep(t,M,false,50*M,T1);assert(t.lock&&t.until===51*M);
// Rundenfolge
p=P.pomoOnStart(null,0,C);p=P.pomoOnEnd(p,8*M);p=P.pomoOnStart(p,12*M,C);assert.equal(p.start,0);assert.equal(p.idle,null);
p=P.pomoOnEnd(p,20*M);assert.equal(P.pomoOnStart(p,25*M+1,C).start,25*M+1,'Reset nach 5 Min.');
p=P.pomoOnEnd({start:0,idle:null},10*M);assert.equal(P.pomoOnStart(p,14*M+59000,C).start,0);assert.equal(P.pomoOnStart(p,15*M,C).start,15*M);
assert.equal(P.pomoOnEnd(q,26*M),q);assert.equal(P.pomoOnStart(q,27*M,C),q,'Start während Sperre ändert nichts');
console.log('Pomodoro-Tests OK');

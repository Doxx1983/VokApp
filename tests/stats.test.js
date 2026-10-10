const fs=require('fs'),assert=require('assert');
const h=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const l=h.split('//LOGIC-START')[1].split('//LOGIC-END')[0];
const A=new Function(l+';return {logAdd,logSum,weekRange,monthRange,seriesDays,seriesWeeks,isoWeek,fmtDur,dKey}')();
// Sa 2026-10-10
const now=new Date(2026,9,10,12);
const [w0,w1]=A.weekRange(now);assert.equal(A.dKey(w0),'2026-10-05');assert.equal(A.dKey(w1),'2026-10-11');
const [m0,m1]=A.monthRange(now);assert.equal(A.dKey(m0),'2026-10-01');assert.equal(A.dKey(m1),'2026-10-31');
const L={log:{}};
A.logAdd(L,new Date(2026,9,4),{p:50,s:600,a:5,r:4});   // So davor (Vorwoche)
A.logAdd(L,new Date(2026,9,5),{p:10,s:60,a:1,r:1});    // Mo
A.logAdd(L,new Date(2026,9,5),{p:5,s:30,a:1,r:0});
A.logAdd(L,new Date(2026,9,10),{p:20,s:120,a:2,r:2});  // heute
A.logAdd(L,new Date(2026,8,30),{p:7,s:70,a:1,r:1});    // Vormonat
let wk=A.logSum(L.log,w0,w1);assert.deepEqual([wk.p,wk.s,wk.days],[35,210,2],'Woche Mo-So');
let mo=A.logSum(L.log,m0,m1);assert.deepEqual([mo.p,mo.s,mo.days],[85,810,3],'Monat');
const d=A.seriesDays(L.log,now,14);assert.equal(d.length,14);assert(d[13].cur&&d[13].p===20&&d[13].lab==='Sa');assert.equal(d[12].p,0);assert.equal(d[0].lab,'Sa'.replace('Sa',d[0].lab));
assert.equal(d[7].p,50,'4.10.');assert.equal(d[3].p,7,'30.9.');
const w=A.seriesWeeks(L.log,now,12);assert.equal(w.length,12);assert.equal(w[11].p,35);assert.equal(w[10].p,57,'Vorwoche 28.9.-4.10. = 7+50');assert.equal(w[11].lab,'KW'+A.isoWeek(w0));
assert.equal(A.isoWeek(new Date(2026,0,1)),1);assert.equal(A.isoWeek(new Date(2026,11,31)),53);assert.equal(A.isoWeek(new Date(2025,11,29)),1);
assert.equal(A.fmtDur(45),'45 Sek.');assert.equal(A.fmtDur(125),'2 Min.');assert.equal(A.fmtDur(3900),'1:05 Std.');
// Sonntag zählt zur alten Woche
const so=new Date(2026,9,11);assert.equal(A.dKey(A.weekRange(so)[0]),'2026-10-05');
console.log('Statistik-Tests OK');

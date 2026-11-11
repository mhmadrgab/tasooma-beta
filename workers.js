// لوحة المستودع: عمال المستودع وتقييمهم الشهري
// مين جهّز كل طلب (بيتحدد عند "بدء التجهيز") ← الإنتاجية والدقة والسرعة + تقييم المدير = درجة من 100
import {collection,doc,setDoc,updateDoc,onSnapshot} from "./fb.js";
import {E,N,fmt,printStmt,ensurePrintCss} from "./cust.js";
const g=id=>document.getElementById(id);
let X=null,W=[],RT={},un=[],mon="";
const CSS=`
.wkm{display:none;position:fixed;inset:0;z-index:77;background:rgba(0,0,0,.55);overflow:auto;padding:18px}.wkm.on{display:block}
.wkk{max-width:460px;margin:6vh auto;background:var(--card);border-radius:18px;padding:20px 22px}.wkk h3{margin:0 0 4px}
.wkp{display:flex;gap:10px;align-items:center;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;margin:8px 0;cursor:pointer}.wkp input{width:20px;height:20px;flex:none}
.wkp:has(input:checked){border-color:var(--acc);background:var(--soft)}
.wtop{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#1b1b1b,#2b2416);color:#fff;border-radius:16px;padding:16px 20px;margin-bottom:14px;border:1px solid rgba(212,174,92,.35)}
.wtop .ic{font-size:38px}.wtop small{display:block;color:#cdb67a}.wtop b{font-size:22px}.wtop .sc2{margin-inline-start:auto;font-size:34px;font-weight:700;color:#e8cf8a}
.wsc{display:inline-flex;align-items:center;justify-content:center;min-width:48px;padding:3px 10px;border-radius:999px;font-weight:700;font-size:17px}
.wsc.a{background:#d8efd9;color:#1d5a24}.wsc.b{background:#f6edd2;color:#6b5314}.wsc.c{background:#f8d9d5;color:#8a2218}
.wbr{display:flex;gap:4px;margin-top:4px}.wbr i{display:block;height:5px;border-radius:3px}
.wup{color:#2f8f3e;font-weight:700}.wdn{color:#c4362b;font-weight:700}
.wrv{border:1.5px solid var(--line);border-inline-start:5px solid #c4362b;border-radius:12px;padding:10px 14px;margin-bottom:8px}
.wrv .rn{font-size:13.5px;color:var(--mut);margin:4px 0 8px}
.wnote{font-size:13px;color:var(--mut);line-height:1.9}
@media (prefers-color-scheme:dark){.wsc.a{background:#173a1b;color:#8fd39a}.wsc.b{background:#3a3115;color:#e8cf8a}.wsc.c{background:#40191a;color:#f1a5a0}}
@media print{.wkm{display:none!important}}
`;
const ym=t=>new Date(N(t)).toLocaleDateString("en-CA").slice(0,7);
const dk=t=>new Date(N(t)).toLocaleDateString("en-CA");
const prevM=m=>{const [y,mm]=m.split("-").map(Number);const d=new Date(y,mm-2,1);return d.toLocaleDateString("en-CA").slice(0,7)};
const months=()=>{const out=[],d=new Date();d.setDate(1);for(let i=0;i<12;i++){out.push(d.toLocaleDateString("en-CA").slice(0,7));d.setMonth(d.getMonth()-1)}return out};
const nm=id=>(W.find(w=>w.id===id)||{}).name||id;
const hasBy=r=>r&&r.prep&&Array.isArray(r.prep.by)&&r.prep.by.length>0;
export const has=()=>W.some(w=>w.active!==false);
// نهاية التجهيز: خروج السيارة، أو التسليم، أو لما المستودع علّم "تم التسليم"
const endOf=r=>N(r.dep)||N(r.dlv)||((r.st==="done"||r.st==="recv")?N(r.upd):0);
// الدقة: الفرع استلم كامل = حسناً. استلم بملاحظات = المدير يراجع (خطأ تجهيز ولا لأ)
function verdict(r){
 if(r.st!=="recv"||!r.rcv)return null;
 if(r.qa&&r.qa.x===true)return null;// المالك حذف الملاحظة: مابتتحسبش على حد
 if(r.rcv.ok!==false)return "ok";
 if(r.qa&&typeof r.qa.fault==="boolean")return r.qa.fault?"err":"ok";
 return "wait";
}
const med=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
// الدرجة من 100: إنتاجية 40 + دقة 30 + سرعة 15 + تقييم المدير 15
function stats(mo){
 const rs=X.R().filter(r=>hasBy(r)&&ym(r.prep.at)===mo),S={};
 const get=id=>S[id]||(S[id]={id,lines:0,pcs:0,reqs:0,days:new Set(),pl:[],ok:0,err:0,wait:0});
 rs.forEach(r=>{
  const by=r.prep.by,sh=1/by.length,ln=Array.isArray(r.rows)?r.rows.filter(x=>x&&!x.na).length:N(r.codes),end=endOf(r),d=end-N(r.prep.at),v=verdict(r);
  by.forEach(id=>{const s=get(id);s.lines+=ln*sh;s.pcs+=N(r.pcs)*sh;s.reqs+=sh;s.days.add(dk(r.prep.at));
   if(end&&d>0&&d<12*36e5&&ln)s.pl.push(d/ln);// الوقت لكل سطر، ونتجاهل اللي استنى أكتر من 12 ساعة
   if(v==="ok")s.ok++;else if(v==="err")s.err++;else if(v==="wait")s.wait++});
 });
 const list=Object.values(S).filter(s=>s.lines>0);
 list.forEach(s=>{s.lpd=s.lines/Math.max(1,s.days.size);s.mpl=med(s.pl)});
 const avgLpd=list.reduce((a,s)=>a+s.lpd,0)/(list.length||1),teamMpl=med(list.flatMap(s=>s.pl)),stars=(RT[mo]&&RT[mo].stars)||{};
 list.forEach(s=>{
  const p=avgLpd>0?Math.min(1,s.lpd/avgLpd/1.3):1;          // سطور في اليوم: 130% من متوسط الفريق = الدرجة كاملة
  const judged=s.ok+s.err,acc=judged?s.ok/judged:1;          // من غير طلبات اتراجعت = كاملة
  const sp=s.mpl&&teamMpl?Math.min(1,teamMpl/s.mpl/1.2):1/1.2;// أسرع من المتوسط بـ 20% = كاملة
  s.star=N(stars[s.id]);const st=s.star||3;                  // دون تقييم = 3 نجوم
  s.acc=judged?acc:null;s.sc={p:40*p,a:30*acc,s:15*sp,m:15*st/5};
  s.score=Math.round(s.sc.p+s.sc.a+s.sc.s+s.sc.m);
 });
 return list.sort((a,b)=>b.score-a.score||b.lines-a.lines);
}
const cls=n=>n>=80?"a":n>=60?"b":"c";
const minPer10=s=>s.mpl?Math.round(s.mpl*10/6e4):null;
// ---------- الواجهة ----------
export function view(){
 if(!X)return "";
 const ms=months(),mo=ms.includes(mon)?mon:ms[0];mon=mo;
 const rows=stats(mo),pv={};stats(prevM(mo)).forEach(s=>pv[s.id]=s.score);
 const top=rows[0],idle=W.filter(w=>w.active!==false&&!rows.some(s=>s.id===w.id));
 const wait=X.R().filter(r=>hasBy(r)&&verdict(r)==="wait").sort((a,b)=>N(b.rcv&&b.rcv.at)-N(a.rcv&&a.rcv.at));
 const stars=(RT[mo]&&RT[mo].stars)||{};
 // اللي اتراجعت في الشهر ده (للمالك: يغيّر القرار أو يحذف)
 const done=X.owner?X.R().filter(r=>hasBy(r)&&r.st==="recv"&&r.rcv&&r.rcv.ok===false&&r.qa&&typeof r.qa.fault==="boolean"&&r.qa.x!==true&&ym(r.prep.at)===mo).sort((a,b)=>N(b.qa.at)-N(a.qa.at)):[];
 return `<div class="fl"><h3 style="margin:0">👷 تقييم العمال</h3><select id="wmon" style="margin-inline-start:auto">${ms.map(m=>`<option ${m===mo?"selected":""}>${m}</option>`).join("")}</select><button class="bt" data-wk="rep" type="button">🖨 التقرير الشهري</button></div>
 ${top?`<div class="wtop"><div class="ic">🏆</div><div><small>عامل الشهر (${E(mo)})</small><b>${E(nm(top.id))}</b><small>${fmt(Math.round(top.lines))} سطر · ${fmt(Math.round(top.pcs))} قطعة</small></div><div class="sc2">${top.score}</div></div>`:""}
 ${wait.length?`<div class="pan" style="margin-bottom:14px"><h3>⚠️ ملاحظات استلام تحتاج إلى مراجعتك (${wait.length})</h3><p class="off" style="font-size:13px;margin:0 0 10px">استلم الفرع بملاحظات. حدّد هل هذا خطأ في التجهيز (يُحسب على العمال) أم لا (تلف في الطريق، نقص من المخزن...).</p>
  ${wait.map(r=>`<div class="wrv"><b>${E(r.brn)}</b> · <bdi dir="ltr">${E(r.no)}</bdi><div class="rn">👷 ${E(r.prep.by.map(nm).join("، "))}${(r.rcv.lines||[]).slice(0,6).map(x=>`<br><bdi dir="ltr">${E(x.k)} ${E(x.c||"")} ${E(x.z||"")}</bdi>: مطلوب ${N(x.q)} · استلم ${N(x.r)}`).join("")}${r.rcv.note?`<br>📝 ${E(r.rcv.note)}`:""}</div>
  <div class="fl" style="margin:0"><button class="bt s" data-wk="fault" data-id="${E(r.id)}" type="button" style="color:#c4362b">خطأ تجهيز</button><button class="bt s" data-wk="nofault" data-id="${E(r.id)}" type="button">ليس خطأ العمال</button>${X.owner?`<button class="bt s r" data-wk="qdel" data-id="${E(r.id)}" type="button" title="تُحذف الملاحظة من المراجعة ولا تُحسب على أحد">🗑 حذف</button>`:""}</div></div>`).join("")}</div>`:""}
 ${X.owner&&done.length?`<details class="pan" style="margin-bottom:14px"><summary style="cursor:pointer;font-weight:700">🗂 ملاحظات استلام راجعتها (${done.length})</summary><p class="off" style="font-size:13px;margin:8px 0 10px">يمكنك تغيير القرار أو حذف الملاحظة نهائياً من التقييم.</p>
  ${done.map(r=>`<div class="wrv" style="border-inline-start-color:${r.qa.fault?"#c4362b":"#2f8f3e"}"><b>${E(r.brn)}</b> · <bdi dir="ltr">${E(r.no)}</bdi> · ${r.qa.fault?'<span style="color:#c4362b;font-weight:700">خطأ تجهيز</span>':'<span style="color:#2f8f3e;font-weight:700">ليس خطأ العمال</span>'}<div class="rn">👷 ${E(r.prep.by.map(nm).join("، "))}${r.rcv.note?` · 📝 ${E(r.rcv.note)}`:""}</div>
  <div class="fl" style="margin:0"><button class="bt s" data-wk="${r.qa.fault?"nofault":"fault"}" data-id="${E(r.id)}" type="button">↺ ${r.qa.fault?"ليس خطأ العمال":"خطأ تجهيز"}</button><button class="bt s r" data-wk="qdel" data-id="${E(r.id)}" type="button">🗑 حذف</button></div></div>`).join("")}</details>`:""}
 <div class="pan"><div class="tw"><table><thead><tr><th>#</th><th>العامل</th><th>الدرجة</th><th>سطور</th><th>قطع</th><th>طلبات</th><th>دقيقة / 10 سطور</th><th>الدقة</th><th>تقييمك</th><th>عن الشهر الماضي</th><th></th></tr></thead><tbody>
 ${rows.length?rows.map((s,i)=>{const d=s.id in pv?s.score-pv[s.id]:null;return `<tr><td>${i+1}</td><td><b>${E(nm(s.id))}</b><small class="off" style="display:block">${s.days.size} يوم عمل</small></td>
  <td><span class="wsc ${cls(s.score)}" title="إنتاجية ${Math.round(s.sc.p)}/40 · دقة ${Math.round(s.sc.a)}/30 · سرعة ${Math.round(s.sc.s)}/15 · تقييمك ${Math.round(s.sc.m)}/15">${s.score}</span>
  <div class="wbr" title="إنتاجية · دقة · سرعة · تقييمك"><i style="width:${s.sc.p}px;background:#a8832f"></i><i style="width:${s.sc.a}px;background:#2f8f3e"></i><i style="width:${s.sc.s}px;background:#1d8a99"></i><i style="width:${s.sc.m}px;background:#6a56c9"></i></div></td>
  <td>${fmt(Math.round(s.lines))}</td><td>${fmt(Math.round(s.pcs))}</td><td>${fmt(Math.round(s.reqs*10)/10)}</td><td>${minPer10(s)??"—"}</td>
  <td>${s.acc===null?'<span class="off">—</span>':Math.round(s.acc*100)+"%"}${s.err?`<small style="display:block;color:#c4362b">${s.err} خطأ</small>`:""}${s.wait?`<small class="off" style="display:block">${s.wait} بانتظار المراجعة</small>`:""}</td>
  <td>${X.admin?`<select data-wst="${E(s.id)}" style="padding:6px 8px"><option value="">—</option>${[5,4,3,2,1].map(n=>`<option value="${n}" ${N(stars[s.id])===n?"selected":""}>${"★".repeat(n)}</option>`).join("")}</select>`:(s.star?"★".repeat(s.star):"—")}</td>
  <td>${d===null?'<span class="off">—</span>':d>0?`<span class="wup">▲ ${d}</span>`:d<0?`<span class="wdn">▼ ${-d}</span>`:"="}</td>
  <td><button class="bt s" data-wk="slip" data-id="${E(s.id)}" type="button">🖨</button></td></tr>`}).join(""):`<tr><td colspan="11" class="off" style="text-align:center;padding:24px">${W.length?"لا توجد طلبات حُدِّد من جهّزها في هذا الشهر بعد. اختر العمال عند الضغط على \"بدء التجهيز\".":"ابدأ بإضافة العمال من الأسفل."}</td></tr>`}
 ${idle.map(w=>`<tr class="off"><td></td><td>${E(w.name)}</td><td colspan="9">لم يجهّز طلبات في هذا الشهر</td></tr>`).join("")}</tbody></table></div>
 <p class="wnote">الدرجة من 100: <b>إنتاجية 40</b> (السطور في اليوم مقارنة بمتوسط الفريق) · <b>دقة 30</b> (الطلبات التي وصلت دون خطأ في التجهيز) · <b>سرعة 15</b> (وقت التجهيز لكل سطر مقارنة بالفريق) · <b>تقييمك 15</b> (دون تقييم = 3 نجوم). الطلب الذي جهّزه أكثر من عامل يُقسَّم عليهم.</p></div>
 ${X.admin?`<div class="pan" style="margin-top:12px"><h3>👥 العمال</h3><div class="fl" style="margin:0 0 10px"><input id="wnew" maxlength="40" placeholder="اسم العامل" style="flex:1;min-width:160px"><button class="bt p" data-wk="add" type="button">➕ إضافة</button></div>
 ${W.length?W.slice().sort((a,b)=>(a.active===false)-(b.active===false)||String(a.name).localeCompare(b.name,"ar")).map(w=>`<div class="bar" style="justify-content:space-between"><span style="width:auto;direction:rtl">${E(w.name)} ${w.active===false?'<span class="pill off2">موقوف</span>':""}</span><span style="width:auto;display:flex;gap:6px"><button class="bt s" data-wk="ren" data-id="${E(w.id)}" type="button">تعديل الاسم</button><button class="bt s" data-wk="tg" data-id="${E(w.id)}" type="button">${w.active===false?"تفعيل":"إيقاف"}</button></span></div>`).join(""):'<div class="off">لا يوجد عمال بعد.</div>'}
 <p class="wnote" style="margin-top:8px">العامل الذي ترك العمل اختر له "إيقاف" بدل الحذف، حتى تبقى تقييماته القديمة.</p></div>`:""}`;
}
// ---------- اختيار مين جهّز الطلب ----------
function box(){let m=g("wkm");if(!m){m=document.createElement("div");m.id="wkm";m.className="wkm";m.addEventListener("click",e=>{if(e.target===m)close()});document.body.appendChild(m)}return m}
const close=()=>{const m=box();m.className="wkm";m.innerHTML=""};
const lastSel=()=>{try{return JSON.parse(localStorage.getItem("wk_last")||"[]")}catch(e){return []}};
export function pick(r){
 const act=W.filter(w=>w.active!==false).sort((a,b)=>String(a.name).localeCompare(b.name,"ar"));
 const pre=new Set(hasBy(r)?r.prep.by:lastSel()),start=r.st==="new";
 const m=box();m.className="wkm on";
 m.innerHTML=`<div class="wkk"><h3>👷 من سيجهّز الطلب؟</h3><div class="off" style="font-size:14px"><bdi dir="ltr">${E(r.brn)}</bdi> · <bdi dir="ltr">${E(r.no)}</bdi> · ${N(r.codes)} صنف</div>
 ${act.length?act.map(w=>`<label class="wkp"><input type="checkbox" value="${E(w.id)}" ${pre.has(w.id)?"checked":""}> <b>${E(w.name)}</b></label>`).join(""):`<p class="off">لا يوجد عمال بعد. أضفهم من تبويب "العمال".</p>`}
 <div class="fl" style="margin:14px 0 0"><button class="bt p" id="wkok" type="button">${start?"بدء التجهيز":"حفظ"}</button>${start?'<button class="bt" id="wkno" type="button">ابدأ دون تحديد</button>':""}<button class="bt" id="wkx" type="button">رجوع</button></div></div>`;
 g("wkx").onclick=close;
 const save=async by=>{
  const t=Date.now(),u={prep:{by,names:by.map(nm),at:N(r.prep&&r.prep.at)||(start?t:N(r.upd)||t)}};
  if(start){u.st="prep";u.upd=t}
  try{await updateDoc(doc(X.db,"requests",r.id),u);if(X.ping)X.ping([r.id]);close();X.toast(start?"بدأ التجهيز":"تم الحفظ")}catch(e){X.toast("تعذر الحفظ: "+(e&&e.code||e&&e.message))}
 };
 g("wkok").onclick=()=>{const by=[...m.querySelectorAll("input:checked")].map(i=>i.value).slice(0,10);
  if(!by.length){X.toast("اختر عاملاً واحداً على الأقل");return}
  try{localStorage.setItem("wk_last",JSON.stringify(by))}catch(e){}save(by)};
 if(g("wkno"))g("wkno").onclick=async()=>{try{await updateDoc(doc(X.db,"requests",r.id),{st:"prep",upd:Date.now()});if(X.ping)X.ping([r.id]);close()}catch(e){X.toast("تعذر الحفظ: "+(e&&e.code||e&&e.message))}};
}
// ---------- التقارير ----------
function report(){
 const mo=mon,rows=stats(mo);
 printStmt(`<div class="st"><div class="ph"><h2>تقييم عمال المستودع</h2><div>${E(mo)}</div></div>
 ${rows[0]?`<div class="rt"><div><small>عامل الشهر</small><b>${E(nm(rows[0].id))}</b></div><div><small>الدرجة</small><b>${rows[0].score} / 100</b></div><div><small>إجمالي السطور</small><b>${fmt(Math.round(rows.reduce((a,s)=>a+s.lines,0)))}</b></div><div><small>عدد العمال</small><b>${rows.length}</b></div></div>`:""}
 <table class="stt"><thead><tr><th>#</th><th>العامل</th><th>الدرجة</th><th>إنتاجية /40</th><th>دقة /30</th><th>سرعة /15</th><th>تقييم /15</th><th>سطور</th><th>قطع</th><th>أيام</th></tr></thead><tbody>
 ${rows.map((s,i)=>`<tr><td class="n">${i+1}</td><td>${E(nm(s.id))}</td><td class="n"><b>${s.score}</b></td><td class="n">${Math.round(s.sc.p)}</td><td class="n">${Math.round(s.sc.a)}</td><td class="n">${Math.round(s.sc.s)}</td><td class="n">${Math.round(s.sc.m)}</td><td class="n">${fmt(Math.round(s.lines))}</td><td class="n">${fmt(Math.round(s.pcs))}</td><td class="n">${s.days.size}</td></tr>`).join("")||'<tr><td colspan="10" style="text-align:center">—</td></tr>'}</tbody></table>
 <p style="font-size:10pt;color:#444">إنتاجية = السطور في اليوم مقارنة بالفريق · دقة = الطلبات دون خطأ في التجهيز · سرعة = وقت التجهيز لكل سطر · تقييم = تقييم المدير</p>
 <div class="sg"><span>مسؤول المستودع</span><span>المدير</span></div></div>`);
}
function slip(id){
 const s=stats(mon).find(x=>x.id===id);if(!s)return;
 printStmt(`<div class="st"><div class="ph"><h2>كشف تقييم: ${E(nm(id))}</h2><div>${E(mon)}</div></div>
 <div class="rt"><div><small>الدرجة</small><b>${s.score} / 100</b></div><div><small>السطور</small><b>${fmt(Math.round(s.lines))}</b></div><div><small>القطع</small><b>${fmt(Math.round(s.pcs))}</b></div><div><small>أيام العمل</small><b>${s.days.size}</b></div></div>
 <table class="stt"><thead><tr><th>البند</th><th>الدرجة</th><th>التفاصيل</th></tr></thead><tbody>
 <tr><td>الإنتاجية</td><td class="n">${Math.round(s.sc.p)} / 40</td><td>${fmt(Math.round(s.lpd))} سطر في اليوم</td></tr>
 <tr><td>الدقة</td><td class="n">${Math.round(s.sc.a)} / 30</td><td>${s.acc===null?"لا توجد طلبات تمت مراجعتها":Math.round(s.acc*100)+"% دون خطأ"}${s.err?` (${s.err} خطأ)`:""}</td></tr>
 <tr><td>السرعة</td><td class="n">${Math.round(s.sc.s)} / 15</td><td>${minPer10(s)??"—"} دقيقة لكل 10 سطور</td></tr>
 <tr><td>تقييم المدير</td><td class="n">${Math.round(s.sc.m)} / 15</td><td>${s.star?"★".repeat(s.star):"لم يُقيّم (3 نجوم)"}</td></tr></tbody></table>
 <div class="sg"><span>العامل</span><span>المدير</span></div></div>`);
}
// ---------- الأحداث ----------
async function click(e){
 const t=e.target.closest("[data-wk]");if(!t||!X)return;const a=t.dataset.wk,id=t.dataset.id;
 try{
  if(a==="rep")report();
  else if(a==="slip")slip(id);
  else if(!X.admin){X.toast("هذه الصلاحية للمدير فقط");return}
  else if(a==="add"){const n=(g("wnew").value||"").trim().slice(0,40);if(!n){X.toast("اكتب اسم العامل");return}if(W.some(w=>w.name===n)){X.toast("هذا الاسم موجود");return}await setDoc(doc(collection(X.db,"workers")),{name:n,active:true,ts:Date.now()});X.toast("تمت الإضافة")}
  else if(a==="ren"){const w=W.find(x=>x.id===id);const n=(prompt("الاسم الجديد:",w?w.name:"")||"").trim().slice(0,40);if(n)await setDoc(doc(X.db,"workers",id),{name:n},{merge:true})}
  else if(a==="tg"){const w=W.find(x=>x.id===id);if(w)await setDoc(doc(X.db,"workers",id),{active:w.active===false},{merge:true})}
  else if(a==="fault"||a==="nofault")await updateDoc(doc(X.db,"requests",id),{qa:{fault:a==="fault",at:Date.now()}});
  else if(a==="qdel"){if(!X.owner){X.toast("هذه الصلاحية للمالك فقط");return}
   if(confirm("حذف ملاحظة الاستلام هذه من مراجعة العمال؟\nلن تُحسب على أي عامل، ويبقى الطلب كما هو.")){await updateDoc(doc(X.db,"requests",id),{qa:{x:true,at:Date.now()}});X.toast("تم الحذف")}}
 }catch(x){X.toast("تعذر التنفيذ: "+(x&&x.code||x&&x.message))}
}
export function initWorkers(ctx){
 X=ctx;stop();
 if(!g("wk-css")){const s=document.createElement("style");s.id="wk-css";s.textContent=CSS;document.head.appendChild(s);ensurePrintCss()}
 if(!window.__wkc){window.__wkc=1;document.addEventListener("click",click);
  document.addEventListener("change",async e=>{const t=e.target;if(!X)return;
   // الشهور القديمة محتاجة الطلبات الأقدم: بنحمّل من أول الشهر ده بس (مش كل الطلبات من أول يوم)
   if(t.id==="wmon"){mon=t.value;if(X.loadSince)X.loadSince(new Date(mon+"-01T00:00:00").getTime());else{const ms=months();if(ms.indexOf(mon)>1&&X.loadAll)X.loadAll()}X.redraw()}
   if(t.dataset&&t.dataset.wst&&X.admin){try{await setDoc(doc(X.db,"wrate",mon),{stars:{[t.dataset.wst]:N(t.value)}},{merge:true})}catch(x){X.toast("تعذر حفظ التقييم: "+(x&&x.code||x&&x.message))}}})}
 const draw=()=>{const tb=X.tab();if(tb==="wk"||tb==="req")X.redraw()};
 un.push(onSnapshot(collection(X.db,"workers"),sn=>{W=sn.docs.map(d=>({id:d.id,...d.data()}));draw()},()=>{}));
 // view = المتابع (صاحب الشركة) بيشوف التقييم
 if(X.admin||X.view)un.push(onSnapshot(collection(X.db,"wrate"),sn=>{RT={};sn.docs.forEach(d=>RT[d.id]=d.data());if(X.tab()==="wk")X.redraw()},()=>{}));
}
export function stop(){un.forEach(f=>f());un=[];W=[];RT={};const m=g("wkm");if(m){m.className="wkm";m.innerHTML=""}}

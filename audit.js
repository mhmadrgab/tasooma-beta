// تبويب "📜 السجل" (لمالك النظام بس): مين عمل إيه في المنصة.
// السطور بتتكتب لوحدها من fb.js (setAudit) مع كل حفظ/تعديل/حذف من أي حساب في المستودع: log/{id} = {e, n, op, c, id, t, k, s, x?, ts}
// هنا بس بنعرضها بكلام مفهوم، وفلتر بالشخص والنوع والبحث.
import {collection,query,orderBy,limit,onSnapshot} from "./fb.js";
import {E} from "./cust.js";
import {avatar} from "./prof.js";
const PAGE=150;
const CN={requests:"طلب",ledger:"حركة عهدة",settlements:"إقفال عهدة",staff:"موظف",secrets:"كلمة مرور",branches:"فرع",drivers:"سائق",cars:"سيارة",trips:"رحلة",fuel:"تعبئة بنزين",workers:"عامل",wrate:"تقييم العمال"};
const STN={new:"جديد",prep:"قيد التجهيز",go:"في الطريق",done:"تم التسليم",recv:"تم الاستلام"};
const STYLE=`.lgw .fl{margin-bottom:12px}.lgr{display:flex;gap:12px;align-items:flex-start;padding:11px 4px;border-bottom:1px solid var(--line)}
.lgr:last-child{border-bottom:0}.lgr .tx{flex:1;min-width:0;font-size:14.5px;line-height:1.7}.lgr .tx b{font-weight:800}
.lgr .tx small{display:block;color:var(--mut);font-size:12.5px}.lgr .ic{font-size:17px;flex:none;width:24px;text-align:center;margin-top:5px}
.lgr .tm{flex:none;color:var(--mut);font-size:12.5px;text-align:end;white-space:nowrap;direction:ltr}`;
let X=null,L=[],LIM=PAGE,un=null,fp="",fc="",fq="";
const N=x=>Number.isFinite(+x)?+x:0;
const hm=t=>new Date(t).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const when=t=>{const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?"اليوم "+hm(t):d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"2-digit"})+" "+hm(t)};
// سطر السجل بكلام مفهوم: {i: أيقونة, a: الجملة (HTML جاهز، كل اللي جاي من السجل متأمّن)}
function say(o){
  const c=E(CN[o.c]||o.c),k=Array.isArray(o.k)?o.k:[],has=x=>k.includes(x),t=o.t?` «<bdi dir="ltr">${E(o.t)}</bdi>»`:"";
  if(o.x)return {i:"📦",a:`${o.op==="del"?"حذف":o.op==="upd"?"عدّل":"حفظ"} ${N(o.x)} ${c}`};
  if(o.op==="del")return {i:"🗑",a:`حذف ${c}${t}`};
  if(o.c==="requests"){
    if(o.op==="set")return {i:"📋",a:`${has("by")?"أنشأ طلباً للفرع":"حفظ طلب"}${t}`};
    if(STN[o.s])return {i:"🔄",a:`غيّر حالة طلب${t} لـ «${STN[o.s]}»`};
    if(has("rows"))return {i:"✏️",a:`عدّل أصناف طلب${t}`};
    if(has("asg"))return {i:"🚚",a:`عيّن سائقاً لطلب${t}`};
    if(has("prep"))return {i:"👷",a:`سجّل من جهّز طلباً${t}`};
    if(has("qa"))return {i:"🔍",a:`راجع ملاحظات استلام طلب${t}`};
  }
  if(o.c==="staff"){
    if(o.op==="set")return {i:"➕",a:`أضاف موظفاً${t}`};
    if(o.s==="on"||o.s==="off")return {i:o.s==="on"?"✅":"⛔",a:`${o.s==="on"?"فعّل":"عطّل"} الموظف${t}`};
    if(o.s==="adm"||o.s==="acc")return {i:"🛡",a:`${o.s==="adm"?"رقّى لمدير":"حوّل لمحاسب"}${t}`};
    if(has("k"))return {i:"🏷",a:`غيّر كنية${t}`};
    if(k.some(x=>x.startsWith("p.")))return {i:"🔐",a:`غيّر صلاحيات${t}`};
  }
  if(o.c==="branches"&&(o.s==="on"||o.s==="off"))return {i:o.s==="on"?"✅":"⛔",a:`${o.s==="on"?"فعّل":"عطّل"} فرع${t}`};
  if(o.c==="secrets")return {i:"🔑",a:`غيّر كلمة مرور${t}`};
  if(o.c==="trips"&&o.s==="done")return {i:"🏁",a:`أغلق رحلة${t}`};
  return {i:o.op==="set"?"💾":"✏️",a:`${o.op==="set"?"حفظ":"عدّل"} ${c}${t}`};
}
function listen(){
  if(un)un();
  un=onSnapshot(query(collection(X.db,"log"),orderBy("ts","desc"),limit(LIM)),sn=>{L=sn.docs.map(d=>({id:d.id,...d.data()}));if(X.tab()==="log")X.redraw()},
    e=>{L=null;if(X.tab()==="log")X.redraw()});
}
export function view(){
  if(!X)return "";if(!un)listen();
  if(L===null)return `<div class="pan">⚠️ تعذر قراءة السجل. تأكد من نشر القواعد (Rules) الجديدة.</div>`;
  const ppl=[...new Map(L.map(o=>[o.e,o.n||o.e])).entries()],cs=[...new Set(L.map(o=>o.c))];
  const q=fq.toLowerCase(),F=L.filter(o=>(!fp||o.e===fp)&&(!fc||o.c===fc)&&(!q||`${o.n} ${o.t} ${say(o).a.replace(/<[^>]+>/g,"")}`.toLowerCase().includes(q)));
  return `<div class="pan lgw"><h3 style="margin:0 0 4px">📜 السجل: من فعل ماذا</h3><p class="off" style="margin:0 0 12px;font-size:13.5px">كل إضافة وتعديل وحذف من أي حساب في المستودع تُسجَّل هنا تلقائياً باسم من قام بها. هذا السجل تراه أنت فقط، ولا يستطيع أحد تعديله أو حذفه.</p>
  <div class="fl"><select id="lgp"><option value="">كل الأشخاص</option>${ppl.map(([e,n])=>`<option value="${E(e)}" ${fp===e?"selected":""}>${E(n)}</option>`).join("")}</select>
  <select id="lgc"><option value="">كل الأنواع</option>${cs.map(c=>`<option value="${E(c)}" ${fc===c?"selected":""}>${E(CN[c]||c)}</option>`).join("")}</select>
  <input id="lgq" type="search" placeholder="🔎 ابحث (رقم طلب، اسم...)" value="${E(fq)}" style="flex:1;min-width:160px"></div>
  ${F.length?F.map(o=>{const s=say(o);return `<div class="lgr">${avatar(o.e,o.n,36)}<span class="ic">${s.i}</span><div class="tx"><b>${E(o.n||o.e)}</b> ${s.a}<small dir="ltr" style="text-align:right">${E(o.e)}</small></div><span class="tm">${when(N(o.ts))}</span></div>`}).join("")
    :`<div class="off" style="text-align:center;padding:24px">${L.length?"لا يوجد شيء بهذا الفلتر":"لا يوجد شيء في السجل بعد. فور إجراء أي تعديل سيظهر هنا."}</div>`}
  ${L.length>=LIM?`<div style="text-align:center;margin-top:12px"><button class="bt" data-lgmore type="button">⬇ أقدم</button></div>`:""}</div>`;
}
export function initAudit(ctx){
  stopAudit();X=ctx;
  if(!document.getElementById("lg-css")){const s=document.createElement("style");s.id="lg-css";s.textContent=STYLE;document.head.appendChild(s)}
  if(window.__lgc)return;window.__lgc=1;
  document.addEventListener("click",e=>{if(X&&e.target.closest("[data-lgmore]")){LIM+=PAGE;listen()}});
  document.addEventListener("change",e=>{if(!X)return;if(e.target.id==="lgp"){fp=e.target.value;X.redraw()}if(e.target.id==="lgc"){fc=e.target.value;X.redraw()}});
  document.addEventListener("input",e=>{if(X&&e.target.id==="lgq"){fq=e.target.value;X.redraw()}});
}
export function stopAudit(){if(un)un();un=null;L=[];LIM=PAGE;X=null}

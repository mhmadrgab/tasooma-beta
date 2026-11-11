// لوحة المستودع: عهدة المستودع (تسجيل العهدة + الفواتير + كشف الحساب + الإقفال)
import {collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,writeBatch} from "./fb.js";
import {calc,CATS,E,N,fmt,today,shrink,stmtHtml,printStmt,ensurePrintCss} from "./cust.js";
import {regSW,badge} from "./notify.js";
import {zoomOpen} from "./zoom.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
const WH="المستودع الرئيسي";
let X=null,LA=[],SA=[],un=[],mode="",edit=null,img="",imgBusy=false,fc="";
const CSS=`
.cm{display:none;position:fixed;inset:0;z-index:75;background:rgba(0,0,0,.55);overflow:auto;padding:18px}.cm.on{display:block}
.ck2{max-width:520px;margin:4vh auto;background:var(--card);border-radius:18px;padding:20px 22px}.ck2 h3{margin:0 0 4px}.ck2 label{display:block;color:var(--mut);font-size:13px;margin:12px 0 4px}.ck2 input,.ck2 select{width:100%}
.bal{background:#1b1b1b;color:#fff;border-radius:16px;padding:18px 22px;margin-bottom:14px;display:flex;gap:26px;flex-wrap:wrap;align-items:center}.bal b{font-size:38px;direction:ltr;display:block;line-height:1.2}.bal small{color:#cdb67a;display:block}.bal.neg b{color:#ff8a80}
.am{font-weight:700;direction:ltr;white-space:nowrap}.am.in{color:var(--done)}.am.ex{color:#c4362b}
.ck2 .bt,.pan .bt,.bt.g,.fk .bt{width:auto}
img.rc{max-width:100%;border-radius:10px}
.nb2:empty{display:none}.nb2{background:#c4362b;color:#fff;border-radius:999px;font-size:12px;padding:0 7px;margin-inline-start:6px;font-weight:700}
.rcb{background:#f8d9d5;color:#8a2218;border-radius:10px;padding:8px 12px;margin:0 18px 12px;font-size:14px}.rcb.ok{background:#d8efd9;color:#1d5a24}
.rq.recv{border-inline-start-color:var(--done);opacity:.85}.rq.recv .chp{background:#d8efd9;color:#1d5a24}
.rq.go{border-inline-start-color:#6a56c9}.rq.go .chp{background:#e4def7;color:#44348a}
.tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tools button{white-space:nowrap}.tools button{background:none;border:1.5px solid #444;color:#ddd;border-radius:999px;padding:6px 14px;cursor:pointer;font:inherit;font-size:14px}
@media (prefers-color-scheme:dark){.rcb{background:#40191a;color:#f1a5a0}.rcb.ok{background:#173a1b;color:#8fd39a}.rq.go .chp{background:#2a2450;color:#c3b8f5}}
@media print{.cm{display:none!important}}
`;
const cur=()=>calc(LA,SA);
export function hdr(){if(!X)return;badge(X.newReqs())}
function sync(){if(X.tab()==="cus"||X.tab()==="fl")X.redraw();hdr()}
// ---------- التبويب ----------
export function view(){
 ledgerOn();
 const k=cur(),pr=SA.filter(s=>s.st==="approved").sort((a,b)=>N(b.ts)-N(a.ts));
 const bycat={};k.open.filter(e=>e.type==="exp").forEach(e=>bycat[e.cat]=(bycat[e.cat]||0)+N(e.amt));
 const cats=Object.entries(bycat).sort((a,b)=>b[1]-a[1]),mx=cats.length?cats[0][1]:1;
 let run=k.opening;
 const rows=k.open.filter(e=>!fc||e.cat===fc).map(e=>{if(!fc){run+=e.type==="in"?N(e.amt):-N(e.amt)}return {e,run}});
 return `<div class="bal ${k.bal<0?"neg":""}"><div><small>رصيد العهدة الحالي</small><b>${fmt(k.bal)}</b></div><div><small>الافتتاحي</small><b style="font-size:22px">${fmt(k.opening)}</b></div><div><small>عهدة مستلمة</small><b style="font-size:22px">${fmt(k.ins)}</b></div><div><small>مصروفات</small><b style="font-size:22px">${fmt(k.exps)}</b></div></div>
 <div class="fl"><button class="bt p" data-cx="in" type="button">💵 استلمت عهدة</button><button class="bt g" data-cx="exp" type="button">🧾 تسجيل فاتورة / مصروف</button><button class="bt" data-cx="stmt" type="button">🖨 كشف الحساب</button>${X.admin?`<button class="bt" data-cx="close" type="button" ${k.open.length?"":"disabled"}>🔒 إقفال العهدة وترحيل الرصيد</button>`:""}</div>
 <div class="row2"><div class="pan"><h3>المصروفات حسب البند</h3>${cats.length?cats.map(([n,v])=>`<div class="bar"><span style="direction:rtl">${E(n)}</span><i style="width:${Math.max(4,v/mx*55)}%"></i><em>${fmt(v)}</em></div>`).join(""):'<div class="off">لا توجد مصروفات في الفترة</div>'}</div>
 <div class="pan"><h3>الفترات المغلقة</h3>${pr.length?pr.map(s=>`<div class="bar" style="justify-content:space-between"><span style="direction:ltr;width:auto">${E(s.no)}</span><span style="width:auto;direction:rtl;color:var(--mut)">${E(s.from)} ← ${E(s.to)} · ${fmt(s.bal)}</span><button class="bt s" data-cx="ps" data-id="${E(s.id)}" type="button">🖨</button></div>`).join(""):'<div class="off">لا توجد فترة مغلقة بعد</div>'}</div></div>
 <div class="pan"><div class="fl" style="margin:0 0 10px"><h3 style="margin:0">حركات الفترة الحالية</h3><select id="cfc" style="margin-inline-start:auto"><option value="">كل البنود</option>${CATS.concat(["عهدة"]).concat([...new Set(k.open.map(e=>e.cat).filter(c=>c&&!CATS.includes(c)&&c!=="عهدة"))]).map(c=>`<option ${fc===c?"selected":""}>${E(c)}</option>`).join("")}</select></div>
 <div class="tw"><table><thead><tr><th>التاريخ</th><th>البند</th><th>البيان / الفاتورة</th><th>عهدة</th><th>مصروف</th><th>الرصيد</th><th></th></tr></thead><tbody>${rows.length?rows.map(({e,run})=>`<tr><td>${E(e.dt)}</td><td><b>${E(e.cat)}</b></td><td>${E([e.note,e.inv?"فاتورة "+e.inv:"",e.carn].filter(Boolean).join(" — "))}</td><td class="am in">${e.type==="in"?fmt(e.amt):""}</td><td class="am ex">${e.type==="exp"?fmt(e.amt):""}</td><td class="am">${fc?"":fmt(run)}</td><td style="white-space:nowrap">${e.img?`<button class="bt s" data-cx="img" data-id="${E(e.id)}" type="button">📎</button> `:""}<button class="bt s" data-cx="edit" data-id="${E(e.id)}" type="button">تعديل</button>${X.admin?` <button class="bt s" data-cx="del" data-id="${E(e.id)}" type="button">حذف</button>`:""}</td></tr>`).join(""):'<tr><td colspan="7" class="off" style="text-align:center;padding:26px">لا توجد حركات بعد. ابدأ بـ "استلمت عهدة".</td></tr>'}</tbody></table></div></div>`;
}
// ---------- النماذج ----------
function box(){let m=g("cmx");if(!m){m=document.createElement("div");m.id="cmx";m.className="cm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function closeM(){mode="";edit=null;img="";const m=box();m.className="cm";m.innerHTML=""}
function form(type,e){
 mode="form";edit=e||null;const ex=type==="exp";img=e&&e.img||"";imgBusy=false;const cars=X.cars?X.cars():[];
 const m=box();m.className="cm on";
 m.innerHTML=`<div class="ck2"><h3>${e?"تعديل":""} ${ex?"فاتورة / مصروف":"استلام عهدة"}</h3>
 <label>المبلغ</label><input id="fa" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off" value="${e?E(e.amt):""}">
 ${ex?`<label>البند</label><select id="fcat">${CATS.concat(e&&e.cat&&!CATS.includes(e.cat)&&e.cat!=="عهدة"?[e.cat]:[]).map(c=>`<option ${e&&e.cat===c?"selected":""}>${E(c)}</option>`).join("")}</select>`:""}
 <label>التاريخ</label><input id="fdt" type="date" value="${E(e?e.dt:today())}">
 ${ex?`<label>رقم الفاتورة / المورّد (اختياري)</label><input id="finv" type="text" maxlength="60" value="${E(e&&e.inv||"")}">
 <label>مرتبط بسيارة (اختياري — يدخل في تكلفة السيارة)</label><select id="fcar"><option value="">—</option>${cars.map(c=>`<option value="${E(c.id)}" ${e&&e.car===c.id?"selected":""}>${E(c.name)} ${E(c.plate||"")}</option>`).join("")}</select>`:""}
 <label>${ex?"البيان":"استلمتها من / ملاحظة"}</label><input id="fnote" type="text" maxlength="300" value="${E(e&&e.note||"")}">
 ${ex?(img&&!X.owner?`<label>صورة الفاتورة</label><small class="off">توجد صورة محفوظة ✅ (تغييرها أو حذفها للمالك فقط)</small>`:`<label>صورة الفاتورة (اختياري)</label><input id="ffile" type="file" accept="image/*"><small id="fh" class="off">${img?"توجد صورة محفوظة ✅ (إن اخترت صورة جديدة فستستبدلها)":""}</small>`):""}
 <div class="fl" style="margin-top:16px"><button class="bt p" data-cx="save" data-type="${type}" type="button">حفظ</button><button class="bt" data-cx="cancel" type="button">رجوع</button></div></div>`;
 g("fa").focus();
 if(ex&&g("ffile"))g("ffile").onchange=async()=>{const f=g("ffile").files[0];if(!f)return;imgBusy=true;g("fh").textContent="جاري ضغط الصورة...";try{img=await shrink(f);g("fh").textContent="تم تجهيز الصورة ✅"}catch(x){g("ffile").value="";g("fh").textContent="الصورة غير صالحة"}imgBusy=false};
}
async function save(type){
 if(imgBusy){X.toast("انتظر حتى تنتهي الصورة");return}
 const amt=Math.round(N(toEn(g("fa").value))*100)/100;
 if(!(amt>0)||amt>10000000){X.toast("اكتب مبلغ صحيح");return}
 const ex=type==="exp",car=ex?g("fcar").value:"",c=(X.cars?X.cars():[]).find(x=>x.id===car);
 const d={br:"WH",type,amt,cat:ex?g("fcat").value:"عهدة",dt:g("fdt").value||today(),st:"approved",ts:edit?edit.ts:Date.now()};
 const note=g("fnote").value.trim().slice(0,300);d.note=note;
 if(ex){d.inv=g("finv").value.trim().slice(0,60);d.car=car;d.carn=c?c.name+(c.plate?" "+c.plate:""):""}
 if(img)d.img=img;
 try{
  if(edit)await setDoc(doc(X.db,"ledger",edit.id),{...d,...(edit.sid?{sid:edit.sid}:{})});
  else await setDoc(doc(collection(X.db,"ledger")),d);
  closeM();X.toast("تم الحفظ")
 }catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message))}
}
function stmt(k,title,from,to,rows,opening){printStmt(stmtHtml({brn:WH,lbl:"الجهة",sg1:"أمين العهدة",title,opening,rows,from,to},X.logo))}
async function closePeriod(){
 const k=cur();if(!k.open.length)return;
 if(!confirm(`إقفال العهدة؟\nعهدة ${fmt(k.ins)} · مصروفات ${fmt(k.exps)} · الرصيد المرحّل ${fmt(k.bal)}\nبعد الإقفال لا يمكن تعديل هذه الحركات، ويصبح الرصيد افتتاحياً للفترة القادمة.`))return;
 const d=new Date(),p=n=>String(n).padStart(2,"0"),id=doc(collection(X.db,"settlements")).id;
 const s={br:"WH",no:`C-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`,from:k.open[0].dt,to:today(),opening:k.opening,ins:k.ins,exps:k.exps,bal:Math.round(k.bal*100)/100,ids:k.open.map(e=>e.id),st:"approved",ts:Date.now()};
 for(let i=0;i<k.open.length;i+=400){const bt=writeBatch(X.db);k.open.slice(i,i+400).forEach(e=>bt.update(doc(X.db,"ledger",e.id),{sid:id}));await bt.commit()}
 await setDoc(doc(X.db,"settlements",id),s);
 X.toast("تم الإقفال. الرصيد المرحّل "+fmt(s.bal));stmt(k,"كشف حساب العهدة — "+s.no,s.from,s.to,k.open,k.opening);
}
async function click(e){
 const t=e.target.closest("[data-cx]");if(!t)return;
 const a=t.dataset.cx,id=t.dataset.id;
 try{
  if(!X.admin&&(a==="del"||a==="close")){X.toast("هذه الصلاحية للمدير فقط");return}
  if(a==="in"||a==="exp")form(a);
  else if(a==="edit"){const en=LA.find(x=>x.id===id);if(en)form(en.type,en)}
  else if(a==="cancel")closeM();
  else if(a==="save")await save(t.dataset.type);
  else if(a==="del"){if(confirm("حذف الحركة نهائياً؟"))await deleteDoc(doc(X.db,"ledger",id))}
  else if(a==="img"){const en=LA.find(x=>x.id===id);if(en&&en.img)zoomOpen(en.img,`${en.cat} — ${fmt(en.amt)}${en.inv?" · فاتورة "+en.inv:""}`,"ledger/"+en.id+"/img")}// كبيرة على الشاشة، والحذف للمالك فقط
  else if(a==="stmt"){const k=cur();stmt(k,"كشف حساب العهدة (الفترة الحالية)",k.open[0]?k.open[0].dt:today(),today(),k.open,k.opening)}
  else if(a==="close")await closePeriod();
  else if(a==="ps"){const s=SA.find(x=>x.id===id);if(s)stmt(null,"كشف حساب العهدة — "+s.no,s.from,s.to,LA.filter(e=>e.sid===id),N(s.opening))}
 }catch(x){X.toast("تعذر التنفيذ: "+(x&&x.code||x&&x.message))}
}
export function initExtra(ctx){
 X=ctx;stop();
 if(!g("ax-css")){const s=document.createElement("style");s.id="ax-css";s.textContent=CSS;document.head.appendChild(s);ensurePrintCss()}
 if(!window.__axc){window.__axc=1;document.addEventListener("click",click);document.addEventListener("change",e=>{if(e.target.id==="cfc"){fc=e.target.value;X.redraw()}})}
 regSW();
}
// توفير القراءات (نوفمبر 2026): العهدة كلها (من أول يوم) بتتقري بس لما حد يفتح تبويب العهدة أو السيارات (مصاريف العربيات)،
// مش مع كل دخول للوحة
let LON=false;
export function ledgerOn(){
 if(!X||LON)return;LON=true;
 un.push(onSnapshot(collection(X.db,"ledger"),sn=>{LA=sn.docs.map(d=>({id:d.id,...d.data()}));sync()},()=>X.toast("تعذر قراءة العهدة. تأكد من تحديث القواعد (Rules)")));
 un.push(onSnapshot(collection(X.db,"settlements"),sn=>{SA=sn.docs.map(d=>({id:d.id,...d.data()}));sync()},()=>{}));
}
export function stop(){un.forEach(f=>f());un=[];LA=[];SA=[];mode="";LON=false;const m=g("cmx");if(m){m.className="cm";m.innerHTML=""}}
export const ledger=()=>LA;
export {hdr as adminHdr};

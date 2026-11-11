// صفحة الفرع: تأكيد الاستلام + التنبيهات + تثبيت التطبيق
import {doc,updateDoc,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {E,N} from "./cust.js";
import {wireButtons,regSW} from "./notify.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
let X=null;
const CSS=`
#me .tl{display:flex;gap:10px;align-items:center;flex-wrap:wrap}#me .tl button{font-size:13px}
.xm{display:none;position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);overflow:auto;padding:16px}.xm.on{display:block}
.xk{max-width:520px;margin:4vh auto;background:var(--card);border-radius:18px;padding:20px}.xk h3{margin:0 0 10px}.xk label{display:block;color:var(--mut);font-size:13px;margin:12px 0 4px}
.xk textarea{width:100%;background:var(--field);border:1.5px solid transparent;border-radius:11px;padding:10px 12px;font:inherit;color:var(--ink)}
.xk .row{display:flex;gap:10px;margin-top:16px}.xk .row .b{flex:1}
.xk table{width:100%;border-collapse:collapse;font-size:14px}.xk th{text-align:right;color:var(--mut);font-weight:500;padding:4px;border-bottom:2px solid var(--acc);font-size:12.5px}.xk td{padding:5px 4px;border-bottom:1px solid var(--line)}.xk td input{padding:6px;text-align:center;width:64px;font-weight:700}
.mr{flex-wrap:wrap}.rcvb{background:var(--btn);color:var(--btnink);border:0;border-radius:10px;padding:7px 14px;font:inherit;font-weight:700;cursor:pointer}
.chp.recv{background:#d8efd9;color:#1d5a24}.chp.go{background:#e4def7;color:#44348a}.rcn{font-size:12.5px;color:#8a2218;font-weight:700}.gon{font-size:13px;color:#44348a;font-weight:700;width:100%}
@media (prefers-color-scheme:dark){.chp.recv{background:#173a1b;color:#8fd39a}.chp.go{background:#2a2450;color:#c3b8f5}.gon{color:#c3b8f5}}
`;
function ui(){
 if(g("cx-css"))return;
 const s=document.createElement("style");s.id="cx-css";s.textContent=CSS;document.head.appendChild(s);
 const mx=g("mx"),tl=document.createElement("div");tl.className="tl";
 tl.innerHTML=`<button id="bell" type="button"></button><button data-install type="button" hidden>📲 تثبيت التطبيق</button>`;
 mx.before(tl);tl.appendChild(mx);wireButtons();
 const xm=document.createElement("div");xm.id="xm";xm.className="xm";document.body.appendChild(xm);
 xm.onclick=e=>{if(e.target===xm)closeX()};
 g("ml").addEventListener("click",e=>{const b=e.target.closest("[data-rcv]");if(b)openRcv(b.dataset.rcv)});
}
const closeX=()=>{g("xm").className="xm";g("xm").innerHTML=""};
const openX=h=>{g("xm").innerHTML=`<div class="xk">${h}</div>`;g("xm").className="xm on"};
function openRcv(id){
 const r=(X.reqs()||{})[id];if(!r||r.st!=="done")return;
 const rows=(Array.isArray(r.rows)?r.rows:[]).filter(x=>x&&!x.na).slice(0,400);// الصنف غير المتوفر ماوصلش أصلاً، فمابيتأكدش استلامه
 openX(`<h3>تأكيد استلام طلب <bdi dir="ltr">${E(r.no)}</bdi></h3><p style="margin:0 0 8px;color:var(--mut);font-size:14px">إن وصل كل شيء كما هو اضغط تأكيد مباشرة. وإن وُجد نقص أو تالف اكتب الكمية التي استلمتها فعلاً.</p>
 <div style="max-height:46vh;overflow:auto"><table><thead><tr><th>الكود</th><th>اللون</th><th>المقاس</th><th>مطلوب</th><th>استلمت</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td><bdi dir="ltr">${E(x.k)}</bdi></td><td><bdi dir="ltr">${E(x.c||"-")}</bdi></td><td>${E(x.z||"")}</td><td><b>${N(x.q)}</b></td><td><input data-i="${i}" type="number" inputmode="numeric" min="0" max="99999" value="${N(x.q)}"></td></tr>`).join("")}</tbody></table></div>
 <label for="rn">ملاحظات (تالف، ناقص، مختلف...)</label><textarea id="rn" rows="2" maxlength="500" placeholder="اختياري"></textarea>
 <div class="row"><button class="b" id="rc0" type="button">رجوع</button><button class="b p" id="rc1" type="button">✅ تأكيد الاستلام</button></div>`);
 g("rc0").onclick=closeX;
 g("rc1").onclick=async()=>{
  const lines=[];document.querySelectorAll("#xm input[data-i]").forEach(inp=>{
   const i=+inp.dataset.i,x=rows[i],v=Math.max(0,Math.min(99999,Math.round(+toEn(inp.value)||0)));
   if(v!==N(x.q))lines.push({k:String(x.k||"").slice(0,40),c:String(x.c||"").slice(0,40),z:String(x.z||"").slice(0,20),q:N(x.q),r:v});
  });
  const note=g("rn").value.trim().slice(0,500),rcv={at:Date.now(),ok:!lines.length&&!note,lines,note};
  if(!note)delete rcv.note;
  g("rc1").disabled=true;
  try{await withTimeout(updateDoc(doc(X.db,"requests",id),{st:"recv",rcv}),15000);if(X.ping)X.ping([id]);closeX();X.toast(rcv.ok?"تم تأكيد الاستلام ✅":"تم تسجيل الاستلام مع الملاحظات ✅")}
  catch(e){g("rc1").disabled=false;const why=await failReason(e);X.toast(why==="denied"?"غير مسموح. ربما غيّر المستودع حالة الطلب.":FAIL_MSG[why],"er")}
 };
}
export function initBranch(ctx){X=ctx;ui()}
export function stopBranch(){if(g("xm"))closeX()}
regSW();

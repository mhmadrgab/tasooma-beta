// أدوات العهدة المشتركة بين صفحة الفرع وصفحة المستودع
export const CATS=["إيجار عمال","نقل ومواصلات","محروقات","مستلزمات ضيافة ونظافة","أخرى"];// البنود القديمة (بنزين، صيانة سيارات...) اتشالت من القايمة، والحركات القديمة بتفضل ببندها
export const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const N=x=>Number.isFinite(+x)?+x:0;
export const fmt=x=>N(x).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2});
export const today=()=>new Date().toLocaleDateString("en-CA");
export const SL={pending:"بانتظار الاعتماد",approved:"معتمد",rejected:"مرفوض"};
// حساب الرصيد: L = حركات الفرع، S = تسويات الفرع
export function calc(L,S){
 L=Array.isArray(L)?L:[];S=Array.isArray(S)?S:[];
 const ap=S.filter(s=>s.st==="approved").sort((a,b)=>N(a.ts)-N(b.ts)),last=ap[ap.length-1];
 const opening=last?N(last.bal):0;
 const open=L.filter(e=>!e.sid&&e.st!=="rejected").sort((a,b)=>N(a.ts)-N(b.ts));
 const ins=open.filter(e=>e.type==="in"&&e.st==="approved").reduce((a,e)=>a+N(e.amt),0);
 const exps=open.filter(e=>e.type==="exp").reduce((a,e)=>a+N(e.amt),0);
 const pin=open.filter(e=>e.type==="in"&&e.st==="pending").reduce((a,e)=>a+N(e.amt),0);
 const pexp=open.filter(e=>e.type==="exp"&&e.st==="pending").reduce((a,e)=>a+N(e.amt),0);
 return {opening,ins,exps,bal:opening+ins-exps,pin,pexp,open,last};
}
// ضغط صورة الإيصال لـ JPEG صغيرة تتخزن جوه الداتابيز
export function shrink(file,max=900,cap=200000){
 return new Promise((res,rej)=>{
  const url=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{
   let w=im.naturalWidth,h=im.naturalHeight,k=Math.min(1,max/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);
   const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(im,0,0,w,h);URL.revokeObjectURL(url);
   let q=.7,d=c.toDataURL("image/jpeg",q);
   while(d.length>cap&&q>.2){q-=.1;d=c.toDataURL("image/jpeg",q)}
   if(d.length>cap+40000)rej(new Error("big"));else res(d);
  };
  im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("bad"))};
  im.src=url;
 });
}
// كشف حساب للطباعة. info={brn,title,opening,rows,from,to}
export function stmtHtml(info,logo){
 let run=N(info.opening),ti=0,te=0;
 const rows=(info.rows||[]).slice().sort((a,b)=>N(a.ts)-N(b.ts)).filter(e=>e.st!=="rejected");
 const body=rows.map((e,i)=>{
  const isIn=e.type==="in",a=N(e.amt);if(isIn){run+=a;ti+=a}else{run-=a;te+=a}
  return `<tr><td>${i+1}</td><td>${E(e.dt)}</td><td>${E(e.cat||"")}${e.img?" 📎":""}</td><td>${E([e.note,e.inv?"فاتورة "+e.inv:"",e.carn].filter(Boolean).join(" — "))}</td><td class="n">${isIn?fmt(a):""}</td><td class="n">${isIn?"":fmt(a)}</td><td class="n">${fmt(run)}</td></tr>`}).join("");
 return `<div class="st"><div class="ph">${logo?`<img src="${logo}" alt="">`:""}<h2>${E(info.title||"كشف حساب العهدة")}</h2><div>${E(info.to||today())}</div></div>
 <div class="rt"><div><small>${E(info.lbl||"الفرع")}</small><b><bdi dir="ltr">${E(info.brn)}</bdi></b></div><div><small>الفترة</small><b style="white-space:nowrap;font-size:11pt">${E(info.from||"—")} ← ${E(info.to||today())}</b></div><div><small>الرصيد الافتتاحي</small><b>${fmt(info.opening)}</b></div></div>
 <table class="stt"><thead><tr><th>#</th><th>التاريخ</th><th>البند</th><th>البيان</th><th>عهدة (له)</th><th>مصروف (عليه)</th><th>الرصيد</th></tr></thead><tbody>${body||'<tr><td colspan="7" style="text-align:center">لا توجد حركات</td></tr>'}</tbody></table>
 <div class="tt"><span>الافتتاحي ${fmt(info.opening)}</span><span>إجمالي العهدة ${fmt(ti)}</span><span>إجمالي المصروفات ${fmt(te)}</span><span><b>الرصيد المتبقي ${fmt(run)}</b></span></div>
 <div class="sg"><span>${E(info.sg1||"أمين الفرع")}</span><span>المحاسب</span><span>المدير</span></div></div>`;
}
const CSS=`#pa{display:none}
@media print{
 @page{size:A4;margin:12mm 14mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}html,html.app{background:#fff!important}
 body.ps{background:#fff!important;color:#000!important}body.ps>*:not(#pa){display:none!important}body.ps #pa{display:block!important;color:#000;font-size:12pt}
 #pa .st .ph{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:4mm;margin-bottom:5mm}#pa .st .ph img{height:16mm;filter:invert(1)}#pa .st h2{margin:0;font-size:19pt}
 #pa .st .rt{display:flex;gap:5mm;margin-bottom:5mm}#pa .st .rt div{flex:1;border:1.5px solid #000;border-radius:3mm;padding:2mm 4mm}#pa .st .rt small{display:block;font-size:9pt;color:#444}#pa .st .rt b{font-size:13pt}
 #pa .stt{width:100%;border-collapse:collapse;font-size:11pt}#pa .stt th{border:1px solid #000;background:#eee!important;padding:2mm;color:#000;text-align:right}#pa .stt td{border:1px solid #777;padding:1.8mm 2mm;color:#000}#pa .stt td.n{text-align:left;direction:ltr;font-weight:700}#pa .stt tr{break-inside:avoid}#pa .stt thead{display:table-header-group}
 #pa .st .tt{display:flex;justify-content:space-between;gap:4mm;border-top:2px solid #000;margin-top:4mm;padding-top:3mm;font-size:12pt;flex-wrap:wrap}
 #pa .st .sg{display:flex;gap:14mm;margin-top:16mm}#pa .st .sg span{flex:1;border-top:1px solid #777;text-align:center;padding-top:5px;color:#444}
}`;
export function printStmt(html){
 if(!document.getElementById("cust-css")){const s=document.createElement("style");s.id="cust-css";s.textContent=CSS;document.head.appendChild(s)}
 let pa=document.getElementById("pa");if(!pa){pa=document.createElement("div");pa.id="pa";document.body.appendChild(pa)}
 pa.innerHTML=html;document.body.classList.add("ps");
 const done=()=>{document.body.classList.remove("ps");pa.innerHTML="";removeEventListener("afterprint",done)};
 addEventListener("afterprint",done);setTimeout(()=>window.print(),80);
}
export function ensurePrintCss(){if(!document.getElementById("cust-css")){const s=document.createElement("style");s.id="cust-css";s.textContent=CSS;document.head.appendChild(s)}}

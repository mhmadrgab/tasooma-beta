// 🛒 تحليل النواقص + 📊 التقرير الأسبوعي (نوفمبر 2026، طلب محمد)
// النواقص: كل صنف المستودع علّمه "غير متوفر" (rows[].na) في آخر 30 يوم، متجمّع بالكود+اللون+المقاس.
//   لو اتعلّم 3 مرات أو أكتر في آخر 14 يوم ومحدش علّم "اتعمل طلب شراء" بعدها ← "🛒 محتاج طلب شراء" (نفس حساب السيرفر shortages()).
//   buy/{key} = {k,c,z,at,by,n} لما حد يدوس "اتعمل طلب شراء".
// التقرير الأسبوعي: نافذة في اللوحة (آخر 7 أيام) + "حفظ PDF"، بتتفتح من الإشعار (admin.html?rep=week) أو من زرار في لوحة الأداء.
//   cfg/weekly = {to:[إيميلات]} مين يوصله الإشعار يوم الخميس (المالك بيختار من تبويب الموظفين).
import {collection,doc,setDoc,onSnapshot} from "./fb.js";
import {E,N,fmt,printStmt} from "./cust.js";
import {giftsSince,giftNet} from "./gifts.js";
const g=id=>document.getElementById(id);
const D=864e5,MIN=3,WIN=14;
let X=null,BUY={},WK=[],STF=[],un=[],open=false;
const CSS=`
.sh-ban{display:flex;align-items:center;gap:12px;background:#fdecea;border:1px solid #efb2aa;color:#8a2218;border-radius:16px;padding:12px 16px;margin-bottom:14px;cursor:pointer}
.sh-ban b{font-size:16px}.sh-ban span{margin-inline-start:auto;font-weight:700;font-size:13px;text-decoration:underline}
.sh-p{margin-bottom:14px}.sh-p summary{cursor:pointer;font-weight:800;font-size:16px;padding:4px 0}
.sh-t{width:100%;border-collapse:collapse;font-size:14px;margin-top:10px}.sh-t th{font-size:12.5px;color:var(--mut);text-align:start;padding:6px 8px;border-bottom:2px solid var(--line)}
.sh-t td{padding:8px;border-bottom:1px solid var(--line)}.sh-t tr.hot td{background:#fff3f1}.sh-t .k{font-weight:800;direction:ltr;text-align:right}
.sh-tag{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800;background:#c4362b;color:#fff}.sh-ok{color:#1d5a24;font-weight:700;font-size:12.5px}
#wrm{display:none;position:fixed;inset:0;z-index:84;background:rgba(0,0,0,.55);overflow:auto;padding:14px}#wrm.on{display:block}
.wr{max-width:820px;margin:2vh auto;background:var(--card);color:var(--ink);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.wr-h{display:flex;align-items:center;gap:12px;background:linear-gradient(120deg,#2b2416,#1b1b1b);color:#fff;padding:16px 20px;border-bottom:3px solid #d4ae5c}.wr-h b{font-size:20px;display:block}.wr-h small{color:#cdb67a}
.wr-b{padding:16px 20px}.wr-k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.wr-k div{background:var(--soft,#f6f2e9);border-radius:14px;padding:10px 12px}.wr-k b{display:block;font-size:24px}.wr-k small{color:var(--mut);font-size:12.5px}
.wr h4{margin:18px 0 8px;font-size:16px}.wr table{width:100%;border-collapse:collapse;font-size:14px}.wr th{font-size:12.5px;color:var(--mut);text-align:start;padding:6px;border-bottom:2px solid #d4ae5c}.wr td{padding:7px 6px;border-bottom:1px solid var(--line)}
.wr-a{display:flex;gap:8px;flex-wrap:wrap;padding:14px 20px;border-top:1px solid var(--line);background:var(--soft,#f6f2e9)}.wr-a .bt{flex:1}
@media (max-width:600px){.wr-k{grid-template-columns:1fr 1fr}.wr-b{padding:12px}}
@media (prefers-color-scheme:dark){.sh-ban{background:#3a1715;border-color:#6b2a24;color:#f1a5a0}.sh-t tr.hot td{background:#2a1513}}
@media print{#wrm{display:none!important}}
`;
const key=x=>[x.k,x.c||"",x.z||""].map(v=>String(v).trim()).join("|");
const dkey=k=>k.replace(/\//g,"∕").slice(0,140);// اسم مستند مسموح (من غير /)
const label=o=>[o.k,o.c,o.z].filter(Boolean).join(" ");

// ---------- الحساب ----------
export function shortList(){
  if(!X)return [];const now=Date.now(),m={};
  for(const r of X.R()){if(r.tr||N(r.ts)<now-30*D)continue;
    for(const x of (Array.isArray(r.rows)?r.rows:[])){if(!x||!x.na||!x.k)continue;const k=key(x),o=m[k]=m[k]||{k:x.k,c:x.c||"",z:x.z||"",n:0,n14:0,q:0,last:0,brs:new Set()};
      const t=N(r.eat)||N(r.ts);o.n++;if(t>=now-WIN*D)o.n14++;o.q+=N(x.q);o.last=Math.max(o.last,t);o.brs.add(r.brn||r.br)}}
  return Object.values(m).map(o=>{const b=BUY[dkey(key(o))];o.bought=b&&N(b.at)>=o.last?b:null;o.hot=o.n14>=MIN&&!o.bought;return o}).sort((a,b)=>b.hot-a.hot||b.n-a.n||b.q-a.q);
}
// ---------- لوحة النواقص (فوق تبويب الطلبات) ----------
export function shortView(){
  if(!X)return "";const L=shortList();if(!L.length)return "";const hot=L.filter(o=>o.hot);
  return `${hot.length?`<div class="sh-ban" data-shopen><span style="font-size:26px">🛒</span><div><b>${hot.length} كود محتاج طلب شراء</b><div style="font-size:13px">${hot.slice(0,3).map(o=>`<bdi dir="ltr">${E(label(o))}</bdi> (${o.n14}×)`).join(" · ")}</div></div><span>عرض التفاصيل</span></div>`:""}
  <details class="pan sh-p" id="shp" ${open?"open":""}><summary>🛒 تحليل النواقص غير المتوفرة (آخر 30 يوماً) · ${L.length} صنف</summary>
  <p class="off" style="font-size:13px;margin:6px 0 0">كل صنف علّمه المستودع "غير متوفر" في الطلبات. إذا تكرّر ${MIN} مرات أو أكثر خلال ${WIN} يوماً يظهر "محتاج طلب شراء"، ويصلك في ملخّص اليوم.</p>
  <div class="tw"><table class="sh-t"><thead><tr><th>الصنف</th><th>مرات غير متوفر</th><th>الكمية المطلوبة</th><th>الفروع</th><th>آخر مرة</th><th></th></tr></thead><tbody>
  ${L.map(o=>`<tr class="${o.hot?"hot":""}"><td class="k">${E(label(o))}</td><td><b>${o.n}</b>${o.n14!==o.n?` <small class="off">(${o.n14} آخر ${WIN} يوم)</small>`:""}</td><td>${fmt(o.q)}</td><td style="font-size:12.5px">${[...o.brs].slice(0,4).map(b=>`<bdi dir="ltr">${E(b)}</bdi>`).join("، ")}${o.brs.size>4?` +${o.brs.size-4}`:""}</td><td style="font-size:12.5px">${new Date(o.last).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})}</td>
   <td>${o.hot?`<span class="sh-tag">🛒 محتاج طلب شراء</span>${X.canBuy?` <button class="bt s" data-shbuy="${E(key(o))}" type="button">✔ اتعمل طلب شراء</button>`:""}`:o.bought?`<span class="sh-ok">✔ طلب شراء · ${E(o.bought.n||"")}</span>`:""}</td></tr>`).join("")}</tbody></table></div></details>`;
}
// ---------- التقرير الأسبوعي ----------
function weekData(){
  const now=Date.now(),a=now-7*D,R=X.R().filter(r=>N(r.ts)>=a),O=R.filter(r=>!r.tr),T=R.filter(r=>r.tr);
  const dlv=O.filter(r=>N(r.dlv)),in24=dlv.filter(r=>N(r.dlv)-N(r.ts)<=D).length,rcv=O.filter(r=>r.rcv),bad=rcv.filter(r=>r.rcv.ok===false).length;
  const dep=O.filter(r=>N(r.dep)).map(r=>N(r.dep)-N(r.ts)).sort((x,y)=>x-y),med=dep.length?dep[dep.length>>1]:0;
  const per={};O.forEach(r=>{const k=r.brn||r.br;(per[k]=per[k]||{n:0,p:0}).n++;per[k].p+=N(r.pcs)});
  const codes={};O.forEach(r=>(Array.isArray(r.rows)?r.rows:[]).forEach(x=>{if(!x||x.na||!x.k)return;codes[x.k]=(codes[x.k]||0)+N(x.q)}));
  const sh=shortList().filter(o=>o.last>=a);
  let G=[];try{G=giftsSince(a)}catch(e){}
  const gOk=G.filter(r=>r.st==="ok"||r.st==="set");
  return {a,now,O,T,dlv,in24,rcv,bad,med,per:Object.entries(per).sort((x,y)=>y[1].p-x[1].p),codes:Object.entries(codes).sort((x,y)=>y[1]-x[1]),sh,G,gOk,gPcs:gOk.reduce((s,r)=>s+giftNet(r),0)};
}
const dd=t=>new Date(t).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric"});
const hrs=ms=>ms?(ms<36e5?Math.round(ms/6e4)+" د":(ms/36e5).toFixed(1)+" س"):"—";
function weekBody(w,print){
  const pct=w.dlv.length?Math.round(w.in24/w.dlv.length*100):0;
  const k=[["طلبات",w.O.length],["فروع",new Set(w.O.map(r=>r.br)).size],["قطع",fmt(w.O.reduce((s,r)=>s+N(r.pcs),0))],["سُلِّمت",w.dlv.length],["وصلت خلال 24 ساعة",pct+"%"],["متوسط وقت الخروج",hrs(w.med)],["أكّدوا الاستلام",w.rcv.length],["استلام بملاحظات",w.bad]];
  const tb=(h,rows)=>`<table${print?' class="stt"':""}><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")||`<tr><td colspan="${h.length}" style="text-align:center">—</td></tr>`}</tbody></table>`;
  return `${print?`<div class="rt">${k.slice(0,4).map(([l,v])=>`<div><small>${l}</small><b>${v}</b></div>`).join("")}</div><div class="rt">${k.slice(4).map(([l,v])=>`<div><small>${l}</small><b>${v}</b></div>`).join("")}</div>`:`<div class="wr-k">${k.map(([l,v])=>`<div><b>${v}</b><small>${l}</small></div>`).join("")}</div>`}
  ${w.T.length?`<p>🔄 ${w.T.length} تحويل بين الفروع</p>`:""}
  <h4>🏬 أكثر الفروع طلباً</h4>${tb(["الفرع","طلبات","قطع"],w.per.slice(0,8).map(([b,v])=>`<tr><td><bdi dir="ltr">${E(b)}</bdi></td><td>${v.n}</td><td>${fmt(v.p)}</td></tr>`))}
  <h4>📦 أكثر الأكواد طلباً</h4>${tb(["الكود","الكمية"],w.codes.slice(0,10).map(([c,q])=>`<tr><td><bdi dir="ltr">${E(c)}</bdi></td><td>${fmt(q)}</td></tr>`))}
  <h4>🛒 الأصناف غير المتوفرة هذا الأسبوع${w.sh.filter(o=>o.hot).length?` · ${w.sh.filter(o=>o.hot).length} محتاج طلب شراء`:""}</h4>${tb(["الصنف","مرات","الكمية","الحالة"],w.sh.slice(0,12).map(o=>`<tr><td><bdi dir="ltr">${E(label(o))}</bdi></td><td>${o.n}</td><td>${fmt(o.q)}</td><td>${o.hot?"محتاج طلب شراء":o.bought?"اتعمل طلب شراء":""}</td></tr>`))}
  <h4>🎁 الهدايا والعينات</h4>${tb(["مسجّلة","معتمدة","قطع (صافي)","بانتظار الاعتماد","مرفوضة"],[`<tr><td>${w.G.length}</td><td>${w.gOk.length}</td><td>${fmt(w.gPcs)}</td><td>${w.G.filter(r=>r.st==="pend").length}</td><td>${w.G.filter(r=>r.st==="no").length}</td></tr>`])}`;
}
export function openWeek(){
  if(!X)return;const w=weekData();let m=g("wrm");if(!m){m=document.createElement("div");m.id="wrm";m.addEventListener("click",e=>{if(e.target===m)m.className=""});document.body.appendChild(m)}
  m.innerHTML=`<div class="wr"><div class="wr-h"><span style="font-size:30px">📊</span><div><b>التقرير الأسبوعي</b><small>${dd(w.a)} ← ${dd(w.now)}</small></div></div><div class="wr-b">${weekBody(w,false)}</div>
  <div class="wr-a"><button class="bt p" type="button" data-wrpdf>🖨 حفظ PDF / طباعة</button><button class="bt" type="button" data-wrx>إغلاق</button></div></div>`;m.className="on";
}
function printWeek(){const w=weekData();printStmt(`<div class="st"><div class="ph"><h2>التقرير الأسبوعي</h2><div>${dd(w.a)} ← ${dd(w.now)}</div></div>${weekBody(w,true)}<div class="sg"><span>مسؤول المستودع</span><span>المدير</span></div></div>`)}
// ---------- مين يوصله التقرير (المالك، تبويب الموظفين) ----------
export function weeklyCfgView(){
  if(!X||!X.owner)return "";const ppl=[{e:X.ownerEmail,n:"أنت (المالك)"},...STF.filter(s=>s.enabled&&(s.admin||s.v)).map(s=>({e:s.id,n:s.name||s.id}))];
  return `<div class="pan" style="margin-top:12px"><h3 style="margin:0 0 4px">📊 التقرير الأسبوعي</h3><p class="off" style="margin:0 0 10px;font-size:13px">كل خميس الساعة 7 مساءً يصل إشعار "التقرير الأسبوعي جاهز" للأشخاص المحدّدين فقط، ويفتح التقرير ويقدر يحفظه PDF.</p>
  <div style="display:flex;flex-wrap:wrap;gap:10px">${ppl.map(p=>`<label style="display:flex;align-items:center;gap:8px;border:1.5px solid var(--line);border-radius:12px;padding:8px 12px;cursor:pointer"><input type="checkbox" data-wkto="${E(p.e)}" ${WK.includes(p.e)?"checked":""}> <b>${E(p.n)}</b> <small class="off" dir="ltr">${E(p.e)}</small></label>`).join("")}</div>
  <button class="bt s" type="button" data-wropen style="margin-top:10px">👁 معاينة التقرير</button></div>`;
}
// ---------- التشغيل ----------
// ctx: {db, toast, R:()=>الطلبات, me:{e,n}, canBuy, owner, ownerEmail, redraw}
export function initShort(ctx){
  stopShort();X=ctx;
  if(!g("sh-css")){const s=document.createElement("style");s.id="sh-css";s.textContent=CSS;document.head.appendChild(s)}
  un.push(onSnapshot(collection(X.db,"buy"),sn=>{BUY={};sn.docs.forEach(d=>BUY[d.id]=d.data());X.redraw()},()=>{}));
  if(X.owner){un.push(onSnapshot(doc(X.db,"cfg","weekly"),d=>{WK=d.exists()&&Array.isArray(d.data().to)?d.data().to:[];},()=>{}));
    un.push(onSnapshot(collection(X.db,"staff"),sn=>{STF=sn.docs.map(d=>({id:d.id,...d.data()}))},()=>{}))}
  if(!window.__shc){window.__shc=1;
    document.addEventListener("click",async e=>{if(!X)return;const t=e.target;
      if(t.closest("[data-shopen]")){open=true;const p=g("shp");if(p){p.open=true;p.scrollIntoView({behavior:"smooth",block:"start"})}return}
      if(t.closest("[data-wrpdf]"))return void printWeek();
      if(t.closest("[data-wrx]")){const m=g("wrm");if(m)m.className="";return}
      if(t.closest("[data-wropen]"))return void openWeek();
      const b=t.closest("[data-shbuy]");if(b&&X.canBuy){const [k,c,z]=b.dataset.shbuy.split("|");
        if(!confirm(`تأكيد: تم عمل طلب شراء للصنف ${[k,c,z].filter(Boolean).join(" ")}؟\nسيختفي التنبيه حتى يتكرّر "غير متوفر" مرة أخرى.`))return;
        try{await setDoc(doc(X.db,"buy",dkey(b.dataset.shbuy)),{k,c,z,at:Date.now(),by:X.me.e,n:String(X.me.n||X.me.e).slice(0,60)});X.toast("✔ تم تسجيل طلب الشراء")}catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message))}}
    });
    document.addEventListener("toggle",e=>{if(e.target&&e.target.id==="shp")open=e.target.open},true);
    document.addEventListener("change",async e=>{const t=e.target;if(!X||!X.owner||!t.dataset||!t.dataset.wkto)return;
      const set=new Set(WK);t.checked?set.add(t.dataset.wkto):set.delete(t.dataset.wkto);
      try{await setDoc(doc(X.db,"cfg","weekly"),{to:[...set].slice(0,20)});X.toast("تم حفظ من يصله التقرير الأسبوعي")}catch(x){X.toast("تعذر الحفظ (انشر القواعد الجديدة)");t.checked=!t.checked}});
  }
  if(new URLSearchParams(location.search).get("rep")==="week")setTimeout(openWeek,1500);
}
export function stopShort(){un.forEach(f=>f());un=[];BUY={};WK=[];STF=[];const m=g("wrm");if(m)m.remove();X=null}

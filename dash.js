// لوحة الأداء (أول تبويب الطلبات): دواير نسب بتلف، ومراحل الطلبات حالياً، والطلبات مقابل اللي سُلِّم يوماً بيوم، وأكتر الفروع والأكواد.
// كله محسوب من الطلبات اللي محمّلة أصلاً في الصفحة (R)، فلا يوجد ولا قراءة زيادة من Firebase.
// الدواير والأرقام بتتحرك بس لما القيمة نفسها تتغيّر (مش مع كل رسمة للصفحة).
// ألوان الرسم (ذهبي = طلبات، تركواز = سُلِّم) متجرّبة لعمى الألوان في الوضع الفاتح والغامق.
let X=null,PER="7",SEEN={};
try{PER=localStorage.getItem("dz_per")||"7"}catch(e){}
const PERS=[["1","اليوم"],["7","آخر 7 أيام"],["30","آخر 30 يوم"]];
const H=36e5,D=864e5,N=x=>Number.isFinite(+x)?+x:0;
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Math.round(n).toLocaleString("en-US");
const midnight=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
const from=p=>midnight(Date.now())-(+p-1)*D;
const dur=ms=>!ms?"—":ms<H?`${Math.max(1,Math.round(ms/6e4))} دقيقة`:ms<48*H?`${(ms/H).toFixed(ms<10*H?1:0)} ساعة`:`${(ms/D).toFixed(ms<10*D?1:0)} يوم`;
const dlvAt=r=>N(r.dlv)||N(r.rcv&&r.rcv.at);
const reduce=()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}};
const STYLE=`
.dz{--dz-card:#fff;--dz-ink:#1b1b1b;--dz-ink2:#55524c;--dz-mut:#8a867e;--dz-grid:#ece9e3;--dz-track:#efece6;--dz-s1:#a8832f;--dz-s2:#00899e;
 --dz-r1:#00899e;--dz-r2:#a8832f;--dz-r3:#2f8f3e;--dz-r4:#2a78d6;--dz-new:#a8832f;--dz-prep:#00899e;--dz-go:#2a78d6;--dz-done:#2f8f3e;
 --dz-good:#0ca30c;--dz-warn:#fab219;--dz-bad:#d03b3b;--dz-goodt:#006300;--dz-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 24px -14px rgba(60,45,10,.25);margin-bottom:16px}
@media (prefers-color-scheme:dark){.dz{--dz-card:#1a1a1a;--dz-ink:#f1efec;--dz-ink2:#c3c2b7;--dz-mut:#8f8b84;--dz-grid:#2b2b2b;--dz-track:#2a2a2a;--dz-s1:#b08a36;--dz-s2:#1b9fb3;
 --dz-r1:#1b9fb3;--dz-r2:#c9a04a;--dz-r3:#43a957;--dz-r4:#3987e5;--dz-new:#c9a04a;--dz-prep:#1b9fb3;--dz-go:#3987e5;--dz-done:#43a957;--dz-goodt:#0ca30c;--dz-shadow:0 1px 2px rgba(0,0,0,.4)}}
.dz-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:4px 0 12px}
.dz-hd h2{margin:0;font-size:19px;display:flex;align-items:center;gap:8px;color:var(--dz-ink)}
.dz-hd h2 small{font-size:12.5px;font-weight:600;color:var(--dz-mut)}
.dz-per{display:flex;gap:4px;background:var(--dz-card);padding:4px;border-radius:999px;box-shadow:var(--dz-shadow)}
.dz-per button{font:inherit;font-size:13.5px;font-weight:700;border:0;background:none;color:var(--dz-ink2);padding:6px 14px;border-radius:999px;cursor:pointer}
.dz-per button.on{background:var(--dz-ink);color:var(--dz-card)}
.dz-card{background:var(--dz-card);border-radius:18px;box-shadow:var(--dz-shadow);padding:16px 18px;color:var(--dz-ink)}
.dz-card h3{margin:0 0 12px;font-size:16px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.dz-card h3 small{font-size:12.5px;font-weight:600;color:var(--dz-mut)}
.dz-rings{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:12px}
.dz-ring{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:18px 12px 14px}
.dz-ring .w{position:relative;width:128px;height:128px}
.dz-ring svg{width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.dz-ring .tr{fill:none;stroke:var(--dz-track);stroke-width:10}
.dz-ring .vl{fill:none;stroke-width:10;stroke-linecap:round;filter:drop-shadow(0 2px 4px color-mix(in srgb,currentColor 35%,transparent))}
.dz-ring .vl.dz-anim{animation:dzRing 1.5s cubic-bezier(.22,.9,.24,1) both}
@keyframes dzRing{from{stroke-dashoffset:var(--c)}}
.dz-ring .ct{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.dz-ring .ct b{font-size:30px;line-height:1;letter-spacing:-.5px}.dz-ring .ct b i{font-style:normal;font-size:16px;margin-inline-start:1px;color:var(--dz-ink2)}
.dz-ring .ct small{font-size:11.5px;color:var(--dz-mut);margin-top:4px}
.dz-ring h4{margin:4px 0 0;font-size:15px}
.dz-ring p{margin:0;font-size:12.5px;color:var(--dz-ink2)}
.dz-pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--dz-track);color:var(--dz-ink2)}
.dz-pill i{width:8px;height:8px;border-radius:50%;flex:none}
.dz-sum{display:flex;flex-wrap:wrap;gap:8px;margin:-2px 0 12px}
.dz-sum span{display:inline-flex;align-items:center;gap:5px;background:var(--dz-card);border-radius:999px;padding:6px 13px;font-size:13.5px;color:var(--dz-ink2);box-shadow:var(--dz-shadow)}
.dz-sum b{color:var(--dz-ink);font-size:15px}
.dz-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.dz-st{position:relative;font:inherit;text-align:start;border:1px solid var(--dz-grid);background:var(--dz-card);color:var(--dz-ink);border-radius:14px;padding:12px 14px 12px;cursor:pointer;overflow:hidden;transition:transform .15s,box-shadow .15s}
.dz-st:hover,.dz-st:focus-visible{transform:translateY(-2px);box-shadow:var(--dz-shadow);outline:none}
.dz-st:before{content:"";position:absolute;inset-inline:0;top:0;height:4px;background:var(--k)}
.dz-st .ic{font-size:18px}.dz-st b{display:block;font-size:30px;line-height:1.2;margin-top:2px}
.dz-st .nm{display:block;font-size:13.5px;font-weight:700}.dz-st small{display:block;font-size:12px;color:var(--dz-mut);margin-top:2px;min-height:16px}
.dz-st:not(:last-child):after{content:"‹";position:absolute;inset-inline-end:8px;top:50%;transform:translateY(-50%);font-size:22px;color:var(--dz-mut);opacity:.6}
.dz-row{display:grid;grid-template-columns:1.6fr 1fr;gap:12px;margin-top:12px}
.dz-lg{display:flex;gap:14px;font-size:12.5px;font-weight:600;color:var(--dz-ink2)}
.dz-lg span{display:inline-flex;align-items:center;gap:6px}.dz-lg i{width:10px;height:10px;border-radius:3px}
.dz-row>.dz-card{display:flex;flex-direction:column}
.dz-ch{position:relative;display:flex;gap:10px;flex:1;min-height:190px;padding-bottom:22px}
.dz-ax{display:flex;flex-direction:column;justify-content:space-between;font-size:11px;color:var(--dz-mut);text-align:end;padding-bottom:0;min-width:18px;font-variant-numeric:tabular-nums}
.dz-pl{position:relative;flex:1;display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid var(--dz-grid)}
.dz-gl{position:absolute;inset-inline:0;border-top:1px solid var(--dz-grid);pointer-events:none}
.dz-day{position:relative;flex:1;height:100%;display:flex;align-items:flex-end;justify-content:center;gap:2px;border:0;background:none;padding:0 1px;cursor:default;font:inherit;border-radius:6px}
.dz-day:hover,.dz-day:focus-visible{background:color-mix(in srgb,var(--dz-ink) 5%,transparent);outline:none}
.dz-day i{display:block;flex:1;max-width:22px;min-height:0;border-radius:4px 4px 0 0;transform-origin:bottom}
.dz-day i.a{background:var(--dz-s1)}.dz-day i.b{background:var(--dz-s2)}
.dz-day i.z{min-height:2px;opacity:.35}
.dz-grow i{animation:dzGrow .9s cubic-bezier(.22,.9,.24,1) both}
@keyframes dzGrow{from{transform:scaleY(0)}}
.dz-day .x{position:absolute;bottom:-20px;inset-inline:0;font-size:10.5px;color:var(--dz-mut);text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}
.dz-tip{position:absolute;top:6px;left:50%;box-shadow:0 6px 18px -6px rgba(0,0,0,.35);transform:translateX(-50%);background:var(--dz-ink);color:var(--dz-card);font-size:12px;line-height:1.5;padding:7px 10px;border-radius:10px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .12s;z-index:3;text-align:start}
.dz-tip.r{left:auto;right:0;transform:none}.dz-tip.l{left:0;transform:none}
.dz-tip b{display:block}.dz-tip span{display:flex;align-items:center;gap:6px}.dz-tip span i{width:8px;height:8px;border-radius:2px;display:inline-block;animation:none}
.dz-day:hover .dz-tip,.dz-day:focus-visible .dz-tip{opacity:1}
.dz-tbl{margin-top:10px;font-size:13px}.dz-tbl summary{cursor:pointer;color:var(--dz-ink2);font-weight:600}
.dz-tbl table{width:100%;border-collapse:collapse;margin-top:8px;font-variant-numeric:tabular-nums}.dz-tbl th,.dz-tbl td{padding:5px 8px;border-bottom:1px solid var(--dz-grid);text-align:start}
.dz-top{display:flex;flex-direction:column;gap:9px}
.dz-tr{display:grid;grid-template-columns:minmax(80px,120px) 1fr auto;align-items:center;gap:10px;font-size:13.5px}
.dz-tr span{direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dz-tr .t{height:10px;border-radius:999px;background:var(--dz-track);overflow:hidden}
.dz-tr .t i{display:block;height:100%;border-radius:999px;background:var(--dz-s1);transform-origin:right}
.dz-tr em{font-style:normal;font-weight:700;min-width:28px;text-align:end;font-variant-numeric:tabular-nums}
.dz-grow2 .t i{animation:dzBar .9s cubic-bezier(.22,.9,.24,1) both}
@keyframes dzBar{from{transform:scaleX(0)}}
.dz-none{color:var(--dz-mut);font-size:13.5px;padding:8px 0}
.dz-trl{margin-top:12px;display:flex;flex-direction:column}.dz-trl>div{padding:8px 2px;border-top:1px solid var(--dz-grid);font-size:14px}
.dz-trl small{display:block;color:var(--dz-mut);font-size:12.5px}
@media (max-width:900px){.dz-rings{grid-template-columns:1fr 1fr}.dz-row{grid-template-columns:1fr}}
@media (max-width:560px){.dz-flow{grid-template-columns:1fr 1fr}.dz-st:nth-child(2):after{display:none}.dz-ring .w{width:108px;height:108px}.dz-ring .ct b{font-size:25px}.dz-card{padding:14px}}
@media (prefers-reduced-motion:reduce){.dz *{animation:none!important;transition:none!important}}`;

export function initDash(ctx){
  X=ctx;SEEN={};
  if(!document.getElementById("dz-css")){const s=document.createElement("style");s.id="dz-css";s.textContent=STYLE;document.head.appendChild(s)}
  if(window.__dzc)return;window.__dzc=1;
  document.addEventListener("click",e=>{
    const p=e.target.closest("[data-dp]");
    if(p&&X){PER=p.dataset.dp;try{localStorage.setItem("dz_per",PER)}catch(x){}X.redraw();return}
    // مرحلة من المراحل: اللوحة بتفلتر بنفسها (data-s)، وإحنا ننزل للطلبات
    if(e.target.closest(".dz-st"))setTimeout(()=>{const c=document.querySelector('main .chip[data-s="all"]'),hd=document.querySelector(".hd");if(!c)return;
      window.scrollTo({top:c.getBoundingClientRect().top+scrollY-(hd?hd.offsetHeight:0)-12,behavior:reduce()?"auto":"smooth"})},30);
  });
}
// لازم تتحرك؟ (أول مرة، أو القيمة اتغيّرت، أو الفترة اتغيّرت). الصفحة بتترسم كذا مرة ورا بعض،
// فلو اترسمت والحركة لا يزال شغّالة بنكمّلها من مكانها (رقم سالب = الحركة بدأت من كام ملّي ثانية) بدل ما تقف أو تبدأ من الأول.
const DUR=1500;
const moved=(id,v)=>{const k=PER+"|"+v,s=SEEN[id],now=Date.now();
  if(!s||s.k!==k){SEEN[id]={k,t:now};return 0}
  const el=now-s.t;return el<DUR?el:-1};
const delay=el=>el>0?`animation-delay:-${el}ms;`:"";
const cu=(el,v)=>el>=0?`data-cu="${v}" data-t0="${Date.now()-el}"`:"";

function ring(id,color,pct,label,sub,pill){
  const C=2*Math.PI*42,has=pct!==null,v=has?Math.max(0,Math.min(100,pct)):0,off=C*(1-v/100),el=has?moved(id,Math.round(v)):-1;
  return `<div class="dz-card dz-ring" role="img" aria-label="${E(label)}: ${has?Math.round(v)+"%":"لا توجد بيانات"}. ${E(sub)}">
   <div class="w"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="tr" cx="50" cy="50" r="42"/>${has&&v>0?`<circle class="vl${el>=0?" dz-anim":""}" cx="50" cy="50" r="42" style="color:${color};stroke:${color};--c:${C.toFixed(2)};${delay(el)}" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>`:""}</svg>
   <div class="ct"><b>${has?`<span ${cu(el,Math.round(v))}>${Math.round(v)}</span><i>%</i>`:"—"}</b></div></div>
   <h4>${E(label)}</h4><p>${E(sub)}</p>${pill||""}</div>`;
}
// حالة النسبة: أيقونة + كلمة (اللون لوحده مش كفاية)
const pill=pct=>pct===null?"":pct>=90?`<span class="dz-pill"><i style="background:var(--dz-good)"></i>ممتاز</span>`:pct>=70?`<span class="dz-pill"><i style="background:var(--dz-warn)"></i>جيد</span>`:`<span class="dz-pill"><i style="background:var(--dz-bad)"></i>يحتاج إلى متابعة</span>`;
// سطر الملخّص تحت العنوان (أرقام الفترة نفسها، مش حالة الطلبات حالياً)
const sum=(id,icon,val,label)=>`<span>${icon} <b ${cu(moved(id,val),val)}>${fmt(val)}</b> ${E(label)}</span>`;

export function dashView(R){
  if(!X)return "";
  const t0=from(PER),now=Date.now(),RQ=R.filter(r=>!r.tr),C=RQ.filter(r=>N(r.ts)>=t0);// التحويلات ليها كارت لوحدها
  const dl=C.filter(r=>r.st==="done"||r.st==="recv"),rc=C.filter(r=>r.st==="recv"),ok=rc.filter(r=>!r.rcv||r.rcv.ok!==false);
  const tt=dl.map(r=>dlvAt(r)-N(r.ts)).filter(x=>x>0),fast=tt.filter(x=>x<=24*H).length,avg=tt.length?tt.reduce((a,b)=>a+b,0)/tt.length:0;
  // الوقت في كل مرحلة لوحدها (بدل رقم واحد "بيخرج من المستودع" كان بيجمع الانتظار والتجهيز وانتظار السائق مع بعض ومش مفهوم).
  // ⚠️ prep.at = وقت "بدء التجهيز" (مش خلصه): لا يوجد وقت مسجّل لـ "خلص التجهيز" في الطلبات العادية، فالمرحلة التانية = التجهيز + انتظار السائق.
  // الوسيط (النص الطلبات أسرع والنص أبطأ) بدل المتوسط: طلب واحد اتعمل بالليل واتجهّز الصبح مايبوّظش الرقم.
  const med=a=>{a=a.filter(x=>x>0&&x<14*D).sort((x,y)=>x-y);return a.length?(a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2):0};
  const hm2=ms=>{const m=Math.max(1,Math.round(ms/6e4)),h=Math.floor(m/60);return h>=48?`${(ms/D).toFixed(1)} يوم`:h?`${h} س${m%60?` ${m%60} د`:""}`:`${m} دقيقة`};
  const pa=r=>N(r.prep&&r.prep.at),tPrep=med(C.map(r=>pa(r)-N(r.ts))),tWait=med(C.map(r=>pa(r)&&N(r.dep)?N(r.dep)-pa(r):0)),tRoad=med(C.map(r=>N(r.dep)&&dlvAt(r)?dlvAt(r)-N(r.dep):0));
  const stg=(icon,label,v,tip)=>v?`<span title="${E(tip)}">${icon} ${E(label)} <b>${E(hm2(v))}</b></span>`:"";
  const pc=(a,b)=>b?a/b*100:null,p1=pc(dl.length,C.length),p2=pc(rc.length,dl.length),p3=pc(ok.length,rc.length),p4=pc(fast,tt.length);
  const pcs=C.reduce((a,r)=>a+N(r.pcs),0),brs=new Set(C.map(r=>String(r.br||String(r.brn||"").split("-")[0]))).size;
  const lbl=(PERS.find(p=>p[0]===PER)||PERS[1])[1];
  // المراحل حالياً (مهما كان تاريخ الطلب)
  const stage=(st,icon,name,k)=>{const L=RQ.filter(r=>r.st===st),old=L.length?Math.min(...L.map(r=>st==="new"?N(r.ts):st==="prep"?(N(r.prep&&r.prep.at)||N(r.ts)):st==="go"?(N(r.dep)||N(r.ts)):(dlvAt(r)||N(r.ts)))):0;
    return `<button class="dz-st" data-s="${st}" type="button" style="--k:var(${k})" aria-label="${E(name)}: ${L.length}"><span class="ic">${icon}</span><b><span ${cu(moved("st"+st,L.length),L.length)}>${fmt(L.length)}</span></b><span class="nm">${E(name)}</span><small>${L.length?"أقدم واحد منذ "+dur(now-old):"لا يوجد"}</small></button>`};
  // يوماً بيوم: طلبات اتعملت (ذهبي) مقابل سُلِّمت (تركواز)
  const days=Math.max(7,+PER),d0=midnight(now)-(days-1)*D,rows=[];
  for(let i=0;i<days;i++){const a=d0+i*D,b=a+D;rows.push({a,n:RQ.filter(r=>N(r.ts)>=a&&N(r.ts)<b).length,d:RQ.filter(r=>{const t=dlvAt(r);return t>=a&&t<b}).length})}
  const mx0=Math.max(1,...rows.map(x=>Math.max(x.n,x.d))),step=mx0<=4?1:mx0<=10?2:mx0<=20?5:mx0<=50?10:Math.ceil(mx0/50)*10,mx=Math.ceil(mx0/step)*step;
  const gEl=moved("trend",JSON.stringify(rows.map(x=>[x.n,x.d])));
  const dn=t=>new Date(t).toLocaleDateString("en-GB",{day:"numeric",month:"numeric"}),wd=t=>new Date(t).toLocaleDateString("ar-EG",{weekday:"long"});
  const every=days>14?5:1;
  const bars=rows.map((x,i)=>{const h=v=>v?Math.max(2,v/mx*100):0;
    return `<button class="dz-day" type="button" aria-label="${E(wd(x.a))} ${dn(x.a)}: ${x.n} طلب، ${x.d} سُلِّم"><i class="a${x.n?"":" z"}" style="height:${h(x.n)||2}%;${delay(gEl)}"></i><i class="b${x.d?"":" z"}" style="height:${h(x.d)||2}%;${delay(gEl)}"></i>
     ${(days-1-i)%every===0?`<span class="x">${i===days-1?"اليوم":dn(x.a)}</span>`:""}<span class="dz-tip${i<2?" r":i>=days-2?" l":""}"><b>${E(wd(x.a))} ${dn(x.a)}</b><span><i style="background:var(--dz-s1)"></i>${x.n} طلب جديد</span><span><i style="background:var(--dz-s2)"></i>${x.d} سُلِّم</span></span></button>`}).join("");
  const grid=[0,.5,1].map(f=>`<i class="dz-gl" style="bottom:${f*100}%"></i>`).join("");
  // أكتر الفروع (بالقطع في الفترة) وأكتر الأكواد (الطلبات المفتوحة)
  const per={};C.forEach(r=>{const k=String(r.brn||"");per[k]=(per[k]||0)+N(r.pcs)});
  const topB=Object.entries(per).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const opn={};RQ.filter(r=>r.st==="new"||r.st==="prep").forEach(r=>(Array.isArray(r.rows)?r.rows:[]).forEach(x=>{if(x&&x.na)return;const k=String(x&&x.k||"");if(k)opn[k]=(opn[k]||0)+N(x&&x.q)}));
  const topC=Object.entries(opn).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const tops=(L,id)=>{if(!L.length)return `<div class="dz-none">لا توجد بيانات في هذه الفترة</div>`;const m=L[0][1]||1,el=moved(id,JSON.stringify(L));
    return `<div class="dz-top${el>=0?" dz-grow2":""}">${L.map(([n,v])=>`<div class="dz-tr"><span title="${E(n)}">${E(n)}</span><div class="t"><i style="width:${Math.max(3,v/m*100)}%;${delay(el)}"></i></div><em>${fmt(v)}</em></div>`).join("")}</div>`};
  if(!reduce())requestAnimationFrame(countUp);
  return `<section class="dz" aria-label="لوحة الأداء">
  <div class="dz-hd"><h2>📊 لوحة الأداء <small>${E(lbl)}</small></h2><div class="dz-per" role="group" aria-label="الفترة">${PERS.map(([k,n])=>`<button type="button" data-dp="${k}" class="${PER===k?"on":""}" aria-pressed="${PER===k}">${n}</button>`).join("")}</div></div>
  <div class="dz-sum">${C.length?`${sum("k1","🧾",C.length,"طلب")}${sum("k2","🏬",brs,"فرع قدّموا طلبات")}${sum("k3","📦",pcs,"قطعة")}${stg("⏰","حتى يبدأ التجهيز",tPrep,"من وصول الطلب إلى المستودع حتى يضغط أحدهم \"بدء التجهيز\"")}${stg("🧰","التجهيز حتى خروج السائق",tWait,"من \"بدء التجهيز\" حتى يبدأ السائق الرحلة بالطلب (التجهيز نفسه + انتظار السائق)")}${stg("🚚","الطريق",tRoad,"من خروج السائق حتى يسلّم للفرع")}`:`<span>💤 لم يتم إنشاء طلبات ${PER==="1"?"اليوم":"في هذه الفترة"} لا يزال</span>`}</div>
  <div class="dz-rings">
   ${ring("r1","var(--dz-r1)",p1,"سُلِّمت",C.length?`${fmt(dl.length)} من ${fmt(C.length)} طلب`:"لا توجد طلبات في هذه الفترة")}
   ${ring("r2","var(--dz-r2)",p2,"أكّدوا الاستلام",dl.length?`${fmt(rc.length)} من ${fmt(dl.length)} سُلِّم`:"لا يوجد تسليم بعد",pill(p2))}
   ${ring("r3","var(--dz-r3)",p3,"استلام سليم",rc.length?(rc.length-ok.length?`${fmt(rc.length-ok.length)} بملاحظات نقص/تلف`:"دون أي ملاحظات"):"لا يوجد تأكيد بعد",pill(p3))}
   ${ring("r4","var(--dz-r4)",p4,"وصلت خلال 24 ساعة",tt.length?`متوسط التوصيل ${dur(avg)}`:"لا يوجد تسليم بعد",pill(p4))}
  </div>
  <div class="dz-card"><h3>الطلبات حالياً <small>اضغط على أي مرحلة لترى طلباتها</small></h3><div class="dz-flow">
   ${stage("new","🆕","جديد","--dz-new")}${stage("prep","⏳","قيد التجهيز","--dz-prep")}${stage("go","🚚","في الطريق","--dz-go")}${stage("done","📦","وصل وبانتظار التأكيد","--dz-done")}
  </div></div>
  ${trCard(R,now)}
  <div class="dz-row">
   <div class="dz-card"><h3>يوماً بيوم <span class="dz-lg"><span><i style="background:var(--dz-s1)"></i>طلبات جديدة</span><span><i style="background:var(--dz-s2)"></i>سُلِّمت</span></span></h3>
    <div class="dz-ch"><div class="dz-ax" aria-hidden="true"><span>${mx}</span><span>${mx/2%1?"":mx/2}</span><span>0</span></div><div class="dz-pl${gEl>=0?" dz-grow":""}">${grid}${bars}</div></div>
    <details class="dz-tbl"><summary>📋 الأرقام يوماً بيوم</summary><table><thead><tr><th>اليوم</th><th>طلبات جديدة</th><th>سُلِّمت</th></tr></thead><tbody>${rows.slice().reverse().map(x=>`<tr><td>${E(wd(x.a))} ${dn(x.a)}</td><td>${x.n}</td><td>${x.d}</td></tr>`).join("")}</tbody></table></details>
   </div>
   <div class="dz-card"><h3>أكثر الفروع طلباً <small>بالقطع · ${E(lbl)}</small></h3>${tops(topB,"tb")}
    <h3 style="margin-top:18px">أكثر الأكواد طلباً <small>الطلبات المفتوحة</small></h3>${tops(topC,"tc")}</div>
  </div>
 </section>`;
}
// التحويلات بين الفروع: مين مستني إيه حالياً + آخر التحويلات المفتوحة. الضغط = فلتر "🔄 تحويلات"
// (لو لا يزال لا يوجد ولا تحويل: سطر بيقول إزاي تعمل واحد، بدل خانات كلها أصفار)
const trWhere=r=>r.st==="new"||r.st==="prep"?(N(r.rdy)?"✅ جاهز للسائق":r.st==="prep"?"⏳ الفرع يجهّز":"📭 لم يبدأ الفرع بعد"):r.st==="go"?(N(r.pk)?"🚚 السائق استلم ومتجه":"🚚 في الطريق"):"";
function trCard(R,now){
  if(!R.some(r=>r.tr))return `<div class="dz-card" style="margin-top:12px"><h3>🔄 التحويلات بين الفروع</h3><div class="dz-none">لا توجد تحويلات بعد. أنشئ تحويلاً من تبويب <b>"ورقة يدوية"</b> ← نوع الورقة: <b>تحويل بين الفروع</b> ← اختر من فرع وإلى فرع ← <b>"🔄 أرسل التحويل للفرعين"</b>. فور إرساله سيظهر هنا وتتابعه خطوة بخطوة.</div></div>`;
  const TA=R.filter(r=>r.tr&&r.st!=="done"&&r.st!=="recv").sort((a,b)=>N(a.ts)-N(b.ts)),nd=R.filter(r=>r.tr&&r.st==="done").length;
  const wait=TA.filter(r=>r.st!=="go"&&!N(r.rdy)).length,rdy=TA.filter(r=>r.st!=="go"&&N(r.rdy)).length,go=TA.filter(r=>r.st==="go").length;
  const cell=(id,n,icon,name,k,sub)=>`<button class="dz-st" data-s="tr" type="button" style="--k:var(${k})" aria-label="${E(name)}: ${n}"><span class="ic">${icon}</span><b><span ${cu(moved(id,n),n)}>${fmt(n)}</span></b><span class="nm">${E(name)}</span><small>${E(sub)}</small></button>`;
  return `<div class="dz-card" style="margin-top:12px"><h3>🔄 التحويلات بين الفروع <small>اضغط على أي خانة لترى التحويلات</small></h3><div class="dz-flow">
   ${cell("t1",wait,"📭","الفرع يجهّز","--dz-new","بانتظار الفرع المُرسِل")}${cell("t2",rdy,"✅","جاهز للسائق","--dz-prep","عيّن سائقاً من السيارات")}${cell("t3",go,"🚚","في الطريق","--dz-go","مع السائق")}${cell("t4",nd,"📦","وصل وبانتظار التأكيد","--dz-done","الفرع المستلم يؤكّد")}</div>
   ${TA.length?`<div class="dz-trl">${TA.slice(0,8).map(r=>`<div><b><bdi dir="ltr">${E(r.tr.frn)} → ${E(r.brn)}</bdi></b> · ${fmt(N(r.pcs))} قطعة<small>${E(trWhere(r))}${r.asg&&r.asg.drvn?" · 🚚 "+E(r.asg.drvn):""} · منذ ${dur(now-N(r.ts))} · <bdi dir="ltr">${E(r.no)}</bdi></small></div>`).join("")}${TA.length>8?`<small>و${TA.length-8} أيضاً…</small>`:""}</div>`:""}</div>`;
}
// الأرقام بتعدّ من صفر إلى قيمتها
function countUp(){
  document.querySelectorAll(".dz [data-cu]").forEach(el=>{
    const to=N(el.dataset.cu),t0=N(el.dataset.t0)||Date.now();el.removeAttribute("data-cu");if(!to)return;
    const tick=()=>{const p=Math.min(1,(Date.now()-t0)/1100),e=1-Math.pow(1-p,3);el.textContent=fmt(to*e);if(p<1&&el.isConnected)requestAnimationFrame(tick)};
    tick();
  });
}

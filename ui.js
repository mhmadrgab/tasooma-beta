// حركات الواجهة: ظهور الكروت الجديدة بنعومة، عدّاد للأرقام، اهتزاز كارت الدخول لو فيه خطأ، وخلفية شاشة الدخول.
// مابيغيّرش أي بيانات، بيتفرّج على الصفحة بس.
(()=>{
 const RM=matchMedia("(prefers-reduced-motion: reduce)");
 const SEL=".rq,.sc,.pan,.bar,.mr,.hr,.stop,.pick,.card,.tw tbody>tr";
 const seen=new Set();let lastTap=0;
 // بس أزرار التنقل (تبويبات، فلاتر) بتعيد حركة الكروت؛ زرار زي "تعيين" مابيحرّكش الصفحة كلها
 addEventListener("pointerdown",e=>{if(e.target.closest&&e.target.closest(".tabs,.chip,[data-t],[data-s],#fday,#fmon"))lastTap=Date.now()},true);
 const vis=el=>el.getClientRects().length>0;
 const key=el=>el.className+"|"+el.textContent.replace(/\s+/g," ").slice(0,160);
 const ease="cubic-bezier(.2,.8,.2,1)";
 // عدّاد من صفر للرقم (للإحصائيات)
 const count=b=>{const t=b.textContent.trim();if(!/^\d{1,5}$/.test(t)||t==="0")return;const n=+t,t0=performance.now();
  const step=now=>{const p=Math.min(1,(now-t0)/700);b.textContent=String(Math.round(n*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)};
 // الكارت يظهر بحركة لو جديد، أو لو المستخدم لا يزال ضاغط حاجة (تبويب، فلتر...). التحديث اللحظي لنفس البيانات مابيتحرّكش.
 function enter(list){
  const tap=Date.now()-lastTap<900;let i=0;
  for(const el of list){
   const k=key(el),isNew=!seen.has(k);seen.add(k);
   if(RM.matches||!(tap||isNew)||!vis(el)||el.closest(".shot,.mdl,#md,#em"))continue;
   el.animate([{opacity:0,transform:"translateY(12px) scale(.985)"},{opacity:1,transform:"none"}],{duration:420,delay:Math.min(i++,12)*40,easing:ease,fill:"backwards"});
   if(el.matches(".sc"))el.querySelectorAll("b").forEach(count);
   if(el.matches(".bar"))el.querySelectorAll("i").forEach(b=>{b.style.transformOrigin="right";b.animate([{transform:"scaleX(0)"},{transform:"scaleX(1)"}],{duration:800,delay:120,easing:ease,fill:"backwards"})});
  }
  if(seen.size>4000)seen.clear();
 }
 const shake=e=>{if(RM.matches)return;const c=e.closest(".gc,.lg,.card,.mb,.eb")||e;
  c.animate([{transform:"translateX(0)"},{transform:"translateX(-9px)"},{transform:"translateX(8px)"},{transform:"translateX(-6px)"},{transform:"translateX(4px)"},{transform:"translateX(0)"}],{duration:420,easing:"ease-in-out"})};
 // خلفية شاشة الدخول: على #gate لو هو طبقة فوق الصفحة (صفحة الفرع)، وإلا على الصفحة كلها
 const stage=()=>{const els=[...document.querySelectorAll("#gate,.lg")].filter(vis);
  const ov=els.find(e=>getComputedStyle(e).position==="fixed"),body=document.body,on=els.length>0&&!ov;
  if(body.classList.contains("ui-stage")!==on)body.classList.toggle("ui-stage",on);
  const gate=document.getElementById("gate");
  if(gate&&gate.classList.contains("ui-stage")!==(ov===gate))gate.classList.toggle("ui-stage",ov===gate);
 };
 // الجوال: شريط التبويبات بيتسحب؛ بعد كل تحديث للصفحة نخلي التبويب المفتوح باين
 const keepTab=()=>{const on=document.querySelector(".tabs button.on"),t=on&&on.parentElement;if(!t||t.scrollWidth<=t.clientWidth)return;
  const a=on.getBoundingClientRect(),b=t.getBoundingClientRect();if(a.left<b.left+10||a.right>b.right-10)t.scrollLeft+=(a.left+a.width/2)-(b.left+b.width/2)};
 const mo=new MutationObserver(ms=>{
  const add=new Set();let err=null;
  for(const m of ms){
   const t=m.target.nodeType===1?m.target:m.target.parentElement,e=t&&t.closest&&t.closest(".er");
   if(e&&m.type!=="attributes"&&e.textContent.trim())err=e;
   for(const n of m.addedNodes){if(n.nodeType!==1)continue;if(n.matches(SEL))add.add(n);n.querySelectorAll(SEL).forEach(x=>add.add(x))}
  }
  // لو كارت جوه كارت اتضاف، نحرّك الكبير بس
  const list=[...add].filter(el=>{const p=el.parentElement&&el.parentElement.closest(SEL);return !(p&&add.has(p))});
  if(list.length)enter(list);
  // كارت الترحيب بيتحرك أول مرة بس، مش مع كل تحديث للصفحة
  if(!helloShown&&!RM.matches){const h=document.querySelector(".hello");if(h&&vis(h)){helloShown=true;h.animate([{opacity:0,transform:"translateY(-10px) scale(.98)"},{opacity:1,transform:"none"}],{duration:600,easing:ease})}}
  if(err)shake(err);
  stage();keepTab();
 });
 // ---------- كارت الترحيب: "صباح الخير يا فلان" + الساعة والتاريخ (ميلادي وهجري) ----------
 const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const greet=()=>{const h=new Date().getHours();return h>=4&&h<12?["صباح الخير","☀️"]:h<17&&h>=12?["مساء الخير","🌤️"]:h>=17?["مساء الخير","🌙"]:["تعملون في وقت متأخر؟ بارك الله فيكم","🌙"]};
 const fmtT=()=>{const d=new Date();let t="",dt="",hj="";
  try{t=d.toLocaleTimeString("ar-EG-u-nu-latn",{hour:"numeric",minute:"2-digit"});dt=d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"});hj=d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn",{day:"numeric",month:"long",year:"numeric"})}catch(e){t=d.toTimeString().slice(0,5)}
  return {t,dt,hj}};
 // sub: سطر تحت التحية، chips: [[أيقونة, نص], ...]
 window.uiHello=(name,sub,chips)=>{const [g,ic]=greet(),{t,dt,hj}=fmtT();
  return `<div class="hello"><div class="hl"><b><span data-greet>${g}</span> يا ${esc(name)} <span data-gic>${ic}</span></b>${sub?`<p>${sub}</p>`:""}${chips&&chips.length?`<div class="hchips">${chips.map(([i,x])=>`<span>${i} ${x}</span>`).join("")}</div>`:""}</div>
  <div class="hc"><b data-clock>${t}</b><small data-date>${dt}</small><small data-hijri>${hj}</small></div></div>`};
 setInterval(()=>{if(!document.querySelector(".hello"))return;const [g,ic]=greet(),{t,dt,hj}=fmtT();
  const set=(s,v)=>document.querySelectorAll(s).forEach(e=>{if(e.textContent!==v)e.textContent=v});
  set("[data-greet]",g);set("[data-gic]",ic);set("[data-clock]",t);set("[data-date]",dt);set("[data-hijri]",hj)},15000);
 let helloShown=false;
 // ---------- إنشاء حساب والتسجيل مقفول في Firebase ----------
 // Firebase بيرفض أي حساب جديد طول ما "Enable create (sign-up)" مقفول. بدل رسالة إنجليزي، نافذة بالخطوات.
 window.uiSignupOff=what=>{let m=document.getElementById("uim");if(!m){m=document.createElement("div");m.id="uim";m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-uix]"))m.className=""});document.body.appendChild(m)}
  m.innerHTML=`<div class="uik"><div class="uii">🔐</div><h3>افتح التسجيل في Firebase دقيقة</h3><p>للأمان، Firebase يمنع إنشاء أي حساب جديد ما دام التسجيل مغلقاً. لإضافة ${esc(what||"الحساب")}:</p>
  <ol><li>اضغط الزر الموجود بالأسفل وسيفتح لك إعدادات Firebase</li><li>من <b>User actions</b> حدّد <b>Enable create (sign-up)</b> واضغط <b>Save</b></li><li>ارجع إلى هنا واضغط الإضافة مجدداً</li><li>بعد الانتهاء: أزل العلامة واضغط <b>Save</b> مجدداً</li></ol>
  <div class="uib"><a class="bt p" href="https://console.firebase.google.com/project/tasooma-ad4fe/authentication/settings" target="_blank" rel="noopener noreferrer">فتح إعدادات Firebase</a><button class="bt" data-uix type="button">حسناً</button></div></div>`;
  m.className="on"};
 // أي خطأ تسجيل: لو السبب إن التسجيل مقفول نعرض الخطوات ونرجّع true
 window.uiAuthErr=(x,what)=>{if(x&&x.code==="auth/admin-restricted-operation"){window.uiSignupOff(what);return true}return false};
 // النت: لو فصل، علامة "مباشر" تقلب أحمر ويظهر تنبيه. Firebase بيكمّل لوحده أول ما النت يرجع
 const net=()=>document.documentElement.classList.toggle("ui-offline",!navigator.onLine);
 addEventListener("online",net);addEventListener("offline",net);net();
 mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","hidden"]});
 stage();enter([...document.querySelectorAll(SEL)]);
 // شاشة البداية + انتظار الدخول: محتوى الصفحة مخفي (aw) إلى ما الصفحة تقول "عرفنا مين داخل" بـ uiReady()
 // في التطبيق المثبّت بنستنى أيضاً رسمة اللوجو تكمل (حوالي 1.7 ثانية)
 const H=document.documentElement,boot=document.getElementById("boot");
 let ready=false,minDone=!H.classList.contains("app");
 const hide=()=>{if(!ready||!minDone||!boot||!boot.isConnected||boot.classList.contains("out"))return;boot.classList.add("out");setTimeout(()=>boot.remove(),600)};
 if(!minDone)setTimeout(()=>{minDone=true;hide()},Math.max(0,1700-performance.now()));
 window.uiReady=()=>{if(ready)return;ready=true;H.classList.remove("aw");hide()};
 if(!H.classList.contains("aw"))window.uiReady();// صفحات من غير تسجيل دخول
 // الموبايل: الشريط اللي فوق بيختفي وإنت نازل ويرجع أول ما تطلع لفوق (مساحة أكبر للمحتوى)
 let lastY=scrollY,tick=false;
 addEventListener("scroll",()=>{if(tick)return;tick=true;requestAnimationFrame(()=>{tick=false;const y=scrollY,d=y-lastY;if(Math.abs(d)<8&&y>10)return;
  const up=d>0&&y>180&&innerWidth<=760&&!!document.querySelector("#app>.hd>.hi");if(H.classList.contains("hd-up")!==up)H.classList.toggle("hd-up",up);lastY=y})},{passive:true});
})();

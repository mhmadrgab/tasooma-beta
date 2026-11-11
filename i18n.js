/* i18n.js — تبديل لغة المنصة (عربي ⇄ English). نص واجهة المنصة مكتوب بالفصحى، والإنجليزية تُترجَم وقت العرض من القاموس i18n-en.js.
   - يحمّل القاموس فقط عند اختيار الإنجليزية.
   - الاختيار محفوظ على الجهاز (localStorage: tz_lang).
   - أي عنصر عليه data-notr (أو داخله) لا يُترجَم: أسماء، رسائل الدردشة، مدخلات المستخدم.
   - الزر: <button data-lang-toggle> (يُنشئه TZL.btn()). */
(function(root){
"use strict";
var AR=/[؀-ۿ]/;
function isAr(c){var n=c.charCodeAt(0);return (n>=0x621&&n<=0x63A)||(n>=0x640&&n<=0x652)||(n>=0x670&&n<=0x6D3)}

/* ===== تحسين الإنجليزية بعد الترجمة: علامات الترقيم، "منذ"، وجمع الأسماء بعد الأعداد ===== */
var PL={item:"items",piece:"pieces",minute:"minutes",hour:"hours",day:"days",row:"rows",order:"orders",branch:"branches",vehicle:"vehicles",driver:"drivers",trip:"trips",worker:"workers",star:"stars",device:"devices",photo:"photos",sheet:"sheets",code:"codes",delivery:"deliveries",week:"weeks",month:"months",stop:"stops",leg:"legs",record:"records",transfer:"transfers",message:"messages",gift:"gifts",sample:"samples",file:"files",line:"lines",second:"seconds",car:"cars",unit:"units",request:"requests",customer:"customers",transaction:"transactions",expense:"expenses",invoice:"invoices",rating:"ratings",viewer:"viewers",manager:"managers",accountant:"accountants",employee:"employees",kilometer:"kilometers",carton:"cartons",note:"notes",quantity:"quantities"};
var AGO=/\bago\s+(\d[\d,]*(?:\.\d+)?)\s+([A-Za-z]+)/g;
var NUMN=/(^|[^\w.\-])(\d[\d,]*(?:\.\d+)?)(\s+(?:(?:new|open|late|more)\s+)?)([A-Za-z]+)(?![A-Za-z'’])/g;
function post(s){
  s=s.replace(/،/g,",").replace(/؟/g,"?").replace(/؛/g,";").replace(/←/g,"→");// الاتجاه من اليسار لليمين: السهم يشير لليمين
  s=s.replace(AGO,"$1 $2 ago");
  s=s.replace(NUMN,function(m,pre,num,mid,noun){
    var pl=PL[noun.toLowerCase()];
    if(!pl||parseFloat(num.replace(/,/g,""))===1)return m;
    if(noun.charAt(0)!==noun.charAt(0).toLowerCase())pl=pl.charAt(0).toUpperCase()+pl.slice(1);
    return pre+num+mid+pl;
  });
  return s;
}

/* ===== المترجم (نقي، بلا DOM) ===== */
function makeTr(dict){
  var idx={},cache=new Map(),k,c;
  for(k in dict){c=k.charAt(0);(idx[c]||(idx[c]=[])).push(k)}
  for(c in idx)idx[c].sort(function(a,b){return b.length-a.length});
  function find(s,i,n){
    var list=idx[s.charAt(i)];if(!list)return null;
    var p=i?s.charAt(i-1):"";
    for(var j=0;j<list.length;j++){
      var key=list[j];
      if(!s.startsWith(key,i))continue;
      if(isAr(key.charAt(0))&&isAr(p))continue;
      var e=i+key.length;
      if(isAr(key.charAt(key.length-1))&&e<n&&isAr(s.charAt(e)))continue;
      return key;
    }
    return null;
  }
  function tr(s){
    if(!s||!AR.test(s))return s;
    var hit=cache.get(s);if(hit!==undefined)return hit;
    var n=s.length,i=0,out="",changed=false,key;
    while(i<n){
      key=find(s,i,n);
      if(s.charAt(i)===" "&&i+1<n){var k2=find(s,i+1,n);if(k2&&(!key||k2.length>key.length)){out+=" "+dict[k2];i+=1+k2.length;changed=true;continue}} // عبارة أطول تبدأ بعد المسافة
      if(key){out+=dict[key];i+=key.length;changed=true;continue}
      var ch=s.charAt(i);
      if(ch==="و"&&!isAr(i?s.charAt(i-1):"")&&i+1<n){ // "و" العطف: والسائق → and driver
        key=find(s,i+1,n);
        if(key){out+="and "+dict[key];i+=1+key.length;changed=true;continue}
      }
      out+=ch;i++;
    }
    if(changed)out=post(out);
    if(cache.size>5000)cache.clear();
    cache.set(s,out);return out;
  }
  return tr;
}
if(typeof module!=="undefined"&&module.exports){module.exports={makeTr:makeTr};}
if(typeof document==="undefined")return;

/* ===== الحالة ===== */
var KEY="tz_lang",D=document,H=D.documentElement,lang="ar",dict=null,tr=function(s){return s};
try{lang=localStorage.getItem(KEY)==="en"?"en":"ar"}catch(e){}
var orig=new WeakMap(),lastT=new WeakMap(),aOrig=new WeakMap(),obs=null,loading=false;
var ATTRS=["placeholder","title","aria-label","alt"];
var SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,CODE:1,NOSCRIPT:1,SVG:1,svg:1};

function skipEl(el){return !!(el.closest&&el.closest("[data-notr],[contenteditable='true']"))}

/* ===== ترجمة عقدة نصية / خصائص ===== */
function trText(n){
  var v=n.data;
  if(!AR.test(v)&&orig.get(n)===undefined)return;
  var p=n.parentNode;
  if(p&&(SKIP[p.nodeName]||skipEl(p)))return;
  if(orig.has(n)&&lastT.get(n)===v)return;           // نصنا نحن، لم يتغيّر
  if(!AR.test(v)){orig.delete(n);lastT.delete(n);return}
  orig.set(n,v);
  var t=tr(v);
  lastT.set(n,t);
  if(t!==v)n.data=t;
}
function trAttrs(el){
  if(skipEl(el))return;
  var rec=aOrig.get(el),a,v,i;
  for(i=0;i<ATTRS.length;i++){
    a=ATTRS[i];v=el.getAttribute(a);if(v==null)continue;
    if(rec&&rec[a]&&rec[a].t===v)continue;
    if(!AR.test(v))continue;
    if(!rec){rec={};aOrig.set(el,rec)}
    var t=tr(v);rec[a]={o:v,t:t};
    if(t!==v)el.setAttribute(a,t);
  }
  if(el.nodeName==="INPUT"&&(el.type==="button"||el.type==="submit")){
    v=el.value;if(AR.test(v)&&!(rec&&rec.value&&rec.value.t===v)){
      if(!rec){rec={};aOrig.set(el,rec)}
      t=tr(v);rec.value={o:v,t:t};if(t!==v)el.value=t;
    }
  }
}
function walk(root){
  if(!root)return;
  if(root.nodeType===3){trText(root);return}
  if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;
  if(root.nodeType===1){
    if(SKIP[root.nodeName]||skipEl(root))return;
    trAttrs(root);
  }
  var w=D.createTreeWalker(root,5/*ELEMENT|TEXT*/,{acceptNode:function(n){
    if(n.nodeType===1){return (SKIP[n.nodeName]||(n.hasAttribute&&n.hasAttribute("data-notr")))?2/*REJECT*/:3/*SKIP*/}
    return 1;
  }});
  var n;
  while((n=w.nextNode())){
    if(n.nodeType===3)trText(n);
  }
  // الخصائص
  if(root.querySelectorAll){
    var els=root.querySelectorAll("[placeholder],[title],[aria-label],[alt],input[type=button],input[type=submit]");
    for(var i=0;i<els.length;i++)trAttrs(els[i]);
  }
}
/* ===== المراقب (للمحتوى الذي يبنيه التطبيق لاحقاً) ===== */
var pend=[],sched=false;
function flush(){
  sched=false;var list=pend;pend=[];
  for(var i=0;i<list.length;i++){var r=list[i];
    if(r.type==="childList"){for(var j=0;j<r.addedNodes.length;j++)walk(r.addedNodes[j])}
    else if(r.type==="characterData"){trText(r.target)}
    else if(r.type==="attributes"){trAttrs(r.target)}
  }
}
function startObs(){
  if(obs||!root.MutationObserver)return;
  obs=new MutationObserver(function(rs){
    for(var i=0;i<rs.length;i++)pend.push(rs[i]);
    if(!sched){sched=true;(root.queueMicrotask||function(f){Promise.resolve().then(f)})(flush)}
  });
  obs.observe(D.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
}

/* ===== الاتجاه والتواريخ والحوارات ===== */
function applyDir(){
  H.setAttribute("lang",lang);H.setAttribute("dir",lang==="en"?"ltr":"rtl");
  H.classList.toggle("tz-en",lang==="en");
  var bs=D.querySelectorAll("[data-lang-toggle]");
  for(var i=0;i<bs.length;i++)paintBtn(bs[i]);
}
["toLocaleString","toLocaleDateString","toLocaleTimeString"].forEach(function(m){
  var o=Date.prototype[m];
  Date.prototype[m]=function(l,opt){
    if(lang==="en"&&typeof l==="string"&&/^ar/.test(l))l=l.replace(/^ar(-[A-Za-z]{2})?/,"en-GB");
    return o.call(this,l,opt);
  };
});
["alert","confirm","prompt"].forEach(function(f){
  var o=root[f];if(!o)return;
  root[f]=function(m,d){return o.call(root,lang==="en"?tr(String(m==null?"":m)):m,d)};
});

/* ===== الزر ===== */
var GLOBE='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9z"/></svg>';
function paintBtn(b){
  var t=lang==="en"?"العربية":"English";
  var s=b.querySelector(".tzl-t");if(s&&s.textContent!==t)s.textContent=t;
  b.setAttribute("aria-label",lang==="en"?"التبديل إلى العربية":"Switch to English");
  b.setAttribute("title",lang==="en"?"التبديل إلى العربية":"Switch to English");
  b.setAttribute("lang",lang==="en"?"ar":"en");
}
function btn(cls){
  return '<button type="button" class="tzl-btn'+(cls?" "+cls:"")+'" data-lang-toggle data-notr>'+GLOBE+'<span class="tzl-t">'+(lang==="en"?"العربية":"English")+'</span></button>';
}
(function css(){
  var s=D.createElement("style");
  s.textContent=
  ".tzl-btn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.10);color:inherit;font:600 13px/1 inherit;font-family:inherit;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent;transition:background .15s,border-color .15s}"+
  ".tzl-row{display:flex;justify-content:flex-end;margin:0 0 10px}"+
  ".tzl-btn:hover{background:rgba(127,127,127,.2)}.tzl-btn:active{transform:scale(.97)}"+
  ".tzl-btn svg{flex:none;opacity:.85}"+
  ".tzl-fab{position:fixed;top:10px;inset-inline-start:10px;z-index:9999;background:rgba(255,255,255,.92);color:#222;box-shadow:0 2px 8px rgba(0,0,0,.18)}"+
  "html.tz-wait body{opacity:0}"+
  /* تعديلات الاتجاه من اليسار لليمين (الإنجليزية): ما كُتب بقيم right/left الصريحة في أنماط المنصة */
  "#me .tzl-btn{text-decoration:none;border:1px solid rgba(127,127,127,.35);background:rgba(127,127,127,.1);color:inherit;font-size:13px;height:32px}"+
  "html.tz-en th,html.tz-en .g th,html.tz-en .xk th,html.tz-en #pa .stt th{text-align:left}"+
  "html.tz-en td.c input,html.tz-en .gc label,html.tz-en #npm .uik ol{text-align:left}"+
  "html.tz-en .hello .hc{text-align:right}"+
  "html.tz-en .leaflet-popup-content{direction:ltr;text-align:left}"+
  "html.tz-en #bcfab{left:auto;right:16px}html.tz-en #bcfab i{right:auto;left:-4px}"+
  "html.tz-en [style*='text-align:right']{text-align:left!important}"+
  "html.tz-en [style*='text-align:left']{text-align:right!important}";
  (D.head||H).appendChild(s);
})();
if(lang==="en")H.classList.add("tz-wait");
setTimeout(function(){H.classList.remove("tz-wait")},1500);

/* ===== التبديل ===== */
function loadDict(cb){
  if(dict)return cb(true);
  if(loading)return;loading=true;
  var done=function(ok){loading=false;cb(ok)};
  try{
    import("./i18n-en.js").then(function(m){dict=m.default||m;tr=makeTr(dict);done(true)},function(){done(false)});
  }catch(e){done(false)}
}
function enable(){
  startObs();walk(D.documentElement);
  H.classList.remove("tz-wait");
}
function set(l){ // التبديل بإعادة تحميل الصفحة: يضمن أن كل شيء (نصوص، تواريخ، اتجاه) يُبنى من جديد باللغة المختارة
  l=l==="en"?"en":"ar";
  if(l===lang)return;
  var go=function(){try{localStorage.setItem(KEY,l)}catch(e){}try{root.location.reload()}catch(e){}};
  if(l==="en"&&!dict){
    loadDict(function(ok){
      if(!ok){try{root.alert("تعذر تحميل الترجمة. تأكد من الإنترنت وحاول مجدداً. / Could not load the translation.")}catch(e){}return}
      go();
    });
  }else go();
}
D.addEventListener("click",function(e){
  var b=e.target&&e.target.closest&&e.target.closest("[data-lang-toggle]");
  if(!b)return;e.preventDefault();set(lang==="en"?"ar":"en");
});

root.TZL={
  get lang(){return lang},
  set:set,btn:btn,
  t:function(s){return lang==="en"?tr(s):s},
  /* زر عائم: للشاشات التي ليس فيها شريط علوي (الدخول مثلاً) */
  fab:function(){
    if(D.querySelector(".tzl-fab"))return;
    var d=D.createElement("div");d.innerHTML=btn("tzl-fab");
    var b=d.firstChild;(D.body||H).appendChild(b);
  }
};

/* ===== بدء التشغيل ===== */
function slots(){
  var s=D.querySelectorAll("[data-tzl-slot]");
  for(var i=0;i<s.length;i++){if(!s[i].firstChild)s[i].innerHTML=btn()}
}
root.addEventListener("storage",function(e){ // تغيير اللغة من نافذة/إطار آخر (الورقة اليدوية داخل لوحة المستودع)
  if(e.key===KEY){var l=e.newValue==="en"?"en":"ar";if(l!==lang)try{root.location.reload()}catch(x){}}
});
function init(){
  slots();applyDir();
  if(lang==="en"){
    loadDict(function(ok){
      if(!ok){lang="ar";applyDir();H.classList.remove("tz-wait");return}
      enable();
    });
  }
}
if(D.readyState==="loading"){
  // نضبط الاتجاه فوراً قبل أول رسم، والترجمة تبدأ بعد تحميل DOM
  H.setAttribute("lang",lang);H.setAttribute("dir",lang==="en"?"ltr":"rtl");
  D.addEventListener("DOMContentLoaded",init);
}else init();
})(typeof window!=="undefined"?window:this);

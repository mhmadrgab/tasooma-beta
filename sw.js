// خدمة بسيطة: شبكة أولاً، ولو النت قطع تفتح آخر نسخة من الصفحة. مفيش تخزين لبيانات Firebase.
const V="tasooma-v93";
const SHELL=["./index.html","./admin.html","./ui.css","./ui.js","./i18n.js","./i18n-en.js","./workers.js","./bchat.js","./prof.js","./audit.js","./backup.js","./dash.js","./fb.js","./cust.js","./notify.js","./br-extra.js","./ad-extra.js","./fleet.js","./map.js","./zoom.js","./gifts.js","./staff.js","./ann.js","./short.js","./pres.js","./driver.html","./manifest-driver.json","./icon-192.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 const r=e.request;if(r.method!=="GET")return;
 const u=new URL(r.url);if(u.origin!==location.origin||u.pathname.endsWith(".apk"))return;// ملف تطبيق السواقين: تحميل عادي من غير تخزين
 e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r,{ignoreSearch:true})));
});
// الإشعارات اللي الصفحة نفسها بتعرضها (لما تكون مفتوحة ومش قدامه): الضغط عليها بيفتح الرابط
self.addEventListener("notificationclick",e=>{
 const l=e.notification.data&&e.notification.data.link;if(!l||typeof l!=="string")return;
 e.notification.close();
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{const c=cs.find(w=>w.url.split("?")[0]===l.split("?")[0]);return c?c.focus().then(w=>w&&w.navigate?w.navigate(l):w).catch(()=>clients.openWindow(l)):clients.openWindow(l)}));
});
// إشعارات الموبايل والتطبيق مقفول (Firebase Cloud Messaging): المكتبة بتعرض الإشعار لوحدها، والضغط عليه بيفتح الصفحة
try{
 importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js","https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");
 firebase.initializeApp({apiKey:"AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",authDomain:"tasooma-ad4fe.firebaseapp.com",projectId:"tasooma-ad4fe",storageBucket:"tasooma-ad4fe.firebasestorage.app",messagingSenderId:"463966731953",appId:"1:463966731953:web:6b43696b49837494d82c90"});
 firebase.messaging();
}catch(e){}

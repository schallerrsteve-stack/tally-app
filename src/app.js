import { MediaControl, sb, isNative, currentUser, sendCode, verifyCode, signOut, createStore, sample, offProduct, offCached, offSearch, nativeScan } from './platform.js';
import './style.css';

"use strict";
/* ---------- nutrients & food database ---------- */
const KEYS=['kcal','p','c','f','fib','sug','na','k','ca','fe','vc','sf','chol','mg','zn','va','vd','b12','fol'];
const META={kcal:['Energy','kcal'],p:['Protein','g'],c:['Carbs','g'],f:['Fat','g'],fib:['Fiber','g'],sug:['Sugars','g'],na:['Sodium','mg'],k:['Potassium','mg'],ca:['Calcium','mg'],fe:['Iron','mg'],vc:['Vitamin C','mg'],sf:['Saturated fat','g'],chol:['Cholesterol','mg'],mg:['Magnesium','mg'],zn:['Zinc','mg'],va:['Vitamin A','µg'],vd:['Vitamin D','µg'],b12:['Vitamin B12','µg'],fol:['Folate','µg']};
/* Food database: USDA National Nutrient Database for Standard Reference (SR28), loaded from usda.json */
const POP={9040:'Banana',9003:'Apple',1123:'Egg, whole (raw or poached)',1129:'Egg, hard-boiled',1132:'Eggs, scrambled',1128:'Egg, fried',1079:'Milk, 2%',1077:'Milk, whole (3.25%)',1085:'Milk, skim',5064:'Chicken breast, roasted',5098:'Chicken thigh, roasted',20045:'White rice, cooked',20037:'Brown rice, cooked',8120:'Rolled oats, dry',8180:'Oatmeal, cooked with water',18075:'Whole wheat bread',18069:'White bread',1256:'Greek yogurt, plain nonfat',1287:'Greek yogurt, plain low-fat',1009:'Cheddar cheese',16098:'Peanut butter, smooth',12061:'Almonds',9037:'Avocado',9200:'Orange',9316:'Strawberries',9050:'Blueberries',11090:'Broccoli, raw',11457:'Spinach, raw',11124:'Carrots, raw',11529:'Tomato',11674:'Baked potato with skin',11508:'Sweet potato, baked',20121:'Pasta, cooked',15237:'Salmon, Atlantic farmed, cooked',15121:'Tuna, canned in water',23568:'Ground beef 85% lean, cooked patty',14209:'Coffee, brewed',14355:'Tea, black, brewed',1001:'Butter, salted',4053:'Olive oil',19335:'Sugar, white',19296:'Honey',14148:'Cola',14003:'Beer, regular',14096:'Red wine',9206:'Orange juice',16126:'Tofu, firm',16070:'Lentils, cooked',16015:'Black beans, cooked',16057:'Chickpeas, cooked',16158:'Hummus',1015:'Cottage cheese, 2%',1028:'Mozzarella, part-skim',9132:'Grapes',11205:'Cucumber',11251:'Romaine lettuce',11282:'Onion, raw',11821:'Red bell pepper',9176:'Mango',9266:'Pineapple',9326:'Watermelon',20137:'Quinoa, cooked',4025:'Mayonnaise',11935:'Ketchup',19904:'Dark chocolate, 70–85%',12155:'Walnuts',12585:'Cashews, roasted salted',12006:'Chia seeds',9252:'Pear',9148:'Kiwi',9302:'Raspberries',11168:'Corn, sweet, cooked',11313:'Green peas, cooked',11260:'Mushrooms, white',11135:'Cauliflower, raw',11477:'Zucchini, raw',11053:'Green beans, cooked',18001:'Bagel, plain',18364:'Flour tortilla',14058:'Whey protein powder (isolate)',18160:'Chocolate chip cookie',18255:'Glazed donut',19411:'Potato chips',8020:'Corn Flakes',11233:'Kale, raw',15016:'Cod, cooked',2047:'Salt, table',19353:'Maple syrup',19297:'Jam',6164:'Salsa',16123:'Soy sauce',14091:'Almond milk, unsweetened',19095:'Ice cream, vanilla',1017:'Cream cheese',21138:'French fries (fast food)',7081:'Turkey breast, deli sliced',21224:'Pizza, cheese, frozen, cooked'};
const DB={ready:false,loading:null,foods:[],map:{},error:null};
function loadDB(){
  if(DB.loading)return DB.loading;
  const parse=(j,pre,src)=>{
    const ks=j.keys,gr=j.groups;
    return j.foods.map(([id,name,g,nv,ws,fr])=>{
      const per={};ks.forEach((k,i)=>per[k]=nv[i]);
      let portions=ws.slice();const mi=portions.findIndex(p=>/^medium|^large$|^1\/2 breast/.test(p[0]));if(mi>0)portions.unshift(portions.splice(mi,1)[0]);
      portions.push(['oz',28.35],['100 g',100],['g',1]);
      const alias=pre==='u'?POP[id]:null;
      const f={id:pre+id,name:alias||name,usda:alias?name:null,cat:gr[g]||'',src,per,portions,pop:!!alias};
      f.hay=' '+(f.name+' '+(alias?name:'')+' '+(fr||'')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9%]+/g,' ')+' ';
      return f});
  };
  const get=(u)=>fetch(u).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
  DB.loading=Promise.allSettled([get('data/usda.json'),get('data/cnf.json')]).then(([u,c])=>{
    if(u.status!=='fulfilled'&&c.status!=='fulfilled')throw new Error('no db');
    DB.foods=[].concat(c.status==='fulfilled'?parse(c.value,'h','Health Canada'):[],u.status==='fulfilled'?parse(u.value,'u','USDA'):[]);
    DB.foods.forEach(f=>DB.map[f.id]=f);DB.ready=true;
    if(M&&M.tab==='search'&&!M.sel&&$('#fres'))$('#fres').innerHTML=results();
  }).catch(e=>{DB.error=e;if(M&&$('#fres'))$('#fres').innerHTML=results()});
  return DB.loading;
}
const EX=[['Walking, 3 mph',3.5],['Walking, brisk 4 mph',5],['Hiking',6],['Running, 5 mph (12 min/mi)',8.3],['Running, 6 mph (10 min/mi)',9.8],['Running, 7.5 mph (8 min/mi)',11.8],['Cycling, leisurely',4],['Cycling, moderate 12–14 mph',8],['Stationary bike, moderate',6.8],['Swimming laps, moderate',5.8],['Weight training, general',3.5],['Weight training, vigorous',6],['HIIT / circuit training',8],['Rowing machine, moderate',7],['Elliptical, moderate',5],['Stair climber',9],['Jump rope',11.8],['Yoga',2.5],['Pilates',3],['Dancing',5],['Basketball',8],['Soccer, casual',7],['Tennis, singles',8],['Skiing, downhill',5.3],['Ice skating',7],['Gardening',3.8],['Housecleaning',3.3]];
const NGROUPS=[['General',['fib','sug','sf','chol','na']],['Minerals',['k','ca','fe','mg','zn']],['Vitamins',['va','vc','vd','b12','fol']]];
const LIM=['na','sf'];
const MEALS=[['b','Breakfast'],['l','Lunch'],['d','Dinner'],['s','Snacks']];
const ACTIVITY=[[1.2,'Sedentary (desk job, little exercise)'],[1.375,'Lightly active (1–3 days/week)'],[1.55,'Moderately active (3–5 days/week)'],[1.725,'Very active (6–7 days/week)'],[1.9,'Athlete (hard training daily)']];
const GOALS=[[-1100,'Lose 1 kg (2.2 lb) / week'],[-825,'Lose 0.75 kg (1.65 lb) / week'],[-550,'Lose 0.5 kg (1.1 lb) / week'],[-275,'Lose 0.25 kg (0.55 lb) / week'],[0,'Maintain weight'],[275,'Gain 0.25 kg (0.55 lb) / week'],[550,'Gain 0.5 kg (1.1 lb) / week']];

/* Packaged products: Open Food Facts, looked up live with an on-device cache */
const normHay=t=>' '+String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9%]+/g,' ')+' ';
function offFood(code,r){const portions=[];if(r.sq)portions.push([r.serving?r.serving.replace(/\s*\(.*\)\s*$/,'')||'serving':'serving',r.sq]);portions.push(['oz',28.35],['100 g',100],['g',1]);
  return {id:'o'+code,code,name:r.brand&&!r.name.toLowerCase().includes(r.brand.toLowerCase())?`${r.name} — ${r.brand}`:r.name,cat:'Packaged',src:'Open Food Facts',per:r.per,portions,serving:r.serving}}
async function offLookup(code){const r=await offProduct(code);return r?offFood(code,r):null}
let offT=null,offAbort=null;
function offSearchLater(qq){clearTimeout(offT);if(offAbort)offAbort.abort();if(!M)return;M.offQ=qq;M.offRes=null;M.offErr=false;
  offT=setTimeout(async()=>{offAbort=new AbortController();const m=M;try{const r=await offSearch(qq,offAbort.signal);if(M!==m||M.offQ!==qq)return;M.offRes=r}catch(e){if(e.name==='AbortError')return;if(M!==m)return;M.offErr=true;M.offRes=[]}
    if(M&&M.tab==='search'&&!M.sel&&$('#fres'))$('#fres').innerHTML=results()},450)}
/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const iso=d=>{const z=new Date(d.getTime()-d.getTimezoneOffset()*60000);return z.toISOString().slice(0,10)};
const today=()=>iso(new Date());
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)};
const nice=(s,o)=>new Date(s+'T12:00:00').toLocaleDateString(undefined,o||{weekday:'long',month:'long',day:'numeric'});
const r2=v=>Math.round(v*100)/100;
function fmt(v,k){if(v==null||isNaN(v))return '–';if(k==='kcal'||v>=10)return Math.round(v).toLocaleString();return (Math.round(v*10)/10).toString()}
const scale=(per,g)=>Object.fromEntries(KEYS.map(k=>[k,per[k]==null?null:r2(per[k]*g/100)]));

/* ---------- storage (Supabase, local-first) ---------- */
const S={docs:{},mode:'cloud',date:today(),view:'diary',range:30,uid:null,email:null,sample:sample,sampleImages:true};
let STORE=null;
function put(key,data){if(!STORE)return;STORE.put(key,data==null?null:clone(data));S.docs=STORE.docs;afterChange();render()}
function afterChange(){syncSharedStats();if(SOC.loaded)syncChallengeScores()}
function setNote(t,cls){$('#note').innerHTML=t?`<div class="notice ${cls||''}">${esc(t)}</div>`:''}
function syncNote(){const st=STORE?STORE.status:'';setNote(st==='offline'?'You’re offline — changes are saved on this phone and will sync when you reconnect.':st==='error'?'Sync problem — your changes are saved on this phone and will retry.':'',st==='error'?'warn':'')}
/* ---------- data accessors ---------- */
const get=k=>S.docs[k]?clone(S.docs[k]):null;
const dk=d=>'d-'+d;
function day(d){const x=get(dk(d))||{};return {date:d,foods:x.foods||[],ex:x.ex||[],water:x.water||0}}
function profile(){const p=Object.assign({sex:'female',age:30,height:168,weight:68,activity:1.375,goal:0,split:{p:30,c:40,f:30},kcalOverride:0,units:'metric',addEx:true,water:8},get('profile')||{});p.split=Object.assign({p:30,c:40,f:30},p.split||{});return p}
function weights(){return (get('weights')||{}).e||{}}
function latestWeight(upTo){const w=weights();const ds=Object.keys(w).filter(d=>!upTo||d<=upTo).sort();return ds.length?w[ds[ds.length-1]]:null}
function customs(){return (get('custom')||{}).foods||[]}
function sumN(list){const t={};KEYS.forEach(k=>t[k]=0);list.forEach(e=>KEYS.forEach(k=>t[k]+=+((e.n||{})[k]||0)));return t}
const exK=d=>d.ex.reduce((a,e)=>a+(+e.kcal||0),0);
const imperial=()=>profile().units==='imperial';
const wOut=kg=>kg==null?null:(imperial()?kg*2.20462:kg);
const wIn=v=>imperial()?v/2.20462:v;
const wU=()=>imperial()?'lb':'kg';
function targets(date){
  const p=profile();const w=latestWeight(date)||p.weight;const m=p.sex==='male';
  const bmr=10*w+6.25*p.height-5*p.age+(m?5:-161);const tdee=bmr*p.activity;
  const auto=Math.max(m?1500:1200,Math.round((tdee+(+p.goal))/10)*10);
  const kcal=p.kcalOverride>0?+p.kcalOverride:auto;const sp=p.split;
  const t={kcal,p:kcal*sp.p/400,c:kcal*sp.c/400,f:kcal*sp.f/900,
    fib:p.age>50?(m?30:21):(m?38:25),sug:null,na:2300,k:m?3400:2600,
    ca:(m?p.age>70:p.age>50)?1200:1000,fe:(!m&&p.age>=19&&p.age<=50)?18:8,vc:m?90:75,
    sf:kcal*0.1/9,chol:null,mg:m?(p.age>30?420:400):(p.age>30?320:310),zn:m?11:8,va:m?900:700,vd:p.age>70?20:15,b12:2.4,fol:400};
  return {t,bmr,tdee,auto,w};
}

/* ---------- rendering ---------- */
function render(){
  const v=S.view;
  document.querySelectorAll('nav a,a.cog').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  const ae=document.activeElement;
  if((v==='profile'||v==='workouts'||v==='social'||v==='checkin')&&ae&&ae.closest&&ae.closest('#view')&&/INPUT|SELECT/.test(ae.tagName)&&!S._force)return; // don't clobber typing
  if(!S.uid){$('#view').innerHTML=vAuth();document.body.classList.add('signedout');return}document.body.classList.remove('signedout');
  const fn={diary:vDiary,workouts:vWorkouts,social:vSocial,trends:vTrends,foods:vFoods,profile:vProfile,checkin:vCheckin}[v]||vDiary;
  $('#view').innerHTML=tgBanner()+fn();
  if(v==='trends')bindCharts();
  if(S.ws)ensureTick();
  updateDock();
  updateFab();
}
function bar(v,t,color){const pct=t?Math.min(100,v/t*100):0;return `<div class="track"><i style="width:${pct}%;background:${color}"></i></div>`}
function vDiary(){
  const d=day(S.date),p=profile(),{t}=targets(S.date),tot=sumN(d.foods),ex=Math.round(exK(d));
  const budget=t.kcal+(p.addEx?ex:0),rem=Math.round(budget-tot.kcal);
  const pct=budget?Math.min(1,tot.kcal/budget):0,R=62,C=2*Math.PI*R;
  const isToday=S.date===today();
  const prev=day(addDays(S.date,-1));
  const prevLbl=isToday?'yesterday':esc(nice(addDays(S.date,-1),{weekday:'long'}));
  const SUM=cls=>`<section class="card ${cls}"><div class="summary">
    <div class="ring" role="img" aria-label="${rem>=0?rem+' calories remaining':(-rem)+' calories over'}">
      <svg width="148" height="148" viewBox="0 0 148 148"><circle cx="74" cy="74" r="${R}" fill="none" stroke="var(--soft)" stroke-width="12"/>
      <circle cx="74" cy="74" r="${R}" fill="none" stroke="${rem<0?'var(--warn)':'var(--accent)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C*pct} ${C}"/></svg>
      <div class="mid"><div><div class="big">${Math.abs(rem).toLocaleString()}</div><div class="lbl">${rem>=0?'kcal remaining':'kcal over'}</div></div></div>
    </div>
    <div class="eq">
      <div>Goal<b>${t.kcal.toLocaleString()}</b></div><div>Food<b>${Math.round(tot.kcal).toLocaleString()}</b></div>
      <div>Exercise<b>${p.addEx?'+':''}${ex.toLocaleString()}</b></div><div>Left<b>${rem.toLocaleString()}</b></div>
    </div></div>
    <div class="macros">
      ${[['p','Protein','var(--p)'],['c','Carbs','var(--c)'],['f','Fat','var(--f)']].map(([k,l,c])=>`<div class="mrow"><span class="key"><s style="background:${c}"></s>${l}</span>${bar(tot[k],t[k],c)}<span class="v">${fmt(tot[k],k)} / ${Math.round(t[k])} g</span></div>`).join('')}
    </div></section>`;
  let h=`<div class="datebar">
    <h2>${isToday?'Today':esc(nice(S.date,{weekday:'long'}))}<span class="faint" style="font-family:'DM Sans';font-weight:400;font-size:15px;margin-left:10px">${esc(nice(S.date,{month:'long',day:'numeric',year:'numeric'}))}</span></h2>
    <button class="btn icon" data-act="day" data-n="-1" aria-label="Previous day">‹</button>
    <input type="date" id="dpick" value="${S.date}" aria-label="Pick a date">
    <button class="btn icon" data-act="day" data-n="1" aria-label="Next day">›</button>
    ${isToday?'':'<button class="btn sm" data-act="today">Today</button>'}
  </div>`;
  if(!S.docs.profile)h+=`<div class="card setup" style="margin-bottom:18px"><div class="spread"><div><h3 style="font-size:18px">Set your personal targets</h3><div class="muted" style="font-size:14px">Add your age, height, weight and goal so calorie and nutrient targets fit you. Defaults are shown until then.</div></div><a class="btn primary" href="#profile">Set up</a></div></div>`;
  h+=`<div class="grid"><div class="stack">`+SUM('m-only');
  for(const [mk,ml] of MEALS){
    const list=d.foods.filter(e=>e.meal===mk),mk_k=Math.round(sumN(list).kcal);
    h+=`<section class="card meal"><div class="meal-h"><h3>${ml}</h3><span class="k">${list.length?mk_k.toLocaleString()+' kcal':''}</span></div>`;
    if(list.length){h+=`<div class="entries">`;for(const e of list){
      const amt=e.unit?`${+e.qty} × ${esc(e.unit)}${e.unit!=='g'&&e.g?` · ${Math.round(e.g)} g`:''}`:(e.amount?esc(e.amount):'Quick add');
      h+=`<div class="entry"><button class="main" data-act="edit" data-id="${e.id}"><span class="t"><div class="nm">${esc(e.name)}</div><div class="sub">${amt} · P ${fmt(e.n.p,'p')} · C ${fmt(e.n.c,'c')} · F ${fmt(e.n.f,'f')}</div></span><span class="kc">${Math.round(e.n.kcal)}</span></button><button class="x" data-act="delfood" data-id="${e.id}" aria-label="Remove ${esc(e.name)}">×</button></div>`}
      h+=`</div>`}
    const pl=prev.foods.filter(e=>e.meal===mk&&!list.some(x=>x.name===e.name));
    h+=`<div class="addrow row"><button class="btn ghost sm" data-act="add" data-meal="${mk}">+ Add food</button>${pl.length?`<button class="btn ghost sm" data-act="copymeal" data-meal="${mk}" title="${esc(pl.map(e=>e.name).join(', '))}">↻ Copy ${prevLbl}’s ${ml.toLowerCase()} (${pl.length})</button>`:''}</div></section>`;
  }
  // exercise
  h+=`<section class="card meal"><div class="meal-h"><h3>Exercise</h3><span class="k">${ex?ex.toLocaleString()+' kcal burned':''}</span></div>`;
  if(d.ex.length){h+=`<div class="entries">`;for(const e of d.ex)h+=`<div class="entry"><div class="main" style="cursor:default"><span class="t"><div class="nm">${esc(e.name)}</div><div class="sub">${e.min?e.min+' min':''}${e.dist?' · '+(Math.round(dOut(e.dist/1000)*10)/10)+' '+distU():''}${e.src==='hc'?' · ⌚ '+esc(e.from||'watch'):''}</div></span><span class="kc">${Math.round(e.kcal)}</span></div><button class="x" data-act="delex" data-id="${e.id}" aria-label="Remove ${esc(e.name)}">×</button></div>`;h+=`</div>`}
  h+=`<div class="addrow row"><button class="btn ghost sm" data-act="addex">+ Add exercise</button><a class="btn ghost sm" href="#workouts">${S.ws?"Resume workout in progress":"Start a workout"}</a></div></section>`;
  if(!d.foods.length&&prev.foods.length)h+=`<div><button class="btn" data-act="copyprev">Copy ${prev.foods.length} food${prev.foods.length>1?'s':''} from ${esc(nice(addDays(S.date,-1),{weekday:'long'}))}</button></div>`;
  h+=`</div><div class="stack">`;
  h+=SUM('d-only');
  // micros
  h+=`<section class="card"><div class="spread" style="margin-bottom:6px"><h3 style="font-size:18px">Nutrients</h3><span class="faint">vs. daily targets</span></div>`;
  for(const [title,ks] of NGROUPS){
    h+=`<div class="ngh">${title}</div><div class="micro">`;
    for(const k of ks){
      const v=tot[k],tg=t[k],lim=LIM.includes(k);const over=lim&&tg&&v>tg;
      h+=`<div class="mi ${lim?'lim':''} ${over?'over':''}"><div class="top2"><span>${META[k][0]}${lim&&tg?' <small>limit</small>':''}</span><span>${fmt(v,k)}${tg?' / '+fmt(tg,k):''} ${META[k][1]}</span></div>${tg?bar(v,tg,''):'<div class="track"></div>'}${tg&&!lim?`<small>${Math.round(v/tg*100)}%</small>`:over?'<small>Over limit</small>':''}</div>`;
    }
    h+=`</div>`;
  }
  if(d.foods.some(e=>e.src==='quick'))h+=`<p class="faint" style="margin:12px 0 0">Quick-add entries only count toward calories and macros.</p>`;
  h+=`</section>`;
  // water & weight
  const wt=weights()[S.date];
  h+=`<section class="card"><div class="spread"><h3 style="font-size:18px">Water</h3><span class="faint">${d.water} / ${p.water} cups</span></div>
    <div class="water" style="margin-top:10px">${Array.from({length:Math.max(p.water,d.water)},(_,i)=>`<button class="${i<d.water?'on':''}" data-act="water" data-n="${i+1}" aria-label="${i+1} cups"></button>`).join('')}</div>
    ${(()=>{const st=((get('hc')||{}).steps||{})[S.date];return st?`<div style="margin-top:18px" class="spread"><h3 style="font-size:18px">Steps</h3><span class="faint">from Health Connect</span></div><div style="font-family:Fraunces,serif;font-size:26px;font-weight:650;margin-top:4px">${st.toLocaleString()}</div>`:''})()}<div style="margin-top:18px" class="spread"><h3 style="font-size:18px">Weight</h3>${(()=>{const lw=latestWeight(S.date);return lw&&wt==null?`<span class="faint">Last: ${wOut(lw).toFixed(1)} ${wU()}</span>`:''})()}</div>
    <div class="row" style="margin-top:8px"><input class="inp" id="wt" type="number" step="0.1" min="0" inputmode="decimal" placeholder="Log today’s weight" value="${wt!=null?wOut(wt).toFixed(1):''}" style="max-width:190px"><span class="muted">${wU()}</span></div>
  </section>`;
  h+=`</div></div>`;
  return h;
}

/* ---------- trends ---------- */
let CH={};
function vTrends(){
  const n=S.range,end=today(),days=[];
  for(let i=n-1;i>=0;i--){const ds=addDays(end,-i),d=day(ds),tot=sumN(d.foods);days.push({ds,d,tot,logged:d.foods.length>0,t:targets(ds).t.kcal,ex:exK(d),w:weights()[ds]})}
  const L=days.filter(x=>x.logged);
  const avg=k=>L.length?L.reduce((a,x)=>a+x.tot[k],0)/L.length:0;
  const ws=days.filter(x=>x.w!=null);
  const wchg=ws.length>1?wOut(ws[ws.length-1].w)-wOut(ws[0].w):null;
  const ak=avg('kcal'),ap=avg('p'),ac=avg('c'),af=avg('f'),mk=ap*4+ac*4+af*9;
  const onT=L.filter(x=>x.tot.kcal<=x.t+(profile().addEx?x.ex:0)).length;
  CH={days};
  let h=`<div class="datebar"><h2>Trends</h2><div class="seg-ctl" role="group" aria-label="Range">${[7,30,90].map(r=>`<button class="${r===n?'on':''}" data-act="range" data-n="${r}">${r} days</button>`).join('')}</div></div>
  <div class="tiles">
    <div class="tile"><div class="l">Avg. calories</div><div class="v">${L.length?Math.round(ak).toLocaleString():'–'}</div><div class="s">on logged days</div></div>
    <div class="tile"><div class="l">Avg. protein</div><div class="v">${L.length?Math.round(ap)+' g':'–'}</div><div class="s">per logged day</div></div>
    <div class="tile"><div class="l">Days logged</div><div class="v">${L.length} <span style="font-size:16px" class="muted">/ ${n}</span></div><div class="s">${L.length?onT+' within calorie goal':'start logging to see trends'}</div></div>
    <div class="tile"><div class="l">Weight change</div><div class="v">${wchg==null?'–':(wchg>0?'+':'')+wchg.toFixed(1)+' '+wU()}</div><div class="s">${ws.length>1?'over '+ws.length+' weigh-ins':'log 2+ weigh-ins'}</div></div>
  </div>
  <section class="card chart" style="margin-top:18px"><div class="spread"><h3 style="font-size:18px">Calories per day</h3><div class="legend"><span class="key"><s style="background:var(--bar);height:8px;width:8px;border-radius:2px"></s>Eaten</span><span class="key"><s style="background:var(--ink2);height:0;border-top:2px dashed var(--ink2)"></s>Goal</span></div></div>
  <div id="ch-k" style="margin-top:8px">${calChart(days)}</div></section>
  <div class="grid grid2" style="margin-top:18px">
  <section class="card chart"><h3 style="font-size:18px">Weight (${wU()})</h3><div id="ch-w" style="margin-top:8px">${ws.length?wChart(days):'<p class="faint">No weigh-ins in this range yet. Log your weight on the Diary page.</p>'}</div></section>
  <section class="card"><h3 style="font-size:18px">Average macro split</h3>
  ${mk?`<div class="seg" role="img" aria-label="Protein ${Math.round(ap*400/mk)}%, carbs ${Math.round(ac*400/mk)}%, fat ${Math.round(af*900/mk)}%"><i style="width:${ap*400/mk}%;background:var(--p)"></i><i style="width:${ac*400/mk}%;background:var(--c)"></i><i style="width:${af*900/mk}%;background:var(--f)"></i></div>
  <div class="legend"><span class="key"><s style="background:var(--p)"></s>Protein <b>${Math.round(ap*400/mk)}%</b></span><span class="key"><s style="background:var(--c)"></s>Carbs <b>${Math.round(ac*400/mk)}%</b></span><span class="key"><s style="background:var(--f)"></s>Fat <b>${Math.round(af*900/mk)}%</b></span></div>
  <p class="faint" style="margin-top:12px">Your target: ${profile().split.p}% / ${profile().split.c}% / ${profile().split.f}%</p>`:'<p class="faint">Log some food to see your macro split.</p>'}
  <h3 style="font-size:16px;margin-top:16px">Average nutrients</h3>
  <div class="ptable">${KEYS.slice(4).map(k=>`<div><span>${META[k][0]}</span><span>${L.length?fmt(avg(k),k)+' '+META[k][1]:'–'}</span></div>`).join('')}</div>
  </section></div>
  <section class="card" style="margin-top:18px"><details><summary>Show daily table</summary><div style="overflow:auto;margin-top:10px"><table class="data"><thead><tr><th>Date</th><th>kcal</th><th>Goal</th><th>Protein g</th><th>Carbs g</th><th>Fat g</th><th>Exercise</th><th>Steps</th><th>Weight</th></tr></thead><tbody>
  ${days.slice().reverse().map(x=>`<tr><td>${esc(nice(x.ds,{weekday:'short',month:'short',day:'numeric'}))}</td><td>${x.logged?Math.round(x.tot.kcal):'–'}</td><td>${x.t}</td><td>${x.logged?Math.round(x.tot.p):'–'}</td><td>${x.logged?Math.round(x.tot.c):'–'}</td><td>${x.logged?Math.round(x.tot.f):'–'}</td><td>${x.ex?Math.round(x.ex):'–'}</td><td>${((get('hc')||{}).steps||{})[x.ds]?((get('hc')||{}).steps[x.ds]).toLocaleString():'–'}</td><td>${x.w!=null?wOut(x.w).toFixed(1):'–'}</td></tr>`).join('')}
  </tbody></table></div></details></section>`;
  return h;
}
function niceMax(v){const e=Math.pow(10,Math.floor(Math.log10(v)));const m=v/e;return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*e}
function topRound(x,y,w,h,r){r=Math.min(r,w/2,h);if(h<=0)return '';return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`}
function calChart(days){
  const W=760,H=240,L=46,R=10,T=12,B=28,n=days.length;
  const mx=niceMax(Math.max(500,...days.map(x=>Math.max(x.tot.kcal,x.t)))*1.05);
  const cw=(W-L-R)/n,bw=Math.max(2,Math.min(26,cw-2)),y=v=>T+(H-T-B)*(1-v/mx),xc=i=>L+cw*(i+.5);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories eaten per day versus goal"><g class="grid">`;
  for(let i=0;i<=4;i++){const v=mx*i/4;s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${Math.round(v).toLocaleString()}</text>`}
  s+=`</g>`;
  const step=Math.ceil(n/8);
  days.forEach((x,i)=>{
    if(x.logged)s+=`<path d="${topRound(xc(i)-bw/2,y(x.tot.kcal),bw,y(0)-y(x.tot.kcal),4)}" fill="var(--bar)"/>`;
    if((n-1-i)%step===0)s+=`<text x="${xc(i)}" y="${H-8}" text-anchor="middle">${esc(nice(x.ds,n<=7?{weekday:'short'}:{month:'short',day:'numeric'}))}</text>`;
  });
  let pth='';days.forEach((x,i)=>{const x0=L+cw*i,x1=x0+cw;pth+=(i?'L':'M')+x0+','+y(x.t)+'L'+x1+','+y(x.t)});
  s+=`<path d="${pth}" fill="none" stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  days.forEach((x,i)=>{s+=`<rect class="hit" x="${L+cw*i}" y="${T}" width="${cw}" height="${H-T-B}" data-tipi="${i}" data-ch="k"/>`});
  return s+'</svg>';
}
function wChart(days){
  const W=380,H=220,L=44,R=12,T=14,B=28,n=days.length;
  const pts=days.map((x,i)=>x.w!=null?{i,v:wOut(x.w),ds:x.ds}:null).filter(Boolean);
  let lo=Math.min(...pts.map(p=>p.v)),hi=Math.max(...pts.map(p=>p.v));const pad=Math.max(1,(hi-lo)*.2);lo=Math.floor(lo-pad);hi=Math.ceil(hi+pad);
  const x=i=>n===1?(L+W-R)/2:L+(W-L-R)*i/(n-1),y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight over time"><g class="grid">`;
  for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4;s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${v.toFixed(hi-lo<8?1:0)}</text>`}
  s+=`</g><text x="${L}" y="${H-8}">${esc(nice(days[0].ds,{month:'short',day:'numeric'}))}</text><text x="${W-R}" y="${H-8}" text-anchor="end">${esc(nice(days[n-1].ds,{month:'short',day:'numeric'}))}</text>`;
  if(pts.length>1)s+=`<polyline points="${pts.map(p=>x(p.i)+','+y(p.v)).join(' ')}" fill="none" stroke="var(--p)" stroke-width="2" stroke-linejoin="round"/>`;
  pts.forEach(p=>{s+=`<g class="pt"><circle cx="${x(p.i)}" cy="${y(p.v)}" r="4.5" fill="var(--p)" stroke="var(--card)" stroke-width="2"/><circle class="hit" cx="${x(p.i)}" cy="${y(p.v)}" r="14" data-tipi="${p.i}" data-ch="w"/></g>`});
  return s+'</svg>';
}
function bindCharts(){}
function showTip(el,ev){
  const i=+el.dataset.tipi,x=CH.days&&CH.days[i];if(!x)return;const tip=$('#tip');tip.textContent='';
  const hd=document.createElement('div');hd.className='h';hd.textContent=nice(x.ds,{weekday:'short',month:'short',day:'numeric'});tip.appendChild(hd);
  const row=(v,l,c,dash)=>{const r=document.createElement('div');r.className='r';const s=document.createElement('s');s.style.background=c;if(dash){s.style.background='none';s.style.borderTop='2px dashed '+c}r.appendChild(s);const b=document.createElement('b');b.textContent=v;r.appendChild(b);r.appendChild(document.createTextNode(' '+l));tip.appendChild(r)};
  if(el.dataset.ch==='k'){row(x.logged?Math.round(x.tot.kcal).toLocaleString():'Not logged','kcal eaten','var(--bar)');row(x.t.toLocaleString(),'kcal goal','var(--ink2)',true);if(x.ex)row(Math.round(x.ex).toLocaleString(),'kcal exercise','var(--c)');if(x.logged)row(`P ${Math.round(x.tot.p)} · C ${Math.round(x.tot.c)} · F ${Math.round(x.tot.f)}`,'g','transparent')}
  else row(wOut(x.w).toFixed(1),wU(),'var(--p)');
  tip.hidden=false;moveTip(ev);
}
function moveTip(ev){const tip=$('#tip');if(tip.hidden)return;const w=tip.offsetWidth,h=tip.offsetHeight;let X=ev.clientX+14,Y=ev.clientY-h-12;if(X+w>innerWidth-8)X=ev.clientX-w-14;if(Y<8)Y=ev.clientY+16;tip.style.left=X+'px';tip.style.top=Y+'px'}
document.addEventListener('pointerover',e=>{const el=e.target.closest&&e.target.closest('[data-tipi],[data-tt]');if(!el)return;if(el.dataset.tt!==undefined){const tip=$('#tip');tip.textContent='';el.dataset.tt.split('|').forEach((l,i)=>{const d=document.createElement('div');d.className=i?'r':'h';d.textContent=l;tip.appendChild(d)});tip.hidden=false;moveTip(e)}else showTip(el,e)});
document.addEventListener('pointermove',e=>{if(e.target.closest&&e.target.closest('[data-tipi],[data-tt]'))moveTip(e);else $('#tip').hidden=true});
document.addEventListener('pointerleave',()=>{$('#tip').hidden=true});

/* ---------- my foods ---------- */
function vFoods(){
  const cs=customs();
  return `<div class="datebar"><h2>My foods</h2><span class="row"><button class="btn" data-act="newscan">Scan a barcode</button><button class="btn primary" data-act="newcustom">+ Create food</button></span></div>
  <section class="card" style="padding:0">${cs.length?cs.map(f=>`<div class="entry"><div class="main" style="cursor:default"><span class="t"><div class="nm">${esc(f.name)}${(f.codes||[]).length?` <span class="tag">▮▯▮ ${esc(prettyCode(f.codes[0]))}</span>`:''}</div><div class="sub">${esc(f.portions[0][0])} (${Math.round(f.portions[0][1])} g) · ${Math.round(f.per.kcal*f.portions[0][1]/100)} kcal · P ${fmt(f.per.p*f.portions[0][1]/100,'p')} · C ${fmt(f.per.c*f.portions[0][1]/100,'c')} · F ${fmt(f.per.f*f.portions[0][1]/100,'f')}</div></span></div><button class="x" data-act="delcustom" data-id="${f.id}" aria-label="Delete ${esc(f.name)}">×</button></div>`).join(''):`<div class="empty" style="border:0;padding:22px">No custom foods yet. Create one from a nutrition label, or save a recipe you eat often.</div>`}</section>
  <p class="faint" style="margin-top:14px">Search covers Health Canada’s Canadian Nutrient File (5,690 foods, with Canadian fortification levels and French names) and the USDA National Nutrient Database (about 8,800 foods), with 19 nutrients each. Barcodes are looked up live on <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> (ODbL) and kept on your phone; products it doesn’t have, or that you correct, are saved here. For anything else, use <b>Describe it</b> in the add-food window to have Claude estimate the nutrition, or create your own food here.</p>`;
}

/* ---------- profile ---------- */
function vProfile(){
  const p=profile(),{bmr,tdee,auto,w}=targets(today()),im=p.units==='imperial';
  const opt=(arr,v)=>arr.map(([val,l])=>`<option value="${val}" ${+val===+v?'selected':''}>${esc(l)}</option>`).join('');
  return `<div class="datebar"><h2>Settings</h2></div>
  <h3 class="sech">Profile &amp; targets</h3>
  <div class="grid"><section class="card"><form id="pform" class="stack" style="gap:14px" onsubmit="return false">
    <div class="fgrid">
      <label class="field">Units<select id="s-units"><option value="metric" ${!im?'selected':''}>Metric (kg, cm)</option><option value="imperial" ${im?'selected':''}>Imperial (lb, in)</option></select></label>
      <label class="field">Sex (for BMR formula)<select id="s-sex"><option value="female" ${p.sex==='female'?'selected':''}>Female</option><option value="male" ${p.sex==='male'?'selected':''}>Male</option></select></label>
      <label class="field">Age<input id="s-age" type="number" min="13" max="110" value="${p.age}"></label>
      <label class="field"><span>Height (<span id="u-h">${im?'in':'cm'}</span>)</span><input id="s-h" type="number" step="0.1" value="${im?(p.height/2.54).toFixed(1):p.height}"></label>
      <label class="field"><span>Weight (<span id="u-w">${im?'lb':'kg'}</span>)</span><input id="s-w" type="number" step="0.1" value="${(im?p.weight*2.20462:p.weight).toFixed(1)}"></label>
    </div>
    <label class="field">Activity level<select id="s-act">${opt(ACTIVITY,p.activity)}</select></label>
    <label class="field">Goal<select id="s-goal">${opt(GOALS,p.goal)}</select></label>
    <div class="fgrid">
      <label class="field">Protein %<input id="s-p" type="number" min="5" max="70" value="${p.split.p}"></label>
      <label class="field">Carbs %<input id="s-c" type="number" min="5" max="80" value="${p.split.c}"></label>
      <label class="field">Fat %<input id="s-f" type="number" min="10" max="80" value="${p.split.f}"></label>
    </div>
    <div class="fgrid">
      <label class="field">Custom calorie goal (optional)<input id="s-k" type="number" min="0" placeholder="Auto: ${auto}" value="${p.kcalOverride||''}"></label>
      <label class="field">Water goal (cups)<input id="s-water" type="number" min="1" max="20" value="${p.water}"></label>
    </div>
    <label class="chkrow"><input id="s-addex" type="checkbox" ${p.addEx?'checked':''}> Add exercise calories to my daily budget</label>
    <div id="perr" class="notice warn" hidden></div>
    <div><button class="btn primary" data-act="saveprofile">Save profile</button></div>
  </form></section>
  <div class="stack"><section class="card"><h3 style="font-size:18px">How your goal is set</h3>
    <div class="ptable" style="grid-template-columns:1fr">
      <div><span>Weight used</span><span>${wOut(w).toFixed(1)} ${wU()}${latestWeight()?' (latest weigh-in)':''}</span></div>
      <div><span>BMR (Mifflin–St Jeor)</span><span>${Math.round(bmr).toLocaleString()} kcal</span></div>
      <div><span>Maintenance (BMR × activity)</span><span>${Math.round(tdee).toLocaleString()} kcal</span></div>
      <div><span>Goal adjustment</span><span>${p.goal>0?'+':''}${p.goal} kcal</span></div>
      <div><span><b>Daily calorie goal</b></span><span><b>${targets(today()).t.kcal.toLocaleString()} kcal</b></span></div>
    </div>
    <p class="faint" style="margin-top:12px">Nutrient targets (fiber, potassium, calcium, iron, vitamin C) follow the US/Canadian Dietary Reference Intakes for your age and sex; sodium uses the 2,300 mg upper limit. These are general guidelines, not medical advice.</p>
  </section>
  <h3 class="sech">Watch &amp; apps</h3>${hcCard()}${MC()?`<section class="card"><h3 style="font-size:18px">Music controls</h3><label class="chkrow"><input type="checkbox" id="mdock" ${dockOn()?'checked':''}> Show play/pause and skip buttons at the bottom of every screen (works with YouTube Music, Spotify and other music apps)</label></section>`:''}<h3 class="sech">Account</h3><section class="card"><h3 style="font-size:18px">Your account</h3><p class="muted" style="font-size:14px">Signed in as <b>${esc(S.email||'')}</b>. Your diary is private to you and syncs across your devices.</p>
  <div class="row"><button class="btn sm" data-act="export">Copy all data as JSON</button><button class="btn sm" data-act="importopen">Import from Tally web</button><button class="btn sm ghost" data-act="signout">Sign out</button></div><details style="margin-top:12px"><summary>Delete my account</summary><p class="faint">Permanently deletes your account, diary, workouts, messages and achievements. This can’t be undone.</p><button class="btn sm" data-act="delacct" style="color:var(--warn)">Delete everything</button></details></section><h3 class="sech">About</h3>${aboutCard()}</div></div>`;
}
function saveProfile(){
  const im=$('#s-units').value==='imperial',num=id=>parseFloat($(id).value);
  const sp={p:num('#s-p')||0,c:num('#s-c')||0,f:num('#s-f')||0};
  const err=$('#perr');
  if(Math.round(sp.p+sp.c+sp.f)!==100){err.hidden=false;err.textContent=`Macro percentages add up to ${sp.p+sp.c+sp.f}% — they need to total 100%.`;return}
  const h=num('#s-h'),w=num('#s-w'),age=num('#s-age');
  if(!(h>0&&w>0&&age>0)){err.hidden=false;err.textContent='Please fill in age, height and weight.';return}
  const p={units:im?'imperial':'metric',sex:$('#s-sex').value,age,height:im?h*2.54:h,weight:im?w/2.20462:w,activity:+$('#s-act').value,goal:+$('#s-goal').value,split:sp,kcalOverride:num('#s-k')||0,water:Math.round(num('#s-water'))||8,addEx:$('#s-addex').checked};
  p.height=r2(p.height);p.weight=r2(p.weight);
  document.activeElement&&document.activeElement.blur();
  put('profile',p);toast('Profile saved');
}

/* ---------- modal ---------- */
let M=null;
function openModal(st){M=st;S.fabOpen=false;updateFab();$('#modal').hidden=false;drawModal();document.body.style.overflow='hidden'}
function closeModal(){M=null;$('#modal').hidden=true;$('#modal').innerHTML='';updateFab();document.body.style.overflow=''}
function drawModal(focus){
  if(!M)return;
  $('#modal').innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="${M.kind==='ex'?'Add exercise':M.kind==='routine'?'Routine':M.kind==='pick'?'Pick exercise':M.kind==='summary'?'Workout summary':'Add food'}">${M.kind==='ex'?exBody():M.kind==='weight'?weightBody():M.kind==='round'?roundBody():M.kind==='routine'?routineBody():M.kind==='pick'?pickerBody():M.kind==='summary'?summaryBody():M.kind==='newchat'?newChatBody():M.kind==='together'?togetherBody():M.kind==='howto'?howtoBody(false):M.kind==='build'?buildBody():M.kind==='newchal'?newChalBody():M.kind==='import'?importBody():foodBody()}</div>`;
  const f=$('#modal [autofocus]');if(f&&focus!==false)f.focus();
}
const mealName=k=>(MEALS.find(m=>m[0]===k)||MEALS[3])[1];
const mealSel=v=>`<select id="meal" class="inp">${MEALS.map(([k,l])=>`<option value="${k}" ${k===v?'selected':''}>${l}</option>`).join('')}</select>`;
function foodBody(){
  if(M.sel)return detailBody();
  const tabs=[['search','Search'],['scan','Scan barcode'],['ai','Describe it'],['custom','Create food'],['quick','Quick add']].filter(t=>!(M.fromFoods&&t[0]!=='custom'));
  let h=`<div class="sheet-h"><h3>${M.fromFoods?'Create a food':M.editId?'Edit entry':'Add to '+mealName(M.meal)}</h3><button class="x" data-act="close" aria-label="Close">×</button></div>`;
  if(tabs.length>1)h+=`<div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" class="${M.tab===k?'on':''}" data-act="tab" data-tab="${k}" aria-selected="${M.tab===k}">${l}</button>`).join('')}</div>`;
  h+=`<div class="sheet-b">`;
  if(M.tab==='search')h+=`<input id="fq" class="inp" placeholder="Search foods — e.g. banana, greek yogurt, salmon" value="${esc(M.q||'')}" autofocus autocomplete="off"><div class="results" id="fres">${results()}</div>`;
  else if(M.tab==='ai')h+=aiBody();
  else if(M.tab==='scan')h+=scanBody();
  else if(M.tab==='custom')h+=customBody();
  else h+=quickBody();
  return h+`</div>`;
}
function recents(){
  const out=[],seen=new Set();
  const keys=Object.keys(S.docs).filter(k=>k.startsWith('d-')).sort().reverse().slice(0,30);
  for(const k of keys)for(const e of (S.docs[k].foods||[]).slice().reverse()){
    if(!e.per)continue;const id=e.fid||e.name;if(seen.has(id))continue;seen.add(id);
    out.push(DB.map[e.fid]||customs().find(c=>c.id===e.fid)||{id:'r-'+id,name:e.name,cat:'Recent',per:e.per,portions:e.unit&&e.unit!=='g'?[[e.unit,e.unitG],['g',1]]:[['g',1]]});
    if(out.length>=12)return out;
  }
  return out;
}
function allFoods(){return customs().map(c=>Object.assign({},c,{cat:'My foods',pop:true,hay:' '+c.name.toLowerCase().replace(/[^a-z0-9%]+/g,' ')+' '})).concat(DB.foods)}
function results(){
  M.cache={};const q=(M.q||'').trim().toLowerCase();
  const row=f=>{M.cache[f.id]=f;const p=f.portions[0];return `<button class="res" data-act="pick" data-fid="${esc(f.id)}"><span class="t"><div class="nm">${esc(f.name)}</div>${f.usda&&f.usda!==f.name?`<div class="sub">${esc(f.usda)}</div>`:''}<div class="sub">${esc(p[0])}${p[0]!=='g'?` (${Math.round(p[1])} g)`:''} · ${Math.round(f.per.kcal*(p[0]==='g'?100:p[1])/100)} kcal${p[0]==='g'?' per 100 g':''}</div></span><span class="tags"><span class="tag ${f.cat==='My foods'?'mine':''}">${esc(f.cat)}</span>${f.src?`<span class="src">${f.src==='Health Canada'?'Health Canada':'USDA'}</span>`:''}</span></button>`};
  if(!q){
    const rc=recents();let h='';
    if(rc.length)h+=`<div class="group">Recent</div>`+rc.map(row).join('');
    const cs=customs();if(cs.length)h+=`<div class="group">My foods</div>`+cs.map(c=>row(Object.assign({},c,{cat:'My foods'}))).join('');
    if(!h)h=`<div class="empty" style="border:0">Search about 14,500 foods from Health Canada’s Canadian Nutrient File and the USDA database, or scan a product’s barcode. Can’t find something? Try <b>Describe it</b>.</div>`;
    return h;
  }
  const toks=q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9%]+/g,' ').trim().split(' ').filter(Boolean);
  if(!toks.length)return '';
  const scored=[];
  for(const f of allFoods()){
    let ok=true,sc=0;
    for(const t of toks){const i=f.hay.indexOf(' '+t);if(i<0){ok=false;break}sc+=i}
    if(!ok)continue;
    if(f.cat==='My foods')sc-=400;else if(f.pop)sc-=300;else if(f.src==='Health Canada')sc-=8;
    if(f.name.toLowerCase().startsWith(toks[0]))sc-=60;
    if(/baby|indigenous/i.test(f.cat))sc+=200;
    sc+=f.name.length*0.6;
    scored.push([sc,f]);
  }
  scored.sort((a,b)=>a[0]-b[0]);
  let h='';
  if(!DB.ready)h+=`<div class="empty" style="border:0">${DB.error?'The food database couldn’t load. Your own foods are still searchable.':'<span class="spin"></span> Loading the food database…'}</div>`;
  if(false)return `<div class="empty" style="border:0">No match for “${esc(M.q)}”. ${S.sample?`<button class="btn sm primary" data-act="tab" data-tab="ai" data-seed="1">Ask Claude to estimate it</button>`:'Create it under <b>Create food</b>.'}</div>`;
  h+=scored.slice(0,40).map(x=>row(x[1])).join('');
  const qq=toks.join(' ');
  if(qq.length>=3){
    const seen=new Set();const cached=offCached(qq).map(r=>(seen.add(r.code),{c:r.code,n:r.name,b:r.brand}));
    const live=(M.offQ===qq&&M.offRes?M.offRes:[]).filter(r=>!seen.has(r.code)).map(r=>({c:r.code,n:r.name,b:r.brand}));
    const hits=cached.concat(live).slice(0,25);
    if(hits.length)h+=`<div class="group">Packaged products · Open Food Facts</div>`+hits.map(it=>`<button class="res" data-act="pickoff" data-code="${esc(it.c)}"><span class="t"><div class="nm">${esc(it.n)}</div><div class="sub">${esc(it.b||'')}${it.b?' · ':''}barcode ${esc(prettyCode(it.c))}</div></span><span class="tags"><span class="tag">Packaged</span><span class="src">Open Food Facts</span></span></button>`).join('');
    if(M.offQ!==qq||!M.offRes)h+=`<div class="empty"><span class="spin"></span> Searching packaged products…</div>`;
    else if(M.offErr&&!hits.length)h+=`<div class="empty">Packaged-product search isn’t available right now — scan the barcode instead.</div>`;
  }
  if(!h)return `<div class="empty" style="border:0">No match for “${esc(M.q)}”. ${S.sample?`<button class="btn sm primary" data-act="tab" data-tab="ai" data-seed="1">Ask Claude to estimate it</button>`:'Create it under <b>Create food</b>.'}</div>`;
  return h;
}
function detailBody(){
  const f=M.sel;
  return `<div class="sheet-h"><button class="btn ghost sm" data-act="back" style="white-space:nowrap;align-self:flex-start">‹ Back</button><h3 style="margin-left:4px;font-size:18px">${esc(f.name)}</h3><button class="x" data-act="close" aria-label="Close">×</button></div>
  <div class="sheet-b"><div class="fgrid">
    <label class="field">Amount<input id="qty" type="number" min="0" step="any" inputmode="decimal" value="${M.qty}" autofocus></label>
    <label class="field">Serving<select id="por" class="inp">${f.portions.map((p,i)=>`<option value="${i}" ${i===M.pi?'selected':''}>${esc(p[0])}${p[0]!=='g'?` (${Math.round(p[1]*10)/10} g)`:''}</option>`).join('')}</select></label>
    <label class="field">Meal${mealSel(M.meal)}</label>
  </div>
  <div class="prev" id="prev">${preview()}</div>
  ${f.src==='Open Food Facts'?`<p class="faint" style="margin:10px 0 0">Nutrition from <a href="https://world.openfoodfacts.org/product/${esc(f.code)}" target="_blank" rel="noopener">Open Food Facts</a>, a crowd-sourced database${f.serving?` · serving on package: ${esc(f.serving)}`:''}. Doesn’t match the package? <button class="btn ghost sm" data-act="fixoff">Save a corrected version</button></p>`:''}
  <div class="row floatadd">${M.editId?'<button class="btn" data-act="delfood" data-id="'+M.editId+'">Remove</button>':''}<button class="btn primary" data-act="savefood">${M.editId?'Save changes':'Add to diary'}</button></div></div>`;
}
function curGrams(){const q=parseFloat(($('#qty')||{}).value);const pi=+(($('#por')||{}).value||M.pi);M.qty=isNaN(q)?0:q;M.pi=pi;return M.qty*M.sel.portions[pi][1]}
function preview(){
  const g=$('#qty')?curGrams():M.qty*M.sel.portions[M.pi][1];const n=scale(M.sel.per,g);
  return `<div class="spread"><div><span class="kc">${Math.round(n.kcal)}</span> <span class="muted">kcal</span></div><span class="faint">${Math.round(g*10)/10} g</span></div>
  <div class="ptable">${KEYS.filter(k=>k!=='kcal').map(k=>`<div><span>${META[k][0]}</span><span>${fmt(n[k],k)} ${META[k][1]}</span></div>`).join('')}</div>`;
}
function saveFood(){
  const g=curGrams();if(!(g>0)){toast('Enter an amount');return}
  const f=M.sel,[unit,unitG]=f.portions[M.pi],meal=$('#meal').value;
  const e={id:M.editId||newId(),fid:f.id,name:f.name,meal,qty:M.qty,unit,unitG,g:r2(g),per:f.per,n:scale(f.per,g)};
  const d=day(S.date);
  if(M.editId){const i=d.foods.findIndex(x=>x.id===M.editId);if(i>=0)d.foods[i]=e;else d.foods.push(e)}else d.foods.push(e);
  const wasEdit=!!M.editId;closeModal();put(dk(S.date),d);toast(wasEdit?'Entry updated':`Added to ${mealName(meal)}`);
}
/* AI */
function aiBody(){
  let h=`<label class="field">Describe what you ate, with amounts if you know them<textarea id="ai-in" rows="3" autofocus placeholder="e.g. two scrambled eggs with a slice of sourdough toast and butter, and a medium latte with oat milk">${esc(M.aiText||'')}</textarea></label>
  <div class="row" style="margin-top:10px"><button class="btn primary" data-act="airun" ${M.aiBusy?'disabled':''}>${M.aiBusy?'<span class="spin"></span> Estimating…':'Estimate nutrition'}</button><span class="faint">Claude estimates each item from typical USDA values.</span></div>`;
  if(!S.sample)h=`<div class="notice">AI estimates need this page to be opened on claude.ai. You can still search the database, create a food, or quick-add calories.</div>`;
  if(M.aiErr)h+=`<div class="notice warn" style="margin-top:12px">${esc(M.aiErr)}</div>`;
  if(M.ai&&M.ai.length){
    const tot=sumN(M.ai);
    h+=`<div class="results" style="max-height:none">${M.ai.map((it,i)=>`<div class="ai-item"><span style="flex:1;min-width:0"><div class="nm" style="font-weight:500">${esc(it.name)}</div><div class="faint">${esc(it.amount)} · ${Math.round(it.g)} g · P ${fmt(it.n.p,'p')} · C ${fmt(it.n.c,'c')} · F ${fmt(it.n.f,'f')}</div></span><b style="font-variant-numeric:tabular-nums">${Math.round(it.n.kcal)}</b><button class="x" data-act="airm" data-i="${i}" aria-label="Remove ${esc(it.name)}">×</button></div>`).join('')}</div>
    <div class="spread" style="margin-top:12px"><span class="muted">Total <b>${Math.round(tot.kcal)} kcal</b> · P ${Math.round(tot.p)} g · C ${Math.round(tot.c)} g · F ${Math.round(tot.f)} g</span>
    <span class="row">${mealSel(M.meal)}<button class="btn primary" data-act="aiadd">Add ${M.ai.length} item${M.ai.length>1?'s':''}</button></span></div>
    <p class="faint" style="margin-top:8px">Estimates can be off — tap any entry in your diary afterward to adjust the amount.</p>`;
  }
  return h;
}
function parseJSON(t){const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<a)throw new Error('no json');return JSON.parse(t.slice(a,b+1))}
async function aiRun(){
  const ta=$('#ai-in'),txt=ta&&ta.value.trim();if(!txt||!S.sample)return;
  const m=M;M.aiText=txt;M.aiBusy=true;M.aiErr='';M.ai=null;drawModal(false);
  const prompt=`You are a precise nutrition database assistant. Break the meal description below into separate food items and estimate the nutrition of each item AS EATEN, using typical USDA FoodData Central values. If an amount is not given, assume a typical single serving and say so in "amount".
Return ONLY a JSON object, no prose, in exactly this shape:
{"items":[{"name":"Scrambled eggs","amount":"2 large eggs","grams":122,${KEYS.map(k=>'"'+AIMAP[k]+'":0').join(',')}}]}
All nutrient numbers are totals for the stated amount (replace the 0 placeholders with real estimates; vitamin A is RAE, folate is DFE). "grams" is the total weight of the item.
Meal description: """${txt.slice(0,1500)}"""`;
  try{
    const r=await S.sample(prompt,{modelTier:'default'});
    const j=parseJSON(r.text||'');const map=AIMAP;
    const items=(j.items||[]).filter(it=>it&&it.name).slice(0,20).map(it=>{const n={};KEYS.forEach(k=>n[k]=r2(Math.max(0,+it[map[k]]||0)));const g=Math.max(0,+it.grams||0);return {name:String(it.name).slice(0,80),amount:String(it.amount||'1 serving').slice(0,60),g,n}});
    if(M!==m)return;
    if(!items.length)M.aiErr='Claude couldn’t identify any foods in that description. Try listing them more plainly.';
    M.ai=items;
  }catch(e){
    if(M!==m)return;const c=e&&e.code;
    M.aiErr=c==='rate_limited'?'Too many estimates in a short time — wait a minute and try again.':c==='not_granted'?'AI estimates aren’t enabled for this page right now.':'Couldn’t get an estimate. Try rephrasing the description.';
    if(c==='not_granted')S.sample=null;
  }
  M.aiBusy=false;drawModal(false);
}
function aiAdd(){
  const meal=$('#meal').value,d=day(S.date);
  for(const it of M.ai){const per=it.g>0?Object.fromEntries(KEYS.map(k=>[k,r2(it.n[k]*100/it.g)])):null;
    d.foods.push(per?{id:newId(),fid:null,name:it.name,meal,qty:1,unit:it.amount,unitG:r2(it.g),g:r2(it.g),per,n:it.n,src:'ai'}:{id:newId(),name:it.name,meal,amount:it.amount,n:it.n,src:'ai'})}
  const c=M.ai.length;closeModal();put(dk(S.date),d);toast(`Added ${c} item${c>1?'s':''} to ${mealName(meal)}`);
}
/* custom food */
function customBody(){
  const P=M.prefill||{},v=k=>P.vals&&P.vals[k]!=null?P.vals[k]:'';
  const fld=k=>`<label class="field">${META[k][0]} (${META[k][1]})<input id="c-${k}" type="number" min="0" step="any" inputmode="decimal" value="${v(k)}"></label>`;
  let h='';
  if(M.code)h+=`<div class="notice" style="margin-bottom:12px">Barcode <b>${esc(prettyCode(M.code))}</b> will be linked to this food, so scanning it again finds it instantly.</div>`;
  if(S.sample&&S.sampleImages)h+=`<div class="row" style="margin-bottom:14px">${M.lblBusy?'<span class="btn"><span class="spin"></span> Reading the label…</span>':`<label class="btn">📷 Fill in from a photo of the label<input type="file" accept="image/*" capture="environment" id="lbl-file" hidden></label>`}<span class="faint">Claude reads the Nutrition Facts table for you.</span></div>`;
  if(M.lblErr)h+=`<div class="notice warn" style="margin-bottom:12px">${esc(M.lblErr)}</div>`;
  if(P.vals&&!M.lblErr)h+=`<div class="notice" style="margin-bottom:12px">Filled in for you — check the numbers against the package before saving.</div>`;
  h+=`<div class="fgrid"><label class="field" style="grid-column:1/-1">Food name<input id="c-name" ${M.prefill?'':'autofocus'} value="${esc(P.name||'')}" placeholder="e.g. Mom’s lasagna, Kirkland protein bar"></label>
  <label class="field">Serving name<input id="c-sv" value="${esc(P.sv||'serving')}"></label>
  <label class="field">Serving size (g or ml)<input id="c-g" type="number" min="0" step="any" value="${P.g||100}"></label></div>
  <h3 class="minih">Per serving</h3><div class="fgrid">${['kcal','p','c','f'].map(fld).join('')}</div>
  <h3 class="minih">Also on most labels <span class="faint" style="font-weight:400">— leave blank if not listed</span></h3><div class="fgrid">${['sf','chol','na','fib','sug','k','ca','fe'].map(fld).join('')}</div>
  <details style="margin-top:12px" ${['vc','va','vd','mg','zn','b12','fol'].some(k=>v(k)!=='')?'open':''}><summary>Vitamins &amp; more minerals</summary><div class="fgrid" style="margin-top:10px">${['vc','va','vd','mg','zn','b12','fol'].map(fld).join('')}</div></details>
  <div id="cerr" class="notice warn" style="margin-top:12px" hidden></div>
  <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn primary" data-act="savecustom">${M.fromFoods?'Save food':'Save & choose amount'}</button></div>`;
  return h;
}
function saveCustom(){
  const name=$('#c-name').value.trim(),g=parseFloat($('#c-g').value),kc=parseFloat($('#c-kcal').value),err=$('#cerr');
  if(!name||!(g>0)||isNaN(kc)){err.hidden=false;err.textContent='Add a name, a serving size above 0, and calories.';return}
  const per={};KEYS.forEach(k=>{const v=parseFloat($('#c-'+k).value);per[k]=isNaN(v)?(['kcal','p','c','f'].includes(k)?0:null):r2(v*100/g)});
  const f={id:'c'+newId(),name:name.slice(0,80),per,portions:[[$('#c-sv').value.trim()||'serving',g],['oz',28.35],['g',1]]};
  if(M.code)f.codes=[M.code];
  const doc=get('custom')||{foods:[]};doc.foods=(doc.foods||[]).concat([f]);
  if(M.fromFoods){closeModal();put('custom',doc);toast('Food saved');return}
  const meal=M.meal;put('custom',doc);M={kind:'food',meal,sel:Object.assign({},f,{cat:'My foods'}),qty:1,pi:0};drawModal();
}
/* ---------- barcode scanning ---------- */
const AIMAP={kcal:'kcal',p:'protein_g',c:'carbs_g',f:'fat_g',fib:'fiber_g',sug:'sugars_g',na:'sodium_mg',k:'potassium_mg',ca:'calcium_mg',fe:'iron_mg',vc:'vitamin_c_mg',sf:'saturated_fat_g',chol:'cholesterol_mg',mg:'magnesium_mg',zn:'zinc_mg',va:'vitamin_a_ug_rae',vd:'vitamin_d_ug',b12:'vitamin_b12_ug',fol:'folate_ug_dfe'};
function normCode(raw){let d=String(raw||'').replace(/\D/g,'');if(d.length===12)d='0'+d;return /^\d{8}$|^\d{13}$|^\d{14}$/.test(d)?d:null}
function prettyCode(c){return c.length===13&&c[0]==='0'?c.slice(1):c}
function checkOK(c){const d=[...c].map(Number),cd=d.pop();let s=0;d.reverse().forEach((x,i)=>s+=x*(i%2===0?3:1));return (10-s%10)%10===cd}
const LP=['3211','2221','2122','1411','1132','1231','1114','1312','1213','3112'].map(x=>[...x].map(Number));
const GP=LP.map(p=>p.slice().reverse());
const PAR=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLL','LGLGGL','LGGLGL'];
function matchDigit(w,allowG){const t=w[0]+w[1]+w[2]+w[3];const n=w.map(x=>x*7/t);let best=null;
  const tabs=allowG?[[LP,'L'],[GP,'G']]:[[LP,'L']];
  for(const [tb,ty] of tabs)for(let d=0;d<10;d++){let e=0;for(let j=0;j<4;j++)e+=Math.abs(n[j]-tb[d][j]);if(!best||e<best.e)best={d,ty,e}}
  return best}
function decodeRuns(r,firstBlack){
  const okG=(a,m)=>a>m*.35&&a<m*2;
  for(let i=1;i+59<=r.length;i++){
    if(((i%2===0)===firstBlack)===false)continue;
    const m=(r[i]+r[i+1]+r[i+2])/3;if(m<1)continue;
    if(r[i-1]<m*2.5)continue;
    if(!okG(r[i],m)||!okG(r[i+1],m)||!okG(r[i+2],m))continue;
    let dg=[],par='',ok=true;
    for(let k=0;k<12&&ok;k++){
      const o=k<6?i+3+k*4:i+32+(k-6)*4;const w=r.slice(o,o+4);const t=w[0]+w[1]+w[2]+w[3];
      if(t<m*5||t>m*9.5){ok=false;break}
      const b=matchDigit(w,k<6);if(b.e>1.5){ok=false;break}
      dg.push(b.d);if(k<6)par+=b.ty;
    }
    if(!ok)continue;
    if(![27,28,29,30,31].every(j=>okG(r[i+j],m)))continue;
    if(!okG(r[i+56],m)||!okG(r[i+57],m)||!okG(r[i+58],m))continue;
    const f=PAR.indexOf(par);if(f<0)continue;
    const code=f+dg.join('');if(checkOK(code))return code;
  }
  return null;
}
function scanLine(l){
  const n=l.length;
  for(const mode of [0,1]){
    const b=new Uint8Array(n);
    if(mode===0){let mn=255,mx=0;for(let i=0;i<n;i++){if(l[i]<mn)mn=l[i];if(l[i]>mx)mx=l[i]}if(mx-mn<35)return null;const t=(mn+mx)/2;for(let i=0;i<n;i++)b[i]=l[i]<t?1:0}
    else{const w=Math.max(12,(n/20)|0),ps=new Float64Array(n+1);for(let i=0;i<n;i++)ps[i+1]=ps[i]+l[i];for(let i=0;i<n;i++){const a=Math.max(0,i-w),z=Math.min(n,i+w);b[i]=l[i]<(ps[z]-ps[a])/(z-a)-6?1:0}}
    for(const rev of [false,true]){
      const bb=rev?b.slice().reverse():b;const r=[];let cur=bb[0],len=0;
      for(let i=0;i<n;i++){if(bb[i]===cur)len++;else{r.push(len);cur=bb[i];len=1}}r.push(len);
      const c=decodeRuns(r,bb[0]===1);if(c)return c;
    }
  }
  return null;
}
function scanCanvas(c){
  const W=c.width,H=c.height,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
  const g=new Uint8ClampedArray(W*H);for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=(d[j]*299+d[j+1]*587+d[j+2]*114)/1000;
  const fr=[];for(let k=0;k<=24;k++){const o=(k%2?1:-1)*Math.ceil(k/2)*0.033;fr.push(0.5+o)}
  for(const f of fr){const y=Math.round(f*(H-1));const v=g.subarray(y*W,y*W+W);const r=scanLine(v);if(r)return r}
  for(const f of fr){const x=Math.round(f*(W-1));const v=new Uint8ClampedArray(H);for(let y=0;y<H;y++)v[y]=g[y*W+x];const r=scanLine(v);if(r)return r}
  return null;
}
async function fileToCanvas(file,max){
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
    const sc=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(img.naturalWidth*sc));c.height=Math.max(1,Math.round(img.naturalHeight*sc));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c}
  finally{URL.revokeObjectURL(url)}
}
const toBlob=c=>new Promise(r=>c.toBlob(r,'image/jpeg',0.88));
async function readBarcode(file){
  const c=await fileToCanvas(file,1800);
  if('BarcodeDetector' in window){try{const bd=new BarcodeDetector({formats:['ean_13','upc_a','ean_8','upc_e']});const r=await bd.detect(c);if(r&&r.length){const n=normCode(r[0].rawValue);if(n)return n}}catch(e){}}
  for(const size of [1800,1200,800]){
    let cc=c;if(size<Math.max(c.width,c.height)){const s=size/Math.max(c.width,c.height);cc=document.createElement('canvas');cc.width=Math.round(c.width*s);cc.height=Math.round(c.height*s);cc.getContext('2d').drawImage(c,0,0,cc.width,cc.height)}
    const r=scanCanvas(cc);if(r)return r;
  }
  return null;
}
function scanBody(){
  const sc=M.scan||{stage:'start'};
  const pick=(label,primary)=>`<label class="btn ${primary?'primary':''}">${label}<input type="file" accept="image/*" capture="environment" id="bc-file" hidden></label>`;
  const manual=`<div class="row" style="margin-top:16px"><input id="bc-num" class="inp" inputmode="numeric" placeholder="Or type the barcode number" style="max-width:260px" value="${esc(sc.typed||'')}"><button class="btn" data-act="bclookup">Look up</button></div>`;
  if(sc.stage==='busy')return `<div class="scanbox"><span class="spin"></span> ${esc(sc.msg||'Reading the barcode…')}</div>`;
  if(sc.stage==='new')return `<div class="scanbox"><div class="faint">Barcode</div><div class="code">${esc(prettyCode(sc.code))}</div>
    <p>${navigator.onLine?'This product isn’t in the Open Food Facts database or your foods yet.':'You’re offline, so this product couldn’t be looked up.'} Add it once and it’ll come up instantly every time you scan it.</p>
    <div class="row" style="justify-content:center">${S.sample&&S.sampleImages?`<label class="btn primary">📷 Photo of the Nutrition Facts label<input type="file" accept="image/*" capture="environment" id="lbl-file" hidden></label>`:''}<button class="btn" data-act="bcmanual">Type it in from the label</button></div></div>
    <div class="row" style="margin-top:12px"><button class="btn ghost sm" data-act="bcreset">‹ Scan a different product</button></div>`;
  let h=`<div class="scanbox">
    <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true"><g fill="currentColor">${[2,6,8,12,16,18,22,26,28,32,36,40,42,46,50,52,56,60].map((x,i)=>`<rect x="${x}" y="2" width="${i%3?1.5:3}" height="36"/>`).join('')}</g></svg>
    <p style="margin:6px 0 14px">${isNative?'Point your camera at the product’s barcode.':'Take a photo of the product’s barcode — close up, flat and in good light.'}</p>
    ${isNative?`<button class="btn primary" data-act="nativescan">📷 Scan with camera</button><div style="margin-top:10px">${pick('Use a photo instead',false)}</div>`:pick('📷 Take or choose a photo',true)}</div>`;
  if(sc.stage==='fail')h+=`<div class="notice warn" style="margin-top:12px">Couldn’t read a barcode in that photo. Try again closer and straight-on${S.sample&&S.sampleImages&&sc.img?', or let Claude read the printed number':''}.${S.sample&&S.sampleImages&&sc.img?' <button class="btn sm" data-act="bcclaude" style="margin-left:6px">Ask Claude to read it</button>':''}</div>`;
  if(sc.err)h+=`<div class="notice warn" style="margin-top:12px">${esc(sc.err)}</div>`;
  return h+manual;
}
function findByCode(code){return customs().find(c=>(c.codes||[]).includes(code))}
async function gotCode(code){
  const f=findByCode(code);
  if(f){M.scan={stage:'start'};M.sel=Object.assign({},f,{cat:'My foods'});M.qty=1;M.pi=0;drawModal();toast('Found '+f.name);return}
  const m=M;M.scan={stage:'busy',msg:'Looking up '+prettyCode(code)+'…'};drawModal(false);
  let p=null;try{p=await offLookup(code);if(!p&&code.length===13&&code[0]==='0')p=null}catch(e){}
  if(M!==m)return;
  if(p){M.scan={stage:'start'};M.sel=p;M.qty=1;M.pi=0;drawModal();toast('Found '+p.name);return}
  M.scan={stage:'new',code};drawModal(false);
}
async function onBarcodeFile(file){
  const m=M;M.scan={stage:'busy',msg:'Reading the barcode…'};drawModal(false);
  let code=null;try{code=await readBarcode(file)}catch(e){}
  if(M!==m)return;
  if(code)gotCode(code);else{M.scan={stage:'fail',img:file};drawModal(false)}
}
async function bcClaude(){
  const m=M,file=M.scan&&M.scan.img;if(!file)return;M.scan={stage:'busy',msg:'Claude is reading the number…'};drawModal(false);
  try{const blob=await toBlob(await fileToCanvas(file,1568));
    const r=await S.sample('Read the barcode number (the digits printed under the barcode, usually 12 or 13 digits) in this photo. Reply with ONLY JSON: {"code":"<digits>"} or {"code":null} if you cannot read it clearly.',{images:[blob],modelTier:'quick'});
    if(M!==m)return;const code=normCode((parseJSON(r.text||'{}')||{}).code);
    if(code&&checkOK(code))gotCode(code);else{M.scan={stage:'fail',err:'Claude couldn’t make out the number either. Type it in below.'};drawModal(false)}
  }catch(e){if(M!==m)return;M.scan={stage:'fail',err:aiErrMsg(e)};drawModal(false)}
}
function aiErrMsg(e){const c=e&&e.code;if(c==='not_granted'){S.sample=null;return 'Claude features aren’t enabled for this page right now.'}return c==='rate_limited'?'Too many requests in a short time — wait a minute and try again.':'That didn’t work. Please try again.'}
async function onLabelFile(file){
  const m=M;const code=M.scan&&M.scan.code||M.code;
  M.tab='custom';M.code=code||null;M.lblBusy=true;M.lblErr='';drawModal(false);
  try{const blob=await toBlob(await fileToCanvas(file,1568));
    const prompt=`Read the Nutrition Facts table in this photo of a food package (it may be a US or Canadian bilingual label). Reply with ONLY a JSON object:
{"readable":true,"product_name":"<brand and product if visible, else empty>","serving_description":"<e.g. 1 cup, 2 cookies, 1 bar>","serving_size_g":<number of grams or millilitres in one serving>,${KEYS.map(k=>'"'+AIMAP[k]+'":<number or null>').join(',')}}
Values are PER SERVING exactly as on the label. Convert units: sodium, potassium, calcium, iron, cholesterol, magnesium, zinc, vitamin C in mg; vitamin A (RAE), vitamin D, vitamin B12, folate (DFE) in micrograms. If a nutrient is shown only as % Daily Value, convert it using that country's Daily Value. Use null for anything not on the label. If there is no readable nutrition table, reply {"readable":false}.`;
    const r=await S.sample(prompt,{images:[blob],modelTier:'default'});
    if(M!==m)return;const j=parseJSON(r.text||'{}');
    if(!j.readable){M.lblErr='Couldn’t read a nutrition table in that photo. Try again with the table filling the frame, or type the numbers in.';}
    else{const vals={};KEYS.forEach(k=>{const v=j[AIMAP[k]];vals[k]=v==null||isNaN(+v)?null:Math.max(0,+v)});
      M.prefill={name:String(j.product_name||'').slice(0,80),sv:String(j.serving_description||'serving').slice(0,40),g:+j.serving_size_g>0?+j.serving_size_g:100,vals}}
  }catch(e){if(M!==m)return;M.lblErr=e&&e.code?aiErrMsg(e):'Couldn’t read that label. Try another photo, or type the numbers in.'}
  M.lblBusy=false;drawModal(false);
}
/* quick add */
function quickBody(){
  const e=M.quick||{};
  return `<div class="fgrid"><label class="field" style="grid-column:1/-1">Label (optional)<input id="q-name" value="${esc(e.name||'')}" placeholder="e.g. Office birthday cake"></label>
  <label class="field">Calories<input id="q-kcal" type="number" min="0" inputmode="decimal" value="${e.n?Math.round(e.n.kcal):''}" autofocus></label>
  <label class="field">Protein (g)<input id="q-p" type="number" min="0" step="any" value="${e.n?e.n.p:''}"></label>
  <label class="field">Carbs (g)<input id="q-c" type="number" min="0" step="any" value="${e.n?e.n.c:''}"></label>
  <label class="field">Fat (g)<input id="q-f" type="number" min="0" step="any" value="${e.n?e.n.f:''}"></label>
  <label class="field">Meal${mealSel(M.meal)}</label></div>
  <div class="row" style="margin-top:14px;justify-content:flex-end">${M.editId?'<button class="btn" data-act="delfood" data-id="'+M.editId+'">Remove</button>':''}<button class="btn primary" data-act="savequick">${M.editId?'Save changes':'Add'}</button></div>`;
}
function saveQuick(){
  const v=id=>{const x=parseFloat($(id).value);return isNaN(x)?0:Math.max(0,x)};const kc=v('#q-kcal');
  if(!kc){toast('Enter calories');return}
  const n={};KEYS.forEach(k=>n[k]=0);n.kcal=kc;n.p=v('#q-p');n.c=v('#q-c');n.f=v('#q-f');
  const old=M.quick||{};
  const e={id:M.editId||newId(),name:$('#q-name').value.trim()||'Quick add',meal:$('#meal').value,amount:old.amount||'',n:Object.assign({},old.n||{},n),src:old.src||'quick'};
  const d=day(S.date);if(M.editId){const i=d.foods.findIndex(x=>x.id===M.editId);if(i>=0)d.foods[i]=e}else d.foods.push(e);
  closeModal();put(dk(S.date),d);toast('Saved');
}
/* exercise */
function exBody(){
  const kg=targets(S.date).w;
  return `<div class="sheet-h"><h3>Add exercise</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <div class="fgrid"><label class="field" style="grid-column:1/-1">Activity<select id="x-act" class="inp">${EX.map(([n,m],i)=>`<option value="${i}">${esc(n)}</option>`).join('')}<option value="-1">Other (enter calories)</option></select></label>
  <label class="field">Minutes<input id="x-min" type="number" min="1" value="30" autofocus></label>
  <label class="field">Calories burned<input id="x-kcal" type="number" min="0" value="${Math.round(EX[0][1]*kg*0.5)}"></label>
  <label class="field" id="x-namef" hidden style="grid-column:1/-1">Name<input id="x-name" placeholder="e.g. Rock climbing"></label></div>
  <p class="faint">Estimated from the activity’s MET value and your weight (${wOut(kg).toFixed(1)} ${wU()}). Use your watch’s number if you have one.</p>
  <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="saveex">Add exercise</button></div></div>`;
}
function exCalc(){const i=+$('#x-act').value,min=parseFloat($('#x-min').value)||0;$('#x-namef').hidden=i!==-1;if(i>=0)$('#x-kcal').value=Math.round(EX[i][1]*targets(S.date).w*min/60)}
function saveEx(){
  const i=+$('#x-act').value,min=parseFloat($('#x-min').value)||0,kc=parseFloat($('#x-kcal').value)||0;
  const name=i>=0?EX[i][0]:($('#x-name').value.trim()||'Exercise');if(!kc){toast('Enter calories burned');return}
  const d=day(S.date);d.ex.push({id:newId(),name,min,kcal:Math.round(kc)});closeModal();put(dk(S.date),d);toast('Exercise added');
}

/* ---------- workouts ---------- */
// kind: w = weight × reps, bw = bodyweight reps (optional added weight), t = timed hold, c = cardio (time + distance)
const EXLIB=[
['bench','Bench press','Chest','w'],['inclinedb','Incline dumbbell press','Chest','w'],['dbbench','Dumbbell bench press','Chest','w'],['pushup','Push-up','Chest','bw'],['chestfly','Chest fly (machine/cable)','Chest','w'],['dips','Dips','Chest','bw'],
['ohp','Overhead press','Shoulders','w'],['dbshoulder','Dumbbell shoulder press','Shoulders','w'],['latraise','Lateral raise','Shoulders','w'],['facepull','Face pull','Shoulders','w'],
['deadlift','Deadlift','Back','w'],['pullup','Pull-up','Back','bw'],['chinup','Chin-up','Back','bw'],['latpull','Lat pulldown','Back','w'],['bbrow','Barbell row','Back','w'],['dbrow','Dumbbell row','Back','w'],['cablerow','Seated cable row','Back','w'],
['squat','Back squat','Legs','w'],['frontsquat','Front squat','Legs','w'],['gobletsquat','Goblet squat','Legs','w'],['legpress','Leg press','Legs','w'],['rdl','Romanian deadlift','Legs','w'],['lunge','Walking lunge','Legs','w'],['bss','Bulgarian split squat','Legs','w'],['legext','Leg extension','Legs','w'],['legcurl','Leg curl','Legs','w'],['calf','Calf raise','Legs','w'],['hipthrust','Hip thrust','Glutes','w'],['kbswing','Kettlebell swing','Glutes','w'],
['curl','Biceps curl','Arms','w'],['hammer','Hammer curl','Arms','w'],['pushdown','Triceps pushdown','Arms','w'],['skull','Skull crusher','Arms','w'],
['plank','Plank','Core','t'],['sideplank','Side plank','Core','t'],['crunch','Crunch','Core','bw'],['legraise','Hanging leg raise','Core','bw'],['twist','Russian twist','Core','bw'],['burpee','Burpee','Full body','bw'],
['run','Running','Cardio','c',9.8],['walk','Walking','Cardio','c',3.5],['cycle','Cycling','Cardio','c',8],['bike','Stationary bike','Cardio','c',6.8],['row','Rowing machine','Cardio','c',7],['elliptical','Elliptical','Cardio','c',5],['swim','Swimming','Cardio','c',5.8],['stairs','Stair climber','Cardio','c',9],['rope','Jump rope','Cardio','c',11.8],['hike','Hiking','Cardio','c',6]
].map(([id,name,group,kind,met])=>({id,name,group,kind,met:met||null}));
const STRENGTH_MET=5;
function exList(){return EXLIB.concat(((get('exercises')||{}).list)||[],S.tmpEx||[],FX.list)}
function exById(id){return exIndex().get(id)||{id,name:FX.loaded||!/^fx:/.test(id)?'Exercise':'…',group:'Other',kind:'w'}}
function routines(){return ((get('routines')||{}).list)||[]}
function allWorkouts(){const out=[];for(const k of Object.keys(S.docs))if(k.startsWith('wk-'))for(const w of (S.docs[k].list||[]))out.push(w);return out.sort((a,b)=>(b.end||0)-(a.end||0))}
const wkKey=date=>'wk-'+date.slice(0,7);
const wDisp=kg=>kg==null||kg===''?'':String(Math.round(wOut(kg)*(imperial()?2:10))/(imperial()?2:10));
const e1rm=(w,r)=>w>0&&r>0?w*(1+r/30):0;
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const distU=()=>imperial()?'mi':'km';
const dIn=v=>imperial()?v*1.60934:v, dOut=km=>imperial()?km/1.60934:km;
function bestOf(ex,sets){
  const k=ex.kind;let b=0;
  for(const s of sets){if(!s.done)continue;
    if(k==='w')b=Math.max(b,e1rm(+s.w||0,+s.r||0));
    else if(k==='bw')b=Math.max(b,+s.r||0);
    else if(k==='t')b=Math.max(b,+s.t||0);
    else b=Math.max(b,+s.d||0);}
  return b;
}
function exHistory(exId,before){
  const out=[];for(const w of allWorkouts()){if(before&&w.end>=before)continue;for(const it of (w.items||[]))if(it.ex===exId){out.push({w,it})}}
  return out; // newest first
}
function lastSets(exId){const h=exHistory(exId);return h.length?h[0].it.sets.filter(s=>s.done):null}
/* draft persistence for an in-progress session */
const WSK='tally.ws';
function saveWs(){try{S.ws?localStorage.setItem(WSK,JSON.stringify(S.ws)):localStorage.removeItem(WSK)}catch(e){}if(S.ws&&S.ws.session&&S.ws.kind!=='int')tgProgress()}
try{const x=JSON.parse(localStorage.getItem(WSK)||'null');if(x&&x.start)S.ws=x}catch(e){}
function newSet(ex,tmpl){
  if(ex.kind==='c')return {t:tmpl&&tmpl.min?tmpl.min*60:'',d:tmpl&&tmpl.dist?tmpl.dist:'',done:false};
  if(ex.kind==='t')return {t:tmpl&&tmpl.secs||'',done:false};
  return {r:tmpl&&tmpl.reps||'',w:tmpl&&tmpl.wt!=null?tmpl.wt:'',done:false};
}
function startWorkout(rt){
  if(S.ws&&!confirmReplace())return;
  if(rt&&rt.kind==='int'){S.ws={kind:'int',name:rt.name,routineId:rt.id,start:Date.now(),int:Object.assign({},rt.int),phaseStart:null,paused:true,elapsedPhase:0,step:0};}
  else{
    const items=(rt?rt.items:[]).map(t=>{const ex=exById(t.ex);const prev=lastSets(t.ex);
      const n=ex.kind==='c'?1:(+t.sets||3);const sets=[];
      for(let i=0;i<n;i++){const ps=prev&&prev[Math.min(i,prev.length-1)];sets.push(newSet(ex,{reps:t.reps||(ps&&ps.r)||'',wt:t.wt!=null&&t.wt!==''?t.wt:(ps&&ps.w!==''?ps.w:''),secs:t.secs||(ps&&ps.t),min:t.min,dist:t.dist}))}
      return {ex:t.ex,rest:t.rest||90,sets}});
    S.ws={kind:'std',name:rt?rt.name:'Workout',routineId:rt?rt.id:null,start:Date.now(),items};
  }
  saveWs();location.hash='#workouts';S.view='workouts';render();window.scrollTo(0,0);
}
let wsConfirmPending=false;
function confirmReplace(){if(wsConfirmPending){wsConfirmPending=false;return true}wsConfirmPending=true;toast('A workout is in progress — tap again to discard it and start a new one');setTimeout(()=>wsConfirmPending=false,4000);return false}

/* ---------- workouts view ---------- */
function vWorkouts(){
  if(S.ws)return S.ws.kind==='int'?vInterval():vSession();
  const rts=routines(),ws=allWorkouts(),p=profile();
  const tab=S.wtab||'start';
  let h=`<div class="datebar"><h2>Workouts</h2><div class="seg-ctl" role="group">${[['start','Start'],['history','History'],['progress','Progress']].map(([k,l])=>`<button class="${tab===k?'on':''}" data-act="wtab" data-t="${k}">${l}</button>`).join('')}</div></div>`;
  if(tab==='start'){
    h+=`<div class="grid"><div class="stack"><section class="card"><div class="spread"><h3 style="font-size:18px">Your routines</h3><span class="row">${S.sample?'<button class="btn sm" data-act="buildopen">✨ Build with Claude</button>':''}<button class="btn sm" data-act="newround">⏱ Round clock</button><button class="btn sm" data-act="newint">+ Interval timer</button><button class="btn sm primary" data-act="newroutine">+ New routine</button></span></div>`;
    if(!rts.length)h+=`<p class="faint" style="margin:12px 0 0">No routines yet. Build one — like “Push day” or “5k easy run” — and start it with one tap. Or start an empty workout and add exercises as you go.</p>`;
    h+=`<div class="rlist">${rts.map(r=>{const sub=r.kind==='int'?(r.int.style==='round'?`${r.int.rounds} rounds · ${mmss(r.int.work)} / ${mmss(r.int.rest)} rest`:`${r.int.rounds} rounds · ${r.int.work}s work / ${r.int.rest}s rest`):r.items.map(t=>exById(t.ex).name).slice(0,4).join(', ')+(r.items.length>4?` +${r.items.length-4} more`:'');
      return `<div class="rrow"><div class="t"><div class="nm">${esc(r.name)}${r.kind==='int'?(r.int.style==='round'?' <span class="tag">Round clock</span>':' <span class="tag">Intervals</span>'):''}</div><div class="sub">${esc(sub)||'Empty'}</div></div><button class="btn ghost sm" data-act="rtshare" data-id="${r.id}" aria-label="Share or work out together" title="Share or work out together">👥</button><button class="btn ghost sm" data-act="editroutine" data-id="${r.id}">Edit</button><button class="btn sm primary" data-act="startroutine" data-id="${r.id}">Start</button></div>`}).join('')}</div>
      <div style="margin-top:14px"><button class="btn" data-act="startempty">Start an empty workout</button></div></section></div>`;
    // this week summary
    const wkStart=addDays(today(),-((new Date(today()+'T12:00').getDay()+6)%7));
    const thisWeek=ws.filter(w=>w.date>=wkStart);
    const streak=weekStreak(ws);
    h+=`<div class="stack"><div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile"><div class="l">This week</div><div class="v">${thisWeek.length}</div><div class="s">workout${thisWeek.length===1?'':'s'} · ${Math.round(thisWeek.reduce((a,w)=>a+(w.durMin||0),0))} min</div></div><div class="tile"><div class="l">Weekly streak</div><div class="v">${streak}</div><div class="s">week${streak===1?'':'s'} in a row</div></div></div>`;
    const recentPRs=ws.flatMap(w=>(w.prs||[]).map(x=>Object.assign({date:w.date},x))).slice(0,5);
    h+=`<section class="card"><h3 style="font-size:18px">Recent personal records</h3>${recentPRs.length?`<div class="rlist">${recentPRs.map(x=>`<div class="rrow"><div class="t"><div class="nm">🏅 ${esc(exById(x.ex).name)}</div><div class="sub">${esc(prText(x))} · ${esc(nice(x.date,{month:'short',day:'numeric'}))}</div></div></div>`).join('')}</div>`:'<p class="faint" style="margin:8px 0 0">Finish workouts to start setting records.</p>'}</section></div></div>`;
  }else if(tab==='history'){
    h+=`<section class="card" style="padding:0">${ws.length?ws.slice(0,60).map(w=>`<details class="whist"><summary><span class="t"><span class="nm">${esc(w.name)}</span><span class="sub">${esc(nice(w.date,{weekday:'short',month:'short',day:'numeric'}))} · ${Math.round(w.durMin)} min · ${Math.round(w.kcal)} kcal${w.volume?` · ${Math.round(wOut(w.volume)).toLocaleString()} ${wU()} lifted`:''}${(w.prs||[]).length?` · 🏅 ${w.prs.length} PR${w.prs.length>1?'s':''}`:''}</span></span></summary>
      <div class="wdet">${(w.items||[]).map(it=>{const ex=exById(it.ex);return `<div class="wdi"><b>${esc(ex.name)}</b><span class="faint">${it.sets.filter(s=>s.done).map(s=>setText(ex,s)).join(' · ')||'—'}</span></div>`}).join('')}${w.int?`<div class="wdi"><b>Intervals</b><span class="faint">${w.int.rounds} × ${w.int.work}s / ${w.int.rest}s</span></div>`:''}
      <div class="row" style="margin-top:8px"><button class="btn sm" data-act="saveasroutine" data-id="${w.id}">Save as routine</button><button class="btn ghost sm" data-act="delworkout" data-id="${w.id}" data-date="${w.date}">Delete</button></div></div></details>`).join(''):'<div class="empty" style="border:0;padding:22px">No workouts logged yet.</div>'}</section>`;
  }else{
    const used=[...new Set(ws.flatMap(w=>(w.items||[]).map(i=>i.ex)))];
    const sel=S.wex&&used.includes(S.wex)?S.wex:used[0];
    h+=`<section class="card chart"><div class="spread"><h3 style="font-size:18px">Workouts per week</h3><span class="faint">last 12 weeks</span></div><div style="margin-top:8px">${weeksChart(ws)}</div></section>`;
    h+=`<section class="card chart" style="margin-top:18px"><div class="spread"><h3 style="font-size:18px">Exercise progress</h3>${used.length?`<select id="wex" class="inp" style="max-width:260px">${used.map(id=>`<option value="${id}" ${id===sel?'selected':''}>${esc(exById(id).name)}</option>`).join('')}</select>`:''}</div>
    <div style="margin-top:8px">${sel?exChart(sel):'<p class="faint">Log a workout to see your progress here.</p>'}</div></section>`;
  }
  return h;
}
function weekStreak(ws){let n=0;let d=addDays(today(),-((new Date(today()+'T12:00').getDay()+6)%7));const has=s=>ws.some(w=>w.date>=s&&w.date<addDays(s,7));if(!has(d))d=addDays(d,-7);while(has(d)){n++;d=addDays(d,-7)}return n}
function setText(ex,s){
  if(ex.kind==='w')return `${wDisp(s.w)||0} ${wU()} × ${s.r||0}`;
  if(ex.kind==='bw')return `${s.r||0} reps${+s.w?` +${wDisp(s.w)} ${wU()}`:''}`;
  if(ex.kind==='t')return mmss(+s.t||0);
  return `${s.t?mmss(+s.t):''}${s.d?` · ${(Math.round(dOut(+s.d)*100)/100)} ${distU()}`:''}`;
}
function prText(x){const ex=exById(x.ex);
  if(ex.kind==='w')return `Est. 1-rep max ${wDisp(x.val)} ${wU()} (${wDisp(x.w)} × ${x.r})`;
  if(ex.kind==='bw')return `${x.val} reps`;if(ex.kind==='t')return `${mmss(x.val)} hold`;return `${Math.round(dOut(x.val)*100)/100} ${distU()}`}
function weeksChart(ws){
  const W=760,H=200,L=36,R=10,T=12,B=28,n=12;const mon=addDays(today(),-((new Date(today()+'T12:00').getDay()+6)%7));
  const wk=[];for(let i=n-1;i>=0;i--){const s=addDays(mon,-7*i);const l=ws.filter(w=>w.date>=s&&w.date<addDays(s,7));wk.push({s,c:l.length,m:l.reduce((a,w)=>a+(w.durMin||0),0)})}
  const mx=Math.max(4,...wk.map(x=>x.c));const cw=(W-L-R)/n,bw=Math.min(34,cw-6),y=v=>T+(H-T-B)*(1-v/mx);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Workouts per week"><g class="grid">`;
  for(let i=0;i<=mx;i+=Math.ceil(mx/4))s+=`<line x1="${L}" x2="${W-R}" y1="${y(i)}" y2="${y(i)}"/><text x="${L-8}" y="${y(i)+4}" text-anchor="end">${i}</text>`;
  s+='</g>';
  wk.forEach((x,i)=>{const xc=L+cw*(i+.5);if(x.c)s+=`<path d="${topRound(xc-bw/2,y(x.c),bw,y(0)-y(x.c),4)}" fill="var(--bar)"/>`;if(i%2===1||n<=6)s+=`<text x="${xc}" y="${H-8}" text-anchor="middle">${esc(nice(x.s,{month:'short',day:'numeric'}))}</text>`;
    s+=`<rect class="hit" x="${L+cw*i}" y="${T}" width="${cw}" height="${H-T-B}" data-tt="${esc('Week of '+nice(x.s,{month:'short',day:'numeric'})+'|'+x.c+' workout'+(x.c===1?'':'s')+'|'+Math.round(x.m)+' min')}"/>`});
  return s+'</svg>';
}
function exChart(id){
  const ex=exById(id);const pts=exHistory(id).map(({w,it})=>({date:w.date,v:bestOf(ex,it.sets),vol:ex.kind==='w'?it.sets.filter(s=>s.done).reduce((a,s)=>a+(+s.w||0)*(+s.r||0),0):0})).filter(p=>p.v>0).reverse();
  if(!pts.length)return '<p class="faint">No completed sets for this exercise yet.</p>';
  const lab=ex.kind==='w'?`Estimated 1-rep max (${wU()})`:ex.kind==='bw'?'Best set (reps)':ex.kind==='t'?'Longest hold (seconds)':`Longest distance (${distU()})`;
  const conv=v=>ex.kind==='w'?wOut(v):ex.kind==='c'?dOut(v):v;
  const W=760,H=230,L=48,R=14,T=14,B=28,n=pts.length;
  const vs=pts.map(p=>conv(p.v));let lo=Math.min(...vs),hi=Math.max(...vs);const pad=Math.max((hi-lo)*.2,hi*.05,1);lo=Math.max(0,lo-pad);hi=hi+pad;
  const x=i=>n===1?(L+W-R)/2:L+(W-L-R)*i/(n-1),y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  let s=`<div class="faint" style="margin-bottom:4px">${lab}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ex.name)} progress"><g class="grid">`;
  for(let k=0;k<=4;k++){const v=lo+(hi-lo)*k/4;s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${v<20?v.toFixed(1):Math.round(v)}</text>`}
  s+=`</g><text x="${L}" y="${H-8}">${esc(nice(pts[0].date,{month:'short',day:'numeric'}))}</text><text x="${W-R}" y="${H-8}" text-anchor="end">${esc(nice(pts[n-1].date,{month:'short',day:'numeric'}))}</text>`;
  if(n>1)s+=`<polyline points="${pts.map((p,i)=>x(i)+','+y(conv(p.v))).join(' ')}" fill="none" stroke="var(--p)" stroke-width="2" stroke-linejoin="round"/>`;
  pts.forEach((p,i)=>{const v=conv(p.v);s+=`<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="var(--p)" stroke="var(--card)" stroke-width="2"/><circle class="hit" cx="${x(i)}" cy="${y(v)}" r="14" data-tt="${esc(nice(p.date,{weekday:'short',month:'short',day:'numeric'})+'|'+(Math.round(v*10)/10)+' '+(ex.kind==='w'?wU():ex.kind==='bw'?'reps':ex.kind==='t'?'sec':distU())+(p.vol?'|Volume '+Math.round(wOut(p.vol)).toLocaleString()+' '+wU():''))}"/>`});
  return s+'</svg>';
}

/* ---------- live session ---------- */
function vSession(){
  const w=S.ws,el=Math.round((Date.now()-w.start)/1000);
  let h=`<div class="datebar"><h2><input id="ws-name" class="titleinp" value="${esc(w.name)}" aria-label="Workout name"></h2><span class="faint" id="ws-clock">${mmss(el)}</span><button class="btn ghost" data-act="wsdiscard">Discard</button><button class="btn primary" data-act="wsfinish">Finish</button></div><div class="stack" style="max-width:760px">${tgIn()?`<div id="tg-strip">${tgStrip()}</div>`:''}`;
  w.items.forEach((it,ii)=>{const ex=exById(it.ex);const prev=lastSets(it.ex);
    const cols=ex.kind==='w'?[wU(),'Reps']:ex.kind==='bw'?['Reps','+'+wU()]:ex.kind==='t'?['Seconds']:['Minutes',distU()];
    h+=`<section class="card ses"><div class="spread"><h3 style="font-size:18px">${esc(ex.name)}${fxRow(ex.id)?` <button class="hxi" data-act="howto" data-id="${esc(ex.id)}" aria-label="How to do ${esc(ex.name)}">ⓘ</button>`:''}</h3><span class="row"><span class="faint resttxt">${ex.kind==='c'?'':`Rest ${mmss(it.rest)}`}</span><button class="btn ghost sm" data-act="wsmove" data-i="${ii}" data-d="-1" aria-label="Move up">↑</button><button class="btn ghost sm" data-act="wsmove" data-i="${ii}" data-d="1" aria-label="Move down">↓</button><button class="x" data-act="wsrmex" data-i="${ii}" aria-label="Remove ${esc(ex.name)}">×</button></span></div>${tgIn()?`<div class="tgpart" data-ex="${esc(it.ex)}">${tgPartnerSets(it.ex)}</div>`:''}
    <div class="sets" style="--nc:${cols.length}"><div class="sh"><span>Set</span><span>Previous</span>${cols.map(c=>`<span>${esc(c)}</span>`).join('')}<span>✓</span></div>`;
    it.sets.forEach((st,si)=>{const ps=prev&&prev[si];
      const f=(k,val,ph)=>`<input class="inp si" inputmode="decimal" data-i="${ii}" data-s="${si}" data-k="${k}" value="${val}" placeholder="${ph||''}">`;
      let inputs;
      if(ex.kind==='w')inputs=f('w',wDisp(st.w),ps?wDisp(ps.w):'')+f('r',st.r,ps?ps.r:'');
      else if(ex.kind==='bw')inputs=f('r',st.r,ps?ps.r:'')+f('w',wDisp(st.w),'0');
      else if(ex.kind==='t')inputs=f('t',st.t,ps?ps.t:'');
      else inputs=f('t',st.t?Math.round(st.t/60*10)/10:'','')+f('d',st.d?Math.round(dOut(st.d)*100)/100:'','');
      h+=`<div class="srow ${st.done?'done':''}"><span class="sn">${si+1}</span><span class="pv">${ps?esc(setText(ex,ps)):'—'}</span>${inputs}<button class="chk ${st.done?'on':''}" data-act="wsdone" data-i="${ii}" data-s="${si}" aria-label="Complete set ${si+1}">✓</button></div>`});
    h+=`</div><div class="row" style="margin-top:8px">${ex.kind==='c'?'':`<button class="btn ghost sm" data-act="wsaddset" data-i="${ii}">+ Add set</button>`}${it.sets.length>1?`<button class="btn ghost sm" data-act="wsrmset" data-i="${ii}">− Remove set</button>`:''}${ex.kind==='c'?'':`<label class="faint" style="margin-left:auto">Rest <select class="inp restsel" data-i="${ii}" style="width:auto;padding:4px 8px;font-size:13px">${[30,45,60,90,120,150,180,240,300].map(v=>`<option value="${v}" ${v===it.rest?'selected':''}>${mmss(v)}</option>`).join('')}</select></label>`}</div></section>`;
  });
  h+=`<button class="btn" data-act="wsaddex" style="align-self:flex-start">+ Add exercise</button></div>`;
  if(S.rest)h+=restBar()+'<div style="height:70px"></div>';
  return h;
}
function restBar(){const left=Math.max(0,S.rest.end-Date.now())/1000;return `<div class="restbar" id="restbar"><span>Rest</span><b id="rest-left">${mmss(left)}</b><button class="btn sm" data-act="restadj" data-n="-15">−15s</button><button class="btn sm" data-act="restadj" data-n="15">+15s</button><button class="btn sm primary" data-act="restskip">Skip</button></div>`}
let tick=null;
function ensureTick(){if(tick)return;tick=setInterval(()=>{
  if(!S.ws){clearInterval(tick);tick=null;return}
  const c=$('#ws-clock');if(c)c.textContent=mmss((Date.now()-S.ws.start)/1000);
  if(S.rest){const left=(S.rest.end-Date.now())/1000;const el=$('#rest-left');if(el)el.textContent=mmss(left);if(left<=0){duck(1600);beep(880,.25);setTimeout(()=>beep(880,.25),350);S.rest=null;const rb=$('#restbar');if(rb)rb.remove();toast('Rest is over — next set!')}}
  if(S.ws.kind==='int')intTick();
  musicPoll();
},250)}
let AC=null;
function beep(f,d){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.2,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d);o.start();o.stop(AC.currentTime+d)}catch(e){}}
function wsInput(el){
  const it=S.ws.items[+el.dataset.i],st=it.sets[+el.dataset.s],k=el.dataset.k,v=parseFloat(el.value);
  if(k==='w')st.w=isNaN(v)?'':r2(wIn(v));else if(k==='t'&&exById(it.ex).kind==='c')st.t=isNaN(v)?'':Math.round(v*60);else if(k==='d')st.d=isNaN(v)?'':r2(dIn(v));else st[k]=isNaN(v)?'':v;
  saveWs();
}
function finishWorkout(){
  const w=S.ws,end=Date.now(),durMin=Math.max(1,(end-w.start)/60000),kg=targets(today()).w;
  let kcal=0,vol=0;const items=[];const prs=[];
  if(w.kind==='int'){const I=w.int;const done=intDoneSeconds();kcal=(I.style==='round'?7.8:8)*kg*done/3600;keepAwake(false);
    var rec={id:newId(),date:today(),name:w.name,routineId:w.routineId,start:w.start,end,durMin:Math.max(1,done/60),kcal:Math.round(kcal),items:[],int:I,prs:[]};}
  else{
    let cardioMin=0;
    for(const it of w.items){const ex=exById(it.ex);const sets=it.sets.filter(s=>s.done);if(!sets.length)continue;
      items.push({ex:it.ex,sets:sets.map(s=>Object.assign({},s))});
      if(ex.kind==='c'){const m=sets.reduce((a,s)=>a+(+s.t||0)/60,0);cardioMin+=m;kcal+=(ex.met||7)*kg*m/60}
      if(ex.kind==='w')vol+=sets.reduce((a,s)=>a+(+s.w||0)*(+s.r||0),0);
      const best=bestOf(ex,sets),prevBest=Math.max(0,...exHistory(it.ex,w.start).map(h=>bestOf(ex,h.it.sets)));
      if(best>0&&prevBest>0&&best>prevBest+1e-6){const pr={ex:it.ex,val:r2(best)};if(ex.kind==='w'){const top=sets.reduce((a,s)=>e1rm(+s.w,+s.r)>e1rm(+a.w,+a.r)?s:a);pr.w=top.w;pr.r=top.r}prs.push(pr)}
    }
    if(!items.length){toast('Complete at least one set first (tap ✓)');return}
    kcal+=STRENGTH_MET*kg*Math.max(0,durMin-cardioMin)/60;
    var rec={id:newId(),date:today(),name:w.name||'Workout',routineId:w.routineId,start:w.start,end,durMin:r2(durMin),kcal:Math.round(kcal),volume:r2(vol),items,prs};
  }
  const k=wkKey(rec.date),doc=get(k)||{list:[]};doc.list=(doc.list||[]).concat([rec]);
  const d=day(rec.date);d.ex.push({id:newId(),name:rec.name,min:Math.round(rec.durMin),kcal:rec.kcal,wid:rec.id});
  if(w.session){clearTimeout(tgPubT);tgEnd('done',w.session,tgPayload(w));rec.together=true}
  S.ws=null;S.rest=null;saveWs();
  put(k,doc);put(dk(rec.date),d);
  S.wtab='start';render();
  showSummary(rec);
  postAchievements(rec);
}
function showSummary(rec){openModal({kind:'summary',rec})}
function summaryBody(){const r=M.rec;return `<div class="sheet-h"><h3>Workout complete 🎉</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <div class="tiles" style="grid-template-columns:repeat(3,1fr)"><div class="tile"><div class="l">Time</div><div class="v">${Math.round(r.durMin)}<span class="faint" style="font-size:14px"> min</span></div></div><div class="tile"><div class="l">Calories</div><div class="v">${r.kcal}</div></div><div class="tile"><div class="l">${r.int?'Rounds':r.volume?'Volume':'Exercises'}</div><div class="v">${r.int?r.int.rounds:r.volume?Math.round(wOut(r.volume)).toLocaleString():r.items.length}${r.volume?`<span class="faint" style="font-size:14px"> ${wU()}</span>`:''}</div></div></div>
  ${r.prs.length?`<h3 class="minih">New personal records</h3>${r.prs.map(x=>`<div class="rrow"><div class="t"><div class="nm">🏅 ${esc(exById(x.ex).name)}</div><div class="sub">${esc(prText(x))}</div></div></div>`).join('')}`:''}
  <p class="faint" style="margin-top:12px">Added to today’s diary under Exercise (${r.kcal} kcal).</p>
  <div class="row" style="justify-content:flex-end">${r.routineId?'':`<button class="btn" data-act="saveasroutine" data-id="${r.id}">Save as routine</button>`}<button class="btn primary" data-act="close">Done</button></div></div>`}

/* ---------- interval timer ---------- */
// Interval timers and the round clock share one engine. Round clock = int with style 'round' (bell, warning knock, Get ready / Round / Rest).
function intPlan(I){const R=I.style==='round',p=[];
  if(+I.warm)p.push([R?'Get ready':'Warm-up',+I.warm]);
  for(let r=1;r<=+I.rounds;r++){p.push([R?'Round':'Work',+I.work,r]);if(r<+I.rounds||(!R&&+I.cool===0))if(+I.rest)p.push(['Rest',+I.rest,r])}
  if(+I.cool&&!R)p.push(['Cool-down',+I.cool]);return p}
function intDoneSeconds(){const w=S.ws,p=intPlan(w.int);let s=0;for(let i=0;i<Math.min(w.step,p.length);i++)s+=p[i][1];return s+(w.step<p.length?curPhaseElapsed():0)}
function curPhaseElapsed(){const w=S.ws;return w.elapsedPhase+(w.paused||!w.phaseStart?0:(Date.now()-w.phaseStart)/1000)}
const RING_R=118,RING_C=2*Math.PI*RING_R;
function phaseClass(ph,left,I){if(!ph)return 'done';const n=ph[0].toLowerCase().replace(/[^a-z]/g,'');return n+(I.style==='round'&&n==='round'&&+I.warn&&left<=+I.warn?' warn':'')}
function vInterval(){
  const w=S.ws,I=w.int,p=intPlan(I),ph=p[w.step],R=I.style==='round';
  const el=ph?curPhaseElapsed():0,left=ph?ph[1]-el:0,frac=ph?Math.min(1,el/ph[1]):1;
  const next=p[w.step+1];
  return `<div class="datebar"><h2>${esc(w.name)}</h2><button class="btn ghost" data-act="wsdiscard">Discard</button><button class="btn primary" data-act="wsfinish">Finish</button></div>
  ${tgIn()?`<div id="tg-strip" style="margin-bottom:12px">${tgStrip()}</div>`:''}<section class="card intv ${phaseClass(ph,left,I)}" id="intv">
    <div class="clock" role="timer" aria-live="off">
      <svg viewBox="0 0 280 280" aria-hidden="true"><circle class="ctrack" cx="140" cy="140" r="${RING_R}"/><circle class="cprog" id="int-ring" cx="140" cy="140" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C*frac}"/></svg>
      <div class="cface"><div class="phase" id="int-phase">${ph?esc(ph[0]):'Done!'}</div><div class="big" id="int-left">${mmss(Math.ceil(left))}</div>
      <div class="rnd" id="int-round">${ph&&ph[2]?`${R?'':'Round '}${ph[2]} <span>of ${I.rounds}</span>`:ph?'':`${I.rounds} ${R?'rounds':'rounds'} done`}</div></div>
    </div>
    <div class="faint" id="int-next">${next?'Next: '+esc(next[0])+(next[2]&&next[0]!=='Rest'?' '+next[2]:'')+' · '+mmss(next[1]):ph?'Last one!':''}</div>
    <div class="row" style="justify-content:center;margin-top:16px">${ph&&tgIn()&&!tgHost()?`<span class="faint">⏱ ${esc(pname(S.ws.session.host))} runs the clock${w.paused&&!w.phaseStart&&!w.elapsedPhase?' — waiting to start':w.paused?' — paused':''}</span>`:ph?`<button class="btn primary" data-act="intpause" style="min-width:130px">${w.paused?(w.phaseStart||w.elapsedPhase?'Resume':'Start'):'Pause'}</button><button class="btn" data-act="intskip">Skip</button>`:'<button class="btn primary" data-act="wsfinish">Save workout</button>'}</div>
  </section>`;
}
/* sounds: synthesized boxing bell and wooden "clapper" knock */
function bell(times,gap){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();for(let i=0;i<(times||1);i++){const t0=AC.currentTime+i*(gap||.32);
  [[880,1],[1320,.5],[2210,.3],[3010,.18]].forEach(([f,a])=>{const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.25*a,t0+.01);g.gain.exponentialRampToValueAtTime(.0001,t0+1.6);o.start(t0);o.stop(t0+1.7)})}}catch(e){}}
function clapper(n){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();for(let i=0;i<(n||2);i++){const t0=AC.currentTime+i*.18;const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.setValueAtTime(1900,t0);o.frequency.exponentialRampToValueAtTime(700,t0+.05);o.connect(g);g.connect(AC.destination);g.gain.setValueAtTime(.35,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+.08);o.start(t0);o.stop(t0+.1)}}catch(e){}}
/* keep the screen on while a timer runs */
let wakeLock=null;
async function keepAwake(on){try{if(on&&!wakeLock&&navigator.wakeLock){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null})}else if(!on&&wakeLock){await wakeLock.release();wakeLock=null}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.ws&&S.ws.kind==='int'&&!S.ws.paused)keepAwake(true)});
function intTick(){
  const w=S.ws,I=w.int,R=I.style==='round',p=intPlan(I);if(w.paused||w.step>=p.length)return;
  const ph=p[w.step],el=curPhaseElapsed(),left=ph[1]-el;
  if(R){ // warning knock near the end of each round; 3-2-1 beeps while getting ready
    if(ph[0]==='Round'&&+I.warn&&left<=+I.warn&&left>+I.warn-1&&w._warned!==w.step){w._warned=w.step;duck(1500);clapper(3)}
    if(ph[0]!=='Round'&&left<=3.05&&left>0&&Math.floor(left)!==w._lastBeep){if(w._lastBeep==null)duck(4500);w._lastBeep=Math.floor(left);beep(660,.12)}
  }else if(left<=3.05&&left>0&&Math.floor(left)!==w._lastBeep){if(w._lastBeep==null)duck(4500);w._lastBeep=Math.floor(left);beep(660,.12)}
  if(left<=0){const endAt=w.phaseStart+(ph[1]-w.elapsedPhase)*1000;w.step++;w.elapsedPhase=0;w.phaseStart=endAt;w._lastBeep=null;tgClock();
    const nx=p[w.step];
    if(R){duck(2500);if(!nx)bell(3,.35);else if(nx[0]==='Round')bell(1);else bell(2,.3)}
    else{duck(1200);beep(nx&&nx[0]==='Work'?1040:520,.35)}
    saveWs();if(w.step>=p.length){w.paused=true;keepAwake(false);toast(R?'Final bell! 🥊':'Intervals complete!')}render();return}
  const a=$('#int-left');if(a)a.textContent=mmss(Math.ceil(left));
  const rg=$('#int-ring');if(rg)rg.setAttribute('stroke-dashoffset',RING_C*Math.min(1,el/ph[1]));
  const card=$('#intv');if(card){const c='card intv '+phaseClass(ph,left,I);if(card.className!==c)card.className=c}
}
/* round clock setup */
const ROUND_PRESETS=[['Boxing',{work:180,rest:60,rounds:12}],['Amateur boxing',{work:180,rest:60,rounds:3}],['MMA',{work:300,rest:60,rounds:5}],['Muay Thai',{work:180,rest:120,rounds:5}],['Kickboxing',{work:120,rest:60,rounds:3}],['Bag work',{work:180,rest:30,rounds:6}]];
const parseMS=v=>{v=String(v||'').trim();if(/^\d+:\d{1,2}$/.test(v)){const [m,s2]=v.split(':').map(Number);return m*60+s2}const n=parseFloat(v);return isNaN(n)?0:Math.round(n*60)};
function roundBody(){const r=M.r,I=r.int;
  return `<div class="sheet-h"><h3>${M.isNew?'Round clock':'Edit round clock'}</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">${M.aiNote?`<div class="notice" style="margin-bottom:12px">✨ ${esc(M.aiNote)} <span class="faint">— check it over and adjust anything before saving.</span></div>`:''}
  <div class="chips">${ROUND_PRESETS.map(([n,v])=>`<button class="chip ${r.name===n?'on':''}" data-act="rpreset" data-n="${esc(n)}">${esc(n)}<small>${v.rounds} × ${mmss(v.work)}</small></button>`).join('')}</div>
  <label class="field" style="margin-top:12px">Name<input id="r-name" class="inp" value="${esc(r.name)}"></label>
  <div class="fgrid" style="margin-top:12px">
    <label class="field">Round length (min:sec)<input class="inp" id="rc-work" inputmode="numeric" value="${mmss(I.work)}"></label>
    <label class="field">Rest (min:sec)<input class="inp" id="rc-rest" inputmode="numeric" value="${mmss(I.rest)}"></label>
    <label class="field">Rounds<input class="inp" id="rc-rounds" type="number" min="1" max="50" value="${I.rounds}"></label>
    <label class="field">Get ready (sec)<input class="inp" id="rc-warm" type="number" min="0" max="120" value="${I.warm}"></label>
    <label class="field">Warning knock (sec before end)<input class="inp" id="rc-warn" type="number" min="0" max="60" value="${I.warn}"></label>
  </div>
  <p class="faint" id="rc-total">Total: ${mmss(intPlan(I).reduce((a,x)=>a+x[1],0))} · bell starts and ends each round${+I.warn?`, knock ${I.warn}s before the end`:''}</p>
  <div class="row" style="justify-content:flex-end">${M.isNew?'':'<button class="btn ghost" data-act="delroutine">Delete</button>'}<button class="btn" data-act="saveroutine">Save to routines</button><button class="btn primary" data-act="rcstart">Start</button></div></div>`}
function readRound(){if(!M||!M.r||!M.r.int||M.r.int.style!=='round')return;const I=M.r.int,n=$('#r-name');if(n)M.r.name=n.value;
  const g=id=>{const e=$('#'+id);return e?e.value:null};
  if(g('rc-work')!=null){I.work=Math.max(5,parseMS(g('rc-work')));I.rest=Math.max(0,parseMS(g('rc-rest')));I.rounds=Math.max(1,Math.min(50,parseInt(g('rc-rounds'))||1));I.warm=Math.max(0,parseInt(g('rc-warm'))||0);I.warn=Math.max(0,Math.min(I.work-1,parseInt(g('rc-warn'))||0))}}
/* ---------- routine editor (modal) ---------- */
function routineBody(){
  const r=M.r;
  if(M.pick)return pickerBody();
  if(r.kind==='int'){const I=r.int;const f=(k,l)=>`<label class="field">${l}<input class="inp" type="number" min="0" data-ik="${k}" value="${I[k]}"></label>`;
    const tot=intPlan(I).reduce((a,x)=>a+x[1],0);
    return `<div class="sheet-h"><h3>${M.isNew?'New interval timer':'Edit interval timer'}</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">${M.aiNote?`<div class="notice" style="margin-bottom:12px">✨ ${esc(M.aiNote)} <span class="faint">— check it over and adjust anything before saving.</span></div>`:''}
    <label class="field">Name<input id="r-name" class="inp" value="${esc(r.name)}"></label>
    <div class="fgrid" style="margin-top:12px">${f('warm','Warm-up (sec)')}${f('work','Work (sec)')}${f('rest','Rest (sec)')}${f('rounds','Rounds')}${f('cool','Cool-down (sec)')}</div>
    <p class="faint" id="int-total">Total: ${mmss(tot)}</p>
    <div class="row" style="justify-content:flex-end">${M.isNew?'':'<button class="btn ghost" data-act="delroutine">Delete</button>'}<button class="btn primary" data-act="saveroutine">Save</button></div></div>`}
  return `<div class="sheet-h"><h3>${M.isNew?'New routine':'Edit routine'}</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">${M.aiNote?`<div class="notice" style="margin-bottom:12px">✨ ${esc(M.aiNote)} <span class="faint">— check it over and adjust anything before saving.</span></div>`:''}
  <label class="field">Name<input id="r-name" class="inp" value="${esc(r.name)}" placeholder="e.g. Push day, Leg day, Easy 5k"></label>
  <div class="rlist" style="margin-top:12px">${r.items.map((t,i)=>{const ex=exById(t.ex);
    const n=(k,l,v,st)=>`<label class="mini">${l}<input class="inp" type="number" min="0" step="${st||1}" data-ri="${i}" data-rk="${k}" value="${v??''}"></label>`;
    const fields=ex.kind==='c'?n('min','Minutes',t.min)+n('dist',distU(),t.dist!=null&&t.dist!==''?Math.round(dOut(t.dist)*100)/100:'',0.1)
      :ex.kind==='t'?n('sets','Sets',t.sets)+n('secs','Seconds',t.secs)+n('rest','Rest s',t.rest)
      :n('sets','Sets',t.sets)+n('reps','Reps',t.reps)+(ex.kind==='w'?n('wt',wU(),t.wt!=null&&t.wt!==''?wDisp(t.wt):'',0.5):'')+n('rest','Rest s',t.rest);
    return `<div class="redit"><div class="spread"><b>${esc(ex.name)}</b><span><button class="btn ghost sm" data-act="rmove" data-i="${i}" data-d="-1" aria-label="Move up">↑</button><button class="btn ghost sm" data-act="rmove" data-i="${i}" data-d="1" aria-label="Move down">↓</button><button class="x" data-act="rrm" data-i="${i}" aria-label="Remove">×</button></span></div><div class="row">${fields}</div></div>`}).join('')||'<p class="faint">Add exercises to build your routine.</p>'}</div>
  <div class="row" style="margin-top:12px"><button class="btn" data-act="radd">+ Add exercise</button></div>
  <div class="row" style="justify-content:flex-end;margin-top:14px">${M.isNew?'':'<button class="btn ghost" data-act="delroutine">Delete</button>'}<button class="btn primary" data-act="saveroutine">Save routine</button></div></div>`;
}
function pickerBody(){
  if(M.howto)return howtoBody(true);loadFx();
  return `<div class="sheet-h"><button class="btn ghost sm" data-act="pickback" style="white-space:nowrap">‹ Back</button><h3 style="margin-left:4px">Add exercise</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <input id="pq" class="inp" placeholder="Search ${FX.loaded?exList().length+' ':''}exercises" value="${esc(M.pq||'')}" autofocus autocomplete="off">
  <div class="row" style="margin-top:8px"><select id="pg" class="inp" style="flex:1;min-width:0"><option value="">All muscle groups</option>${GROUPS.map(g=>`<option ${M.pg===g?'selected':''}>${g}</option>`).join('')}</select><select id="pe" class="inp" style="flex:1;min-width:0">${EQ_FILTERS.map(([v,l])=>`<option value="${v}" ${(M.pe||'')===v?'selected':''}>${l}</option>`).join('')}</select></div>
  <div class="results" id="pres">${pickResults()}</div>
  <details style="margin-top:12px"><summary>Create a custom exercise</summary><div class="row" style="margin-top:8px"><input id="cx-name" class="inp" placeholder="Name" style="flex:1;min-width:160px"><select id="cx-kind" class="inp" style="width:auto"><option value="w">Weight × reps</option><option value="bw">Bodyweight reps</option><option value="t">Timed hold</option><option value="c">Cardio (time + distance)</option></select><button class="btn" data-act="cxsave">Create</button></div></details></div>`;
}
function pickList(groups){const ks=Object.keys(groups);if(!ks.length)return '<div class="empty" style="border:0">No match — create it below.</div>';return ks.map(g=>`<div class="group">${esc(g)}</div>`+groups[g].map(e=>{const row=fxRow(e.id);return `<div class="resrow"><button class="res" data-act="pickex" data-id="${esc(e.id)}"><span class="t"><div class="nm">${esc(e.name)}</div><div class="sub">${({w:'Weight × reps',bw:'Bodyweight',t:'Timed',c:'Cardio'})[e.kind]}${row&&row.eq&&row.eq!=='other'&&row.eq!=='body only'?' · '+esc(row.eq):''}</div></span></button>${row?`<button class="hxi" data-act="howto" data-id="${esc(e.id)}" aria-label="How to do ${esc(e.name)}">ⓘ</button>`:''}</div>`}).join('')).join('')}
function readRoutineInputs(){if(!M||!M.r)return;const n=$('#r-name');if(n)M.r.name=n.value;
  document.querySelectorAll('[data-rk]').forEach(el=>{const t=M.r.items[+el.dataset.ri],k=el.dataset.rk,v=parseFloat(el.value);t[k]=isNaN(v)?'':(k==='wt'?r2(wIn(v)):k==='dist'?r2(dIn(v)):v)});
  document.querySelectorAll('[data-ik]').forEach(el=>{const v=parseFloat(el.value);M.r.int[el.dataset.ik]=isNaN(v)?0:Math.max(0,Math.round(v))})}
function saveRoutine(){readRoutineInputs();readRound();const r=M.r;if(!r.name.trim()){toast('Give the routine a name');return}
  if(r.kind!=='int'&&!r.items.length){toast('Add at least one exercise');return}
  if(r.kind==='int'&&(!r.int.work||!r.int.rounds)){toast('Set work time and rounds');return}
  const used=new Set((r.items||[]).map(t=>t.ex)),tmp=(S.tmpEx||[]).filter(e=>used.has(e.id));if(tmp.length){const xd=get('exercises')||{list:[]};xd.list=(xd.list||[]).concat(tmp);put('exercises',xd);S.tmpEx=(S.tmpEx||[]).filter(e=>!used.has(e.id))}
  const doc=get('routines')||{list:[]};doc.list=doc.list||[];const i=doc.list.findIndex(x=>x.id===r.id);if(i>=0)doc.list[i]=r;else doc.list.push(r);
  closeModal();put('routines',doc);toast('Routine saved')}

const WACT={
  wtab:el=>{S.wtab=el.dataset.t;render()},
  newroutine:()=>openModal({kind:'routine',isNew:true,r:{id:'r'+newId(),name:'',kind:'std',items:[]}}),
  newint:()=>openModal({kind:'routine',isNew:true,r:{id:'r'+newId(),name:'Intervals',kind:'int',int:{warm:120,work:40,rest:20,rounds:8,cool:120}}}),
  editroutine:el=>{const r=routines().find(x=>x.id===el.dataset.id);if(r)openModal({kind:r.int&&r.int.style==='round'?'round':'routine',r:clone(r)})},
  newround:()=>openModal({kind:'round',isNew:true,r:{id:'r'+newId(),name:'Boxing',kind:'int',int:{style:'round',warm:10,work:180,rest:60,rounds:12,warn:10,cool:0}}}),
  rpreset:el=>{readRound();const pr=ROUND_PRESETS.find(x=>x[0]===el.dataset.n);if(!pr)return;M.r.name=pr[0];Object.assign(M.r.int,pr[1]);drawModal(false)},
  rcstart:()=>{readRound();const r=clone(M.r);closeModal();startWorkout(r);if(!S.ws||S.ws.routineId!==r.id)return;S.ws.paused=false;S.ws.phaseStart=Date.now();bell(1);keepAwake(true);saveWs();render()},
  startroutine:el=>{const r=routines().find(x=>x.id===el.dataset.id);if(r)startWorkout(r)},
  startempty:()=>startWorkout(null),
  radd:()=>{readRoutineInputs();M.pick='routine';M.pq='';drawModal()},
  rrm:el=>{readRoutineInputs();M.r.items.splice(+el.dataset.i,1);drawModal(false)},
  rmove:el=>{readRoutineInputs();const i=+el.dataset.i,j=i+ +el.dataset.d,a=M.r.items;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];drawModal(false)},
  saveroutine:saveRoutine,
  delroutine:()=>{const doc=get('routines')||{list:[]};doc.list=(doc.list||[]).filter(x=>x.id!==M.r.id);closeModal();put('routines',doc);toast('Routine deleted')},
  pickback:()=>{if(M.kind==='pick'){closeModal();return}M.pick=null;drawModal()},
  pickex:el=>{const ex=exById(el.dataset.id);
    if(M.kind==='pick'){const prev=lastSets(ex.id);const n=ex.kind==='c'?1:3;const sets=[];for(let i=0;i<n;i++){const ps=prev&&prev[Math.min(i,prev.length-1)];sets.push(newSet(ex,{reps:ps&&ps.r,wt:ps&&ps.w,secs:ps&&ps.t}))}S.ws.items.push({ex:ex.id,rest:90,sets});saveWs();closeModal();render();return}
    M.r.items.push(ex.kind==='c'?{ex:ex.id,min:30,dist:''}:ex.kind==='t'?{ex:ex.id,sets:3,secs:45,rest:60}:{ex:ex.id,sets:3,reps:10,wt:'',rest:90});M.pick=null;drawModal()},
  cxsave:()=>{const name=$('#cx-name').value.trim();if(!name){toast('Name the exercise');return}const e={id:'x'+newId(),name:name.slice(0,60),group:'Custom',kind:$('#cx-kind').value,met:$('#cx-kind').value==='c'?7:null};const doc=get('exercises')||{list:[]};doc.list=(doc.list||[]).concat([e]);put('exercises',doc);const b=document.createElement('button');b.dataset.id=e.id;WACT.pickex(b)},
  wsaddex:()=>openModal({kind:'pick',pick:'session',pq:''}),
  wsrmex:el=>{S.ws.items.splice(+el.dataset.i,1);saveWs();render()},
  wsmove:el=>{const i=+el.dataset.i,j=i+ +el.dataset.d,a=S.ws.items;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];saveWs();render()},
  wsaddset:el=>{const it=S.ws.items[+el.dataset.i];const last=it.sets[it.sets.length-1]||{};it.sets.push(Object.assign({},last,{done:false}));saveWs();render()},
  wsrmset:el=>{const it=S.ws.items[+el.dataset.i];it.sets.pop();saveWs();render()},
  wsdone:el=>{const it=S.ws.items[+el.dataset.i],st=it.sets[+el.dataset.s],ex=exById(it.ex);
    if(!st.done){const ok=ex.kind==='w'?(+st.r>0):ex.kind==='bw'?(+st.r>0):ex.kind==='t'?(+st.t>0):(+st.t>0||+st.d>0);
      if(!ok){const ps=(lastSets(it.ex)||[])[+el.dataset.s];if(ps){Object.assign(st,{r:ps.r,w:ps.w,t:ps.t,d:ps.d})}else{toast(ex.kind==='c'?'Enter time or distance first':ex.kind==='t'?'Enter seconds first':'Enter reps first');return}}}
    st.done=!st.done;saveWs();
    if(st.done&&ex.kind!=='c'){S.rest={end:Date.now()+it.rest*1000};beep(1,.01)}
    render()},
  restadj:el=>{if(S.rest){S.rest.end+=(+el.dataset.n)*1000;const l=$('#rest-left');if(l)l.textContent=mmss((S.rest.end-Date.now())/1000)}},
  restskip:()=>{S.rest=null;render()},
  wsfinish:()=>{if(S.ws.kind!=='int'&&!S.ws.items.some(it=>it.sets.some(s=>s.done))){toast('Tick off at least one set (✓) before finishing');return}finishWorkout()},
  wsdiscard:()=>{if(!confirmReplace())return;if(tgIn())tgEnd('left');S.ws=null;S.rest=null;saveWs();render();toast('Workout discarded')},
  intpause:()=>{if(tgIn()&&!tgHost())return;const w=S.ws;beep(1,.01);if(w.paused){const first=!w.phaseStart&&!w.elapsedPhase;w.paused=false;w.phaseStart=Date.now();keepAwake(true);if(first&&w.int.style==='round'&&!+w.int.warm)bell(1)}else{w.elapsedPhase=curPhaseElapsed();w.paused=true;keepAwake(false)}saveWs();tgClock();render()},
  intskip:()=>{if(tgIn()&&!tgHost())return;const w=S.ws;w.step++;w.elapsedPhase=0;w.phaseStart=Date.now();saveWs();tgClock();render()},
  saveasroutine:el=>{const w=allWorkouts().find(x=>x.id===el.dataset.id);if(!w)return;const r=w.int?{id:'r'+newId(),name:w.name,kind:'int',int:Object.assign({},w.int)}:{id:'r'+newId(),name:w.name,kind:'std',items:w.items.map(it=>{const ex=exById(it.ex),s=it.sets[0]||{};return ex.kind==='c'?{ex:it.ex,min:s.t?Math.round(s.t/60):30,dist:s.d||''}:ex.kind==='t'?{ex:it.ex,sets:it.sets.length,secs:s.t,rest:60}:{ex:it.ex,sets:it.sets.length,reps:s.r,wt:s.w,rest:90}})};
    if(M)closeModal();openModal({kind:'routine',isNew:true,r})},
  delworkout:el=>{const k=wkKey(el.dataset.date),doc=get(k);if(!doc)return;doc.list=doc.list.filter(w=>w.id!==el.dataset.id);put(k,doc);
    const d=day(el.dataset.date);const before=d.ex.length;d.ex=d.ex.filter(e=>e.wid!==el.dataset.id);if(d.ex.length!==before)put(dk(el.dataset.date),d);toast('Workout deleted')}
};

/* ================= SOCIAL ================= */
const SOC={loaded:false,loading:false,me:null,people:{},friends:[],stats:{},invitesIn:[],invitesOut:[],feed:[],reactions:{},convs:[],thread:null,msgs:[],challenges:[],board:{},err:null};
const REACTS=['👏','🔥','💪','🎉','❤️'];
const pname=id=>{const p=SOC.people[id];return p?p.display_name:'Someone'};
const pemoji=id=>{const p=SOC.people[id];return p?p.avatar_emoji:'🙂'};
const ago=t=>{const s=(Date.now()-new Date(t))/1000;if(s<60)return 'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';if(s<604800)return Math.floor(s/86400)+'d';return new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
async function q(p){const {data,error}=await p;if(error)throw error;return data}
async function loadPeople(ids){ids=[...new Set(ids)].filter(id=>id&&!SOC.people[id]);if(!ids.length)return;for(const p of await q(sb.from('profiles').select('id,display_name,avatar_emoji').in('id',ids)))SOC.people[p.id]=p}
async function loadSocial(){
  if(SOC.loading||!S.uid)return;SOC.loading=true;SOC.err=null;
  try{
    const me=await q(sb.from('profiles').select('id,display_name,avatar_emoji').eq('id',S.uid).maybeSingle());if(me){SOC.me=me;SOC.people[me.id]=me}
    const fr=await q(sb.from('friendships').select('user_a,user_b,created_at'));
    SOC.friends=fr.map(f=>f.user_a===S.uid?f.user_b:f.user_a);
    const inv=await q(sb.from('invites').select('*').order('created_at',{ascending:false}));
    SOC.invitesIn=inv.filter(i=>i.inviter_id!==S.uid&&i.status==='pending');SOC.invitesOut=inv.filter(i=>i.inviter_id===S.uid&&i.status!=='revoked');
    await loadPeople(SOC.friends.concat(SOC.invitesIn.map(i=>i.inviter_id)));
    for(const st of await q(sb.from('shared_stats').select('*')))SOC.stats[st.user_id]=st;
    SOC.feed=await q(sb.from('achievements').select('*').order('created_at',{ascending:false}).limit(60));
    await loadPeople(SOC.feed.map(a=>a.user_id));
    await loadReactions(SOC.feed.map(a=>a.id));
    await loadConvs();
    await loadChallenges();
    SOC.loaded=true;
  }catch(e){SOC.err=e.message||String(e)}
  SOC.loading=false;if(S.view==='social')render();
}
async function loadReactions(ids){if(!ids.length)return;for(const id of ids)SOC.reactions[id]=[];for(const r of await q(sb.from('reactions').select('*').in('achievement_id',ids)))(SOC.reactions[r.achievement_id]=SOC.reactions[r.achievement_id]||[]).push(r)}
async function loadConvs(){
  const mem=await q(sb.from('conversation_members').select('conversation_id,last_read_at').eq('user_id',S.uid));
  if(!mem.length){SOC.convs=[];return}
  const ids=mem.map(m=>m.conversation_id);
  const convs=await q(sb.from('conversations').select('*').in('id',ids).order('last_message_at',{ascending:false}));
  const members=await q(sb.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids));
  await loadPeople(members.map(m=>m.user_id));
  const last=await Promise.all(convs.map(c=>q(sb.from('messages').select('body,sender_id,created_at').eq('conversation_id',c.id).order('created_at',{ascending:false}).limit(1))));
  SOC.convs=convs.map((c,i)=>{const lr=mem.find(m=>m.conversation_id===c.id).last_read_at;const lm=last[i][0];return Object.assign(c,{members:members.filter(m=>m.conversation_id===c.id).map(m=>m.user_id),last:lm,unread:lm&&lm.sender_id!==S.uid&&new Date(lm.created_at)>new Date(lr)})});
}
async function loadChallenges(){
  const mine=await q(sb.from('challenge_participants').select('challenge_id,status').eq('user_id',S.uid));
  if(!mine.length){SOC.challenges=[];return}
  const ids=mine.map(m=>m.challenge_id);
  const chs=await q(sb.from('challenges').select('*').in('id',ids).order('end_date',{ascending:false}));
  const parts=await q(sb.from('challenge_participants').select('*').in('challenge_id',ids));
  await loadPeople(parts.map(p=>p.user_id));
  SOC.challenges=chs.map(c=>Object.assign(c,{myStatus:mine.find(m=>m.challenge_id===c.id).status,parts:parts.filter(p=>p.challenge_id===c.id).sort((a,b)=>b.score-a.score)}));
  syncChallengeScores();
}
function convTitle(c){if(c.title)return c.title;const o=c.members.filter(id=>id!==S.uid);return o.map(pname).join(', ')||'Just you'}
const unreadCount=()=>SOC.convs.filter(c=>c.unread).length;

function vSocial(){
  if(!SOC.loaded&&!SOC.loading)loadSocial();
  if(SOC.thread)return vThread();
  const tab=S.stab||'feed';const u=unreadCount();
  let h=`<div class="datebar"><h2>Friends</h2><div class="seg-ctl" role="group">${[['feed','Feed'],['chat','Chat'+(u?` (${u})`:'')],['friends','People'],['challenges','Challenges']].map(([k,l])=>`<button class="${tab===k?'on':''}" data-act="stab" data-t="${k}">${l}</button>`).join('')}</div></div>`;
  if(SOC.err)h+=`<div class="notice warn" style="margin-bottom:12px">Couldn’t load: ${esc(SOC.err)} <button class="btn sm" data-act="socreload">Retry</button></div>`;
  if(!SOC.loaded)return h+`<div class="card"><span class="spin"></span> Loading…</div>`;
  if(tab==='feed')h+=vFeed();else if(tab==='chat')h+=vChats();else if(tab==='friends')h+=vPeople();else h+=vChallenges();
  return h;
}
function vFeed(){
  if(!SOC.feed.length)return `<section class="card"><p class="faint" style="margin:0">Nothing here yet. Personal records and streaks from you and your friends show up here.${SOC.friends.length?'':' Invite friends under <b>People</b>.'}</p></section>`;
  return `<section class="card" style="padding:0">${SOC.feed.map(a=>{const rs=SOC.reactions[a.id]||[];
    const counts=REACTS.map(e=>[e,rs.filter(r=>r.emoji===e).length,rs.some(r=>r.emoji===e&&r.user_id===S.uid)]);
    return `<div class="feedi"><div class="av">${esc(pemoji(a.user_id))}</div><div class="t"><div><b>${a.user_id===S.uid?'You':esc(pname(a.user_id))}</b> <span class="faint">· ${ago(a.created_at)}${a.visibility==='private'?' · only you':''}</span></div>
    <div class="ach">${esc(a.title)}</div>
    <div class="rx">${counts.map(([e,n,mine])=>`<button class="rxb ${mine?'on':''}" data-act="react" data-id="${a.id}" data-e="${e}" aria-label="React ${e}">${e}${n?` <span>${n}</span>`:''}</button>`).join('')}${a.user_id===S.uid?`<button class="btn ghost sm" data-act="delach" data-id="${a.id}" style="margin-left:auto">Remove</button>`:''}</div></div></div>`}).join('')}</section>`;
}
function vChats(){
  let h=`<div class="row" style="margin-bottom:12px"><button class="btn primary" data-act="newchat" ${SOC.friends.length?'':'disabled'}>+ New chat</button>${SOC.friends.length?'':'<span class="faint">Add friends to start chatting.</span>'}</div>`;
  if(!SOC.convs.length)return h+`<section class="card"><p class="faint" style="margin:0">No conversations yet.</p></section>`;
  return h+`<section class="card" style="padding:0">${SOC.convs.map(c=>`<button class="res convr" data-act="openconv" data-id="${c.id}"><div class="av">${c.is_group?'👥':esc(pemoji(c.members.find(x=>x!==S.uid)))}</div><span class="t"><div class="nm">${esc(convTitle(c))}${c.unread?' <span class="dot"></span>':''}</div><div class="sub">${c.last?esc((c.last.sender_id===S.uid?'You: ':'')+c.last.body).slice(0,80):'No messages yet'}</div></span><span class="faint">${c.last?ago(c.last.created_at):''}</span></button>`).join('')}</section>`;
}
function vThread(){
  const c=SOC.thread;
  return `<div class="datebar"><button class="btn ghost" data-act="closeconv">‹ Back</button><h2 style="font-size:22px">${esc(convTitle(c))}</h2></div>
  <section class="card thread"><div class="msgs" id="msgs">${SOC.msgs.length?SOC.msgs.map(m=>`<div class="msg ${m.sender_id===S.uid?'me':''}">${m.sender_id!==S.uid&&c.is_group?`<div class="who">${esc(pname(m.sender_id))}</div>`:''}${m.routine?routineCard(m):`<div class="bub">${esc(m.body)}</div>`}<div class="when">${ago(m.created_at)}</div></div>`).join(''):'<p class="faint">Say hi 👋</p>'}</div>
  <form class="row sendrow" onsubmit="return false"><input id="msg-in" class="inp" placeholder="Message" autocomplete="off" maxlength="4000" style="flex:1"><button class="btn primary" data-act="sendmsg">Send</button></form></section>`;
}
function statLine(st){if(!st||!st.stats)return '';const s=st.stats,out=[];
  if(st.share_workouts&&s.workouts_week!=null)out.push(`${s.workouts_week} workout${s.workouts_week===1?'':'s'} this week`);
  if(st.share_workouts&&s.streak_weeks)out.push(`${s.streak_weeks}-week streak`);
  if(st.share_nutrition&&s.logging_streak)out.push(`${s.logging_streak}-day logging streak`);
  if(st.share_weight&&s.weight_change_30d!=null)out.push(`${s.weight_change_30d>0?'+':''}${s.weight_change_30d} ${s.weight_unit||'kg'} in 30 days`);
  return out.join(' · ')}
function vPeople(){
  const me=SOC.me||{display_name:'',avatar_emoji:'🙂'};
  let h=`<div class="grid"><div class="stack"><section class="card"><h3 style="font-size:18px">Invite a friend</h3><p class="faint" style="margin:6px 0 10px">They’ll get an email to join Tally. If they already use Tally, the invite shows up in their app.</p>
    <form class="row" onsubmit="return false"><input id="inv-email" class="inp" type="email" placeholder="friend@email.com" style="flex:1;min-width:180px"><button class="btn primary" data-act="sendinvite">Send invite</button></form></section>`;
  if(SOC.invitesIn.length)h+=`<section class="card setup"><h3 style="font-size:18px">Invites for you</h3>${SOC.invitesIn.map(i=>`<div class="rrow"><div class="av">${esc(pemoji(i.inviter_id))}</div><div class="t"><div class="nm">${esc(pname(i.inviter_id))}</div><div class="sub">wants to be friends</div></div><button class="btn sm" data-act="invresp" data-id="${i.id}" data-a="0">Decline</button><button class="btn sm primary" data-act="invresp" data-id="${i.id}" data-a="1">Accept</button></div>`).join('')}</section>`;
  h+=`<section class="card" style="padding-bottom:6px"><div class="spread"><h3 style="font-size:18px">Friends</h3><span class="faint">${SOC.friends.length}</span></div>${SOC.friends.length?`<div class="rlist">${SOC.friends.map(id=>`<div class="rrow"><div class="av">${esc(pemoji(id))}</div><div class="t"><div class="nm">${esc(pname(id))}</div><div class="sub">${esc(statLine(SOC.stats[id]))||'No shared stats'}</div></div><button class="btn sm" data-act="dmfriend" data-id="${id}">Message</button><button class="btn ghost sm" data-act="unfriend" data-id="${id}">Remove</button></div>`).join('')}</div>`:'<p class="faint">No friends yet — send an invite.</p>'}</section>`;
  const outP=SOC.invitesOut.filter(i=>i.status==='pending');
  if(outP.length)h+=`<section class="card"><h3 style="font-size:16px">Waiting to join</h3><div class="rlist">${outP.map(i=>`<div class="rrow"><div class="t"><div class="nm">${esc(i.email)}</div><div class="sub">invited ${ago(i.created_at)}</div></div><button class="btn ghost sm" data-act="revokeinv" data-id="${i.id}">Cancel</button></div>`).join('')}</div></section>`;
  const sh=get('sharing')||{};const on=k=>sh[k]!==false&&(k!=='weight'&&k!=='nutrition'||sh[k]===true);
  h+=`</div><div class="stack"><section class="card"><h3 style="font-size:18px">You</h3><div class="row" style="margin-top:10px"><input id="me-emoji" class="inp" value="${esc(me.avatar_emoji)}" maxlength="4" style="width:60px;text-align:center;font-size:20px" aria-label="Emoji"><input id="me-name" class="inp" value="${esc(me.display_name)}" maxlength="40" style="flex:1" aria-label="Display name"><button class="btn" data-act="savename">Save</button></div></section>
  <section class="card"><h3 style="font-size:18px">What friends can see</h3><p class="faint" style="margin:6px 0 10px">Never your food diary. Only what you switch on here.</p>
  ${[['achievements','Post personal records and streaks to the feed'],['workouts','Workouts this week and weekly streak'],['nutrition','Food logging streak'],['weight','Weight change over 30 days (not your weight)']].map(([k,l])=>`<label class="chkrow"><input type="checkbox" class="sharetog" data-k="${k}" ${on(k)?'checked':''}> ${l}</label>`).join('')}</section></div></div>`;
  return h;
}
const METRICS={workouts:'Most workouts',workout_days:'Most days with a workout',active_minutes:'Most active minutes',logging_days:'Most days with food logged'};
function vChallenges(){
  let h=`<div class="row" style="margin-bottom:12px"><button class="btn primary" data-act="newchal" ${SOC.friends.length?'':'disabled'}>+ New challenge</button>${SOC.friends.length?'':'<span class="faint">Add friends to start a challenge.</span>'}</div>`;
  if(!SOC.challenges.length)return h+`<section class="card"><p class="faint" style="margin:0">No challenges yet. Start one — like “Most workouts in November”.</p></section>`;
  const td=today();
  return h+SOC.challenges.map(c=>{const live=c.start_date<=td&&td<=c.end_date,done=td>c.end_date;
    return `<section class="card" style="margin-bottom:14px"><div class="spread"><div><h3 style="font-size:18px">${esc(c.title)}</h3><div class="faint">${esc(METRICS[c.metric])} · ${esc(nice(c.start_date,{month:'short',day:'numeric'}))} – ${esc(nice(c.end_date,{month:'short',day:'numeric'}))} · ${done?'Finished':live?'Live':'Starts soon'}</div></div>
    ${c.myStatus==='invited'?`<span class="row"><button class="btn sm" data-act="chalresp" data-id="${c.id}" data-s="left">Decline</button><button class="btn sm primary" data-act="chalresp" data-id="${c.id}" data-s="joined">Join</button></span>`:''}</div>
    <div class="rlist">${c.parts.filter(p=>p.status!=='left').map((p,i)=>`<div class="rrow"><b style="width:22px">${p.status==='joined'?i+1:''}</b><div class="av">${esc(pemoji(p.user_id))}</div><div class="t"><div class="nm">${p.user_id===S.uid?'You':esc(pname(p.user_id))}${done&&i===0&&p.score>0?' 🏆':''}</div><div class="sub">${p.status==='invited'?'invited':''}</div></div><b>${Math.round(p.score)}</b></div>`).join('')}</div></section>`}).join('');
}
function newChatBody(){return `<div class="sheet-h"><h3>New chat</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <div class="rlist">${SOC.friends.map(id=>`<label class="rrow" style="cursor:pointer"><input type="checkbox" class="pickf" value="${id}"><div class="av">${esc(pemoji(id))}</div><div class="t"><div class="nm">${esc(pname(id))}</div></div></label>`).join('')}</div>
  <label class="field" style="margin-top:12px">Group name (optional)<input id="grp-title" class="inp" maxlength="60" placeholder="e.g. Gym crew"></label>
  <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" data-act="createchat">Start chat</button></div></div>`}
function newChalBody(){const s=today(),e=addDays(s,29);return `<div class="sheet-h"><h3>New challenge</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <label class="field">Name<input id="ch-title" class="inp" maxlength="80" placeholder="e.g. November workout showdown"></label>
  <label class="field" style="margin-top:10px">Goal<select id="ch-metric" class="inp">${Object.entries(METRICS).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label>
  <div class="fgrid" style="margin-top:10px"><label class="field">Starts<input id="ch-s" type="date" class="inp" value="${s}"></label><label class="field">Ends<input id="ch-e" type="date" class="inp" value="${e}"></label></div>
  <h3 class="minih">Invite friends</h3><div class="rlist">${SOC.friends.map(id=>`<label class="rrow" style="cursor:pointer"><input type="checkbox" class="pickf" value="${id}" checked><div class="av">${esc(pemoji(id))}</div><div class="t"><div class="nm">${esc(pname(id))}</div></div></label>`).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" data-act="createchal">Create challenge</button></div></div>`}

/* scores, shared stats and achievements are computed from your own data on this device */
function challengeScore(metric,s,e){
  let n=0;
  if(metric==='workouts'||metric==='workout_days'){const ws=allWorkouts().filter(w=>w.date>=s&&w.date<=e);n=metric==='workouts'?ws.length:new Set(ws.map(w=>w.date)).size}
  else for(let d=s;d<=e&&d<=today();d=addDays(d,1)){const x=S.docs[dk(d)];if(!x)continue;if(metric==='logging_days'&&(x.foods||[]).length)n++;if(metric==='active_minutes')n+=(x.ex||[]).reduce((a,y)=>a+(+y.min||0),0)}
  return Math.round(n);
}
let scoreT=null;
function syncChallengeScores(){clearTimeout(scoreT);scoreT=setTimeout(async()=>{
  for(const c of SOC.challenges){if(c.myStatus!=='joined')continue;const sc=challengeScore(c.metric,c.start_date,c.end_date);const mine=c.parts.find(p=>p.user_id===S.uid);
    if(mine&&mine.score!==sc){const {error}=await sb.from('challenge_participants').update({score:sc,updated_at:new Date().toISOString()}).eq('challenge_id',c.id).eq('user_id',S.uid);if(!error){mine.score=sc;c.parts.sort((a,b)=>b.score-a.score)}}}
  if(S.view==='social'&&!SOC.thread)render();},1500)}
let statsT=null,lastStats='';
function syncSharedStats(){clearTimeout(statsT);statsT=setTimeout(async()=>{
  if(!S.uid)return;const sh=get('sharing')||{};const ws=allWorkouts();const mon=addDays(today(),-((new Date(today()+'T12:00').getDay()+6)%7));
  const stats={workouts_week:ws.filter(w=>w.date>=mon).length,streak_weeks:weekStreak(ws)};
  let ls=0;for(let d=today();;d=addDays(d,-1)){const x=S.docs[dk(d)];if(x&&(x.foods||[]).length)ls++;else if(d!==today())break;if(ls>400)break}stats.logging_streak=ls;
  const w=weights(),ds=Object.keys(w).sort();if(ds.length>1){const cut=addDays(today(),-30);const base=ds.filter(d=>d>=cut)[0];if(base&&base!==ds[ds.length-1])stats.weight_change_30d=Math.round((wOut(w[ds[ds.length-1]])-wOut(w[base]))*10)/10;stats.weight_unit=wU()}
  const row={user_id:S.uid,share_workouts:sh.workouts!==false,share_nutrition:sh.nutrition===true,share_weight:sh.weight===true,stats:{}};
  if(row.share_workouts){row.stats.workouts_week=stats.workouts_week;row.stats.streak_weeks=stats.streak_weeks}
  if(row.share_nutrition)row.stats.logging_streak=stats.logging_streak;
  if(row.share_weight&&stats.weight_change_30d!=null){row.stats.weight_change_30d=stats.weight_change_30d;row.stats.weight_unit=stats.weight_unit}
  const sig=JSON.stringify(row);if(sig===lastStats)return;lastStats=sig;
  await sb.from('shared_stats').upsert(Object.assign(row,{updated_at:new Date().toISOString()}));
},4000)}
async function postAchievements(rec){
  const sh=get('sharing')||{};if(sh.achievements===false||!S.uid)return;
  const rows=(rec.prs||[]).map(x=>({kind:'pr',title:`🏅 New ${exById(x.ex).name.toLowerCase()} record — ${prText(x)}`,detail:{ex:x.ex,val:x.val}}));
  const streak=weekStreak(allWorkouts());const marks=[2,4,8,12,16,26,52];
  if(marks.includes(streak)&&!(get('posted')||{})['streak'+streak+'-'+rec.date.slice(0,4)]){rows.push({kind:'streak',title:`🔥 ${streak}-week workout streak`,detail:{weeks:streak}});const p=get('posted')||{};p['streak'+streak+'-'+rec.date.slice(0,4)]=1;put('posted',p)}
  if(rows.length){const {error}=await sb.from('achievements').insert(rows.map(r=>Object.assign(r,{user_id:S.uid})));if(!error&&SOC.loaded){SOC.loaded=false;}}
}

let rtChannel=null;
function socialRealtime(){
  if(rtChannel)sb.removeChannel(rtChannel);
  rtChannel=tgRealtime(sb.channel('social-'+S.uid)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},async p=>{const m=p.new;
      if(SOC.thread&&m.conversation_id===SOC.thread.id){if(!SOC.msgs.some(x=>x.id===m.id))SOC.msgs.push(m);markRead(m.conversation_id);if(S.view==='social')renderThreadMsgs();}
      else{const c=SOC.convs.find(x=>x.id===m.conversation_id);if(c){c.last=m;c.unread=m.sender_id!==S.uid;SOC.convs.sort((a,b)=>new Date(b.last?b.last.created_at:b.created_at)-new Date(a.last?a.last.created_at:a.created_at))}else if(SOC.loaded)await loadConvs();
        if(m.sender_id!==S.uid)toast('💬 '+pname(m.sender_id)+': '+m.body.slice(0,60));updateBadge();if(S.view==='social')render()}})
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'achievements'},async p=>{if(!SOC.loaded)return;await loadPeople([p.new.user_id]);if(!SOC.feed.some(a=>a.id===p.new.id))SOC.feed.unshift(p.new);SOC.reactions[p.new.id]=[];if(S.view==='social')render()})
    .on('postgres_changes',{event:'*',schema:'public',table:'reactions'},p=>{const r=p.new&&p.new.achievement_id?p.new:p.old;if(!r||!SOC.reactions[r.achievement_id])return;
      if(p.eventType==='INSERT'){if(!SOC.reactions[r.achievement_id].some(x=>x.user_id===r.user_id&&x.emoji===r.emoji))SOC.reactions[r.achievement_id].push(r)}else loadReactions([r.achievement_id]).then(()=>{if(S.view==='social')render()});if(S.view==='social')render()})
    ).subscribe();
}
function updateBadge(){const a=document.querySelector('nav a[data-v="social"]');if(a)a.dataset.badge=unreadCount()||''}
async function markRead(cid){await sb.from('conversation_members').update({last_read_at:new Date().toISOString()}).eq('conversation_id',cid).eq('user_id',S.uid);const c=SOC.convs.find(x=>x.id===cid);if(c)c.unread=false;updateBadge()}
function renderThreadMsgs(){const el=$('#msgs');if(!el){render();return}const v=document.getElementById('msg-in');const val=v?v.value:'';S._force=true;try{render()}finally{S._force=false}const nv=document.getElementById('msg-in');if(nv){nv.value=val;nv.focus()}scrollMsgs()}
function scrollMsgs(){const el=$('#msgs');if(el)el.scrollTop=el.scrollHeight}
async function openConv(id){const c=SOC.convs.find(x=>x.id===id)||(await loadConvs(),SOC.convs.find(x=>x.id===id));if(!c)return;SOC.thread=c;SOC.msgs=[];render();
  SOC.msgs=(await q(sb.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:false}).limit(100))).reverse();render();scrollMsgs();markRead(id);const i=$('#msg-in');if(i)i.focus()}

const SACT={
  stab:el=>{S.stab=el.dataset.t;render()},
  socreload:()=>{SOC.loaded=false;loadSocial()},
  react:async el=>{const id=el.dataset.id,e=el.dataset.e,rs=SOC.reactions[id]=SOC.reactions[id]||[];const mine=rs.find(r=>r.user_id===S.uid&&r.emoji===e);
    if(mine){SOC.reactions[id]=rs.filter(r=>r!==mine);render();await sb.from('reactions').delete().eq('achievement_id',id).eq('user_id',S.uid).eq('emoji',e)}
    else{rs.push({achievement_id:id,user_id:S.uid,emoji:e});render();const {error}=await sb.from('reactions').insert({achievement_id:id,user_id:S.uid,emoji:e});if(error)toast('Couldn’t react')}},
  delach:async el=>{await sb.from('achievements').delete().eq('id',el.dataset.id);SOC.feed=SOC.feed.filter(a=>a.id!==el.dataset.id);render()},
  newchat:()=>openModal({kind:'newchat'}),
  createchat:async()=>{const ids=[...document.querySelectorAll('.pickf:checked')].map(x=>x.value);if(!ids.length){toast('Pick at least one friend');return}
    const t=$('#grp-title').value.trim()||null;const {data,error}=await sb.rpc('start_conversation',{member_ids:ids,group_title:t});if(error){toast(error.message);return}closeModal();await loadConvs();openConv(data)},
  dmfriend:async el=>{const {data,error}=await sb.rpc('start_conversation',{member_ids:[el.dataset.id],group_title:null});if(error){toast(error.message);return}S.stab='chat';await loadConvs();openConv(data)},
  openconv:el=>openConv(el.dataset.id),
  closeconv:()=>{SOC.thread=null;SOC.msgs=[];render()},
  sendmsg:async()=>{const i=$('#msg-in'),body=i.value.trim();if(!body||!SOC.thread)return;i.value='';
    const {data,error}=await sb.from('messages').insert({conversation_id:SOC.thread.id,sender_id:S.uid,body}).select().single();
    if(error){toast('Message not sent');i.value=body;return}if(!SOC.msgs.some(m=>m.id===data.id))SOC.msgs.push(data);renderThreadMsgs()},
  sendinvite:async el=>{const inp=$('#inv-email'),email=inp.value.trim();if(!email){toast('Enter an email');return}el.disabled=true;
    const {data,error}=await sb.functions.invoke('send-invite',{body:{email}});el.disabled=false;
    if(error){let msg='Couldn’t send the invite';try{msg=(await error.context.json()).error||msg}catch(e){}toast(msg);return}
    inp.value='';toast(data.emailed?'Invite emailed to '+email:email+' already uses Tally — they’ll see your invite in the app');SOC.loaded=false;loadSocial()},
  invresp:async el=>{const {error}=await sb.rpc('respond_to_invite',{invite_id:el.dataset.id,accept:el.dataset.a==='1'});if(error){toast(error.message);return}toast(el.dataset.a==='1'?'You’re now friends':'Invite declined');SOC.loaded=false;loadSocial()},
  revokeinv:async el=>{await sb.from('invites').update({status:'revoked'}).eq('id',el.dataset.id);SOC.invitesOut=SOC.invitesOut.filter(i=>i.id!==el.dataset.id);render()},
  unfriend:async el=>{if(!confirmReplace())return;const a=el.dataset.id<S.uid?el.dataset.id:S.uid,b=el.dataset.id<S.uid?S.uid:el.dataset.id;await sb.from('friendships').delete().eq('user_a',a).eq('user_b',b);toast('Removed');SOC.loaded=false;loadSocial()},
  savename:async()=>{const n=$('#me-name').value.trim(),e=$('#me-emoji').value.trim()||'🙂';if(!n){toast('Enter a name');return}const {error}=await sb.from('profiles').update({display_name:n,avatar_emoji:e}).eq('id',S.uid);if(error){toast(error.message);return}SOC.me.display_name=n;SOC.me.avatar_emoji=e;SOC.people[S.uid]=SOC.me;toast('Saved');render()},
  newchal:()=>openModal({kind:'newchal'}),
  createchal:async()=>{const t=$('#ch-title').value.trim(),m=$('#ch-metric').value,s=$('#ch-s').value,e=$('#ch-e').value;const ids=[...document.querySelectorAll('.pickf:checked')].map(x=>x.value);
    if(!t||!s||!e||e<s){toast('Add a name and valid dates');return}const {error}=await sb.rpc('create_challenge',{t,m,s,e,invitees:ids});if(error){toast(error.message);return}closeModal();toast('Challenge created');await loadChallenges();render()},
  chalresp:async el=>{await sb.from('challenge_participants').update({status:el.dataset.s}).eq('challenge_id',el.dataset.id).eq('user_id',S.uid);await loadChallenges();render()},
};




/* ---------- floating + button on the Diary: quick log anything ---------- */
const FAB_ITEMS=[['b','🍳','Breakfast'],['l','🥗','Lunch'],['d','🍝','Dinner'],['s','🍎','Snack'],['scan','📷','Scan a barcode'],['ex','🏃','Exercise'],['water','💧','Water +1 cup'],['wt','⚖️','Weight']];
const mealNow=()=>{const h=new Date().getHours();return h<11?'b':h<15?'l':h<21?'d':'s'};
function updateFab(){
  const show=S.uid&&S.view==='diary'&&!M;let f=document.getElementById('fab');
  if(!show){if(f)f.remove();return}
  if(!f){f=document.createElement('div');f.id='fab';document.body.appendChild(f)}
  const open=!!S.fabOpen;
  f.className=open?'open':'';
  f.innerHTML=(open?`<div class="fabback" data-act="fabclose"></div><div class="fabmenu" role="menu">${FAB_ITEMS.map(([k,i,l])=>`<button class="fabitem" role="menuitem" data-act="fabgo" data-k="${k}"><span class="fl">${esc(l)}</span><span class="fi" aria-hidden="true">${i}</span></button>`).join('')}</div>`:'')+
    `<button class="fabbtn" data-act="fabtoggle" aria-label="${open?'Close quick log':'Quick log: food, exercise, water or weight'}" aria-expanded="${open}"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>`;
}
function weightBody(){const wt=weights()[S.date];return `<div class="sheet-h"><h3>Log weight</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <label class="field">Weight on ${esc(S.date===today()?'today':nice(S.date,{weekday:'long',month:'short',day:'numeric'}))} (${wU()})<input id="wt-m" class="inp" type="number" step="0.1" min="0" inputmode="decimal" value="${wt!=null?wOut(wt).toFixed(1):''}" autofocus></label>
  <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" data-act="wtsave">Save</button></div></div>`}
const FACT={
  fabtoggle:()=>{S.fabOpen=!S.fabOpen;updateFab()},
  fabclose:()=>{S.fabOpen=false;updateFab()},
  fabgo:el=>{const k=el.dataset.k;S.fabOpen=false;
    if('blds'.includes(k)&&k.length===1){loadDB();openModal({kind:'food',tab:'search',meal:k,q:''})}
    else if(k==='scan'){loadDB();openModal({kind:'food',tab:'scan',meal:mealNow()})}
    else if(k==='ex')openModal({kind:'ex'});
    else if(k==='water'){const d=day(S.date);d.water=(d.water||0)+1;put(dk(S.date),d);toast(`💧 ${d.water} cup${d.water>1?'s':''} of water`)}
    else if(k==='wt')openModal({kind:'weight'});
    updateFab()},
  wtsave:()=>{const v=parseFloat($('#wt-m').value);const doc=get('weights')||{e:{}};doc.e=doc.e||{};if(isNaN(v)||v<=0)delete doc.e[S.date];else doc.e[S.date]=r2(wIn(v));if(doc.hc)delete doc.hc[S.date];closeModal();put('weights',doc);toast(isNaN(v)?'Weight cleared':'⚖️ Weight logged')},
};

/* ---------- about / version ---------- */
const VER=__TALLY_VERSION__;
const verLabel=()=>`Version ${VER.version}`+(VER.build&&VER.build!=='dev'&&VER.build!=='web'?` (build ${VER.build})`:VER.build==='web'?' (web)':' (dev)');
S.upd=null;
async function checkUpdate(manual){
  if(!isNative||!/^\d+$/.test(String(VER.build))){if(manual)toast(isNative?'This is a development build':'The web version updates itself automatically');return}
  try{const r=await fetch('https://api.github.com/repos/schallerrsteve-stack/tally-app/releases/latest',{headers:{Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(r.status);
    const j=await r.json();const latest=parseInt(String(j.tag_name||'').replace(/\D/g,''),10)||0;
    S.upd={latest,newer:latest>+VER.build,checked:Date.now()};
    if(manual&&!S.upd.newer)toast('You have the latest version');
  }catch(e){if(manual)toast('Couldn’t check for updates — try again later')}
  render();
}
function aboutCard(){
  const u=S.upd;
  return `<section class="card"><h3 style="font-size:18px">About Tally</h3><p class="tagline" style="margin:-4px 0 10px">get locked in</p>
  <div class="ptable" style="grid-template-columns:1fr">
    <div><span>Version</span><span>${esc(verLabel())}</span></div>
    <div><span>Built</span><span>${esc(new Date(VER.date).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}))} · ${esc(VER.commit)}</span></div>
    <div><span>App</span><span>${isNative?'Android':'Web'}</span></div>
  </div>
  ${isNative?(u&&u.newer?`<div class="notice" style="margin-top:12px">Build ${u.latest} is available. <a class="btn sm primary" href="https://github.com/schallerrsteve-stack/tally-app/releases/latest/download/Tally.apk" style="margin-left:6px">Download update</a></div>`:`<div class="row" style="margin-top:12px"><button class="btn sm" data-act="chkupd">Check for updates</button>${u&&!u.newer?'<span class="faint">You’re up to date</span>':''}</div>`):(/android/i.test(navigator.userAgent)?'<div class="notice" style="margin-top:12px">This is the <b>web version</b>. On Android, the Tally app adds watch sync, music controls and update alerts. <a class="btn sm primary" href="https://github.com/schallerrsteve-stack/tally-app/releases/latest/download/Tally.apk" style="margin-left:6px">Get the Android app</a></div>':'<p class="faint" style="margin-top:10px">The web version updates automatically when you reopen it.</p>')}
  <p class="faint" style="margin-top:12px">Food data: Health Canada Canadian Nutrient File (2015), USDA National Nutrient Database (SR28), and <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> (ODbL).
  <br><a href="privacypolicy.html" target="_blank" rel="noopener">Privacy policy</a> · <a href="https://github.com/schallerrsteve-stack/tally-app/releases" target="_blank" rel="noopener">What’s new</a></p></section>`;
}
const VACT={chkupd:()=>checkUpdate(true)};

/* ---------- music controls on workout screens (Android) ---------- */
// Works like headphone buttons: controls whatever is playing (YouTube Music, Spotify, ...).
const MC=()=>window.__tallyMediaMock||(isNative?MediaControl:null); // the mock is only used by automated tests
S.music={playing:null,polled:0};
const ICO={prev:'<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9.5 12z" fill="currentColor"/></svg>',
  next:'<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l10.5-7z" fill="currentColor"/></svg>',
  play:'<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>',
  pause:'<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor"/></svg>'};
function musicBar(){
  if(!MC())return '';const p=S.music.playing;
  return `<div class="musicbar" role="group" aria-label="Music controls"><span class="ml">Music</span>
  <button class="mb" data-act="mprev" aria-label="Previous song">${ICO.prev}</button>
  <button class="mb big" data-act="mplay" aria-label="${p?'Pause music':'Play music'}">${p?ICO.pause:ICO.play}</button>
  <button class="mb" data-act="mnext" aria-label="Next song">${ICO.next}</button>
  <span class="faint ms">${p===true?'Playing':p===false?'Paused':''}</span><button class="x holdx" data-act="mhide" aria-label="Hold for 3 seconds to hide music controls"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/></svg><span>×</span></button></div>`;
}
const dockOn=()=>{try{return localStorage.getItem('tally.musicdock')!=='0'}catch(e){return true}};
function updateDock(){
  if(holdT)return; // don't redraw mid-hold
  const show=!!(MC()&&S.uid&&dockOn());let d=document.getElementById('musicdock');
  document.body.classList.toggle('hasdock',show);
  if(!show){if(d)d.remove();return}
  if(!d){d=document.createElement('div');d.id='musicdock';const h=document.querySelector('header.top');if(h)h.insertAdjacentElement('afterend',d);else document.body.prepend(d)} // stays pinned at the top while you scroll
  d.innerHTML=musicBar();
}
function refreshMusicBar(){updateDock()}
async function musicCall(fn,args){const m=MC();if(!m)return;try{const r=await m[fn](args||{});if(r&&typeof r.playing==='boolean')S.music.playing=r.playing}catch(e){if(fn!=='state')toast('Music controls aren’t available right now')}refreshMusicBar()}
function musicPoll(){if(!MC()||!dockOn()||document.hidden)return;if(Date.now()-S.music.polled<5000)return;S.music.polled=Date.now();musicCall('state')}
let duckUntil=0;
function duck(ms){const m=MC();if(!m||Date.now()<duckUntil)return;duckUntil=Date.now()+ms-200;m.duck({ms}).catch(()=>{})}
// The × must be held for 3 seconds, so the bar can't be hidden by accident
let holdT=null,holdDone=false;
function hideDock(){try{localStorage.setItem('tally.musicdock','0')}catch(e){}holdT=null;updateDock();toast('Music controls hidden — turn them back on in Settings')}
function holdEnd(el,cancelled){if(!holdT)return;clearTimeout(holdT);holdT=null;if(el)el.classList.remove('holding');if(cancelled&&!holdDone)toast('Hold × for 3 seconds to hide the music controls')}
document.addEventListener('pointerdown',e=>{const el=e.target.closest&&e.target.closest('.holdx');if(!el)return;e.preventDefault();holdDone=false;el.classList.add('holding');
  holdT=setTimeout(()=>{holdDone=true;el.classList.remove('holding');try{navigator.vibrate&&navigator.vibrate(30)}catch(x){}hideDock()},3000)});
['pointerup','pointercancel','pointerleave'].forEach(t=>document.addEventListener(t,e=>{const el=e.target.closest&&e.target.closest('.holdx');if(el||t!=='pointerleave')holdEnd(document.querySelector('.holdx.holding'),true)},true));
document.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('.holdx'))e.preventDefault()});
const MACT={mprev:()=>musicCall('previous'),mnext:()=>musicCall('next'),mplay:()=>musicCall('playPause'),
  mhide:()=>{} // handled by the 3-second hold above
};
setInterval(()=>{if(S.uid)musicPoll()},5000);

/* ---------- watch sync: Health Connect (Android) ---------- */
// Reads steps, workouts and weight that Samsung Health, Fitbit / Google Health, Pixel Watch, Garmin etc. share with Health Connect.
const APP_ID='ca.tallyfit.app';
const WNAMES={running:'Run',runningTreadmill:'Treadmill run',walking:'Walk',hiking:'Hike',cycling:'Bike ride',bikingStationary:'Stationary bike',swimming:'Swim',swimmingPool:'Pool swim',swimmingOpenWater:'Open-water swim',rowing:'Rowing',rowingMachine:'Rowing machine',elliptical:'Elliptical',yoga:'Yoga',pilates:'Pilates',strengthTraining:'Strength training',traditionalStrengthTraining:'Strength training',functionalStrengthTraining:'Functional training',weightlifting:'Weightlifting',highIntensityIntervalTraining:'HIIT',stairClimbing:'Stair climbing',stairClimbingMachine:'Stair climber',dance:'Dance',dancing:'Dance',tennis:'Tennis',soccer:'Soccer',basketball:'Basketball',golf:'Golf',skiing:'Skiing',downhillSkiing:'Downhill skiing',crossCountrySkiing:'Cross-country skiing',iceSkating:'Skating',hockey:'Hockey',iceHockey:'Hockey',boxing:'Boxing',martialArts:'Martial arts',calisthenics:'Calisthenics',stretching:'Stretching',other:'Workout'};
const WMET={running:9.8,runningTreadmill:9.8,walking:3.5,hiking:6,cycling:8,bikingStationary:6.8,swimming:5.8,swimmingPool:5.8,swimmingOpenWater:6,rowing:7,rowingMachine:7,elliptical:5,yoga:2.5,pilates:3,highIntensityIntervalTraining:8,stairClimbing:9,stairClimbingMachine:9,dance:5,dancing:5,tennis:7.3,soccer:7,basketball:6.5};
const SRC={'com.sec.android.app.shealth':'Samsung Health','com.fitbit.FitbitMobile':'Fitbit','com.google.android.apps.fitness':'Google Fit','com.google.android.apps.healthdata':'Health Connect','com.garmin.android.apps.connectmobile':'Garmin Connect','com.ouraring.oura':'Oura','com.strava':'Strava','com.withings.wiscale2':'Withings','com.google.android.apps.wearables.healthconnect':'Pixel Watch'};
const wName=t=>WNAMES[t]||String(t||'workout').replace(/([A-Z])/g,' $1').toLowerCase().replace(/^./,c=>c.toUpperCase());
const srcName=(n,id)=>SRC[id]||SRC[n]||(n&&!/\./.test(n)?n:'your watch');
let HPL=null;
const hcNative=()=>isNative||!!window.__tallyHealthMock; // the mock is only used by automated tests
// Returns {H} rather than the plugin itself: a Capacitor plugin proxy answers every property, including
// `then`, so returning or awaiting it directly makes the promise wait on a native call that never answers.
async function hpBox(){if(window.__tallyHealthMock)return {H:window.__tallyHealthMock};if(!isNative)return {H:null};if(!HPL)HPL=(await import('@capgo/capacitor-health')).Health;return {H:HPL}}
const hcOn=()=>{try{return localStorage.getItem('tally.hc.on')==='1'}catch(e){return false}};
function hcPrefs(){let p={};try{p=JSON.parse(localStorage.getItem('tally.hc.prefs')||'{}')||{}}catch(e){}return Object.assign({steps:true,workouts:true,weight:true},p)}
function setHcPrefs(p){try{localStorage.setItem('tally.hc.prefs',JSON.stringify(p))}catch(e){}}
const HC_READ={read:['steps','workouts','calories','weight'],write:[]};
const withTimeout=(pr,ms)=>Promise.race([pr,new Promise((_,rej)=>setTimeout(()=>rej(Object.assign(new Error('timeout'),{timeout:true})),ms))]);
async function hcConnect(){
  if(S.hcConnecting)return;
  S.hcConnecting=true;S.hcMsg='';S.hcHelp=false;S.hcDiag=[];
  const t0=Date.now(),diag=x=>{S.hcDiag.push(`${((Date.now()-t0)/1000).toFixed(1)}s ${x}`)};
  const step=x=>{S.hcStep=x;render()};
  try{
    step('Loading Health Connect…');
    let H;try{H=(await withTimeout(hpBox(),10000)).H}catch(e){diag('load: '+(e.message||e));throw new Error('the Health Connect module didn’t load ('+(e.message||e)+')')}
    if(!H){S.hcMsg='Watch sync only works in the Tally Android app. This looks like the web version.';return}
    diag('loaded');
    step('Checking Health Connect is installed…');
    let a;try{a=await withTimeout(H.isAvailable(),10000)}catch(e){a={available:false,reason:String(e.message||e)}}
    diag('isAvailable: '+JSON.stringify(a));
    if(!a.available){S.hcMsg='Health Connect isn’t ready on this phone'+(a.reason&&a.reason!=='timeout'?` (${a.reason})`:'')+'. On Android 13 or older, install or update “Health Connect” from the Play Store, then try again.';S.hcHelp=true;return}
    step('Checking what Tally is allowed to read…');
    let st=null;try{st=await withTimeout(H.checkAuthorization(HC_READ),10000);diag('check: '+JSON.stringify(st))}catch(e){diag('check: '+(e.message||e))}
    if(!st||!st.readAuthorized||!st.readAuthorized.length){
      step('Waiting for Health Connect’s permission screen…');
      S.hcMsg='Opening Health Connect… allow steps, exercise and weight, then come back.';render();
      try{st=await withTimeout(H.requestAuthorization(HC_READ),25000);diag('request: '+JSON.stringify(st))}
      catch(e){
        diag('request: '+(e.message||e));
        if(e.timeout){S.hcMsg='Health Connect didn’t open its permission screen. Tap “Open Health Connect” → App permissions → Tally, turn on Steps, Exercise and Weight, then tap “Connect watch” again. If Tally isn’t listed there, send Steve the details below.';S.hcHelp=true;return}
        throw new Error('couldn’t ask for permission ('+(e.message||e)+')');
      }
    }
    if(!st||!st.readAuthorized||!st.readAuthorized.length){S.hcMsg='No permissions were granted. Tap “Open Health Connect” → App permissions → Tally, turn on Steps, Exercise and Weight, then tap “Connect watch” again.';S.hcHelp=true;return}
    try{localStorage.setItem('tally.hc.on','1')}catch(e){}
    S.hcPerm=st.readAuthorized;S.hcMsg='';S.hcHelp=false;S.hcDiag=[];S.hcConnecting=false;await hcSync(true);
  }catch(e){S.hcMsg='Connect problem: '+(e.message||e);S.hcHelp=true}
  finally{S.hcConnecting=false;S.hcStep='';render()}
}
function hcDisconnect(){try{localStorage.removeItem('tally.hc.on')}catch(e){}S.hcMsg='Stopped syncing. To remove Tally’s access completely, open Health Connect settings.';render()}
let hcBusy=false,hcLastRun=0;
async function hcSync(full,manual){
  if(hcBusy||!hcOn()||!S.uid)return;
  if(!full&&!manual&&Date.now()-hcLastRun<10*60000)return;
  const H=(await hpBox()).H;if(!H)return;
  hcBusy=true;hcLastRun=Date.now();S.hcSyncing=true;if(S.view==='profile')render();
  const prefs=hcPrefs();let added=0;const errs=[];
  try{
    const doc=Object.assign({steps:{},ignored:[],srcs:{}},get('hc')||{});
    const firstTime=!doc.last;const days=full||firstTime?30:7;
    const start=new Date();start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);const end=new Date();
    const range={startDate:start.toISOString(),endDate:end.toISOString()};
    if(prefs.steps){try{const {samples}=await H.queryAggregated(Object.assign({dataType:'steps',bucket:'day',aggregation:'sum'},range));
      for(const s of samples){const d=iso(new Date(s.startDate));const v=Math.round(s.value||0);if(v>0)doc.steps[d]=v}}catch(e){errs.push('steps')}}
    if(prefs.workouts){try{
      let anchor,list=[];do{const r=await H.queryWorkouts(Object.assign({limit:50,anchor},range));list=list.concat(r.workouts||[]);anchor=r.anchor}while(anchor&&list.length<400);
      const kg=targets(today()).w,byDay={};
      for(const w of list){if(w.sourceId===APP_ID)continue;const hid='hc-'+String(w.platformId||w.startDate).replace(/[^A-Za-z0-9_.:-]/g,'').slice(0,60);if(doc.ignored.includes(hid))continue;
        const st=new Date(w.startDate),en=new Date(w.endDate);(byDay[iso(st)]=byDay[iso(st)]||[]).push({w,hid,st:+st,en:+en})}
      for(const [date,items] of Object.entries(byDay)){
        const d=day(date);let changed=false;const tally=allWorkouts().filter(x=>x.date===date&&x.start&&x.end);
        for(const {w,hid,st,en} of items){
          const min=Math.max(1,Math.round((w.duration||(en-st)/1000)/60));
          // Skip if this overlaps a workout you logged in Tally (same session recorded twice)
          if(tally.some(x=>Math.min(x.end,en)-Math.max(x.start,st)>0.5*Math.min(x.end-x.start,en-st)))continue;
          const kcal=Math.round(w.totalEnergyBurned>0?w.totalEnergyBurned:(WMET[w.workoutType]||5)*kg*min/60);
          const e={id:hid,name:wName(w.workoutType),min,kcal,src:'hc',from:srcName(w.sourceName,w.sourceId),start:w.startDate};
          if(w.totalDistance>0)e.dist=Math.round(w.totalDistance);
          const i=d.ex.findIndex(x=>x.id===hid);
          if(i<0){d.ex.push(e);changed=true;added++}else if(d.ex[i].kcal!==e.kcal||d.ex[i].min!==e.min){d.ex[i]=Object.assign({},d.ex[i],e);changed=true}
        }
        if(changed)put(dk(date),d);
      }}catch(e){errs.push('workouts')}}
    if(prefs.weight){try{const {samples}=await H.readSamples(Object.assign({dataType:'weight',limit:500},range));
      const wd=get('weights')||{e:{}};wd.e=wd.e||{};wd.hc=wd.hc||{};let ch=false;
      for(const s of samples.sort((a,b)=>a.startDate<b.startDate?-1:1)){if(s.sourceId===APP_ID||!(s.value>0))continue;const dt=iso(new Date(s.startDate));
        if(wd.e[dt]!=null&&!wd.hc[dt])continue; // a weight you typed in yourself always wins
        const v=r2(s.value);if(wd.e[dt]!==v){wd.e[dt]=v;wd.hc[dt]=1;ch=true}}
      if(ch)put('weights',wd)}catch(e){errs.push('weight')}}
    doc.last=Date.now();put('hc',doc);
    S.hcMsg=errs.length?`Synced, but couldn’t read ${errs.join(', ')} — check Tally’s permissions in Health Connect.`:(added?`Added ${added} workout${added>1?'s':''} from your watch.`:'');
    if(added&&S.view!=='profile')toast(`⌚ Added ${added} workout${added>1?'s':''} from your watch`);
  }catch(e){S.hcMsg='Sync problem: '+(e.message||e)}
  finally{hcBusy=false;S.hcSyncing=false;render()}
}
function hcCard(){
  if(!hcNative())return `<section class="card"><h3 style="font-size:18px">Watch &amp; fitness apps</h3><p class="muted" style="font-size:14px;margin-bottom:0">Connect a Samsung, Fitbit, Pixel or Garmin watch from the Tally Android app. Steps and workouts it imports show up here too.</p></section>`;
  const p=hcPrefs(),doc=get('hc')||{},on=hcOn();
  const last=doc.last?new Date(doc.last).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):null;
  return `<section class="card"><div class="spread"><h3 style="font-size:18px">Watch &amp; fitness apps</h3>${on?'<span class="tag mine">Connected</span>':''}</div>
  <p class="muted" style="font-size:14px">Tally reads from <b>Health Connect</b>, where Samsung Health, Fitbit, Pixel Watch, Garmin and others share your activity.${on?'':' First make sure your watch’s app is set to sync with Health Connect.'}</p>
  ${on?`${[['steps','Daily steps'],['workouts','Workouts (added to your Exercise, so they count toward your calorie budget)'],['weight','Weight from a smart scale (your own entries always win)']].map(([k,l])=>`<label class="chkrow"><input type="checkbox" class="hctog" data-k="${k}" ${p[k]?'checked':''}> ${l}</label>`).join('')}
  <p class="faint" style="margin:8px 0">${S.hcSyncing?'<span class="spin"></span> Syncing…':last?'Last synced '+esc(last):'Not synced yet'}</p>
  <div class="row"><button class="btn sm primary" data-act="hcsync" ${S.hcSyncing?'disabled':''}>Sync now</button><button class="btn sm" data-act="hcsettings">Health Connect settings</button><button class="btn sm ghost" data-act="hcoff">Stop syncing</button></div>`
  :`<div class="row"><button class="btn primary" data-act="hcconnect" ${S.hcConnecting?'disabled':''}>${S.hcConnecting?'<span class="spin"></span> Connecting…':'Connect watch'}</button>${S.hcHelp?'<button class="btn" data-act="hcsettings">Open Health Connect</button>':''}</div>${S.hcConnecting&&S.hcStep?`<p class="faint" style="margin:8px 0 0">${esc(S.hcStep)}</p>`:''}`}
  ${S.hcMsg?`<div class="notice ${/problem|couldn|isn|didn|No perm|only works/i.test(S.hcMsg)?'warn':''}" style="margin-top:12px">${esc(S.hcMsg)}</div>`:''}
  ${!S.hcConnecting&&S.hcDiag&&S.hcDiag.length?`<details style="margin-top:10px" open><summary>Details for Steve</summary><pre class="faint" style="white-space:pre-wrap;font-size:12px;margin:6px 0 0">${esc((navigator.userAgent.match(/Android[^;)]*;[^;)]*/)||[''])[0]+'\n'+S.hcDiag.join('\n'))}</pre></details>`:''}
  <details style="margin-top:10px"><summary>Watch data not showing up?</summary><ul class="faint" style="padding-left:18px;margin:8px 0 0">
  <li><b>Samsung:</b> Samsung Health → Settings → Health Connect → allow it to write steps and exercise, and turn on “Sync with Samsung account”.</li>
  <li><b>Fitbit / Pixel Watch:</b> in the Fitbit (Google Health) app → Connections or Settings → Health Connect → turn on syncing.</li>
  <li>Then tap <b>Sync now</b>. Health Connect only shares the last 30 days with a newly connected app.</li></ul></details></section>`;
}
const HACT={
  hcconnect:()=>hcConnect(),
  hcsync:()=>hcSync(false,true),
  hcoff:()=>hcDisconnect(),
  hcsettings:async()=>{let H=null;try{H=(await hpBox()).H}catch(e){}if(!H){toast('Health Connect is only in the Android app');return}try{await H.openHealthConnectSettings()}catch(e){toast('Couldn’t open Health Connect: '+(e.message||e))}},
};

/* ---------- sign-in ---------- */
let AU={step:'email',email:'',busy:false,err:''};
function vAuth(){
  return `<div class="authbox card"><div class="brand" style="justify-content:center;font-size:30px"><i></i>Tally</div>
  <p class="tagline" style="text-align:center;margin:4px 0 2px">get locked in</p>
  <p class="muted" style="text-align:center;margin:0 0 18px">Nutrition, workouts and friends.</p>
  ${AU.step==='email'?`<label class="field">Email<input id="au-email" class="inp" type="email" autocomplete="email" value="${esc(AU.email)}" placeholder="you@example.com" autofocus></label>
  <button class="btn primary" data-act="ausend" style="width:100%;margin-top:12px" ${AU.busy?'disabled':''}>${AU.busy?'<span class="spin"></span> Sending…':'Email me a sign-in code'}</button>
  <p class="faint" style="margin-top:10px">New here? The same code creates your account. If a friend invited you, use the address the invite went to.</p>`
  :`<p style="margin:0 0 10px">We emailed a code to <b>${esc(AU.email)}</b>.</p><label class="field">Code<input id="au-code" class="inp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" autofocus></label>
  <button class="btn primary" data-act="auverify" style="width:100%;margin-top:12px" ${AU.busy?'disabled':''}>${AU.busy?'<span class="spin"></span> Checking…':'Sign in'}</button>
  <div class="row" style="justify-content:space-between;margin-top:10px"><button class="btn ghost sm" data-act="auback">Use a different email</button><button class="btn ghost sm" data-act="ausend">Resend code</button></div>`}
  ${AU.err?`<div class="notice warn" style="margin-top:12px">${esc(AU.err)}</div>`:''}<p class="faint" style="text-align:center;margin:16px 0 0;font-size:12px">${esc(verLabel())}</p></div>`;
}
const AACT={
  ausend:async()=>{const e=($('#au-email')||{}).value;if(e!==undefined)AU.email=e.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(AU.email)){AU.err='Enter a valid email address';render();return}
    AU.busy=true;AU.err='';render();try{await sendCode(AU.email);AU.step='code'}catch(err){AU.err=err.message||'Couldn’t send the code'}AU.busy=false;render()},
  auverify:async()=>{const c=($('#au-code').value||'').replace(/\s/g,'');if(c.length<6){AU.err='Enter the code from the email';render();return}
    AU.busy=true;AU.err='';render();try{const u=await verifyCode(AU.email,c);AU={step:'email',email:'',busy:false,err:''};start(u)}catch(err){AU.busy=false;AU.err='That code didn’t work — check it or request a new one.';render()}},
  auback:()=>{AU.step='email';AU.err='';render()},
  signout:async()=>{if(!confirmReplace())return;if(STORE)STORE.close();if(rtChannel)sb.removeChannel(rtChannel);await signOut();STORE=null;S.uid=null;S.docs={};Object.assign(TG,{invites:[],session:null,members:{}});Object.assign(SOC,{loaded:false,people:{},friends:[],feed:[],convs:[],challenges:[],thread:null});location.hash='#diary';render()},
  delacct:async()=>{if(!confirmReplace())return;await ciDeleteAllPhotos();const {error}=await sb.rpc('delete_my_account');if(error){toast('Couldn’t delete: '+error.message);return}try{localStorage.removeItem('tally.cache.'+S.uid);localStorage.removeItem('tally.pending.'+S.uid)}catch(e){}if(STORE)STORE.close();await signOut().catch(()=>{});S.uid=null;S.docs={};toast('Your account was deleted');render()},
  importopen:()=>openModal({kind:'import'}),
  importrun:()=>{let d;try{d=JSON.parse($('#imp-json').value)}catch(e){toast('That isn’t valid JSON');return}let n=0;for(const [k,v] of Object.entries(d||{}))if(/^[A-Za-z0-9_.:-]{1,64}$/.test(k)&&v&&typeof v==='object'){put(k,v);n++}closeModal();toast(`Imported ${n} item${n===1?'':'s'}`)},
  nativescan:async()=>{const m=M;try{const raw=await nativeScan();if(M!==m)return;const c=normCode(raw);if(c)gotCode(c);else if(raw)toast('That barcode type isn’t supported');}catch(err){if(M!==m)return;M.scan={stage:'start',err:err.code==='installing'?err.message:'Camera scan didn’t work — try a photo instead.'};drawModal(false)}},
};
function importBody(){return `<div class="sheet-h"><h3>Import from Tally web</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <p class="faint" style="margin-top:0">In the Tally page on claude.ai, open <b>Profile &amp; targets → Copy all data as JSON</b>, then paste it here. Matching days and foods are replaced.</p>
  <textarea id="imp-json" class="inp" rows="8" placeholder='{"profile":{...},"d-2026-10-31":{...}}'></textarea>
  <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn primary" data-act="importrun">Import</button></div></div>`}
function start(user){
  S.uid=user.id;S.email=user.email;
  STORE=createStore({uid:user.id,onChange:(what)=>{S.docs=STORE.docs;syncNote();if(what==='docs'){afterChange();render()}}});
  S.docs=STORE.docs;socialRealtime();route();loadSocial();loadTogether();loadFx();
  if(isNative)setTimeout(()=>checkUpdate(false),4000);
  if(hcNative()){setTimeout(()=>hcSync(false),2500);import('@capacitor/app').then(({App})=>App.addListener('resume',()=>hcSync(false))).catch(()=>{})}
}
function webInstall(){
  if(isNative)return;
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),standalone=window.navigator.standalone||matchMedia('(display-mode: standalone)').matches;
  let dismissed=false;try{dismissed=localStorage.getItem('tally.installhint')==='1'}catch(e){}
  const android=/android/i.test(navigator.userAgent);let adDismissed=false;try{adDismissed=localStorage.getItem('tally.androidhint')==='1'}catch(e){}
  if(android&&!adDismissed){const b=document.createElement('div');b.className='installhint';b.innerHTML='<span>You’re using the <b>web version</b>. The Tally Android app adds watch sync and music controls.</span><a class="btn sm primary" href='+JSON.stringify('https://github.com/schallerrsteve-stack/tally-app/releases/latest/download/Tally.apk')+'>Get app</a><button class="x" aria-label="Dismiss">×</button>';
    b.querySelector('button').onclick=()=>{b.remove();try{localStorage.setItem('tally.androidhint','1')}catch(e){}};document.body.appendChild(b)}
  if(ios&&!standalone&&!dismissed){const b=document.createElement('div');b.className='installhint';b.innerHTML='<span>Install Tally: in Safari tap <b>•••</b> (or <b>Share</b>), then <b>Share</b> → scroll down → <b>Add to Home Screen</b>.</span><button class="x" aria-label="Dismiss">×</button>';
    b.querySelector('button').onclick=()=>{b.remove();try{localStorage.setItem('tally.installhint','1')}catch(e){}};document.body.appendChild(b)}
}
async function boot(){
  webInstall();
  window.addEventListener('hashchange',()=>{if(S.view!=='social')SOC.thread=null});
  const u=await currentUser();
  if(u)start(u);else render();
  sb.auth.onAuthStateChange((ev,session)=>{if(ev==='SIGNED_OUT'&&S.uid){S.uid=null;render()}});
}

/* ---------- events ---------- */
let toastT;
function toast(t){let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.appendChild(el)}el.textContent=t;el.style.bottom=$('#restbar')?'84px':'';clearTimeout(toastT);toastT=setTimeout(()=>el.remove(),2200)}
/* ---------- share routines + work out together ---------- */
// A shared routine travels with the definitions of any custom exercises it uses.
function rtSummary(r){if(!r)return '';if(r.kind==='int'||r.int){const I=r.int;return I.style==='round'?`${I.rounds} rounds · ${mmss(I.work)} / ${mmss(I.rest)} rest`:`${I.rounds} rounds · ${I.work}s work / ${I.rest}s rest`}
  const defs=r.exDefs||[],n=(r.items||[]).map(t=>{const d=defs.find(x=>x.id===t.ex);return d?d.name:exById(t.ex).name});return n.slice(0,4).join(', ')+(n.length>4?` +${n.length-4} more`:'')}
function routinePayload(r){const p=clone(r);delete p.id;const lib=new Set(EXLIB.map(e=>e.id)),ids=new Set((p.items||[]).map(t=>t.ex));
  p.exDefs=exList().filter(e=>ids.has(e.id)&&!lib.has(e.id)&&!/^fx:/.test(e.id));return p}
function addExDefs(defs){if(!defs||!defs.length)return;const have=new Set(exList().map(e=>e.id)),add=defs.filter(d=>d&&d.id&&!have.has(d.id));
  if(!add.length)return;const doc=get('exercises')||{list:[]};doc.list=(doc.list||[]).concat(add);put('exercises',doc)}
function saveSharedRoutine(p){const r=clone(p);addExDefs(r.exDefs);delete r.exDefs;r.id='r'+newId();
  const doc=get('routines')||{list:[]};doc.list=doc.list||[];const names=new Set(doc.list.map(x=>x.name));
  if(names.has(r.name)){let i=2;while(names.has(`${r.name} (${i})`))i++;r.name=`${r.name} (${i})`}
  doc.list.push(r);put('routines',doc);return r}

const TG={invites:[],session:null,members:{},busy:false};
const tgIn=()=>!!(S.ws&&S.ws.session);
const tgHost=()=>tgIn()&&S.ws.session.host===S.uid;
async function loadTogether(){if(!S.uid)return;
  try{const mine=await q(sb.from('session_members').select('session_id,status').eq('user_id',S.uid).eq('status','invited'));
    if(!mine.length){TG.invites=[];render();return}
    const since=new Date(Date.now()-4*3600e3).toISOString();
    const ss=await q(sb.from('sessions').select('*').in('id',mine.map(m=>m.session_id)).eq('status','open').gte('created_at',since).order('created_at',{ascending:false}));
    await loadPeople(ss.map(s=>s.host_id));TG.invites=ss;render();
  }catch(e){}
  if(tgIn())loadSessionState();
}
async function loadSessionState(){if(!tgIn())return;const sid=S.ws.session.id;
  try{const [s]=await q(sb.from('sessions').select('*').eq('id',sid));const ms=await q(sb.from('session_members').select('*').eq('session_id',sid));
    TG.session=s||null;TG.members={};for(const m of ms)TG.members[m.user_id]=m;await loadPeople(ms.map(m=>m.user_id));
    if(s&&!tgHost()&&S.ws.kind==='int'&&s.clock&&s.clock.step!=null)applyClock(s.clock,true);
    tgDom();
  }catch(e){}
}
function tgBanner(){if(!TG.invites.length||S.ws)return '';const s=TG.invites[0],r=s.routine||{};
  return `<div class="notice tgb"><span>👥 <b>${esc(pname(s.host_id))}</b> wants to work out together: <b>${esc(r.name||'Workout')}</b><span class="faint"> · ${esc(rtSummary(r))}</span></span><span class="row"><button class="btn sm ghost" data-act="tgdecline" data-id="${s.id}">No thanks</button><button class="btn sm primary" data-act="tgjoin" data-id="${s.id}">Join</button></span></div>`}
function tgStatus(m,host){if(m.status==='invited')return 'invited…';if(m.status==='left')return 'left';if(m.status==='done')return 'finished ✓';
  const p=m.progress||{};if(!p.items)return host&&S.ws&&S.ws.kind==='int'?'running the clock':'joined';
  const cur=p.items.find(it=>(it.done||[]).length<(it.n||0))||p.items[p.items.length-1];const n=p.items.reduce((a,it)=>a+(it.done||[]).length,0);
  return `${cur?esc(exById(cur.ex).name)+' · ':''}${n} set${n===1?'':'s'} done`}
function tgStrip(){if(!tgIn())return '';const host=S.ws.session.host;
  const others=Object.values(TG.members).filter(m=>m.user_id!==S.uid);
  const ended=TG.session&&TG.session.status==='ended'&&host!==S.uid;
  return `<div class="tgstrip"><b>👥 Together</b>${others.length?others.map(m=>`<span class="tgp1"><span class="av sm">${esc(pemoji(m.user_id))}</span>${esc(pname(m.user_id))}${m.user_id===host?' <span class="tag">host</span>':''} <span class="faint">${tgStatus(m,m.user_id===host)}</span></span>`).join(''):'<span class="faint">Loading…</span>'}${ended?'<span class="faint">The host has finished.</span>':''}</div>`}
function tgPartnerSets(exId){if(!tgIn())return '';const ex=exById(exId);
  return Object.values(TG.members).filter(m=>m.user_id!==S.uid&&m.progress&&m.progress.items).map(m=>{const it=m.progress.items.find(x=>x.ex===exId);if(!it||!(it.done||[]).length)return '';
    return `<div class="tgsets"><span class="av sm">${esc(pemoji(m.user_id))}</span><b>${esc(pname(m.user_id))}</b> ${it.done.map(s=>esc(setText(ex,s))).join(' · ')}</div>`}).join('')}
function tgDom(){if(S.view!=='workouts'||!tgIn())return;const st=$('#tg-strip');if(st)st.innerHTML=tgStrip();
  document.querySelectorAll('.tgpart').forEach(el=>{el.innerHTML=tgPartnerSets(el.dataset.ex)})}
let tgPubT=null;
function tgPayload(w){return w.kind==='int'?{int:true}:{items:w.items.map(it=>({ex:it.ex,n:it.sets.length,done:it.sets.filter(s=>s.done).map(s=>{const o={};for(const k of ['w','r','t','d'])if(s[k]!==''&&s[k]!=null)o[k]=s[k];return o})}))}}
function tgProgress(){if(!tgIn())return;clearTimeout(tgPubT);tgPubT=setTimeout(()=>{if(!tgIn())return;const w=S.ws;
  sb.from('session_members').update({status:'joined',progress:tgPayload(w),updated_at:new Date().toISOString()}).eq('session_id',w.session.id).eq('user_id',S.uid).then(()=>{})},700)}
function tgClock(){if(!tgHost()||S.ws.kind!=='int')return;const w=S.ws;
  sb.from('sessions').update({clock:{step:w.step,phaseStart:w.phaseStart,elapsedPhase:w.elapsedPhase,paused:w.paused},updated_at:new Date().toISOString()}).eq('id',w.session.id).then(()=>{})}
function applyClock(c,quiet){const w=S.ws;if(!w||w.kind!=='int'||!c||c.step==null)return;
  const wasIdle=w.paused&&!w.phaseStart&&!w.elapsedPhase;
  w.step=c.step;w.phaseStart=c.phaseStart;w.elapsedPhase=c.elapsedPhase||0;w.paused=!!c.paused;w._lastBeep=null;
  if(!quiet&&wasIdle&&!w.paused&&w.int.style==='round'&&!+w.int.warm)bell(1);
  keepAwake(!w.paused);saveWs();if(S.view==='workouts')render()}
async function tgEnd(status,sess,progress){sess=sess||(S.ws&&S.ws.session);if(!sess)return;const sid=sess.id,host=sess.host===S.uid;
  await sb.from('session_members').update(Object.assign({status,updated_at:new Date().toISOString()},progress?{progress}:{})).eq('session_id',sid).eq('user_id',S.uid);
  if(host)await sb.from('sessions').update({status:'ended',updated_at:new Date().toISOString()}).eq('id',sid)}
function tgRealtime(ch){
  return ch.on('postgres_changes',{event:'*',schema:'public',table:'session_members'},async p=>{const m=p.new;if(!m||!m.session_id)return;
      if(m.user_id===S.uid&&m.status==='invited'&&p.eventType==='INSERT'){await loadTogether();const s=TG.invites.find(x=>x.id===m.session_id);if(s)toast(`👥 ${pname(s.host_id)} wants to work out together`);return}
      if(tgIn()&&m.session_id===S.ws.session.id){const was=TG.members[m.user_id];TG.members[m.user_id]=m;await loadPeople([m.user_id]);
        if(m.user_id!==S.uid&&(!was||was.status!==m.status)&&m.status==='joined')toast(`👥 ${pname(m.user_id)} joined`);tgDom()}})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'sessions'},p=>{const s=p.new;if(!tgIn()||s.id!==S.ws.session.id)return;TG.session=s;
      if(!tgHost()&&S.ws.kind==='int')applyClock(s.clock);
      if(s.status==='ended'&&!tgHost())toast(`${pname(s.host_id)} finished the session`);tgDom()})}
function togetherBody(){const r=M.r;const fr=SOC.friends;
  return `<div class="sheet-h"><h3>${esc(r.name)}</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <p class="faint" style="margin-top:0">${esc(rtSummary(r))}</p>
  ${!SOC.loaded?'<p><span class="spin"></span> Loading friends…</p>':fr.length?`<h3 class="minih">Pick friends</h3><div class="rlist">${fr.map(id=>`<label class="rrow" style="cursor:pointer"><input type="checkbox" class="pickf" value="${id}"><div class="av">${esc(pemoji(id))}</div><div class="t"><div class="nm">${esc(pname(id))}</div></div></label>`).join('')}</div>
  <p class="faint" style="font-size:13px">“Send” puts the routine in your chat so they can save it. “Start together” starts it now — everyone logs their own weights and reps and sees each other’s sets as you go${r.kind==='int'?'; you run the clock for everyone':''}.</p>
  <div class="row" style="justify-content:flex-end"><button class="btn" data-act="sendroutine">Send routine</button><button class="btn primary" data-act="starttogether">Start together</button></div>`
  :'<p class="faint">Add friends under <b>Friends → People</b> first.</p>'}</div>`}
function routineCard(m){const r=m.routine,saved=(get('posted')||{})['rt'+m.id];
  return `<div class="bub rcard"><div class="rc-t">📋 ${esc(r.name||'Routine')}</div><div class="rc-s">${esc(rtSummary(r))}</div>${m.sender_id===S.uid?'':`<button class="btn sm ${saved?'':'primary'}" data-act="saveshared" data-mid="${m.id}" ${saved?'disabled':''}>${saved?'Saved ✓':'Save to my routines'}</button>`}</div>`}
const TACT={
  rtshare:el=>{const r=routines().find(x=>x.id===el.dataset.id);if(!r)return;openModal({kind:'together',r});if(!SOC.loaded)loadSocial().then(()=>{if(M&&M.kind==='together')drawModal()})},
  sendroutine:async el=>{const ids=[...document.querySelectorAll('.pickf:checked')].map(x=>x.value);if(!ids.length){toast('Pick at least one friend');return}
    el.disabled=true;const p=routinePayload(M.r);let ok=0;
    for(const id of ids){const {data:cid,error}=await sb.rpc('start_conversation',{member_ids:[id],group_title:null});if(error)continue;
      const {error:e2}=await sb.from('messages').insert({conversation_id:cid,sender_id:S.uid,body:`📋 Shared a routine: ${M.r.name}`,routine:p});if(!e2)ok++}
    el.disabled=false;if(!ok){toast('Couldn’t send — has the update been installed in Supabase?');return}closeModal();toast(`Sent to ${ok} friend${ok>1?'s':''}`);if(SOC.loaded)loadConvs()},
  starttogether:async el=>{const ids=[...document.querySelectorAll('.pickf:checked')].map(x=>x.value);if(!ids.length){toast('Pick at least one friend');return}
    if(S.ws){toast('Finish or discard the workout in progress first');return}
    el.disabled=true;const r=M.r,p=routinePayload(r);const {data:sid,error}=await sb.rpc('start_session',{r:p,invitees:ids});el.disabled=false;
    if(error){toast(error.message);return}closeModal();startWorkout(r);if(!S.ws)return;S.ws.session={id:sid,host:S.uid};saveWs();
    TG.session=null;TG.members={};render();await loadSessionState();tgClock();tgProgress();toast('Invite sent — start whenever you’re ready')},
  tgjoin:async el=>{const s=TG.invites.find(x=>x.id===el.dataset.id);if(!s)return;if(S.ws){toast('Finish or discard the workout in progress first');return}
    const r=clone(s.routine||{});addExDefs(r.exDefs);delete r.exDefs;r.id=null;
    (r.items||[]).forEach(t=>{delete t.wt});// your own last weights, not the host's
    startWorkout(r);if(!S.ws)return;
    S.ws.session={id:s.id,host:s.host_id};saveWs();TG.session=null;TG.members={};render();TG.invites=TG.invites.filter(x=>x.id!==s.id);
    await sb.from('session_members').update({status:'joined',updated_at:new Date().toISOString()}).eq('session_id',s.id).eq('user_id',S.uid);
    await loadSessionState();tgProgress();render()},
  tgdecline:async el=>{const id=el.dataset.id;TG.invites=TG.invites.filter(x=>x.id!==id);render();await sb.from('session_members').update({status:'left'}).eq('session_id',id).eq('user_id',S.uid)},
  saveshared:el=>{const m=SOC.msgs.find(x=>String(x.id)===el.dataset.mid);if(!m||!m.routine)return;const r=saveSharedRoutine(m.routine);
    const p=get('posted')||{};p['rt'+m.id]=1;put('posted',p);toast(`Saved “${r.name}” to your routines`);renderThreadMsgs()},
};

/* ---------- weekly check-in ---------- */
// Record per check-in (doc 'checkins'): {id,date,avg,n,bmi,meas:{waist,hips,chest,biceps,thighs} (cm),photos:{front,right,left,back} (private storage paths),ai:{text,vs,at}}
const CI_MEAS=[['waist','Waist'],['hips','Hips'],['chest','Chest'],['biceps','Biceps'],['thighs','Thighs']];
const CI_POSES=[['front','Front'],['right','Right side'],['left','Left side'],['back','Back']];
const CI_BUCKET='checkins';
const lU=()=>imperial()?'in':'cm',lOut=cm=>cm==null?null:(imperial()?cm/2.54:cm),lIn=v=>imperial()?v*2.54:v;
const r1=x=>Math.round(x*10)/10;
function checkins(){return (((get('checkins')||{}).list)||[]).slice().sort((a,b)=>a.date<b.date?1:-1)}
function saveCheckin(rec){const doc=get('checkins')||{list:[]};doc.list=(doc.list||[]).filter(x=>x.id!==rec.id).concat([rec]);put('checkins',doc)}
function ciWeek(date){const w=weights(),from=addDays(date,-6);const vals=Object.keys(w).filter(d=>d>=from&&d<=date).map(d=>w[d]);
  return {avg:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,n:vals.length}}
function ciBmi(kg){const h=(profile().height||0)/100;return kg&&h?kg/(h*h):null}
function ciCurrent(){const date=S.ciDate||today();return checkins().find(c=>c.date===date)||null}
function ciPrev(date){return checkins().find(c=>c.date<date)||null}
function ciEnsure(){const date=S.ciDate||today();let c=ciCurrent();if(!c){c={id:'ci'+newId(),date,meas:{},photos:{}}}return c}
function ciRefreshStats(c){const wk=ciWeek(c.date);c.avg=wk.avg!=null?r2(wk.avg):null;c.n=wk.n;const kg=c.avg!=null?c.avg:latestWeight(c.date);c.bmi=ciBmi(kg)!=null?r1(ciBmi(kg)):null;return c}
const ciDelta=(now,prev,fmt,unit)=>{if(now==null||prev==null)return '';const d=now-prev;if(Math.abs(d)<0.05)return `<span class="cid">no change</span>`;return `<span class="cid ${d<0?'dn':'up'}">${d>0?'+':'−'}${fmt(Math.abs(d))}${unit?' '+unit:''}</span>`};
/* private photo storage */
const CIURL={};
async function ciHydrate(){const imgs=[...document.querySelectorAll('img[data-path]')];if(!imgs.length)return;
  const need=[...new Set(imgs.map(i=>i.dataset.path))].filter(p=>!CIURL[p]||CIURL[p].exp<Date.now());
  if(need.length){try{const {data}=await sb.storage.from(CI_BUCKET).createSignedUrls(need,3600);(data||[]).forEach(d=>{if(d.signedUrl)CIURL[d.path]={url:d.signedUrl,exp:Date.now()+3300e3}})}catch(e){}}
  for(const i of document.querySelectorAll('img[data-path]')){const u=CIURL[i.dataset.path];if(u&&i.src!==u.url)i.src=u.url}}
async function shrinkPhoto(file,max){const bmp=await createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>null);
  const src=bmp||await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(file)});
  const w=src.width,h=src.height,k=Math.min(1,max/Math.max(w,h));const c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);
  c.getContext('2d').drawImage(src,0,0,c.width,c.height);return new Promise(r=>c.toBlob(r,'image/jpeg',.82))}
async function ciUpload(pose,file){const c=ciEnsure();S.ciBusy=pose;render();
  try{const blob=await shrinkPhoto(file,1600);const path=`${S.uid}/${c.date}-${pose}-${newId()}.jpg`;
    const {error}=await sb.storage.from(CI_BUCKET).upload(path,blob,{contentType:'image/jpeg',upsert:false});
    if(error)throw error;const old=c.photos[pose];c.photos[pose]=path;CIURL[path]={url:URL.createObjectURL(blob),exp:Date.now()+3300e3};
    ciRefreshStats(c);saveCheckin(c);if(old)sb.storage.from(CI_BUCKET).remove([old]);
  }catch(e){toast('Photo not saved: '+(e.message||e)+(/bucket|not found/i.test(e.message||'')?' — run the check-in SQL in Supabase':''))}
  S.ciBusy=null;render()}
async function ciLoadBlob(path){const {data,error}=await sb.storage.from(CI_BUCKET).download(path);if(error)throw error;return data}
// The AI gets two images: last check-in's four poses side by side, and this one's.
async function ciComposite(c,label){const H=560,pad=8,top=34;const ims=[];
  for(const [k,l] of CI_POSES){if(!c.photos[k])continue;const b=await ciLoadBlob(c.photos[k]);ims.push([l,await createImageBitmap(b)])}
  const ws=ims.map(([,im])=>Math.round(im.width*H/im.height));const W=ws.reduce((a,b)=>a+b+pad,pad);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H+top+pad;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,cv.height);
  g.fillStyle='#111';g.font='bold 20px sans-serif';let x=pad;ims.forEach(([l,im],i)=>{g.fillText(`${label} — ${l}`,x+4,24);g.drawImage(im,x,top,ws[i],H);x+=ws[i]+pad});
  return new Promise(r=>cv.toBlob(r,'image/jpeg',.85))}
async function ciCompare(){const c=ciCurrent(),p=c&&ciPrev(c.date);if(!c||!p||!S.sample)return;S.ciAi='busy';render();
  try{const [a,b]=[await ciComposite(p,'Previous'),await ciComposite(c,'This week')];
    const m=CI_MEAS.map(([k,l])=>c.meas[k]!=null&&p.meas&&p.meas[k]!=null?`${l} ${r1(lOut(p.meas[k]))} → ${r1(lOut(c.meas[k]))} ${lU()}`:null).filter(Boolean);
    const days=Math.round((new Date(c.date)-new Date(p.date))/864e5);
    const prompt=`You are a supportive, knowledgeable fitness coach reviewing a client's weekly progress photos for them.
Image 1 is the previous check-in (${p.date}); image 2 is this check-in (${c.date}), ${days} days later. Each image shows the same poses side by side, labelled.
${c.avg!=null&&p.avg!=null?`Average weight over the week: ${r1(wOut(p.avg))} → ${r1(wOut(c.avg))} ${wU()}.`:''}${m.length?' Measurements: '+m.join('; ')+'.':''}
Compare the photos and describe what has visibly changed, area by area (for example shoulders, arms, chest, waist and midsection, hips, legs, back, posture). Be specific about where you see change and say plainly where you can't see a difference — a week is short and small changes are normal.
Note briefly if differences in lighting, pose, distance, time of day or clothing make a fair comparison harder, with one practical tip for more consistent photos.
Tone: encouraging, honest and neutral. Talk about progress, not appearance — no comments on attractiveness, no body-fat percentage guesses, no diet or weight-loss targets, no medical claims.
Write 120–200 words in plain text: one short summary sentence, then 3–5 short lines starting with "• ", then one encouraging closing line.`;
    const r=await S.sample(prompt,{images:[a,b]});c.ai={text:r.text.trim(),vs:p.id,vsDate:p.date,at:new Date().toISOString()};saveCheckin(c);S.ciAi=null;
  }catch(e){console.warn('ciCompare',e);S.ciAi='err:'+(typeof aiErrMsg==='function'?aiErrMsg(e):(e.message||e))}
  render()}
function vCheckin(){
  const date=S.ciDate||today(),c=ciCurrent()||ciRefreshStats({date,meas:{},photos:{}}),prev=ciPrev(date),wk=ciWeek(date);
  const avg=wk.avg,bmi=ciBmi(avg!=null?avg:latestWeight(date)),pv=prev||{meas:{},photos:{}};
  const fw=x=>r1(wOut(x)).toFixed(1),fl=x=>r1(lOut(x)).toFixed(1);
  let h=`<div class="datebar"><h2>Weekly check-in</h2><input type="date" id="ci-date" class="inp" value="${date}" max="${today()}" aria-label="Check-in date"></div><div class="grid"><div class="stack">`;
  h+=`<div class="tiles" style="grid-template-columns:1fr 1fr"><div class="tile"><div class="l">7-day average weight</div><div class="v">${avg!=null?fw(avg):'—'}<span class="faint" style="font-size:14px"> ${wU()}</span></div><div class="s">${avg!=null?`${wk.n} weigh-in${wk.n===1?'':'s'} · ${esc(nice(addDays(date,-6),{month:'short',day:'numeric'}))}–${esc(nice(date,{month:'short',day:'numeric'}))}`:'Log your weight on the Diary to fill this in'} ${prev?ciDelta(avg,prev.avg,fw,wU()):''}</div></div>
    <div class="tile"><div class="l">BMI</div><div class="v">${bmi!=null?r1(bmi).toFixed(1):'—'}</div><div class="s">${bmi!=null?`from your height in Settings ${prev?ciDelta(bmi,prev.bmi,x=>x.toFixed(1)):''}`:'Add your height in Settings'}</div></div></div>`;
  h+=`<section class="card"><div class="spread"><h3 style="font-size:18px">Measurements</h3><span class="faint">${lU()}${prev?` · last: ${esc(nice(prev.date,{month:'short',day:'numeric'}))}`:''}</span></div><div class="cim">${CI_MEAS.map(([k,l])=>{const v=c.meas[k],pvv=pv.meas&&pv.meas[k];
    return `<label class="field">${l}<input class="inp ci-m" data-k="${k}" inputmode="decimal" value="${v!=null?fl(v):''}" placeholder="${pvv!=null?fl(pvv):''}">${ciDelta(v,pvv,fl,lU())}</label>`}).join('')}</div>
    <p class="faint" style="font-size:13px;margin:10px 0 0">Measure at the same time of day each week, relaxed, tape snug but not tight. Saves as you go.</p></section>`;
  h+=`<section class="card"><div class="spread"><h3 style="font-size:18px">Progress photos</h3><span class="faint">🔒 only you can see these</span></div><div class="ciph">${CI_POSES.map(([k,l])=>{const pth=c.photos&&c.photos[k];
    return `<div class="cislot"><button class="ciimg" data-act="ciphoto" data-p="${k}" aria-label="${pth?'Replace':'Add'} ${l} photo">${S.ciBusy===k?'<span class="spin"></span>':pth?`<img data-path="${esc(pth)}" alt="${l}">`:'<span class="ciplus">+</span>'}</button><div class="cil">${l}${pth?` <button class="x sm" data-act="ciphotodel" data-p="${k}" aria-label="Remove ${l} photo">×</button>`:''}</div></div>`}).join('')}</div>
    <p class="faint" style="font-size:13px;margin:10px 0 0">Same spot, same light, same distance each week makes the comparison much fairer.</p><input type="file" id="ci-file" accept="image/*" hidden></section>`;
  const both=prev&&CI_POSES.some(([k])=>c.photos&&c.photos[k])&&CI_POSES.some(([k])=>pv.photos&&pv.photos[k]);
  h+=`</div><div class="stack"><section class="card"><h3 style="font-size:18px">Compare with last check-in</h3>`;
  if(!prev)h+=`<p class="faint" style="margin:8px 0 0">After your second check-in you’ll see the photos side by side here, and can ask Claude what’s changed.</p>`;
  else{const pose=S.ciPose||'front';
    h+=`<div class="chips" style="margin-top:8px">${CI_POSES.map(([k,l])=>`<button class="chip ${pose===k?'on':''}" data-act="ciposesel" data-p="${k}">${l}</button>`).join('')}</div>
    <div class="cicmp"><figure>${pv.photos&&pv.photos[pose]?`<img data-path="${esc(pv.photos[pose])}" alt="">`:'<div class="ciempty">No photo</div>'}<figcaption>${esc(nice(prev.date,{month:'short',day:'numeric'}))}</figcaption></figure><figure>${c.photos&&c.photos[pose]?`<img data-path="${esc(c.photos[pose])}" alt="">`:'<div class="ciempty">No photo</div>'}<figcaption>${esc(nice(date,{month:'short',day:'numeric'}))}</figcaption></figure></div>`;
    const ai=c.ai&&c.ai.vs===prev.id?c.ai:null;
    if(ai)h+=`<div class="ciai"><div class="faint" style="font-size:12px;margin-bottom:4px">✨ Claude’s comparison · ${esc(nice(prev.date,{month:'short',day:'numeric'}))} → ${esc(nice(date,{month:'short',day:'numeric'}))}</div>${esc(ai.text)}</div>`;
    if(S.ciAi&&S.ciAi.startsWith('err:'))h+=`<div class="notice warn" style="margin-top:10px">${esc(S.ciAi.slice(4))}</div>`;
    h+=`<div class="row" style="margin-top:12px"><button class="btn ${ai?'':'primary'}" data-act="cicompare" ${!both||S.ciAi==='busy'||!S.sample?'disabled':''}>${S.ciAi==='busy'?'<span class="spin"></span> Comparing…':ai?'Compare again':'✨ Compare photos with Claude'}</button></div>
    <p class="faint" style="font-size:12px;margin:8px 0 0">${both?'Sends these two check-ins’ photos to Claude only when you tap. Feedback is a rough guide, not medical advice.':'Add photos to both check-ins to compare.'}</p>`}
  h+=`</section>`;
  const list=checkins();
  h+=`<section class="card"><h3 style="font-size:18px">History</h3>${list.length?`<div class="rlist">${list.map((x,i)=>{const nx=list[i+1];return `<button class="res cihist ${x.date===date?'on':''}" data-act="ciopen" data-d="${x.date}"><span class="t"><div class="nm">${esc(nice(x.date,{weekday:'short',month:'short',day:'numeric'}))}</div><div class="sub">${x.avg!=null?fw(x.avg)+' '+wU():'no weight'}${x.meas&&x.meas.waist!=null?` · waist ${fl(x.meas.waist)} ${lU()}`:''}${Object.keys(x.photos||{}).filter(k=>x.photos[k]).length?` · 📷 ${Object.keys(x.photos).filter(k=>x.photos[k]).length}`:''}${x.ai?' · ✨':''}</div></span>${nx?ciDelta(x.avg,nx.avg,fw,wU()):''}</button>`}).join('')}</div>`:'<p class="faint" style="margin:8px 0 0">Your check-ins will be listed here. Add a measurement or photo to save this one.</p>'}
  ${ciCurrent()?`<div class="row" style="margin-top:12px"><button class="btn ghost sm" data-act="cidel">Delete this check-in</button></div>`:''}</section></div></div>`;
  setTimeout(ciHydrate,0);
  return h;
}
const CACT={
  ciphoto:el=>{S.ciPick=el.dataset.p;const f=$('#ci-file');if(f){f.value='';f.click()}},
  ciphotodel:el=>{const c=ciCurrent();if(!c)return;const pth=c.photos[el.dataset.p];delete c.photos[el.dataset.p];if(c.ai)delete c.ai;saveCheckin(c);if(pth)sb.storage.from(CI_BUCKET).remove([pth]);render()},
  ciposesel:el=>{S.ciPose=el.dataset.p;render()},
  cicompare:()=>ciCompare(),
  ciopen:el=>{S.ciDate=el.dataset.d;S.ciAi=null;render();window.scrollTo(0,0)},
  cidel:async()=>{if(!confirmReplace())return;const c=ciCurrent();if(!c)return;const paths=Object.values(c.photos||{}).filter(Boolean);
    const doc=get('checkins')||{list:[]};doc.list=(doc.list||[]).filter(x=>x.id!==c.id);put('checkins',doc);if(paths.length)sb.storage.from(CI_BUCKET).remove(paths);toast('Check-in deleted');render()},
};
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='ci-file'&&t.files&&t.files[0]&&S.ciPick){ciUpload(S.ciPick,t.files[0]);return}
  if(t.id==='ci-date'){S.ciDate=t.value>today()?today():t.value;S.ciAi=null;render();return}
  if(t.classList&&t.classList.contains('ci-m')){const c=ciEnsure(),v=parseFloat(String(t.value).replace(',','.'));
    if(isNaN(v)||v<=0)delete c.meas[t.dataset.k];else c.meas[t.dataset.k]=r2(lIn(v));ciRefreshStats(c);saveCheckin(c);t.blur();render()}
});
// Remove the person's photos too when they delete their account
async function ciDeleteAllPhotos(){try{const {data}=await sb.storage.from(CI_BUCKET).list(S.uid,{limit:1000});if(data&&data.length)await sb.storage.from(CI_BUCKET).remove(data.map(f=>`${S.uid}/${f.name}`))}catch(e){}}

/* ---------- exercise library (free-exercise-db, public domain) + How-to ---------- */
const FX={list:[],byId:{},link:{},imgBase:'',loaded:false,loading:null};
function loadFx(){if(FX.loading)return FX.loading;FX.loading=fetch('data/exercises.json').then(r=>r.json()).then(d=>{
  FX.imgBase=d.imgBase;FX.link=d.link||{};
  for(const x of d.list){FX.byId[x.id]=x;if(!x.dup)FX.list.push({id:x.id,name:x.n,group:x.g,kind:x.k,met:x.k==='c'?7:null})}
  FX.loaded=true;_exIdx=null;if(S.view==='workouts'||S.view==='trends')render();if(M&&(M.pick||M.kind==='pick'||M.kind==='howto'))drawModal(false);
}).catch(()=>{FX.loading=null});return FX.loading}
let _exIdx=null,_exRef=null,_exTmp=0;
function exIndex(){const ref=get('exercises');if(!_exIdx||_exRef!==ref||_exTmp!==(S.tmpEx||[]).length){_exRef=ref;_exTmp=(S.tmpEx||[]).length;_exIdx=new Map();for(const e of exList())_exIdx.set(e.id,e)}return _exIdx}
const fxRow=id=>FX.byId[id]||FX.byId[FX.link[id]]||null;
const EQ_FILTERS=[['','Any equipment'],['body only','Body only'],['dumbbell','Dumbbell'],['barbell','Barbell'],['kettlebells','Kettlebell'],['cable','Cable'],['machine','Machine'],['bands','Bands'],['other','Other']];
const GROUPS=['Chest','Back','Shoulders','Arms','Legs','Glutes','Core','Full body','Cardio','Stretching','Neck','Custom'];
function pickResults(){
  const q=(M.pq||'').toLowerCase().trim(),g=M.pg||'',eq=M.pe||'';
  const all=exList(),mine=EXLIB.concat(((get('exercises')||{}).list)||[],S.tmpEx||[]);
  const pool=!q&&!g&&!eq?mine:all;
  const words=q.split(/\s+/).filter(Boolean);
  let res=pool.filter(e=>{const row=fxRow(e.id);
    if(g&&e.group!==g)return false;if(eq&&!(row&&row.eq===eq))return false;
    const hay=(e.name+' '+e.group+' '+(row?row.pm.join(' ')+' '+row.eq:'')).toLowerCase();return words.every(w=>hay.includes(w))});
  if(q)res.sort((a,b)=>(b.name.toLowerCase().startsWith(q)-a.name.toLowerCase().startsWith(q))||(mine.includes(b)-mine.includes(a))||a.name.length-b.name.length);
  const more=res.length>80;res=res.slice(0,80);
  const groups={};for(const e of res)(groups[e.group]=groups[e.group]||[]).push(e);
  return pickList(groups)+(more?'<p class="faint" style="padding:8px 4px">Showing the first 80 — type more to narrow it down.</p>':'')+
    (!q&&!g&&!eq?`<p class="faint" style="padding:8px 4px">${FX.loaded?`Search or filter to see all ${exList().length} exercises.`:'<span class="spin"></span> Loading the full exercise library…'}</p>`:'')}
function howtoBody(inPicker){const e=exById(M.howto||M.id),row=fxRow(e.id);
  const back=`<button class="btn ghost sm" data-act="howtoback" style="white-space:nowrap">‹ Back</button>`;
  if(!row)return `<div class="sheet-h">${back}<h3>${esc(e.name)}</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b"><p class="faint">No how-to for this exercise yet.</p></div>`;
  const chips=[row.lv&&row.lv[0].toUpperCase()+row.lv.slice(1),row.eq&&row.eq!=='other'&&row.eq[0].toUpperCase()+row.eq.slice(1)].filter(Boolean);
  return `<div class="sheet-h">${back}<h3 style="margin-left:4px">${esc(e.name)}</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  ${row.img.length?`<div class="hximg">${row.img.slice(0,2).map((p,i)=>`<figure><img src="${esc(FX.imgBase+p)}" alt="${esc(e.name)} — ${i?'finish':'start'}" loading="lazy"><figcaption>${i?'Finish':'Start'}</figcaption></figure>`).join('')}</div>`:''}
  <div class="chips" style="margin:10px 0 4px">${chips.map(c=>`<span class="tag">${esc(c)}</span>`).join('')}${row.pm.map(m=>`<span class="tag mine">${esc(m)}</span>`).join('')}${row.sm.map(m=>`<span class="tag">${esc(m)}</span>`).join('')}</div>
  ${row.ins.length?`<ol class="hxsteps">${row.ins.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}
  <p class="faint" style="font-size:12px">From free-exercise-db (public domain). Move within a comfortable range and stop if anything hurts.</p>
  ${inPicker?`<div class="row floatadd"><button class="btn primary" data-act="pickex" data-id="${esc(e.id)}">Add ${esc(e.name)}</button></div>`:''}</div>`}

/* ---------- build a routine with Claude ---------- */
const BUILD_EXAMPLES=['3-day full body, dumbbells only, 45 min','Push day for hypertrophy','20-minute bodyweight HIIT at home','Boxing bag rounds, 6 × 3 min','Beginner 5k run plan session'];
function buildBody(){const b=M;
  return `<div class="sheet-h"><h3>✨ Build a routine with Claude</h3><button class="x" data-act="close" aria-label="Close">×</button></div><div class="sheet-b">
  <label class="field">What do you want to train?<textarea id="bd-in" class="inp" rows="3" placeholder="e.g. Upper body, 45 minutes, dumbbells and a bench, intermediate" ${b.busy?'disabled':''}>${esc(b.text||'')}</textarea></label>
  <div class="chips" style="margin-top:8px">${BUILD_EXAMPLES.map(x=>`<button class="chip" data-act="bdex" data-t="${esc(x)}">${esc(x)}</button>`).join('')}</div>
  <div class="row" style="margin-top:12px"><label class="btn">${b.photo?'📷 Change photo':'📷 Photo of a workout plan'}<input type="file" id="bd-file" accept="image/*" hidden></label>${b.photo?`<span class="faint">${esc(b.photoName||'Photo added')} <button class="x sm" data-act="bdnophoto" aria-label="Remove photo">×</button></span>`:'<span class="faint">optional — a printed program, whiteboard or screenshot</span>'}</div>
  ${b.err?`<div class="notice warn" style="margin-top:12px">${esc(b.err)}</div>`:''}
  <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" data-act="bdrun" ${b.busy?'disabled':''}>${b.busy?'<span class="spin"></span> Building…':'Build routine'}</button></div>
  <p class="faint" style="font-size:12px;margin:8px 0 0">You can change anything before saving. Claude’s plan is a starting point, not medical advice.</p></div>`}
const normEx=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w&&!['the','a','an','with','and','on','of','to','exercise'].includes(w)).map(w=>w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w);
let _fxTok=null;
function matchEx(name){const a=new Set(normEx(name));if(!a.size)return null;
  const mine=EXLIB.concat(((get('exercises')||{}).list)||[],S.tmpEx||[]);
  if(!_fxTok||_fxTok.n!==FX.list.length)_fxTok={n:FX.list.length,list:FX.list.map(e=>[e,new Set(normEx(e.name))])};
  let best=null,bs=0;const score=(e,b,bonus)=>{let i=0;for(const w of a)if(b.has(w))i++;const s=i/(a.size+b.size-i)+(bonus||0);if(s>bs){bs=s;best=e}};
  for(const e of mine){score(e,new Set(normEx(e.name)),.12);const al=FX.link[e.id]&&FX.byId[FX.link[e.id]];if(al)score(e,new Set(normEx(al.n)),.12)}for(const [e,b] of _fxTok.list)score(e,b,0);
  return bs>=.5?best:null}
function routineFromAi(j){
  if(/interval|round/i.test(j.kind||'')){const round=/round/i.test(j.style||'');
    return {kind:round?'round':'routine',r:{id:'r'+newId(),name:String(j.name||(round?'Rounds':'Intervals')).slice(0,40),kind:'int',int:round?{style:'round',warm:+j.warmup||10,work:+j.work||180,rest:+j.rest||60,rounds:+j.rounds||6,warn:10,cool:0}:{warm:+j.warmup||60,work:+j.work||40,rest:+j.rest||20,rounds:+j.rounds||8,cool:+j.cooldown||60}}}}
  const KIND={weight:'w',bodyweight:'bw',timed:'t',cardio:'c'};S.tmpEx=S.tmpEx||[];const items=[];
  for(const it of (j.items||[]).slice(0,20)){if(!it||!it.exercise)continue;let ex=matchEx(it.exercise);
    if(!ex){ex={id:'x'+newId(),name:String(it.exercise).slice(0,60),group:'Custom',kind:KIND[it.type]||'w',met:it.type==='cardio'?7:null};S.tmpEx.push(ex)}
    const n=v=>{v=parseInt(v);return isNaN(v)||v<=0?null:v};
    items.push(ex.kind==='c'?{ex:ex.id,min:n(it.minutes)||20,dist:''}:ex.kind==='t'?{ex:ex.id,sets:n(it.sets)||3,secs:n(it.seconds)||45,rest:n(it.rest)||60}:{ex:ex.id,sets:n(it.sets)||3,reps:n(it.reps)||10,wt:'',rest:n(it.rest)||90})}
  if(!items.length)return null;
  return {kind:'routine',r:{id:'r'+newId(),name:String(j.name||'New routine').slice(0,40),kind:'std',items},note:j.notes?String(j.notes).slice(0,300):''}}
async function buildRun(){const ta=$('#bd-in');M.text=ta?ta.value.trim():M.text;if(!M.text&&!M.photo){M.err='Describe what you want, or add a photo of a plan.';drawModal(false);return}
  if(!S.sample){M.err='Claude features aren’t available right now.';drawModal(false);return}
  M.busy=true;M.err='';drawModal(false);await loadFx().catch(()=>{});
  const names=EXLIB.map(e=>e.name).join(', ');
  const prompt=`You are an experienced strength and conditioning coach building one workout routine for the Tally app.
${M.photo?'The attached photo shows a workout plan. Turn it into a routine faithfully — keep its exercises, sets, reps and times; read every line. Use the request below only as extra guidance.\n':''}Request: ${M.text||'(see photo)'}
Units: ${imperial()?'pounds, miles':'kilograms, kilometres'}.
Reply with ONLY one JSON object, no prose and no code fences, in one of these shapes:
Strength / cardio / mixed: {"name":"short name, max 40 chars","kind":"std","notes":"one short sentence of guidance","items":[{"exercise":"common exercise name","type":"weight|bodyweight|timed|cardio","sets":3,"reps":10,"seconds":45,"minutes":20,"rest":90}]}
Only include seconds for timed holds and minutes for cardio. For a rep range give the lower number. rest is in seconds.
Interval or round timer (only for things like HIIT, tabata or boxing rounds that are one repeating timer): {"name":"…","kind":"interval","style":"interval|round","work":40,"rest":20,"rounds":8,"warmup":60}
Use these exercise names when they fit: ${names}. Otherwise use clear, standard gym names (e.g. "Dumbbell Bench Press", "Cable Crossover", "Box Jump").
Match the time, equipment and level asked for; usually 4–8 exercises. Keep it safe and realistic.`;
  try{const imgs=M.photo?[await shrinkPhoto(M.photo,1600)]:[];const r=await S.sample(prompt,{images:imgs});
    const m=String(r.text||'').match(/\{[\s\S]*\}/);if(!m)throw new Error('Claude didn’t return a routine — try rewording.');
    const out=routineFromAi(JSON.parse(m[0]));if(!out)throw new Error('Claude didn’t include any exercises — try adding more detail.');
    openModal({kind:out.kind,isNew:true,r:out.r,aiNote:out.note||'Built by Claude'});
  }catch(e){M.busy=false;M.err=e.code?aiErrMsg(e):(e.message||'Something went wrong');drawModal(false)}}
const XACT={
  howto:el=>{const id=el.dataset.id;loadFx();if(M&&(M.pick||M.kind==='pick')){M.howto=id;drawModal(false);$('#modal').scrollTop=0}else openModal({kind:'howto',id})},
  howtoback:()=>{if(M.kind==='howto'){closeModal();return}M.howto=null;drawModal(false)},
  buildopen:()=>{openModal({kind:'build',text:''});loadFx()},
  bdex:el=>{M.text=el.dataset.t;drawModal(false)},
  bdnophoto:()=>{M.photo=null;M.photoName='';drawModal(false)},
  bdrun:()=>buildRun(),
};
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='bd-file'&&t.files&&t.files[0]&&M&&M.kind==='build'){const ta=$('#bd-in');if(ta)M.text=ta.value;M.photo=t.files[0];M.photoName=t.files[0].name;M.err='';drawModal(false)}
  if((t.id==='pg'||t.id==='pe')&&M){M[t.id]=t.value;loadFx();const r=$('#pres');if(r)r.innerHTML=pickResults()}
});

const ACT={
  day:el=>{S.date=addDays(S.date,+el.dataset.n);render()},
  today:()=>{S.date=today();render()},
  add:el=>{loadDB();openModal({kind:'food',tab:'search',meal:el.dataset.meal,q:''})},
  tab:el=>{if(el.dataset.seed&&M.q)M.aiText=M.q;M.tab=el.dataset.tab;drawModal()},
  pick:el=>{const f=M.cache[el.dataset.fid];if(!f)return;M.sel=f;M.qty=1;M.pi=0;drawModal()},
  back:()=>{M.sel=null;if(M.editId){closeModal();return}drawModal()},
  close:closeModal,
  savefood:saveFood,
  edit:el=>{
    const e=day(S.date).foods.find(x=>x.id===el.dataset.id);if(!e)return;
    if(e.per){const base=DB.map[e.fid]||customs().find(c=>c.id===e.fid);let portions=base?base.portions.slice():[];
      if(!portions.some(p=>p[0]===e.unit&&p[1]===e.unitG))portions.unshift([e.unit||'g',e.unitG||1]);
      const pi=portions.findIndex(p=>p[0]===e.unit&&p[1]===e.unitG);
      openModal({kind:'food',meal:e.meal,editId:e.id,sel:{id:e.fid,name:e.name,per:e.per,portions},qty:e.qty,pi:Math.max(0,pi)});
    }else openModal({kind:'food',tab:'quick',meal:e.meal,editId:e.id,quick:e});
  },
  delfood:el=>{const d=day(S.date);const i=d.foods.findIndex(x=>x.id===el.dataset.id);if(i<0)return;const [gone]=d.foods.splice(i,1);if(M)closeModal();put(dk(S.date),d);toast(`Removed ${gone.name}`)},
  delex:el=>{const d=day(S.date);d.ex=d.ex.filter(x=>x.id!==el.dataset.id);put(dk(S.date),d);if(el.dataset.id.startsWith('hc-')){const h=Object.assign({ignored:[]},get('hc')||{});if(!h.ignored.includes(el.dataset.id)){h.ignored=h.ignored.concat([el.dataset.id]).slice(-500);put('hc',h)}}},
  addex:()=>openModal({kind:'ex'}),
  saveex:saveEx,
  water:el=>{const d=day(S.date),n=+el.dataset.n;d.water=d.water===n?n-1:n;put(dk(S.date),d)},
  copymeal:el=>{const mk=el.dataset.meal,d=day(S.date),p=day(addDays(S.date,-1)).foods.filter(e=>e.meal===mk&&!d.foods.some(x=>x.meal===mk&&x.name===e.name));if(!p.length)return;d.foods=d.foods.concat(p.map(e=>Object.assign({},e,{id:newId()})));put(dk(S.date),d);toast(`Copied ${p.length} food${p.length>1?'s':''} to ${mealName(mk)}`)},
  copyprev:()=>{const p=day(addDays(S.date,-1)),d=day(S.date);d.foods=d.foods.concat(p.foods.map(e=>Object.assign({},e,{id:newId()})));put(dk(S.date),d);toast('Copied from the previous day')},
  range:el=>{S.range=+el.dataset.n;render()},
  saveprofile:saveProfile,
  airun:aiRun,
  airm:el=>{M.ai.splice(+el.dataset.i,1);drawModal(false)},
  aiadd:aiAdd,
  savecustom:saveCustom,
  pickoff:async el=>{const code=el.dataset.code,m=M;el.disabled=true;let p=null;try{p=await offLookup(code)}catch(e){}if(M!==m)return;if(!p){toast('Couldn’t load that product');el.disabled=false;return}M.sel=p;M.qty=1;M.pi=0;drawModal()},
  fixoff:()=>{const f=M.sel,g=f.portions[0][0]==='oz'?100:f.portions[0][1];const vals={};KEYS.forEach(k=>vals[k]=f.per[k]==null?null:r2(f.per[k]*g/100));const meal=M.meal;M={kind:'food',tab:'custom',meal,code:f.code,prefill:{name:f.name,sv:f.portions[0][0]==='oz'?'100 g':f.portions[0][0],g,vals}};drawModal()},
  bclookup:()=>{const v=$('#bc-num').value,c=normCode(v);if(!c||!checkOK(c)){M.scan={stage:'start',typed:v,err:'That doesn’t look like a valid barcode number — check the digits.'};drawModal(false);return}gotCode(c)},
  bcmanual:()=>{M.code=M.scan.code;M.tab='custom';M.prefill=null;drawModal()},
  bcreset:()=>{M.scan={stage:'start'};drawModal(false)},
  bcclaude:bcClaude,
  savequick:saveQuick,
  newcustom:()=>openModal({kind:'food',tab:'custom',meal:'s',fromFoods:true}),
  newscan:()=>{loadDB();openModal({kind:'food',tab:'scan',meal:'s'})},
  delcustom:el=>{const doc=get('custom')||{foods:[]};doc.foods=doc.foods.filter(f=>f.id!==el.dataset.id);put('custom',doc);toast('Food deleted')},
  export:async()=>{const txt=JSON.stringify(S.docs,null,1);try{await navigator.clipboard.writeText(txt);toast('Copied your data to the clipboard')}catch(e){toast('Copy was blocked by the browser')}}
};
Object.assign(ACT,WACT,SACT,AACT,HACT,MACT,VACT,FACT,TACT,CACT,XACT);
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');
  if(!el){if(e.target.id==='modal')closeModal();return}
  e.preventDefault();const f=ACT[el.dataset.act];if(f)f(el,e);
});
document.addEventListener('input',e=>{
  const id=e.target.id;
  if(id==='fq'){M.q=e.target.value;if(M.q.trim().length>=3)offSearchLater(M.q.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9%]+/g,' ').trim());$('#fres').innerHTML=results()}
  else if(id==='qty'){$('#prev').innerHTML=preview()}
  else if(id==='x-min')exCalc();
  else if(id==='ai-in'&&M)M.aiText=e.target.value;
  else if(id==='ws-name'&&S.ws){S.ws.name=e.target.value;saveWs()}
  else if(e.target.classList.contains('si')&&S.ws)wsInput(e.target);
  else if(id==='pq'&&M){M.pq=e.target.value;$('#pres').innerHTML=pickResults()}
  else if(/^rc-/.test(id)&&M&&M.kind==='round'){readRound();const t=$('#rc-total');if(t)t.textContent='Total: '+mmss(intPlan(M.r.int).reduce((a,x)=>a+x[1],0))+' · bell starts and ends each round'+(+M.r.int.warn?`, knock ${M.r.int.warn}s before the end`:'')}
  else if(e.target.dataset.ik!==undefined&&M&&M.r){readRoutineInputs();const t=$('#int-total');if(t)t.textContent='Total: '+mmss(intPlan(M.r.int).reduce((a,x)=>a+x[1],0))}
});
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(id==='bc-file'&&e.target.files[0]&&M){onBarcodeFile(e.target.files[0]);return}
  if(id==='lbl-file'&&e.target.files[0]&&M){onLabelFile(e.target.files[0]);return}
  if(id==='por'){$('#prev').innerHTML=preview()}
  else if(id==='meal'&&M)M.meal=e.target.value;
  else if(id==='x-act')exCalc();
  else if(e.target.classList.contains('restsel')&&S.ws){S.ws.items[+e.target.dataset.i].rest=+e.target.value;saveWs()}
  else if(id==='wex'){S.wex=e.target.value;e.target.blur();render()}
  else if(id==='mdock'){try{localStorage.setItem('tally.musicdock',e.target.checked?'1':'0')}catch(err){}updateDock()}
  else if(e.target.classList.contains('hctog')){const p=hcPrefs();p[e.target.dataset.k]=e.target.checked;setHcPrefs(p);if(e.target.checked)hcSync(true,true)}
  else if(e.target.classList.contains('sharetog')){const s=get('sharing')||{};s[e.target.dataset.k]=e.target.checked;put('sharing',s);toast('Sharing updated')}
  else if(id==='dpick'&&e.target.value){S.date=e.target.value;render()}
  else if(id==='wt'){const v=parseFloat(e.target.value);const doc=get('weights')||{e:{}};doc.e=doc.e||{};if(isNaN(v)||v<=0)delete doc.e[S.date];else doc.e[S.date]=r2(wIn(v));if(doc.hc)delete doc.hc[S.date];e.target.blur();put('weights',doc);toast(isNaN(v)?'Weight cleared':'Weight logged')}
  else if(id==='s-units'){const im=e.target.value==='imperial',h=$('#s-h'),w=$('#s-w');const hv=parseFloat(h.value),wv=parseFloat(w.value);
    if(!isNaN(hv))h.value=(im?hv/2.54:hv*2.54).toFixed(1);if(!isNaN(wv))w.value=(im?wv*2.20462:wv/2.20462).toFixed(1);$('#u-h').textContent=im?'in':'cm';$('#u-w').textContent=im?'lb':'kg'}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&S.fabOpen){S.fabOpen=false;updateFab();return}
  if(e.key==='Enter'&&e.target.id==='wt-m'){e.preventDefault();ACT.wtsave();return}
  if(e.key==='Enter'&&!e.shiftKey){const id=e.target.id;if(id==='msg-in'){e.preventDefault();ACT.sendmsg();return}if(id==='inv-email'){e.preventDefault();ACT.sendinvite($('[data-act=sendinvite]'));return}if(id==='au-email'){e.preventDefault();ACT.ausend($('[data-act=ausend]'));return}if(id==='au-code'){e.preventDefault();ACT.auverify($('[data-act=auverify]'));return}}
  if(e.key==='Escape'&&M){closeModal();return}
  if(e.key==='Enter'&&M){const id=e.target.id;
    if(id==='fq'){const first=$('#fres .res');if(first)first.click()}
    else if(id==='bc-num')ACT.bclookup();
    else if(id==='pq'){const f=$('#pres .res');if(f)f.click()}
    else if(id==='qty'||id==='por')saveFood();
    else if(id==='ai-in'&&(e.metaKey||e.ctrlKey))aiRun();
  }
});
function route(){const h=location.hash.slice(1);S.view=['diary','workouts','social','trends','foods','profile','checkin'].includes(h)?h:'diary';closeModal();render();window.scrollTo(0,0)}
window.addEventListener('hashchange',()=>{if(S.uid)route()});
boot();
setTimeout(loadDB,600);

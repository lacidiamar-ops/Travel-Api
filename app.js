'use strict'

const SUPABASE_URL='https://vjulagaprzbnquynwjmt.supabase.co'
const SUPABASE_KEY='sb_publishable_iT2AHtS29Qi63weZslm56g_oHkqbcvK'
const TEAM=[
  {id:'d3cfc0c3-cde3-49c9-ab83-1e6f7175ae49',email:'profile-01@travel.local',name:'Amar Lacidi',first:'Amar',role:'Directeur de la restauration',initials:'AL',color:'#0b83c9',manager:true},
  {id:'ac71ad88-9757-4f93-808a-9f91dec68f5d',email:'profile-02@travel.local',name:'Igal Settbon',first:'Igal',role:'Chef de cuisine',initials:'IS',color:'#d5a940'},
  {id:'30f5e6a8-91e6-4fdb-9626-703dc41d0faa',email:'profile-03@travel.local',name:'Bastien Florido',first:'Bastien',role:"Maître d'hôtel",initials:'BF',color:'#4058a8'},
  {id:'88783ee8-d980-4f39-9608-c6b3251b8aef',email:'profile-04@travel.local',name:'Damien Cau',first:'Damien',role:'Second de cuisine',initials:'DC',color:'#23846f'}
]
const ROSTER_COUNTS={'Amar Lacidi':5,'Igal Settbon':7,'Bastien Florido':5,'Damien Cau':5}
const FALLBACK_APPS=[
  {app_type:'hotel_audit',label:'Audit Hôtel',description:"Contrôle de l'hôtel et suivi des corrections",logo:'assets/apps/audit-hotel.svg'},
  {app_type:'cahier_des_charges',label:'Cahier des charges',description:'Consignes hôtel, déplacement et chiffrage',logo:'assets/apps/cahier-des-charges.svg'},
  {app_type:'after_match_meals',label:'Repas après-match',description:'Choix et organisation des repas après-match',logo:'assets/apps/repas-apres-match.svg'}
]
const CONTACTS=[
  {name:'Léo Tagawa',role:'Travel Manager OM'},
  {name:'Stéphane Saliu',role:'Travel / organisation'}
]

const state={sb:null,current:null,pin:'',selected:null,page:'home',missions:[],matches:[],assignments:[],legs:[],documents:[],apps:[],inbox:[],changes:[],members:[],refreshTimer:null}
const $=id=>document.getElementById(id)
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const safeUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}}
const dateOf=m=>state.matches.find(x=>x.id===m.match_id)?.kickoff_at||m.starts_at
const matchOf=m=>state.matches.find(x=>x.id===m.match_id)||{}
const missionOf=id=>state.missions.find(x=>x.id===id)
const isFuture=m=>!dateOf(m)||new Date(dateOf(m)).getTime()>=Date.now()-86400000
const fmtDate=value=>value?new Intl.DateTimeFormat('fr-FR',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Paris'}).format(new Date(value)):'Date à confirmer'
const fmtDateTime=value=>value?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'}).format(new Date(value)):'À confirmer'
const daysUntil=value=>Math.ceil((new Date(value).setHours(0,0,0,0)-new Date().setHours(0,0,0,0))/86400000)
const initials=name=>name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()
const isPrioritySource=item=>/l[ée]o\s+tagawa|stephane\s+saliu|st[ée]phane\s+saliu/i.test(`${item?.sender_name||''} ${item?.sender_address||''}`)
const missionDocs=id=>state.documents.filter(x=>x.mission_id===id)
const missionInbox=id=>state.inbox.filter(x=>x.matched_mission_id===id)
const seenKey=()=>`travel:last-seen:${state.current?.id||'unknown'}`
function freshItems(){
  const saved=Number(localStorage.getItem(seenKey())||0)
  const floor=saved||Date.now()-72*60*60*1000
  const items=[...state.documents.map(x=>({key:x.metadata?.gmail_message_id||x.id,at:x.created_at,label:x.file_name||'Nouveau document'})),...state.inbox.map(x=>({key:x.external_id||x.id,at:x.received_at,label:x.subject||'Nouvelle information'}))]
  const unique=new Map();items.forEach(x=>{const old=unique.get(x.key);if(!old||new Date(x.at)>new Date(old.at))unique.set(x.key,x)})
  return [...unique.values()].filter(x=>new Date(x.at).getTime()>floor).sort((a,b)=>new Date(b.at)-new Date(a.at))
}
function markNewsSeen(){localStorage.setItem(seenKey(),String(Date.now()));updateNotificationUI();if(state.page==='home')go('home')}
function updateNotificationUI(){const count=freshItems().length,badge=$('notificationCount'),button=$('notificationBtn');if(badge)badge.textContent=count>9?'9+':String(count);if(button)button.classList.toggle('has-news',count>0)}

function toast(message,error=false){const el=$('toast');el.textContent=message;el.className='toast show'+(error?' error':'');setTimeout(()=>el.classList.remove('show'),2600)}
function renderProfiles(){
  $('profileGrid').innerHTML=TEAM.map(p=>`<button class="profile-card" data-profile="${p.id}"><span class="profile-avatar" style="--profile:${p.color}">${p.initials}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></span><b>›</b></button>`).join('')
  document.querySelectorAll('[data-profile]').forEach(btn=>btn.onclick=()=>selectProfile(btn.dataset.profile))
  renderKeypad()
}
function renderKeypad(){
  const keys=['1','2','3','4','5','6','7','8','9','effacer','0','⌫']
  $('keypad').innerHTML=keys.map(k=>`<button type="button" data-key="${k}" class="${k==='effacer'?'clear-key':''}">${k}</button>`).join('')
  $('keypad').querySelectorAll('button').forEach(btn=>btn.onclick=()=>pinKey(btn.dataset.key))
}
function selectProfile(id){
  state.selected=TEAM.find(p=>p.id===id);state.pin='';updatePinDots()
  $('profileStep').classList.add('hidden');$('pinStep').classList.remove('hidden')
  $('pinAvatar').textContent=state.selected.initials;$('pinAvatar').style.background=state.selected.color
  $('pinGreeting').textContent=`Bonjour ${state.selected.first}`;$('pinError').textContent=''
}
function updatePinDots(){[...$('pinDots').children].forEach((d,i)=>d.classList.toggle('filled',i<state.pin.length))}
function pinKey(key){
  if(key==='effacer')state.pin='';else if(key==='⌫')state.pin=state.pin.slice(0,-1);else if(state.pin.length<4)state.pin+=key
  updatePinDots();if(state.pin.length===4)login()
}
async function login(){
  $('pinError').textContent='Vérification…'
  try{
    const {data,error}=await state.sb.auth.signInWithPassword({email:state.selected.email,password:state.pin})
    if(error||!data?.user)throw new Error('PIN incorrect')
    state.current=state.selected;await enterApp()
  }catch(error){state.pin='';updatePinDots();$('pinError').textContent=error.message==='PIN incorrect'?'PIN incorrect. Réessayez.':'Connexion indisponible. Réessayez.'}
}
async function enterApp(){
  $('loginScreen').classList.add('hidden');$('appShell').classList.remove('hidden')
  $('topAvatar').textContent=state.current.initials;$('topAvatar').style.background=state.current.color
  $('topName').textContent=state.current.first;$('topRole').textContent=state.current.role
  document.querySelectorAll('.manager-only').forEach(el=>el.classList.toggle('hidden',!state.current.manager))
  await loadData();go('home')
}
async function loadData(showLoading=true){
  if(showLoading)$('pageContent').innerHTML='<div class="loading-card">Synchronisation de vos informations…</div>'
  const queries={
    missions:state.sb.from('travel_missions').select('*').order('starts_at'),
    matches:state.sb.from('travel_matches').select('*').eq('season','2026/27').order('kickoff_at'),
    assignments:state.sb.from('travel_assignments').select('*').order('employee_name'),
    legs:state.sb.from('travel_legs').select('*').order('leg_order'),
    documents:state.sb.from('travel_documents').select('*').order('document_date',{ascending:false}),
    apps:state.sb.from('travel_app_links').select('*').eq('active',true).order('label'),
    members:state.sb.from('travel_team_members').select('*').eq('active',true).order('display_order'),
    inbox:state.sb.from('travel_inbox').select('*').order('received_at',{ascending:false}).limit(40)
  }
  if(state.current.manager)queries.changes=state.sb.from('travel_change_log').select('*').eq('requires_attention',true).is('acknowledged_at',null).order('created_at',{ascending:false})
  const entries=Object.entries(queries);const results=await Promise.all(entries.map(([,query])=>query))
  const failures=[]
  results.forEach((result,i)=>{const key=entries[i][0];if(result.error)failures.push(key);else state[key]=result.data||[]})
  if(failures.length)toast(`Données indisponibles : ${failures.join(', ')}`,true)
  updateNotificationUI()
}
function go(page){
  if(page==='inbox'&&!state.current.manager)page='home';state.page=page
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page))
  const meta={home:['ESPACE PERSONNEL','Accueil'],trips:['SAISON 2026-2027','Déplacements'],documents:['DOSSIER DE VOYAGE','Documents'],apps:['ACCÈS RAPIDES','Applications'],inbox:['SYNCHRONISATION MAIL','Travel Inbox']}
  $('pageEyebrow').textContent=meta[page][0];$('pageTitle').textContent=meta[page][1]
  const pages={home:homePage,trips:tripsPage,documents:documentsPage,apps:appsPage,inbox:inboxPage}
  $('pageContent').innerHTML=pages[page]();bindPage();window.scrollTo({top:0,behavior:'smooth'})
  if(page==='home'){const mission=nextAssignedMission();if(mission)loadWeather(mission,dateOf(mission),'homeWeatherCard')}
}
function bindPage(){
  document.querySelectorAll('[data-mission]').forEach(btn=>btn.onclick=()=>openMission(btn.dataset.mission))
  document.querySelectorAll('[data-offer]').forEach(btn=>btn.onclick=()=>openOffer(btn.dataset.offer))
  document.querySelectorAll('#pageContent [data-page]').forEach(btn=>btn.onclick=()=>go(btn.dataset.page))
  document.querySelectorAll('[data-mark-seen]').forEach(btn=>btn.onclick=markNewsSeen)
  const filter=$('personFilter');if(filter)filter.onchange=()=>renderTripList(filter.value)
}
function appCatalog(){
  const merged=FALLBACK_APPS.map(f=>({...f,...state.apps.find(a=>a.app_type===f.app_type||a.label===f.label)}))
  const extra=state.apps.filter(a=>!merged.some(x=>x.external_key===a.external_key||x.url===a.url))
  return [...merged,...extra.map(a=>({...a,description:'Accès lié au déplacement',logo:'assets/apps/application.svg'}))]
}
function appCards(compact=false){return `<div class="app-grid ${compact?'compact':''}">${appCatalog().map(a=>{const url=safeUrl(a.url);return `<a class="app-card ${url==='#'?'disabled':''}" href="${url}" ${url!=='#'?'target="_blank" rel="noopener"':''}><span class="app-icon"><img src="${esc(a.logo||'assets/apps/application.svg')}" alt=""></span><div><strong>${esc(a.label)}</strong><small>${esc(a.description||'Ouvrir l’application')}</small></div><b>${url==='#'?'—':'↗'}</b></a>`}).join('')}</div>`}
function assignmentNames(missionId){return state.assignments.filter(a=>a.mission_id===missionId).map(a=>a.employee_name)}
function tripCard(m){
  const match=matchOf(m),date=dateOf(m),d=date?daysUntil(date):null,names=assignmentNames(m.id)
  const badge=d===null?'À confirmer':d<0?'Passé':d===0?'Aujourd’hui':`J-${d}`
  return `<button class="trip-card" data-mission="${m.id}"><span class="trip-date"><strong>${date?new Date(date).toLocaleDateString('fr-FR',{day:'2-digit',timeZone:'Europe/Paris'}):'--'}</strong><small>${date?new Date(date).toLocaleDateString('fr-FR',{month:'short',timeZone:'Europe/Paris'}):''}</small></span><span class="trip-main"><span class="trip-top"><em>${esc(match.competition||'Déplacement')}</em><i>${esc(badge)}</i></span><strong>${esc(match.home_team||m.destination_city||m.title)}</strong><small>${esc(m.destination_city||match.city||'Lieu à confirmer')} · ${names.length?esc(names.join(' + ')):'Équipe à définir'}</small></span><span class="trip-progress"><b>${m.completeness_score}%</b><i><u style="width:${m.completeness_score}%"></u></i></span><span class="arrow">›</span></button>`
}
function nextAssignedMission(){return state.missions.filter(m=>isFuture(m)&&assignmentNames(m.id).includes(state.current.name)).sort((a,b)=>new Date(dateOf(a)||'2999')-new Date(dateOf(b)||'2999'))[0]}
function sourceInbox(doc){return state.inbox.find(x=>x.id===doc?.inbox_id)||{}}
function hotelForMission(id){
  const docs=missionDocs(id),direct=hotelName(docs);if(direct)return direct
  const text=missionInbox(id).map(x=>`${x.subject||''} ${x.raw_text||''}`).join(' ')
  const known=text.match(/(?:Novotel Rennes Alma|Marriott[^,.;\n]*|Mercure[^,.;\n]*|Pullman[^,.;\n]*|Novotel[^,.;\n]*)/i)
  return known?.[0]||'Hôtel à confirmer'
}
function currentQuotes(id){return missionDocs(id).filter(x=>x.document_type==='caterer_quote'&&x.metadata?.is_current!==false&&x.metadata?.document_status!=='request').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function supplierName(doc){const meta=doc?.metadata||{},source=sourceInbox(doc);return meta.supplier||meta.supplier_name||source.sender_name||'Prestataire'}
function supplierKey(doc){const name=supplierName(doc);if(/tripletta/i.test(name))return'tripletta';if(/\bmrm\b|monsieur\s+m/i.test(name))return'mrm';return name.toLowerCase().replace(/rennes|mf|traiteur|[^a-z0-9]/g,'')}
function providerLabel(type){return ({pizza:'Pizzeria',pizzeria:'Pizzeria',sushi:'Restaurant sushi',restaurant:'Restaurant',traiteur:'Traiteur'})[type]||'Prestataire'}
function humanQuantity(key){return ({
  tenders_halal:'Tenders de poulet halal',pilons_tex_mex_halal:'Pilons tex-mex halal',mini_croques_dinde_halal:'Mini croque-monsieur dinde halal',cromesquis_pomme_de_terre_emmental:'Cromesquis pomme de terre & emmental',energy_balls_coco:'Energy balls coco',coca_zero_50cl:'Coca-Cola Zéro 50 cl',coca_classique_50cl:'Coca-Cola 50 cl',san_pellegrino_50cl:'San Pellegrino 50 cl',boites_burger:'Boîtes burger',sacs_poubelle_30l:'Sacs-poubelle 30 L',gants_xl:'Paires de gants XL',tables_pliantes:'Tables pliantes avec housse noire',etuve_10_niveaux:'Étuve ventilée 10 niveaux',kits_couverts:'Kits couverts',carrot_cake:'Carrot cake'
})[key]||key.replaceAll('_',' ')}
function offerSections(doc){
  const meta=doc?.metadata||{}
  if(Array.isArray(meta.offer_sections))return meta.offer_sections
  if(meta.quantities&&typeof meta.quantities==='object'){
    return [{title:'Contenu de l’offre',items:Object.entries(meta.quantities).filter(([,q])=>Number(q)>0).map(([key,quantity])=>({name:humanQuantity(key),quantity}))}]
  }
  const lines=String(doc?.extracted_text||'').split(/\n|;|\.(?:\s+|$)/).map(x=>x.trim()).filter(x=>x.length>8&&!/€|total|tva|acompte|prix|tarif/i.test(x)).slice(0,12)
  return lines.length?[{title:'Synthèse extraite',items:lines.map(name=>({name}))}]:[]
}
function offerItems(doc){return offerSections(doc).flatMap(section=>section.items||[])}
function deliverySummary(doc){
  const m=doc?.metadata||{}
  if(m.delivery_summary)return m.delivery_summary
  const parts=[]
  if(m.equipment_delivery)parts.push(`Matériel : ${m.equipment_delivery}`)
  if(m.food_delivery_time)parts.push(`Nourriture : ${m.food_delivery_time}`)
  if(m.single_delivery_requested)parts.push('Une livraison demandée, deux possibles si nécessaire')
  return parts.join(' · ')||'Organisation à confirmer'
}
function quoteSummary(doc){
  if(!doc)return '<div class="empty-dashboard">Aucune offre reçue pour ce déplacement.</div>'
  const meta=doc.metadata||{},items=offerItems(doc),preview=items.slice(0,3).map(i=>`${i.quantity?`${i.quantity} × `:''}${i.name}`).join(' · ')
  return `<button class="quote-glance" type="button" data-offer="${doc.id}"><span class="glance-icon gold">🍽</span><div><em>${esc(providerLabel(meta.supplier_type))} · fiche à jour</em><strong>${esc(supplierName(doc))}</strong><small>${esc(preview||deliverySummary(doc))}${items.length>3?` · +${items.length-3} éléments`:''}</small></div><b>Ouvrir →</b></button>`
}
function quoteList(quotes){return quotes.length?`<div class="quote-stack">${quotes.map(quoteSummary).join('')}</div>`:'<div class="empty-dashboard">Aucune offre reçue pour ce déplacement.</div>'}
function priorityUpdate(id){return missionInbox(id).filter(isPrioritySource).sort((a,b)=>new Date(b.received_at)-new Date(a.received_at))[0]}
function travelUpdateCard(item){
  if(!item)return '<div class="empty-dashboard">La prochaine information de Léo Tagawa ou Stéphane Saliu apparaîtra ici.</div>'
  return `<article class="mail-glance"><div><span class="glance-icon">✉</span><p><em>${esc(item.sender_name||'Travel OM')}</em><time>${fmtDateTime(item.received_at)}</time></p></div><strong>${esc(item.subject||'Information Travel')}</strong><small>${esc(item.raw_text||'')}</small></article>`
}
function homePage(){
  const next=nextAssignedMission(),match=next?matchOf(next):{},names=next?assignmentNames(next.id):[],date=next?dateOf(next):null
  const alerts=state.current.manager?state.changes.length:0
  const docs=next?missionDocs(next.id):[],legs=next?state.legs.filter(x=>x.mission_id===next.id):[],outbound=legs.find(x=>x.direction==='outbound'),roadmap=docs.find(x=>x.document_type==='roadmap'),quotes=next?currentQuotes(next.id):[],latest=next?priorityUpdate(next.id):null,news=freshItems()
  return `<div class="welcome"><div><span class="eyebrow">BONJOUR ${esc(state.current.first.toUpperCase())}</span><h2>Votre briefing déplacement</h2><p>Les informations importantes, mises à jour automatiquement.</p></div><div class="live-chip"><i></i> En direct</div></div>
  ${news.length?`<div class="news-banner"><span>●</span><div><strong>${news.length} nouveauté${news.length>1?'s':''} depuis votre dernière consultation</strong><small>${esc(news[0].label)}</small></div><button type="button" data-mark-seen>Marquer comme vu</button></div>`:''}
  ${next?`<article class="next-trip"><div class="next-trip-head"><span>${esc(match.competition||'PROCHAIN DÉPLACEMENT')}</span><b>${date&&daysUntil(date)>=0?`J-${daysUntil(date)}`:'À venir'}</b></div><div class="next-trip-body"><div><p>${fmtDate(date)}</p><h2>${esc(match.home_team||next.destination_city)} <small>— OM</small></h2><span>${esc(match.venue_name||next.destination_city||'Lieu à confirmer')}</span></div><div class="team-bubbles">${names.map(n=>`<i title="${esc(n)}">${initials(n)}</i>`).join('')}</div></div><div class="next-trip-foot"><div><span>Préparation</span><strong>${next.completeness_score}%</strong><i><u style="width:${next.completeness_score}%"></u></i></div><button data-mission="${next.id}">Ouvrir le dossier →</button></div></article>`:'<article class="empty-card">Aucun déplacement affecté pour le moment.</article>'}
  ${next?`<div class="boarding-grid">
    <section class="dashboard-panel span-2"><div class="panel-head"><div><p class="eyebrow">DERNIÈRE INFORMATION TRAVEL</p><h3>Léo Tagawa & Stéphane Saliu</h3></div><span class="live-dot">● Synchronisé</span></div>${travelUpdateCard(latest)}</section>
    <section class="dashboard-panel"><div class="panel-head"><div><p class="eyebrow">HÔTEL</p><h3>${esc(next.destination_city||'Déplacement')}</h3></div><span class="panel-icon">⌂</span></div><strong class="key-value">${esc(hotelForMission(next.id))}</strong><small class="key-detail">${docs.some(x=>x.document_type==='hotel_confirmation'||x.document_type==='rooming')?'Confirmation disponible':'Informations issues du dernier mail Travel'}</small></section>
    <section id="homeWeatherCard" class="dashboard-panel weather-panel"><div class="panel-head"><div><p class="eyebrow">MÉTÉO</p><h3>${esc(next.destination_city||'Destination')}</h3></div><span class="panel-icon">☀</span></div><strong class="key-value">Chargement…</strong></section>
    <section class="dashboard-panel"><div class="panel-head"><div><p class="eyebrow">TRANSPORT</p><h3>Départ</h3></div><span class="panel-icon">✈</span></div><strong class="key-value">${outbound?fmtDateTime(outbound.scheduled_departure):'Horaire attendu'}</strong><small class="key-detail">${roadmap?`Feuille de route disponible`:'Synchronisation du mail Travel active'}</small></section>
    <section class="dashboard-panel span-2"><div class="panel-head"><div><p class="eyebrow">RESTAURATION EXTÉRIEURE</p><h3>Fiches prestataires</h3></div><button class="text-btn" data-page="documents">Toutes les fiches</button></div>${quoteList(quotes)}</section>
  </div>`:''}
  ${alerts?`<div class="notice warning"><b>!</b><div><strong>${alerts} information${alerts>1?'s':''} à confirmer</strong><span>Les dates du tableau et du calendrier officiel diffèrent pour Troyes et Angers. Aucune date officielle n’a été écrasée.</span></div><button data-page="inbox">Voir</button></div>`:''}
  <div class="section-title"><div><p class="eyebrow">ACCÈS APPLICATIONS</p><h3>Outils terrain</h3></div><button class="text-btn" data-page="apps">Tous les accès</button></div>${appCards(true)}
  <div class="section-title"><div><p class="eyebrow">ÉQUIPE API</p><h3>Binômes enregistrés</h3></div><button class="text-btn" data-page="trips">Voir le planning</button></div>
  <div class="team-grid">${TEAM.map(p=>`<article><span style="--profile:${p.color}">${p.initials}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></div><b>${ROSTER_COUNTS[p.name]}<small>départs</small></b></article>`).join('')}</div>`
}
function tripsPage(){
  const options=state.current.manager?`<select id="personFilter"><option value="all">Tous les déplacements</option>${TEAM.map(p=>`<option value="${esc(p.name)}">${esc(p.first)}</option>`).join('')}<option value="unassigned">Équipe à définir</option></select>`:''
  return `<div class="page-tools"><p>Les affectations du dernier tableau reçu sont déjà intégrées.</p>${options}</div><div id="tripList" class="trip-list">${tripListHtml('all')}</div>`
}
function tripListHtml(filter){
  const rows=state.missions.filter(m=>{const n=assignmentNames(m.id);if(filter==='unassigned')return !n.length;if(filter&&filter!=='all')return n.includes(filter);return state.current.manager||n.includes(state.current.name)}).sort((a,b)=>new Date(dateOf(a)||'2999')-new Date(dateOf(b)||'2999'))
  return rows.length?rows.map(tripCard).join(''):'<div class="empty-card">Aucun déplacement dans ce filtre.</div>'
}
function renderTripList(filter){$('tripList').innerHTML=tripListHtml(filter);bindPage()}
function documentsPage(){
  const docs=state.documents,quotes=docs.filter(doc=>doc.document_type==='caterer_quote'&&doc.metadata?.is_current!==false&&doc.metadata?.document_status!=='request'),requests=docs.filter(doc=>doc.document_type==='caterer_quote'&&doc.metadata?.document_status==='request'),travelDocs=docs.filter(doc=>doc.document_type!=='caterer_quote')
  return `<div class="page-tools"><p>${docs.length} document${docs.length!==1?'s':''} accessible${docs.length!==1?'s':''} avec votre profil.</p></div>
  <div class="section-title"><div><p class="eyebrow">OFFRES REÇUES PAR MAIL</p><h3>Fiches traiteurs, pizzas & sushi</h3></div></div>
  <div class="supplier-grid">${quotes.length?quotes.map(supplierCard).join(''):'<div class="empty-card">Les offres des traiteurs, pizzerias et restaurants sushi apparaîtront ici dès leur réception.</div>'}</div>
  ${state.current.manager&&requests.length?`<div class="section-title"><div><p class="eyebrow">CONSULTATIONS EN COURS</p><h3>Demandes envoyées</h3></div></div><div class="document-list">${requests.map(documentCard).join('')}</div>`:''}
  <div class="section-title"><div><p class="eyebrow">DOSSIER DE VOYAGE</p><h3>Autres documents</h3></div></div>
  <div class="document-list">${travelDocs.length?travelDocs.map(documentCard).join(''):'<div class="empty-card">Les feuilles de route, billets et confirmations d’hôtel apparaîtront ici dès leur réception.</div>'}</div>`
}
function supplierCard(doc){
  const meta=doc.metadata||{},items=offerItems(doc),mission=missionOf(doc.mission_id),updated=meta.summary_updated_at||doc.document_date||doc.created_at
  return `<button class="supplier-card" type="button" data-offer="${doc.id}"><div class="supplier-card-head"><span>🍽</span><div><em>${esc(providerLabel(meta.supplier_type))}</em><strong>${esc(supplierName(doc))}</strong></div><i>À jour</i></div><p>${esc(items.slice(0,4).map(x=>x.name).join(' · ')||'Synthèse de l’offre disponible')}</p><div><small>${esc(mission?.destination_city||'Déplacement')} · mis à jour ${fmtDateTime(updated)}</small><b>Voir la fiche →</b></div></button>`
}
function documentCard(doc){
  const mission=missionOf(doc.mission_id),url=safeUrl(doc.source_url||'#')
  const quoteLabel=doc.metadata?.document_status==='request'?'Demande de devis':`Devis ${doc.metadata?.supplier_type||'traiteur'}`
  const labels={roadmap:'Feuille de route',flight_ticket:"Billet d'avion",train_ticket:'Billet de train',hotel_confirmation:'Hôtel',rooming:'Rooming',menu:'Menu',cdc:'Cahier des charges',audit:'Audit hôtel',invoice:'Facture',caterer_quote:quoteLabel,other:'Document'}
  const icon=doc.document_type==='flight_ticket'?'✈':doc.document_type==='hotel_confirmation'?'⌂':doc.document_type==='caterer_quote'?'🍽':'▤'
  if(doc.document_type==='caterer_quote'&&doc.metadata?.document_status!=='request')return supplierCard(doc)
  return `<a class="document-card" href="${url}" ${url!=='#'?'target="_blank" rel="noopener"':''}><span>${icon}</span><div><em>${esc(labels[doc.document_type]||'Document')}</em><strong>${esc(doc.file_name||labels[doc.document_type]||'Document')}</strong><small>${esc(mission?.destination_city||'Saison 2026-2027')} · ${fmtDate(doc.document_date||doc.created_at)}</small></div><b>${url==='#'?'À venir':'↗'}</b></a>`
}
function appsPage(){return `<div class="page-intro"><h2>Tout le nécessaire sur le terrain</h2><p>Chaque outil s’ouvre dans son application dédiée, avec ses propres droits d’accès.</p></div>${appCards()}<div class="contact-panel"><div class="section-title"><div><p class="eyebrow">SOURCES VOYAGE</p><h3>Informations synchronisées</h3></div></div>${CONTACTS.map(c=>`<div class="contact-row"><span>${initials(c.name)}</span><div><strong>${c.name}</strong><small>${c.role}</small></div><b>Synchronisé</b></div>`).join('')}</div>`}
function inboxPage(){
  if(!state.current.manager)return homePage()
  return `<div class="page-tools"><p>Les nouveaux mails utiles de Léo Tagawa et Stéphane Saliu sont classés automatiquement.</p><span class="sync-pill">● Actif</span></div><div class="inbox-list">${state.inbox.length?state.inbox.map(item=>`<article class="inbox-item"><span class="source-icon">${item.classification?.includes('hotel')?'⌂':'✉'}</span><div><div><em>${esc(item.sender_name||'Source Travel')}</em><time>${fmtDateTime(item.received_at)}</time></div><strong>${esc(item.subject||'Sans objet')}</strong><p>${esc(item.raw_text||'')}</p></div><b class="status ${item.status}">${item.status==='needs_review'?'À vérifier':item.status==='applied'?'Intégré':'Nouveau'}</b></article>`).join(''):'<div class="empty-card">Aucun message Travel.</div>'}</div>`
}
function openMission(id){
  const mission=missionOf(id);if(!mission)return
  const match=matchOf(mission),names=assignmentNames(id),legs=state.legs.filter(x=>x.mission_id===id),docs=state.documents.filter(x=>x.mission_id===id),quotes=currentQuotes(id),otherDocs=docs.filter(x=>x.document_type!=='caterer_quote'),date=dateOf(mission)
  $('tripDialogContent').innerHTML=`<button class="dialog-close" onclick="document.getElementById('tripDialog').close()">×</button><div class="dialog-hero"><p>${esc(match.competition||'DÉPLACEMENT')} · ${esc(match.round_label||'')}</p><h2>${esc(match.home_team||mission.destination_city)} <small>— OM</small></h2><span>${fmtDate(date)} · ${esc(match.venue_name||mission.destination_city||'Lieu à confirmer')}</span></div><div class="dialog-content">
  <section><p class="eyebrow">ÉQUIPE API</p><div class="dialog-team">${names.length?names.map(n=>{const p=TEAM.find(x=>x.name===n);return `<div><i style="background:${p?.color||'#168ac5'}">${initials(n)}</i><span><strong>${esc(n)}</strong><small>${esc(p?.role||'Équipe déplacement')}</small></span></div>`}).join(''):'<div class="empty-inline">Binôme à définir</div>'}</div></section>
  <section><p class="eyebrow">INFORMATIONS DE VOYAGE</p><div class="info-grid"><article><span>✈</span><small>Départ</small><strong>${legs.find(x=>x.direction==='outbound')?fmtDateTime(legs.find(x=>x.direction==='outbound').scheduled_departure):'Feuille de route attendue'}</strong></article><article><span>⌂</span><small>Hôtel</small><strong>${hotelName(docs)||'À confirmer'}</strong></article><article id="weatherCard"><span>☀</span><small>Météo</small><strong>Chargement…</strong></article></div></section>
  <section><div class="section-title"><div><p class="eyebrow">RESTAURATION</p><h3>Fiches prestataires</h3></div></div><div class="supplier-grid">${quotes.length?quotes.map(supplierCard).join(''):'<div class="empty-inline">Aucune offre reçue.</div>'}</div></section>
  <section><div class="section-title"><div><p class="eyebrow">DOCUMENTS</p><h3>Dossier du déplacement</h3></div></div><div class="document-list compact-docs">${otherDocs.length?otherDocs.map(documentCard).join(''):'<div class="empty-inline">Feuille de route, billets et hôtel seront ajoutés automatiquement à leur réception.</div>'}</div></section>
  <section><p class="eyebrow">APPLICATIONS</p>${appCards(true)}</section></div>`
  $('tripDialog').showModal();$('tripDialogContent').querySelectorAll('[data-offer]').forEach(btn=>btn.onclick=()=>openOffer(btn.dataset.offer));loadWeather(mission,date,'weatherCard')
}
function offerHistory(doc){return state.documents.filter(x=>x.document_type==='caterer_quote'&&x.mission_id===doc.mission_id&&x.metadata?.document_status!=='request'&&supplierKey(x)===supplierKey(doc)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function contactLink(value,type){if(!value)return '';const href=type==='mail'?`mailto:${value}`:`tel:${String(value).replace(/[^+\d]/g,'')}`;return `<a href="${esc(href)}">${esc(value)}</a>`}
function openOffer(id){
  const doc=state.documents.find(x=>x.id===id);if(!doc)return
  const meta=doc.metadata||{},mission=missionOf(doc.mission_id),sections=offerSections(doc),history=offerHistory(doc),source=sourceInbox(doc)
  const email=meta.supplier_contact_email||meta.supplier_email||source.sender_address||'',phone=meta.supplier_contact_phone||meta.supplier_phone||'',contact=meta.supplier_contact_name||source.sender_name||supplierName(doc)
  const dietary=meta.dietary_summary||(/tripletta/i.test(supplierName(doc))?'Viandes halal, sans porc, sans alcool et sans gélatine animale. Production dédiée annoncée ; établissement non certifié halal.':'')
  const venue=meta.venue||mission?.destination_city||'Lieu à confirmer'
  $('offerDialogContent').innerHTML=`<button class="dialog-close" onclick="document.getElementById('offerDialog').close()">×</button>
  <div class="offer-hero"><div><p>${esc(providerLabel(meta.supplier_type))} · ${esc(mission?.destination_city||'Déplacement')}</p><h2>${esc(supplierName(doc))}</h2><span>Fiche opérationnelle · mise à jour ${fmtDateTime(meta.summary_updated_at||doc.document_date||doc.created_at)}</span></div><b class="offer-status ${meta.is_current===false?'old':''}">${meta.is_current===false?'Ancienne version':'À jour'}</b></div>
  <div class="offer-content">
    <section class="offer-overview"><article><small>LIVRAISON</small><strong>${esc(deliverySummary(doc))}</strong></article><article><small>LIEU</small><strong>${esc(venue)}</strong></article><article><small>STATUT</small><strong>${meta.confirmation_required?'Quantités à confirmer':'Offre reçue'}</strong></article></section>
    <section><div class="section-title"><div><p class="eyebrow">CONTENU DE L’OFFRE</p><h3>Produits et quantités</h3></div></div><div class="offer-sections">${sections.length?sections.map(section=>`<article><h4>${esc(section.title||'Contenu')}</h4><ul>${(section.items||[]).map(item=>`<li><span>${esc(item.name||item.label||'Élément')}${item.details?`<small>${esc(item.details)}</small>`:''}</span>${item.quantity!=null?`<b>${esc(item.quantity)}${item.unit?` ${esc(item.unit)}`:''}</b>`:''}</li>`).join('')}</ul></article>`).join(''):'<div class="empty-inline">Le détail est en cours d’extraction.</div>'}</div></section>
    ${dietary?`<section class="offer-note"><span>✓</span><div><small>RÉGIMES & ALLERGÈNES</small><strong>${esc(dietary)}</strong></div></section>`:''}
    <section><div class="section-title"><div><p class="eyebrow">CONTACT PRESTATAIRE</p><h3>${esc(contact)}</h3></div></div><div class="offer-contact">${email?`<div><span>✉</span><small>E-mail</small>${contactLink(email,'mail')}</div>`:''}${phone?`<div><span>☎</span><small>Téléphone</small>${contactLink(phone,'tel')}</div>`:''}${meta.onsite_contact_phone?`<div><span>◎</span><small>Sur place · ${esc(meta.onsite_contact_name||'Contact')}</small>${contactLink(meta.onsite_contact_phone,'tel')}</div>`:''}</div></section>
    ${history.length>1?`<section><div class="section-title"><div><p class="eyebrow">HISTORIQUE</p><h3>${history.length} versions conservées</h3></div></div><div class="offer-history">${history.map(v=>`<button type="button" data-offer="${v.id}"><span>${esc(v.metadata?.revision?`Version ${v.metadata.revision}`:'Version reçue')}</span><small>${fmtDateTime(v.document_date||v.created_at)}</small><b>${v.metadata?.is_current===false?'Remplacée':'Actuelle'}</b></button>`).join('')}</div></section>`:''}
    ${state.current.manager&&safeUrl(doc.source_url||'#')!=='#'?`<a class="source-mail-link" href="${safeUrl(doc.source_url)}" target="_blank" rel="noopener">Ouvrir l’e-mail source (gestionnaire) ↗</a>`:''}
  </div>`
  if(!$('offerDialog').open)$('offerDialog').showModal();$('offerDialogContent').querySelectorAll('[data-offer]').forEach(btn=>btn.onclick=()=>openOffer(btn.dataset.offer))
}
function hotelName(docs){const d=docs.find(x=>x.document_type==='hotel_confirmation'||x.document_type==='rooming');return d?.metadata?.hotel_name||d?.metadata?.hotel||null}
async function loadWeather(mission,date,cardId='weatherCard'){
  const card=$(cardId);if(!card)return
  const city=mission.destination_city;if(!city){card.querySelector('strong').textContent='Ville à confirmer';return}
  const search=`https://www.google.com/search?q=${encodeURIComponent(`météo ${city}`)}`
  const delta=date?Math.floor((new Date(date)-Date.now())/86400000):99
  if(delta>15||delta<-2){
    if(card.classList.contains('dashboard-panel'))card.innerHTML=`<div class="panel-head"><div><p class="eyebrow">MÉTÉO</p><h3>${esc(city)}</h3></div><span class="panel-icon">☀</span></div><strong class="key-value">Disponible à J-15</strong><a class="weather-link" href="${search}" target="_blank" rel="noopener">Voir la météo ↗</a>`
    else card.innerHTML=`<span>☀</span><small>Météo</small><strong>Prévision disponible à J-15</strong><a href="${search}" target="_blank" rel="noopener">Voir la météo ↗</a>`
    return
  }
  try{
    const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`).then(r=>r.json());const loc=geo.results?.[0];if(!loc)throw new Error()
    const day=new Date(date||Date.now()).toISOString().slice(0,10)
    const data=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FParis&start_date=${day}&end_date=${day}`).then(r=>r.json())
    const max=data.daily?.temperature_2m_max?.[0],min=data.daily?.temperature_2m_min?.[0],rain=data.daily?.precipitation_probability_max?.[0]
    if(max==null||min==null)throw new Error()
    const content=`${Math.round(min)}° / ${Math.round(max)}° · pluie ${rain??0}%`
    if(card.classList.contains('dashboard-panel'))card.innerHTML=`<div class="panel-head"><div><p class="eyebrow">MÉTÉO PRÉVUE</p><h3>${esc(city)}</h3></div><span class="panel-icon">☀</span></div><strong class="key-value">${content}</strong><a class="weather-link" href="${search}" target="_blank" rel="noopener">Détail ↗</a>`
    else card.innerHTML=`<span>☀</span><small>Météo prévue</small><strong>${content}</strong><a href="${search}" target="_blank" rel="noopener">Détail ↗</a>`
  }catch{
    if(card.classList.contains('dashboard-panel'))card.innerHTML=`<div class="panel-head"><div><p class="eyebrow">MÉTÉO</p><h3>${esc(city)}</h3></div><span class="panel-icon">☀</span></div><strong class="key-value">Prévision indisponible</strong><a class="weather-link" href="${search}" target="_blank" rel="noopener">Voir la météo ↗</a>`
    else card.innerHTML=`<span>☀</span><small>Météo</small><strong>Prévision indisponible</strong><a href="${search}" target="_blank" rel="noopener">Voir la météo ↗</a>`
  }
}
async function refreshDashboard(){
  if(!state.current||document.hidden)return
  await loadData(false)
  if(state.page==='home'){
    $('pageContent').innerHTML=homePage();bindPage()
    const mission=nextAssignedMission();if(mission)loadWeather(mission,dateOf(mission),'homeWeatherCard')
  }
}
async function logout(){await state.sb.auth.signOut();state.current=null;state.pin='';state.selected=null;$('appShell').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('pinStep').classList.add('hidden');$('profileStep').classList.remove('hidden')}
async function boot(){
  if(!window.supabase){$('profileGrid').innerHTML='<div class="pin-error">Connexion sécurisée indisponible.</div>';return}
  state.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})
  renderProfiles();$('backProfiles').onclick=()=>{$('pinStep').classList.add('hidden');$('profileStep').classList.remove('hidden');state.pin='';state.selected=null};$('logoutBtn').onclick=logout;$('notificationBtn').onclick=()=>{localStorage.setItem(seenKey(),String(Date.now()));go('home');updateNotificationUI()}
  document.querySelectorAll('[data-page]').forEach(btn=>btn.onclick=()=>go(btn.dataset.page))
  const {data}=await state.sb.auth.getSession();const user=data?.session?.user
  const known=TEAM.find(p=>p.id===user?.id)
  if(known){state.current=known;state.selected=known;await enterApp()}else if(user){await state.sb.auth.signOut()}
  state.refreshTimer=setInterval(refreshDashboard,90000)
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDashboard()})
}
boot()

'use strict'

const SUPABASE_URL='https://vjulagaprzbnquynwjmt.supabase.co'
const SUPABASE_KEY='sb_publishable_iT2AHtS29Qi63weZslm56g_oHkqbcvK'
const TEAM=[
  {id:'a1000000-0000-0000-0000-000000000001',name:'Amar Lacidi',first:'Amar',role:'Directeur de la restauration',initials:'AL',color:'#0b83c9',manager:true},
  {id:'a1000000-0000-0000-0000-000000000002',name:'Igal Settbon',first:'Igal',role:'Chef de cuisine',initials:'IS',color:'#d5a940'},
  {id:'a1000000-0000-0000-0000-000000000003',name:'Bastien Florido',first:'Bastien',role:"Maître d'hôtel",initials:'BF',color:'#4058a8'},
  {id:'a1000000-0000-0000-0000-000000000004',name:'Damien Cau',first:'Damien',role:'Second de cuisine',initials:'DC',color:'#23846f'}
]
const ROSTER_COUNTS={'Amar Lacidi':5,'Igal Settbon':7,'Bastien Florido':5,'Damien Cau':5}
const FALLBACK_APPS=[
  {app_type:'hotel_audit',label:'Audit Hôtel',description:"Contrôle de l'hôtel et suivi des corrections",icon:'⌂'},
  {app_type:'cahier_des_charges',label:'Cahier des charges',description:'Consignes hôtel, déplacement et chiffrage',icon:'▤'},
  {app_type:'other',label:'Devis traiteurs',description:'Créer et consulter les devis opérationnels',icon:'€'}
]
const CONTACTS=[
  {name:'Léo Tagawa',role:'Travel Manager OM'},
  {name:'Stéphane Saliu',role:'Travel / organisation'}
]

const state={sb:null,current:null,pin:'',selected:null,page:'home',missions:[],matches:[],assignments:[],legs:[],documents:[],apps:[],inbox:[],changes:[],members:[]}
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
    const {data,error}=await state.sb.auth.signInWithPassword({email:`${state.selected.id}@cph.local`,password:state.pin})
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
async function loadData(){
  $('pageContent').innerHTML='<div class="loading-card">Synchronisation de vos informations…</div>'
  const queries={
    missions:state.sb.from('travel_missions').select('*').order('starts_at'),
    matches:state.sb.from('travel_matches').select('*').eq('season','2026/27').order('kickoff_at'),
    assignments:state.sb.from('travel_assignments').select('*').order('employee_name'),
    legs:state.sb.from('travel_legs').select('*').order('leg_order'),
    documents:state.sb.from('travel_documents').select('*').order('document_date',{ascending:false}),
    apps:state.sb.from('travel_app_links').select('*').eq('active',true).order('label'),
    members:state.sb.from('travel_team_members').select('*').eq('active',true).order('display_order')
  }
  if(state.current.manager){queries.inbox=state.sb.from('travel_inbox').select('*').order('received_at',{ascending:false}).limit(30);queries.changes=state.sb.from('travel_change_log').select('*').eq('requires_attention',true).is('acknowledged_at',null).order('created_at',{ascending:false})}
  const entries=Object.entries(queries);const results=await Promise.all(entries.map(([,query])=>query))
  const failures=[]
  results.forEach((result,i)=>{const key=entries[i][0];if(result.error)failures.push(key);else state[key]=result.data||[]})
  if(failures.length)toast(`Données indisponibles : ${failures.join(', ')}`,true)
}
function go(page){
  if(page==='inbox'&&!state.current.manager)page='home';state.page=page
  document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page))
  const meta={home:['ESPACE PERSONNEL','Accueil'],trips:['SAISON 2026-2027','Déplacements'],documents:['DOSSIER DE VOYAGE','Documents'],apps:['ACCÈS RAPIDES','Applications'],inbox:['SYNCHRONISATION MAIL','Travel Inbox']}
  $('pageEyebrow').textContent=meta[page][0];$('pageTitle').textContent=meta[page][1]
  const pages={home:homePage,trips:tripsPage,documents:documentsPage,apps:appsPage,inbox:inboxPage}
  $('pageContent').innerHTML=pages[page]();bindPage();window.scrollTo({top:0,behavior:'smooth'})
}
function bindPage(){
  document.querySelectorAll('[data-mission]').forEach(btn=>btn.onclick=()=>openMission(btn.dataset.mission))
  document.querySelectorAll('#pageContent [data-page]').forEach(btn=>btn.onclick=()=>go(btn.dataset.page))
  const filter=$('personFilter');if(filter)filter.onchange=()=>renderTripList(filter.value)
}
function appCatalog(){
  const merged=FALLBACK_APPS.map(f=>({...f,...state.apps.find(a=>a.app_type===f.app_type||a.label===f.label)}))
  const extra=state.apps.filter(a=>!merged.some(x=>x.external_key===a.external_key||x.url===a.url))
  return [...merged,...extra.map(a=>({...a,description:'Accès lié au déplacement',icon:'↗'}))]
}
function appCards(compact=false){return `<div class="app-grid ${compact?'compact':''}">${appCatalog().map(a=>{const url=safeUrl(a.url);return `<a class="app-card ${url==='#'?'disabled':''}" href="${url}" ${url!=='#'?'target="_blank" rel="noopener"':''}><span class="app-icon">${a.icon||'↗'}</span><div><strong>${esc(a.label)}</strong><small>${esc(a.description||'Ouvrir l’application')}</small></div><b>${url==='#'?'—':'↗'}</b></a>`}).join('')}</div>`}
function assignmentNames(missionId){return state.assignments.filter(a=>a.mission_id===missionId).map(a=>a.employee_name)}
function tripCard(m){
  const match=matchOf(m),date=dateOf(m),d=date?daysUntil(date):null,names=assignmentNames(m.id)
  const badge=d===null?'À confirmer':d<0?'Passé':d===0?'Aujourd’hui':`J-${d}`
  return `<button class="trip-card" data-mission="${m.id}"><span class="trip-date"><strong>${date?new Date(date).toLocaleDateString('fr-FR',{day:'2-digit',timeZone:'Europe/Paris'}):'--'}</strong><small>${date?new Date(date).toLocaleDateString('fr-FR',{month:'short',timeZone:'Europe/Paris'}):''}</small></span><span class="trip-main"><span class="trip-top"><em>${esc(match.competition||'Déplacement')}</em><i>${esc(badge)}</i></span><strong>${esc(match.home_team||m.destination_city||m.title)}</strong><small>${esc(m.destination_city||match.city||'Lieu à confirmer')} · ${names.length?esc(names.join(' + ')):'Équipe à définir'}</small></span><span class="trip-progress"><b>${m.completeness_score}%</b><i><u style="width:${m.completeness_score}%"></u></i></span><span class="arrow">›</span></button>`
}
function nextAssignedMission(){return state.missions.filter(m=>isFuture(m)&&assignmentNames(m.id).includes(state.current.name)).sort((a,b)=>new Date(dateOf(a)||'2999')-new Date(dateOf(b)||'2999'))[0]}
function homePage(){
  const next=nextAssignedMission(),match=next?matchOf(next):{},names=next?assignmentNames(next.id):[],date=next?dateOf(next):null
  const alerts=state.current.manager?state.changes.length:0
  return `<div class="welcome"><div><span class="eyebrow">BONJOUR ${esc(state.current.first.toUpperCase())}</span><h2>Votre espace déplacement</h2><p>Feuilles de route, billets, hôtel, documents et outils réunis au même endroit.</p></div><div class="live-chip"><i></i> Mails synchronisés</div></div>
  ${next?`<article class="next-trip"><div class="next-trip-head"><span>${esc(match.competition||'PROCHAIN DÉPLACEMENT')}</span><b>${date&&daysUntil(date)>=0?`J-${daysUntil(date)}`:'À venir'}</b></div><div class="next-trip-body"><div><p>${fmtDate(date)}</p><h2>${esc(match.home_team||next.destination_city)} <small>— OM</small></h2><span>${esc(match.venue_name||next.destination_city||'Lieu à confirmer')}</span></div><div class="team-bubbles">${names.map(n=>`<i title="${esc(n)}">${initials(n)}</i>`).join('')}</div></div><div class="next-trip-foot"><div><span>Préparation</span><strong>${next.completeness_score}%</strong><i><u style="width:${next.completeness_score}%"></u></i></div><button data-mission="${next.id}">Ouvrir le dossier →</button></div></article>`:'<article class="empty-card">Aucun déplacement affecté pour le moment.</article>'}
  <div class="section-title"><div><p class="eyebrow">ÉQUIPE API</p><h3>Binômes enregistrés</h3></div><button class="text-btn" data-page="trips">Voir le planning</button></div>
  <div class="team-grid">${TEAM.map(p=>`<article><span style="--profile:${p.color}">${p.initials}</span><div><strong>${esc(p.name)}</strong><small>${esc(p.role)}</small></div><b>${ROSTER_COUNTS[p.name]}<small>départs</small></b></article>`).join('')}</div>
  ${alerts?`<div class="notice warning"><b>!</b><div><strong>${alerts} information${alerts>1?'s':''} à confirmer</strong><span>Les dates du tableau et du calendrier officiel diffèrent pour Troyes et Angers. Aucune date officielle n’a été écrasée.</span></div><button data-page="inbox">Voir</button></div>`:''}
  <div class="section-title"><div><p class="eyebrow">OUTILS TERRAIN</p><h3>Accès directs</h3></div></div>${appCards(true)}`
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
  const docs=state.documents
  return `<div class="page-tools"><p>${docs.length} document${docs.length!==1?'s':''} accessible${docs.length!==1?'s':''} avec votre profil.</p></div><div class="document-list">${docs.length?docs.map(doc=>documentCard(doc)).join(''):'<div class="empty-card">Les feuilles de route, billets et confirmations d’hôtel apparaîtront ici dès leur réception.</div>'}</div>`
}
function documentCard(doc){
  const mission=missionOf(doc.mission_id),url=safeUrl(doc.source_url||'#')
  const labels={roadmap:'Feuille de route',flight_ticket:"Billet d'avion",train_ticket:'Billet de train',hotel_confirmation:'Hôtel',rooming:'Rooming',menu:'Menu',cdc:'Cahier des charges',audit:'Audit hôtel',invoice:'Facture',other:'Document'}
  return `<a class="document-card" href="${url}" ${url!=='#'?'target="_blank" rel="noopener"':''}><span>${doc.document_type==='flight_ticket'?'✈':doc.document_type==='hotel_confirmation'?'⌂':'▤'}</span><div><em>${esc(labels[doc.document_type]||'Document')}</em><strong>${esc(doc.file_name||labels[doc.document_type]||'Document')}</strong><small>${esc(mission?.destination_city||'Saison 2026-2027')} · ${fmtDate(doc.document_date||doc.created_at)}</small></div><b>${url==='#'?'À venir':'↗'}</b></a>`
}
function appsPage(){return `<div class="page-intro"><h2>Tout le nécessaire sur le terrain</h2><p>Chaque outil s’ouvre dans son application dédiée, avec ses propres droits d’accès.</p></div>${appCards()}<div class="contact-panel"><div class="section-title"><div><p class="eyebrow">SOURCES VOYAGE</p><h3>Informations synchronisées</h3></div></div>${CONTACTS.map(c=>`<div class="contact-row"><span>${initials(c.name)}</span><div><strong>${c.name}</strong><small>${c.role}</small></div><b>Synchronisé</b></div>`).join('')}</div>`}
function inboxPage(){
  if(!state.current.manager)return homePage()
  return `<div class="page-tools"><p>Les nouveaux mails utiles de Léo Tagawa et Stéphane Saliu sont classés automatiquement.</p><span class="sync-pill">● Actif</span></div><div class="inbox-list">${state.inbox.length?state.inbox.map(item=>`<article class="inbox-item"><span class="source-icon">${item.classification?.includes('hotel')?'⌂':'✉'}</span><div><div><em>${esc(item.sender_name||'Source Travel')}</em><time>${fmtDateTime(item.received_at)}</time></div><strong>${esc(item.subject||'Sans objet')}</strong><p>${esc(item.raw_text||'')}</p></div><b class="status ${item.status}">${item.status==='needs_review'?'À vérifier':item.status==='applied'?'Intégré':'Nouveau'}</b></article>`).join(''):'<div class="empty-card">Aucun message Travel.</div>'}</div>`
}
function openMission(id){
  const mission=missionOf(id);if(!mission)return
  const match=matchOf(mission),names=assignmentNames(id),legs=state.legs.filter(x=>x.mission_id===id),docs=state.documents.filter(x=>x.mission_id===id),date=dateOf(mission)
  $('tripDialogContent').innerHTML=`<button class="dialog-close" onclick="document.getElementById('tripDialog').close()">×</button><div class="dialog-hero"><p>${esc(match.competition||'DÉPLACEMENT')} · ${esc(match.round_label||'')}</p><h2>${esc(match.home_team||mission.destination_city)} <small>— OM</small></h2><span>${fmtDate(date)} · ${esc(match.venue_name||mission.destination_city||'Lieu à confirmer')}</span></div><div class="dialog-content">
  <section><p class="eyebrow">ÉQUIPE API</p><div class="dialog-team">${names.length?names.map(n=>{const p=TEAM.find(x=>x.name===n);return `<div><i style="background:${p?.color||'#168ac5'}">${initials(n)}</i><span><strong>${esc(n)}</strong><small>${esc(p?.role||'Équipe déplacement')}</small></span></div>`}).join(''):'<div class="empty-inline">Binôme à définir</div>'}</div></section>
  <section><p class="eyebrow">INFORMATIONS DE VOYAGE</p><div class="info-grid"><article><span>✈</span><small>Départ</small><strong>${legs.find(x=>x.direction==='outbound')?fmtDateTime(legs.find(x=>x.direction==='outbound').scheduled_departure):'Feuille de route attendue'}</strong></article><article><span>⌂</span><small>Hôtel</small><strong>${hotelName(docs)||'À confirmer'}</strong></article><article id="weatherCard"><span>☀</span><small>Météo</small><strong>Chargement…</strong></article></div></section>
  <section><div class="section-title"><div><p class="eyebrow">DOCUMENTS</p><h3>Dossier du déplacement</h3></div></div><div class="document-list compact-docs">${docs.length?docs.map(documentCard).join(''):'<div class="empty-inline">Feuille de route, billets et hôtel seront ajoutés automatiquement à leur réception.</div>'}</div></section>
  <section><p class="eyebrow">APPLICATIONS</p>${appCards(true)}</section></div>`
  $('tripDialog').showModal();loadWeather(mission,date)
}
function hotelName(docs){const d=docs.find(x=>x.document_type==='hotel_confirmation'||x.document_type==='rooming');return d?.metadata?.hotel_name||d?.metadata?.hotel||null}
async function loadWeather(mission,date){
  const card=$('weatherCard');if(!card)return
  const city=mission.destination_city;if(!city){card.querySelector('strong').textContent='Ville à confirmer';return}
  const search=`https://www.google.com/search?q=${encodeURIComponent(`météo ${city}`)}`
  const delta=date?Math.floor((new Date(date)-Date.now())/86400000):99
  if(delta>15||delta<-2){card.innerHTML=`<span>☀</span><small>Météo</small><strong>Prévision disponible à J-15</strong><a href="${search}" target="_blank" rel="noopener">Voir la météo ↗</a>`;return}
  try{
    const geo=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`).then(r=>r.json());const loc=geo.results?.[0];if(!loc)throw new Error()
    const day=new Date(date||Date.now()).toISOString().slice(0,10)
    const data=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FParis&start_date=${day}&end_date=${day}`).then(r=>r.json())
    const max=data.daily?.temperature_2m_max?.[0],min=data.daily?.temperature_2m_min?.[0],rain=data.daily?.precipitation_probability_max?.[0]
    if(max==null||min==null)throw new Error()
    card.innerHTML=`<span>☀</span><small>Météo prévue</small><strong>${Math.round(min)}° / ${Math.round(max)}° · pluie ${rain??0}%</strong><a href="${search}" target="_blank" rel="noopener">Détail ↗</a>`
  }catch{card.innerHTML=`<span>☀</span><small>Météo</small><strong>Prévision indisponible</strong><a href="${search}" target="_blank" rel="noopener">Voir la météo ↗</a>`}
}
async function logout(){await state.sb.auth.signOut();state.current=null;state.pin='';state.selected=null;$('appShell').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('pinStep').classList.add('hidden');$('profileStep').classList.remove('hidden')}
async function boot(){
  if(!window.supabase){$('profileGrid').innerHTML='<div class="pin-error">Connexion sécurisée indisponible.</div>';return}
  state.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})
  renderProfiles();$('backProfiles').onclick=()=>{$('pinStep').classList.add('hidden');$('profileStep').classList.remove('hidden');state.pin='';state.selected=null};$('logoutBtn').onclick=logout
  document.querySelectorAll('[data-page]').forEach(btn=>btn.onclick=()=>go(btn.dataset.page))
  const {data}=await state.sb.auth.getSession();const user=data?.session?.user
  const known=TEAM.find(p=>p.id===user?.id)
  if(known){state.current=known;state.selected=known;await enterApp()}else if(user){await state.sb.auth.signOut()}
}
boot()

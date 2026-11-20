'use strict';
(() => {
  const STORAGE_KEY = 'mieux-vivre:local:v2';
  const OLD_STORAGE_KEY = 'mieux-vivre:local:v1';
  const moodLabels = ['Très difficile', 'Difficile', 'Moyenne', 'Plutôt bonne', 'Très bonne'];
  const energyLabels = ['Épuisé·e', 'Faible', 'Moyenne', 'Bonne'];
  const painLabels = ['Aucune', 'Légères', 'Modérées', 'Fortes', 'Très fortes'];
  const sleepLabels = ['Très mauvais', 'Mauvais', 'Moyen', 'Bon', 'Très bon'];
  const activityIcons = {musique:"music",message:"chat",air:"air",ranger:"check",photo:"photo",contact:"heart",douche:"leaf",projet:"steps",lecture:"book",cafe:"cup",marche:"sprout",creer:"pencil"};
  const categories = {plaisir:'Plaisir', lien:'Lien social', maitrise:'Maîtrise', douceur:'Gestes doux'};
  const activities = [
    {id:'musique', title:'Écouter un morceau choisi', description:'Un morceau que tu aimes ou aimais, sans attendre qu’il change ton humeur.', minutes:4, category:'plaisir', icon:'♫'},
    {id:'message', title:'Envoyer un message simple', description:'« Je pense à toi. Comment vas-tu ? » ou simplement un emoji à quelqu’un de sûr.', minutes:2, category:'lien', icon:'✉'},
    {id:'air', title:'Changer d’air quelques instants', description:'Ouvrir une fenêtre, sortir sur le pas de la porte ou regarder dehors.', minutes:2, category:'douceur', icon:'☁'},
    {id:'ranger', title:'Remettre un objet à sa place', description:'Un seul objet suffit. L’idée est de retrouver un petit sentiment de maîtrise.', minutes:2, category:'maitrise', icon:'✓'},
    {id:'photo', title:'Regarder une photo agréable', description:'Retrouver un souvenir ou un lieu qui compte pour toi, sans forcer une émotion.', minutes:3, category:'plaisir', icon:'◇'},
    {id:'contact', title:'Proposer un court appel', description:'Demander à une personne de confiance si elle serait disponible pour parler.', minutes:5, category:'lien', icon:'♡'},
    {id:'douche', title:'Faire un geste de confort', description:'Se laver le visage, se changer ou rendre son espace un peu plus confortable.', minutes:5, category:'douceur', icon:'◌'},
    {id:'projet', title:'Avancer sur une minuscule étape', description:'Ouvrir un document, noter une idée ou préparer le prochain geste d’un projet.', minutes:5, category:'maitrise', icon:'✦'},
    {id:'lecture', title:'Lire ou regarder quelque chose de choisi', description:'Cinq à dix minutes d’une BD, d’une vidéo ou d’un sujet intéressant.', minutes:10, category:'plaisir', icon:'▤'},
    {id:'cafe', title:'Partager un moment avec quelqu’un', description:'Prendre des nouvelles, boire une boisson ensemble, en présence ou à distance.', minutes:15, category:'lien', icon:'◕'},
    {id:'marche', title:'Bouger doucement si possible', description:'Quelques pas ou mouvements confortables, uniquement si ton état physique le permet.', minutes:5, category:'douceur', icon:'↝'},
    {id:'creer', title:'Créer quelque chose sans objectif', description:'Gribouiller, écrire trois mots, prendre une photo ou tester une idée.', minutes:15, category:'maitrise', icon:'✎'}
  ];
  const legacyModuleCount = 6;
  const exercises = {"ground": {"title": "Revenir au présent · 1 à 2 minutes", "steps": ["Regarde autour de toi. Repère trois objets et nomme simplement leurs couleurs.", "Choisis un objet et décris intérieurement sa forme.", "Si cela aide, pose les pieds au sol ou change de pièce. Si cela augmente la tension, arrête."]}, "thought": {"title": "Mettre une petite distance avec une pensée", "steps": ["Observe : « Une image ou une pensée difficile est apparue. »", "Rappelle-toi qu'une pensée n'est ni une instruction ni une prédiction.", "Tourne ensuite ton attention vers une action courte : prendre contact, changer d'endroit ou faire une chose concrète.", "Si tu crains de te faire du mal, utilise immédiatement ton plan de sécurité ou appelle le 3114 / le 15."]}, "problem": {"title": "Débloquer un problème · 3 minutes", "steps": ["Écris mentalement le problème en une phrase factuelle et courte.", "Sépare ce qui dépend un peu de toi de ce qui ne dépend pas de toi aujourd'hui.", "Choisis une seule action de deux minutes, ou décide consciemment de demander de l'aide."]}};
  const $ = (id) => document.getElementById(id);
  const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const escapeHTML = (input) => String(input).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const carnet = window.Carnet;
  const checkinDay = () => carnet?.date || dateKey();
  const dayOffset = (n) => { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return dateKey(d); };
  const displayDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
  const defaultState = () => ({version:3, guided:MieuxGuide.fresh(), checkins:{}, logs:[], plans:[], customActivities:[], modulesDone:[], safety:{signs:'', helps:'', safer:'', people:'', name:'', phone:'', professional:'', professionalPhone:''}});
  const finiteIn = (value,min,max,otherwise) => Number.isInteger(value) && value>=min && value<=max ? value : otherwise;
  const cleanText = (value, n) => typeof value === 'string' ? value.slice(0,n) : '';
  const dateIsValid = (s) => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime()) && dateKey(new Date(`${s}T12:00:00`)) === s;
  const activityExists = (id) => allActivities().some(a=>a.id===id);
  const allActivities = () => [...activities,...state.customActivities];
  const activityById = id => allActivities().find(a=>a.id===id);
  const safePhone = (phone) => String(phone).replace(/[^\d+]/g,'').replace(/(?!^)\+/g,'');
  let storageAvailable = true;
  function normalize(data) {
    if (!data || typeof data!=='object' || Array.isArray(data) || ![1,2,3].includes(data.version)) throw Error('Sauvegarde incompatible.');
    const out=defaultState();
    if (data.version>=2 && Array.isArray(data.customActivities)) {
      const ids=new Set(activities.map(a=>a.id));
      for (const a of data.customActivities.slice(0,150)) {
        if(!a || typeof a!=='object')continue;
        const id=cleanText(a.id,70), title=cleanText(a.title,90).trim(), category=a.category;
        if(!/^custom-[a-zA-Z0-9-]+$/.test(id)||!title||ids.has(id)||!Object.hasOwn(categories,category))continue;
        ids.add(id);
        out.customActivities.push({id,title,description:cleanText(a.description,220),category,minutes:finiteIn(a.minutes,1,60,5),icon:'✎'});
      }
    }
    const validIds=new Set([...activities,...out.customActivities].map(a=>a.id));
    if (data.checkins && typeof data.checkins==='object' && !Array.isArray(data.checkins)) {
      for (const [date,check] of Object.entries(data.checkins).slice(-1500)) {
        if (!dateIsValid(date) || !check || typeof check!=='object') continue;
        out.checkins[date]={mood:finiteIn(check.mood,0,4,2), energy:finiteIn(check.energy,0,3,1), pain:finiteIn(check.pain,0,4,null), sleep:finiteIn(check.sleep,0,4,null), thoughts:['','none','present','unsafe'].includes(check.thoughts)?check.thoughts:''};
      }
    }
    if (Array.isArray(data.logs)) out.logs=data.logs.slice(-2500).filter(v=>v && validIds.has(v.activityId) && dateIsValid(v.date)).map(v=>({id:cleanText(v.id,70),activityId:v.activityId,date:v.date,before:finiteIn(v.before,0,4,2),after:finiteIn(v.after,0,4,2),note:cleanText(v.note,300)}));
    if (Array.isArray(data.plans)) out.plans=data.plans.slice(-500).filter(v=>v&&validIds.has(v.activityId)&&dateIsValid(v.date)).map(v=>({id:cleanText(v.id,70),activityId:v.activityId,date:v.date}));
    if (Array.isArray(data.modulesDone)) out.modulesDone=[...new Set(data.modulesDone.filter(i=>Number.isInteger(i)&&i>=0&&i<legacyModuleCount))];
    if (data.safety && typeof data.safety==='object') out.safety={signs:cleanText(data.safety.signs,500),helps:cleanText(data.safety.helps,500),safer:cleanText(data.safety.safer,500),people:cleanText(data.safety.people,300),name:cleanText(data.safety.name,80),phone:cleanText(data.safety.phone,30),professional:cleanText(data.safety.professional,80),professionalPhone:cleanText(data.safety.professionalPhone,30)};
    out.guided=MieuxGuide.normalize(data.guided);
    return out;
  }
  let state = defaultState();
  const readSaved = () => localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
  let savedMental;
  try {
    savedMental=readSaved();
    if(savedMental) state=normalize(JSON.parse(savedMental));
    localStorage.setItem(`${STORAGE_KEY}:probe`,'1');
    localStorage.removeItem(`${STORAGE_KEY}:probe`);
    if(savedMental && !carnet) localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  } catch { storageAvailable=false; }
  let activeActivityId = null;
  let activePlanId = null;
  let toastTimeout;
  function toast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.classList.remove('show'),4000); }
  function persist() {
    if (!storageAvailable) { toast('Stockage inaccessible : tes changements risquent de disparaître à la fermeture.'); return false; }
    try {
      if(carnet && readSaved() !== savedMental){
        toast('Le suivi mental a changé dans un autre onglet. Recharge le carnet avant de continuer.');
        return false;
      }
      const payload=JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY,payload);
      savedMental=payload;
      carnet?.refresh();
      return true;
    }
    catch { storageAvailable=false; toast('Sauvegarde locale impossible. Exporte tes données si nécessaire.'); return false; }
  }
  function go(view, focus=true) {
    const target = $('view-'+view);
    if (!target) return;
    const daily = carnet && target.classList.contains('carnet-entry');
    const page = daily ? 'home' : view;
    document.querySelectorAll('.view').forEach(el => {el.hidden = el.id!==`view-${page}`;});
    const parentView = carnet && view==='program' ? 'activities' : page;
    document.querySelectorAll('[data-view]').forEach(el => {
      const selected=el.dataset.view===parentView;
      el.classList.toggle('active',selected);
      if (selected) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    });
    if (view==='today') renderToday();
    if (view==='activities') renderLibrary();
    if (view==='insights') {renderInsights();renderPrivacy();}
    if (view==='program') renderProgram();
    if (view==='difficult') renderSafety();
    if (daily) target.scrollIntoView({block:'start', behavior:'instant'});
    else if (focus) {
      const scroller = document.documentElement.hasAttribute('data-carnet-native') ? document.querySelector('.carnet-unifie > .layout') : window;
      scroller.scrollTo({top:0, behavior:'instant'});
    }
    if (!focus) return;
    const heading = target.querySelector(daily ? 'h2' : 'h1');
    heading.tabIndex = -1;
    heading.focus({preventScroll:true});
  }
  function makeActivityCard(a, compact=false) {
    const title=escapeHTML(a.title);
    const icon=`<span class="activity-icon ${a.category}" aria-hidden="true">${window.MieuxVisual.icon(activityIcons[a.id] || "pencil")}</span>`;
    const description=`<p class="activity-desc">${escapeHTML(a.description)}</p>`;
    const meta=`<span class="activity-meta">${a.minutes} min environ · ${categories[a.category]}</span>`;
    const actions=`<div class="activity-actions"><button class="btn btn-primary" type="button" data-action="try" data-id="${a.id}" aria-label="J'ai essayé : ${title}">J'ai essayé</button><button class="btn btn-ghost" type="button" data-action="plan" data-id="${a.id}" aria-label="Prévoir demain : ${title}">Prévoir demain</button></div>`;
    if (compact) {
      return `<article><details><summary>${icon}<span><strong>${title}</strong>${meta}</span></summary><div class="carnet-suggestion-body">${description}${actions}</div></details></article>`;
    }
    return `<article class="card activity-card"><div class="activity-main">${icon}<div><h3 class="activity-title">${title}</h3>${description}${meta}</div></div>${actions}</article>`;
  }
  function recommendations() {
    const today=state.checkins[checkinDay()];
    const energy=today ? today.energy : sliderLevel('energy');
    const movementPain=carnet?.movement?.(checkinDay())?.pain;
    const pain=movementPain == null ? today?.pain : movementPain * 0.4;
    const low=energy<=1 || pain>=3;
    const pool = allActivities().filter(a=>low ? a.minutes<=5 : energy<=2 ? a.minutes<=10 : true);
    const orderedCategories=low ? ['douceur','lien','plaisir'] : ['plaisir','maitrise','lien'];
    const counts = Object.create(null);
    state.logs.filter(v=>v.date>=dayOffset(-7)).forEach(v=>{ counts[v.activityId]=(counts[v.activityId]||0)+1; });
    return orderedCategories.map(category=>pool.filter(a=>a.category===category).sort((a,b)=>(counts[a.id]||0)-(counts[b.id]||0))[0]).filter(Boolean);
  }
  function renderToday() {
    $('today-date').textContent=new Date(checkinDay()+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const current=state.checkins[checkinDay()];
    $('saved-checkin').textContent=current ? 'Bilan sauvegardé sur cet appareil. Tu peux le modifier.' : 'Rien n’est envoyé sur Internet.';
    $('today-recs').innerHTML=recommendations().map(a=>makeActivityCard(a)).join('');
    const plans=state.plans.filter(p=>p.date>=dateKey()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,20);
    $('planned-list').innerHTML=plans.length ? plans.map(plan=>{
      const a=activityById(plan.activityId);
      return `<article class="card plan-item"><div><strong>${escapeHTML(a.title)}</strong><small>${plan.date===dateKey()?'Aujourd’hui':plan.date===dayOffset(1)?'Demain':displayDate(plan.date)} · Souple et modifiable</small></div><div class="action-links"><button type="button" class="btn btn-primary" data-action="finish-plan" data-plan="${escapeHTML(plan.id)}">Essayé</button><button type="button" class="btn btn-ghost" data-action="remove-plan" data-plan="${escapeHTML(plan.id)}" aria-label="Retirer cette activité prévue">×</button></div></article>`;
    }).join('') : '<div class="empty-box">Rien de prévu. Tu peux choisir une suggestion, ou simplement laisser cette journée libre.</div>';
  }
  const libraryMore=$('activity-more');
  let libraryExpanded=false;
  function renderLibrary() {
    const category=$('category-filter').value;
    const matching=a=>category==='all'||a.category===category;
    const activities=allActivities().filter(matching);
    $('activity-count').textContent=activities.length+' activité'+(activities.length===1?'':'s');
    if (libraryMore) {
      const personal = state.customActivities.filter(matching).reverse();
      const ordered = [...personal, ...activities.filter(activity=>!activity.id.startsWith('custom-'))];
      $('activity-library').innerHTML=(libraryExpanded ? ordered : ordered.slice(0,3)).map(a=>makeActivityCard(a,true)).join('');
      libraryMore.hidden=ordered.length<=3;
      libraryMore.textContent=libraryExpanded ? 'Voir moins' : 'Voir les '+ordered.length+' activités';
      libraryMore.setAttribute('aria-expanded',String(libraryExpanded));
    } else {
      $('activity-library').innerHTML=activities.map(a=>makeActivityCard(a)).join('');
    }
  }
  function renderInsights() {
    const dates=Array.from({length:14},(_,i)=>dayOffset(i-13));
    $('metric-checkins').textContent=dates.filter(d=>state.checkins[d]).length;
    $('mood-empty').hidden=dates.some(d=>state.checkins[d]);
    $('metric-actions').textContent=state.logs.length;
    $('professional-summary').textContent=professionalSummary();
    const chart=$('mood-chart');
    chart.innerHTML=dates.map(date=>{
      const check=state.checkins[date];
      const label=displayDate(date);
      const height=check? Math.max(6,Math.round(check.mood/4*100)) : 0;
      const alt=check?`${label}, humeur ${check.mood} sur 4 : ${moodLabels[check.mood]}`:`${label}, aucun bilan`;
      return `<div class="mood-day" role="img" aria-label="${escapeHTML(alt)}" title="${escapeHTML(alt)}"><div class="mood-bar-track"><div class="mood-bar ${check?'':'none'}" data-height="${height}"></div></div><span aria-hidden="true">${escapeHTML(label)}</span></div>`;
    }).join('');
    chart.querySelectorAll('[data-height]').forEach(bar=>{bar.style.height=bar.dataset.height+'%';});
    const list=state.logs.slice(-15).reverse();
    $('activity-history').innerHTML=list.length ? list.map(log=>{
      const a=activityById(log.activityId);
      const diff=log.after-log.before;
      const change=diff>0?`+${diff}`:String(diff);
      return `<div class="history-item"><div><strong>${escapeHTML(a.title)}</strong><small>${escapeHTML(displayDate(log.date))}${log.note?' · '+escapeHTML(log.note):''}</small></div><span class="change-pill"><span class="visually-hidden">Variation d'humeur avant-après : </span>${change}</span></div>`;
    }).join('') : '<p class="footnote">Aucun essai enregistré.</p>';
  }
  function renderProgram() {
    MieuxGuide.render(state,persist,go,toast);
  }
  function renderThoughtsSupport() {
    const v=$('thoughts').value; const div=$('thoughts-support');
    if (carnet && (v==='present' || v==='unsafe')) div.closest('details').open=true;
    if(v==='present') {
      div.hidden=false;
      div.innerHTML='<p>Ces pensées méritent d’être évoquées avec ton équipe de soins, même sans intention d’agir. Tu peux aussi appeler le <a href="tel:3114?oai_link_source=model_response_hotline">3114</a> pour en parler.</p>';
    } else if(v==='unsafe') {
      div.hidden=false;
      div.innerHTML='<strong>Ta sécurité passe en premier.</strong><p>Ne reste pas seul·e. Contacte une personne de confiance, appelle le <a href="tel:15">15</a> ou le <a href="tel:112">112</a> si le danger est immédiat. Le <a href="tel:3114?oai_link_source=model_response_hotline">3114</a> peut aussi t’écouter.</p><button type="button" class="btn btn-alert" data-goto="difficult">Ouvrir mon plan de sécurité</button>';
    } else {div.hidden=true;div.replaceChildren();}
  }
  function professionalSummary(){
    const dates=Array.from({length:14},(_,i)=>dayOffset(i-13));
    const checks=dates.map(d=>state.checkins[d]).filter(Boolean);
    let otherJournals='';
    if(carnet){
      const sessions=dates.map(day=>carnet.movement?.(day)).filter(Boolean);
      const minutes=sessions.reduce((sum,session)=>sum+carnet.movementMinutes(session),0);
      otherJournals='\nActivité : '+sessions.length+' journée(s) renseignée(s), '+minutes+' min consignées.';
    }
    if(!checks.length)return 'Aucun bilan d’humeur sur les 14 derniers jours.'+otherJournals+MieuxGuide.summary(state);
    const avg=(key,max)=>{
      const values=checks.map(check=>check[key]).filter(Number.isFinite);
      return values.length ? (values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(1).replace('.',',')+'/'+max : 'non renseigné';
    };
    const attempts=state.logs.filter(l=>dates.includes(l.date)).length;
    const thoughtDays=checks.filter(c=>c.thoughts==='present'||c.thoughts==='unsafe').length;
    const oldRatings=carnet ? '' : `, anciens relevés de douleur ${avg('pain',4)} et de sommeil ${avg('sleep',4)}`;
    return `Bilan personnel des 14 derniers jours (auto-observation, non diagnostique) : ${checks.length} jour(s) renseigné(s). Moyennes : humeur ${avg('mood',4)}, énergie ${avg('energy',3)}${oldRatings}. Activités essayées : ${attempts}. ${thoughtDays ? `Pensées ou images suicidaires signalées dans ${thoughtDays} bilan(s) : à discuter directement, sans déduire un niveau de risque.` : 'La fréquence des pensées suicidaires n’est pas évaluée par ce résumé.'} J’aimerais discuter des stratégies utiles, de leur faisabilité et de mon suivi.`+otherJournals+MieuxGuide.summary(state);
  }
  function renderSafety() {
    const s=state.safety;
    $('warning-signs').value=s.signs; $('helps-me').value=s.helps; $('safe-environment').value=s.safer; $('people-places').value=s.people; $('contact-name').value=s.name; $('contact-phone').value=s.phone; $('professional-name').value=s.professional; $('professional-phone').value=s.professionalPhone;
    const goodNumber=safePhone(s.phone);
    const contact=$('trusted-contact');
    if(s.name && /^\+?\d{6,15}$/.test(goodNumber)) {
      contact.hidden=false;
      contact.replaceChildren();
      const label=document.createElement('span');label.textContent=`Contact de confiance : ${s.name} · `;
      const a=document.createElement('a');a.href=`tel:${goodNumber}`;a.textContent='Appeler cette personne';
      contact.append(label,a);
    } else {contact.hidden=true;contact.replaceChildren();}
    const professional=$('professional-contact'), profNumber=safePhone(s.professionalPhone);
    if(s.professional && /^\+?\d{6,15}$/.test(profNumber)) {
      professional.hidden=false;professional.replaceChildren();
      const label=document.createElement('span');label.textContent=`Suivi : ${s.professional} · `;
      const a=document.createElement('a');a.href=`tel:${profNumber}`;a.textContent='Appeler ce professionnel';
      professional.append(label,a);
    } else {professional.hidden=true;professional.replaceChildren();}
  }
  function renderPrivacy() {
    if(window.webkit?.messageHandlers?.native) $('data-location').textContent='Tes bilans restent sur cet iPhone. Le fichier de sauvegarde peut être protégé par mot de passe.';
    $('storage-status').textContent=storageAvailable?'':'Stockage local inaccessible. Les changements peuvent être perdus à la fermeture.';
  }
  const sliderConfigs=[
    ['mood','mood-value',moodLabels],['energy','energy-value',energyLabels],
    ['pain','pain-value',painLabels],
    ['before-mood','before-value',moodLabels],['after-mood','after-value',moodLabels]
  ];
  if (!carnet) sliderConfigs.push(['sleep','sleep-value',sleepLabels]);
  const sliderLevel = id => Math.round(Number($(id).value));
  function updateSlider(id, output, labels) {
    const label=labels[sliderLevel(id)];
    if ($(output).textContent!==label) $(output).textContent=label;
    if ($(id).getAttribute('aria-valuetext')!==label) $(id).setAttribute('aria-valuetext',label);
  }
  function updateSliders() {
    sliderConfigs.forEach(config=>updateSlider(...config));
  }
  let shownCheckin;
  const checkinSliders = carnet ? ['mood','energy','pain'] : ['mood','energy','pain','sleep'];
  const checkinValues = () => [...checkinSliders,'thoughts'].map(id=>$(id).value).join(',');
  function rememberCheckin() { shownCheckin=checkinValues(); }
  if(carnet){
    carnet.mental = date => {
      const check = state.checkins[date];
      return check ? {mood:moodLabels[check.mood], moodLevel:check.mood, energy:energyLabels[check.energy], pain:painLabels[check.pain]} : null;
    };
    document.addEventListener('carnet:before-date',event=>{
      if(!event.defaultPrevented && checkinValues()!==shownCheckin && !confirm('Changer de date sans enregistrer le bilan d’humeur ?')) event.preventDefault();
    });
    document.addEventListener('carnet:date',()=>{loadCheckinControls();renderToday();});
    // Refresh only the visible summary when another journal changes.
    document.addEventListener('carnet:change',()=>{
      if(!$('view-insights').hidden) $('professional-summary').textContent=professionalSummary();
    });
  }
  function loadCheckinControls() {
    const current=state.checkins[checkinDay()]||{mood:2,energy:1,pain:2,sleep:2,thoughts:''};
    for(const name of checkinSliders) $(name).value=current[name] ?? 2;
    $('thoughts').value=current.thoughts||'';renderThoughtsSupport();updateSliders();rememberCheckin();
  }
  function openReflection(id, planId=null) {
    const activity=activityById(id); if(!activity)return;
    activeActivityId=id;activePlanId=planId;
    $('dialog-title').textContent=activity.title;
    $('before-mood').value=state.checkins[dateKey()]?.mood ?? sliderLevel('mood');
    $('after-mood').value=$('before-mood').value;
    $('reflection-note').value=''; updateSliders();
    $('reflection-dialog').showModal();
  }
  function handleAction(action, el) {
    const activityId=el.dataset.id;
    if(action==='try') return openReflection(activityId);
    if(action==='plan') {
      if(!activityExists(activityId))return;
      if(state.plans.some(p=>p.activityId===activityId&&p.date===dayOffset(1))) {toast('Cette activité est déjà prévue pour demain.');return;}
      state.plans.push({id:makeId(),activityId,date:dayOffset(1)});persist();renderToday();toast('Prévu pour demain, sans obligation.');return;
    }
    const planId=el.dataset.plan;
    if(action==='remove-plan') {state.plans=state.plans.filter(p=>p.id!==planId);persist();renderToday();toast('Activité retirée.');}
    if(action==='finish-plan') {const plan=state.plans.find(p=>p.id===planId);if(plan)openReflection(plan.activityId,plan.id);}
  }
  function exportData() {
    const payload=JSON.stringify({...state, exportedAt:new Date().toISOString(), app:'Mieux vivre'},null,2);
    download(`mieux-vivre-sauvegarde-${dateKey()}.json`,payload,'application/json');
    toast('Fichier de sauvegarde créé. Conserve-le dans un endroit sûr.');
  }
  async function importData(file) {
    if(!file)return;
    if(file.size>2_000_000){toast('Le fichier dépasse la limite de 2 Mo.');return;}
    try{
      const parsed=JSON.parse(await file.text());
      if(parsed.app!=='Mieux vivre') throw Error('Ce fichier ne provient pas d’un export compatible.');
      const imported=normalize(parsed);
      if(!window.confirm('Remplacer tous les bilans, activités et contacts de cet appareil par ceux de ce fichier ?'))return;
      state=imported;if(!persist())return;renderProgram();loadCheckinControls();renderToday();renderSafety();renderInsights();toast('Sauvegarde importée dans cet appareil.');
    }catch(err){toast(err?.message==='Sauvegarde incompatible.'?err.message:'Fichier invalide ou incompatible.');}
  }
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-view]');if(nav)return go(nav.dataset.view);
    const goto=e.target.closest('[data-goto]');
    if(goto){
      go(goto.dataset.goto);
      const anchor=$(goto.dataset.carnetAnchor);
      if(anchor){
        anchor.open=true;
        anchor.querySelector('summary').focus();
        anchor.scrollIntoView({block:'start'});
      }
      return;
    }
    const action=e.target.closest('[data-action]');if(action)return handleAction(action.dataset.action,action);
  });
  const moodBridge = window.webkit?.messageHandlers?.native;
  if (window.mvHealth === true && moodBridge) {
    const dialog = $('health-dialog');
    const period = $('health-period');
    const send = $('send-health');
    const feedback = $('health-feedback');
    let sending = false;
    $('health-card').hidden = false;

    function entriesToSend() {
      const today = dateKey();
      const from = period.value === 'today' ? today : period.value === 'recent' ? dayOffset(-13) : '';
      return Object.entries(state.checkins).filter(([day]) => day >= from && day <= today)
        .sort(([a], [b]) => a.localeCompare(b)).map(([day, check]) => ({day,mood:check.mood}));
    }
    function refreshSendCount() {
      const count = entriesToSend().length;
      $('health-count').textContent = count === 0 ? 'Aucun bilan enregistré sur cette période.' :
        count === 1 ? '1 humeur quotidienne à envoyer.' : `${count} humeurs quotidiennes à envoyer.`;
      send.disabled = sending || count === 0;
    }
    $('open-health').addEventListener('click', () => { refreshSendCount(); dialog.showModal(); });
    $('close-health').addEventListener('click', () => dialog.close());
    period.addEventListener('change', refreshSendCount);
    $('health-form').addEventListener('submit', event => {
      event.preventDefault();
      const entries = entriesToSend();
      if (sending || !entries.length) return;
      sending = true;
      $('open-health').disabled = true;
      refreshSendCount();
      dialog.close();
      feedback.textContent = 'Envoi à Santé…';
      try { moodBridge.postMessage({action:'health-mood',content:JSON.stringify(entries)}); }
      catch { window.MieuxVivreHealthResult('failed', 0); }
    });
    window.MieuxVivreHealthResult = (status, count) => {
      sending = false;
      $('open-health').disabled = false;
      if (status === 'saved') feedback.textContent = count === 1 ?
        '1 humeur enregistrée dans Santé.' : `${count} humeurs enregistrées dans Santé.`;
      else if (status === 'denied') feedback.textContent = 'Autorise l’écriture de l’humeur dans les réglages de Santé, puis réessaie.';
      else feedback.textContent = 'L’envoi à Santé a échoué. Tes bilans restent dans le carnet.';
      refreshSendCount();
    };
  }
  $('quick-help').addEventListener('click',()=>go('difficult'));
  $('all-activities').addEventListener('click',()=>go('activities'));
  for (const config of sliderConfigs) {
    const [id]=config;
    const slider=$(id);
    const commitSlider = () => {
      const level=sliderLevel(id);
      slider.step='1';
      slider.value=level;
      updateSlider(...config);
      if ((id==='energy' || id==='pain') && !state.checkins[checkinDay()]) {
        $('today-recs').innerHTML=recommendations().map(a=>makeActivityCard(a)).join('');
      }
    };
    const finishDrag = () => {if(slider.step==='any') commitSlider();};
    slider.addEventListener('pointerdown',event=>{
      if (event.isPrimary && event.button===0) slider.step='any';
    });
    slider.addEventListener('input',()=>updateSlider(...config));
    slider.addEventListener('change',commitSlider);
    slider.addEventListener('pointerup',()=>setTimeout(finishDrag,0));
    slider.addEventListener('pointercancel',finishDrag);
    slider.addEventListener('blur',finishDrag);
  }
  $('checkin-form').addEventListener('submit',e=>{
    e.preventDefault();
    const day=checkinDay();
    const previous=state.checkins[day];
    state.checkins[day]={mood:sliderLevel('mood'),energy:sliderLevel('energy'),pain:previous?.pain ?? null,sleep:previous?.sleep ?? null,thoughts:$('thoughts').value};
    if(!persist()){
      if(previous) state.checkins[day]=previous; else delete state.checkins[day];
      return;
    }
    rememberCheckin();renderToday();toast('Ton bilan est enregistré sur cet appareil.');
  });
  $('thoughts').addEventListener('change',renderThoughtsSupport);
  document.addEventListener('click',e=>{
    const exerciseBtn=e.target.closest('[data-exercise]');
    if(exerciseBtn){const ex=exercises[exerciseBtn.dataset.exercise];if(!ex)return;
      const container=$('exercise-result');container.hidden=false;
      container.innerHTML=`<h3>${escapeHTML(ex.title)}</h3><ol>${ex.steps.map(step=>`<li>${escapeHTML(step)}</li>`).join('')}</ol><p class="footnote">Tu peux arrêter ou passer à autre chose à tout moment.</p>`;
      container.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
  });
  $('custom-activity-form').addEventListener('submit',e=>{
    e.preventDefault();
    if(state.customActivities.length>=150){toast('Limite atteinte : 150 activités personnelles.');return;}
    const title=$('custom-title').value.trim().slice(0,90),desc=$('custom-desc').value.trim().slice(0,220);
    const category=$('custom-category').value,minutes=Number($('custom-minutes').value);
    if(!title||!Object.hasOwn(categories,category)||!Number.isInteger(minutes)||minutes<1||minutes>60)return;
    state.customActivities.push({id:'custom-'+makeId(),title,description:desc,category,minutes,icon:'✎'});
    persist();e.target.reset();renderLibrary();renderToday();toast('Activité personnelle ajoutée.');
  });
  $('copy-summary').addEventListener('click',async()=>{
    try{if(window.webkit?.messageHandlers?.native)window.webkit.messageHandlers.native.postMessage({action:'copy',content:professionalSummary()});else await navigator.clipboard.writeText(professionalSummary());toast('Résumé copié. Choisis toi-même à qui le transmettre.');}
    catch{toast('Copie non disponible sur ce navigateur. Sélectionne le texte manuellement.');}
  });
  $('category-filter').addEventListener('change',()=>{libraryExpanded=false;renderLibrary();});
  libraryMore?.addEventListener('click',()=>{libraryExpanded=!libraryExpanded;renderLibrary();});
  $('close-dialog').addEventListener('click',()=>$('reflection-dialog').close());
  $('cancel-dialog').addEventListener('click',()=>$('reflection-dialog').close());
  $('reflection-form').addEventListener('submit',e=>{
    e.preventDefault();
    if(!activityExists(activeActivityId))return;
    state.logs.push({id:makeId(),activityId:activeActivityId,date:dateKey(),before:sliderLevel('before-mood'),after:sliderLevel('after-mood'),note:$('reflection-note').value.trim().slice(0,300)});
    if(activePlanId)state.plans=state.plans.filter(p=>p.id!==activePlanId);
    persist();$('reflection-dialog').close();renderToday();renderInsights();toast('Essai observé. Il n’y avait rien à réussir.');
  });
  $('safety-form').addEventListener('submit',e=>{
    e.preventDefault();state.safety={signs:$('warning-signs').value.trim().slice(0,500),helps:$('helps-me').value.trim().slice(0,500),safer:$('safe-environment').value.trim().slice(0,500),people:$('people-places').value.trim().slice(0,300),name:$('contact-name').value.trim().slice(0,80),phone:$('contact-phone').value.trim().slice(0,30),professional:$('professional-name').value.trim().slice(0,80),professionalPhone:$('professional-phone').value.trim().slice(0,30)};
    if(!persist())return;renderSafety();toast('Ton plan a été sauvegardé localement.');
  });
  function askPassword(restoring) {
    const dialog=$('crypto-dialog'),form=$('crypto-form');
    $('crypto-title').textContent=restoring?'Ouvrir ma sauvegarde':'Protéger ma sauvegarde';
    $('crypto-instructions').textContent=restoring?'Entre le mot de passe choisi lors de l’export. Il n’est pas conservé.':'Au moins 12 caractères. Conserve ce mot de passe dans un endroit sûr : sans lui, cette sauvegarde sera irrécupérable.';
    $('crypto-repeat-row').hidden=restoring;
    $('crypto-password').value='';$('crypto-repeat').value='';$('crypto-error').textContent='';
    return new Promise(resolve=>{
      let result=null;
      const submit=e=>{e.preventDefault();const value=$('crypto-password').value;
        if(!restoring&&(value.length<12||value!==$('crypto-repeat').value)){$('crypto-error').textContent=value.length<12?'Utilise au moins 12 caractères.':'Les deux mots de passe sont différents.';return;}
        result=value;dialog.close();};
      form.addEventListener('submit',submit);
      dialog.addEventListener('close',()=>{form.removeEventListener('submit',submit);$('crypto-password').value='';$('crypto-repeat').value='';resolve(result);},{once:true});
      dialog.showModal();
    });
  }
  $('crypto-close').addEventListener('click',()=>$('crypto-dialog').close());
  const bytesToBase64 = data => {let bin='';for(const byte of data)bin+=String.fromCharCode(byte);return btoa(bin);};
  const base64ToBytes = str => Uint8Array.from(atob(str),c=>c.charCodeAt(0));
  async function deriveKey(password,salt){
    const keyMaterial=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function download(name,content,mime){
    if(window.webkit?.messageHandlers?.native){window.webkit.messageHandlers.native.postMessage({action:'export',name,content});return;}
    const blob=new Blob([content],{type:mime});const u=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),3000);
  }
  $('export-encrypted').addEventListener('click',async()=>{
    if(!globalThis.crypto?.subtle){toast('Chiffrement non disponible ici : le chiffrement nécessite un contexte compatible et sécurisé.');return;}
    const password=await askPassword(false);
    if(password===null)return;
    if(password.length<12){toast('Il faut au moins 12 caractères.');return;}
    try {
      const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
      const key=await deriveKey(password,salt);
      const payload=JSON.stringify({...state,app:'Mieux vivre',exportedAt:new Date().toISOString()});
      const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(payload));
      const outer=JSON.stringify({format:'mieux-vivre-encrypted-v1',kdf:'PBKDF2-SHA256',iterations:250000,cipher:'AES-256-GCM',salt:bytesToBase64(salt),iv:bytesToBase64(iv),payload:bytesToBase64(new Uint8Array(encrypted))});
      download(`mieux-vivre-sauvegarde-${dateKey()}.mvx`,outer,'application/json');toast('Sauvegarde chiffrée créée. Conserve bien ton mot de passe.');
    }catch{toast('Le chiffrement a échoué.');}
  });
  $('import-encrypted').addEventListener('change',async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(!globalThis.crypto?.subtle){toast('Déchiffrement non disponible ici. Le chiffrement nécessite un contexte compatible et sécurisé.');return;}
    if(file.size>3_000_000){toast('Fichier trop volumineux.');return;}
    const pass=await askPassword(true);if(pass===null)return;
    try{
      const enc=JSON.parse(await file.text());
      if(enc.format!=='mieux-vivre-encrypted-v1'||enc.iterations!==250000||enc.cipher!=='AES-256-GCM')throw Error('format');
      const salt=base64ToBytes(enc.salt),iv=base64ToBytes(enc.iv),ciphertext=base64ToBytes(enc.payload);
      if(salt.length!==16||iv.length!==12||ciphertext.length>2_500_000)throw Error('format');
      const key=await deriveKey(pass,salt);
      const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ciphertext);
      const data=JSON.parse(new TextDecoder().decode(plaintext));
      if(data.app!=='Mieux vivre')throw Error('format');
      const parsed=normalize(data);
      if(!confirm('Remplacer toutes les données de cette application par la sauvegarde déchiffrée ?'))return;
      state=parsed;if(!persist())return;loadCheckinControls();renderToday();renderLibrary();renderProgram();renderInsights();renderSafety();toast('Sauvegarde chiffrée restaurée.');
    }catch{toast('Impossible de restaurer : mot de passe incorrect ou fichier invalide.');}
  });
  $('export-data').addEventListener('click',exportData);
  $('import-data').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importData(file);e.target.value='';});
  $('delete-data').addEventListener('click',()=>{
    if(!window.confirm('Effacer définitivement tous les bilans, les essais, les intentions et le plan de soutien enregistrés dans ce navigateur ?'))return;
    try{
      if(carnet && readSaved() !== savedMental){
        toast('Le suivi mental a changé dans un autre onglet. Recharge le carnet avant de continuer.');
        return;
      }
      localStorage.removeItem(OLD_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      savedMental=null;
      state=defaultState();
    }catch{toast('Impossible d’effacer les données locales.');return;}
    loadCheckinControls();renderToday();renderInsights();renderSafety();renderPrivacy();carnet?.refresh();toast('Les données locales de l’application ont été effacées.');
  });
  loadCheckinControls();renderToday();renderLibrary();renderProgram();renderInsights();renderPrivacy();
  if(carnet){
    carnet.refresh();
    const view=new URLSearchParams(location.search).get('vue');
    go(['today','movement','insights'].includes(view)?view:'home',false);
  }
  if(!carnet && window.self===window.top && !location.pathname.endsWith('-en-ligne.html') && !window.webkit?.messageHandlers?.native && 'serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  }
})();

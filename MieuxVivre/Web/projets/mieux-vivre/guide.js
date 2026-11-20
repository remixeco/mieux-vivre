'use strict';
window.MieuxGuide = (() => {
 const course=window.MV_COURSE, sources=window.MV_SOURCES, sessions=course.flatMap(m=>m.sessions);
 const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const chapterIcons=["focus","sprout","energy","air","steps","chat","calendar","leaf"];
 const labels=['Comprendre','Me situer','Essayer à ma taille','Retenir'];
 const fields=['context','action','when','where','obstacle','fallback','outcome','reflection'];
 let state, save, go, toast, active=null;
 function fresh(){return {started:'',size:'short',sessions:{}};}
 function normalize(raw){
  const out=fresh(); if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  if(typeof raw.started==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(raw.started))out.started=raw.started;
  if(['micro','short','normal'].includes(raw.size))out.size=raw.size;
  for(const s of sessions){
   const r=raw.sessions?.[s.id];if(!r||typeof r!=='object'||Array.isArray(r))continue;
   const v={step:Number.isInteger(r.step)&&r.step>=0&&r.step<4?r.step:0,done:r.done===true,updated:typeof r.updated==='string'?r.updated.slice(0,30):'',answers:{}};
   for(const f of fields)if(typeof r.answers?.[f]==='string')v.answers[f]=r.answers[f].slice(0,800);
   if(!['','not','partial','tried','rest'].includes(v.answers.outcome||''))v.answers.outcome='';
   out.sessions[s.id]=v;
  }return out;
 }
 function current(){return state.guided||(state.guided=fresh());}
 function next(){return sessions.find(s=>!current().sessions[s.id]?.done)||sessions[0];}
 function count(){return sessions.filter(s=>current().sessions[s.id]?.done).length;}
 function sourceLinks(ids){return ids.map(id=>{const s=sources.find(s=>s.id===id);return s?`<a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`:'';}).join(' · ');}
 function overview(){
  active=null;const g=current(),n=next(),done=count();
  $('guide-session').hidden=true;$('guide-overview').hidden=false;
  $('guide-overview').innerHTML=`<div class="program-hero card"><div class="orbit" aria-hidden="true">${window.MieuxVisual?.icon("sprout") || "✦"}</div><p class="eyebrow">UN REPÈRE, PAS UNE COURSE</p><h2>${done===24?'Ton parcours reste à ta disposition':'Tu peux commencer petit.'}</h2><p>8 chapitres · 24 séances à explorer librement. Quelques minutes, ou une version minimum. Toutes tes réponses sont facultatives.</p><div class="course-progress"><span>${done} / 24 séances explorées</span></div><progress value="${done}" max="24" aria-label="Séances explorées">${done}/24</progress><button class="btn btn-primary" data-guide-open="${n.id}" type="button">${g.sessions[n.id]?'Reprendre':'Commencer'} · ${esc(n.title)} <span aria-hidden="true">→</span></button></div>
   <div class="guide-pacing card"><label for="guide-size">La taille de ma séance aujourd’hui</label><select id="guide-size"><option value="micro" ${g.size==='micro'?'selected':''}>Minimum · un seul repère</option><option value="short" ${g.size==='short'?'selected':''}>Court · environ 2 à 5 minutes</option><option value="normal" ${g.size==='normal'?'selected':''}>À mon rythme · prendre le temps</option></select><p>Repères de durée indicatifs. Tu peux t’arrêter, reporter ou te reposer à chaque écran.</p></div>
   <h2 id="course-chapters">Tous les chapitres</h2><div class="course-path">${course.map((m,i)=>{const d=m.sessions.filter(s=>g.sessions[s.id]?.done).length;return `<details class="card course-module" ${m.sessions.includes(n)?'open':''}><summary class="course-heading"><span class="course-symbol" aria-hidden="true">${window.MieuxVisual?.icon(chapterIcons[i]) || m.icon}</span><span class="course-heading-copy"><span class="eyebrow">Chapitre ${i+1}</span><strong class="course-title">${esc(m.title)}</strong><span class="course-subtitle">${esc(m.subtitle)}</span></span><span class="chapter-count">${d}/3<span class="visually-hidden"> séances explorées</span></span></summary><div class="session-links">${m.sessions.map((s,j)=>{const r=g.sessions[s.id];return `<button type="button" data-guide-open="${s.id}"><span class="session-number" aria-hidden="true">${r?.done?'✓':j+1}</span><span>${esc(s.title)}<small>${r?.done?'Explorée · à revisiter librement':r?'En cours · reprendre':'À découvrir'}</small></span><span aria-hidden="true">↗</span></button>`;}).join('')}</div><details class="source-detail"><summary>Fondements et limites</summary><p>${sourceLinks(m.source)}</p><p>Exercices originaux d’autoaccompagnement, non évalués cliniquement. Les adaptations et les durées sont des choix de conception.</p></details></details>`;}).join('')}</div>
   <div class="info-strip"><strong>Faire le point avec une aide humaine.</strong> Dès maintenant si besoin ; après 2 à 4 semaines pour revoir ce qui aide et ce qui ne suffit pas. Si ton état s’aggrave, n’attends pas la fin du parcours.</div><button class="btn btn-ghost" data-guide-sources type="button">Lire les sources et le niveau de preuve</button>`;
 }
 function record(id){const g=current();return g.sessions[id]||(g.sessions[id]={step:0,done:false,updated:'',answers:{}});}
 function open(id){
  if(!sessions.some(s=>s.id===id))return;
  if(!current().started)current().started=new Date().toLocaleDateString('sv-SE');
  active=id;record(id);save();draw();
 }
 function input(key,label,placeholder='',long=false){const a=record(active).answers;return `<label for="guide-${key}">${esc(label)} <span class="optional">facultatif</span></label>${long?`<textarea rows="3"`:`<input type="text"`} id="guide-${key}" data-guide-field="${key}" maxlength="800" placeholder="${esc(placeholder)}"${long?`>${esc(a[key])}</textarea>`:` value="${esc(a[key])}">`}`;}
 function draw(){
  const s=sessions.find(s=>s.id===active);if(!s)return;
  const m=course.find(m=>m.sessions.includes(s)),r=record(active),step=r.step,micro=current().size==='micro';
  $('guide-overview').hidden=true;const pane=$('guide-session');pane.hidden=false;
  let body='';
  if(step===0)body=`<p class="eyebrow">UNE IDÉE À EMPORTER</p><h2>${esc(s.title)}</h2>${s.learn.map(t=>`<p class="lesson-text">${esc(t)}</p>`).join('')}<div class="lesson-example"><span class="eyebrow">PAR EXEMPLE</span><p>${esc(s.example)}</p></div><p class="footnote">Ce programme propose des exercices, sans assurer un suivi clinique. Tes réponses ne sont ni analysées par une IA ni surveillées.</p>`;
  if(step===1)body=`<p class="eyebrow">PARTIR DE MA VRAIE VIE</p><h2>${esc(s.observe)}</h2><p>Tu peux écrire, y réfléchir sans écrire, ou passer. Évite de détailler un vécu qui te déstabilise.</p><div class="guide-fields">${input('context','Mon point de départ',s.placeholder,true)}</div><div class="lesson-example"><strong>Si écrire coûte trop</strong><p>Un mot suffit. Tu peux aussi continuer sans réponse.</p></div>`;
  if(step===2)body=`<p class="eyebrow">${micro?'VERSION MINIMUM':'UNE EXPÉRIENCE, PAS UNE OBLIGATION'}</p><h2>À ma taille, aujourd’hui.</h2>${micro?`<div class="micro-card"><span aria-hidden="true">◌</span><p>${esc(s.mini)}</p></div>`:`<ol class="practice-steps">${s.practice.map(t=>`<li>${esc(t)}</li>`).join('')}</ol><div class="guide-fields">${input('action','Mon geste choisi','Un seul geste concret')}<div class="form-grid"><div>${input('when','Mon repère de moment','Ex. : après ma boisson du matin')}</div><div>${input('where','Mon lieu','Un endroit accessible')}</div></div><details><summary>Préparer un obstacle et un plan B</summary>${input('obstacle','Ce qui pourrait gêner','Fatigue, douleur, manque de matériel…')}${input('fallback','Ma version minimum ou mon aide','Réduire, demander de l’aide, reporter…')}</details></div>`}<div class="info-strip">Respecte tes limites physiques. Tu peux t’arrêter ou te reposer. Une adaptation n’est pas un échec.</div><button class="btn btn-ghost" data-guide-minimum type="button">${micro?'Revenir à la version courte':'Passer à la version minimum'}</button>`;
  if(step===3)body=`<p class="eyebrow">OBSERVER, SANS VERDICT</p><h2>Ce que je garde.</h2><p>${esc(s.reflect)}</p><div class="guide-fields"><label for="guide-outcome">Où j’en suis <span class="optional">facultatif</span></label><select id="guide-outcome" data-guide-field="outcome">${[['','Je préfère ne pas répondre'],['not','Je n’ai pas encore essayé'],['partial','J’ai essayé en partie ou adapté'],['tried','J’ai essayé'],['rest','J’ai choisi de me reposer ou de demander de l’aide']].map(([v,t])=>`<option value="${v}" ${r.answers.outcome===v?'selected':''}>${t}</option>`).join('')}</select>${input('reflection','Mon observation ou mon prochain ajustement','Une chose à retenir, même neutre ou difficile…',true)}</div><div class="lesson-example"><strong>Pas de changement immédiat ?</strong><p>Cela arrive. La faisabilité, le coût, le lien avec ce qui compte et les effets plus tard sont aussi des informations utiles.</p></div>`;
  pane.innerHTML=`<button class="text-button" type="button" data-guide-back>← Tous les chapitres</button><div class="session-top"><span class="eyebrow">${esc(m.title)}</span><span>${step+1} / 4</span></div><div class="step-dots" role="group" aria-label="Étape ${step+1} sur 4">${labels.map((t,i)=>`<span class="${i<=step?'visited':''}" ${i===step?'aria-current="step"':''}><b>${i+1}</b>${esc(t)}</span>`).join('')}</div><article class="card lesson-card" id="lesson-focus" tabindex="-1">${body}</article><div class="session-controls"><button class="btn btn-ghost" data-guide-prev ${step===0?'disabled':''} type="button">Précédent</button><button class="btn btn-primary" data-guide-next type="button">${step===3?'Garder cette séance':'Continuer'} <span aria-hidden="true">→</span></button></div><p class="draft-state" id="draft-state" role="status">Brouillon conservé sur cet appareil si le stockage est disponible.</p><details class="source-detail"><summary>Pourquoi cet exercice ?</summary><p>${sourceLinks(m.source)}</p><p>Adaptation pédagogique originale. Les preuves concernent des interventions complètes, souvent avec un accompagnement humain.</p></details><button class="text-button" data-guide-help type="button">C’est trop difficile aujourd’hui · ouvrir Aide</button>`;
  $('lesson-focus').focus({preventScroll:true});pane.scrollIntoView({block:'start',behavior:'instant'});
 }
 function summary(s){
  const g=s.guided;if(!g)return '';
  const done=sessions.filter(x=>g.sessions[x.id]?.done).length;
  const notes=sessions.filter(x=>g.sessions[x.id]?.answers?.reflection?.trim()).sort((a,b)=>(g.sessions[a.id].updated||'').localeCompare(g.sessions[b.id].updated||'')).slice(-5).map(x=>`• ${x.title} : ${g.sessions[x.id].answers.reflection}`);
  return `\nProgramme d’autoaccompagnement : ${done}/24 séances explorées (cela ne mesure pas une amélioration clinique).${notes.length?'\nObservations récentes du carnet :\n'+notes.join('\n'):''}`;
 }
 function sourcesView(){
  active=null;$('guide-session').hidden=true;$('guide-overview').hidden=false;
  $('guide-overview').innerHTML=`<button class="text-button" data-guide-back type="button">← Revenir au programme</button><div class="intro"><p class="eyebrow">TRANSPARENCE SCIENTIFIQUE</p><h2>Ce que l’on sait. Ce que l’on ne sait pas.</h2><p>Sélection ciblée de recommandations, revues et études, consultées le 4 novembre 2026. Ce n’est pas une revue systématique exhaustive.</p></div><div class="info-strip"><strong>Aucune preuve directe pour Mieux vivre.</strong> Cette version n’a pas fait l’objet d’un essai clinique ni d’une validation par un professionnel. Son efficacité, son innocuité et sa dose optimale ne sont pas établies. Son parcours de 24 séances est un choix pédagogique.</div>${sources.map(s=>`<article class="card source-card"><span class="eyebrow">${esc(s.type)}</span><h3><a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a></h3><p>${esc(s.evidence)}</p><p class="evidence-limit"><strong>Limite :</strong> ${esc(s.limit)}</p></article>`).join('')}<article class="card source-card"><h3>Lire correctement les preuves</h3><p>Une recommandation clinique n’est pas un niveau de certitude GRADE. Les niveaux sont rapportés lorsqu’ils sont explicités par la source. Nous n’attribuons pas une note de preuve à chaque exercice original.</p><p>Une absence de différence statistique entre deux traitements ne démontre pas à elle seule leur équivalence. Les résultats de groupe ne prédisent pas la réponse d’une personne.</p><p>Les modifications pour fatigue, douleur ou accessibilité améliorent la faisabilité espérée, sans preuve spécifique pour cette application.</p></article>`;
 }
 document.addEventListener('change',e=>{if(e.target.id==='guide-size'&&state){current().size=e.target.value;save();toast('La taille des séances est ajustée.');}});
 document.addEventListener('input',e=>{
  if(!active||!e.target.dataset.guideField)return;
  const f=e.target.dataset.guideField;if(!fields.includes(f))return;
  const r=record(active);r.answers[f]=e.target.value.slice(0,800);r.updated=new Date().toISOString();
  $('draft-state').textContent=save()?'Brouillon enregistré sur cet appareil.':'Sauvegarde impossible : garde une copie avant de quitter.';
 });
 document.addEventListener('click',e=>{
  if(!state)return;
  const openBtn=e.target.closest('[data-guide-open]');if(openBtn){go('program');open(openBtn.dataset.guideOpen);return;}
  if(e.target.closest('[data-guide-back]')){
   const id=active;
   overview();
   const action=id ? $('guide-overview').querySelector('.session-links [data-guide-open="'+id+'"]') : $('guide-overview').querySelector('[data-guide-open]');
   if(action){const chapter=action.closest('.course-module');if(chapter)chapter.open=true;action.focus();}
   return;
  }
  if(e.target.closest('[data-guide-sources]')){go('program');sourcesView();return;}
  if(e.target.closest('[data-guide-help]')){go('difficult');return;}
  if(!active)return;
  const r=record(active);
  if(e.target.closest('[data-guide-minimum]')){current().size=current().size==='micro'?'short':'micro';save();draw();return;}
  if(e.target.closest('[data-guide-prev]')){r.step=Math.max(0,r.step-1);save();draw();return;}
  if(e.target.closest('[data-guide-next]')){
   if(r.step<3){r.step++;save();draw();}
   else {r.done=true;r.updated=new Date().toISOString();if(save()){overview();$('guide-overview').querySelector('[data-guide-open]').focus();toast('Séance conservée. Tu peux la revisiter quand tu veux.');}}
  }
 });
 return {fresh,normalize,summary,render(s,p,n,t){state=s;save=p;go=n;toast=t;overview();},next:()=>next(),sourceLinks};
})();

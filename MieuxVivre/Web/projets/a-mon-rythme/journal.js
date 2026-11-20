"use strict";
(() => {
const carnet = window.Carnet;
const root = document.getElementById(carnet ? "sport-carnet" : "main");
const $ = id => root.querySelector("#" + (id === "pain" ? "movement-pain" : id));
const form = $("entry");
const activityList = $("session-activities");
const ratingIds = ["pain","fatigue"];
const key = "a-mon-rythme-v1";
const activities = {bike:"Pédalier",walk:"Marche",climb:"Bloc",stretch:"Étirements",strength:"Renforcement"};
const numeric = [...Object.keys(activities),"pain","fatigue"];
const fields = [...numeric,"reaction","weight","note"];
const library = $("movementCards");
const movementInputs = [...(library?.querySelectorAll('input[name="movement"]') ?? [])];
const movementGroups = [...(library?.querySelectorAll(".movement-group") ?? [])];
const movementNames = new Map(Object.entries({
  neck:"Inclinaison douce du cou", hamstring:"Étirement de l’arrière de la cuisse", heels:"Lever les talons",
  knee:"Tendre le genou", "seated-core":"Abdos assis en soufflant", "ankle-toes":"Lever les pointes de pieds",
  "shoulder-blades":"Rapprocher les omoplates", "glute-squeeze":"Contracter les fessiers", "wall-push":"Pompe au mur",
  "chair-stand":"Se lever de la chaise", "supported-squat":"Mini-squat avec appui", "standing-heels":"Lever les talons debout",
  "hip-side":"Écarter la jambe avec appui", "wall-plank":"Gainage debout au mur", "pelvic-tilt":"Petite bascule du bassin",
  "heel-slide":"Glisser un talon", "mini-bridge":"Petit pont fessier", "bird-dog-prep":"Glisser une main à quatre pattes",
  "side-wall-plank":"Gainage latéral au mur", "mini-crunch":"Mini-crunch au sol", "incline-push":"Pompes inclinées",
  "knee-push":"Pompes sur les genoux", "full-push":"Pompes classiques", "pilates-ribs":"Respiration des côtes assis",
  "pilates-knee-open":"Ouvrir un genou", "pilates-march":"Décoller un pied", "qigong-float":"Lever et redescendre les mains",
  "qigong-open":"Ouvrir et refermer les mains", "qigong-push":"Pousser les paumes en douceur",
  "taichi-cloud-one":"Main comme un nuage", "taichi-cloud-two":"Mains comme des nuages", "taichi-separate":"Séparer les mains en diagonale",
  "yoga-chair-cat":"Chat-vache assis", "yoga-chair-side":"Inclinaison latérale assise"
}));
const states = {"":"Non renseigné",stable:"État habituel",fragile:"Journée difficile",pause:"Repos / symptômes"};
const reactions = {"":"",same:"Récupération habituelle ou meilleure",slight:"Gêne légère puis retour à l’état habituel",worse:"Douleur ou fatigue plus forte après la veille",none:"Repos la veille"};
const nativeAssessments = {
  impact: {"":"",none:"Gestes habituels",some:"Gestes gênés",strong:"Gestes très gênés"},
  painTrend: {"":"",same:"Douleur habituelle",worse:"Douleur plus forte",new:"Douleur inhabituelle"},
  vigilance: {"":"",alert:"Éveillé",sleepy:"Somnolent",dozed:"Endormissement involontaire"},
  signals: {"":"",none:"Aucun signal inhabituel",leg:"Jambe instable",chest:"Poitrine, souffle ou vertige",pelvic:"Ventre ou bassin",urgent:"Signal d’urgence saisi"}
};
const stepActivities = {hands:"stretch",ankles:"stretch",heels:"strength",bike:"bike",outside:"walk",treadmill:"walk"};
const nativeFields = [...Object.keys(nativeAssessments),"bikeTarget","seatedTarget","walkTarget","walkMode","restTaken","stepTimes"];
const dateFormat = new Intl.DateTimeFormat("fr-FR",{dateStyle:"full"});
const shortDay = new Intl.DateTimeFormat("fr-FR",{weekday:"short"});
const numberFormat = new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2});
const empty = {version:1,cleared:false,entries:{}};
let data = empty;
let selected = "";
let original = "";
let storedDataUsable = true;
let displayedActivityKeys = new Set();
function dayKey(date = new Date()) {
  const pad = number => String(number).padStart(2,"0");
  return date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate());
}
function asDate(key) { return new Date(key+"T12:00:00"); }
function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "2000-01-01" &&
    value <= dayKey() && dayKey(asDate(value)) === value;
}
function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function stepTotals(times) {
  const totals = {};
  for (const [id, value] of Object.entries(times)) {
    const activity = stepActivities[id];
    totals[activity] = (totals[activity] ?? 0) + value;
  }
  return totals;
}
function validNativeFields(record) {
  if (Object.entries(nativeAssessments).some(([id, labels]) =>
    Object.hasOwn(record, id) && (typeof record[id] !== "string" || !Object.hasOwn(labels, record[id])))) return false;
  for (const [id, max] of Object.entries({bikeTarget:12,seatedTarget:9,walkTarget:20})) {
    if (Object.hasOwn(record, id) && (!Number.isInteger(record[id]) || record[id] < 1 || record[id] > max)) return false;
  }
  if (Object.hasOwn(record,"seatedTarget") && !(record.stretch > 0 || record.strength > 0)) return false;
  if ((Object.hasOwn(record,"walkMode") || Object.hasOwn(record,"walkTarget")) &&
      (!["outside","treadmill"].includes(record.walkMode) || !Object.hasOwn(record,"walkTarget") || !(record.walk > 0))) return false;
  if (Object.hasOwn(record,"restTaken") && typeof record.restTaken !== "boolean") return false;
  if (!Object.hasOwn(record,"stepTimes")) return true;
  const times = record.stepTimes;
  return plain(times) && Object.entries(times).every(([id, value]) =>
    Object.hasOwn(stepActivities, id) && Number.isInteger(value) && value > 0
  ) && Object.entries(stepTotals(times)).every(([id, total]) => total <= (record[id] ?? 0));
}
function validData(value) {
  if (!plain(value) || value.version !== 1 || typeof value.cleared !== "boolean" || !plain(value.entries)) return false;
  if (Object.hasOwn(value,"walkMode") && !["auto","seated","outside","treadmill"].includes(value.walkMode)) return false;
  if (Object.hasOwn(value,"activityNames") && (!Array.isArray(value.activityNames) ||
      !value.activityNames.every(validActivityName))) return false;
  return Object.entries(value.entries).every(([day, record]) => {
    if (!validDay(day) || !plain(record) || typeof record.state !== "string" || !Object.hasOwn(states,record.state) ||
        typeof record.reaction !== "string" || !Object.hasOwn(reactions,record.reaction) ||
        typeof record.note !== "string" || record.note.length > 300) return false;
    if (record.weight !== null && (!Number.isFinite(record.weight) || record.weight < 20 || record.weight > 500)) return false;
    if (Object.hasOwn(record,"moves") && (!Array.isArray(record.moves) ||
        new Set(record.moves).size !== record.moves.length || !record.moves.every(id => movementNames.has(id)))) return false;
    if (Object.hasOwn(record,"activities") && (!Array.isArray(record.activities) || !record.activities.every(item =>
      plain(item) && validActivityName(item.name) &&
      (item.minutes === null || (Number.isInteger(item.minutes) && item.minutes >= 0 && item.minutes <= 1440))
    ))) return false;
    return validNativeFields(record) && numeric.every(id => record[id] === null ||
      (!Object.hasOwn(record,id) && (id === "stretch" || id === "strength")) ||
      (Number.isInteger(record[id]) && record[id] >= 0 && record[id] <= (id in activities ? 300 : 10)));
  });
}
function validActivityName(name) {
  return typeof name === "string" && name.length <= 80 && name.trim().length > 0;
}
function readStored() {
  const raw = localStorage.getItem(key);
  const parsed = raw === null ? empty : JSON.parse(raw);
  if (!validData(parsed)) throw new Error("Invalid data");
  return parsed;
}
function say(message, error = false, target = $("status")) {
  target.textContent = message;
  target.dataset.error = String(error);
}
function commit(change, target = $("status")) {
  if (!storedDataUsable) {
    say("Les données existantes sont illisibles. Essaie d’ouvrir le carnet dans un autre navigateur avec une sauvegarde.",true,target);
    return false;
  }
  try {
    const current = readStored();
    const next = change(current);
    if (!next) {
      say("Cette fiche a changé dans une autre fenêtre. Rouvre la journée avant de réessayer.",true,target);
      return false;
    }
    localStorage.setItem(key,JSON.stringify(next));
    data = next;
  } catch {
    say("Impossible d’écrire dans ce navigateur. Ouvre le fichier dans un navigateur standard, hors navigation privée.",true,target);
    return false;
  }
  carnet?.refresh();
  return true;
}
function currentState() { return form.elements.state.value; }
function sessionActivities(record) {
  return record?.activities ?? Object.entries(activities)
    .filter(([id]) => record?.[id] != null)
    .map(([id,name]) => ({name, minutes:record[id]}));
}
const activityKey = name => name.trim().normalize("NFC").toLocaleLowerCase("fr");
function retainedActivityNames(store, added = []) {
  const names = new Map();
  const remember = name => {
    const key = activityKey(name);
    if (!names.has(key)) names.set(key, name.trim());
  };
  added.forEach(remember);
  (store.activityNames ?? []).forEach(remember);
  for (const day of Object.keys(store.entries).sort().reverse()) {
    sessionActivities(store.entries[day]).forEach(({name}) => remember(name));
  }
  return [...names.values()];
}
function pendingActivityNames() {
  return Array.from(activityList.querySelectorAll('[name="activityName"]'), input => input.value.trim())
    .filter(name => name && !displayedActivityKeys.has(activityKey(name)));
}
function readActivities() {
  return Array.from(activityList.querySelectorAll('[name="activityDone"]:checked'), checkbox => {
    const row = checkbox.closest(".session-activity");
    const name = row.querySelector('[name="activityName"]').value.trim();
    const duration = row.querySelector('[name="activityMinutes"]');
    return {name, minutes:duration.value === "" ? null : duration.valueAsNumber};
  }).filter(item => item.name);
}
function labelActivityRows() {
  Array.from(activityList.children).forEach((row, index) => {
    row.setAttribute("aria-label", "Activité " + (index + 1));
    row.querySelector("[data-remove-activity]").setAttribute("aria-label", "Retirer l’activité " + (index + 1));
  });
}
function updateActivityRow(row) {
  const done = row.querySelector('[name="activityDone"]');
  const name = row.querySelector('[name="activityName"]');
  const duration = row.querySelector('[name="activityMinutes"]');
  const title = name.value.trim();
  done.setAttribute("aria-label", title ? title + " faite" : "Activité faite");
  duration.disabled = !done.checked;
  duration.closest("label").hidden = !done.checked;
  name.setCustomValidity(done.checked && !title ? "Indique le nom de l’activité." : "");
}
function showOtherActivities(expanded) {
  const button = $("show-activities");
  const rows = activityList.querySelectorAll("[data-extra-activity]");
  rows.forEach(row => { row.hidden = !expanded && !row.querySelector('[name="activityDone"]').checked; });
  button.hidden = !rows.length;
  button.setAttribute("aria-expanded", String(expanded && rows.length > 0));
  button.textContent = expanded ? "Masquer les autres activités" : "Voir les autres activités (" + rows.length + ")";
}
function addActivity({name = "", minutes = null, done = false, extra = false} = {}) {
  const row = $("activity-row").content.firstElementChild.cloneNode(true);
  const nameInput = row.querySelector('[name="activityName"]');
  nameInput.value = name;
  row.querySelector('[name="activityMinutes"]').value = minutes ?? "";
  row.querySelector('[name="activityDone"]').checked = done;
  if (extra) row.dataset.extraActivity = "";
  updateActivityRow(row);
  activityList.append(row);
  return nameInput;
}
function setRating(id, value) {
  const input = $(id);
  const label = value == null ? "Non renseignée" : value + " / 10";
  if (input.valueAsNumber !== (value ?? 5)) input.value = value ?? 5;
  input.dataset.recorded = String(value != null);
  input.setAttribute("aria-valuetext", label);
  $(input.id + "-value").textContent = label;
  form.querySelector('[data-clear-rating="' + input.id + '"]').hidden = value == null;
}
function filterMovements() {
  const family = $("movementFilter").value;
  let total = 0;
  for (const group of movementGroups) {
    let visible = 0;
    for (const card of group.querySelectorAll(".exercise")) {
      card.hidden = !!family && !card.dataset.family.split(" ").includes(family);
      if (!card.hidden) visible++;
    }
    total += visible;
    group.hidden = visible === 0;
    group.open = !!family || group.id === "movementSeated" || group.querySelector("input:checked") !== null;
  }
  $("movementCount").textContent = total === 1 ? "1 fiche affichée." : total+" fiches affichées.";
}
function suggest() {
  const state = currentState();
  const fragile = state === "fragile" || $("reaction").value === "worse";
  const movementAdvice = $("movementAdvice");
  movementAdvice.dataset.tone = state === "pause" ? "stop" : "";
  if (state === "pause") {
    movementAdvice.textContent = "Repos aujourd’hui. En cas de somnolence marquée ou de jambes instables, mets aussi ces mouvements assis en pause.";
  } else if (fragile) {
    movementAdvice.textContent = "Journée allégée. Si un mouvement assis déjà validé reste confortable et que tu es bien éveillé et stable, réduis l’amplitude ou la durée. Le repos est aussi une option.";
  } else if (!state) {
    movementAdvice.textContent = "Commence par choisir ton état du jour. Tu peux aussi consulter les fiches pour en parler avec ton soignant.";
  } else {
    movementAdvice.textContent = "Après validation, essaie un seul mouvement assis dans un créneau habituel. Tu peux commencer par 2 ou 3 répétitions lentes, ou environ 5 secondes pour un étirement. Vérifie comment tu récupères le lendemain.";
  }
  let title = "Choisis ton état du jour";
  let message = "Si tu veux juste garder une trace, tu peux enregistrer ta journée directement.";
  let tone = "";
  if (state === "pause") {
    title = "Repos aujourd’hui";
    message = "Si tu somnoles ou si tes jambes sont instables, mets la séance en pause, exercices assis compris. Tu peux noter la journée et reprendre seulement quand les conditions sont sûres.";
    tone = "stop";
  } else if (state && !$("cleared").checked) {
    title = "Repère à valider";
    message = "Attends l’avis de ton soignant pour définir une séance au pédalier. Tu peux déjà utiliser ce carnet pour noter ton état.";
  } else if (state && fragile) {
    title = "Journée allégée";
    message = "Le repos est une option. Si tu es bien éveillé, stable et que les symptômes sont habituels, reste en dessous de ta dernière durée bien tolérée.";
  } else if (state === "stable") {
    title = "Pédalier facile · 5 à 8 min au départ";
    message = "Si tu es bien éveillé et que tes jambes sont stables, prends une résistance basse. Reste à une allure où tu parles facilement et respecte la durée validée avec ton soignant.";
  }
  $("advice").dataset.tone = tone;
  $("adviceTitle").textContent = title;
  $("adviceText").textContent = message;
}
function setDay(day) {
  selected = day;
  const record = data.entries[day] || {};
  original = JSON.stringify(data.entries[day] ?? null);
  for (const option of form.elements.state) option.checked = option.value === record.state;
  if (activityList) {
    for (const id of ratingIds) setRating(id, record[id]);
    for (const id of ["reaction","weight","note"]) $(id).value = record[id] ?? "";
    activityList.replaceChildren();
    const rows = sessionActivities(record);
    displayedActivityKeys = new Set(rows.map(({name}) => activityKey(name)));
    rows.forEach(row => addActivity({...row, done:true}));
    const choices = retainedActivityNames(data).filter(name => !displayedActivityKeys.has(activityKey(name)));
    choices.forEach((name, index) => {
      addActivity({name, extra:index >= 4});
      displayedActivityKeys.add(activityKey(name));
    });
    if (!activityList.children.length) addActivity();
    showOtherActivities(false);
    labelActivityRows();
    const names = (record.moves ?? []).map(id => movementNames.get(id));
    $("session-movements").hidden = !names.length;
    $("session-movements").textContent = names.length ? "Exercices notés auparavant · " + names.join(" · ") : "";
  } else {
    for (const id of fields) $(id).value = record[id] ?? "";
    $("day").max = dayKey();
    $("day").value = day;
    $("cleared").checked = data.cleared;
    const nativeNote = $("movement-native-note");
    const observations = Object.entries(nativeAssessments).map(([id, labels]) => labels[record[id]]).filter(Boolean);
    nativeNote.hidden = !nativeFields.some(id => Object.hasOwn(record,id));
    nativeNote.textContent = observations.length
      ? "Fiche iPhone · " + observations.join(" · ")
      : "Les repères de la fiche iPhone sont conservés dans le JSON.";
    suggest();
  }
  for (const input of movementInputs) {
    input.checked = (record.moves ?? []).includes(input.value);
    if (input.checked) {
      input.closest(".movement-group").open = true;
      input.closest("details").open = true;
    }
  }
  if (library && record.moves?.length) library.open = true;
  if (record.weight != null) $("weight").value = numberFormat.format(record.weight);
  $("extra").open = (activityList ? ["weight","note"] : ["pain","fatigue","weight","note"])
    .some(id => record[id] != null && record[id] !== "");
  $("remove").hidden = !data.entries[day];
  $("entry-state").textContent = data.entries[day] ? "Journée enregistrée · tu peux la modifier" : "Aucune saisie enregistrée pour ce jour";
  if (!activityList) render();
}
function minutes(record) {
  return sessionActivities(record).reduce((sum,item) => sum + (item.minutes ?? 0),0);
}
function render() {
  const days = Array.from({length:7},(_,index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const key = dayKey(date);
    return {date,key,total:minutes(data.entries[key])};
  });
  $("total").textContent = days.reduce((sum,day) => sum + day.total,0);
  $("logged").textContent = days.filter(day => data.entries[day.key]).length;
  const entries = Object.entries(data.entries).sort(([a],[b]) => b.localeCompare(a));
  const latest = entries.find(([,record]) => record.weight !== null);
  $("lastWeight").textContent = latest ? numberFormat.format(latest[1].weight)+" kg" : "—";
  const max = Math.max(1,...days.map(day => day.total));
  const week = $("weekDays");
  week.replaceChildren();
  for (const day of days) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.day = day.key;
    button.setAttribute("aria-label",dateFormat.format(day.date)+", "+(data.entries[day.key] ? day.total+" minutes" : "jour non renseigné"));
    if (day.key === selected) button.setAttribute("aria-current","date");
    const track = document.createElement("span");
    track.className = "track";
    track.setAttribute("aria-hidden","true");
    const bar = document.createElement("span");
    bar.className = "bar";
    bar.style.height = (day.total/max*100)+"%";
    track.append(bar);
    const label = document.createElement("span");
    label.textContent = shortDay.format(day.date).replace(".","");
    const total = document.createElement("span");
    total.className = "day-total";
    total.textContent = data.entries[day.key] ? String(day.total) : "·";
    button.append(track,label,total);
    week.append(button);
  }
  const history = $("history");
  history.replaceChildren();
  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = "Ton historique apparaîtra ici.";
    history.append(item);
  }
  for (const [day, record] of entries) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const details = document.createElement("small");
    button.type = "button";
    button.dataset.day = day;
    button.textContent = dateFormat.format(asDate(day));
    const names = sessionActivities(record).map(item => item.name + (item.minutes == null ? "" : " "+item.minutes+" min"));
    for (const id of record.moves ?? []) names.push(movementNames.get(id));
    if (record.restTaken) names.push("Repos pris");
    else if (record.state) names.push(states[record.state]);
    if (record.reaction) names.push(reactions[record.reaction]);
    if (record.pain !== null) names.push("Douleur "+record.pain+"/10");
    if (record.fatigue !== null) names.push("Fatigue "+record.fatigue+"/10");
    if (record.weight !== null) names.push(numberFormat.format(record.weight)+" kg");
    details.textContent = names.join(" · ") || "Journée notée";
    button.append(details);
    item.append(button);
    history.append(item);
  }
}
function readForm() {
  const record = {state:currentState(),reaction:$("reaction").value,note:$("note").value.trim()};
  const weight = $("weight").value.trim();
  record.weight = weight === "" ? null : Number(weight.replace(",","."));
  if (activityList) {
    const saved = JSON.parse(original);
    if (!saved) for (const id of Object.keys(activities)) record[id] = null;
    for (const id of ratingIds) record[id] = $(id).dataset.recorded === "true" ? $(id).valueAsNumber : null;
    const list = readActivities();
    const previous = sessionActivities(saved).map(({name,minutes}) => ({name:name.trim(),minutes}));
    if (JSON.stringify(list) !== JSON.stringify(previous)) record.activities = list;
    return {...saved, ...record};
  }
  for (const id of numeric) record[id] = $(id).value === "" ? null : $(id).valueAsNumber;
  const moves = movementInputs.filter(input => input.checked).map(input => input.value);
  if (moves.length) record.moves = moves;
  return record;
}
function preserveNativeFields(record, saved) {
  if (!saved) return true;
  if (saved.activities) record.activities = saved.activities;
  if (saved.moves && record.moves) {
    record.moves = [
      ...saved.moves.filter(id => record.moves.includes(id)),
      ...record.moves.filter(id => !saved.moves.includes(id))
    ];
  }
  for (const id of nativeFields) if (Object.hasOwn(saved,id)) record[id] = saved[id];
  if (record.seatedTarget && !(record.stretch > 0 || record.strength > 0)) delete record.seatedTarget;
  if (record.walkTarget && !(record.walk > 0)) {
    delete record.walkMode;
    delete record.walkTarget;
  }
  if (record.stepTimes) {
    const totals = stepTotals(record.stepTimes);
    record.stepTimes = Object.fromEntries(Object.entries(record.stepTimes).filter(([id]) => {
      const activity = stepActivities[id];
      return totals[activity] <= (record[activity] ?? 0);
    }));
  }
  const changed = nativeFields.some(id => JSON.stringify(record[id]) !== JSON.stringify(saved[id]));
  return !changed || window.confirm("Ces durées ne correspondent plus au détail importé de l’iPhone. Enregistrer en retirant les repères et étapes incompatibles ?");
}
function hasUnsavedEntry() {
  const record = readForm();
  const saved = JSON.parse(original);
  if ([...form.querySelectorAll("input")].some(input => input.validity.badInput || input.validity.customError)) return true;
  if (activityList && pendingActivityNames().length) return true;
  return saved
    ? ["state",...fields].some(id => (id === "note" ? saved.note.trim() : (saved[id] ?? null)) !== (record[id] ?? null)) ||
      JSON.stringify(record.activities ?? null) !== JSON.stringify(saved.activities ?? null) ||
      movementInputs.some(input => input.checked !== (saved.moves ?? []).includes(input.value))
    : Object.values(record).some(value => value !== "" && value !== null);
}
function canLeaveEntry() {
  return !hasUnsavedEntry() || window.confirm("Quitter la fiche d’activité sans enregistrer la saisie ?");
}
function reloadDay(day) {
  try { data = readStored(); } catch { /* Keep the currently displayed copy. */ }
  setDay(day);
  say("");
}
function go(day) {
  if (!validDay(day)) { $("day").value = selected; return; }
  if (carnet) {
    if (day === selected) {
      if (!canLeaveEntry()) return;
      reloadDay(day);
    } else if (!carnet.selectDate(day)) return;
    $("dayTitle").focus();
    return;
  }
  if (!canLeaveEntry()) { $("day").value = selected; return; }
  reloadDay(day);
  $("day").focus();
}
if (activityList) {
  $("add-activity").addEventListener("click", () => {
    const input = addActivity();
    labelActivityRows();
    input.focus();
  });
  $("show-activities").addEventListener("click", event => {
    showOtherActivities(event.currentTarget.getAttribute("aria-expanded") !== "true");
  });
  activityList.addEventListener("input", event => {
    updateActivityRow(event.target.closest(".session-activity"));
  });
  activityList.addEventListener("click", event => {
    const remove = event.target.closest("[data-remove-activity]");
    if (!remove) return;
    const row = remove.closest(".session-activity");
    const next = row.nextElementSibling ?? row.previousElementSibling;
    const changed = row.querySelector('[name="activityDone"]').checked ||
      !displayedActivityKeys.has(activityKey(row.querySelector('[name="activityName"]').value));
    row.remove();
    showOtherActivities($("show-activities").getAttribute("aria-expanded") === "true");
    labelActivityRows();
    (next && !next.hidden ? next.querySelector('[name="activityName"]') : $("add-activity")).focus();
    if (changed) $("entry-state").textContent = "Saisie en cours · enregistre pour la garder";
  });
  for (const id of ratingIds) {
    const input = $(id);
    input.addEventListener("input", () => setRating(id, input.valueAsNumber));
    input.addEventListener("click", () => {
      if (input.dataset.recorded === "false") input.dispatchEvent(new Event("input", {bubbles:true}));
    });
    form.querySelector('[data-clear-rating="' + input.id + '"]').addEventListener("click", () => {
      input.focus();
      setRating(id, null);
      $("entry-state").textContent = "Saisie en cours · enregistre pour la garder";
    });
  }
} else {
  $("day").addEventListener("change",event => go(event.target.value));
  $("today").addEventListener("click",() => go(dayKey()));
  $("movementFilter").addEventListener("change",filterMovements);
  $("openMovements").addEventListener("click",() => { library.open = true; });
  for (const list of [$("history"),$("weekDays")]) list.addEventListener("click",event => {
    const button = event.target.closest("button[data-day]");
    if (button) go(button.dataset.day);
  });
  form.addEventListener("change",suggest);
  $("cleared").addEventListener("change",() => {
    const desired = $("cleared").checked;
    if (!commit(current => ({...current,cleared:desired}))) $("cleared").checked = data.cleared;
    else say(desired ? "Validation du pédalier enregistrée." : "Validation du pédalier retirée.");
    suggest();
  });
}
for (const link of root.querySelectorAll('#openBackup,[data-open-backup]')) {
  link.addEventListener("click",() => { $("backup-options").open = true; });
}
form.addEventListener("input",event => {
  if (event.target.id !== "cleared" && event.target.id !== "movementFilter") {
    $("entry-state").textContent = "Saisie en cours · enregistre pour la garder";
  }
});
form.addEventListener("invalid",event => {
  if ($("extra").contains(event.target)) $("extra").open = true;
},true);
form.addEventListener("submit",event => {
  event.preventDefault();
  const record = readForm();
  if (record.weight !== null && (!Number.isFinite(record.weight) || record.weight < 20 || record.weight > 500)) {
    $("extra").open = true;
    say("Indique un poids entre 20 et 500 kg, ou laisse ce champ vide.",true);
    $("weight").focus();
    return;
  }
  if (!activityList && !preserveNativeFields(record, JSON.parse(original))) return;
  const hasEntry = Object.values(record).some(value => value !== "" && value !== null);
  const newNames = activityList ? pendingActivityNames() : [];
  if (!hasEntry && !newNames.length) {
    say("Renseigne ton état, une activité ou une note pour enregistrer la journée.",true);
    return;
  }
  if (!commit(current => {
    if (JSON.stringify(current.entries[selected] ?? null) !== original) return null;
    const names = activityList ? retainedActivityNames(current, newNames) : [];
    const entries = hasEntry ? {...current.entries,[selected]:record} : current.entries;
    return {...current, entries, ...(names.length && {activityNames:names})};
  })) return;
  setDay(selected);
  say(hasEntry ? "Journée enregistrée." : "Activités à cocher enregistrées.");
});
$("remove").addEventListener("click",() => {
  if (!window.confirm("Supprimer les informations de cette journée ?")) return;
  if (!commit(current => {
    if (JSON.stringify(current.entries[selected] ?? null) !== original) return null;
    const entries = {...current.entries};
    delete entries[selected];
    const names = activityList ? retainedActivityNames(current) : [];
    return {...current, entries, ...(names.length && {activityNames:names})};
  })) return;
  setDay(selected);
  $(carnet ? "dayTitle" : "day").focus();
  say("Journée supprimée.");
});
$("export").addEventListener("click",() => {
  const target = $("backupStatus");
  if (!storedDataUsable) { say("Les données existantes sont illisibles.",true,target); return; }
  try {
    const content = JSON.stringify(readStored(),null,2);
    const name = "Carnet_A_Mon_Rythme_"+dayKey()+".json";
    const native = window.webkit?.messageHandlers?.native;
    if (native) {
      native.postMessage({action:"export", name, content});
      return;
    }
    const url = URL.createObjectURL(new Blob([content],{type:"application/json"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url),3000);
    say("Sauvegarde générée.",false,target);
  } catch { say("Impossible de lire les données du navigateur.",true,target); }
});
$("import").addEventListener("click",() => $("backup").click());
$("backup").addEventListener("change",async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const target = $("backupStatus");
  try {
    if (file.size > 5000000) throw new Error("Large file");
    const imported = JSON.parse(await file.text());
    if (!validData(imported)) throw new Error("Invalid backup");
    let added = 0;
    if (!commit(current => {
      const entries = {...current.entries};
      for (const [day,record] of Object.entries(imported.entries)) {
        if (Object.hasOwn(entries,day)) continue;
        entries[day] = record;
        added++;
      }
      const names = retainedActivityNames(current, imported.activityNames);
      return {...current, entries, ...(names.length && {activityNames:names})};
    },target)) return;
    if (!hasUnsavedEntry()) setDay(selected);
    else if (!activityList) {
      $("cleared").checked = data.cleared;
      render();
      suggest();
    }
    say(added+" journée(s) importée(s). Les fiches déjà présentes ont été conservées.",false,target);
  } catch { say("Sauvegarde invalide. Choisis un fichier JSON exporté par ce carnet.",true,target); }
});
try {
  data = readStored();
  localStorage.setItem(key,JSON.stringify(data));
} catch {
  try { readStored(); } catch { storedDataUsable = false; }
  say("Le stockage local est indisponible ou illisible. Vérifie ce message avant de saisir tes données.",true);
}
setDay(carnet?.date ?? dayKey());
if (carnet) {
  if (!activityList) root.querySelector(".datepicker").hidden = true;
  carnet.movement = day => {
    if (!Object.hasOwn(data.entries, day)) return null;
    const record = data.entries[day];
    const snapshot = Object.fromEntries(["state", "restTaken", ...fields].map(field => [field, record[field]]));
    return Object.freeze({...snapshot, moves:Object.freeze([...(record.moves ?? [])]),
      ...(record.activities && {activities:Object.freeze(record.activities.map(item => Object.freeze({...item})))})});
  };
  document.addEventListener("carnet:before-date", event => {
    if (!event.defaultPrevented && event.detail !== selected && !canLeaveEntry()) event.preventDefault();
  });
  document.addEventListener("carnet:date", event => reloadDay(event.detail));
  window.addEventListener("storage", event => {
    if (event.storageArea !== localStorage || (event.key !== key && event.key !== null)) return;
    try {
      data = readStored();
      if (!hasUnsavedEntry()) setDay(selected);
      else if (!activityList) render();
      carnet.refresh();
    } catch { /* Keep the existing view when the stored records cannot be read. */ }
  });
}
if (library && window.location.hash === "#movementCards") library.open = true;
if (window.location.hash === "#backup-options") $("backup-options").open = true;
})();

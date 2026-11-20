'use strict';

(() => {
  const dateField = document.getElementById('carnet-date');
  const week = document.getElementById('carnet-week');
  const longDate = new Intl.DateTimeFormat('fr-FR', {dateStyle: 'full'});
  const shortDate = new Intl.DateTimeFormat('fr-FR', {day: 'numeric', month: 'short'});
  const shortDay = new Intl.DateTimeFormat('fr-FR', {weekday: 'short'});
  const tracks = [
    {label: 'Humeur', kind: 'mental', summaryId: 'carnet-mood'},
    {label: 'Activité', kind: 'movement', summaryId: 'carnet-movement'},
  ];
  const exerciseFields = ['bike', 'walk', 'climb', 'stretch', 'strength'];
  const asDate = day => new Date(day + 'T12:00:00');
  const dayKey = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => String(value).padStart(index ? 2 : 4, '0')).join('-');
  const offset = (day, count) => {
    const date = asDate(day);
    date.setDate(date.getDate() + count);
    return dayKey(date);
  };
  const today = () => dayKey(new Date());
  let selected = today();
  let weekEnd = selected;
  dateField.max = selected;
  dateField.value = selected;

  function selectDate(day) {
    dateField.max = today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < dateField.min ||
        day > dateField.max || dayKey(asDate(day)) !== day) return false;
    if (day === selected) return true;
    if (!document.dispatchEvent(new CustomEvent('carnet:before-date', {detail: day, cancelable: true}))) return false;
    selected = day;
    dateField.value = day;
    if (day < offset(weekEnd, -6) || day > weekEnd || day === today()) weekEnd = day;
    document.dispatchEvent(new CustomEvent('carnet:date', {detail: day}));
    refresh();
    return true;
  }

  const recordedTimes = record => Array.isArray(record.activities)
    ? record.activities.map(activity => activity.minutes)
    : exerciseFields.map(key => record[key]);
  const movementMinutes = record => recordedTimes(record).reduce((total, minutes) => total + (minutes ?? 0), 0);
  const summary = day => {
    const mental = Carnet.mental?.(day);
    const sport = Carnet.movement?.(day);
    const rest = sport && (sport.state === 'pause' || sport.restTaken);
    const hasMovementTime = sport && recordedTimes(sport).some(Number.isFinite);
    const minutes = rest || hasMovementTime ? movementMinutes(sport) : null;
    const names = sport?.activities?.slice(0, 3).map(activity => activity.name).join(', ');
    const extraActivities = sport?.activities?.length > 3 ? ' +' + (sport.activities.length - 3) : '';
    const notes = [
      mental && mental.mood + ' · énergie ' + mental.energy.toLowerCase(),
      sport && [
        names ? names + extraActivities : '',
        rest && !minutes ? 'Repos' : minutes != null ? minutes + ' min' : names ? '' : 'Séance notée',
        sport.pain != null ? 'douleur ' + sport.pain + '/10' : '',
        sport.fatigue != null ? 'fatigue ' + sport.fatigue + '/10' : ''
      ].filter(Boolean).join(' · '),
    ];
    const values = [mental?.moodLevel, minutes];
    return tracks.map((track, index) => ({...track, note: notes[index], value: values[index]}));
  };

  function refresh() {
    document.dispatchEvent(new Event('carnet:change'));
    const current = summary(selected);
    document.getElementById('carnet-day-heading').textContent = longDate.format(asDate(selected));
    current.forEach(item => {
      document.getElementById(item.summaryId).textContent = item.note || 'Non renseigné';
    });
    const start = offset(weekEnd, -6);
    const days = Array.from({length: 7}, (_, index) => offset(start, index));
    const entries = days.map(summary);
    const maximum = tracks.map((_, index) => index === 0 ? 4 :
      Math.max(1, ...entries.map(notes => notes[index].value ?? 0)));
    const hasData = entries.some(notes => notes.some(item => item.note));
    document.getElementById('carnet-week-note').textContent = hasData
      ? 'Les hauteurs se comparent dans une même ligne. Un point creux indique une saisie sans valeur pour le graphique.'
      : 'Les relevés de la semaine apparaissent ici après enregistrement.';
    document.getElementById('carnet-week-period').textContent =
      shortDate.format(asDate(start)) + ' – ' + shortDate.format(asDate(weekEnd));
    const focused = document.activeElement?.dataset.carnetDay;
    week.replaceChildren(...days.map((day, dayIndex) => {
      const date = asDate(day);
      const notes = entries[dayIndex];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'carnet-day';
      button.dataset.carnetDay = day;
      if (day === selected) button.setAttribute('aria-current', 'date');
      button.setAttribute('aria-label', [longDate.format(date), ...notes.map(item =>
        item.label + ' : ' + (item.note || 'non renseigné'))].join('. '));
      const label = document.createElement('span');
      label.className = 'carnet-day-label';
      label.textContent = shortDay.format(date).replace(/\.$/, '');
      const dayNumber = document.createElement('b');
      dayNumber.textContent = date.getDate();
      label.append(dayNumber);
      button.append(label, ...notes.map((item, trackIndex) => {
        const mark = document.createElement('span');
        mark.className = 'carnet-mark';
        mark.dataset.kind = item.kind;
        mark.dataset.filled = Boolean(item.note);
        if (Number.isFinite(item.value)) {
          mark.dataset.value = item.value;
          mark.style.setProperty('--ratio', (item.value / maximum[trackIndex] * 100) + '%');
        }
        mark.setAttribute('aria-hidden', 'true');
        return mark;
      }));
      return button;
    }));
    if (focused) week.querySelector('[data-carnet-day="' + focused + '"]')?.focus({preventScroll: true});
  }

  window.Carnet = {get date() { return selected; }, selectDate, refresh, movementMinutes};
  dateField.addEventListener('change', () => {
    if (!selectDate(dateField.value)) dateField.value = selected;
  });
  document.getElementById('carnet-today').addEventListener('click', () => selectDate(today()));
  week.addEventListener('click', event => {
    const day = event.target.closest('[data-carnet-day]')?.dataset.carnetDay;
    if (day) selectDate(day);
  });
  if (window.self === window.top && 'serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
})();

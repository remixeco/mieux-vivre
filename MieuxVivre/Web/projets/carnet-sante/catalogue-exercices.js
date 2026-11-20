'use strict';

(() => {
  const section = document.getElementById('catalogue-exercices');
  const search = document.getElementById('catalogue-search');
  const results = document.getElementById('catalogue-results');
  const count = document.getElementById('catalogue-count');
  const more = document.getElementById('catalogue-more');
  const favoritesList = document.getElementById('catalogue-favorites-list');
  const favoritesEmpty = document.getElementById('catalogue-favorites-empty');
  const favoritesLink = document.querySelector('.catalogue-favorites-link');
  const favoritesKey = 'mieux-vivre:exercices-favoris:v1';
  const scriptURL = document.currentScript.src;
  const regions = {
    core: 'Abdos et gainage',
    full_body: 'Corps entier',
    upper_body: 'Haut du corps',
    lower_body: 'Bas du corps',
  };
  const normalise = value => value.normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const exercises = (window.CarnetExerciseCatalog || []).map(exercise => ({
    ...exercise,
    searchable: normalise([
      exercise.name, ...exercise.search, regions[exercise.region], ...exercise.muscles, ...exercise.setup,
    ].join(' ')),
  })).sort((first, second) => first.name.localeCompare(second.name, 'fr'));
  const pageSize = 16;
  const exerciseIds = new Set(exercises.map(exercise => exercise.id));
  const thumbnailObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const image = entry.target;
        image.src = image.dataset.src;
        delete image.dataset.src;
        thumbnailObserver.unobserve(image);
      }
    })
    : null;
  let favorites = readFavorites();
  let matches = [];
  let displayed = 0;

  function readFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      return new Set(Array.isArray(saved) ? saved.filter(id => exerciseIds.has(id)) : []);
    } catch {
      return new Set();
    }
  }

  function updateFavoriteButton(button) {
    const chosen = favorites.has(button.dataset.favoriteExercise);
    button.setAttribute('aria-pressed', chosen);
    button.title = chosen ? 'Retirer des favoris' : 'Ajouter aux favoris';
  }

  function addVisuals(details, content, exercise) {
    const visuals = window.CarnetExerciseVisuals?.[exercise.id];
    if (!visuals?.length) return;
    details.addEventListener('toggle', function loadVisuals() {
      if (!details.open) return;
      details.removeEventListener('toggle', loadVisuals);
      const gallery = document.createElement('div');
      gallery.className = 'catalogue-visuals';
      for (const visual of visuals) {
        const figure = document.createElement('figure');
        const image = document.createElement('img');
        image.src = new URL(visual.src, scriptURL).href;
        image.alt = visual.alt;
        image.loading = 'lazy';
        image.decoding = 'async';
        if (visual.width) image.width = visual.width;
        if (visual.height) image.height = visual.height;
        figure.append(image);
        if (visual.caption) {
          const caption = document.createElement('figcaption');
          caption.textContent = visual.caption;
          figure.append(caption);
        }
        gallery.append(figure);
      }
      content.prepend(gallery);
    });
  }

  function addFavoriteThumbnail(summary, exercise) {
    const visual = window.CarnetExerciseVisuals?.[exercise.id]?.[0];
    if (!visual) return;
    const image = document.createElement('img');
    image.className = 'catalogue-thumbnail';
    image.alt = '';
    image.width = visual.width || 152;
    image.height = visual.height || 112;
    image.decoding = 'async';
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.remove();
      summary.classList.remove('catalogue-has-thumbnail');
    }, { once: true });
    const source = new URL(visual.src, scriptURL).href;
    // Hidden views and favorites below the viewport do not request previews yet.
    if (thumbnailObserver) {
      image.dataset.src = source;
      thumbnailObserver.observe(image);
    } else image.src = source;
    summary.classList.add('catalogue-has-thumbnail');
    summary.prepend(image);
  }

  function exerciseItem(exercise, inFavorites = false) {
    const item = document.createElement('li');
    item.dataset[inFavorites ? 'favoriteId' : 'catalogueId'] = exercise.id;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const name = document.createElement('strong');
    const region = document.createElement('span');
    const content = document.createElement('div');
    content.className = 'catalogue-description';
    name.textContent = exercise.name;
    region.className = 'catalogue-region';
    region.textContent = regions[exercise.region];
    if (inFavorites) {
      summary.className = 'catalogue-favorite-summary';
      const copy = document.createElement('span');
      copy.className = 'catalogue-summary-copy';
      copy.append(name, region);
      summary.append(copy);
      addFavoriteThumbnail(summary, exercise);
    } else {
      summary.append(name, region);
    }

    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'catalogue-favorite-toggle';
    favoriteButton.dataset.favoriteExercise = exercise.id;
    favoriteButton.setAttribute('aria-label', 'Favori : ' + exercise.name);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('class', 'glyph');
    icon.setAttribute('aria-hidden', 'true');
    const star = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    star.setAttribute('d', 'm12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-3-5.6 3 1-6.2L2.9 9.6l6.3-.9Z');
    icon.append(star);
    favoriteButton.append(icon);
    updateFavoriteButton(favoriteButton);

    const description = document.createElement('p');
    description.className = 'catalogue-text';
    description.textContent = exercise.description;
    const equipment = document.createElement('p');
    equipment.className = 'footnote';
    equipment.textContent = exercise.setup.length ? 'Matériel ou appui : ' + exercise.setup.join(', ') : 'Sans matériel';
    const source = document.createElement('p');
    source.className = 'footnote';
    const attribution = [
      'Fiche wger ' + exercise.id, exercise.sourceAuthor, exercise.sourceLicense,
    ].filter(Boolean).join(' · ');
    const local = [exercise.translationAuthor, exercise.translationLicense].filter(Boolean).join(' · ');
    source.textContent = attribution + (local ? ' / Texte français : ' + local : '');
    content.append(description, equipment, source);
    addVisuals(details, content, exercise);
    details.append(summary, content);
    item.append(details, favoriteButton);
    return item;
  }

  function renderFavorites() {
    const openFavorites = new Set(Array.from(favoritesList.querySelectorAll('details[open]'), details => details.parentElement.dataset.favoriteId));
    favoritesList.querySelectorAll('.catalogue-thumbnail').forEach(image => thumbnailObserver?.unobserve(image));
    favoritesList.replaceChildren(...exercises.filter(exercise => favorites.has(exercise.id)).map(exercise => {
      const row = exerciseItem(exercise, true);
      if (openFavorites.has(exercise.id)) row.querySelector('details').open = true;
      return row;
    }));
    favoritesEmpty.hidden = favorites.size > 0;
    results.querySelectorAll('[data-favorite-exercise]').forEach(updateFavoriteButton);
  }

  function toggleFavorite(event) {
    const button = event.target.closest('[data-favorite-exercise]');
    if (!button) return;
    const row = button.closest('li');
    const nextFavorite = row.nextElementSibling?.dataset.favoriteId ?? row.previousElementSibling?.dataset.favoriteId;
    const id = button.dataset.favoriteExercise;
    const next = readFavorites();
    if (next.has(id)) next.delete(id);
    else next.add(id);
    try {
      localStorage.setItem(favoritesKey, JSON.stringify([...next]));
    } catch {
      window.alert('Impossible d’enregistrer ce favori sur cet appareil.');
      return;
    }
    favorites = next;
    renderFavorites();
    if (row.dataset.favoriteId) {
      const neighbor = favoritesList.querySelector('[data-favorite-exercise="' + (next.has(id) ? id : nextFavorite) + '"]');
      (neighbor || favoritesLink).focus();
    }
  }

  function showPage(focus = false) {
    const batch = matches.slice(displayed, displayed + pageSize).map(exercise => exerciseItem(exercise));
    results.append(...batch);
    displayed += batch.length;
    more.hidden = displayed >= matches.length;
    if (focus) batch[0]?.querySelector('summary').focus();
  }

  function searchExercises() {
    const terms = normalise(search.value).split(' ').filter(Boolean)
      .map(term => term.length > 3 ? term.replace(/s$/, '') : term);
    matches = exercises.filter(exercise => terms.every(term => exercise.searchable.includes(term)));
    results.replaceChildren();
    displayed = 0;
    count.textContent = matches.length
      ? matches.length + (matches.length === 1 ? ' exercice' : ' exercices')
      : 'Aucun exercice trouvé.';
    showPage();
  }

  search.addEventListener('input', searchExercises);
  section.querySelectorAll('[data-catalogue-recherche]').forEach(button => {
    button.addEventListener('click', () => {
      search.value = button.dataset.catalogueRecherche;
      searchExercises();
    });
  });
  more.addEventListener('click', () => showPage(true));
  results.addEventListener('click', toggleFavorite);
  favoritesList.addEventListener('click', toggleFavorite);
  window.addEventListener('storage', event => {
    if (event.storageArea !== localStorage || (event.key !== favoritesKey && event.key !== null)) return;
    favorites = readFavorites();
    renderFavorites();
  });
  renderFavorites();
  searchExercises();
})();

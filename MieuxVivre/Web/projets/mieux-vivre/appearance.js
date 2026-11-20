'use strict';
(() => {
  const modes = ['system', 'light', 'dark'];
  const key = 'mieux-vivre:appearance';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const native = window.webkit?.messageHandlers?.native;
  const $ = id => document.getElementById(id);
  const icon = name => `<svg class="glyph" aria-hidden="true" focusable="false"><use href="#mv-${name}"/></svg>`;
  window.MieuxVisual = {icon};

  let mode = window.mvAppearance ?? 'system';
  if (!native) {
    try { mode = localStorage.getItem(key) ?? mode; } catch {}
  }
  if (!modes.includes(mode)) mode = 'system';

  function paint() {
    const dark = mode === 'dark' || (mode === 'system' && system.matches);
    document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
    const colors = document.body.classList.contains('carnet-unifie') ? ['#f4f7fb', '#111a27'] : ['#f6f3fb', '#181323'];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors[Number(dark)]);
  }

  const select = $('appearance-select');
  select.value = mode;
  select.addEventListener('change', () => {
    if (!modes.includes(select.value)) return;
    mode = select.value;
    if (native) native.postMessage({action:'appearance',content:mode});
    else try { localStorage.setItem(key, mode); } catch {}
    paint();
  });
  $('open-appearance').addEventListener('click', () => $('appearance-dialog').showModal());
  $('appearance-close').addEventListener('click', () => $('appearance-dialog').close());
  system.addEventListener('change', paint);
  paint();
})();

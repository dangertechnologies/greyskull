// Shared bits for the mockups: theme from the URL hash (#dark | #light), status bar, icons, pictograms, tab bar.
const root = document.documentElement;
root.dataset.theme = location.hash === '#dark' ? 'dark' : 'light';
const I = {
  back: 'M15 5l-7 7 7 7', chev: 'M9 5l7 7-7 7', close: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5', timer: 'M12 8v5l3 2M9 2h6M12 4a8 8 0 100 16 8 8 0 000-16z', calendar: 'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', edit: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3', skip: 'M5 5l9 7-9 7zM18 5v14',
  undo: 'M9 7L4 12l5 5M4 12h10a6 6 0 010 8h-3', video: 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 8.5v7l6-3.5z', share: 'M12 3v12M8 7l4-4 4 4M5 12v8h14v-8',
  import: 'M12 15V3M8 11l4 4 4-4M5 17v4h14v-4', search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l5 5', pause: 'M8 5v14M16 5v14', play: 'M7 4l13 8-13 8z',
  grip: 'M5 8h14M5 12h14M5 16h14', health: 'M12 20s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0120 9c0 6-8 11-8 11z', siri: 'M4 12h2M8 7v10M12 4v16M16 8v8M20 11v2',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4', warn: 'M12 4l9 16H3zM12 10v4M12 17v.5', lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  filter: 'M4 6h16M7 12h10M10 18h4', bolt: 'M13 3L5 14h6l-1 7 8-11h-6z', info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.5',
  up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', ladder: 'M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10', file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  today: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z', progress: 'M4 4v16h16M7 15l4-4 3 3 5-6', plan: 'M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2l1.5 3 3.3-.8.9 3.3 3.1 1.5-1.5 3 1.5 3-3.1 1.5-.9 3.3-3.3-.8L12 22l-1.5-3-3.3.8-.9-3.3L3.2 14.5l1.5-3-1.5-3 3.1-1.5.9-3.3 3.3.8z',
  lift: 'M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12', link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  do: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8 12.5l3 3 5-6', dont: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9 9l6 6M15 9l-6 6',
  wifi: 'M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0',
};
// Placeholder line pictograms (32x32 grid). The real set comes from the pictogram task.
const P = {
  push: 'M5 25h22M8 19l17-5M25 14l2 11M9 19v6 M11 14.5a2.3 2.3 0 100-.01', pull: 'M6 6h20M12 6l2 7M20 6l-2 7M16 16.5a2.5 2.5 0 100-.01M16 19v6M16 25l-3 4M16 25l3 4',
  squat: 'M14 10l-2 7 8 1-2 8M14 11l8 0M14 7.5a2.5 2.5 0 100-.01M6 27h20', hold: 'M4 26h25M9 19l18 4M9 19v7M6 16.5a2.5 2.5 0 100-.01',
  hand: 'M16 4v14M16 18l-4 8M16 18l4 8M13 21.5a2.5 2.5 0 100-.01M13 5l3 0', bar: 'M4 16h24M8 9v14M12 12v8M24 9v14M20 12v8', kb: 'M16 14a7 7 0 100 14 7 7 0 000-14zM11 15c0-9 10-9 10 0',
  band: 'M5 13c0-6 22-6 22 0s-22 6-22 0zM9 22c4 4 10 4 14 0', dip: 'M4 19h8M20 19h8M16 6.5a2.5 2.5 0 100-.01M16 10v9M16 12l-5 7M16 12l5 7M16 19l-2 8M16 19l2 8',
  core: 'M6 12.5a2.5 2.5 0 100-.01M9 15q9 7 18-2M5 27h22', lever: 'M5 16.5a2.5 2.5 0 100-.01M8 16h20M9 16V4M4 4h10', row: 'M5 8h22M8 8v4M24 8v4M10 24l14-9M6 22.5a2.5 2.5 0 100-.01',
  mob: 'M16 5.5a2.5 2.5 0 100-.01M16 9v10M8 13h16M16 19l-4 8M16 19l4 8', plank: 'M4 26h25M9 19l18 4M9 19v7M6 16.5a2.5 2.5 0 100-.01',
};
const svg = (d, vb, cls) => `<svg class="${cls || 'ic'}" viewBox="0 0 ${vb} ${vb}"><path d="${d}"/></svg>`;
document.querySelectorAll('[data-i]').forEach((el) => {
  el.insertAdjacentHTML('afterbegin', svg(I[el.dataset.i] || I.info, 24, 'ic ' + (el.dataset.s || '')));
});
document.querySelectorAll('[data-p]').forEach((el) => {
  el.classList.add('badge');
  el.innerHTML = `<svg viewBox="0 0 32 32"><path d="${P[el.dataset.p] || P.mob}"/></svg>`;
});
const phone = document.querySelector('.phone');
phone.insertAdjacentHTML('afterbegin', `<div class="status"><span>9:41</span><span class="ico">${svg(I.wifi, 24, 'ic sm')}<svg width="26" height="13" viewBox="0 0 26 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="19" height="9" rx="2" fill="currentColor"/></svg></span></div>`);
phone.insertAdjacentHTML('beforeend', '<div class="home"></div>');
const tabs = phone.dataset.tabs;
if (tabs) {
  phone.classList.add('has-tabs');
  const t = [['today', 'Today'], ['progress', 'Progress'], ['plan', 'Programs'], ['settings', 'Settings']];
  phone.insertAdjacentHTML('beforeend', `<nav class="tabs">${t.map(([k, l]) => `<div class="${k === tabs ? 'on' : ''}">${svg(I[k], 24, 'ic')}${l}</div>`).join('')}</nav>`);
}

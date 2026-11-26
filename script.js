const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
const pairs = [...document.querySelectorAll('.video-pair')].map(element => new PairedVideoPlayer(element));
const carousels = [...document.querySelectorAll('.task-carousel')].map(element => new TaskCarousel(element, pairs.filter(pair => element.contains(pair.element))));
const loadVideo = video => { if (video?.dataset.src && !video.src) { video.src = video.dataset.src; video.load(); } };
function activate(tab, shouldPlay = false) {
  tabs.forEach(item => { const active = item === tab; item.setAttribute('aria-selected', String(active)); item.tabIndex = active ? 0 : -1; });
  panels.forEach(panel => {
    const active = panel.id === tab.getAttribute('aria-controls');
    panel.hidden = !active;
    const panelPairs = pairs.filter(pair => panel.contains(pair.element));
    panelPairs.forEach(pair => {
      if (active && shouldPlay && !pair.element.closest('[inert]')) pair.play();
      else pair.pause();
    });
    panel.querySelectorAll('video').forEach(video => {
      if (video.closest('.video-pair')) return;
      if (active) {
        loadVideo(video);
        if (shouldPlay) video.play().catch(() => {});
      } else video.pause();
    });
  });
}
tabs.forEach((tab,index) => {
  tab.addEventListener('click', () => activate(tab, true));
  tab.addEventListener('keydown', event => { let target;
    if (event.key === 'ArrowRight') target = tabs[(index+1)%tabs.length];
    if (event.key === 'ArrowLeft') target = tabs[(index+tabs.length-1)%tabs.length];
    if (event.key === 'Home') target = tabs[0];
    if (event.key === 'End') target = tabs.at(-1);
    if (target) { event.preventDefault(); target.focus(); activate(target); }
  });
});
const mediaObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  const video = entry.target;
  if (entry.isIntersecting && !video.closest('[hidden]')) loadVideo(video);
  else if (!entry.isIntersecting) video.pause();
}), {threshold: .1});
document.querySelectorAll('video').forEach(video => {
  if (!video.closest('.video-pair')) mediaObserver.observe(video);
});
const pairObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  pairs.filter(pair => entry.target.contains(pair.element)).forEach(pair => {
    if (entry.isIntersecting && !pair.element.closest('[hidden], [inert]')) pair.load();
    else pair.pause();
  });
}), {threshold: 0});
new Set(pairs.map(pair => pair.element.closest('.task-carousel') || pair.element)).forEach(element => pairObserver.observe(element));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pairs.forEach(pair => pair.pause());
    document.querySelectorAll('video').forEach(video => video.pause());
  }
});
const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) document.querySelectorAll('nav a').forEach(a => a.classList.toggle('active', a.hash === '#' + entry.target.id));
}), {rootMargin:'-10% 0px -65% 0px'});
document.querySelectorAll('main > section[id]').forEach(section => sectionObserver.observe(section));

const copyButton = document.querySelector('.copy-button');
copyButton.addEventListener('click', async () => {
  const code = document.querySelector('#bibtex-code');
  try {
    await navigator.clipboard.writeText(code.textContent);
    copyButton.textContent = 'Copied';
    setTimeout(() => { copyButton.textContent = 'Copy'; }, 1800);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    copyButton.textContent = 'Select & copy';
    setTimeout(() => { copyButton.textContent = 'Copy'; }, 3500);
  }
});

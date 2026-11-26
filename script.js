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
const navSections = [...document.querySelectorAll('nav a')].map(link => ({
  link, section: document.querySelector(link.hash),
})).filter(item => item.section);
if (navSections.length) {
  const header = document.querySelector('.site-header');
  let navFrame = 0;
  const updateNavigation = () => {
    navFrame = 0;
    // Follow the section occupying the main viewing area below the header.
    // Task switches can move a section down through browser scroll anchoring.
    const headerBottom = header?.getBoundingClientRect().bottom || 0;
    const marker = Math.max(0, Math.min((headerBottom + window.innerHeight) / 2, window.innerHeight - 1));
    let active = null;
    navSections.forEach(({ section }) => {
      if (section.getBoundingClientRect().top <= marker) active = section;
    });
    // The last section may be too short to reach the marker before scrolling ends.
    if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      active = navSections.at(-1).section;
    }
    navSections.forEach(({ link, section }) => link.classList.toggle('active', section === active));
  };
  const scheduleNavigation = () => {
    if (!navFrame) navFrame = requestAnimationFrame(updateNavigation);
  };
  window.addEventListener('scroll', scheduleNavigation, { passive: true });
  window.addEventListener('resize', scheduleNavigation);
  window.addEventListener('hashchange', scheduleNavigation);
  window.addEventListener('load', scheduleNavigation);
  const layoutObserver = new ResizeObserver(scheduleNavigation);
  layoutObserver.observe(document.querySelector('main'));
  if (header) layoutObserver.observe(header);
  updateNavigation();
}

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

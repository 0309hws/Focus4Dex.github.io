class TaskCarousel {
  constructor(element, players) {
    this.element = element;
    this.players = players;
    this.slides = [...element.querySelectorAll('.carousel-slide')];
    this.dots = [...element.querySelectorAll('.carousel-dot')];
    this.track = element.querySelector('.carousel-track');
    this.viewport = element.querySelector('.carousel-viewport');
    this.index = 0;
    this.suppressClickUntil = 0;
    element.querySelector('.previous').addEventListener('click', () => this.show(this.index - 1));
    element.querySelector('.next').addEventListener('click', () => this.show(this.index + 1));
    this.dots.forEach((dot, index) => dot.addEventListener('click', () => this.show(index)));
    this.viewport.addEventListener('keydown', event => {
      if (event.target !== this.viewport) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.show(this.index + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    this.viewport.addEventListener('pointerdown', event => {
      this.gesture = null;
      if (event.pointerType === 'mouse' || event.target.closest('button, input, .pair-controls')) return;
      this.gesture = {id: event.pointerId, x: event.clientX, y: event.clientY};
    });
    this.viewport.addEventListener('pointerup', event => {
      const start = this.gesture;
      this.gesture = null;
      if (!start || start.id !== event.pointerId) return;
      const x = event.clientX - start.x, y = event.clientY - start.y;
      if (Math.abs(x) < 50 || Math.abs(x) < Math.abs(y) * 1.3) return;
      this.suppressClickUntil = Date.now() + 400;
      this.show(this.index + (x < 0 ? 1 : -1));
    });
    this.viewport.addEventListener('pointercancel', () => { this.gesture = null; });
    this.viewport.addEventListener('click', event => {
      if (Date.now() < this.suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  show(index) {
    const next = (index + this.slides.length) % this.slides.length;
    if (next === this.index) return;
    this.players.forEach(player => player.pause());
    this.index = next;
    this.slides.forEach((slide, i) => {
      slide.inert = i !== next;
      slide.setAttribute('aria-hidden', String(i !== next));
      this.dots[i].setAttribute('aria-current', String(i === next));
    });
    this.track.style.transform = `translateX(-${next * 100}%)`;
    if (!this.element.closest('[hidden]') && !document.hidden) this.players[next].play();
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = TaskCarousel;

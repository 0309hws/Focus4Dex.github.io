/* One timeline per camera pair. Original clips retain their full duration. */
class PairedVideoPlayer {
  constructor(element) {
    this.element = element;
    this.videos = [...element.querySelectorAll('video')];
    this.button = element.querySelector('.pair-toggle');
    this.progress = element.querySelector('.pair-progress');
    this.time = element.querySelector('.pair-time');
    this.label = element.dataset.label;
    this.position = 0;
    this.duration = 0;
    this.wanted = false;
    this.running = false;
    this.starting = false;
    this.generation = 0;
    this.frame = 0;
    this.loaded = false;
    this.prepared = new Set();
    this.videos.forEach(video => {
      video.controls = false;
      video.loop = false;
      video.addEventListener('loadedmetadata', () => this.metadata());
      video.addEventListener('durationchange', () => this.metadata());
      video.addEventListener('canplay', () => this.resume());
      video.addEventListener('seeked', () => this.resume());
      video.addEventListener('waiting', () => {
        if (this.wanted && this.running && !this.atEnd(video)) {
          this.hold();
          this.resume();
        }
      });
      video.addEventListener('ended', () => {
        // A shorter camera clip holds its final frame until the longer one ends.
        if (this.wanted && this.videos.every(item => this.atEnd(item))) this.seek(0);
      });
      video.addEventListener('error', () => this.pause());
      video.addEventListener('click', () => this.toggle());
    });
    this.button.addEventListener('click', () => this.toggle());
    this.progress.addEventListener('input', () => this.seek(Number(this.progress.value)));
    element.querySelector('.pair-controls').hidden = false;
    this.metadata();
  }

  metadata() {
    if (!this.videos.every(video => Number.isFinite(video.duration) && video.duration > 0)) return;
    this.master = this.videos.reduce((longest, video) => video.duration > longest.duration ? video : longest);
    this.duration = this.master.duration;
    this.progress.max = this.duration;
    this.progress.disabled = false;
    this.render();
    this.resume();
  }

  load() {
    if (this.loaded) return;
    this.loaded = true;
    this.videos.forEach(video => { video.preload = 'auto'; video.load(); });
  }

  atEnd(video) {
    return video.ended || video.currentTime >= video.duration - 0.001;
  }

  render() {
    const format = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    const action = this.wanted ? 'Pause' : 'Play';
    if (this.action !== action) {
      this.action = action;
      this.button.setAttribute('data-playing', String(this.wanted));
      this.button.setAttribute('aria-label', `${action} ${this.label}`);
    }
    this.progress.value = this.position;
    const time = `${format(this.position)} / ${format(this.duration)}`;
    if (this.time.textContent !== time) {
      this.time.textContent = time;
      this.progress.setAttribute('aria-valuetext', time);
    }
  }

  toggle() { this.wanted ? this.pause() : this.play(); }

  play() {
    this.wanted = true;
    this.load();
    if (this.duration && this.videos.every(video => this.atEnd(video))) this.seek(0);
    else this.resume();
    this.render();
  }

  hold() {
    if (this.running) this.position = this.master.currentTime;
    this.generation++;
    this.running = false;
    this.starting = false;
    this.prepared.clear();
    cancelAnimationFrame(this.frame);
    this.videos.forEach(video => video.pause());
    this.render();
  }

  pause() {
    this.wanted = false;
    this.hold();
  }

  seek(seconds) {
    if (!this.duration) return;
    this.hold();
    this.position = Math.max(0, Math.min(seconds, this.duration));
    this.videos.forEach(video => {
      const target = Math.min(this.position, video.duration);
      if (Math.abs(video.currentTime - target) > 0.001) video.currentTime = target;
    });
    this.render();
    this.resume();
  }

  resume() {
    if (!this.wanted || this.running || this.starting) return;
    // Some browsers do not fetch beyond metadata until play() is requested.
    // Let the unready cameras fetch while the ready cameras stay paused.
    if (!this.duration) {
      const cold = this.videos.filter(video => !this.prepared.has(video));
      if (cold.length) this.prepare(cold);
      return;
    }
    if (this.videos.every(video => this.atEnd(video))) { this.seek(0); return; }
    const active = this.videos.filter(video => !this.atEnd(video));
    // Align before starting. Waiting and seeking hold both cameras together.
    active.forEach(video => {
      if (!this.atEnd(this.master) && Math.abs(video.currentTime - this.position) > 0.08) video.currentTime = Math.min(this.position, video.duration);
    });
    if (active.some(video => video.seeking)) return;
    const cold = active.filter(video => video.readyState < 3 && !this.prepared.has(video));
    if (cold.length) { this.prepare(cold); return; }
    this.starting = true;
    const generation = ++this.generation;
    const pending = new Set(active);
    const held = new Set();
    Promise.all(active.map(video => this.requestPlay(video).then(() => {
      if (generation !== this.generation) return;
      pending.delete(video);
      // Give play promises fulfilled in this same turn a chance to settle.
      // Otherwise hold the early camera while its partner is still starting.
      queueMicrotask(() => {
        if (generation === this.generation && pending.size) {
          video.pause();
          held.add(video);
        }
      });
    }))).then(() => {
      if (generation !== this.generation) return;
      const times = active.map(video => video.currentTime);
      if (Math.max(...times) - Math.min(...times) > 0.12) {
        this.seek(Math.min(...times));
        return;
      }
      this.starting = false;
      this.running = true;
      this.prepared.clear();
      held.forEach(video => {
        if (this.atEnd(video)) return;
        this.requestPlay(video).catch(() => {
          if (generation === this.generation) this.pause();
        });
      });
      this.tick();
    }).catch(() => {
      if (generation === this.generation) this.pause();
    });
  }

  requestPlay(video) {
    try { return Promise.resolve(video.play()); }
    catch (error) { return Promise.reject(error); }
  }

  prepare(videos) {
    this.starting = true;
    const generation = ++this.generation;
    const positions = new Map(videos.map(video => [video, video.currentTime]));
    Promise.all(videos.map(video => this.requestPlay(video).then(() => {
      if (generation !== this.generation) return;
      video.pause();
      if (Math.abs(video.currentTime - positions.get(video)) > 0.001) video.currentTime = positions.get(video);
      this.prepared.add(video);
    }))).then(() => {
      if (generation !== this.generation) return;
      this.starting = false;
      this.resume();
    }).catch(() => {
      if (generation === this.generation) this.pause();
    });
  }

  tick() {
    if (!this.running) return;
    this.position = this.master.currentTime;
    this.videos.forEach(video => {
      if (video === this.master || video.seeking || this.atEnd(video) || this.atEnd(this.master)) return;
      if (Math.abs(video.currentTime - this.position) > 0.12) video.currentTime = this.position;
    });
    this.render();
    this.frame = requestAnimationFrame(() => this.tick());
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = PairedVideoPlayer;

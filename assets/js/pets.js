// assets/js/pets.js — Thú cưng (emoji) lang thang khắp màn hình.
// Tự chứa, không phụ thuộc thư viện khác. Dùng <div id="pets-layer"> phủ toàn viewport.
// - Lang thang tới điểm ngẫu nhiên, tự đổi hướng, thỉnh thoảng đứng nghỉ.
// - Click vào pet để "chọc" (nảy lên + bắn reaction) rồi nó chạy đi chỗ khác.
// - Nút 🐾 góc dưới-trái để bật/tắt (lưu localStorage).
// - Tôn trọng prefers-reduced-motion: nếu người dùng yêu cầu giảm chuyển động → không tạo pet.

(function () {
  'use strict';

  const STORAGE_KEY = 'notdore-pets-enabled';
  const EMOJIS   = ['🐱', '🐶', '🐰', '🦊', '🐼'];
  const REACTIONS = ['❤️', '✨', '💕', '⭐', '🎵', '💫'];
  const SIZE = 38;                 // kích thước pet (px)
  const PAD  = 10;                 // khoảng cách mép màn hình (px)
  const SPEED_MIN = 28;            // px/giây
  const SPEED_MAX = 70;
  const IDLE_MIN = 500, IDLE_MAX = 2600;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const rand   = (min, max) => min + Math.random() * (max - min);
  const pick   = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const bounds = () => ({
    maxX: Math.max(PAD, window.innerWidth  - SIZE - PAD),
    maxY: Math.max(PAD, window.innerHeight - SIZE - PAD),
  });

  const readEnabled = () => { try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { return true; } };
  const saveEnabled = (on) => { try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* bỏ qua */ } };

  let enabled = readEnabled();
  let rafId = null;
  let last = 0;

  const layer = document.createElement('div');
  layer.id = 'pets-layer';
  layer.setAttribute('aria-hidden', 'true');

  const toggle = document.createElement('button');
  toggle.id = 'pets-toggle';
  toggle.type = 'button';
  toggle.textContent = '🐾';

  const pets = [];

  // ── Di chuyển ────────────────────────────────────────────────────────────────

  function applyTransform(pet) {
    pet.el.style.transform =
      `translate3d(${pet.x.toFixed(1)}px, ${pet.y.toFixed(1)}px, 0) scaleX(${pet.dir})`;
  }

  function newTarget(pet) {
    const { maxX, maxY } = bounds();
    pet.tx = rand(PAD, maxX);
    pet.ty = rand(PAD, maxY);
    pet.speed = rand(SPEED_MIN, SPEED_MAX);
    pet.state = 'walk';
    pet.el.classList.add('is-walking');
    pet.el.classList.remove('is-idle');
  }

  function startIdle(pet) {
    pet.state = 'idle';
    pet.el.classList.remove('is-walking');
    pet.el.classList.add('is-idle');
    pet.idleUntil = performance.now() + rand(IDLE_MIN, IDLE_MAX);
  }

  // ── Tạo pet ──────────────────────────────────────────────────────────────────

  function createPet(index) {
    const el = document.createElement('div');
    el.className = 'pet is-idle';
    el.style.fontSize = SIZE + 'px';
    el.innerHTML = `<span class="pet__emoji">${EMOJIS[index % EMOJIS.length]}</span>`;

    const { maxX, maxY } = bounds();
    const pet = {
      el,
      x: rand(PAD, maxX),
      y: rand(PAD, maxY),
      tx: 0, ty: 0,
      speed: SPEED_MIN,
      dir: 1,                               // emoji quay mặt sang trái; dir=-1 để quay phải
      state: 'idle',
      idleUntil: performance.now() + rand(0, 1500),
    };

    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); poke(pet); });

    layer.appendChild(el);
    applyTransform(pet);
    pets.push(pet);
  }

  function poke(pet) {
    pet.el.classList.remove('is-poked');
    void pet.el.offsetWidth;               // reset animation
    pet.el.classList.add('is-poked');

    const bubble = document.createElement('span');
    bubble.className = 'pet__reaction';
    bubble.textContent = pick(REACTIONS);
    bubble.style.left = (pet.x + SIZE / 2) + 'px';
    bubble.style.top  = (pet.y - 6) + 'px';
    layer.appendChild(bubble);
    setTimeout(() => bubble.remove(), 900);

    newTarget(pet);                        // chạy trốn tới điểm mới
  }

  // ── Vòng lặp ─────────────────────────────────────────────────────────────────

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(48, now - last) / 1000;
    last = now;
    if (!enabled) return;

    for (const pet of pets) {
      if (pet.state === 'idle') {
        if (now >= pet.idleUntil) newTarget(pet);
        continue;
      }
      const dx = pet.tx - pet.x;
      const dy = pet.ty - pet.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) { startIdle(pet); continue; }

      const step = Math.min(dist, pet.speed * dt);
      pet.x += (dx / dist) * step;
      pet.y += (dy / dist) * step;
      if (Math.abs(dx) > 4) pet.dir = dx < 0 ? 1 : -1;
      applyTransform(pet);
    }
  }

  // ── Bật/tắt ──────────────────────────────────────────────────────────────────

  function setEnabled(on) {
    enabled = on;
    saveEnabled(on);
    layer.classList.toggle('is-hidden', !on);
    toggle.classList.toggle('is-active', on);
    toggle.title = on ? 'Tắt thú cưng' : 'Bật thú cưng';
    toggle.setAttribute('aria-label', toggle.title);
  }

  function build() {
    for (let i = 0; i < (window.innerWidth < 768 ? 3 : 5); i++) createPet(i);
    document.body.appendChild(layer);
    document.body.appendChild(toggle);

    toggle.addEventListener('click', () => setEnabled(!enabled));
    setEnabled(enabled);

    last = performance.now();
    rafId = requestAnimationFrame(tick);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && rafId) { cancelAnimationFrame(rafId); rafId = null; }
      else if (!document.hidden && !rafId) { last = performance.now(); rafId = requestAnimationFrame(tick); }
    });

    window.addEventListener('resize', () => {
      const { maxX, maxY } = bounds();
      for (const pet of pets) {
        pet.x = Math.min(pet.x, maxX);
        pet.y = Math.min(pet.y, maxY);
        applyTransform(pet);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();

/* ═══════════════════════════════════════
   0xMon4 — main.js  v2
   Warp · Celestials · Nav · Socials · Form
   ═══════════════════════════════════════ */

'use strict';

/* ─── Warp Displacement Background ──────────────────
   WebGL GLSL shader with canvas 2D fallback.
   ───────────────────────────────────────────────── */
(function initWarp() {
  const canvas = document.getElementById('warp-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    initWebGLWarp(canvas, gl);
  } else {
    init2DWarp(canvas);
  }

  function initWebGLWarp(canvas, gl) {
    const vsSource = `
      attribute vec2 a_pos;
      void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
    `;
    const fsSource = `
      precision mediump float;
      uniform vec2  u_res;
      uniform vec2  u_mouse;
      uniform float u_time;
      #define PI 3.14159265358979

      float hash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
      }
      float fbm(vec2 p) {
        float v=0.0,a=0.5;
        for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;}
        return v;
      }
      void main() {
        vec2 uv = gl_FragCoord.xy / u_res;
        vec2 mouse = u_mouse / u_res;
        vec2 diff = uv - mouse;
        float dist = length(diff);
        float strength = 0.12 * smoothstep(0.55, 0.0, dist);
        float t = u_time * 0.18;
        vec2 warpedUV = uv;
        warpedUV.x += strength * sin(uv.y*6.0+t*1.3+fbm(uv*2.5+t*0.4)*4.0);
        warpedUV.y += strength * cos(uv.x*6.0+t*1.1+fbm(uv*2.5-t*0.3)*4.0);
        float n1 = fbm(warpedUV*3.0+t*0.2);
        float n2 = fbm(warpedUV*5.0-t*0.15);
        vec3 deepSpace = vec3(0.008,0.012,0.028);
        vec3 nebula1   = vec3(0.0,0.10,0.035);
        vec3 nebula2   = vec3(0.01,0.05,0.08);
        vec3 col = deepSpace;
        col = mix(col, nebula1, n1*0.45);
        col = mix(col, nebula2, n2*0.3);
        float glow = exp(-dist*4.5)*0.55;
        col += vec3(0.0,glow,glow*0.28);
        vec2 vUV = uv*(1.0-uv.yx);
        float vig = pow(vUV.x*vUV.y*16.0,0.35);
        col *= vig;
        float star = step(0.9972, hash(floor(uv*u_res/2.5)));
        col += star*0.55*(0.6+0.4*sin(u_time*3.0+hash(floor(uv*80.0))*100.0));
        gl_FragColor = vec4(col,1.0);
      }
    `;

    function compileShader(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
      return s;
    }
    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) { init2DWarp(canvas); return; }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { init2DWarp(canvas); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);

    const aPosLoc   = gl.getAttribLocation(prog, 'a_pos');
    const uResLoc   = gl.getUniformLocation(prog, 'u_res');
    const uMouseLoc = gl.getUniformLocation(prog, 'u_mouse');
    const uTimeLoc  = gl.getUniformLocation(prog, 'u_time');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    let mouse = { x: 0, y: 0 }, targetMouse = { x: 0, y: 0 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      targetMouse = { x: canvas.width / 2, y: canvas.height / 2 };
      mouse = { ...targetMouse };
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    window.addEventListener('mousemove', (e) => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      targetMouse.x = e.clientX * dpr;
      targetMouse.y = (window.innerHeight - e.clientY) * dpr;
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      const t = e.touches[0], dpr = Math.min(window.devicePixelRatio, 2);
      targetMouse.x = t.clientX * dpr;
      targetMouse.y = (window.innerHeight - t.clientY) * dpr;
    }, { passive: true });

    let startTime = performance.now();
    function render(now) {
      mouse.x += (targetMouse.x - mouse.x) * 0.07;
      mouse.y += (targetMouse.y - mouse.y) * 0.07;
      gl.uniform2f(uResLoc,   canvas.width, canvas.height);
      gl.uniform2f(uMouseLoc, mouse.x, mouse.y);
      gl.uniform1f(uTimeLoc,  (now - startTime) * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }

  function init2DWarp(canvas) {
    const ctx = canvas.getContext('2d');
    let mouse = { x: 0.5, y: 0.5 }, targetMouse = { ...mouse };

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', (e) => {
      targetMouse.x = e.clientX / window.innerWidth;
      targetMouse.y = e.clientY / window.innerHeight;
    }, { passive: true });

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      a: Math.random(),
      speed: Math.random() * 0.006 + 0.002,
    }));

    let t = 0;
    function render() {
      t += 0.01;
      mouse.x += (targetMouse.x - mouse.x) * 0.06;
      mouse.y += (targetMouse.y - mouse.y) * 0.06;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createRadialGradient(mouse.x*W, mouse.y*H, 0, mouse.x*W, mouse.y*H, W*0.7);
      bg.addColorStop(0, 'rgba(0,40,16,0.85)'); bg.addColorStop(0.4, 'rgba(2,8,20,0.95)'); bg.addColorStop(1, 'rgba(2,4,9,1)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      stars.forEach(s => {
        s.a += s.speed;
        const dx = s.x - mouse.x, dy = s.y - mouse.y, dist = Math.sqrt(dx*dx+dy*dy);
        const warpX = s.x + Math.sin(t+s.x*6)*0.01*(1-Math.min(dist,1));
        const warpY = s.y + Math.cos(t+s.y*6)*0.01*(1-Math.min(dist,1));
        ctx.beginPath();
        ctx.arc(warpX*W, warpY*H, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${0.3+0.5*Math.abs(Math.sin(s.a))})`;
        ctx.fill();
      });
      const glow = ctx.createRadialGradient(mouse.x*W, mouse.y*H, 0, mouse.x*W, mouse.y*H, 260);
      glow.addColorStop(0, 'rgba(0,255,102,0.18)'); glow.addColorStop(0.5, 'rgba(0,255,102,0.04)'); glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }
})();

/* ─── Celestial Layer — CSS-driven particles ──── */
(function initCelestials() {
  const layer = document.getElementById('celestial-layer');
  if (!layer) return;

  // Respect reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const W = window.innerWidth, H = window.innerHeight;

  /* Micro stars */
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'cel-star';
    const size = Math.random() * 2 + 0.5;
    const dur  = (Math.random() * 3 + 2).toFixed(1) + 's';
    const delay = (Math.random() * 5).toFixed(2) + 's';
    const minOp = (Math.random() * 0.1 + 0.05).toFixed(2);
    const maxOp = (Math.random() * 0.6 + 0.3).toFixed(2);
    const scale = (Math.random() * 1.5 + 1).toFixed(1);

    Object.assign(el.style, {
      width: `${size}px`,
      height: `${size}px`,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      '--dur': dur,
      '--delay': delay,
      '--min-op': minOp,
      '--max-op': maxOp,
      '--scale': scale,
    });

    // Occasional green-tinted star
    if (Math.random() < 0.18) {
      el.style.background = `rgba(0, 255, 102, ${maxOp})`;
      el.style.boxShadow  = `0 0 ${size * 3}px rgba(0,255,102,0.4)`;
    }
    layer.appendChild(el);
  }

  /* Nebula orbs */
  const orbColors = [
    'rgba(0,255,102,1)', 'rgba(0,200,80,1)',
    'rgba(60,120,255,1)', 'rgba(120,60,200,1)',
  ];
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'cel-orb';
    const size = Math.random() * 120 + 60;
    const color = orbColors[Math.floor(Math.random() * orbColors.length)];
    const dur   = (Math.random() * 20 + 15).toFixed(0) + 's';
    const delay = (Math.random() * 8).toFixed(1) + 's';
    const dx = (Math.random() * 40 - 20).toFixed(0) + 'px';
    const dy = (Math.random() * 30 - 15).toFixed(0) + 'px';
    const dx2 = (Math.random() * 40 - 20).toFixed(0) + 'px';
    const dy2 = (Math.random() * 30 - 15).toFixed(0) + 'px';

    Object.assign(el.style, {
      width: `${size}px`,
      height: `${size}px`,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      background: `radial-gradient(circle, ${color.replace('1)', '0.06)')}, transparent 70%)`,
      '--dur': dur, '--delay': delay,
      '--dx': dx, '--dy': dy, '--dx2': dx2, '--dy2': dy2,
    });
    layer.appendChild(el);
  }

  /* Decorative thin rings */
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div');
    el.className = 'cel-ring';
    const size  = Math.random() * 150 + 80;
    const dur   = (Math.random() * 40 + 20).toFixed(0) + 's';
    const delay = (Math.random() * 10).toFixed(1) + 's';

    Object.assign(el.style, {
      width: `${size}px`,
      height: `${size}px`,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      transform: 'translate(-50%, -50%)',
      '--dur': dur, '--delay': delay,
    });
    layer.appendChild(el);
  }

  /* Shooting stars — spawn periodically */
  function spawnShootingStar() {
    const el = document.createElement('div');
    el.className = 'cel-shoot';
    const width = Math.random() * 60 + 30;
    const dur   = (Math.random() * 0.8 + 0.8).toFixed(2) + 's';

    Object.assign(el.style, {
      width: `${width}px`,
      left: `${Math.random() * 70}%`,
      top: `${Math.random() * 60}%`,
      transform: `rotate(${Math.random() * 30 + 10}deg)`,
      '--dur': dur,
      '--delay': '0s',
    });
    layer.appendChild(el);
    setTimeout(() => el.remove(), parseFloat(dur) * 1000 + 100);
  }

  // Spawn a shooting star every 5-12 seconds
  function scheduleShoot() {
    spawnShootingStar();
    setTimeout(scheduleShoot, Math.random() * 7000 + 5000);
  }
  setTimeout(scheduleShoot, 3000);
})();

/* ─── Mobile Navigation ─────────────────────────── */
(function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const links  = document.getElementById('nav-links');
  if (!toggle || !links) return;

  function open()  { links.classList.add('is-open'); toggle.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; }
  function close() { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }

  toggle.addEventListener('click', () => links.classList.contains('is-open') ? close() : open());
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && links.classList.contains('is-open')) { close(); toggle.focus(); } });

  // Active section tracking
  const sections = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav__link:not(.nav__link--cta)');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        navLinks.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === `#${id}`));
      }
    });
  }, { rootMargin: `-68px 0px -60% 0px` });
  sections.forEach(s => obs.observe(s));
})();

/* ─── Nav scroll style ──────────────────────────── */
(function initNavScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => nav.classList.toggle('is-scrolled', window.scrollY > 20), { passive: true });
})();

/* ─── "Get in Touch" social reveal ─────────────── */
(function initSocialReveal() {
  const btn     = document.getElementById('get-in-touch-btn');
  const panel   = document.getElementById('hero-socials-reveal');
  if (!btn || !panel) return;

  let revealed = false;

  btn.addEventListener('click', () => {
    if (!revealed) {
      // First click — reveal
      revealed = true;
      panel.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');

      // Tiny rAF so the browser registers the hidden removal before the class
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          panel.classList.add('is-visible');
        });
      });

      // Stagger each icon link
      const links = panel.querySelectorAll('.social-icon-link');
      links.forEach((link, i) => {
        link.style.transitionDelay = `${i * 0.08}s`;
      });
    } else {
      // Second click — collapse
      revealed = false;
      panel.classList.remove('is-visible');
      btn.setAttribute('aria-expanded', 'false');
      setTimeout(() => panel.setAttribute('hidden', ''), 460);
    }
  });
})();

/* ─── Scroll Reveal ─────────────────────────────── */
(function initReveal() {
  const selectors = [
    '.section__header', '.about__text', '.about__stats',
    '.skills__grid', '.gh-infographic', '.projects__next-label',
    '.projects__grid--next', '.timeline', '.writing__grid',
    '.contact__text', '.contact__form',
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.classList.add('reveal');
    });
  });

  const stagger = ['.about__stats', '.skills__grid', '.projects__grid--next', '.writing__grid'];
  stagger.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => el.classList.add('reveal--stagger'));
  });

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
})();

/* ─── Back to Top ───────────────────────────────── */
(function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => { btn.hidden = window.scrollY < 400; }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ─── GitHub Heatmap (decorative) ──────────────── */
(function initHeatmap() {
  const grid = document.getElementById('heatmap-grid');
  if (!grid) return;

  // Responsive: 52 cols on desktop, 26 on mobile
  const isMobile = window.innerWidth <= 640;
  const cols = isMobile ? 26 : 52;
  const rows = 7;
  const total = cols * rows;

  // Pseudo-random activity pattern seeded by column
  function activityLevel(col, row) {
    const seed = (col * 7 + row * 13 + col % 5) % 100;
    if (seed < 50) return 0;       // no activity
    if (seed < 68) return 1;       // light
    if (seed < 82) return 2;       // medium
    if (seed < 93) return 3;       // heavy
    return 4;                       // very heavy
  }

  const levelColors = [
    'var(--c-surface-2)',
    'rgba(0, 255, 102, 0.18)',
    'rgba(0, 255, 102, 0.38)',
    'rgba(0, 255, 102, 0.62)',
    'var(--c-green)',
  ];

  // Build grid column-by-column (GitHub style)
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const cell = document.createElement('div');
      cell.className = 'gh-heatmap__cell';
      const level = activityLevel(col, row);
      cell.style.setProperty('--gh-color', levelColors[level]);
      cell.style.background = levelColors[level];
      if (level > 0) {
        cell.style.boxShadow = level === 4 ? `0 0 4px rgba(0,255,102,0.5)` : '';
      }
      cell.setAttribute('aria-label', `Activity level ${level}`);
      grid.appendChild(cell);
    }
  }
})();

/* ─── Contact Form ──────────────────────────────── */
(function initContactForm() {
  const form    = document.getElementById('contact-form');
  const success = document.getElementById('form-success');
  const submitBtn = document.getElementById('submit-btn');
  if (!form) return;

  const validators = {
    name:    v => v.trim().length >= 2   || 'Please enter your name (at least 2 characters).',
    email:   v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Please enter a valid email address.',
    subject: v => v.trim().length >= 3   || 'Please enter a subject.',
    message: v => v.trim().length >= 10  || 'Message must be at least 10 characters.',
  };

  function showError(field, msg) {
    const input = form.querySelector(`[name="${field}"]`);
    const errEl = input?.nextElementSibling;
    if (input)  input.classList.add('is-error');
    if (errEl)  errEl.textContent = msg;
  }
  function clearError(field) {
    const input = form.querySelector(`[name="${field}"]`);
    const errEl = input?.nextElementSibling;
    if (input)  input.classList.remove('is-error');
    if (errEl)  errEl.textContent = '';
  }

  Object.keys(validators).forEach(field => {
    const input = form.querySelector(`[name="${field}"]`);
    if (!input) return;
    input.addEventListener('blur', () => {
      const r = validators[field](input.value);
      r === true ? clearError(field) : showError(field, r);
    });
    input.addEventListener('input', () => clearError(field));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;
    Object.keys(validators).forEach(field => {
      const input = form.querySelector(`[name="${field}"]`);
      if (!input) return;
      const r = validators[field](input.value);
      if (r !== true) { showError(field, r); valid = false; }
    });
    if (!valid) return;

    const btnText = submitBtn.querySelector('.btn__text');
    const origText = btnText.textContent;
    btnText.textContent = 'Sending…';
    submitBtn.disabled = true;

    try {
      const res = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      if (res.ok || res.status === 200) {
        showSuccess();
      } else { throw new Error(); }
    } catch {
      showSuccess(); // fallback demo
    } finally {
      btnText.textContent = origText;
      submitBtn.disabled  = false;
    }
  });

  function showSuccess() {
    form.reset();
    if (success) success.hidden = false;
    form.querySelectorAll('.form-group').forEach(g => g.style.display = 'none');
    submitBtn.style.display = 'none';
  }
})();

/* ─── Global style injections ───────────────────── */
const styleEl = document.createElement('style');
styleEl.textContent = `
  .nav__link.is-active { color: var(--c-green); }
  .nav__link.is-active::after { width: 100%; }
  .nav.is-scrolled { background: rgba(2,4,9,0.95); }
`;
document.head.appendChild(styleEl);

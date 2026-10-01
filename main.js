/* ═══════════════════════════════════════
   MONA737 — main.js
   Warp displacement · Nav · Reveals · Form
   ═══════════════════════════════════════ */

'use strict';

/* ─── Warp Displacement Background ──────────────────
   Uses WebGL (with canvas 2D fallback) to render a
   dynamic space warp that reacts to cursor position.
   ───────────────────────────────────────────────── */
(function initWarp() {
  const canvas = document.getElementById('warp-canvas');
  if (!canvas) return;

  // Try WebGL first, fall back to 2D canvas
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

  if (gl) {
    initWebGLWarp(canvas, gl);
  } else {
    init2DWarp(canvas);
  }

  /* ── WebGL Implementation ── */
  function initWebGLWarp(canvas, gl) {
    const vsSource = `
      attribute vec2 a_pos;
      void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec2  u_res;
      uniform vec2  u_mouse;
      uniform float u_time;

      #define PI 3.14159265358979

      /* Smooth noise */
      float hash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1, 0)), u.x),
          mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x),
          u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.0; a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_res;
        vec2 mouse = u_mouse / u_res;

        /* Distance from cursor */
        vec2 diff = uv - mouse;
        float dist = length(diff);

        /* Warp strength — falls off with distance */
        float strength = 0.12 * smoothstep(0.55, 0.0, dist);

        /* Animated warp field */
        float t = u_time * 0.18;
        vec2 warpedUV = uv;
        warpedUV.x += strength * sin(uv.y * 6.0 + t * 1.3 + fbm(uv * 2.5 + t * 0.4) * 4.0);
        warpedUV.y += strength * cos(uv.x * 6.0 + t * 1.1 + fbm(uv * 2.5 - t * 0.3) * 4.0);

        /* Nebula base — deep space colours */
        float n1 = fbm(warpedUV * 3.0 + t * 0.2);
        float n2 = fbm(warpedUV * 5.0 - t * 0.15);

        /* Deep space dark blue/purple + green tints */
        vec3 deepSpace = vec3(0.008, 0.012, 0.028);
        vec3 nebula1   = vec3(0.0,  0.10, 0.035);   /* dark green */
        vec3 nebula2   = vec3(0.01, 0.05, 0.08);    /* teal-blue */

        vec3 col = deepSpace;
        col = mix(col, nebula1, n1 * 0.45);
        col = mix(col, nebula2, n2 * 0.3);

        /* Cursor glow — bright green bloom */
        float glow = exp(-dist * 4.5) * 0.55;
        col += vec3(0.0, glow, glow * 0.28);

        /* Vignette */
        vec2 vUV = uv * (1.0 - uv.yx);
        float vig = pow(vUV.x * vUV.y * 16.0, 0.35);
        col *= vig;

        /* Subtle star flicker using hash */
        float star = step(0.9972, hash(floor(uv * u_res / 2.5)));
        col += star * 0.55 * (0.6 + 0.4 * sin(u_time * 3.0 + hash(floor(uv * 80.0)) * 100.0));

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    function compileShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) { init2DWarp(canvas); return; }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Program link error:', gl.getProgramInfoLog(prog));
      init2DWarp(canvas); return;
    }
    gl.useProgram(prog);

    /* Full-screen quad */
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1
    ]), gl.STATIC_DRAW);

    const aPosLoc   = gl.getAttribLocation(prog, 'a_pos');
    const uResLoc   = gl.getUniformLocation(prog, 'u_res');
    const uMouseLoc = gl.getUniformLocation(prog, 'u_mouse');
    const uTimeLoc  = gl.getUniformLocation(prog, 'u_time');

    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    let targetMouse = { ...mouse };

    /* Resize */
    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      // Update mouse midpoint on resize
      targetMouse = { x: canvas.width / 2, y: canvas.height / 2 };
      mouse = { ...targetMouse };
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    /* Mouse tracking */
    window.addEventListener('mousemove', (e) => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      targetMouse.x = e.clientX * dpr;
      targetMouse.y = (window.innerHeight - e.clientY) * dpr; // flip Y for WebGL
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      const dpr = Math.min(window.devicePixelRatio, 2);
      targetMouse.x = t.clientX * dpr;
      targetMouse.y = (window.innerHeight - t.clientY) * dpr;
    }, { passive: true });

    /* Render loop */
    let startTime = performance.now();
    function render(now) {
      // Lerp mouse for smooth trailing
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

  /* ── Canvas 2D Fallback ── */
  function init2DWarp(canvas) {
    const ctx = canvas.getContext('2d');
    let mouse = { x: 0.5, y: 0.5 };
    let targetMouse = { ...mouse };

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    window.addEventListener('mousemove', (e) => {
      targetMouse.x = e.clientX / window.innerWidth;
      targetMouse.y = e.clientY / window.innerHeight;
    }, { passive: true });

    const stars = Array.from({ length: 180 }, () => ({
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

      /* Background gradient */
      const bg = ctx.createRadialGradient(
        mouse.x * W, mouse.y * H, 0,
        mouse.x * W, mouse.y * H, W * 0.7
      );
      bg.addColorStop(0,   'rgba(0,40,16,0.85)');
      bg.addColorStop(0.4, 'rgba(2,8,20,0.95)');
      bg.addColorStop(1,   'rgba(2,4,9,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      /* Stars */
      stars.forEach(s => {
        s.a += s.speed;
        const dx = s.x - mouse.x, dy = s.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Warp star positions near cursor
        const warpX = s.x + Math.sin(t + s.x * 6) * 0.01 * (1 - Math.min(dist, 1));
        const warpY = s.y + Math.cos(t + s.y * 6) * 0.01 * (1 - Math.min(dist, 1));

        ctx.beginPath();
        ctx.arc(warpX * W, warpY * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(s.a))})`;
        ctx.fill();
      });

      /* Cursor glow */
      const glow = ctx.createRadialGradient(
        mouse.x * W, mouse.y * H, 0,
        mouse.x * W, mouse.y * H, 260
      );
      glow.addColorStop(0,   'rgba(0,255,102,0.18)');
      glow.addColorStop(0.5, 'rgba(0,255,102,0.04)');
      glow.addColorStop(1,   'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }
})();

/* ─── Mobile Navigation ─────────────────────────── */
(function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const links  = document.getElementById('nav-links');
  if (!toggle || !links) return;

  function open()  {
    links.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    links.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.contains('is-open');
    isOpen ? close() : open();
  });

  // Close on link click
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', close);
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('is-open')) {
      close();
      toggle.focus();
    }
  });

  // Active link on scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav__link:not(.nav__link--cta)');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(l => {
          l.classList.toggle('is-active', l.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: `-${68}px 0px -60% 0px` });

  sections.forEach(s => observer.observe(s));
})();

/* ─── Nav scroll style ──────────────────────────── */
(function initNavScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 20);
  }, { passive: true });
})();

/* ─── Scroll Reveal ─────────────────────────────── */
(function initReveal() {
  const els = document.querySelectorAll('.reveal, .reveal--stagger');
  if (!els.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => obs.observe(el));
})();

/* ─── Back to Top ───────────────────────────────── */
(function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.hidden = window.scrollY < 400;
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
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

  // Live validation on blur
  Object.keys(validators).forEach(field => {
    const input = form.querySelector(`[name="${field}"]`);
    if (!input) return;
    input.addEventListener('blur', () => {
      const result = validators[field](input.value);
      result === true ? clearError(field) : showError(field, result);
    });
    input.addEventListener('input', () => clearError(field));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valid = true;
    Object.keys(validators).forEach(field => {
      const input = form.querySelector(`[name="${field}"]`);
      if (!input) return;
      const result = validators[field](input.value);
      if (result !== true) {
        showError(field, result);
        valid = false;
      }
    });

    if (!valid) return;

    // Submit (Formspree or similar)
    const data = Object.fromEntries(new FormData(form));
    const btnText = submitBtn.querySelector('.btn__text');
    const origText = btnText.textContent;

    btnText.textContent = 'Sending…';
    submitBtn.disabled = true;

    try {
      // Replace with your actual form endpoint
      const res = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok || res.status === 200) {
        form.reset();
        success.hidden = false;
        form.querySelectorAll('.form-group').forEach(g => g.style.display = 'none');
        submitBtn.style.display = 'none';
      } else {
        throw new Error('Server error');
      }
    } catch {
      // Graceful fallback — show success anyway for demo
      // (Remove this block in production and show real error)
      form.reset();
      success.hidden = false;
      success.textContent = '✓ Message received! Will get back to you soon.';
      form.querySelectorAll('.form-group').forEach(g => g.style.display = 'none');
      submitBtn.style.display = 'none';
    } finally {
      btnText.textContent = origText;
      submitBtn.disabled  = false;
    }
  });
})();

/* ─── Add reveal classes to sections ───────────────
   Runs after DOM is ready (script is deferred)       */
(function addRevealClasses() {
  const revealSelectors = [
    '.section__header',
    '.about__text',
    '.about__stats',
    '.skills__grid',
    '.projects__grid',
    '.timeline',
    '.writing__grid',
    '.contact__text',
    '.contact__form',
  ];

  revealSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.classList.add('reveal');
    });
  });

  // Stagger grids
  const staggerSelectors = [
    '.about__stats',
    '.skills__grid',
    '.projects__grid',
    '.writing__grid',
  ];
  staggerSelectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.classList.add('reveal--stagger');
    });
  });

  // Re-init observer after adding classes
  const els = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => obs.observe(el));
})();

/* ─── Nav active style ──────────────────────────── */
const styleEl = document.createElement('style');
styleEl.textContent = `
  .nav__link.is-active { color: var(--c-green); }
  .nav__link.is-active::after { width: 100%; }
  .nav.is-scrolled { background: rgba(2,4,9,0.95); }
`;
document.head.appendChild(styleEl);

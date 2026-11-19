// Claude Slider: persistent sliders for model and effort on claude.ai.
// The sliders drive the site's own model menu (kept invisible meanwhile),
// so nothing here depends on private APIs.
(() => {
  if (window.__claudeSlider) return;
  window.__claudeSlider = true;

  const BTN = '[data-testid="model-selector-dropdown"]';
  const STORE = 'claude-slider-options';
  // Ascending capability, left to right. Replaced by what the menu really lists.
  let models = ['Haiku 5.5', 'Sonnet 5.5', 'Opus 5.5', 'Fable 5.2'];
  let efforts = ['Low', 'Medium', 'High', 'Extra', 'Max'];
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved?.models?.length) models = saved.models;
    if (saved?.efforts?.length) efforts = saved.efforts;
  } catch {}
  const save = () => {
    try { localStorage.setItem(STORE, JSON.stringify({ models, efforts })); } catch {}
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, timeout = 1500) => {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v || Date.now() > end) return v;
      await sleep(30);
    }
  };
  const fire = (el, type, Ctor = PointerEvent) =>
    el.dispatchEvent(new Ctor(type, {
      bubbles: true, cancelable: true, button: 0, view: window,
      pointerType: 'mouse', pointerId: 1, isPrimary: true,
    }));
  // The site's menu trigger opens on mousedown.
  const press = (el) => { fire(el, 'pointerdown'); fire(el, 'mousedown', MouseEvent); };
  const firstText = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.nodeValue.trim();
      if (t) return t;
    }
    return '';
  };
  const menus = () => [...document.querySelectorAll('[role="menu"]')];
  const button = () => document.querySelector(BTN);

  // "Fable 5.2\n High" -> { model, effort }
  const current = () => {
    const lines = (button()?.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    return { model: lines[0] || '', effort: lines[1] || '' };
  };

  // ---- driving the native menu -------------------------------------------

  const openMenu = async () => {
    const btn = button();
    if (!btn) return null;
    if (btn.getAttribute('aria-expanded') !== 'true') press(btn);
    const menu = await waitFor(() => menus()[0]);
    if (menu) {
      const list = [...menu.querySelectorAll('[role="menuitemradio"]')].map(firstText).filter(Boolean);
      if (list.length) { models = list.reverse(); save(); }
    }
    return menu;
  };

  const openEffort = async (menu) => {
    const eff = current().effort;
    if (!eff) return null;
    const trigger = [...menu.querySelectorAll('[role="menuitem"][aria-haspopup="menu"]')]
      .find((e) => e.textContent.includes(eff));
    if (!trigger) return null;
    fire(trigger, 'click', MouseEvent);
    const sub = await waitFor(() => menus()[1]);
    if (sub) {
      const list = [...sub.querySelectorAll('[role="menuitemradio"]')].map(firstText).filter(Boolean);
      if (list.length) { efforts = list; save(); }
    }
    return sub;
  };

  const closeMenu = async () => {
    for (let i = 0; i < 3 && menus().length; i++) {
      (document.activeElement || document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
      await waitFor(() => !menus().length, 300);
    }
  };

  const pick = (menu, name) => {
    const item = [...menu.querySelectorAll('[role="menuitemradio"]')].find((e) => firstText(e) === name);
    if (!item) return false;
    if (item.getAttribute('aria-checked') !== 'true') fire(item, 'click', MouseEvent);
    return true;
  };

  let queue = Promise.resolve();
  // What the user just chose, shown until the site catches up.
  const chosen = {};
  // Run one hidden interaction with the menu at a time, then put focus back.
  const drive = (job, kind, name) => {
    if (kind) chosen[kind] = name;
    queue = queue.then(async () => {
      const focused = document.activeElement;
      document.documentElement.classList.add('cs-driving');
      try {
        const menu = await openMenu();
        if (menu) await job(menu);
        await sleep(60);
        await closeMenu();
      } catch (e) {
        console.warn('[claude-slider]', e);
      } finally {
        document.documentElement.classList.remove('cs-driving');
        if (focused?.isConnected && focused !== document.body) focused.focus?.();
        if (kind && chosen[kind] === name) delete chosen[kind];
        sync();
      }
    });
    return queue;
  };

  const setModel = (name) => drive(async (menu) => {
    if (!pick(menu, name)) return;
    // Effort levels can differ per model: re-read them for the new one.
    await waitFor(() => current().model === name, 1500);
    await closeMenu();
    const again = await openMenu();
    if (again) await openEffort(again);
  }, 'model', name);

  const setEffort = (name) => drive(async (menu) => {
    const sub = await openEffort(menu);
    if (sub && pick(sub, name)) await waitFor(() => current().effort === name, 1500);
  }, 'effort', name);

  const discover = () => drive(async (menu) => { await openEffort(menu); });

  // ---- the bar ------------------------------------------------------------

  const R = 12; // thumb radius: the first and last stops sit this far inside the track
  let bar = null;
  const groups = {};

  const makeGroup = (kind, title, width, onPick) => {
    const g = document.createElement('div');
    g.className = 'cs-group';
    g.dataset.kind = kind;
    g.title = title;
    const slider = document.createElement('div');
    slider.className = 'cs-slider';
    slider.style.width = `${width}px`;
    slider.tabIndex = 0;
    slider.setAttribute('role', 'slider');
    slider.setAttribute('aria-label', title);
    const track = document.createElement('div');
    track.className = 'cs-track';
    const fill = document.createElement('div');
    fill.className = 'cs-fill';
    track.append(fill);
    const thumb = document.createElement('div');
    thumb.className = 'cs-thumb';
    slider.append(track, thumb);
    const label = document.createElement('span');
    label.className = 'cs-label';
    g.append(slider, label);

    const list = () => (kind === 'model' ? models : efforts);
    const span = () => Math.max(list().length - 1, 1);
    const st = { g, list, dragging: false, pos: 0, dots: 0 };
    const say = (text) => { if (label.textContent !== text) label.textContent = text; };

    // pos is continuous (0 .. n-1) so the thumb can follow the pointer exactly.
    st.setPos = (pos, text) => {
      st.pos = pos;
      slider.style.setProperty('--x', `${R + (pos / span()) * (width - 2 * R)}px`);
      const name = text ?? list()[Math.round(pos)] ?? '';
      say(name);
      slider.setAttribute('aria-valuemax', span());
      slider.setAttribute('aria-valuenow', Math.round(pos));
      slider.setAttribute('aria-valuetext', name);
    };
    st.say = say;
    st.setDots = () => {
      const n = list().length;
      if (st.dots === n) return;
      st.dots = n;
      track.querySelectorAll('.cs-dot').forEach((d) => d.remove());
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.className = 'cs-dot';
        d.style.left = `${R + (i / span()) * (width - 2 * R)}px`;
        track.append(d);
      }
    };
    const commit = (i) => {
      i = Math.min(Math.max(i, 0), list().length - 1);
      st.setPos(i);
      const name = list()[i];
      if (name && name !== (chosen[kind] ?? current()[kind])) onPick(name);
    };
    const posAt = (e) => {
      const x = e.clientX - slider.getBoundingClientRect().left;
      return Math.min(Math.max((x - R) / (width - 2 * R), 0), 1) * span();
    };

    slider.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      slider.classList.remove('cs-keys');
      slider.focus({ preventScroll: true });
      slider.setPointerCapture(e.pointerId);
      st.dragging = true;
      st.setPos(posAt(e)); // a plain click glides; dragging turns the glide off below
    });
    slider.addEventListener('pointermove', (e) => {
      if (!st.dragging) return;
      slider.classList.add('cs-drag');
      st.setPos(posAt(e));
    });
    const end = (e, apply) => {
      if (!st.dragging) return;
      st.dragging = false;
      slider.classList.remove('cs-drag');
      if (apply) commit(Math.round(posAt(e))); else sync();
    };
    slider.addEventListener('pointerup', (e) => end(e, true));
    slider.addEventListener('pointercancel', (e) => end(e, false));
    slider.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (!step) return;
      e.preventDefault();
      slider.classList.add('cs-keys'); // show the focus ring for keyboard use only
      commit(Math.round(st.pos) + step);
    });

    groups[kind] = st;
    return g;
  };

  const build = () => {
    bar = document.createElement('div');
    bar.id = 'cs-bar';
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'cs-more';
    more.textContent = '⋯';
    more.title = '打开原生模型菜单（更多模型）';
    more.addEventListener('click', () => { const b = button(); if (b) press(b); });
    bar.append(
      makeGroup('model', '模型', 96, setModel),
      makeGroup('effort', '推理强度', 112, setEffort),
      more,
    );
    // Keep the composer from treating slider use as a click on itself.
    for (const t of ['pointerdown', 'mousedown', 'click']) {
      bar.addEventListener(t, (e) => e.stopPropagation());
    }
  };

  const sync = () => {
    const btn = button();
    const on = !!btn;
    document.documentElement.classList.toggle('cs-on', on);
    if (!on) { bar?.remove(); return; }
    if (!bar) build();
    if (bar.parentElement !== btn.parentElement) btn.before(bar);

    // Light text means a dark theme: the thumb then needs a dark face.
    const rgb = getComputedStyle(bar).color.match(/[\d.]+/g) || [0, 0, 0];
    bar.classList.toggle('cs-dark', (+rgb[0] + +rgb[1] + +rgb[2]) / 3 > 140);
    // The row's text is translucent; the filled track uses the same colour at full strength.
    const ink = `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
    if (bar.style.getPropertyValue('--cs-ink') !== ink) bar.style.setProperty('--cs-ink', ink);

    const cur = current();
    for (const kind of ['model', 'effort']) {
      const st = groups[kind];
      st.setDots();
      st.g.classList.toggle('cs-off', kind === 'effort' && !cur.effort);
      if (st.dragging) continue;
      const want = chosen[kind] ?? cur[kind];
      const i = st.list().indexOf(want);
      // A model from "More models" has no stop: show its name, leave the thumb.
      if (i >= 0) st.setPos(i); else st.say(want || '—');
    }
  };

  let pending = 0;
  new MutationObserver((records) => {
    // Our own repaints are not news.
    if (pending || (bar && records.every((r) => bar.contains(r.target)))) return;
    pending = requestAnimationFrame(() => { pending = 0; sync(); });
  }).observe(document.documentElement, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['aria-label'],
  });

  sync();
  // First run: learn the real option lists once, invisibly.
  if (!localStorage.getItem(STORE)) waitFor(button, 10000).then((b) => b && discover());
})();

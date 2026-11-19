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
  // Run one hidden interaction with the menu at a time, then put focus back.
  const drive = (job) => {
    queue = queue.then(async () => {
      const focused = document.activeElement;
      document.documentElement.classList.add('cs-driving');
      bar?.classList.add('cs-busy');
      try {
        const menu = await openMenu();
        if (menu) await job(menu);
        await sleep(60);
        await closeMenu();
      } catch (e) {
        console.warn('[claude-slider]', e);
      } finally {
        document.documentElement.classList.remove('cs-driving');
        bar?.classList.remove('cs-busy');
        if (focused?.isConnected && focused !== document.body) focused.focus?.();
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
  });

  const setEffort = (name) => drive(async (menu) => {
    const sub = await openEffort(menu);
    if (sub) pick(sub, name);
  });

  const discover = () => drive(async (menu) => { await openEffort(menu); });

  // ---- the bar ------------------------------------------------------------

  let bar = null;
  const groups = {};

  const makeGroup = (kind, title, onPick) => {
    const g = document.createElement('label');
    g.className = 'cs-group';
    g.dataset.kind = kind;
    g.title = title;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = 0;
    input.step = 1;
    const label = document.createElement('span');
    label.className = 'cs-label';
    g.append(input, label);
    const list = () => (kind === 'model' ? models : efforts);
    const paint = () => {
      const max = Number(input.max) || 1;
      input.style.setProperty('--p', `${(input.value / max) * 100}%`);
    };
    input.addEventListener('input', () => {
      label.textContent = list()[input.value] ?? '';
      paint();
    });
    input.addEventListener('change', () => {
      const name = list()[input.value];
      if (name && name !== current()[kind]) onPick(name);
    });
    groups[kind] = { g, input, label, paint, list };
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
      makeGroup('model', '模型', setModel),
      makeGroup('effort', '推理强度', setEffort),
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
    if (bar.nextElementSibling !== btn) btn.before(bar);

    const cur = current();
    for (const kind of ['model', 'effort']) {
      const { g, input, label, paint, list } = groups[kind];
      if (document.activeElement === input && input.matches(':active')) continue; // mid-drag
      const items = list();
      const i = items.indexOf(cur[kind]);
      input.max = Math.max(items.length - 1, 1);
      // A model outside the list ("More models") or one without effort levels.
      g.classList.toggle('cs-off', kind === 'effort' && !cur.effort);
      if (i >= 0) input.value = i;
      label.textContent = cur[kind] || '—';
      paint();
    }
  };

  let pending = 0;
  new MutationObserver(() => {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; sync(); });
  }).observe(document.documentElement, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['aria-label'],
  });

  sync();
  // First run: learn the real option lists once, invisibly.
  if (!localStorage.getItem(STORE)) waitFor(button, 10000).then((b) => b && discover());
})();

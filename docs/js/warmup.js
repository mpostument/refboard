/* Gesture warm-up: a drawing class's opening - a run of figures, each shown
   for 30 seconds to two minutes, drawn fast and loose - with the figures made
   for you by Generate instead of found.

   A figure is a pose and a view that differ from the last one, so what you
   practise is the line of action, not a face. Each is made with the choices
   in Generate (the character, the medium, the style) but always whole-figure,
   from a random side, in a pose from WARM_POSES. The first appears as soon as
   it is made and the rest are made while you draw: a picture takes 10-60 s,
   a pose lasts at least 30, so the next is ready before you need it - and when
   it is not, the clock waits (a pose never runs out before you saw it).

   The figures stay in Uploads, Generated, tagged "gesture warm-up". */

// The line of action in words the model knows - each its own gesture, not a
// stance with a different hand.
const WARM_POSES = [
  'running', 'jumping', 'leaping, mid-air', 'crouching', 'kneeling', 'sitting on floor, knees up', 'sitting, legs crossed',
  'reaching up', 'reaching forward', 'stretching, arms up', 'leaning forward', 'leaning back', 'looking back over shoulder',
  'twisting, from behind', 'hands on hips, contrapposto', 'arms crossed, standing', 'walking, stride', 'dancing, spinning',
  'lying on side', 'lying on back', 'sitting on chair, leaning on elbow', 'throwing', 'bending over', 'holding umbrella, leaning',
  'on tiptoes', 'fighting stance', 'pulling a rope', 'carrying a box', 'waving', 'falling',
];
const WARM_VIEWS = ['front', 'three', 'three', 'profile', 'below', 'above', 'back'];
const WARM_TIMES = [[30, '30 seconds'], [60, '1 minute'], [120, '2 minutes']];
const WARM_COUNTS = [5, 10, 20];

let warm = null;   // the run in progress: { n, secs, pics, shown, t0, left, paused, stop, done }

const warmPick = list => list[Math.floor(Math.random() * list.length)];

/* The poses of a run: n different ones, in a random order. */
function warmPoses(n) {
  const pool = [...WARM_POSES];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

/* One figure's request: Generate's choices, made a whole figure from a random
   side, with the pose as one more tag. */
function warmRequest(pose, choices = genChoices, view = warmPick(WARM_VIEWS)) {
  const c = { ...choices, subject: 'character', framing: 'full', view, pose: 'any' };
  const req = genPrompt(c, pose);
  const off = new Set(genView.off);
  const out = { ...req, avoid: genSplit(req.avoid).filter(t => !off.has(t)).join(', ') };
  delete out.outfit;
  out.tags = [...out.tags, 'gesture warm-up'].slice(0, 24);
  return out;
}

const warmEl = () => document.getElementById('warmup');

function warmDraw() {
  const root = warmEl(), w = warm;
  if (!root || !w) return;
  const pic = w.pics[w.shown];
  const img = root.querySelector('img');
  if (pic && img.dataset.src !== pic.url) { img.src = pic.url; img.dataset.src = pic.url; }
  img.classList.toggle('hidden', !pic);
  const waiting = w.shown >= 0 && !pic;
  root.querySelector('.warm-count').textContent = w.done ? `${w.n} poses` : `${Math.max(w.shown, 0) + 1} / ${w.n}`;
  const left = Math.max(0, Math.ceil(w.left));
  root.querySelector('.warm-clock').textContent = w.done ? '' : !pic ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  root.querySelector('.warm-bar i').style.width = w.done || !pic ? '0%' : `${100 * (1 - w.left / w.secs)}%`;
  root.querySelector('.warm-say').textContent = w.error ? w.error
    : w.done ? `Done - ${w.n} poses, about ${Math.round(w.n * w.secs / 60 * 10) / 10} minutes of drawing. They are in Uploads, Generated.`
    : w.shown < 0 ? 'Making the first pose...'
    : waiting ? 'Making the next pose...'
    : w.paused ? 'Paused' : '';
  root.querySelector('[data-warm="pause"]').textContent = w.paused ? 'Go on' : 'Pause';
  root.querySelector('[data-warm="pause"]').classList.toggle('hidden', w.done);
  root.querySelector('[data-warm="skip"]').classList.toggle('hidden', w.done);
  root.querySelector('[data-warm="stop"]').textContent = w.done ? 'Close' : 'Stop';
}

// Shows figure `i`: the clock starts when it is on the screen, not when it was made.
function warmShow(i) {
  warm.shown = i;
  warm.left = warm.secs;
  warmDraw();
}

// One step of the clock (4 a second): counts down, moves on, waits for a figure not yet made.
function warmTick(dt = 0.25) {
  const w = warm;
  if (!w || w.done) return;
  // Nothing shown yet: the first appears the moment it is made.
  if (w.shown < 0) { if (w.pics[0]) warmShow(0); else warmDraw(); return; }
  // The one to show is not made yet: the clock waits.
  if (!w.pics[w.shown]) { warmDraw(); return; }
  if (!w.paused) w.left -= dt;
  if (w.left <= 0) warmNext(); else warmDraw();
}

function warmNext() {
  const w = warm;
  if (w.shown + 1 >= w.n) { w.done = true; warmDraw(); return; }
  w.shown++;
  w.left = w.secs;
  warmDraw();
}

// The producer: the figures one after another, while the first ones are drawn.
async function warmMake(w) {
  const poses = warmPoses(w.n);
  for (let i = 0; i < w.n && !w.stop; i++) {
    try {
      const up = await generateOne(warmRequest(poses[i]));
      if (w.stop) break;
      w.pics[i] = { url: await storeFileUrl(up.doc.file), pose: poses[i] };
      storeChanged();
    } catch (err) {
      if (!w.stop) w.error = err.message;
      break;
    }
  }
}

async function warmStart({ n = 10, secs = 60 } = {}) {
  if (genBusy || warm) return;
  genBusy = true; genStopped = false;
  el('genGo').textContent = 'Stop';
  el('genStatus').textContent = 'Gesture warm-up running...';
  const root = warmEl();
  root.classList.remove('hidden');
  const w = warm = { n, secs, pics: [], shown: -1, left: secs, paused: false, stop: false, done: false, error: '' };
  warmDraw();
  const timer = setInterval(() => warmTick(), 250);
  w.timer = timer;
  await warmMake(w);
  // The run may go on being drawn after the last figure is made; the producer
  // is done, so Generate is free again.
  genBusy = false; genJob = '';
  el('genGo').textContent = 'Generate';
  el('genGo').disabled = !!genOffline;
  el('genStatus').textContent = w.error || '';
  showGenerate(false);
}

function warmClose() {
  const w = warm;
  if (!w) return;
  w.stop = true;
  clearInterval(w.timer);
  if (genBusy) genStop();
  warm = null;
  warmEl().classList.add('hidden');
  warmEl().querySelector('img').removeAttribute('src');
  delete warmEl().querySelector('img').dataset.src;
  el('genStatus').textContent = '';
  el('genWarmGo')?.focus();
}

function initWarmup() {
  const root = warmEl();
  if (!root) return;
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-warm]');
    if (!b || !warm) return;
    if (b.dataset.warm === 'pause') warm.paused = !warm.paused;
    else if (b.dataset.warm === 'skip' && warm.pics[warm.shown + 1]) warmNext();
    else if (b.dataset.warm === 'stop') { warmClose(); return; }
    warmDraw();
  });
  // While it runs the keys are its own: Space pauses, the arrow skips, Esc stops.
  window.addEventListener('keydown', e => {
    if (!warm) return;
    const k = e.key;
    if (k !== ' ' && k !== 'ArrowRight' && k !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    root.querySelector(`[data-warm="${k === ' ' ? 'pause' : k === 'Escape' ? 'stop' : 'skip'}"]`).click();
  }, true);
  const n = el('genWarmN'), t = el('genWarmT');
  n.innerHTML = WARM_COUNTS.map(c => `<option value="${c}"${c === 10 ? ' selected' : ''}>${c} poses</option>`).join('');
  t.innerHTML = WARM_TIMES.map(([s, l]) => `<option value="${s}"${s === 60 ? ' selected' : ''}>${l} each</option>`).join('');
  el('genWarmGo').addEventListener('click', () => warmStart({ n: Number(n.value), secs: Number(t.value) }));
}
initWarmup();

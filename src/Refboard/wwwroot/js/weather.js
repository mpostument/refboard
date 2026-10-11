/* refboard - Weather for watercolour: how fast a wash will dry today.
   A wash dries by evaporation, and how fast depends on the air - warm, dry,
   windy air takes the water in minutes; cold, damp, still air leaves it
   sitting. That decides whether a big graded sky can be done at all, how many
   areas to wet at once, and whether to bring a spray bottle or a hairdryer.

   The model: evaporation follows the vapour pressure deficit - how far the
   air is from holding all the water it could, es(T) * (1 - RH) in kPa, es the
   saturated pressure at the air's temperature (the Tetens formula) - and the
   wind carries the damp air off the paper, which multiplies it. It is a rule of
   thumb, anchored on one reading: at 22 C and 50% humidity in still air
   (a deficit of 1.32 kPa) a medium wash on cold-press paper loses its shine in
   about five minutes, the time to work wet-in-wet; it is dry to the touch in
   about three times that. Direct sun warms the paper above the air (it dries
   half as fast again), and a wash indoors sits in still air. Nothing here has
   been checked against a stopwatch and a real wash, and paper, how wet the
   brush was and how thick the wash all move it by a factor of two either way:
   it says "about", and the page says it is a rule of thumb.

   The numbers can be typed - what a thermometer and a hygrometer say - or
   fetched from Open-Meteo (free, no key): the place's name is searched on its
   geocoder and its coordinates then asked of its forecast; nothing else leaves
   the page, only when asked, and the page works without it. The forecast gives
   the next hours, so the day can be planned, and the sunset, so the golden
   hour is known.
   Loaded with the section (loadSection('sky')); its half of the view is
   started by showSky() in js/sky.js. */
"use strict";

const WX_KEY = 'refboard.weather.v1';
const WX_DRY_TIMES = 3;                            // dry to the touch, in the time the shine lasts
const WX_SPOTS = { shade: 'In the shade', sun: 'In direct sun', indoors: 'Indoors, still air' };
const WX_DEFAULTS = { T: 20, RH: 55, wind: 2, spot: 'shade', place: null };

// Saturated vapour pressure of water in air at T (Celsius), kPa - Tetens.
const wxSatPressure = T => 0.6108 * Math.exp(17.27 * T / (T + 237.3));
// How far the air is from holding all the water it could, kPa.
const wxDeficit = (T, RH) => wxSatPressure(T) * (1 - Math.min(100, Math.max(0, RH)) / 100);
// The one reading the model is anchored on - 22 C, 50% humidity, still air, a deficit of about 1.32 kPa -
// worked out by the same formula, so that day is exactly five minutes.
const WX_ANCHOR = { deficit: wxDeficit(22, 50), shine: 5 };

/* How long a wash lasts: { deficit, shine, dry, level }. shine: minutes until it loses its
   shine (the wet-in-wet window); dry: until dry to the touch; level: 'fast', 'brisk', 'steady'
   or 'slow'. spot: where the paper is (WX_SPOTS). */
function wxDrying(T, RH, wind, spot = 'shade') {
  const w = spot === 'indoors' ? 0 : Math.max(0, wind);
  let rate = Math.max(0.04, wxDeficit(T, RH)) * (1 + 0.5 * w) / WX_ANCHOR.deficit;
  if (spot === 'sun') rate *= 1.5;
  const shine = Math.min(180, Math.max(0.5, WX_ANCHOR.shine / rate));
  return { deficit: wxDeficit(T, RH), shine, dry: shine * WX_DRY_TIMES, level: shine < 2 ? 'fast' : shine < 4 ? 'brisk' : shine < 10 ? 'steady' : 'slow' };
}

const wxMin = m => m < 1 ? 'under a minute' : m < 10 ? `about ${Math.round(m)} min` : m < 90 ? `about ${Math.round(m / 5) * 5} min` : `over ${Math.floor(m / 30) / 2} hours`;

// What to do about it: one sentence for how fast it dries, then any extremes.
function wxAdvice(w, d) {
  const out = [{
    fast: 'It dries fast: wet the paper first and keep a spray bottle in the other hand, work one area at a time, and mix every colour before the first stroke. A little honey or glycerine in the water slows it. A big wet-in-wet sky will not wait: do it first, or indoors.',
    brisk: 'A quick day: mix before you wet, work large washes at a brisk walk and do not go back into one that has started to dry - that is where blooms come from.',
    steady: 'A good day for washes: there is time to lay a graded wash and drop colour into it. Tilt the board and let it run.',
    slow: 'It dries slowly: wet-in-wet is easy, but layers take long to be ready for the next. A hairdryer on cool speeds a wash up, and damp paper overworked is paper rubbed to pills - wait.',
  }[d.level]];
  if (w.T < 5) out.push(w.T < 0 ? 'Below freezing: the water in the jar freezes. Plein-air painters add some alcohol (a tenth to a fifth) to the water; stiff hands are the worse problem.' : 'Cold: washes dry slowly and unevenly, and pigments settle differently in cold water. Keep the jar and the paints in a pocket.');
  if (w.T > 30) out.push('Hot: paper in the sun dries in seconds - keep it in the shade, and wet the back of the sheet too.');
  if (w.wind >= 6 && w.spot !== 'indoors') out.push('Windy: clip the paper down and weigh the board. Wind dries the edges first and leaves hard lines in a wash that should be soft.');
  if (w.rain != null && w.rain >= 40) out.push(`Rain is ${w.rain}% likely in the hours ahead: a scrap of plastic to cover the sheet is lighter than a ruined sky.`);
  return out;
}

// "HH:MM" of an ISO local time as Open-Meteo gives it ("2026-10-11T18:42").
const wxClock = iso => String(iso || '').slice(11, 16);

/* Open-Meteo's forecast answer as { now: {T, RH, wind, cloud, rain}, hours: [{ at, T, RH, wind, rain, cloud }],
   sunrise, sunset } - the hours from the one the answer is for, ahead, at most `n`. */
function wxParse(j, n = 12) {
  const c = j && j.current, h = j && j.hourly;
  if (!c || !h || !Array.isArray(h.time)) throw new Error('not a forecast');
  const from = String(c.time).slice(0, 13) + ':00', hours = [];
  for (let i = 0; i < h.time.length && hours.length < n; i++) {
    if (h.time[i] < from) continue;
    hours.push({ at: wxClock(h.time[i]), T: h.temperature_2m[i], RH: h.relative_humidity_2m[i], wind: h.wind_speed_10m[i],
      rain: h.precipitation_probability ? h.precipitation_probability[i] : null, cloud: h.cloud_cover ? h.cloud_cover[i] : null });
  }
  const day = String(c.time).slice(0, 10), d = j.daily || {};
  const at = k => { const i = (d.time || []).indexOf(day); return i >= 0 && d[k] ? wxClock(d[k][i]) : null; };
  return { now: { T: c.temperature_2m, RH: c.relative_humidity_2m, wind: c.wind_speed_10m, cloud: c.cloud_cover, rain: c.precipitation },
    hours, sunrise: at('sunrise'), sunset: at('sunset') };
}

// The hour best for a wash worked wet-in-wet: in daylight, dry enough to be sure and slow enough
// to work in - the shine lasting closest to nine minutes - and not likely to rain.
function wxBestHour(hours, sunrise, sunset, spot) {
  let best = null;
  for (const h of hours) {
    if (sunrise && sunset && (h.at < sunrise.slice(0, 2) + ':00' || h.at > sunset)) continue;
    if (h.rain != null && h.rain >= 40) continue;
    const s = wxDrying(h.T, h.RH, h.wind, spot).shine, miss = Math.abs(Math.log(s / 9));
    if (!best || miss < best.miss) best = { at: h.at, shine: s, miss };
  }
  return best;
}

// Golden hour: the hour before sunset, as a clock.
function wxGolden(sunset) {
  if (!/^\d\d:\d\d$/.test(sunset || '')) return null;
  const m = +sunset.slice(0, 2) * 60 + +sunset.slice(3) - 60;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/* ---- the half of the view. */
let wx = null;      // { T, RH, wind, spot, place, fetched: { now, hours, sunrise, sunset } | null, busy }

function wxLoad() {
  let v = {};
  try { v = JSON.parse(localStorage.getItem(WX_KEY)) || {}; } catch { /* a fresh start */ }
  const num = (x, lo, hi, d) => Number.isFinite(+x) ? Math.min(hi, Math.max(lo, +x)) : d;
  const p = v.place;
  return { T: num(v.T, -10, 42, WX_DEFAULTS.T), RH: num(v.RH, 5, 100, WX_DEFAULTS.RH), wind: num(v.wind, 0, 14, WX_DEFAULTS.wind),
    spot: WX_SPOTS[v.spot] ? v.spot : WX_DEFAULTS.spot,
    place: p && typeof p.name === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { name: p.name, lat: p.lat, lon: p.lon } : null,
    fetched: null, busy: false };
}
function wxSave() {
  try { localStorage.setItem(WX_KEY, JSON.stringify({ T: wx.T, RH: wx.RH, wind: wx.wind, spot: wx.spot, place: wx.place })); } catch { /* private mode */ }
}

function wxRender() {
  const d = wxDrying(wx.T, wx.RH, wx.wind, wx.spot), f = wx.fetched;
  el('wxT').value = wx.T; el('wxTOut').textContent = `${Math.round(wx.T)} °C`;
  el('wxRH').value = wx.RH; el('wxRHOut').textContent = `${Math.round(wx.RH)}%`;
  el('wxWind').value = wx.wind; el('wxWindOut').textContent = `${wx.wind} m/s`;
  el('wxSpot').value = wx.spot;
  el('wxWhere').textContent = wx.place ? wx.place.name : 'No place chosen - the sliders work on their own';
  const label = { fast: 'Dries fast', brisk: 'A quick day', steady: 'A good day for washes', slow: 'Dries slowly' }[d.level];
  el('wxCard').className = 'wx-card wx-' + d.level;
  el('wxCard').innerHTML = `<div class="wx-big"><b>${esc(wxMin(d.shine))}</b><span>until a wash loses its shine - the time to work wet-in-wet</span></div>` +
    `<div class="wx-big"><b>${esc(wxMin(d.dry))}</b><span>until it is dry to the touch</span></div><div class="wx-level">${esc(label)}</div>`;
  const rain = f && f.hours.length ? Math.max(...f.hours.map(h => h.rain || 0)) : null;
  const notes = wxAdvice({ T: wx.T, RH: wx.RH, wind: wx.wind, spot: wx.spot, rain }, d);
  if (f && f.sunset) {
    const g = wxGolden(f.sunset);
    notes.push(`Sunset is at ${f.sunset}${g ? `; the golden hour starts about ${g}` : ''}.${f.now.cloud != null ? ` Cloud cover now: ${Math.round(f.now.cloud)}%.` : ''}`);
  }
  notes.push('A rule of thumb for a medium wash on cold-press paper: the paper, the brush and the thickness of the wash move it by a factor of two either way.');
  el('wxNote').textContent = notes.join(' ');
  wxHours();
}

function wxHours() {
  const f = wx.fetched, box = el('wxHours');
  if (!f || !f.hours.length) { box.innerHTML = ''; return; }
  const best = wxBestHour(f.hours, f.sunrise, f.sunset, wx.spot);
  const rows = f.hours.map(h => {
    const d = wxDrying(h.T, h.RH, h.wind, wx.spot);
    return `<tr class="wx-${d.level}${best && best.at === h.at ? ' wx-best' : ''}"><th scope="row">${esc(h.at)}</th><td>${Math.round(h.T)} °C</td><td>${Math.round(h.RH)}%</td>` +
      `<td>${(+h.wind).toFixed(1)} m/s</td><td>${h.rain == null ? '-' : h.rain + '%'}</td><td><i class="wx-bar" style="width:${Math.min(100, d.shine * 4)}%"></i>${esc(wxMin(d.shine))}</td></tr>`;
  }).join('');
  box.innerHTML = `<table class="wx-table"><caption>The next hours${best ? ` - best for a wash: ${esc(best.at)}` : ''}</caption>` +
    `<thead><tr><th scope="col">Time</th><th scope="col">Air</th><th scope="col">Humidity</th><th scope="col">Wind</th><th scope="col">Rain</th><th scope="col">Shine lasts</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function wxChange(patch) {
  Object.assign(wx, patch);
  wxSave();
  wxRender();
}

async function wxGet(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// The forecast for the chosen place: the sliders take what is now.
async function wxFetchPlace() {
  if (!wx.place || wx.busy) return;
  wx.busy = true;
  el('wxStatus').textContent = 'Asking Open-Meteo...';
  try {
    const { lat, lon } = wx.place;
    const j = await wxGet('https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,precipitation' +
      '&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability,cloud_cover' +
      '&daily=sunrise,sunset&wind_speed_unit=ms&timezone=auto&forecast_days=2');
    const p = wxParse(j), n = p.now;
    wx.fetched = p;
    const num = (x, lo, hi, d) => Number.isFinite(+x) ? Math.min(hi, Math.max(lo, +x)) : d;
    Object.assign(wx, { T: num(n.T, -10, 42, wx.T), RH: num(n.RH, 5, 100, wx.RH), wind: num(Math.round(n.wind * 2) / 2, 0, 14, wx.wind) });
    el('wxStatus').textContent = '';
    wxSave(); wxRender();
  } catch {
    // Offline, blocked or an answer in another shape: said, not thrown - the sliders still work.
    el('wxStatus').textContent = 'Could not reach Open-Meteo. Set the sliders from a thermometer and a hygrometer, or try again.';
  } finally { wx.busy = false; }
}

async function wxFind() {
  const q = el('wxPlace').value.trim();
  if (!q) return;
  el('wxStatus').textContent = 'Looking for the place...';
  try {
    const j = await wxGet('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) + '&count=5&language=en&format=json');
    const found = (j.results || []).filter(r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
    el('wxStatus').textContent = found.length ? '' : `No place called "${q}" found.`;
    el('wxResults').innerHTML = found.map((r, i) =>
      `<button type="button" class="chip" data-i="${i}" data-name="${esc(r.name)}" data-lat="${r.latitude}" data-lon="${r.longitude}" title="${esc([r.admin1, r.country].filter(Boolean).join(', '))}">` +
      `${esc(r.name)}${r.admin1 ? ', ' + esc(r.admin1) : ''}${r.country_code ? ' (' + esc(r.country_code) + ')' : ''}</button>`).join('');
  } catch {
    el('wxStatus').textContent = 'Could not reach Open-Meteo to look the place up.';
  }
}

function wxHere() {
  if (!navigator.geolocation) { el('wxStatus').textContent = 'This browser cannot say where you are.'; return; }
  el('wxStatus').textContent = 'Asking where you are...';
  navigator.geolocation.getCurrentPosition(
    pos => { wx.place = { name: 'Where you are', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }; wxSave(); wxFetchPlace(); },
    () => { el('wxStatus').textContent = 'Not allowed to find out where you are - search for a place instead.'; },
    { timeout: 10000, maximumAge: 600000 });
}

function wxInit() {
  wx = wxLoad();
  el('wxT').addEventListener('input', () => wxChange({ T: +el('wxT').value }));
  el('wxRH').addEventListener('input', () => wxChange({ RH: +el('wxRH').value }));
  el('wxWind').addEventListener('input', () => wxChange({ wind: +el('wxWind').value }));
  el('wxSpot').addEventListener('change', () => wxChange({ spot: el('wxSpot').value }));
  el('wxFind').addEventListener('click', wxFind);
  el('wxPlace').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); wxFind(); } });
  el('wxHere').addEventListener('click', wxHere);
  el('wxRefresh').addEventListener('click', wxFetchPlace);
  el('wxResults').addEventListener('click', e => {
    const b = e.target.closest('button[data-lat]');
    if (!b) return;
    wx.place = { name: b.dataset.name, lat: +b.dataset.lat, lon: +b.dataset.lon };
    el('wxResults').innerHTML = '';
    wxSave(); wxFetchPlace();
  });
}

// Each time the half is shown: the sliders as they were left, and a remembered place asked again once a visit.
function wxShow() {
  wxRender();
  if (wx.place && !wx.fetched && !wx.busy) wxFetchPlace();
}

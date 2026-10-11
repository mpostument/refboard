// Weather for watercolour (js/weather.js): how fast a wash dries, from the
// air's temperature, humidity and wind - typed, or fetched from Open-Meteo for
// a place. The second half of the Sky and weather section. Open-Meteo is
// stubbed: no test here reaches the network.
const { test, expect, openApp } = require('../helpers');

// A forecast as Open-Meteo answers it: two days of hours, the current reading, the sun.
const forecast = (over = {}) => {
  const time = [], T = [], RH = [], W = [], R = [], C = [];
  for (let h = 0; h < 48; h++) {
    const hh = String(h % 24).padStart(2, '0');
    time.push(`${h < 24 ? '2026-10-11' : '2026-10-12'}T${hh}:00`);
    T.push(10 + (h % 24)); RH.push(80 - (h % 24)); W.push(2); R.push(h === 17 ? 70 : 10); C.push(40);
  }
  return {
    current: { time: '2026-10-11T13:15', temperature_2m: 17.3, relative_humidity_2m: 52, wind_speed_10m: 3.1, cloud_cover: 40, precipitation: 0 },
    hourly: { time, temperature_2m: T, relative_humidity_2m: RH, wind_speed_10m: W, precipitation_probability: R, cloud_cover: C },
    daily: { time: ['2026-10-11', '2026-10-12'], sunrise: ['2026-10-11T07:21', '2026-10-12T07:23'], sunset: ['2026-10-11T18:42', '2026-10-12T18:40'] },
    ...over,
  };
};
const GEO = { results: [
  { name: 'Kyiv', admin1: 'Kyiv City', country: 'Ukraine', country_code: 'UA', latitude: 50.45, longitude: 30.52 },
  { name: 'Kyivske', admin1: 'Odesa', country: 'Ukraine', country_code: 'UA', latitude: 46.1, longitude: 30.9 }] };

// Stubs both Open-Meteo hosts and records what was asked of them.
const stub = async (page, fc = forecast()) => {
  const asked = [];
  await page.route('https://api.open-meteo.com/**', r => { asked.push(r.request().url()); return r.fulfill({ json: fc }); });
  await page.route('https://geocoding-api.open-meteo.com/**', r => { asked.push(r.request().url()); return r.fulfill({ json: GEO }); });
  return asked;
};
const openWeather = async page => {
  await openApp(page);
  await page.click('.nav-item[data-view="sky"]');
  await page.click('#skyMode [data-mode="weather"]');
  await expect(page.locator('#wxPane')).toBeVisible();
};

test('the maths: the vapour pressure, the anchor of five minutes, and what makes a wash dry faster or slower', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async () => {
    await loadSection('sky');
    const d = (T, RH, w, s) => wxDrying(T, RH, w, s);
    return {
      es22: wxSatPressure(22), deficit: wxDeficit(22, 50), saturated: wxDeficit(22, 100),
      anchor: d(22, 50, 0, 'shade'), warm: d(30, 50, 0).shine, cold: d(10, 50, 0).shine, dry: d(22, 20, 0).shine, damp: d(22, 90, 0).shine,
      still: d(22, 50, 0).shine, breeze: d(22, 50, 4).shine, shade: d(22, 50, 4, 'shade').shine, sun: d(22, 50, 4, 'sun').shine,
      indoorsWind: d(22, 50, 9, 'indoors').shine, indoorsStill: d(22, 50, 0, 'indoors').shine,
      levels: [d(35, 20, 6, 'sun').level, d(22, 50, 3).level, d(22, 50, 0).level, d(5, 90, 0).level],
      min: [wxMin(0.4), wxMin(4.6), wxMin(40), wxMin(200)],
    };
  });
  expect(r.es22).toBeCloseTo(2.64, 1);                     // water at 22 C: 2.64 kPa
  expect(r.deficit).toBeCloseTo(1.32, 1);                  // half of it
  expect(r.saturated).toBeCloseTo(0, 6);                   // saturated air: no deficit
  expect(r.anchor.shine).toBeCloseTo(5, 6);                // the anchor
  expect(r.anchor.dry).toBeCloseTo(15, 6);                 // dry to the touch in three times that
  expect(r.warm).toBeLessThan(r.anchor.shine);             // warmer: faster
  expect(r.cold).toBeGreaterThan(r.anchor.shine);          // colder: slower
  expect(r.dry).toBeLessThan(r.anchor.shine);              // drier air: faster
  expect(r.damp).toBeGreaterThan(r.anchor.shine * 3);      // damp air: much slower
  expect(r.breeze).toBeLessThan(r.still);                  // wind: faster
  expect(r.sun).toBeLessThan(r.shade);                     // sun on the paper: faster
  expect(r.indoorsWind).toBeCloseTo(r.indoorsStill, 9);    // indoors the wind does not reach the sheet
  expect(r.levels).toEqual(['fast', 'brisk', 'steady', 'slow']);
  expect(r.min).toEqual(['under a minute', 'about 5 min', 'about 40 min', 'over 3 hours']);
});

test('a forecast is read from the hour it is for, with the sunset and the golden hour; the best hour is in daylight, dry and not rainy', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(async fc => {
    await loadSection('sky');
    const p = wxParse(fc, 12);
    return { p, golden: wxGolden(p.sunset), none: wxGolden(null), bad: wxGolden('x'), best: wxBestHour(p.hours, p.sunrise, p.sunset, 'shade'),
      err: (() => { try { wxParse({}); return 'no throw'; } catch (e) { return e.message; } })() };
  }, forecast());
  expect(r.p.now).toEqual({ T: 17.3, RH: 52, wind: 3.1, cloud: 40, rain: 0 });
  expect(r.p.hours).toHaveLength(12);
  expect(r.p.hours[0]).toMatchObject({ at: '13:00', T: 23, RH: 67, rain: 10 });          // the hour the reading is in, not midnight
  expect(r.p.hours[11].at).toBe('00:00');                                              // and on, over midnight
  expect(r.p.sunrise).toBe('07:21');
  expect(r.p.sunset).toBe('18:42');
  expect(r.golden).toBe('17:42');
  expect(r.none).toBeNull(); expect(r.bad).toBeNull();
  expect(r.best.at < '19:00' && r.best.at >= '13:00').toBe(true);
  expect(r.best.at).not.toBe('17:00');                                                 // 70% rain at 17:00
  expect(r.err).toBe('not a forecast');
});

test('typed by hand: the sliders give the minutes and the advice, are kept, and nothing is asked of the network', async ({ page }) => {
  const asked = await (async () => { const a = []; page.on('request', r => { if (/open-meteo/.test(r.url())) a.push(r.url()); }); return a; })();
  await openWeather(page);
  await expect(page.locator('#wxWhere')).toContainText('No place chosen');
  await expect(page.locator('#wxCard .wx-big b').first()).toContainText('min');
  // Hot, dry and windy, in the sun: it dries in seconds.
  await page.locator('#wxT').fill('32'); await page.locator('#wxRH').fill('20'); await page.locator('#wxWind').fill('6');
  await page.selectOption('#wxSpot', 'sun');
  await expect(page.locator('#wxCard')).toHaveClass(/wx-fast/);
  await expect(page.locator('#wxCard .wx-big b').first()).toHaveText('under a minute');
  await expect(page.locator('#wxNote')).toContainText('It dries fast');
  await expect(page.locator('#wxNote')).toContainText('Hot');
  await expect(page.locator('#wxNote')).toContainText('Windy');
  // Cold and damp: slow, and freezing is mentioned.
  await page.locator('#wxT').fill('-3'); await page.locator('#wxRH').fill('95'); await page.locator('#wxWind').fill('0'); await page.selectOption('#wxSpot', 'indoors');
  await expect(page.locator('#wxCard')).toHaveClass(/wx-slow/);
  await expect(page.locator('#wxNote')).toContainText('Below freezing');
  await expect(page.locator('#wxTOut')).toHaveText('-3 °C');
  // Kept, and no table for want of a forecast.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(WX_KEY)))).toMatchObject({ T: -3, RH: 95, wind: 0, spot: 'indoors', place: null });
  await expect(page.locator('.wx-table')).toHaveCount(0);
  expect(asked).toEqual([]);                                           // not a request to Open-Meteo
});

test('a place: searched on the geocoder, chosen, its forecast asked by coordinates alone; the sliders take the reading and a table lists the hours', async ({ page }) => {
  const asked = await stub(page);
  await openWeather(page);
  expect(asked).toEqual([]);                                           // opening it asks nothing
  await page.fill('#wxPlace', 'Kyiv');
  await page.click('#wxFind');
  await expect(page.locator('#wxResults button')).toHaveCount(2);
  await expect(page.locator('#wxResults button').first()).toContainText('Kyiv, Kyiv City (UA)');
  expect(asked).toHaveLength(1);
  expect(new URL(asked[0]).searchParams.get('name')).toBe('Kyiv');
  await page.locator('#wxResults button').first().click();
  await expect(page.locator('.wx-table tbody tr')).toHaveCount(12);
  await expect(page.locator('#wxWhere')).toHaveText('Kyiv');
  // What the forecast call carried: the coordinates, the variables asked for, nothing about who is asking.
  const q = new URL(asked[1]).searchParams;
  expect(q.get('latitude')).toBe('50.45'); expect(q.get('longitude')).toBe('30.52');
  expect([...q.keys()].sort()).toEqual(['current', 'daily', 'forecast_days', 'hourly', 'latitude', 'longitude', 'timezone', 'wind_speed_unit']);
  // The sliders took the reading (17.3 C, 52%, 3.1 m/s to the half), the note the sun.
  await expect(page.locator('#wxTOut')).toHaveText('17 °C');
  await expect(page.locator('#wxRHOut')).toHaveText('52%');
  await expect(page.locator('#wxWindOut')).toHaveText('3 m/s');
  await expect(page.locator('#wxNote')).toContainText('Sunset is at 18:42; the golden hour starts about 17:42');
  await expect(page.locator('#wxNote')).toContainText('Rain is 70% likely');
  await expect(page.locator('.wx-table caption')).toContainText('best for a wash');
  await expect(page.locator('.wx-table tr.wx-best')).toHaveCount(1);
  // Remembered: a reload opens the weather half and asks again by itself.
  await page.reload();
  await page.click('.nav-item[data-view="sky"]');
  await expect(page.locator('.wx-table tbody tr')).toHaveCount(12);
  expect(asked.filter(u => u.startsWith('https://api.open-meteo.com/'))).toHaveLength(2);
});

test('Where I am: the browser asks permission and the forecast is asked for where it says', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 49.8397, longitude: 24.0297 });
  const asked = await stub(page);
  await openWeather(page);
  await page.click('#wxHere');
  await expect(page.locator('.wx-table tbody tr')).toHaveCount(12);
  const q = new URL(asked.find(u => u.startsWith('https://api.open-meteo.com/'))).searchParams;
  expect(q.get('latitude')).toBe('49.84'); expect(q.get('longitude')).toBe('24.03');
  await expect(page.locator('#wxWhere')).toHaveText('Where you are');
});

test.describe('when Open-Meteo cannot be reached', () => {
  test.use({ allowErrors: /Failed to load resource/ });
  test('it says so, and the sliders still work', async ({ page }) => {
    await page.route('https://geocoding-api.open-meteo.com/**', r => r.fulfill({ status: 503, body: 'down' }));
    await page.route('https://api.open-meteo.com/**', r => r.fulfill({ status: 503, body: 'down' }));
    await openWeather(page);
    await page.fill('#wxPlace', 'Lviv');
    await page.click('#wxFind');
    await expect(page.locator('#wxStatus')).toContainText('Could not reach Open-Meteo');
    // A remembered place whose forecast fails: the same words, and the sliders are as they were.
    await page.evaluate(() => { wx.place = { name: 'Lviv', lat: 49.84, lon: 24.03 }; wxFetchPlace(); });
    await expect(page.locator('#wxStatus')).toContainText('Could not reach Open-Meteo');
    await page.locator('#wxT').fill('25');
    await expect(page.locator('#wxTOut')).toHaveText('25 °C');
    await expect(page.locator('#wxCard .wx-big b').first()).toContainText('min');
  });
});

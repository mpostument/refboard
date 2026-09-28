/* refboard - the sample pack: what the page shows where there is no library
   (GitHub Pages, a container with nothing mounted yet) - simple anime girls
   in watercolour, to browse and draw from.

   Generated, not hand-made, by a local ComfyUI (http://127.0.0.1:8188) with
   Animagine XL 4.0 (animagine-xl-4.0-opt.safetensors in its
   models/checkpoints): SDXL, Euler a, 28 steps, CFG 5 - what the model's
   authors recommend. It learnt from Danbooru tags, so the style is tags too:
   "watercolor (medium), traditional media, lineart" gives the washes and the
   fine line, "simple background, white background" a plain sheet to copy
   from. Each picture is one subject line and a seed - the same pair gives
   the same picture again, so the pack can be remade or added to.

   ComfyUI saves PNG; the page gets JPEG (a fifth of the bytes), encoded by
   the tests' Playwright, then samples/index.json, shaped like the one the
   server writes.
     node scripts/samples/generate.js          (all of them)
     node scripts/samples/generate.js 3        (only the third) */
"use strict";
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../../tests/node_modules/@playwright/test'));

const COMFY = process.env.COMFY_URL || 'http://127.0.0.1:8188';
const CKPT = 'animagine-xl-4.0-opt.safetensors';
const OUT = path.resolve(__dirname, '../../src/Refboard/wwwroot/samples');
const PACK = 'Samples';
const GROUP = 'Anime in watercolour';

const STYLE = 'watercolor (medium), traditional media, lineart, simple background, white background, upper body, looking at viewer';
const QUALITY = 'masterpiece, high score, great score, absurdres';
const NEG = 'lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, fewer digits, cropped, worst quality, ' +
  'low quality, low score, bad score, average score, signature, watermark, username, blurry, 3d, realistic, photo, nsfw';

const SAMPLES = [
  { file: '01-pink-bob.jpg', seed: 1001, subject: 'pink hair, short hair, bob cut, green eyes, school uniform, serafuku, smile' },
  { file: '02-long-black.jpg', seed: 2002, subject: 'black hair, long hair, straight hair, amber eyes, white shirt, red ribbon, closed mouth, head tilt' },
  { file: '03-blonde-twintails.jpg', seed: 3003, subject: 'blonde hair, twintails, blue eyes, pink sweater, flower hair ornament, open mouth, smile' },
  { file: '04-brown-ponytail.jpg', seed: 4004, subject: 'brown hair, ponytail, brown eyes, green hoodie, from side, looking at viewer' },
  { file: '05-silver-long.jpg', seed: 5005, subject: 'silver hair, long hair, purple eyes, sailor collar, hair flower, gentle smile' },
  { file: '06-red-short.jpg', seed: 6006, subject: 'red hair, short hair, blue eyes, yellow cardigan, hairclip, three quarter view' },
];

function workflow(s) {
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: CKPT } },
    2: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: `1girl, solo, ${s.subject}, ${STYLE}, ${QUALITY}` } },
    3: { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: NEG } },
    4: { class_type: 'EmptyLatentImage', inputs: { width: 832, height: 1216, batch_size: 1 } },
    5: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
      seed: s.seed, steps: 28, cfg: 5, sampler_name: 'euler_ancestral', scheduler: 'normal', denoise: 1 } },
    6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    7: { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'refboard-sample' } },
  };
}

// Queues one picture and waits for it; the PNG's bytes.
async function generate(s) {
  const r = await fetch(COMFY + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow(s) }) });
  const { prompt_id, error, node_errors } = await r.json();
  if (!prompt_id) throw new Error(JSON.stringify({ error, node_errors }));
  for (;;) {
    await new Promise(res => setTimeout(res, 1000));
    const h = (await (await fetch(`${COMFY}/history/${prompt_id}`)).json())[prompt_id];
    if (h?.status?.status_str === 'error') throw new Error(JSON.stringify(h.status));
    const img = h?.outputs?.['7']?.images?.[0];
    if (!img) continue;
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
    return Buffer.from(await (await fetch(`${COMFY}/view?${q}`)).arrayBuffer());
  }
}

(async () => {
  const only = Number(process.argv[2]) || 0;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [i, s] of SAMPLES.entries()) {
    if (only && only !== i + 1) continue;
    const png = await generate(s);
    const b64 = await page.evaluate(async src => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/jpeg', 0.86).split(',')[1];
    }, 'data:image/png;base64,' + png.toString('base64'));
    fs.writeFileSync(path.join(OUT, s.file), Buffer.from(b64, 'base64'));
    console.log('generated', s.file);
  }
  await browser.close();

  const images = SAMPLES.filter(s => fs.existsSync(path.join(OUT, s.file)))
    .map(s => ({ src: 'samples/' + s.file, bytes: fs.statSync(path.join(OUT, s.file)).size }));
  const bytes = images.reduce((n, i) => n + i.bytes, 0);
  const index = {
    generated: Math.floor(Date.now() / 1000), source: 'samples', totalImages: images.length, totalBytes: bytes,
    packCount: 1, packs: [{ name: PACK, count: images.length, groups: [{ name: GROUP, rotation: false, images }] }],
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  console.log(`wrote samples/index.json - ${images.length} images, ${(bytes / 1024).toFixed(0)} KB`);
})();

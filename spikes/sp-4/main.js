// SP-4 spike page: throwaway. Runs the motion scenarios and reports frame intervals.
import { applyStep, buildSlide, makeSlide, playStep, playTransition, resolve } from './engine.js';

const stage = document.getElementById('stage');
const out = document.getElementById('out');

function fit() {
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  stage.style.transform = `scale(${scale})`;
}
addEventListener('resize', fit);
fit();

// A few synthetic photos for the image elements, made once and decoded before any run.
async function makeImages() {
  const urls = [];
  for (let i = 0; i < 3; i += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const g = canvas.getContext('2d');
    const gradient = g.createLinearGradient(0, 0, 480, 360);
    gradient.addColorStop(0, `hsl(${i * 90} 60% 55%)`);
    gradient.addColorStop(1, `hsl(${i * 90 + 80} 60% 30%)`);
    g.fillStyle = gradient;
    g.fillRect(0, 0, 480, 360);
    for (let k = 0; k < 40; k += 1) {
      g.fillStyle = `hsla(${(k * 37 + i * 50) % 360} 60% 50% / .4)`;
      g.beginPath();
      g.arc((k * 97) % 480, (k * 53) % 360, 20 + (k % 7) * 12, 0, Math.PI * 2);
      g.fill();
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    urls.push(URL.createObjectURL(blob));
  }
  await Promise.all(
    urls.map((u) => {
      const img = new Image();
      img.src = u;
      return img.decode();
    }),
  );
  return urls;
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
function summarise(intervals) {
  if (intervals.length === 0) return { frames: 0 };
  const sorted = [...intervals].sort((a, b) => a - b);
  const mean = intervals.reduce((s, x) => s + x, 0) / intervals.length;
  const round = (x) => Math.round(x * 10) / 10;
  return {
    frames: intervals.length,
    averageFps: round(1000 / mean),
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted.at(-1)),
    framesOver25ms: intervals.filter((x) => x > 25).length,
  };
}

/** Records the gap between animation frames until stop() is called. */
function sampleFrames() {
  const stamps = [];
  let running = true;
  const tick = (t) => {
    if (!running) return;
    stamps.push(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return {
    async stop() {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      running = false;
      return stamps.slice(1).map((t, i) => t - stamps[i]); // the gaps between frames
    },
  };
}

/** Does every element's computed style match the resolver for `step`? Returns the number of mismatches. */
function mismatches(view, step) {
  const state = resolve(view.slide, step);
  let wrong = 0;
  for (const [id, el] of view.dom) {
    const s = state[id];
    const cs = getComputedStyle(el);
    const base = view.slide.elements.find((e) => e.id === id);
    const opacityOk = Math.abs(Number(cs.opacity) - s.opacity) < 0.005;
    let positionOk;
    if (view.mode === 'transform') {
      const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
      positionOk = Math.abs(m.e - s.dx) < 0.5 && Math.abs(m.f - s.dy) < 0.5;
    } else {
      positionOk = Math.abs(parseFloat(cs.left) - (base.x + s.dx)) < 0.5 && Math.abs(parseFloat(cs.top) - (base.y + s.dy)) < 0.5;
    }
    if (!opacityOk || !positionOk) wrong += 1;
  }
  return wrong;
}

let images = null;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(name, options = {}) {
  images ??= await makeImages();
  const ms = options.ms ?? 600;
  const repeat = options.repeat ?? 3;
  const mode = name === 'elements50-layout' ? 'layout' : 'transform';
  const result = { name, mode, ms, repeat, heavy: Boolean(options.heavy), prepare: Boolean(options.prepare), runs: [] };
  const allIntervals = [];

  for (let r = 0; r < repeat; r += 1) {
    stage.replaceChildren();
    const slideA = makeSlide(50, 7, options.heavy);
    const slideB = makeSlide(50, 8, options.heavy);
    const a = buildSlide(slideA, stage, mode, images);
    const b = buildSlide(slideB, stage, mode, images);
    await wait(300); // let the page settle before measuring
    const record = { setupMs: [], wrongAfter: 0 };

    if (name.startsWith('elements50')) {
      applyStep(a, 0);
      b.root.style.visibility = 'hidden';
      for (const [from, to] of [[0, 1], [1, 2], [2, 3]]) {
        const sampler = sampleFrames();
        const info = await playStep(a, from, to, ms);
        const intervals = await sampler.stop();
        allIntervals.push(...intervals);
        record.setupMs.push(Math.round(info.setupMs * 10) / 10);
        record.wrongAfter += mismatches(a, to);
        await wait(100);
      }
    } else if (name.startsWith('transition')) {
      applyStep(a, 1);
      applyStep(b, 1);
      b.root.style.visibility = 'hidden';
      if (options.prepare) {
        // Promote both slides to their own layers and paint the incoming one (invisible) first.
        a.root.style.willChange = 'transform, opacity';
        b.root.style.willChange = 'transform, opacity';
        b.root.style.visibility = 'visible';
        b.root.style.opacity = '0';
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        b.root.style.opacity = '';
        b.root.style.visibility = 'hidden';
      }
      await wait(100);
      const sampler = sampleFrames();
      const info = await playTransition(a, b, name.split('-')[1], ms);
      allIntervals.push(...(await sampler.stop()));
      record.setupMs.push(Math.round(info.setupMs * 10) / 10);
    } else if (name === 'step-back') {
      applyStep(a, 0);
      b.root.style.visibility = 'hidden';
      for (const [from, to] of [[0, 1], [1, 2], [2, 3], [3, 2], [2, 1], [1, 0]]) {
        const sampler = sampleFrames();
        const info = await playStep(a, from, to, ms);
        allIntervals.push(...(await sampler.stop()));
        record.setupMs.push(Math.round(info.setupMs * 10) / 10);
        record.wrongAfter += mismatches(a, to);
        await wait(100);
      }
    }
    result.runs.push(record);
  }
  result.frameIntervals = summarise(allIntervals);
  result.elementsWithWrongEndState = result.runs.reduce((s, r) => s + r.wrongAfter, 0);
  result.setupMsMax = Math.max(...result.runs.flatMap((r) => r.setupMs));
  out.textContent = JSON.stringify(result, null, 1);
  return result;
}

window.__sp4 = { run };
document.querySelectorAll('button[data-run]').forEach((button) => {
  button.onclick = () => run(button.dataset.run, { heavy: new URLSearchParams(location.search).has('heavy') });
});
document.title = 'SP-4 ready';

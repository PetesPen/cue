// SP-3 spike: the small runtime that goes inside an exported deck. Throwaway.
// Reads the deck JSON and images that the exporter embedded, draws one slide at a time in a fixed
// 1920 x 1080 box scaled to fit, and moves with the arrow keys, space or a click.
(() => {
  const deck = JSON.parse(document.getElementById('deck').textContent);
  const stage = document.getElementById('stage');
  const state = { index: -1, count: deck.slides.length, log: [], loadedAt: performance.now() };
  window.__cue = state;

  const slide = document.createElement('div');
  slide.className = 'slide';
  stage.appendChild(slide);

  function fit() {
    const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
    slide.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  }
  addEventListener('resize', fit);
  fit();

  // Text follows the SP-2 rules: same structure, break-spaces, no ligatures, geometricPrecision.
  function title(text, run) {
    const p = document.createElement('p');
    const span = document.createElement('span');
    span.style.fontFamily = run.family;
    span.style.fontSize = run.size + 'px';
    span.style.color = run.color;
    if (run.italic) span.style.fontStyle = 'italic';
    span.textContent = text;
    p.appendChild(span);
    return p;
  }

  async function show(index) {
    if (index < 0 || index >= state.count) return;
    const started = performance.now();
    const data = deck.slides[index];
    slide.style.background = data.background;
    slide.replaceChildren();
    const box = document.createElement('div');
    box.className = 'text';
    box.appendChild(title(data.title, data.titleRun));
    box.appendChild(title(data.body, data.bodyRun));
    slide.appendChild(box);
    if (data.image) {
      const source = document.querySelector('[data-image="' + data.image + '"]').textContent;
      const img = new Image();
      img.alt = data.alt;
      img.className = 'photo';
      img.src = source;
      slide.appendChild(img);
      await img.decode();
    }
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    state.index = index;
    state.log.push({ index, ms: performance.now() - started });
  }

  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') show(state.index + 1);
    if (e.key === 'ArrowLeft') show(state.index - 1);
  });
  addEventListener('click', () => show(state.index + 1));
  show(0).then(() => {
    state.firstSlideAt = performance.now();
  });
})();

// SP-1 spike code: throwaway. The behaviour shared by the presenter and audience windows.
// Either window can drive. A new window says hello and is told the current state.
import { createSync, now } from './sync.js';

const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

export const summarise = (values) => ({
  n: values.length,
  p50: percentile(values, 50),
  p95: percentile(values, 95),
  p99: percentile(values, 99),
  max: values.length ? Math.max(...values) : null,
});

export function startShow({ role, render }) {
  const params = new URLSearchParams(location.search);
  const mechanism = params.get('mech') === 'storage' ? 'storage' : 'broadcast';
  const sync = createSync({ role, mechanism });

  const sp1 = (window.__sp1 = {
    role,
    mechanism,
    state: { slide: 1, step: 0, blank: false, seq: 0 },
    oneWay: [], // { seq, handled, painted }: ms from the sender's clock to this window
    rtt: [], // ms from sending a state to getting the "painted" acknowledgement
    pending: new Map(),
    peers: {}, // role -> last time we heard from it
    gone: [], // roles that said goodbye, with the time we noticed
    log: [],
    ended: false,
    fullscreen: {},
  });

  const log = (text) => sp1.log.push(`${(now() % 100000).toFixed(1)} ${text}`);

  // Liveness without timers or unload events: every window holds a Web Lock named after itself until
  // it dies (closed, crashed or killed). A window that wants to know requests the same lock; the
  // request is granted only when the holder is gone.
  sp1.locks = { supported: 'locks' in navigator, released: [] };
  const watched = new Set();
  if (sp1.locks.supported) {
    navigator.locks.request(`cue-sp1-alive-${sync.id}`, () => new Promise(() => {}));
  }
  function watch(peerId) {
    if (!sp1.locks.supported || watched.has(peerId)) return;
    watched.add(peerId);
    navigator.locks.request(`cue-sp1-alive-${peerId}`, () => {
      sp1.locks.released.push({ id: peerId, at: now() });
    });
  }

  function apply(state) {
    sp1.state = state;
    render(state);
  }

  // Change the show from this window and tell the others.
  function drive(patch) {
    const next = { ...sp1.state, ...patch, seq: sp1.state.seq + 1 };
    apply(next);
    sp1.pending.set(next.seq, now());
    sync.post({ type: 'state', state: next });
    return next;
  }

  sync.on((message) => {
    sp1.peers[message.role] = now();
    watch(message.from);
    if (message.type === 'state') {
      const handled = now();
      if (message.state.seq > sp1.state.seq) {
        apply(message.state);
        const row = { seq: message.state.seq, handled: handled - message.sentAt, painted: null };
        sp1.oneWay.push(row);
        requestAnimationFrame(() => {
          row.painted = now() - message.sentAt;
          sync.post({ type: 'ack', seq: message.state.seq, to: message.from });
        });
      } else {
        // Already in step (or older): still acknowledge so a sender is never left waiting.
        sync.post({ type: 'ack', seq: message.state.seq, to: message.from });
      }
    } else if (message.type === 'ack' && message.to === sync.id) {
      const sentAt = sp1.pending.get(message.seq);
      if (sentAt !== undefined) {
        sp1.rtt.push(now() - sentAt);
        sp1.pending.delete(message.seq);
      }
    } else if (message.type === 'hello') {
      log(`hello from ${message.role}`);
      sync.post({ type: 'state', state: sp1.state, reply: true });
    } else if (message.type === 'bye') {
      sp1.gone.push({ role: message.role, noticedAt: now(), sentAt: message.sentAt });
      log(`${message.role} said goodbye`);
    } else if (message.type === 'end') {
      sp1.ended = true;
      log('end of show requested');
      document.body.dataset.ended = 'true';
      window.close(); // only works for windows a script opened; otherwise the text below shows
    }
  });

  addEventListener('pagehide', () => {
    sync.post({ type: 'bye' });
  });

  async function runLatency(count = 200, gapMs = 10) {
    sp1.rtt.length = 0;
    for (let i = 0; i < count; i += 1) {
      drive({ step: sp1.state.step + 1 });
      await new Promise((resolve) => setTimeout(resolve, gapMs));
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { sent: count, acknowledged: sp1.rtt.length, rtt: summarise(sp1.rtt) };
  }

  const endShow = () => {
    sync.post({ type: 'end' });
    window.close();
  };

  const tryFullscreen = async (label) => {
    try {
      await document.documentElement.requestFullscreen();
      sp1.fullscreen[label] = 'ok';
    } catch (error) {
      sp1.fullscreen[label] = `${error.name}: ${error.message}`;
    }
  };

  window.__runLatency = runLatency;
  window.__drive = drive;
  window.__endShow = endShow;
  sync.post({ type: 'hello' });
  render(sp1.state);

  return { drive, endShow, runLatency, tryFullscreen, sp1, sync };
}

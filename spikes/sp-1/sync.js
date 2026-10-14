// SP-1 spike code: throwaway. Two ways to tell another window "the show moved":
// BroadcastChannel (the plan) and the localStorage "storage" event (the fallback in the plan).

export const now = () => performance.timeOrigin + performance.now();

const CHANNEL = 'cue-sp1';
const STORAGE_KEY = 'cue-sp1-message';

export function createSync({ role, mechanism }) {
  const id = `${role}-${Math.random().toString(36).slice(2, 7)}`;
  const listeners = new Set();
  let channel = null;

  const emit = (message) => {
    if (message.from === id) return;
    for (const listener of listeners) listener(message);
  };

  if (mechanism === 'broadcast') {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => emit(event.data);
  } else {
    addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) emit(JSON.parse(event.newValue));
    });
  }

  return {
    id,
    mechanism,
    post(message) {
      const full = { ...message, from: id, role, sentAt: now() };
      if (channel) channel.postMessage(full);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...full, nonce: Math.random() }));
      return full;
    },
    on(listener) {
      listeners.add(listener);
    },
  };
}

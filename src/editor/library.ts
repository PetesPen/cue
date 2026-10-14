import { applyCommand, createDeck, type Deck, type Env } from '@/model';
import type { DeckStore } from '@/storage';

/** What the home screen does to the stored decks (SV-2). Each saves before it returns. */

export async function createStoredDeck(store: DeckStore, env: Env): Promise<Deck> {
  const deck = createDeck(env);
  await store.save(deck);
  return deck;
}

export async function renameStoredDeck(
  store: DeckStore,
  id: string,
  title: string,
  env: Env,
): Promise<void> {
  const deck = await store.load(id);
  if (deck === undefined) return;
  await store.save(applyCommand(deck, { type: 'renameDeck', title, at: env.now() }).deck);
}

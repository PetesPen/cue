import { EditorApp } from '@/editor';
import { createDeckStore } from '@/storage';

// One store for the whole app. The database opens on first use.
const store = createDeckStore();

export function App() {
  return <EditorApp store={store} />;
}

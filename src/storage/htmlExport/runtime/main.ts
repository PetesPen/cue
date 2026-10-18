import { ROOT_ID } from '../layout';
import { PageError, readPage } from './data';
import { mountPage } from './page';

/** The page's program: it runs once, when the page has been read, and shows the deck. */
function start(): void {
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  try {
    const data = readPage(document);
    const fromAddress = Number.parseInt(location.hash.slice(1), 10);
    mountPage(root, data, Number.isFinite(fromAddress) ? fromAddress : 1);
  } catch (error) {
    root.className = 'cp-error';
    root.textContent = error instanceof PageError ? error.message : 'This page could not be shown.';
  }
}

start();

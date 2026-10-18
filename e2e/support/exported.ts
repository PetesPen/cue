import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';

// The exported web page (SV-4), made through the Export dialog and opened from a real file in a browser
// that can reach nothing: no network at all, and a watch on every request, error and policy violation.

/** Export the open deck as a web page, through the dialog, and return where the file was saved. */
export async function exportPage(
  page: Page,
  path: string,
  options: { readonly notes?: boolean } = {},
): Promise<string> {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export deck' });
  await expect(dialog.getByText(/\.html · about/)).toBeVisible();
  if (options.notes === false) {
    await dialog.getByRole('checkbox', { name: /Include speaker notes/ }).uncheck();
  }
  const button = dialog.getByRole('button', { name: 'Export web page' });
  await expect(button).toBeEnabled();
  const download = page.waitForEvent('download');
  await button.click();
  const taken = await download;
  await taken.saveAs(path);
  return path;
}

/** What went wrong in an opened page, if anything. */
export interface Watched {
  readonly page: Page;
  readonly context: BrowserContext;
  /** Every request the page made. */
  readonly requests: string[];
  readonly errors: string[];
  /** Directives the browser refused on behalf of the page's content security policy. */
  readonly violations: () => Promise<string[]>;
  readonly root: ReturnType<Page['locator']>;
  readonly close: () => Promise<void>;
}

/** Open an exported file with the network off, watching everything it does. */
export async function openPage(
  browser: Browser,
  path: string,
  options: {
    readonly viewport?: { readonly width: number; readonly height: number };
    readonly hasTouch?: boolean;
    readonly hash?: string;
  } = {},
): Promise<Watched> {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1440, height: 900 },
    hasTouch: options.hasTouch ?? false,
    offline: true,
  });
  const page = await context.newPage();
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    requests.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  await page.addInitScript(() => {
    const seen: string[] = [];
    Reflect.set(window, '__csp', seen);
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective}: ${event.blockedURI}`);
    });
  });
  await page.goto(`${pathToFileURL(path).href}${options.hash ?? ''}`);
  const root = page.locator('#cue-root');
  await expect(root).toHaveAttribute('data-slide', /^\d+$/);
  return {
    page,
    context,
    requests,
    errors,
    root,
    violations: () =>
      page.evaluate(() => {
        const seen: unknown = Reflect.get(window, '__csp');
        return Array.isArray(seen) ? seen.map(String) : [];
      }),
    close: () => context.close(),
  };
}

/** Wait until a transition is over: one slide is on the stage again. */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('.cue-layer')).toHaveCount(1);
}

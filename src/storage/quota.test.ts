import { describe, expect, test } from 'vitest';
import { formatBytes, formatUsage, isNearlyFull, isQuotaError } from './quota';

describe('isNearlyFull (SV-1, decision 12)', () => {
  test.each([
    [89, false],
    [90, true],
    [100, true],
    [0, false],
  ])(
    'Given %d of a 100-byte quota used, When it is checked, Then nearly full is %s',
    (usage, expected) => {
      expect(isNearlyFull({ usage, quota: 100 })).toBe(expected);
    },
  );

  test('Given a browser that reports no quota, When it is checked, Then storage is not called nearly full', () => {
    expect(isNearlyFull({ usage: 50, quota: 0 })).toBe(false);
  });
});

describe('formatUsage (SV-1)', () => {
  test.each([
    [{ usage: 0.9e9, quota: 1e9 }, '0.9 of about 1 GB'],
    [{ usage: 9.4e9, quota: 10.24e9 }, '9.4 of about 10 GB'],
    [{ usage: 470e6, quota: 500e6 }, '470 of about 500 MB'],
    [{ usage: 0.94e9, quota: 1.05e9 }, '0.9 of about 1.1 GB'],
  ])('Given %j, When it is formatted, Then it reads "%s"', (usage, expected) => {
    expect(formatUsage(usage)).toBe(expected);
  });
});

describe('formatBytes', () => {
  test.each([
    [500, '1 KB'],
    [38_400, '38 KB'],
    [38_000_000, '38 MB'],
    [1_500_000, '1.5 MB'],
    [2_300_000_000, '2.3 GB'],
  ])('Given %d bytes, When they are formatted, Then they read "%s"', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('isQuotaError (docs/spikes/SP-5.md)', () => {
  test('Given the browser error itself, When it is checked, Then it is a full store', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true);
  });

  test('Given Dexie wrapping it as an AbortError with an inner error, When it is checked, Then it is still a full store', () => {
    const wrapped = Object.assign(new Error('aborted'), {
      name: 'AbortError',
      inner: new DOMException('full', 'QuotaExceededError'),
    });

    expect(isQuotaError(wrapped)).toBe(true);
  });

  test.each([
    ['another error', new Error('nope')],
    ['an abort with no inner error', Object.assign(new Error('x'), { name: 'AbortError' })],
    ['a string', 'QuotaExceededError'],
    ['null', null],
    ['undefined', undefined],
  ])('Given %s, When it is checked, Then it is not a full store', (_name, error) => {
    expect(isQuotaError(error)).toBe(false);
  });

  test('Given an error whose inner error is itself, When it is checked, Then it does not loop', () => {
    const loop = Object.assign(new Error('x'), { name: 'AbortError' });
    Object.assign(loop, { inner: loop });

    expect(isQuotaError(loop)).toBe(false);
  });
});

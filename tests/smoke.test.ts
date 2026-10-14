import fc from 'fast-check';
import { expect, test } from 'vitest';

// Tooling smoke test: proves fast-check runs under Vitest. Replace with the real property tests
// (z-order, undo, file round trip, opacity) as the model arrives.
test('Given fast-check, When a property over random arrays is run, Then reversing twice is the identity', () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), (xs) => {
      expect([...xs].reverse().reverse()).toEqual(xs);
    }),
  );
});

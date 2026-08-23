import { describe, it, expect } from 'vitest';
import { fromEnv, isEnvRef, resolveEnvRefs, MissingEnvError } from '../../env.js';

describe('fromEnv', () => {
  it('carries the name, not a value', () => {
    const ref = fromEnv('STRIPE_SECRET_KEY');
    expect(isEnvRef(ref)).toBe(true);
    expect(String(ref)).toBe('fromEnv(STRIPE_SECRET_KEY)');
  });

  it('resolves from the supplied environment, leaving everything else alone', () => {
    const config = {
      'secret-key': fromEnv('STRIPE_SECRET_KEY'),
      'success-url': 'https://shop.example.com/done',
      nested: { deep: [fromEnv('OTHER'), 'plain'] },
    };

    expect(resolveEnvRefs(config, { STRIPE_SECRET_KEY: 'sk_test_1', OTHER: 'x' })).toEqual({
      'secret-key': 'sk_test_1',
      'success-url': 'https://shop.example.com/done',
      nested: { deep: ['x', 'plain'] },
    });
  });

  it('does not mutate the plan it was given', () => {
    const config = { 'secret-key': fromEnv('K') };
    resolveEnvRefs(config, { K: 'v' });
    expect(isEnvRef(config['secret-key'])).toBe(true);
  });

  it('names every missing variable at once, so a short pipeline learns all of them', () => {
    const config = { a: fromEnv('ONE'), b: fromEnv('TWO'), c: fromEnv('THREE') };
    try {
      resolveEnvRefs(config, { TWO: 'set' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingEnvError);
      expect((err as MissingEnvError).names).toEqual(['ONE', 'THREE']);
      expect((err as MissingEnvError).message).toBe('missing ONE, THREE');
    }
  });

  it('treats a declared-but-empty variable as missing', () => {
    // A CI variable that exists and was never populated arrives exactly this way.
    expect(() => resolveEnvRefs({ k: fromEnv('K') }, { K: '' })).toThrow(MissingEnvError);
  });
});

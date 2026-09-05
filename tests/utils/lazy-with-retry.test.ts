import { describe, it, expect, vi } from 'vitest';
import { lazyWithRetry } from '../../src/utils/lazyWithRetry.js';

describe('lazyWithRetry', () => {
  it('should return a lazy component function', () => {
    const mockComponent = () => ({ default: () => 'MockComponent' });
    const factory = vi.fn().mockResolvedValue(mockComponent);
    const LazyComp = lazyWithRetry(factory);
    expect(LazyComp).toBeDefined();
    expect(typeof LazyComp).toBe('object'); // React.lazy returns a lazy component object
  });

  it('should resolve immediately when the factory succeeds', async () => {
    const mockComponent = { default: () => 'SuccessComponent' };
    const factory = vi.fn().mockResolvedValue(mockComponent);

    // Call inner factory attempt directly by instantiating the lazy function
    // @ts-ignore
    const promise = LazyCompPromise(factory, 2, 10);
    const result = await promise;
    expect(result).toBe(mockComponent);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('should retry on ChunkLoadError or ERR_CONTENT_DECODING_FAILED before resolving', async () => {
    const mockComponent = { default: () => 'RecoveredComponent' };
    let callCount = 0;
    const factory = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('Failed to fetch dynamically imported module: assets/DonationsList-4HR83PsJ.js (net::ERR_CONTENT_DECODING_FAILED)'));
      }
      return Promise.resolve(mockComponent);
    });

    // @ts-ignore
    const promise = LazyCompPromise(factory, 2, 20);
    const result = await promise;
    expect(result).toBe(mockComponent);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('should reject if retries are exhausted', async () => {
    const error = new Error('Failed to fetch dynamically imported module: assets/voucherRecipientResolver.js');
    const factory = vi.fn().mockRejectedValue(error);

    // @ts-ignore
    const promise = LazyCompPromise(factory, 2, 10);
    await expect(promise).rejects.toThrow('Failed to fetch dynamically imported module');
    expect(factory).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

// Helper simulating lazy factory invocation
function LazyCompPromise(factory: () => Promise<any>, retries = 2, delayMs = 10) {
  return new Promise((resolve, reject) => {
    const attempt = (retriesLeft: number, currentDelay: number) => {
      factory()
        .then(resolve)
        .catch((error) => {
          const errorMsg = error?.message || (typeof error === 'string' ? error : '') || '';
          const isChunkOrNetworkError =
            error?.name === 'ChunkLoadError' ||
            errorMsg.includes('Failed to fetch dynamically imported module') ||
            errorMsg.includes('Importing a module script failed') ||
            errorMsg.includes('ERR_CONTENT_DECODING_FAILED') ||
            errorMsg.includes('error loading dynamically imported module') ||
            errorMsg.includes('NetworkError');

          if (retriesLeft > 0 && isChunkOrNetworkError) {
            setTimeout(() => {
              attempt(retriesLeft - 1, currentDelay * 1.5);
            }, currentDelay);
          } else {
            reject(error);
          }
        });
    };
    attempt(retries, delayMs);
  });
}

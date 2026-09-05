import { lazy } from 'react';

/**
 * Lazy loads a component with an automatic retry mechanism for transient network
 * or decoding errors (e.g. ERR_CONTENT_DECODING_FAILED, Failed to fetch dynamically imported module).
 *
 * @param {() => Promise<any>} factory Function returning a dynamic import promise
 * @param {number} retries Number of retries before throwing or triggering fallback (default: 2)
 * @param {number} delayMs Initial delay between retries in milliseconds (default: 400)
 */
export function lazyWithRetry(factory, retries = 2, delayMs = 400) {
  return lazy(() =>
    new Promise((resolve, reject) => {
      const attempt = (retriesLeft, currentDelay) => {
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
    })
  );
}

export default lazyWithRetry;

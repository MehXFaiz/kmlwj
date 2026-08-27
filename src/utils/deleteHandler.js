import { showToast } from '../components/ui/Toast';

/**
 * Standardized error handling for DELETE operations across the ERP application.
 *
 * Requirements:
 * - 401 or 403: Always display "You do not have permission to delete this record."
 * - Other errors (400, 404, 409, 422, 500, network error): Display the backend message
 *   or fallback to "Unable to delete this record. Please try again."
 * - Never shows a success toast.
 *
 * @param {Error|any} err - The caught error object (Axios error, Error, or string)
 * @param {string} [defaultMsg] - Optional fallback error message
 * @returns {string} The error message displayed
 */
export function handleDeleteError(err, defaultMsg = 'Unable to delete this record. Please try again.') {
  if (isForbiddenError(err)) {
    const permMsg = 'You do not have permission to delete this record.';
    showToast(permMsg, 'error');
    return permMsg;
  }

  const backendMsg =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    (typeof err?.response?.data === 'string' ? err.response.data : null) ||
    err?.message;

  const finalMsg = backendMsg || defaultMsg;
  showToast(finalMsg, 'error');
  return finalMsg;
}

/**
 * Checks if an error is an authorization/permission denial (401 or 403).
 *
 * @param {any} err
 * @returns {boolean}
 */
export function isForbiddenError(err) {
  const status = err?.response?.status || err?.status || err?.statusCode;
  if (status === 401 || status === 403) return true;
  const msg = (err?.message || err?.response?.data?.error?.message || '').toLowerCase();
  return msg.includes('403') || msg.includes('401') || msg.includes('forbidden') || msg.includes('permission');
}

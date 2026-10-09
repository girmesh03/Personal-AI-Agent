/**
 * @module redux/app/authClient
 * @description Central singleton authentication client and re-authorization mutex.
 * Serializes all concurrent /auth/refresh operations across RTK Query (apiSlice),
 * MuiChatAdapter (streaming & pre-flight uploads), and external fetch engines.
 * Prevents refresh token rotation race conditions and false session invalidations.
 */

import { API_BASE_URL } from '../../utils/constants.js';

/**
 * Global singleton promise representing an active in-flight /auth/refresh request.
 * Shared across all client modules to guarantee exactly one refresh request in flight.
 * @type {Promise<{ ok: boolean, user?: object, status?: number }> | null}
 */
let activeRefreshPromise = null;

/**
 * Triggers a centralized, mutex-protected token refresh request against /auth/refresh.
 * If a refresh is already in flight, joins the existing promise.
 *
 * @function refreshSession
 * @param {object} options
 * @param {Function} [options.dispatch] - Redux store dispatch function.
 * @param {Function} [options.getState] - Redux store getState function.
 * @param {string} [options.baseUrl] - Base API URL (defaults to API_BASE_URL).
 * @returns {Promise<{ ok: boolean, user?: object, status?: number }>}
 */
export const refreshSession = async ({ dispatch, baseUrl = API_BASE_URL } = {}) => {
  // If an active refresh promise is already pending, join it immediately
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const user = data?.data?.user || data?.user;
        if (user && dispatch) {
          dispatch({ type: 'auth/setCredentials', payload: { user } });
        }
        return { ok: true, user, status: res.status };
      }

      // If refresh token was genuinely expired / invalid (401)
      if (res.status === 401) {
        if (dispatch) {
          dispatch({ type: 'auth/logout' });
        }
        return { ok: false, status: 401 };
      }

      return { ok: false, status: res.status };
    } catch (err) {
      return { ok: false, error: err, status: 0 };
    } finally {
      // Clear mutex on next tick so all microtasks spawned from this turn share the result
      Promise.resolve().then(() => {
        activeRefreshPromise = null;
      });
    }
  })();

  return activeRefreshPromise;
};

/**
 * Executes an arbitrary asynchronous fetch/request operation under automatic re-authentication protection.
 * If the operation yields a 401 UNAUTHENTICATED response, intercepts the failure,
 * acquires the singleton refresh mutex to rotate tokens, and retries the original request once.
 *
 * @function executeWithReauth
 * @param {Function} requestFn - Function returning a fetch Response or result with a `status` property.
 * @param {object} options - Options containing dispatch, getState, and optional baseUrl.
 * @returns {Promise<Response|object>} The final response after transparent re-auth if applicable.
 */
export const executeWithReauth = async (requestFn, { dispatch, getState, baseUrl = API_BASE_URL } = {}) => {
  let response = await requestFn();

  if (response && response.status === 401) {
    const refreshResult = await refreshSession({ dispatch, getState, baseUrl });
    if (refreshResult.ok) {
      // Re-run original request with freshly rotated session cookies
      response = await requestFn();
    }
  }

  return response;
};

export default {
  refreshSession,
  executeWithReauth,
};

/**
 * @module utils/attachmentRegistry
 * @description Centralized in-memory registry tracking eager background uploads for composer attachments.
 * Completely decoupled from React render loops to uphold hardware 60/120fps zero-lag typing.
 */

import { useSyncExternalStore, useCallback } from 'react';

const registry = new Map();
const listeners = new Set();

/**
 * Registers an in-flight background upload for a File object.
 *
 * @param {File} file - Native File object.
 * @param {Promise<object>} uploadPromise - Active upload request promise.
 * @param {(() => void)} [abortFn] - Optional abort callback to terminate HTTP upload on cancel.
 * @param {((result: object) => void)} [onResolvedAfterCancelCleanup] - Optional cleanup callback if upload resolves after cancellation.
 */
export const registerUpload = (file, uploadPromise, abortFn, onResolvedAfterCancelCleanup) => {
  if (!file) return;
  const entry = {
    isUploading: true,
    result: null,
    error: null,
    abortFn: typeof abortFn === 'function' ? abortFn : null,
    wasCancelled: false,
    onResolvedAfterCancelCleanup: typeof onResolvedAfterCancelCleanup === 'function' ? onResolvedAfterCancelCleanup : null,
  };
  registry.set(file, entry);
  notify();

  uploadPromise
    .then((result) => {
      if (entry.wasCancelled) {
        if (entry.onResolvedAfterCancelCleanup) {
          try {
            entry.onResolvedAfterCancelCleanup(result);
          } catch {
            // Ignored on cleanup
          }
        }
        return;
      }
      entry.isUploading = false;
      entry.result = result;
      entry.error = null;
      notify();
    })
    .catch((error) => {
      if (entry.wasCancelled) return;
      entry.isUploading = false;
      entry.result = null;
      entry.error = error;
      notify();
    });
};

/**
 * Retrieves the current upload state for a File object.
 *
 * @param {File} file
 * @returns {{ isUploading: boolean, result: object|null, error: any }}
 */
export const getUploadState = (file) => {
  if (!file) return { isUploading: false, result: null, error: null };
  const entry = registry.get(file);
  return entry
    ? { isUploading: entry.isUploading, result: entry.result, error: entry.error }
    : { isUploading: false, result: null, error: null };
};

/**
 * Removes an attachment from the registry, immediately aborts any in-flight request,
 * and returns its upload result (e.g. for Cloudinary cleanup).
 *
 * @param {File} file
 * @returns {object|null} The resolved upload result metadata with wasUploading flag.
 */
export const removeUpload = (file) => {
  if (!file) return null;
  const entry = registry.get(file);
  if (!entry) return null;

  const wasUploading = Boolean(entry.isUploading);
  entry.wasCancelled = true;

  if (wasUploading && typeof entry.abortFn === 'function') {
    try {
      entry.abortFn();
    } catch {
      // Ignored on abort
    }
  }

  registry.delete(file);
  notify();

  const result = entry.result || null;
  return {
    ...result,
    wasUploading,
    result,
  };
};

/**
 * Returns the count of files currently uploading in the background.
 *
 * @returns {number}
 */
export const getPendingUploadCount = () => {
  let count = 0;
  for (const entry of registry.values()) {
    if (entry.isUploading) count += 1;
  }
  return count;
};

/**
 * Subscribes a listener to pending upload count changes.
 *
 * @param {(count: number) => void} callback
 * @returns {() => void} Unsubscribe function.
 */
export const subscribeUploadState = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notify = () => {
  const count = getPendingUploadCount();
  listeners.forEach((fn) => {
    try {
      fn(count);
    } catch {
      // Ignore listener error
    }
  });
};

/**
 * React hook returning the active number of background uploads.
 * Re-renders only on upload start and upload completion.
 *
 * @returns {number}
 */
export const usePendingUploadCount = () => {
  return useSyncExternalStore(subscribeUploadState, getPendingUploadCount);
};

/**
 * React hook returning the reactive upload state for a specific file.
 *
 * @param {File} file
 * @returns {{ isUploading: boolean, result: object|null, error: any }}
 */
export const useUploadState = (file) => {
  const getSnapshot = useCallback(() => getUploadState(file), [file]);
  return useSyncExternalStore(subscribeUploadState, getSnapshot);
};

export default {
  registerUpload,
  getUploadState,
  removeUpload,
  getPendingUploadCount,
  subscribeUploadState,
  usePendingUploadCount,
  useUploadState,
};

/**
 * @module hooks/useViewportHeight
 * @description Synchronizes exact mobile screen height with CSS custom property --app-height
 * using the W3C window.visualViewport API.
 * Eliminates multi-phone viewport inconsistencies (OEM bottom bars, address bar collapse,
 * in-app WebViews, and software virtual keyboard occlusion).
 */

import { useEffect, useState } from 'react';

/**
 * Measures the physical visible viewport height, accounting for dynamic toolbars
 * and software virtual keyboards.
 *
 * @returns {number} The current visible viewport height in pixels.
 */
function getVisualHeight() {
  if (typeof window === 'undefined') return 0;
  if (window.visualViewport && typeof window.visualViewport.height === 'number') {
    return window.visualViewport.height;
  }
  return window.innerHeight;
}

/**
 * Reactive hook that keeps the root CSS variable `--app-height` strictly synchronized
 * with the device's visible screen pixels.
 *
 * @returns {{ height: number, isKeyboardOpen: boolean }} Current viewport state.
 */
export function useViewportHeight() {
  const [viewportState, setViewportState] = useState(() => {
    const h = getVisualHeight();
    return {
      height: h,
      isKeyboardOpen: false,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId = null;

    const syncHeight = () => {
      const visualH = getVisualHeight();
      const layoutH = window.innerHeight;

      // Update root CSS variable synchronously
      document.documentElement.style.setProperty('--app-height', `${visualH}px`);

      // Detect virtual keyboard: significant delta between layout height and visual height
      const keyboardThreshold = 140; // minimum pixels for a software keyboard
      const delta = layoutH - visualH;
      const keyboardOpen = delta > keyboardThreshold;

      if (keyboardOpen) {
        document.documentElement.style.setProperty('--keyboard-height', `${delta}px`);
      } else {
        document.documentElement.style.removeProperty('--keyboard-height');
      }

      setViewportState({
        height: visualH,
        isKeyboardOpen: keyboardOpen,
      });
    };

    const handleResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(syncHeight);
    };

    // Initial sync
    syncHeight();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleResize, { passive: true });
      vv.addEventListener('scroll', handleResize, { passive: true });
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (vv) {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      }
    };
  }, []);

  return viewportState;
}

export default useViewportHeight;

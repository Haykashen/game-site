import { useEffect, useRef, useState } from 'react';
import { MODAL_ENTER_DELAY_MS, MODAL_TRANSITION_MS } from '../lib/constants';

interface AnimatedPresence {
  isMounted: boolean;
  isActive: boolean;
}

/**
 * Keeps an element mounted long enough for its CSS transition to play.
 * The enter class is applied one frame later so the slide-in actually animates.
 */
export function useAnimatedPresence(isOpen: boolean): AnimatedPresence {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isActive, setIsActive] = useState(false);
  const enterTimer = useRef<number | undefined>(undefined);
  const exitTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(enterTimer.current);
    window.clearTimeout(exitTimer.current);

    if (isOpen) {
      setIsMounted(true);
      enterTimer.current = window.setTimeout(() => setIsActive(true), MODAL_ENTER_DELAY_MS);
    } else {
      setIsActive(false);
      exitTimer.current = window.setTimeout(() => setIsMounted(false), MODAL_TRANSITION_MS);
    }

    return () => {
      window.clearTimeout(enterTimer.current);
      window.clearTimeout(exitTimer.current);
    };
  }, [isOpen]);

  return { isMounted, isActive };
}

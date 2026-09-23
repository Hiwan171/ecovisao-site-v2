"use client";

import { useEffect, useState } from "react";

/** True only on a device with a real mouse: the custom cursor and the
 * magnetic pull are for a pointer with hover, not a finger. */
export function useFinePointer() {
  const [finePointer, setFinePointer] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
    const updatePreference = () => setFinePointer(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return finePointer;
}

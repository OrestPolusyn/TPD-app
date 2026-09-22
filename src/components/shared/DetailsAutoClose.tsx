"use client";

import { useEffect } from "react";

/**
 * Makes a native <details> behave like a menu: closes on a click outside, on
 * Escape, and on following a link inside it.
 *
 * <details> on its own only closes when its own summary is clicked again, so
 * the mobile nav stayed open over the page after tapping away from it. Kept as
 * a separate island so the menu itself stays server-rendered.
 */
export function DetailsAutoClose({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLDetailsElement)) return;

    const close = () => {
      if (el.open) el.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !el.contains(event.target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // Navigation is client-side, so the menu would otherwise stay open on the
    // page it just navigated to.
    const onClickInside = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a")) close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    el.addEventListener("click", onClickInside);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("click", onClickInside);
    };
  }, [id]);

  return null;
}

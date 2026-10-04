import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKonami } from "@/hooks/useKonami";

const SEQUENCE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

function pressKey(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));
  });
}

function pressSequence(keys: string[]) {
  for (const key of keys) pressKey(key);
}

describe("useKonami", () => {
  it("calls onComplete after the full sequence", () => {
    const onComplete = vi.fn();
    renderHook(() => useKonami(onComplete));

    pressSequence(SEQUENCE);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("is case-insensitive for the letters", () => {
    const onComplete = vi.fn();
    renderHook(() => useKonami(onComplete));

    pressSequence([...SEQUENCE.slice(0, 8), "B", "A"]);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does not fire on a partial sequence", () => {
    const onComplete = vi.fn();
    renderHook(() => useKonami(onComplete));

    pressSequence(SEQUENCE.slice(0, 9));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("resets progress on an unrelated key, then still works", () => {
    const onComplete = vi.fn();
    renderHook(() => useKonami(onComplete));

    pressSequence(["ArrowUp", "ArrowUp", "x", ...SEQUENCE]);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("re-matches from the sequence start when a new ↑ begins after a mismatch", () => {
    const onComplete = vi.fn();
    renderHook(() => useKonami(onComplete));

    // ↑↑ puts progress at 2; a third ↑ re-matches to progress 1, so one
    // more ↑ plus D D L R L R B A completes it. Without the re-match the
    // third ↑ would reset to 0 and this exact input would never fire.
    pressSequence(["ArrowUp", "ArrowUp", "ArrowUp", "ArrowUp", ...SEQUENCE.slice(2)]);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("can be triggered again after firing", () => {
    const onComplete = vi.fn();
    renderHook(() => useKonami(onComplete));

    pressSequence(SEQUENCE);
    pressSequence(SEQUENCE);

    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it("ignores key repeat", () => {
    const onComplete = vi.fn();
    renderHook(() => useKonami(onComplete));

    pressSequence(SEQUENCE.map((key) => key));
    // Re-press the whole sequence while holding a key (repeat: true)
    for (const key of SEQUENCE) pressKey(key, { repeat: true });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

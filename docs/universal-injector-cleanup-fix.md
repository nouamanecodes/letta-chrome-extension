# Universal Injector Cleanup Fix

## Overview

This document describes the fix implemented to address memory leaks and accumulated event listeners in `src/universal-injector.ts`.

## Problem

The previous implementation of the floating container (used in Perplexity strategy 3) attached a `_cleanup` method to the DOM element to remove global scroll/resize listeners. However, this `_cleanup` method was never invoked when the element was removed, leading to efficient listener accumulation over time, especially during SPA navigation or re-renders.

## Solution

We introduced a robust `removeUI()` helper function that centralizes the logic for removing the extension's UI elements and performing necessary cleanup.

### Key Changes

1.  **`removeUI()` Helper**:
    - Checks for the existence of `letta-floating-container` or `buttonHost` (the main button).
    - Checks if the element (or its parent wrapper) has a `_cleanup` method attached.
    - **Crucially calls `_cleanup()`** if it exists to remove `scroll`, `resize`, or requestAnimationFrame loops.
    - Removes the element from the DOM if it is still connected.
    - Resets the global `buttonHost` reference.

2.  **Usage Integration**:
    - **`cleanup()`**: Now calls `removeUI()` to ensure clean teardown on page `beforeunload`.
    - **`setupUrlMonitoring()`**: Calls `removeUI()` when URL changes (SPA navigation) to fully clear old UI before mounting new ones.
    - **`startButtonWatcher()`**: Before re-mounting the button (if detected missing), it calls `removeUI()` to ensure any "zombie" references or listeners from the previous instance are cleared.
    - **`mountButtonOnEditor()`**: Performs a safety check to call `removeUI()` if a `buttonHost` reference exists but we are about to mount a new one.

## Developer Notes

- When adding new UI elements that attach global listeners (window/document level), always attach a `_cleanup` method to the root element.
- Ensure `removeUI()` is updated if new types of UI containers are introduced.
- The `buttonHost` variable tracks the button element, but `buttonHost.parentElement` is the wrapper (root) that usually holds the cleanup logic in the current architecture.

## Related Files

- `src/universal-injector.ts`

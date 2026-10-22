# Stable One-Screen Calculator

## Goal
Make the calculator fit a normal phone screen without page scrolling while keeping every function readable and usable.

## Changes
- Rework the calculator height and spacing around the visible phone area, including safe areas.
- Compact the header, display, scientific controls, number keys, and footer links without shrinking text excessively.
- Keep long calculations inside the display and automatically show the newest digits.
- Correct the declared 512px icon dimensions and optimize oversized PNG files to reduce decoded bitmap memory.
- Preserve dialogs and history scrolling only inside their own panels.

## Verification
- Test on the current 405px phone size and a shorter phone screen.
- Confirm the main page has no vertical or horizontal scrolling.
- Exercise long-number input and core calculator controls.
- Check the production build, runtime logs, icon dimensions, and manifest references.

## Technical details
- Use dynamic viewport units and safe-area insets for stable installed-PWA sizing.
- Use constrained grid tracks for keys so the interface does not grow beyond the viewport.
- Resize and palette-optimize PNG assets at their declared intrinsic dimensions; the calculator itself loads no content bitmaps.

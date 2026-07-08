# art-source

Raw downloaded art packs that are **not** loaded by the game at runtime.
They live outside `assets/` on purpose: `assets/` is the Vite `publicDir`, so
everything in it ships with web builds (itch.io zip). Runtime-used art is
copied into `assets/` (e.g. `assets/cards/embergrove/`, `assets/icons/`).

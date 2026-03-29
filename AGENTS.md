# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Endless Seven is a client-side strategic card game built with TypeScript, React 19, Three.js (3D board), and Vite. There is no backend server or database — the entire game runs in the browser. The AI opponent logic is built in.

### Commands

Standard commands are in `package.json` scripts:

- **Dev server**: `npm run dev` (Vite on port 3000, `--host=0.0.0.0`)
- **Lint**: `npm run lint` (runs `tsc --noEmit`; note: the repo has pre-existing TS errors in test files and a few source files — these are not regressions)
- **Tests**: `npm run test` (Vitest, single run) or `npm run test:watch`
- **Build**: `npm run build` (Vite production build)

### Notes

- The `GEMINI_API_KEY` env var (via `.env.local`) is optional — the core game works without it.
- `better-sqlite3` and `express` are listed as dependencies but are not actively used at runtime; `npm install` may emit native-addon warnings for `better-sqlite3` which are safe to ignore.
- The Electron-related scripts (`electron:dev`, `electron:build`) require a display server and are not needed for web development or testing.
- Lint (`tsc --noEmit`) exits with errors (exit code 2) due to pre-existing type issues in test mocks and a few source files. This is the repo's baseline state.

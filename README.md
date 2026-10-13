# Vitae

Private health monitoring built with React, Capacitor and Supabase.

The existing dashboard now supports manual Garmin Account Management exports
(ZIP or supported JSON files). See [Garmin import setup, formats, privacy and
deployment](docs/garmin-import.md). Automatic Garmin synchronization is not connected.

Run `npm ci`, configure `.env.local` using `.env.example`, then `npm run dev`.
Apply the migrations in `supabase/migrations` to a configured Supabase project
before saving real records. Never put a Supabase service-role key in client code.

Run `npm test` for parser and database authorization tests. `npm run test:browser`
runs the import flow against a synthetic backend after installing Playwright's
Chromium with `npx playwright install chromium`.

## Original Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

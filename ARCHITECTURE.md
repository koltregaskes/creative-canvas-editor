# Architecture

- React + Vite + TypeScript
- lightweight local workflow editor
- manual PWA support
- `creative-project-package-v1` export with `projectType: "creative-canvas-workflow"`

Core files:

- `src/project-package.ts`
- `src/sample-project.ts`
- `src/App.tsx`

Connections are stored in a `connections` array alongside the required project package fields.

# Creative Canvas Editor

Creative Canvas Editor is the node-based orchestration tool for creative generation and collection workflows.

## Included in the current build

- draggable node canvas
- connectable workflow graph
- richer node inspector with lane, status, tags, notes, and outputs
- connection removal and node duplication
- workflow brief, asset requirements, and deliverable planning
- workflow-health audit cards
- execution handoff file that orders steps for local tool sessions without calling them
- save/load workflow JSON
- starter templates for generation, collection, review, and publishing

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4304`

The current sample workflow, Creative Intake Flow, shows how to use the editor as the orchestration layer across:

- image collection and generation: Gather reference frames and Generate key art concepts
- video generation and review: Build motion tests and Review and select
- audio bed composition: Compose audio beds, with a planned Logo sting audio material
- export and publishing handoff: Package deliverables

## Local-Only Files

- `.autolab/` is used for internal AutoResearch and should remain untracked
- `.env*` files are local-only
- `.local/` and `*.local.md` are for planning notes and are ignored

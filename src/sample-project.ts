import { createWorkflowProject, type WorkflowPackage } from './project-package'

export const sampleWorkflowProject: WorkflowPackage = createWorkflowProject('Creative Intake Flow', {
  summary: 'A starter workflow that collects ideas, generates assets, reviews candidates, and exports the final package.',
  status: 'ready-for-review',
  scenes: [
    {
      id: 'node-1',
      template: 'generate-image',
      title: 'Generate image concepts',
      instructions: 'Create first-pass key art and still frames from the brief.',
      outputs: ['keyframes', 'mood stills'],
      x: 80,
      y: 120,
    },
    {
      id: 'node-2',
      template: 'generate-video',
      title: 'Generate motion tests',
      instructions: 'Turn the strongest stills into motion clips and rhythm tests.',
      outputs: ['motion tests'],
      x: 360,
      y: 220,
    },
    {
      id: 'node-3',
      template: 'review-select',
      title: 'Review and shortlist',
      instructions: 'Choose the strongest candidates and annotate what survives to production.',
      outputs: ['shortlist'],
      x: 650,
      y: 140,
    },
  ],
  connections: [
    { id: 'edge-1', from: 'node-1', to: 'node-2' },
    { id: 'edge-2', from: 'node-2', to: 'node-3' },
  ],
})

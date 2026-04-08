export type WorkflowNodeTemplate =
  | 'generate-image'
  | 'collect-image'
  | 'generate-video'
  | 'collect-video'
  | 'generate-music-audio'
  | 'collect-sfx-audio'
  | 'review-select'
  | 'publish-export'

export type WorkflowNode = {
  id: string
  template: WorkflowNodeTemplate
  title: string
  instructions: string
  outputs: string[]
  x: number
  y: number
}

export type WorkflowConnection = {
  id: string
  from: string
  to: string
}

export type WorkflowPackage = {
  formatVersion: 'creative-project-package-v1'
  projectType: 'creative-canvas-workflow'
  title: string
  slug: string
  summary: string
  status: string
  createdAt: string
  updatedAt: string
  inputs: Record<string, unknown>
  scenes: WorkflowNode[]
  assets: { id: string; label: string; type: string; status: string; notes: string }[]
  prompts: unknown[]
  outputs: { id: string; label: string; status: string; target: string }[]
  metrics: Record<string, unknown>
  notes: string[]
  connections: WorkflowConnection[]
}

export const starterTemplates: { id: WorkflowNodeTemplate; title: string }[] = [
  { id: 'generate-image', title: 'Generate Image' },
  { id: 'collect-image', title: 'Collect Image' },
  { id: 'generate-video', title: 'Generate Video' },
  { id: 'collect-video', title: 'Collect Video' },
  { id: 'generate-music-audio', title: 'Generate Music/Audio' },
  { id: 'collect-sfx-audio', title: 'Collect SFX/Audio' },
  { id: 'review-select', title: 'Review / Select' },
  { id: 'publish-export', title: 'Publish / Export' },
]

export function createWorkflowProject(title: string, partial?: Partial<WorkflowPackage>): WorkflowPackage {
  const now = new Date().toISOString()
  return {
    formatVersion: 'creative-project-package-v1',
    projectType: 'creative-canvas-workflow',
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    summary: '',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    inputs: {},
    scenes: [],
    assets: [],
    prompts: [],
    outputs: [],
    metrics: {},
    notes: [],
    connections: [],
    ...partial,
  }
}

export function addNodeFromTemplate(project: WorkflowPackage, templateId: WorkflowNodeTemplate) {
  const title = starterTemplates.find((template) => template.id === templateId)?.title ?? templateId
  const node: WorkflowNode = {
    id: crypto.randomUUID(),
    template: templateId,
    title,
    instructions: `Configure the ${title.toLowerCase()} step.`,
    outputs: [],
    x: 80 + project.scenes.length * 26,
    y: 90 + project.scenes.length * 24,
  }

  const previousNode = project.scenes[project.scenes.length - 1]
  return {
    ...project,
    scenes: [...project.scenes, node],
    connections: previousNode
      ? [
          ...project.connections,
          { id: crypto.randomUUID(), from: previousNode.id, to: node.id },
        ]
      : project.connections,
  }
}

export function parseProjectPackage(raw: string): WorkflowPackage {
  const parsed = JSON.parse(raw) as Partial<WorkflowPackage>
  if (
    parsed.formatVersion !== 'creative-project-package-v1' ||
    parsed.projectType !== 'creative-canvas-workflow'
  ) {
    throw new Error('Expected a creative-canvas-workflow creative-project-package-v1 file.')
  }

  return createWorkflowProject(parsed.title ?? 'Imported Workflow', {
    ...parsed,
    inputs: parsed.inputs ?? {},
    scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
    outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
    metrics: parsed.metrics ?? {},
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    connections: Array.isArray(parsed.connections) ? parsed.connections : [],
  })
}

export function exportProjectPackage(project: WorkflowPackage) {
  const file = new Blob([JSON.stringify(project, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `${project.slug || 'creative-canvas-workflow'}.json`
  link.click()
  URL.revokeObjectURL(url)
}

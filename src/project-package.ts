export type WorkflowNodeTemplate =
  | 'generate-image'
  | 'collect-image'
  | 'generate-video'
  | 'collect-video'
  | 'generate-music-audio'
  | 'collect-sfx-audio'
  | 'review-select'
  | 'publish-export'

export type WorkflowNodeStatus = 'draft' | 'active' | 'ready' | 'blocked'

export type WorkflowLane = 'image' | 'video' | 'audio' | 'review' | 'publish'

export type WorkflowNode = {
  id: string
  template: WorkflowNodeTemplate
  title: string
  instructions: string
  outputs: string[]
  x: number
  y: number
  status: WorkflowNodeStatus
  lane: WorkflowLane
  notes: string
  tags: string[]
}

export type WorkflowConnection = {
  id: string
  from: string
  to: string
}

export type WorkflowAssetRequirement = {
  id: string
  label: string
  type: string
  source: string
  status: string
  notes: string
}

export type WorkflowDeliverable = {
  id: string
  label: string
  status: string
  target: string
  format: string
  notes: string
}

export type WorkflowInputs = {
  brief: string
  channels: string[]
  sourceTools: string[]
  qualityBar: string
  automationNotes: string[]
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
  inputs: WorkflowInputs
  scenes: WorkflowNode[]
  assets: WorkflowAssetRequirement[]
  prompts: unknown[]
  outputs: WorkflowDeliverable[]
  metrics: Record<string, unknown>
  notes: string[]
  connections: WorkflowConnection[]
}

export const templateDefinitions: Record<
  WorkflowNodeTemplate,
  { title: string; lane: WorkflowLane; caption: string }
> = {
  'generate-image': {
    title: 'Generate Image',
    lane: 'image',
    caption: 'Create key art, boards, and still concepts.',
  },
  'collect-image': {
    title: 'Collect Image',
    lane: 'image',
    caption: 'Pull reference stills, selects, and approved frames.',
  },
  'generate-video': {
    title: 'Generate Video',
    lane: 'video',
    caption: 'Create clips, camera passes, and motion tests.',
  },
  'collect-video': {
    title: 'Collect Video',
    lane: 'video',
    caption: 'Gather approved clips, coverage, and cutdowns.',
  },
  'generate-music-audio': {
    title: 'Generate Music/Audio',
    lane: 'audio',
    caption: 'Create score, stems, temp cues, or voice passes.',
  },
  'collect-sfx-audio': {
    title: 'Collect SFX/Audio',
    lane: 'audio',
    caption: 'Gather SFX, atmospheres, and licensed elements.',
  },
  'review-select': {
    title: 'Review / Select',
    lane: 'review',
    caption: 'Shortlist the strongest options and note why.',
  },
  'publish-export': {
    title: 'Publish / Export',
    lane: 'publish',
    caption: 'Prepare deliverables, exports, and handoff packages.',
  },
}

export const starterTemplates = Object.entries(templateDefinitions).map(([id, definition]) => ({
  id: id as WorkflowNodeTemplate,
  title: definition.title,
  caption: definition.caption,
  lane: definition.lane,
}))

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
    inputs: {
      brief: '',
      channels: [],
      sourceTools: [],
      qualityBar: '',
      automationNotes: [],
    },
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

export function createWorkflowNode(templateId: WorkflowNodeTemplate, index = 0): WorkflowNode {
  const definition = templateDefinitions[templateId]

  return {
    id: crypto.randomUUID(),
    template: templateId,
    title: definition.title,
    instructions: `Configure the ${definition.title.toLowerCase()} step.`,
    outputs: [],
    x: 80 + index * 30,
    y: 80 + index * 24,
    status: 'draft',
    lane: definition.lane,
    notes: '',
    tags: [],
  }
}

export function addNodeFromTemplate(project: WorkflowPackage, templateId: WorkflowNodeTemplate) {
  const node = createWorkflowNode(templateId, project.scenes.length)
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

export function cloneWorkflowNode(node: WorkflowNode, index: number): WorkflowNode {
  return {
    ...node,
    id: crypto.randomUUID(),
    title: `${node.title} Copy`,
    x: node.x + 42 + index * 4,
    y: node.y + 42 + index * 4,
  }
}

export function createAssetRequirement(overrides?: Partial<WorkflowAssetRequirement>): WorkflowAssetRequirement {
  return {
    id: crypto.randomUUID(),
    label: 'New asset requirement',
    type: 'Reference',
    source: '',
    status: 'planned',
    notes: '',
    ...overrides,
  }
}

export function createDeliverable(overrides?: Partial<WorkflowDeliverable>): WorkflowDeliverable {
  return {
    id: crypto.randomUUID(),
    label: 'New deliverable',
    status: 'planned',
    target: '',
    format: 'json',
    notes: '',
    ...overrides,
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
    inputs: {
      brief: parsed.inputs?.brief ?? '',
      channels: Array.isArray(parsed.inputs?.channels) ? parsed.inputs.channels : [],
      sourceTools: Array.isArray(parsed.inputs?.sourceTools) ? parsed.inputs.sourceTools : [],
      qualityBar: parsed.inputs?.qualityBar ?? '',
      automationNotes: Array.isArray(parsed.inputs?.automationNotes)
        ? parsed.inputs.automationNotes
        : [],
    },
    scenes: Array.isArray(parsed.scenes)
      ? parsed.scenes.map((node, index) => {
          const fallback = createWorkflowNode(node.template ?? 'review-select', index)
          return {
            ...fallback,
            ...node,
            status: node.status ?? fallback.status,
            lane: node.lane ?? fallback.lane,
            notes: node.notes ?? '',
            tags: Array.isArray(node.tags) ? node.tags : [],
            outputs: Array.isArray(node.outputs) ? node.outputs : [],
          }
        })
      : [],
    assets: Array.isArray(parsed.assets)
      ? parsed.assets.map((asset) => ({
          ...createAssetRequirement(),
          ...asset,
        }))
      : [],
    prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
    outputs: Array.isArray(parsed.outputs)
      ? parsed.outputs.map((output) => ({
          ...createDeliverable(),
          ...output,
        }))
      : [],
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

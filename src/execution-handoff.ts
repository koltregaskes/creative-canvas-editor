import type {
  WorkflowLane,
  WorkflowNode,
  WorkflowNodeStatus,
  WorkflowNodeTemplate,
  WorkflowPackage,
} from './project-package'

export type ExecutionHandoffInput = {
  nodeId: string
  title: string
  outputs: string[]
}

export type ExecutionHandoffStep = {
  order: number
  nodeId: string
  title: string
  template: WorkflowNodeTemplate
  lane: WorkflowLane
  status: WorkflowNodeStatus
  targetTool: string
  targetSession: string
  action: string
  mode: 'file-handoff'
  instructions: string
  notes: string
  inputsFrom: ExecutionHandoffInput[]
  expectedOutputs: string[]
  blocked: boolean
}

export type ExecutionHandoff = {
  formatVersion: 'creative-canvas-handoff-v1'
  projectType: 'creative-canvas-workflow-handoff'
  connectorMode: 'file-handoff'
  liveConnectors: false
  disclaimer: string
  generatedAt: string
  source: {
    title: string
    slug: string
    summary: string
    formatVersion: 'creative-project-package-v1'
    projectType: 'creative-canvas-workflow'
  }
  brief: string
  qualityBar: string
  channels: string[]
  sourceTools: string[]
  ready: boolean
  blockers: string[]
  steps: ExecutionHandoffStep[]
}

const handoffTargets: Record<
  WorkflowNodeTemplate,
  { tool: string; session: string; action: string }
> = {
  'generate-image': {
    tool: 'comic-book-generator',
    session: 'comic-book-generator-session',
    action: 'Generate stills from the step instructions and return the listed outputs as files.',
  },
  'collect-image': {
    tool: 'comic-book-generator',
    session: 'comic-book-generator-session',
    action: 'Collect approved stills and reference frames. Do not generate new images in this step.',
  },
  'generate-video': {
    tool: 'comic-book-video-generator',
    session: 'comic-book-video-generator-session',
    action: 'Generate motion from the upstream stills using the step instructions.',
  },
  'collect-video': {
    tool: 'comic-book-video-generator',
    session: 'comic-book-video-generator-session',
    action: 'Collect approved clips and cutdowns. Do not render new video in this step.',
  },
  'generate-music-audio': {
    tool: 'music-video-generator',
    session: 'music-video-generator-session',
    action: 'Generate score, stems, or voice passes that match the step instructions.',
  },
  'collect-sfx-audio': {
    tool: 'music-video-generator',
    session: 'music-video-generator-session',
    action: 'Collect SFX and atmospheres. Do not compose new music in this step.',
  },
  'review-select': {
    tool: 'creative-canvas-editor',
    session: 'creative-canvas-editor-session',
    action: 'Review the upstream outputs in this editor and record the shortlist on the step.',
  },
  'publish-export': {
    tool: 'creative-canvas-editor',
    session: 'creative-canvas-editor-session',
    action: 'Export the workflow package and this handoff file. No external publisher is connected.',
  },
}

const disclaimer =
  'This file is a local execution handoff. It names the tool session that should run each step. It does not call those tools.'

function sceneIndex(project: WorkflowPackage) {
  return new Map(project.scenes.map((node, index) => [node.id, index]))
}

function bySceneOrder(ids: string[], orderIndex: Map<string, number>) {
  return [...ids].sort((left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0))
}

export function planExecutionHandoff(project: WorkflowPackage, generatedAt: string): ExecutionHandoff {
  const nodeById = new Map(project.scenes.map((node) => [node.id, node]))
  const orderIndex = sceneIndex(project)
  const indegree = new Map(project.scenes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>(project.scenes.map((node) => [node.id, []]))
  const incoming = new Map<string, string[]>(project.scenes.map((node) => [node.id, []]))
  const seenEdges = new Set<string>()
  const selfLoopIds = new Set<string>()
  let danglingEdges = 0

  for (const edge of project.connections) {
    const key = `${edge.from}->${edge.to}`
    if (seenEdges.has(key)) {
      continue
    }
    seenEdges.add(key)

    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) {
      danglingEdges += 1
      continue
    }

    if (edge.from === edge.to) {
      selfLoopIds.add(edge.from)
      continue
    }

    outgoing.get(edge.from)?.push(edge.to)
    incoming.get(edge.to)?.push(edge.from)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  }

  const queue = bySceneOrder(
    project.scenes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id),
    orderIndex,
  )
  const ordered: string[] = []

  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) {
      break
    }
    ordered.push(id)
    const unlocked: string[] = []
    for (const next of outgoing.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 1) - 1
      indegree.set(next, remaining)
      if (remaining === 0) {
        unlocked.push(next)
      }
    }
    queue.push(...bySceneOrder(unlocked, orderIndex))
  }

  const cyclicIds = bySceneOrder(
    project.scenes.map((node) => node.id).filter((id) => !ordered.includes(id)),
    orderIndex,
  )
  ordered.push(...cyclicIds)

  const blockers: string[] = []
  if (project.scenes.length === 0) {
    blockers.push('Add at least one step before handing this workflow to another session.')
  }
  if (selfLoopIds.size > 0) {
    const titles = bySceneOrder([...selfLoopIds], orderIndex)
      .map((id) => nodeById.get(id)?.title ?? id)
      .join(', ')
    blockers.push(
      `Self-loop: ${titles} ${selfLoopIds.size === 1 ? 'cannot depend on itself' : 'cannot depend on themselves'}.`,
    )
  }
  if (danglingEdges > 0) {
    blockers.push(
      `Ignored ${danglingEdges} connection${danglingEdges === 1 ? '' : 's'} that point at a missing node.`,
    )
  }
  if (cyclicIds.length > 0) {
    const titles = cyclicIds.map((id) => nodeById.get(id)?.title ?? id).join(', ')
    blockers.push(`Cycle: untangle ${titles} before a session runs those steps.`)
  }

  const blockedNodes = project.scenes.filter((node) => node.status === 'blocked')
  if (blockedNodes.length > 0) {
    blockers.push(
      `${blockedNodes.length} blocked node${blockedNodes.length === 1 ? '' : 's'}: ${blockedNodes
        .map((node) => node.title)
        .join(', ')}.`,
    )
  }

  const problemIds = new Set<string>([...selfLoopIds, ...cyclicIds])

  const steps: ExecutionHandoffStep[] = ordered.map((id, index) => {
    const node = nodeById.get(id)
    if (!node) {
      throw new Error(`Missing workflow node ${id} while building the handoff.`)
    }
    const target = handoffTargets[node.template]
    const inputsFrom = (incoming.get(id) ?? [])
      .map((sourceId) => nodeById.get(sourceId))
      .filter((source): source is WorkflowNode => source !== undefined)
      .map((source) => ({
        nodeId: source.id,
        title: source.title,
        outputs: source.outputs,
      }))

    return {
      order: index + 1,
      nodeId: node.id,
      title: node.title,
      template: node.template,
      lane: node.lane,
      status: node.status,
      targetTool: target.tool,
      targetSession: target.session,
      action: target.action,
      mode: 'file-handoff',
      instructions: node.instructions,
      notes: node.notes,
      inputsFrom,
      expectedOutputs: node.outputs,
      blocked: node.status === 'blocked' || problemIds.has(node.id),
    }
  })

  return {
    formatVersion: 'creative-canvas-handoff-v1',
    projectType: 'creative-canvas-workflow-handoff',
    connectorMode: 'file-handoff',
    liveConnectors: false,
    disclaimer,
    generatedAt,
    source: {
      title: project.title,
      slug: project.slug,
      summary: project.summary,
      formatVersion: project.formatVersion,
      projectType: project.projectType,
    },
    brief: project.inputs.brief,
    qualityBar: project.inputs.qualityBar,
    channels: project.inputs.channels,
    sourceTools: project.inputs.sourceTools,
    ready: blockers.length === 0,
    blockers,
    steps,
  }
}

export function downloadExecutionHandoff(handoff: ExecutionHandoff) {
  const file = new Blob([JSON.stringify(handoff, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = `${handoff.source.slug || 'creative-canvas-workflow'}-handoff.json`
  link.click()
  URL.revokeObjectURL(url)
}

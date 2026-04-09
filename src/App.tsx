import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  addNodeFromTemplate,
  cloneWorkflowNode,
  createAssetRequirement,
  createDeliverable,
  exportProjectPackage,
  parseProjectPackage,
  starterTemplates,
  templateDefinitions,
  type WorkflowAssetRequirement,
  type WorkflowDeliverable,
  type WorkflowLane,
  type WorkflowNode,
  type WorkflowNodeStatus,
  type WorkflowNodeTemplate,
  type WorkflowPackage,
} from './project-package'
import { sampleWorkflowProject } from './sample-project'

const STORAGE_KEY = 'creative-canvas-editor.project'

type DragState = {
  id: string
  offsetX: number
  offsetY: number
} | null

const workflowStatuses: WorkflowNodeStatus[] = ['draft', 'active', 'ready', 'blocked']
const workflowLanes: WorkflowLane[] = ['image', 'video', 'audio', 'review', 'publish']

function loadInitialProject() {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (!saved) {
    return sampleWorkflowProject
  }

  try {
    return parseProjectPackage(saved)
  } catch {
    return sampleWorkflowProject
  }
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function splitCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function App() {
  const initialProject = useMemo(loadInitialProject, [])
  const [project, setProject] = useState<WorkflowPackage>(initialProject)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialProject.scenes[0]?.id ?? null)
  const [dragState, setDragState] = useState<DragState>(null)
  const [importMessage, setImportMessage] = useState('Ready')
  const [linkTargetId, setLinkTargetId] = useState('')
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const persist = (nextProject: WorkflowPackage) => {
    setProject(nextProject)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject, null, 2))
  }

  const updateProject = (updater: (current: WorkflowPackage) => WorkflowPackage) => {
    setProject((current) => {
      const nextProject = updater(current)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProject, null, 2))
      return nextProject
    })
  }

  const selectedNode = project.scenes.find((node) => node.id === selectedNodeId) ?? null

  useEffect(() => {
    if (!selectedNodeId && project.scenes[0]?.id) {
      setSelectedNodeId(project.scenes[0].id)
      return
    }

    if (selectedNodeId && !project.scenes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(project.scenes[0]?.id ?? null)
    }
  }, [project.scenes, selectedNodeId])

  useEffect(() => {
    if (!dragState) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const canvasBounds = canvasRef.current?.getBoundingClientRect()
      if (!canvasBounds) {
        return
      }

      updateProject((current) => ({
        ...current,
        scenes: current.scenes.map((node) =>
          node.id === dragState.id
            ? {
                ...node,
                x: event.clientX - canvasBounds.left - dragState.offsetX,
                y: event.clientY - canvasBounds.top - dragState.offsetY,
              }
            : node,
        ),
        updatedAt: new Date().toISOString(),
      }))
    }

    const handlePointerUp = () => {
      setDragState(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [dragState])

  const nodeLookup = useMemo(
    () => Object.fromEntries(project.scenes.map((node) => [node.id, node])),
    [project.scenes],
  )

  const metrics = useMemo(() => {
    const outgoing = new Set(project.connections.map((connection) => connection.from))
    const incoming = new Set(project.connections.map((connection) => connection.to))
    const blockedNodes = project.scenes.filter((node) => node.status === 'blocked').length
    const activeNodes = project.scenes.filter((node) => node.status === 'active').length
    const isolatedNodes = project.scenes.filter(
      (node) => !incoming.has(node.id) && !outgoing.has(node.id),
    ).length

    return {
      nodes: project.scenes.length,
      edges: project.connections.length,
      activeNodes,
      blockedNodes,
      isolatedNodes,
      deliverables: project.outputs.length,
      selected: selectedNode?.template ?? 'none',
      laneCounts: workflowLanes.map((lane) => ({
        lane,
        count: project.scenes.filter((node) => node.lane === lane).length,
      })),
      terminalNodes: project.scenes.filter((node) => !outgoing.has(node.id)),
    }
  }, [project.connections, project.outputs.length, project.scenes, selectedNode])

  const canvasWidth = useMemo(
    () => Math.max(1280, ...project.scenes.map((node) => node.x + 320)),
    [project.scenes],
  )
  const canvasHeight = useMemo(
    () => Math.max(680, ...project.scenes.map((node) => node.y + 180)),
    [project.scenes],
  )

  const handleImportClick = () => fileInputRef.current?.click()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(project, null, 2))
      setImportMessage('Copied workflow JSON')
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : 'Copy failed. Check browser clipboard permissions.',
      )
    }
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const nextProject = parseProjectPackage(text)
      persist(nextProject)
      setSelectedNodeId(nextProject.scenes[0]?.id ?? null)
      setImportMessage(`Imported ${file.name}`)
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : 'Import failed. Check the workflow JSON.',
      )
    } finally {
      event.target.value = ''
    }
  }

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setDragState({
      id,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
    })
  }

  const updateSelectedNode = (updater: (node: WorkflowNode) => WorkflowNode) => {
    if (!selectedNode) {
      return
    }

    updateProject((current) => ({
      ...current,
      scenes: current.scenes.map((node) => (node.id === selectedNode.id ? updater(node) : node)),
      updatedAt: new Date().toISOString(),
    }))
  }

  const connectSelectedNode = () => {
    if (!selectedNode || !linkTargetId || selectedNode.id === linkTargetId) {
      return
    }

    updateProject((current) => {
      const duplicate = current.connections.some(
        (connection) => connection.from === selectedNode.id && connection.to === linkTargetId,
      )
      if (duplicate) {
        return current
      }

      return {
        ...current,
        connections: [
          ...current.connections,
          { id: crypto.randomUUID(), from: selectedNode.id, to: linkTargetId },
        ],
        updatedAt: new Date().toISOString(),
      }
    })
    setLinkTargetId('')
  }

  const removeConnection = (connectionId: string) => {
    updateProject((current) => ({
      ...current,
      connections: current.connections.filter((connection) => connection.id !== connectionId),
      updatedAt: new Date().toISOString(),
    }))
  }

  const duplicateSelectedNode = () => {
    if (!selectedNode) {
      return
    }

    updateProject((current) => {
      const duplicate = cloneWorkflowNode(selectedNode, current.scenes.length)
      return {
        ...current,
        scenes: [...current.scenes, duplicate],
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const deleteSelectedNode = () => {
    if (!selectedNode) {
      return
    }

    updateProject((current) => ({
      ...current,
      scenes: current.scenes.filter((node) => node.id !== selectedNode.id),
      connections: current.connections.filter(
        (connection) => connection.from !== selectedNode.id && connection.to !== selectedNode.id,
      ),
      updatedAt: new Date().toISOString(),
    }))
    setSelectedNodeId(null)
    setLinkTargetId('')
  }

  const updateAsset = (
    assetId: string,
    updater: (asset: WorkflowAssetRequirement) => WorkflowAssetRequirement,
  ) => {
    updateProject((current) => ({
      ...current,
      assets: current.assets.map((asset) => (asset.id === assetId ? updater(asset) : asset)),
      updatedAt: new Date().toISOString(),
    }))
  }

  const updateDeliverable = (
    deliverableId: string,
    updater: (deliverable: WorkflowDeliverable) => WorkflowDeliverable,
  ) => {
    updateProject((current) => ({
      ...current,
      outputs: current.outputs.map((output) =>
        output.id === deliverableId ? updater(output) : output,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Creative Orchestration</span>
          <h1>Creative Canvas Editor</h1>
          <p>
            Map the real generation pipeline for images, video, and audio. This editor now tracks
            workflow health, asset requirements, delivery targets, and the exact creative steps you
            want other tools and sessions to follow.
          </p>
          <div className="hero-actions">
            <button onClick={() => exportProjectPackage(project)}>Export Workflow</button>
            <button className="secondary" onClick={handleCopy}>
              Copy JSON
            </button>
            <button className="secondary" onClick={handleImportClick}>
              Import Workflow
            </button>
            <button
              className="ghost"
              onClick={() => {
                persist(sampleWorkflowProject)
                setSelectedNodeId(sampleWorkflowProject.scenes[0]?.id ?? null)
                setImportMessage('Sample workflow loaded')
              }}
            >
              Load Sample
            </button>
          </div>
          <p className="helper-text">{importMessage}</p>
          <div className="lane-strip">
            {metrics.laneCounts.map((lane) => (
              <div key={lane.lane} className="lane-chip">
                <span>{lane.lane}</span>
                <strong>{lane.count}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="metric-grid">
          <MetricCard label="Nodes" value={String(metrics.nodes)} />
          <MetricCard label="Active" value={String(metrics.activeNodes)} />
          <MetricCard label="Blocked" value={String(metrics.blockedNodes)} />
          <MetricCard label="Deliverables" value={String(metrics.deliverables)} />
        </div>
      </header>

      <main className="workspace-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Direction</span>
              <h2>Workflow brief</h2>
            </div>
          </div>
          <label className="field">
            <span>Workflow title</span>
            <input
              value={project.title}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  title: event.target.value,
                  slug: event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, ''),
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
          <label className="field field-textarea">
            <span>Summary</span>
            <textarea
              rows={4}
              value={project.summary}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  summary: event.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
          <label className="field field-textarea">
            <span>Brief</span>
            <textarea
              rows={6}
              value={project.inputs.brief}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  inputs: { ...current.inputs, brief: event.target.value },
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
          <label className="field field-textarea">
            <span>Quality bar</span>
            <textarea
              rows={4}
              value={project.inputs.qualityBar}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  inputs: { ...current.inputs, qualityBar: event.target.value },
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
          <label className="field">
            <span>Channels</span>
            <input
              value={project.inputs.channels.join(', ')}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  inputs: { ...current.inputs, channels: splitCommaList(event.target.value) },
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
          <label className="field">
            <span>Linked tools</span>
            <input
              value={project.inputs.sourceTools.join(', ')}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  inputs: { ...current.inputs, sourceTools: splitCommaList(event.target.value) },
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
          <label className="field field-textarea">
            <span>Automation notes</span>
            <textarea
              rows={5}
              value={project.inputs.automationNotes.join('\n')}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  inputs: { ...current.inputs, automationNotes: splitLines(event.target.value) },
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
        </section>

        <section className="panel panel-wide">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Canvas</span>
              <h2>Workflow map</h2>
            </div>
          </div>
          <div className="template-grid">
            {starterTemplates.map((template) => (
              <button
                key={template.id}
                className="template-button"
                onClick={() =>
                  updateProject((current) => ({
                    ...addNodeFromTemplate(current, template.id),
                    updatedAt: new Date().toISOString(),
                  }))
                }
              >
                <strong>{template.title}</strong>
                <span>{template.caption}</span>
              </button>
            ))}
          </div>
          <div className="canvas-surface" ref={canvasRef}>
            <div className="canvas-stage" style={{ width: canvasWidth, height: canvasHeight }}>
              <svg
                className="canvas-links"
                viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
                preserveAspectRatio="none"
              >
                {project.connections.map((connection) => {
                  const from = nodeLookup[connection.from]
                  const to = nodeLookup[connection.to]
                  if (!from || !to) {
                    return null
                  }

                  return (
                    <line
                      key={connection.id}
                      x1={from.x + 140}
                      y1={from.y + 42}
                      x2={to.x + 140}
                      y2={to.y + 42}
                      stroke="rgba(126, 249, 174, 0.45)"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>
              {project.scenes.map((node) => (
                <button
                  key={node.id}
                  className={`canvas-node node-${node.status} ${selectedNodeId === node.id ? 'is-selected' : ''}`}
                  style={{ left: node.x, top: node.y }}
                  onPointerDown={(event) => startDrag(event, node.id)}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <span className="node-meta">
                    {node.lane} · {node.status}
                  </span>
                  <strong>{node.title}</strong>
                  <small>{templateDefinitions[node.template].caption}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="connection-list">
            {project.connections.map((connection) => (
              <div key={connection.id} className="connection-row">
                <span>
                  {nodeLookup[connection.from]?.title ?? 'Unknown'} →{' '}
                  {nodeLookup[connection.to]?.title ?? 'Unknown'}
                </span>
                <button className="ghost tiny" onClick={() => removeConnection(connection.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Inspector</span>
              <h2>Selected node</h2>
            </div>
          </div>
          {selectedNode ? (
            <>
              <div className="hero-actions compact-actions">
                <button className="secondary" onClick={duplicateSelectedNode}>
                  Duplicate Node
                </button>
                <button className="secondary" onClick={connectSelectedNode} disabled={!linkTargetId}>
                  Link To Node
                </button>
                <button className="ghost" onClick={deleteSelectedNode}>
                  Delete Node
                </button>
              </div>
              <label className="field">
                <span>Node title</span>
                <input
                  value={selectedNode.title}
                  onChange={(event) =>
                    updateSelectedNode((node) => ({ ...node, title: event.target.value }))
                  }
                />
              </label>
              <div className="field-grid">
                <label className="field">
                  <span>Template</span>
                  <select
                    value={selectedNode.template}
                    onChange={(event) => {
                      const template = event.target.value as WorkflowNodeTemplate
                      updateSelectedNode((node) => ({
                        ...node,
                        template,
                        lane: templateDefinitions[template].lane,
                      }))
                    }}
                  >
                    {starterTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    value={selectedNode.status}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        status: event.target.value as WorkflowNodeStatus,
                      }))
                    }
                  >
                    {workflowStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>Lane</span>
                  <select
                    value={selectedNode.lane}
                    onChange={(event) =>
                      updateSelectedNode((node) => ({
                        ...node,
                        lane: event.target.value as WorkflowLane,
                      }))
                    }
                  >
                    {workflowLanes.map((lane) => (
                      <option key={lane} value={lane}>
                        {lane}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Connect to</span>
                  <select value={linkTargetId} onChange={(event) => setLinkTargetId(event.target.value)}>
                    <option value="">Choose node</option>
                    {project.scenes
                      .filter((node) => node.id !== selectedNode.id)
                      .map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.title}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label className="field field-textarea">
                <span>Instructions</span>
                <textarea
                  rows={6}
                  value={selectedNode.instructions}
                  onChange={(event) =>
                    updateSelectedNode((node) => ({ ...node, instructions: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Outputs</span>
                <input
                  value={selectedNode.outputs.join(', ')}
                  onChange={(event) =>
                    updateSelectedNode((node) => ({
                      ...node,
                      outputs: splitCommaList(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Tags</span>
                <input
                  value={selectedNode.tags.join(', ')}
                  onChange={(event) =>
                    updateSelectedNode((node) => ({ ...node, tags: splitCommaList(event.target.value) }))
                  }
                />
              </label>
              <label className="field field-textarea">
                <span>Node notes</span>
                <textarea
                  rows={4}
                  value={selectedNode.notes}
                  onChange={(event) =>
                    updateSelectedNode((node) => ({ ...node, notes: event.target.value }))
                  }
                />
              </label>
            </>
          ) : (
            <p className="helper-text">Select a node to edit its details.</p>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Assets</span>
              <h2>Required materials</h2>
            </div>
            <button
              className="secondary tiny"
              onClick={() =>
                updateProject((current) => ({
                  ...current,
                  assets: [...current.assets, createAssetRequirement()],
                  updatedAt: new Date().toISOString(),
                }))
              }
            >
              Add Asset
            </button>
          </div>
          <div className="stack-list">
            {project.assets.map((asset) => (
              <div key={asset.id} className="stack-card">
                <div className="field-grid">
                  <label className="field">
                    <span>Label</span>
                    <input
                      value={asset.label}
                      onChange={(event) =>
                        updateAsset(asset.id, (current) => ({ ...current, label: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <input
                      value={asset.type}
                      onChange={(event) =>
                        updateAsset(asset.id, (current) => ({ ...current, type: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label className="field">
                    <span>Source</span>
                    <input
                      value={asset.source}
                      onChange={(event) =>
                        updateAsset(asset.id, (current) => ({ ...current, source: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <input
                      value={asset.status}
                      onChange={(event) =>
                        updateAsset(asset.id, (current) => ({ ...current, status: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <label className="field field-textarea">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={asset.notes}
                    onChange={(event) =>
                      updateAsset(asset.id, (current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Deliverables</span>
              <h2>Release targets</h2>
            </div>
            <button
              className="secondary tiny"
              onClick={() =>
                updateProject((current) => ({
                  ...current,
                  outputs: [...current.outputs, createDeliverable()],
                  updatedAt: new Date().toISOString(),
                }))
              }
            >
              Add Deliverable
            </button>
          </div>
          <div className="stack-list">
            {project.outputs.map((output) => (
              <div key={output.id} className="stack-card">
                <div className="field-grid">
                  <label className="field">
                    <span>Label</span>
                    <input
                      value={output.label}
                      onChange={(event) =>
                        updateDeliverable(output.id, (current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Status</span>
                    <input
                      value={output.status}
                      onChange={(event) =>
                        updateDeliverable(output.id, (current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="field-grid">
                  <label className="field">
                    <span>Target</span>
                    <input
                      value={output.target}
                      onChange={(event) =>
                        updateDeliverable(output.id, (current) => ({
                          ...current,
                          target: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Format</span>
                    <input
                      value={output.format}
                      onChange={(event) =>
                        updateDeliverable(output.id, (current) => ({
                          ...current,
                          format: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="field field-textarea">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={output.notes}
                    onChange={(event) =>
                      updateDeliverable(output.id, (current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Audit</span>
              <h2>Workflow health</h2>
            </div>
          </div>
          <div className="audit-grid">
            <MetricCard label="Connections" value={String(metrics.edges)} compact />
            <MetricCard label="Isolated" value={String(metrics.isolatedNodes)} compact />
            <MetricCard label="Terminal nodes" value={String(metrics.terminalNodes.length)} compact />
            <MetricCard label="Selected" value={metrics.selected} compact />
          </div>
          <div className="terminal-list">
            {metrics.terminalNodes.map((node) => (
              <span key={node.id} className="terminal-chip">
                {node.title}
              </span>
            ))}
          </div>
          <label className="field field-textarea">
            <span>Workflow notes</span>
            <textarea
              rows={6}
              value={project.notes.join('\n')}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  notes: splitLines(event.target.value),
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
        </section>
      </main>

      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept="application/json"
        onChange={handleImport}
      />
    </div>
  )
}

type MetricCardProps = {
  label: string
  value: string
  compact?: boolean
}

function MetricCard({ label, value, compact = false }: MetricCardProps) {
  return (
    <div className={`metric-card ${compact ? 'compact' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App

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
  exportProjectPackage,
  parseProjectPackage,
  starterTemplates,
  type WorkflowPackage,
} from './project-package'
import { sampleWorkflowProject } from './sample-project'

const STORAGE_KEY = 'creative-canvas-editor.project'

type DragState = {
  id: string
  offsetX: number
  offsetY: number
} | null

function App() {
  const [project, setProject] = useState<WorkflowPackage>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return sampleWorkflowProject
    }

    try {
      return parseProjectPackage(saved)
    } catch {
      return sampleWorkflowProject
    }
  })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    sampleWorkflowProject.scenes[0]?.id ?? null,
  )
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
    persist(updater(project))
  }

  const selectedNode = project.scenes.find((node) => node.id === selectedNodeId) ?? null

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
  }, [dragState, project])

  const metrics = useMemo(
    () => ({
      nodes: project.scenes.length,
      edges: project.connections.length,
      selected: selectedNode?.template ?? 'None',
    }),
    [project, selectedNode],
  )

  const handleImportClick = () => fileInputRef.current?.click()

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

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Creative Orchestration</span>
          <h1>Creative Canvas Editor</h1>
          <p>
            Build node-based workflows for generating, collecting, reviewing, and publishing
            creative assets. Export the workflow as a `creative-project-package-v1` package.
          </p>
          <div className="hero-actions">
            <button onClick={() => exportProjectPackage(project)}>Export Workflow</button>
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
        </div>
        <div className="metric-grid">
          <MetricCard label="Nodes" value={String(metrics.nodes)} />
          <MetricCard label="Edges" value={String(metrics.edges)} />
          <MetricCard label="Selected" value={metrics.selected} />
        </div>
      </header>

      <main className="workspace-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Templates</span>
              <h2>Starter nodes</h2>
            </div>
          </div>
          <div className="stack-list">
            {starterTemplates.map((template) => (
              <button
                key={template.id}
                className="secondary"
                onClick={() =>
                  updateProject((current) => ({
                    ...addNodeFromTemplate(current, template.id),
                    updatedAt: new Date().toISOString(),
                  }))
                }
              >
                {template.title}
              </button>
            ))}
          </div>
          <div className="panel-heading" style={{ marginTop: '1rem' }}>
            <div>
              <span className="panel-kicker">Workflow</span>
              <h2>Project metadata</h2>
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
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
          <label className="field field-textarea">
            <span>Summary</span>
            <textarea
              rows={5}
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
            <span>Workflow notes</span>
            <textarea
              rows={6}
              value={project.notes.join('\n')}
              onChange={(event) =>
                updateProject((current) => ({
                  ...current,
                  notes: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Canvas</span>
              <h2>Node graph</h2>
            </div>
          </div>
          <div className="canvas-surface" ref={canvasRef}>
            <svg className="canvas-links" viewBox="0 0 960 560" preserveAspectRatio="none">
              {project.connections.map((connection) => {
                const from = project.scenes.find((node) => node.id === connection.from)
                const to = project.scenes.find((node) => node.id === connection.to)
                if (!from || !to) {
                  return null
                }

                return (
                  <line
                    key={connection.id}
                    x1={from.x + 120}
                    y1={from.y + 32}
                    x2={to.x + 120}
                    y2={to.y + 32}
                    stroke="rgba(142, 243, 255, 0.45)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                )
              })}
            </svg>
            {project.scenes.map((node) => (
              <button
                key={node.id}
                className={`canvas-node ${selectedNodeId === node.id ? 'is-selected' : ''}`}
                style={{ left: node.x, top: node.y }}
                onPointerDown={(event) => startDrag(event, node.id)}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <strong>{node.title}</strong>
                <span>{node.template}</span>
              </button>
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
              <div className="hero-actions" style={{ marginTop: 0 }}>
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
                    updateProject((current) => ({
                      ...current,
                      scenes: current.scenes.map((node) =>
                        node.id === selectedNode.id ? { ...node, title: event.target.value } : node,
                      ),
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                />
              </label>
              <label className="field field-textarea">
                <span>Instructions</span>
                <textarea
                  rows={8}
                  value={selectedNode.instructions}
                  onChange={(event) =>
                    updateProject((current) => ({
                      ...current,
                      scenes: current.scenes.map((node) =>
                        node.id === selectedNode.id
                          ? { ...node, instructions: event.target.value }
                          : node,
                      ),
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Outputs</span>
                <input
                  value={selectedNode.outputs.join(', ')}
                  onChange={(event) =>
                    updateProject((current) => ({
                      ...current,
                      scenes: current.scenes.map((node) =>
                        node.id === selectedNode.id
                          ? {
                              ...node,
                              outputs: event.target.value
                                .split(',')
                                .map((item) => item.trim())
                                .filter(Boolean),
                            }
                          : node,
                      ),
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                />
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
            </>
          ) : (
            <p className="helper-text">Select a node to edit its details.</p>
          )}
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
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default App

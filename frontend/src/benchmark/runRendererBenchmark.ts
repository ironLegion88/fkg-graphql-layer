import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { Graph as CosmosGraph } from '@cosmos.gl/graph'

import { generateRendererFixture } from './generateFixture'

type RendererName = 'cytoscape' | 'cosmos'

export interface RendererBenchmarkResult {
  status: 'ok' | 'error'
  renderer: RendererName
  nodeCount: number
  edgeCount: number
  generationMs: number
  initializationMs?: number
  interactionMs?: number
  heapUsedBytes?: number
  error?: string
}

declare global {
  interface Window {
    __GRAPH_BENCHMARK__?: RendererBenchmarkResult
  }
}

export async function runRendererBenchmark(): Promise<void> {
  const parameters = new URLSearchParams(window.location.search)
  const renderer = parseRenderer(parameters.get('renderer'))
  const nodeCount = parseCount(parameters.get('nodes'), 1_000)
  const edgeCount = parseCount(parameters.get('edges'), nodeCount * 2, true)
  const root = preparePage(renderer, nodeCount, edgeCount)
  const generatedAt = performance.now()

  try {
    const fixture = generateRendererFixture(nodeCount, edgeCount)
    const generationMs = performance.now() - generatedAt
    const initializedAt = performance.now()
    const cleanup =
      renderer === 'cytoscape'
        ? await mountCytoscape(root, fixture)
        : await mountCosmos(root, fixture)
    const initializationMs = performance.now() - initializedAt
    const interactionMs = await measureWheelInteraction(root)
    const result: RendererBenchmarkResult = {
      status: 'ok',
      renderer,
      nodeCount,
      edgeCount,
      generationMs: rounded(generationMs),
      initializationMs: rounded(initializationMs),
      interactionMs: rounded(interactionMs),
      heapUsedBytes: performanceMemory(),
    }
    window.__GRAPH_BENCHMARK__ = result
    renderResult(result)
    window.addEventListener('pagehide', cleanup, { once: true })
  } catch (error) {
    const result: RendererBenchmarkResult = {
      status: 'error',
      renderer,
      nodeCount,
      edgeCount,
      generationMs: rounded(performance.now() - generatedAt),
      error: error instanceof Error ? error.message : String(error),
    }
    window.__GRAPH_BENCHMARK__ = result
    renderResult(result)
  }
}

async function mountCytoscape(
  container: HTMLDivElement,
  fixture: ReturnType<typeof generateRendererFixture>,
): Promise<() => void> {
  const elements: ElementDefinition[] = []
  for (let index = 0; index < fixture.nodeCount; index += 1) {
    elements.push({
      data: { id: `n${index}` },
      position: {
        x: fixture.positions[index * 2],
        y: fixture.positions[index * 2 + 1],
      },
    })
  }
  for (let index = 0; index < fixture.edgeCount; index += 1) {
    elements.push({
      data: {
        id: `e${index}`,
        source: `n${fixture.links[index * 2]}`,
        target: `n${fixture.links[index * 2 + 1]}`,
      },
    })
  }

  const graph: Core = cytoscape({
    container,
    elements,
    pixelRatio: 1,
    hideEdgesOnViewport: true,
    style: [
      {
        selector: 'node',
        style: { width: 4, height: 4, 'background-color': '#287b73' },
      },
      {
        selector: 'edge',
        style: {
          width: 1,
          'curve-style': 'haystack',
          'line-color': '#aebdb7',
        },
      },
    ],
    layout: { name: 'preset', fit: true, padding: 16 },
  })
  await new Promise<void>((resolve) => graph.ready(() => resolve()))
  await animationFrames(2)
  return () => graph.destroy()
}

async function mountCosmos(
  container: HTMLDivElement,
  fixture: ReturnType<typeof generateRendererFixture>,
): Promise<() => void> {
  const graph = new CosmosGraph(container, {
    enableSimulation: false,
    rescalePositions: true,
    fitViewOnInit: true,
    fitViewDelay: 0,
    transitionDuration: 0,
    pointDefaultSize: 3,
    linkDefaultWidth: 1,
    linkOpacity: 0.35,
  })
  await graph.ready
  graph.setPointPositions(fixture.positions)
  graph.setLinks(fixture.links)
  graph.create()
  await animationFrames(2)
  return () => graph.destroy()
}

async function measureWheelInteraction(container: HTMLDivElement): Promise<number> {
  const started = performance.now()
  const target = container.querySelector('canvas') ?? container
  target.dispatchEvent(
    new WheelEvent('wheel', {
      deltaY: -120,
      clientX: container.clientWidth / 2,
      clientY: container.clientHeight / 2,
      bubbles: true,
      cancelable: true,
    }),
  )
  await animationFrames(2)
  return performance.now() - started
}

function preparePage(
  renderer: RendererName,
  nodeCount: number,
  edgeCount: number,
): HTMLDivElement {
  document.title = `${renderer} ${nodeCount} node benchmark`
  document.body.innerHTML = `
    <main style="height:100vh;display:grid;grid-template-rows:auto 1fr;background:#f4f0e8;color:#173b37;font:14px sans-serif">
      <header style="padding:10px 16px;background:#fffdf8;border-bottom:1px solid #dbe1d8">
        <strong>${renderer}</strong> · ${nodeCount.toLocaleString()} nodes · ${edgeCount.toLocaleString()} edges
        <pre id="benchmark-result" style="margin:6px 0 0;font-size:11px;white-space:pre-wrap">Running…</pre>
      </header>
      <div id="benchmark-container" style="min-height:0"></div>
    </main>
  `
  const container = document.querySelector<HTMLDivElement>('#benchmark-container')
  if (!container) {
    throw new Error('Benchmark container was not created')
  }
  return container
}

function renderResult(result: RendererBenchmarkResult) {
  const output = document.querySelector('#benchmark-result')
  if (output) {
    output.textContent = JSON.stringify(result, null, 2)
  }
}

function parseRenderer(value: string | null): RendererName {
  if (value === 'cytoscape' || value === 'cosmos') {
    return value
  }
  throw new Error("renderer must be 'cytoscape' or 'cosmos'")
}

function parseCount(value: string | null, fallback: number, allowZero = false): number {
  const parsed = value === null ? fallback : Number(value)
  const minimum = allowZero ? 0 : 1
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`count must be an integer greater than or equal to ${minimum}`)
  }
  return parsed
}

function animationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    function next(remaining: number) {
      if (remaining === 0) {
        resolve()
      } else {
        requestAnimationFrame(() => next(remaining - 1))
      }
    }
    next(count)
  })
}

function performanceMemory(): number | undefined {
  const memory = performance as Performance & {
    memory?: { usedJSHeapSize: number }
  }
  return memory.memory?.usedJSHeapSize
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100
}
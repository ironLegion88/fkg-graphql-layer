export interface RendererFixture {
  nodeCount: number
  edgeCount: number
  positions: Float32Array
  links: Float32Array
}

export function generateRendererFixture(
  nodeCount: number,
  edgeCount: number,
): RendererFixture {
  if (!Number.isInteger(nodeCount) || nodeCount <= 0) {
    throw new Error('nodeCount must be a positive integer')
  }
  if (!Number.isInteger(edgeCount) || edgeCount < 0) {
    throw new Error('edgeCount must be a non-negative integer')
  }

  const positions = new Float32Array(nodeCount * 2)
  const side = Math.ceil(Math.sqrt(nodeCount))
  for (let index = 0; index < nodeCount; index += 1) {
    positions[index * 2] = index % side
    positions[index * 2 + 1] = Math.floor(index / side)
  }

  const links = new Float32Array(edgeCount * 2)
  for (let index = 0; index < edgeCount; index += 1) {
    const source = index % nodeCount
    const stride = 1 + (Math.floor(index / nodeCount) % 31)
    links[index * 2] = source
    links[index * 2 + 1] = (source + stride) % nodeCount
  }
  return { nodeCount, edgeCount, positions, links }
}
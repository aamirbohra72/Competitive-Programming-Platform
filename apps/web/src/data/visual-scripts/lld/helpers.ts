import type { Step, UmlClassBox, UmlRelation } from '@/types/visual-script';

export function umlStep(
  activeLine: number,
  classes: UmlClassBox[],
  relations: UmlRelation[],
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'umlClass', classes, relations, label }, state, captionSeed };
}

export function fsmStep(
  activeLine: number,
  states: { id: string; label: string; x: number; y: number }[],
  transitions: { from: string; to: string; label: string; active?: boolean }[],
  current: string,
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'fsm', states, transitions, current, label }, state, captionSeed };
}

export function singletonStep(
  activeLine: number,
  callSites: { label: string }[],
  instance: { label: string; memory: string },
  activeCallIndex: number | undefined,
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return {
    activeLine,
    diagram: { kind: 'singleton', callSites, instance, activeCallIndex, label },
    state,
    captionSeed,
  };
}

export function layeredStep(
  activeLine: number,
  layers: { id: string; label: string; sublabel?: string; highlight?: boolean; variant?: 'core' | 'wrapper' | 'leaf' | 'branch' }[],
  state: Step['state'],
  captionSeed: string,
  opts?: { tree?: { parent: string; child: string }[]; layout?: 'stack' | 'tree' | 'bridge'; label?: string },
): Step {
  return {
    activeLine,
    diagram: { kind: 'layered', layers, tree: opts?.tree, layout: opts?.layout, label: opts?.label },
    state,
    captionSeed,
  };
}

export function fanOutStep(
  activeLine: number,
  nodes: { id: string; label: string; role: 'source' | 'hub' | 'target' | 'handler' }[],
  edges: { from: string; to: string; label?: string; active?: boolean }[],
  layout: 'broadcast' | 'chain' | 'star',
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'fanOut', nodes, edges, layout, label }, state, captionSeed };
}

export function creationStep(
  activeLine: number,
  recipe: { steps: string[]; activeStep?: number },
  product: { name: string; parts: string[]; built?: boolean },
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'creationFlow', recipe, product, label }, state, captionSeed };
}

export function domainStep(
  activeLine: number,
  nodes: { id: string; label: string; type: string; x: number; y: number; highlight?: boolean; diff?: string }[],
  edges: { from: string; to: string; label?: string; highlight?: boolean }[],
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'domainGraph', nodes, edges, label }, state, captionSeed };
}

export function principleStep(
  activeLine: number,
  left: { title: string; items: string[]; good?: boolean; highlight?: boolean },
  right: { title: string; items: string[]; good?: boolean; highlight?: boolean },
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'principleCompare', left, right, label }, state, captionSeed };
}

export function accessStep(
  activeLine: number,
  objects: string[],
  state: Step['state'],
  captionSeed: string,
  opts?: { activeIndex?: number; violation?: boolean; label?: string },
): Step {
  return {
    activeLine,
    diagram: { kind: 'accessChain', objects, activeIndex: opts?.activeIndex, violation: opts?.violation, label: opts?.label },
    state,
    captionSeed,
  };
}

export function flyweightStep(
  activeLine: number,
  factory: string,
  shared: { key: string; count: number }[],
  extrinsic: { label: string; key: string; highlight?: boolean }[],
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'flyweight', factory, shared, extrinsic, label }, state, captionSeed };
}

export function templateStep(
  activeLine: number,
  steps: { id: string; label: string; hook?: boolean; active?: boolean; done?: boolean }[],
  state: Step['state'],
  captionSeed: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'templateMethod', steps, label }, state, captionSeed };
}

export function iteratorStep(
  activeLine: number,
  collection: string[],
  cursor: number,
  state: Step['state'],
  captionSeed: string,
  current?: string,
  label?: string,
): Step {
  return { activeLine, diagram: { kind: 'iterator', collection, cursor, current, label }, state, captionSeed };
}

export function seqStep(
  activeLine: number,
  actors: string[],
  messages: { from: string; to: string; label: string; invalid?: boolean }[],
  state: Step['state'],
  captionSeed: string,
  selfCalls?: string[],
): Step {
  return { activeLine, diagram: { kind: 'sequence', actors, messages, selfCalls }, state, captionSeed };
}

export function gridStep(
  activeLine: number,
  rows: string[][],
  state: Step['state'],
  captionSeed: string,
  opts?: { highlight?: { row: number; col: number }[]; label?: string },
): Step {
  return {
    activeLine,
    diagram: { kind: 'grid', rows, highlight: opts?.highlight, label: opts?.label },
    state,
    captionSeed,
  };
}

export const LLD_META = {
  companies: ['Amazon', 'Google', 'Microsoft', 'Meta', 'Uber'],
};

export function conceptApproach(
  id: string,
  label: string,
  code: string[],
  steps: Step[],
) {
  return { id, label, complexity: { time: '—', space: '—' }, code, steps };
}

export function script(
  id: string,
  title: string,
  section: string,
  description: string,
  code: string[],
  steps: Step[],
  eyebrow = 'CONCEPT · LLD',
) {
  return {
    id,
    type: 'lld' as const,
    title,
    meta: { eyebrow, section, description, companies: LLD_META.companies },
    defaultApproachId: 'walkthrough',
    approaches: [conceptApproach('walkthrough', 'Walkthrough', code, steps)],
  };
}

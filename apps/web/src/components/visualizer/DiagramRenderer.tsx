'use client';

import type { Step } from '@/types/visual-script';
import { ArrayDiagram } from './ArrayDiagram';
import { BinarySearchDiagram } from './BinarySearchDiagram';
import { ContainerDiagram } from './ContainerDiagram';
import { DpTableDiagram } from './DpTableDiagram';
import { ElevationDiagram } from './ElevationDiagram';
import { GraphDiagram } from './GraphDiagram';
import { GridDiagram } from './GridDiagram';
import { HeapDiagram } from './HeapDiagram';
import { IntervalDiagram } from './IntervalDiagram';
import { LinkedListDiagram } from './LinkedListDiagram';
import { SequenceDiagram } from './SequenceDiagram';
import { StackDiagram } from './StackDiagram';
import { StringDiagram } from './StringDiagram';
import { TreeDiagram } from './TreeDiagram';
import { WindowDequeDiagram } from './WindowDequeDiagram';
import { UmlClassDiagram } from './UmlClassDiagram';
import { FsmDiagram } from './FsmDiagram';
import { SingletonDiagram } from './SingletonDiagram';
import { LayeredDiagram } from './LayeredDiagram';
import { FanOutDiagram } from './FanOutDiagram';
import { CreationFlowDiagram } from './CreationFlowDiagram';
import { DomainGraphDiagram } from './DomainGraphDiagram';
import { PrincipleCompareDiagram } from './PrincipleCompareDiagram';
import { AccessChainDiagram } from './AccessChainDiagram';
import { FlyweightDiagram } from './FlyweightDiagram';
import { TemplateMethodDiagram } from './TemplateMethodDiagram';
import { IteratorDiagram } from './IteratorDiagram';
import { cn } from '@/lib/cn';

type DiagramRendererProps = {
  step: Step;
  className?: string;
};

export function DiagramRenderer({ step, className }: DiagramRendererProps) {
  const { diagram } = step;

  return (
    <div
      className={cn(
        'visualizer-stage flex min-h-[220px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-green-900 bg-[#163025] p-3',
        className,
      )}
    >
      {diagram.kind === 'sequence' ? (
        <SequenceDiagram diagram={diagram} />
      ) : diagram.kind === 'umlClass' ? (
        <UmlClassDiagram diagram={diagram} />
      ) : diagram.kind === 'fsm' ? (
        <FsmDiagram diagram={diagram} />
      ) : diagram.kind === 'singleton' ? (
        <SingletonDiagram diagram={diagram} />
      ) : diagram.kind === 'layered' ? (
        <LayeredDiagram diagram={diagram} />
      ) : diagram.kind === 'fanOut' ? (
        <FanOutDiagram diagram={diagram} />
      ) : diagram.kind === 'creationFlow' ? (
        <CreationFlowDiagram diagram={diagram} />
      ) : diagram.kind === 'domainGraph' ? (
        <DomainGraphDiagram diagram={diagram} />
      ) : diagram.kind === 'principleCompare' ? (
        <PrincipleCompareDiagram diagram={diagram} />
      ) : diagram.kind === 'accessChain' ? (
        <AccessChainDiagram diagram={diagram} />
      ) : diagram.kind === 'flyweight' ? (
        <FlyweightDiagram diagram={diagram} />
      ) : diagram.kind === 'templateMethod' ? (
        <TemplateMethodDiagram diagram={diagram} />
      ) : diagram.kind === 'iterator' ? (
        <IteratorDiagram diagram={diagram} />
      ) : diagram.kind === 'elevation' ? (
        <ElevationDiagram diagram={diagram} />
      ) : diagram.kind === 'container' ? (
        <ContainerDiagram diagram={diagram} />
      ) : diagram.kind === 'string' ? (
        <StringDiagram diagram={diagram} />
      ) : diagram.kind === 'interval' ? (
        <IntervalDiagram diagram={diagram} />
      ) : diagram.kind === 'windowDeque' ? (
        <WindowDequeDiagram diagram={diagram} />
      ) : diagram.kind === 'linkedList' ? (
        <LinkedListDiagram diagram={diagram} />
      ) : diagram.kind === 'binarySearch' ? (
        <BinarySearchDiagram diagram={diagram} />
      ) : diagram.kind === 'tree' ? (
        <TreeDiagram diagram={diagram} />
      ) : diagram.kind === 'stack' ? (
        <StackDiagram diagram={diagram} />
      ) : diagram.kind === 'grid' ? (
        <GridDiagram diagram={diagram} />
      ) : diagram.kind === 'graph' ? (
        <GraphDiagram diagram={diagram} />
      ) : diagram.kind === 'dpTable' ? (
        <DpTableDiagram diagram={diagram} />
      ) : diagram.kind === 'heap' ? (
        <HeapDiagram diagram={diagram} />
      ) : (
        <ArrayDiagram diagram={diagram} />
      )}
    </div>
  );
}

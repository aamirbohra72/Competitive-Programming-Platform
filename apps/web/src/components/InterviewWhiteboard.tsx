'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

type Point = { x: number; y: number };
type Tool = 'pen' | 'eraser' | 'circle' | 'square' | 'arrow' | 'line' | 'database' | 'queue' | 'decision' | 'text';
type Shape = 'circle' | 'square' | 'arrow' | 'line' | 'database' | 'queue' | 'decision';
type DrawingElement =
  | { kind: 'stroke'; color: string; erase: boolean; points: Point[] }
  | { kind: 'shape'; shape: Shape; color: string; start: Point; end: Point }
  | { kind: 'text'; color: string; point: Point; text: string };
type TextDraft = { point: Point; value: string };

const COLORS = [
  { name: 'Forest', value: '#176b4d' },
  { name: 'Ink', value: '#24333a' },
  { name: 'Blue', value: '#3972a5' },
  { name: 'Coral', value: '#d75b4c' },
  { name: 'Amber', value: '#c28125' },
];

const TOOL_OPTIONS: Array<{ value: Tool; label: string }> = [
  { value: 'pen', label: 'Pen' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'line', label: 'Line' },
  { value: 'database', label: 'Database' },
  { value: 'queue', label: 'Queue' },
  { value: 'decision', label: 'Decision' },
  { value: 'text', label: 'Text' },
  { value: 'eraser', label: 'Eraser' },
];

function drawElement(
  context: CanvasRenderingContext2D,
  element: DrawingElement,
  width: number,
  height: number,
): void {
  context.save();
  if (element.kind === 'stroke') {
    context.globalCompositeOperation = element.erase ? 'destination-out' : 'source-over';
    context.strokeStyle = element.color;
    context.lineWidth = element.erase ? 20 : 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    if (element.points.length > 0) {
      context.beginPath();
      context.moveTo(element.points[0].x * width, element.points[0].y * height);
      for (const point of element.points.slice(1)) {
        context.lineTo(point.x * width, point.y * height);
      }
      if (element.points.length === 1) {
        context.lineTo(element.points[0].x * width + 0.1, element.points[0].y * height + 0.1);
      }
      context.stroke();
    }
  } else if (element.kind === 'shape') {
    const startX = element.start.x * width;
    const startY = element.start.y * height;
    const endX = element.end.x * width;
    const endY = element.end.y * height;
    context.strokeStyle = element.color;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();

    if (element.shape === 'circle') {
      context.ellipse(
        (startX + endX) / 2,
        (startY + endY) / 2,
        Math.abs(endX - startX) / 2,
        Math.abs(endY - startY) / 2,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    } else if (element.shape === 'square') {
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const side = Math.max(Math.abs(deltaX), Math.abs(deltaY));
      const squareEndX = startX + Math.sign(deltaX || 1) * side;
      const squareEndY = startY + Math.sign(deltaY || 1) * side;
      context.rect(startX, startY, squareEndX - startX, squareEndY - startY);
      context.stroke();
    } else if (element.shape === 'decision') {
      context.moveTo((startX + endX) / 2, startY);
      context.lineTo(endX, (startY + endY) / 2);
      context.lineTo((startX + endX) / 2, endY);
      context.lineTo(startX, (startY + endY) / 2);
      context.closePath();
      context.stroke();
    } else if (element.shape === 'database') {
      const left = Math.min(startX, endX);
      const right = Math.max(startX, endX);
      const top = Math.min(startY, endY);
      const bottom = Math.max(startY, endY);
      const radiusX = Math.max(4, (right - left) / 2);
      const radiusY = Math.min(14, Math.max(5, (bottom - top) * 0.16));
      const centerX = (left + right) / 2;
      context.beginPath();
      context.ellipse(centerX, top + radiusY, radiusX, radiusY, 0, 0, Math.PI * 2);
      context.moveTo(left, top + radiusY);
      context.lineTo(left, bottom - radiusY);
      context.ellipse(centerX, bottom - radiusY, radiusX, radiusY, 0, Math.PI, Math.PI * 2);
      context.moveTo(right, top + radiusY);
      context.lineTo(right, bottom - radiusY);
      context.stroke();
    } else if (element.shape === 'queue') {
      const left = Math.min(startX, endX);
      const right = Math.max(startX, endX);
      const top = Math.min(startY, endY);
      const bottom = Math.max(startY, endY);
      context.rect(left, top, right - left, bottom - top);
      const rowHeight = (bottom - top) / 3;
      for (let row = 1; row < 3; row += 1) {
        context.moveTo(left, top + rowHeight * row);
        context.lineTo(right, top + rowHeight * row);
      }
      context.stroke();
    } else if (element.shape === 'line') {
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.stroke();
    } else {
      const angle = Math.atan2(endY - startY, endX - startX);
      const headSize = 12;
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.moveTo(endX, endY);
      context.lineTo(endX - headSize * Math.cos(angle - Math.PI / 6), endY - headSize * Math.sin(angle - Math.PI / 6));
      context.moveTo(endX, endY);
      context.lineTo(endX - headSize * Math.cos(angle + Math.PI / 6), endY - headSize * Math.sin(angle + Math.PI / 6));
      context.stroke();
    }
  } else {
    context.fillStyle = element.color;
    context.font = '600 16px ui-sans-serif, system-ui, sans-serif';
    context.textBaseline = 'top';
    element.text.split('\n').forEach((line, index) => {
      context.fillText(line, element.point.x * width, element.point.y * height + index * 20);
    });
  }
  context.restore();
}

export function InterviewWhiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const elementsRef = useRef<DrawingElement[]>([]);
  const activeElementRef = useRef<DrawingElement | null>(null);
  const [color, setColor] = useState(COLORS[0].value);
  const [tool, setTool] = useState<Tool>('pen');
  const [elementCount, setElementCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = '#fffefa';
      context.fillRect(0, 0, bounds.width, bounds.height);
      context.fillStyle = 'rgba(53, 93, 75, 0.10)';
      for (let x = 18; x < bounds.width; x += 22) {
        for (let y = 18; y < bounds.height; y += 22) {
          context.beginPath();
          context.arc(x, y, 0.8, 0, Math.PI * 2);
          context.fill();
        }
      }
      for (const element of elementsRef.current) {
        drawElement(context, element, bounds.width, bounds.height);
      }
    };

    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    redraw();
    return () => observer.disconnect();
  }, [revision]);

  useEffect(() => {
    if (textDraft) textInputRef.current?.focus();
  }, [textDraft]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const startElement = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const point = pointFromEvent(event);
    if (tool === 'text') {
      setTextDraft({ point, value: '' });
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const element: DrawingElement = tool === 'pen' || tool === 'eraser'
      ? { kind: 'stroke', color, erase: tool === 'eraser', points: [point] }
      : { kind: 'shape', shape: tool, color, start: point, end: point };
    elementsRef.current = [...elementsRef.current, element];
    activeElementRef.current = element;
    setElementCount(elementsRef.current.length);
    setRevision((value) => value + 1);
  };

  const continueElement = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const element = activeElementRef.current;
    if (!element) return;
    const point = pointFromEvent(event);
    if (element.kind === 'stroke') element.points.push(point);
    else if (element.kind === 'shape') element.end = point;
    setRevision((value) => value + 1);
  };

  const finishElement = () => {
    activeElementRef.current = null;
  };

  const commitText = () => {
    const text = textDraft?.value.trim();
    if (text && textDraft) {
      elementsRef.current = [...elementsRef.current, { kind: 'text', color, point: textDraft.point, text }];
      setElementCount(elementsRef.current.length);
      setRevision((value) => value + 1);
    }
    setTextDraft(null);
  };

  const undo = () => {
    elementsRef.current = elementsRef.current.slice(0, -1);
    setElementCount(elementsRef.current.length);
    setRevision((value) => value + 1);
  };

  const clear = () => {
    elementsRef.current = [];
    activeElementRef.current = null;
    setElementCount(0);
    setRevision((value) => value + 1);
  };

  const selectTool = (value: Tool) => {
    setTool(value);
    setTextDraft(null);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[#d7ded4] bg-[#fffefa] shadow-sm" aria-label="System design whiteboard">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e9e1] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#25372f]">System design board</h2>
          <p className="mt-0.5 text-xs text-[#66736b]">Architecture, data flow, and trade-offs</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Whiteboard tools">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Drawing tool">
            {TOOL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={tool === option.value}
                onClick={() => selectTool(option.value)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${tool === option.value ? 'bg-[#176b4d] text-white' : 'border border-[#d7ded4] text-[#34443b] hover:bg-[#f2f5ef]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mx-1 flex items-center gap-1.5" role="group" aria-label="Drawing color">
            {COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={`${option.name} color`}
                aria-pressed={color === option.value}
                title={`${option.name} color`}
                onClick={() => setColor(option.value)}
                className={`h-5 w-5 rounded-full border-2 ${color === option.value ? 'border-[#25372f] ring-2 ring-[#d6e4d9]' : 'border-white shadow-sm'}`}
                style={{ backgroundColor: option.value }}
              />
            ))}
          </div>
          <button type="button" onClick={undo} disabled={elementCount === 0} className="rounded-md border border-[#d7ded4] px-3 py-1.5 text-xs font-semibold text-[#34443b] hover:bg-[#f2f5ef] disabled:cursor-not-allowed disabled:opacity-40">Undo</button>
          <button type="button" onClick={clear} disabled={elementCount === 0} className="rounded-md px-2 py-1.5 text-xs font-semibold text-[#a3473e] hover:bg-[#fff0ed] disabled:cursor-not-allowed disabled:opacity-40">Clear</button>
        </div>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={startElement}
          onPointerMove={continueElement}
          onPointerUp={finishElement}
          onPointerCancel={finishElement}
          className={`block h-[clamp(220px,38dvh,340px)] w-full touch-none ${tool === 'text' ? 'cursor-text' : 'cursor-crosshair'}`}
          aria-label="Draw a system architecture"
        />
        {textDraft && (
          <div
            className="absolute z-10 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-md border border-[#cbd6cd] bg-white p-1 shadow-md"
            style={{ left: `${textDraft.point.x * 100}%`, top: `${textDraft.point.y * 100}%` }}
          >
            <input
              ref={textInputRef}
              aria-label="Whiteboard text"
              value={textDraft.value}
              onChange={(event) => setTextDraft({ ...textDraft, value: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); commitText(); }
                if (event.key === 'Escape') setTextDraft(null);
              }}
              placeholder="Add a label"
              className="w-40 bg-transparent px-2 py-1 text-sm outline-none"
            />
            <button type="button" onClick={commitText} className="rounded px-2 py-1 text-xs font-semibold text-[#176b4d] hover:bg-[#eff5ef]">Add</button>
          </div>
        )}
      </div>
    </section>
  );
}

import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Panel,
  ReactFlow,
  useReactFlow,
  useViewport,
  type DefaultEdgeOptions,
  type IsValidConnection,
} from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { useCallback } from 'react';
import { DND_TYPE } from '../palette';
import { isValidConnection, useStore } from '../store';
import type { AppEdge, AppNode } from '../types';
import { nodeTypes } from './CanvasNodes';

const edgeOptions: DefaultEdgeOptions = {
  type: 'smoothstep',
  pathOptions: { borderRadius: 18 },
} as DefaultEdgeOptions;

function ZoomControls() {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-left" className="zoom-panel">
      <div className="zoom-group">
        <button className="icon-btn" onClick={() => zoomOut()} title="Zoom out">
          <Minus size={16} />
        </button>
        <button className="zoom-level" onClick={() => zoomTo(1)} title="Reset to 100%">
          {Math.round(zoom * 100)}%
        </button>
        <button className="icon-btn" onClick={() => zoomIn()} title="Zoom in">
          <Plus size={16} />
        </button>
      </div>
      <button className="zoom-group icon-btn icon-btn--boxed" onClick={() => fitView({ padding: 0.2 })} title="Fit to screen">
        <Maximize size={16} />
      </button>
    </Panel>
  );
}

export function Canvas() {
  const nodes = useStore((s) => s.model.nodes);
  const edges = useStore((s) => s.model.edges);
  const { onNodesChange, onEdgesChange, onConnect, beginDrag, addNode, select } = useStore.getState();
  const { screenToFlowPosition } = useReactFlow();

  const validate = useCallback<IsValidConnection<AppEdge>>((c) => isValidConnection(useStore.getState().model, c), []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      const raw = event.dataTransfer.getData(DND_TYPE);
      if (!raw) return;
      event.preventDefault();
      const node = JSON.parse(raw) as Omit<AppNode, 'id' | 'position'>;
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      // Centre the card (about 200×64) on the cursor.
      addNode(node, { x: pos.x - 100, y: pos.y - 32 });
    },
    [screenToFlowPosition, addNode],
  );

  return (
    <div className="canvas">
      <ReactFlow<AppNode, AppEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={validate}
        onNodeDragStart={beginDrag}
        onNodeClick={(_, n) => select({ kind: 'node', id: n.id })}
        onPaneClick={() => select(null)}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DND_TYPE)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={onDrop}
        defaultEdgeOptions={edgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#d4d4dc" />
        <ZoomControls />
      </ReactFlow>
    </div>
  );
}

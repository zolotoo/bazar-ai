import { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  Node,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ReferenceNode, ScriptNode, StatusNode } from './nodes';
import { ActiveUsers } from './ui/ActiveUsers';
import { IncomingVideo, ReferenceNodeData } from '../types';
import { useFlowStore } from '../stores/flowStore';
import { useYjsSync } from '../hooks/useYjsSync';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { fetchReelData } from '../services/videoService';
import { GitBranch, Layers, MousePointer2 } from 'lucide-react';

const nodeTypes: NodeTypes = {
  reference: ReferenceNode,
  script: ScriptNode,
  status: StatusNode,
};

export function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    removeIncomingVideo,
  } = useFlowStore();

  const { markVideoAsOnCanvas } = useInboxVideos();

  useYjsSync('bazar-ai-room');

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const videoData = event.dataTransfer.getData('application/reactflow/video');

      if (typeof videoData === 'undefined' || !videoData) {
        return;
      }

      try {
        const video: IncomingVideo = JSON.parse(videoData);
        
        const position = {
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        };

        const reelData = await fetchReelData(video.url);
        
        const engagementScore = reelData.view_count && reelData.view_count > 0
          ? ((reelData.like_count || 0) + (reelData.comment_count || 0)) / reelData.view_count * 100
          : undefined;

        const newNode: Node<ReferenceNodeData> = {
          id: `reference-${Date.now()}`,
          type: 'reference',
          position,
          data: {
            title: video.title,
            previewUrl: video.previewUrl,
            url: video.url,
            videoId: video.id,
            view_count: reelData.view_count,
            like_count: reelData.like_count,
            comment_count: reelData.comment_count,
            taken_at: reelData.taken_at,
            description: reelData.description,
            viralScore: reelData.viralScore,
            engagementScore,
          },
        };

        addNode(newNode);
        removeIncomingVideo(video.id);
        
        try {
          await markVideoAsOnCanvas(video.id);
        } catch (supabaseError) {
          console.error('Error updating video status:', supabaseError);
        }
      } catch (error) {
        console.error('Error parsing video data:', error);
      }
    },
    [addNode, removeIncomingVideo, markVideoAsOnCanvas]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const defaultEdgeOptions = {
    style: { stroke: 'rgb(249, 115, 22)', strokeWidth: 2 },
    type: 'smoothstep',
    animated: true,
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Header */}
      <div className="absolute top-14 left-0 right-0 z-20 p-4 pointer-events-none">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-white shadow-md pointer-events-auto">
            <GitBranch className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              Холст сценариев
            </h1>
            <p className="text-neutral-500 text-[11px] mt-[-1px]">
              Создавай связи между идеями
            </p>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-white shadow-lg flex items-center justify-center">
              <Layers className="w-7 h-7 text-orange-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">
              Начни создавать
            </h2>
            <p className="text-neutral-500 text-sm max-w-xs">
              Перетащи видео из входящих на холст
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 text-neutral-400">
              <MousePointer2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">Drag & Drop</span>
            </div>
          </div>
        </div>
      )}

      {/* React Flow */}
      <ReactFlowProvider>
        <div ref={reactFlowWrapper} className="w-full h-full relative z-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            minZoom={0.1}
            maxZoom={2}
            attributionPosition="bottom-left"
            className="canvas-light"
          >
            <Background 
              color="rgba(0, 0, 0, 0.05)" 
              gap={30} 
              size={1}
            />
            <Controls className="!bg-white !shadow-lg !shadow-black/10 !border-none !rounded-xl" />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === 'reference') return 'rgb(249, 115, 22)';
                if (node.type === 'script') return 'rgb(59, 130, 246)';
                if (node.type === 'status') return 'rgb(16, 185, 129)';
                return 'rgba(0, 0, 0, 0.1)';
              }}
              maskColor="rgba(245, 245, 245, 0.9)"
              className="!bg-white !shadow-lg !shadow-black/10 !rounded-xl"
            />
          </ReactFlow>
          <ActiveUsers />
        </div>
      </ReactFlowProvider>
    </div>
  );
}

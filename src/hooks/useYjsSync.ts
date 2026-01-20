import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useFlowStore } from '../stores/flowStore';
import { Node, Edge } from 'reactflow';

// Yjs document for collaborative editing
const ydoc = new Y.Doc();

export function useYjsSync(roomName: string = 'default-room') {
  const providerRef = useRef<WebrtcProvider | null>(null);
  const indexeddbRef = useRef<IndexeddbPersistence | null>(null);
  const { setNodes, setEdges } = useFlowStore();

  useEffect(() => {
    // Initialize IndexedDB persistence для локального хранения состояния
    // Данные сохраняются даже после закрытия приложения
    const indexeddbProvider = new IndexeddbPersistence(roomName, ydoc);
    indexeddbRef.current = indexeddbProvider;

    indexeddbProvider.on('synced', () => {
      console.log('IndexedDB synced with Yjs document');
    });

    // Initialize WebRTC provider for real-time sync
    // In production, you'd use a proper signaling server
    // For now, using y-webrtc for P2P synchronization
    // Временно отключено из-за проблем с WebSocket
    let provider: WebrtcProvider | null = null;
    try {
      provider = new WebrtcProvider(roomName, ydoc, {
        // Configure WebSocket connection if needed for signaling
        // signaling: ['wss://your-signaling-server.com'],
      });
      providerRef.current = provider;
    } catch (err) {
      console.warn('Failed to initialize WebRTC provider:', err);
    }

    // Yjs arrays for nodes and edges
    const nodesArray = ydoc.getArray<Node>('nodes');
    const edgesArray = ydoc.getArray<Edge>('edges');

    // Sync Yjs -> React Flow
    const updateNodes = () => {
      const yjsNodes = nodesArray.toArray() as Node[];
      setNodes(yjsNodes);
    };

    const updateEdges = () => {
      const yjsEdges = edgesArray.toArray() as Edge[];
      setEdges(yjsEdges);
    };

    // Initial sync from Yjs
    const initialState = useFlowStore.getState();
    if (nodesArray.length === 0 && initialState.nodes.length > 0) {
      // First load: sync React Flow -> Yjs
      nodesArray.insert(0, initialState.nodes);
      edgesArray.insert(0, initialState.edges);
    } else if (nodesArray.length > 0) {
      // Load from Yjs
      updateNodes();
      updateEdges();
    }

    // Listen to Yjs changes
    nodesArray.observe(updateNodes);
    edgesArray.observe(updateEdges);

    // Sync React Flow -> Yjs (when local changes happen)
    const intervalId = setInterval(() => {
      const currentNodes = useFlowStore.getState().nodes;
      const currentEdges = useFlowStore.getState().edges;
      
      // Only update if changed
      const yjsNodes = nodesArray.toArray() as Node[];
      if (JSON.stringify(currentNodes) !== JSON.stringify(yjsNodes)) {
        nodesArray.delete(0, nodesArray.length);
        nodesArray.insert(0, currentNodes);
      }

      const yjsEdges = edgesArray.toArray() as Edge[];
      if (JSON.stringify(currentEdges) !== JSON.stringify(yjsEdges)) {
        edgesArray.delete(0, edgesArray.length);
        edgesArray.insert(0, currentEdges);
      }
    }, 500); // Sync every 500ms

    return () => {
      clearInterval(intervalId);
      nodesArray.unobserve(updateNodes);
      edgesArray.unobserve(updateEdges);
      provider?.destroy();
      // IndexedDB provider не нужно явно уничтожать,
      // он сохраняет данные автоматически
    };
  }, [roomName, setNodes, setEdges]);

  return providerRef.current;
}

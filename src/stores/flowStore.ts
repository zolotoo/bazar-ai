import { create } from 'zustand';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from 'reactflow';
import { IncomingVideo } from '../types';

interface FlowStore {
  nodes: Node[];
  edges: Edge[];
  incomingVideos: IncomingVideo[];
  users: Map<string, { name: string; color: string }>;
  
  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, data: any) => void;
  addIncomingVideo: (video: IncomingVideo) => void;
  removeIncomingVideo: (videoId: string) => void;
  setIncomingVideos: (videos: IncomingVideo[]) => void;
  addUser: (userId: string, name: string, color: string) => void;
  removeUser: (userId: string) => void;
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  nodes: [],
  edges: [],
  incomingVideos: [],
  users: new Map(),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
    });
  },

  updateNode: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    });
  },

  addIncomingVideo: (video) => {
    set({
      incomingVideos: [...get().incomingVideos, video],
    });
  },

  removeIncomingVideo: (videoId) => {
    set({
      incomingVideos: get().incomingVideos.filter((v) => v.id !== videoId),
    });
  },

  setIncomingVideos: (videos) => {
    set({ incomingVideos: videos });
  },

  addUser: (userId, name, color) => {
    const users = new Map(get().users);
    users.set(userId, { name, color });
    set({ users });
  },

  removeUser: (userId) => {
    const users = new Map(get().users);
    users.delete(userId);
    set({ users });
  },
}));

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Cloud,
  Copy,
  Database,
  Gauge,
  HardDrive,
  Layers3,
  Monitor,
  Network,
  Redo2,
  RotateCcw,
  Server,
  StickyNote,
  Trash2,
  Undo2,
  WandSparkles,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  SYSTEM_DESIGN_CANVAS_SCHEMA_VERSION,
  systemDesignCanvasNodeKinds,
  type SystemDesignCanvasDocument,
  type SystemDesignCanvasEdge,
  type SystemDesignCanvasNode,
  type VersionedSystemDesignCanvas
} from "@/features/interviews/domain/system-design-canvas";

type NodeKind = SystemDesignCanvasNode["kind"];
type DesignNode = SystemDesignCanvasNode;
type DesignEdge = SystemDesignCanvasEdge;

type CanvasSnapshot = {
  nodes: DesignNode[];
  edges: DesignEdge[];
  notes: string;
};

const EMPTY_SNAPSHOT: CanvasSnapshot = { nodes: [], edges: [], notes: "" };
const NODE_WIDTH = 152;
const NODE_HEIGHT = 78;
const HISTORY_LIMIT = 80;
const CANVAS_INPUT_CLASS =
  "mt-1 block h-8 w-full rounded-md border border-white/[0.07] bg-black/20 px-2.5 text-xs text-cream/72 outline-none placeholder:text-cream/25 focus:border-[var(--workspace-accent)]/50";

const NODE_DEFAULTS: Record<NodeKind, string> = {
  client: "Client",
  gateway: "API gateway",
  service: "Service",
  database: "Data store",
  cache: "Cache",
  queue: "Queue / stream",
  storage: "Object storage",
  external: "External system",
  note: "Design note"
};

const NODE_KINDS = [...systemDesignCanvasNodeKinds];

/** Interview whiteboard with durable state, architecture primitives, and fast keyboard editing. */
export function SystemDesignCanvas({
  storageKey,
  sessionId
}: {
  storageKey?: string;
  sessionId?: string;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const markerId = `design-arrow-${useId().replaceAll(":", "")}`;
  const [snapshot, setSnapshot] = useState<CanvasSnapshot>(EMPTY_SNAPSHOT);
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    before: CanvasSnapshot;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverReady, setServerReady] = useState(!sessionId);
  const [saveStatus, setSaveStatus] = useState<
    "loading" | "saved" | "saving" | "offline" | "conflict" | "local"
  >(sessionId ? "loading" : "local");
  const [retryTick, setRetryTick] = useState(0);
  const revisionRef = useRef(0);
  const lastSavedFingerprintRef = useRef("");
  const saveQueueRef = useRef(Promise.resolve());

  const selectedNode = snapshot.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = snapshot.edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const persistenceKey = storageKey ? `trailgrad:system-design-canvas:${storageKey}` : null;

  const commit = useCallback((update: (current: CanvasSnapshot) => CanvasSnapshot) => {
    setSnapshot((current) => {
      const next = update(current);
      if (next === current) return current;
      setPast((history) => [...history.slice(-(HISTORY_LIMIT - 1)), current]);
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((history) => {
      const previous = history.at(-1);
      if (!previous) return history;
      setSnapshot((current) => {
        setFuture((items) => [current, ...items].slice(0, HISTORY_LIMIT));
        return previous;
      });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setLinkFrom(null);
      return history.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((items) => {
      const next = items[0];
      if (!next) return items;
      setSnapshot((current) => {
        setPast((history) => [...history.slice(-(HISTORY_LIMIT - 1)), current]);
        return next;
      });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setLinkFrom(null);
      return items.slice(1);
    });
  }, []);

  useEffect(() => {
    if (!persistenceKey) {
      setHydrated(true);
      return;
    }
    try {
      const stored = window.localStorage.getItem(persistenceKey);
      if (stored) {
        const parsed = parseStoredSnapshot(stored);
        if (parsed) {
          setSnapshot(parsed);
          nextId.current = nextNodeOrdinal(parsed.nodes);
        }
      }
    } catch {
      // A blocked storage API should never make the interview canvas unusable.
    }
    setHydrated(true);
  }, [persistenceKey]);

  useEffect(() => {
    if (!sessionId || !hydrated) return;
    let cancelled = false;
    setSaveStatus("loading");
    void fetch(`/api/interview/${encodeURIComponent(sessionId)}/design-canvas`, {
      cache: "no-store"
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          success?: boolean;
          data?: VersionedSystemDesignCanvas;
          error?: { message?: string };
        };
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error?.message ?? "The diagram could not be loaded");
        }
        if (cancelled) return;
        revisionRef.current = payload.data.revision;
        const remote = snapshotFromDocument(payload.data.document);
        if (payload.data.revision > 0) {
          lastSavedFingerprintRef.current = snapshotFingerprint(remote);
          setSnapshot(remote);
          nextId.current = nextNodeOrdinal(remote.nodes);
        }
        setSaveStatus("saved");
        setServerReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSaveStatus("offline");
        setServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, sessionId]);

  useEffect(() => {
    if (!hydrated || !persistenceKey) return;
    try {
      window.localStorage.setItem(persistenceKey, JSON.stringify(snapshot));
    } catch {
      // The in-memory canvas remains fully usable when storage is unavailable.
    }
  }, [hydrated, persistenceKey, snapshot]);

  useEffect(() => {
    const retry = () => setRetryTick((value) => value + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  useEffect(() => {
    if (!sessionId || !serverReady) return;
    const fingerprint = snapshotFingerprint(snapshot);
    if (fingerprint === lastSavedFingerprintRef.current) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      const document = documentFromSnapshot(snapshot);
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          const response = await fetch(
            `/api/interview/${encodeURIComponent(sessionId)}/design-canvas`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                expectedRevision: revisionRef.current,
                document
              })
            }
          );
          const payload = (await response.json()) as {
            success?: boolean;
            data?: VersionedSystemDesignCanvas;
            error?: {
              code?: string;
              message?: string;
              details?: { current?: VersionedSystemDesignCanvas };
            };
          };
          if (response.status === 409 && payload.error?.details?.current) {
            const current = payload.error.details.current;
            const remote = snapshotFromDocument(current.document);
            if (persistenceKey) {
              try {
                window.localStorage.setItem(
                  `${persistenceKey}:conflict-recovery:${Date.now()}`,
                  JSON.stringify(document)
                );
              } catch {
                // Conflict recovery is best-effort when browser storage is blocked.
              }
            }
            revisionRef.current = current.revision;
            lastSavedFingerprintRef.current = snapshotFingerprint(remote);
            setSnapshot(remote);
            nextId.current = nextNodeOrdinal(remote.nodes);
            setSaveStatus("conflict");
            return;
          }
          if (!response.ok || !payload.success || !payload.data) {
            throw new Error(payload.error?.message ?? "The diagram could not be saved");
          }
          revisionRef.current = payload.data.revision;
          lastSavedFingerprintRef.current = snapshotFingerprint(
            snapshotFromDocument(payload.data.document)
          );
          setSaveStatus("saved");
        } catch {
          setSaveStatus("offline");
        }
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [persistenceKey, retryTick, serverReady, sessionId, snapshot]);

  const addNode = (kind: NodeKind) => {
    if (snapshot.nodes.length >= 100) return;
    const ordinal = nextId.current++;
    const id = `design-node-${ordinal}`;
    const offset = (ordinal - 1) % 6;
    commit((current) => {
      const edges =
        linkFrom && current.edges.length < 250
          ? [
              ...current.edges,
              {
                id: `design-edge-${Date.now()}-${ordinal}`,
                from: linkFrom,
                to: id,
                label: kind === "queue" ? "publish" : "request",
                mode: kind === "queue" ? ("async" as const) : ("sync" as const)
              }
            ]
          : current.edges;
      return {
        ...current,
        edges,
        nodes: [
          ...current.nodes,
          {
            id,
            kind,
            label: NODE_DEFAULTS[kind],
            detail: "",
            x: 28 + offset * 38,
            y: 30 + offset * 30
          }
        ]
      };
    });
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setLinkFrom(null);
  };

  const selectNode = (id: string) => {
    if (linkFrom && linkFrom !== id) {
      commit((current) => {
        if (current.edges.length >= 250) return current;
        if (current.edges.some((edge) => edge.from === linkFrom && edge.to === id)) return current;
        return {
          ...current,
          edges: [
            ...current.edges,
            {
              id: `design-edge-${Date.now()}-${current.edges.length}`,
              from: linkFrom,
              to: id,
              label: "request",
              mode: "sync"
            }
          ]
        };
      });
      setLinkFrom(null);
    }
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };

  const removeSelected = useCallback(() => {
    if (selectedEdgeId) {
      commit((current) => ({
        ...current,
        edges: current.edges.filter((edge) => edge.id !== selectedEdgeId)
      }));
      setSelectedEdgeId(null);
      return;
    }
    if (!selectedNodeId) return;
    commit((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== selectedNodeId),
      edges: current.edges.filter(
        (edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId
      )
    }));
    setLinkFrom((current) => (current === selectedNodeId ? null : current));
    setSelectedNodeId(null);
  }, [commit, selectedEdgeId, selectedNodeId]);

  const duplicateSelected = () => {
    if (!selectedNode || snapshot.nodes.length >= 100) return;
    const ordinal = nextId.current++;
    const id = `design-node-${ordinal}`;
    commit((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          ...selectedNode,
          id,
          label: `${selectedNode.label} copy`,
          x: selectedNode.x + 26,
          y: selectedNode.y + 26
        }
      ]
    }));
    setSelectedNodeId(id);
  };

  const autoLayout = () => {
    if (!snapshot.nodes.length) return;
    commit((current) => {
      const ordered = topologicalNodeOrder(current.nodes, current.edges);
      const columns = Math.max(2, Math.ceil(Math.sqrt(ordered.length * 1.5)));
      return {
        ...current,
        nodes: ordered.map((node, index) => ({
          ...node,
          x: 28 + (index % columns) * 190,
          y: 30 + Math.floor(index / columns) * 118
        }))
      };
    });
    setZoom(1);
    setViewOffset({ x: 0, y: 0 });
  };

  const fitDiagram = () => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || !snapshot.nodes.length) {
      setZoom(1);
      setViewOffset({ x: 0, y: 0 });
      return;
    }
    const minX = Math.min(...snapshot.nodes.map((node) => node.x));
    const minY = Math.min(...snapshot.nodes.map((node) => node.y));
    const maxX = Math.max(...snapshot.nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...snapshot.nodes.map((node) => node.y + NODE_HEIGHT));
    const nextZoom = clamp(
      Math.min((bounds.width - 48) / (maxX - minX), (bounds.height - 48) / (maxY - minY)),
      0.55,
      1.35
    );
    setZoom(nextZoom);
    setViewOffset({ x: 24 - minX * nextZoom, y: 24 - minY * nextZoom });
  };

  const copyDiagram = async () => {
    try {
      await navigator.clipboard.writeText(diagramAsText(snapshot));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      className="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-black/20"
      onKeyDown={(event) => {
        if (isEditingTarget(event.target)) return;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        } else if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          removeSelected();
        } else if (event.key === "Escape") {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setLinkFrom(null);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <div className="mr-auto min-w-44">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-cream/82">Architecture canvas</p>
            <span
              className={`font-mono text-[8px] uppercase tracking-[0.12em] ${
                saveStatus === "offline" || saveStatus === "conflict"
                  ? "text-amber-300/65"
                  : "text-cream/28"
              }`}
              role="status"
            >
              {canvasSaveLabel(saveStatus)}
            </span>
          </div>
          <p className="text-[11px] text-cream/38">
            Build as you talk; your diagram is saved in this session.
          </p>
        </div>
        <CanvasButton
          label="Client"
          icon={<Monitor size={12} />}
          onClick={() => addNode("client")}
        />
        <CanvasButton
          label="Service"
          icon={<Server size={12} />}
          onClick={() => addNode("service")}
        />
        <CanvasButton
          label="Data store"
          icon={<Database size={12} />}
          onClick={() => addNode("database")}
        />
        <CanvasButton label="Queue" icon={<Layers3 size={12} />} onClick={() => addNode("queue")} />
        <label className="relative">
          <span className="sr-only">Add component</span>
          <select
            aria-label="Add component"
            value=""
            onChange={(event) => {
              if (event.target.value) addNode(event.target.value as NodeKind);
            }}
            className="h-8 appearance-none rounded-md border-0 bg-white/[0.055] pl-2.5 pr-7 text-[11px] font-medium text-cream/58 outline-none hover:bg-white/[0.09] hover:text-cream"
          >
            <option value="" className="bg-[#17191d]">
              More…
            </option>
            {NODE_KINDS.filter(
              (kind) => !["client", "service", "database", "queue"].includes(kind)
            ).map((kind) => (
              <option key={kind} value={kind} className="bg-[#17191d]">
                {NODE_DEFAULTS[kind]}
              </option>
            ))}
          </select>
          <Boxes className="pointer-events-none absolute right-2 top-2 text-cream/38" size={12} />
        </label>
        <div className="mx-0.5 h-5 w-px bg-white/[0.07]" />
        <CanvasButton
          label={linkFrom ? "Choose target" : "Connect"}
          icon={<ArrowRight size={12} />}
          disabled={!selectedNodeId}
          active={Boolean(linkFrom)}
          onClick={() => setLinkFrom((current) => (current ? null : selectedNodeId))}
        />
        <IconButton label="Undo" disabled={!past.length} onClick={undo}>
          <Undo2 size={13} />
        </IconButton>
        <IconButton label="Redo" disabled={!future.length} onClick={redo}>
          <Redo2 size={13} />
        </IconButton>
        <IconButton label="Auto layout" disabled={!snapshot.nodes.length} onClick={autoLayout}>
          <WandSparkles size={13} />
        </IconButton>
        <IconButton
          label="Copy diagram"
          disabled={!snapshot.nodes.length}
          onClick={() => void copyDiagram()}
        >
          <Copy size={13} />
        </IconButton>
        <IconButton
          label="Delete selected"
          disabled={!selectedNodeId && !selectedEdgeId}
          onClick={removeSelected}
        >
          <Trash2 size={13} />
        </IconButton>
      </div>

      <div
        ref={canvasRef}
        tabIndex={0}
        className="relative h-[26rem] touch-none overflow-hidden bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.055)_1px,transparent_1px)] [background-size:20px_20px] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--workspace-accent)]/50"
        aria-label="System design diagram canvas"
        onPointerMove={(event) => {
          if (!dragging || !canvasRef.current) return;
          const bounds = canvasRef.current.getBoundingClientRect();
          const x = Math.max(
            0,
            (event.clientX - bounds.left - viewOffset.x) / zoom - dragging.offsetX
          );
          const y = Math.max(
            0,
            (event.clientY - bounds.top - viewOffset.y) / zoom - dragging.offsetY
          );
          setSnapshot((current) => ({
            ...current,
            nodes: current.nodes.map((node) => (node.id === dragging.id ? { ...node, x, y } : node))
          }));
        }}
        onPointerUp={() => {
          if (dragging) {
            setPast((history) => [...history.slice(-(HISTORY_LIMIT - 1)), dragging.before]);
            setFuture([]);
          }
          setDragging(null);
        }}
        onPointerLeave={() => setDragging(null)}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setLinkFrom(null);
          }
        }}
      >
        {snapshot.nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
            <p className="max-w-md text-sm leading-6 text-cream/30">
              Add clients, services, data stores, queues, caches, and external systems. Connect
              them, label the flow, then explain the trade-offs.
            </p>
          </div>
        ) : null}

        <div
          className="absolute inset-0 origin-top-left"
          style={{ transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${zoom})` }}
        >
          <svg
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-label="Architecture connections"
          >
            <defs>
              <marker
                id={markerId}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="rgba(232,226,213,0.55)" />
              </marker>
            </defs>
            {snapshot.edges.map((edge) => {
              const from = snapshot.nodes.find((node) => node.id === edge.from);
              const to = snapshot.nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;
              const geometry = edgeGeometry(from, to);
              const selected = selectedEdgeId === edge.id;
              return (
                <g key={edge.id}>
                  <path
                    d={geometry.path}
                    fill="none"
                    stroke={selected ? "var(--workspace-accent)" : edgeStroke(edge.mode)}
                    strokeWidth={selected ? 2.2 : 1.5}
                    strokeDasharray={edge.mode === "async" ? "6 4" : undefined}
                    markerEnd={`url(#${markerId})`}
                    className="pointer-events-none"
                  />
                  <path
                    d={geometry.path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="14"
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`Connection ${from.label} to ${to.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                      setLinkFrom(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }
                    }}
                  />
                  {edge.label ? (
                    <text
                      x={geometry.labelX}
                      y={geometry.labelY}
                      textAnchor="middle"
                      className="pointer-events-none fill-cream/45 text-[9px]"
                      paintOrder="stroke"
                      stroke="#0d0f12"
                      strokeWidth="4"
                    >
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {snapshot.nodes.map((node) => {
            const selected = selectedNodeId === node.id;
            const connecting = linkFrom === node.id;
            return (
              <div
                key={node.id}
                className={`absolute flex h-[78px] w-[152px] flex-col overflow-hidden rounded-lg border text-left shadow-lg transition-colors ${nodeSurface(node.kind, selected, connecting)}`}
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                onClick={() => selectNode(node.id)}
              >
                <button
                  type="button"
                  aria-label={`Move ${node.label}`}
                  className="flex h-7 cursor-grab items-center gap-1.5 border-b border-white/[0.06] px-2 font-mono text-[9px] uppercase tracking-[0.12em] text-cream/38 active:cursor-grabbing"
                  onPointerDown={(event) => {
                    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
                    if (!bounds) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging({
                      id: node.id,
                      offsetX: (event.clientX - bounds.left) / zoom,
                      offsetY: (event.clientY - bounds.top) / zoom,
                      before: snapshot
                    });
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }}
                >
                  <NodeIcon kind={node.kind} />
                  {node.kind}
                </button>
                <input
                  value={node.label}
                  maxLength={120}
                  aria-label={`${node.kind} label`}
                  onClick={(event) => event.stopPropagation()}
                  onFocus={() => {
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    commit((current) => ({
                      ...current,
                      nodes: current.nodes.map((item) =>
                        item.id === node.id ? { ...item, label: value } : item
                      )
                    }));
                  }}
                  className="min-h-0 flex-1 bg-transparent px-2 pt-1 text-xs font-medium text-cream/78 outline-none placeholder:text-cream/24"
                />
                <p className="truncate px-2 pb-1.5 text-[9px] text-cream/28">
                  {node.detail || "Add details below"}
                </p>
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-white/[0.07] bg-[#111318]/90 p-1 shadow-xl backdrop-blur">
          <IconButton
            label="Zoom out"
            disabled={zoom <= 0.55}
            onClick={() => setZoom((value) => clamp(value - 0.1, 0.55, 1.6))}
          >
            <ZoomOut size={13} />
          </IconButton>
          <button
            type="button"
            onClick={fitDiagram}
            className="min-w-12 rounded px-1.5 py-1 text-[10px] text-cream/45 hover:bg-white/[0.07] hover:text-cream"
            aria-label="Fit diagram"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton
            label="Zoom in"
            disabled={zoom >= 1.6}
            onClick={() => setZoom((value) => clamp(value + 0.1, 0.55, 1.6))}
          >
            <ZoomIn size={13} />
          </IconButton>
          <IconButton
            label="Reset view"
            onClick={() => {
              setZoom(1);
              setViewOffset({ x: 0, y: 0 });
            }}
          >
            <RotateCcw size={13} />
          </IconButton>
        </div>
        {copied ? (
          <span className="absolute bottom-4 left-4 rounded-md bg-[#171a1f] px-2 py-1 text-[10px] text-cream/65">
            Diagram copied
          </span>
        ) : null}
      </div>

      {selectedNode ? (
        <div className="grid gap-3 border-t border-white/[0.06] bg-white/[0.018] px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <InspectorField label="Component name">
            <input
              value={selectedNode.label}
              maxLength={120}
              onChange={(event) =>
                updateNode(commit, selectedNode.id, { label: event.target.value })
              }
              className={CANVAS_INPUT_CLASS}
            />
          </InspectorField>
          <InspectorField label="Responsibility / technology">
            <input
              value={selectedNode.detail}
              maxLength={300}
              placeholder="e.g. stateless, Redis, partitioned by tenant"
              onChange={(event) =>
                updateNode(commit, selectedNode.id, { detail: event.target.value })
              }
              className={CANVAS_INPUT_CLASS}
            />
          </InspectorField>
          <button
            type="button"
            onClick={duplicateSelected}
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.055] px-2.5 text-[11px] text-cream/58 hover:bg-white/[0.09] hover:text-cream"
          >
            <Copy size={12} /> Duplicate
          </button>
        </div>
      ) : selectedEdge ? (
        <div className="grid gap-3 border-t border-white/[0.06] bg-white/[0.018] px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <InspectorField label="Connection label">
            <input
              value={selectedEdge.label}
              maxLength={120}
              placeholder="HTTP, events, reads, writes…"
              onChange={(event) =>
                updateEdge(commit, selectedEdge.id, { label: event.target.value })
              }
              className={CANVAS_INPUT_CLASS}
            />
          </InspectorField>
          <InspectorField label="Flow type">
            <select
              value={selectedEdge.mode}
              onChange={(event) =>
                updateEdge(commit, selectedEdge.id, {
                  mode: event.target.value as DesignEdge["mode"]
                })
              }
              className={CANVAS_INPUT_CLASS}
            >
              <option value="sync" className="bg-[#17191d]">
                Synchronous
              </option>
              <option value="async" className="bg-[#17191d]">
                Asynchronous
              </option>
              <option value="data" className="bg-[#17191d]">
                Data access
              </option>
            </select>
          </InspectorField>
        </div>
      ) : null}

      <label className="block border-t border-white/[0.06] px-3 py-2.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-cream/35">
          Assumptions and estimates
        </span>
        <textarea
          value={snapshot.notes}
          maxLength={12_000}
          onChange={(event) => {
            const notes = event.target.value;
            commit((current) => ({ ...current, notes }));
          }}
          placeholder="Record clarified requirements, scale estimates, SLOs, and trade-offs…"
          className="mt-1.5 min-h-16 w-full resize-y bg-transparent text-sm leading-6 text-cream/72 outline-none placeholder:text-cream/24"
        />
      </label>
    </section>
  );
}

function CanvasButton({
  label,
  icon,
  onClick,
  disabled = false,
  active = false
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-[var(--workspace-accent)] text-[#111318]"
          : "bg-white/[0.055] text-cream/58 hover:bg-white/[0.09] hover:text-cream"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.045] text-cream/42 transition hover:bg-white/[0.09] hover:text-cream disabled:cursor-not-allowed disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-cream/30">
        {label}
      </span>
      {children}
    </label>
  );
}

function NodeIcon({ kind }: { kind: NodeKind }) {
  if (kind === "client") return <Monitor size={11} aria-hidden="true" />;
  if (kind === "gateway") return <Network size={11} aria-hidden="true" />;
  if (kind === "database") return <Database size={11} aria-hidden="true" />;
  if (kind === "cache") return <Gauge size={11} aria-hidden="true" />;
  if (kind === "queue") return <Layers3 size={11} aria-hidden="true" />;
  if (kind === "storage") return <HardDrive size={11} aria-hidden="true" />;
  if (kind === "external") return <Cloud size={11} aria-hidden="true" />;
  if (kind === "note") return <StickyNote size={11} aria-hidden="true" />;
  return <Server size={11} aria-hidden="true" />;
}

function nodeSurface(kind: NodeKind, selected: boolean, connecting: boolean): string {
  if (connecting) return "border-[var(--workspace-accent)] bg-[var(--workspace-accent)]/10";
  if (selected) return "border-cream/35 bg-[#171a1f]";
  if (kind === "database" || kind === "storage") return "border-sky-300/15 bg-sky-950/20";
  if (kind === "queue") return "border-violet-300/15 bg-violet-950/20";
  if (kind === "cache") return "border-amber-300/15 bg-amber-950/20";
  if (kind === "note") return "border-orange-300/15 bg-orange-950/15";
  return "border-white/[0.09] bg-[#111419]";
}

function edgeStroke(mode: DesignEdge["mode"]): string {
  if (mode === "async") return "rgba(196,181,253,0.58)";
  if (mode === "data") return "rgba(125,211,252,0.55)";
  return "rgba(232,226,213,0.45)";
}

function edgeGeometry(from: DesignNode, to: DesignNode) {
  const fromCenter = { x: from.x + NODE_WIDTH / 2, y: from.y + NODE_HEIGHT / 2 };
  const toCenter = { x: to.x + NODE_WIDTH / 2, y: to.y + NODE_HEIGHT / 2 };
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  const boundaryScale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : NODE_WIDTH / 2 / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : NODE_HEIGHT / 2 / Math.abs(dy)
  );
  const scale = Number.isFinite(boundaryScale) ? boundaryScale : 0;
  const startX = fromCenter.x + dx * scale;
  const startY = fromCenter.y + dy * scale;
  const endX = toCenter.x - dx * scale;
  const endY = toCenter.y - dy * scale;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const bend = Math.max(
    32,
    (horizontal ? Math.abs(endX - startX) : Math.abs(endY - startY)) * 0.45
  );
  const horizontalDirection = endX >= startX ? 1 : -1;
  const verticalDirection = endY >= startY ? 1 : -1;
  return {
    path: horizontal
      ? `M ${startX} ${startY} C ${startX + bend * horizontalDirection} ${startY}, ${endX - bend * horizontalDirection} ${endY}, ${endX} ${endY}`
      : `M ${startX} ${startY} C ${startX} ${startY + bend * verticalDirection}, ${endX} ${endY - bend * verticalDirection}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 7
  };
}

function updateNode(
  commit: (update: (current: CanvasSnapshot) => CanvasSnapshot) => void,
  id: string,
  patch: Partial<DesignNode>
) {
  commit((current) => ({
    ...current,
    nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
  }));
}

function updateEdge(
  commit: (update: (current: CanvasSnapshot) => CanvasSnapshot) => void,
  id: string,
  patch: Partial<DesignEdge>
) {
  commit((current) => ({
    ...current,
    edges: current.edges.map((edge) => (edge.id === id ? { ...edge, ...patch } : edge))
  }));
}

function topologicalNodeOrder(nodes: DesignNode[], edges: DesignEdge[]): DesignNode[] {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1));
  const roots = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
  const rest = nodes.filter((node) => (incoming.get(node.id) ?? 0) > 0);
  return [...roots, ...rest];
}

function diagramAsText(snapshot: CanvasSnapshot): string {
  const names = new Map(snapshot.nodes.map((node) => [node.id, node.label]));
  const components = snapshot.nodes
    .map((node) => `- ${node.label} [${node.kind}]${node.detail ? ` — ${node.detail}` : ""}`)
    .join("\n");
  const flows = snapshot.edges
    .map(
      (edge) =>
        `- ${names.get(edge.from) ?? edge.from} -> ${names.get(edge.to) ?? edge.to} (${edge.mode}${edge.label ? `: ${edge.label}` : ""})`
    )
    .join("\n");
  return `Components\n${components || "- None"}\n\nFlows\n${flows || "- None"}\n\nAssumptions and estimates\n${snapshot.notes || "None"}`;
}

function documentFromSnapshot(snapshot: CanvasSnapshot): SystemDesignCanvasDocument {
  return {
    schemaVersion: SYSTEM_DESIGN_CANVAS_SCHEMA_VERSION,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    notes: snapshot.notes
  };
}

function snapshotFromDocument(document: SystemDesignCanvasDocument): CanvasSnapshot {
  return {
    nodes: document.nodes,
    edges: document.edges,
    notes: document.notes
  };
}

function snapshotFingerprint(snapshot: CanvasSnapshot): string {
  return JSON.stringify(snapshot);
}

function canvasSaveLabel(
  status: "loading" | "saved" | "saving" | "offline" | "conflict" | "local"
): string {
  if (status === "loading") return "Loading…";
  if (status === "saving") return "Saving…";
  if (status === "saved") return "Saved";
  if (status === "conflict") return "Newer tab restored";
  if (status === "offline") return "Offline backup";
  return "Local draft";
}

function parseStoredSnapshot(value: string): CanvasSnapshot | null {
  try {
    const parsed = JSON.parse(value) as Partial<CanvasSnapshot>;
    if (
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.edges) ||
      typeof parsed.notes !== "string"
    ) {
      return null;
    }
    const nodes = parsed.nodes
      .filter((node): node is DesignNode =>
        Boolean(
          node &&
          typeof node.id === "string" &&
          NODE_KINDS.includes(node.kind) &&
          typeof node.label === "string" &&
          typeof node.x === "number" &&
          typeof node.y === "number"
        )
      )
      .map((node) => ({ ...node, detail: typeof node.detail === "string" ? node.detail : "" }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = parsed.edges
      .filter((edge): edge is DesignEdge =>
        Boolean(
          edge &&
          typeof edge.id === "string" &&
          typeof edge.from === "string" &&
          typeof edge.to === "string" &&
          nodeIds.has(edge.from) &&
          nodeIds.has(edge.to)
        )
      )
      .map((edge) => {
        const mode: DesignEdge["mode"] =
          edge.mode === "async" || edge.mode === "data" ? edge.mode : "sync";
        return {
          ...edge,
          label: typeof edge.label === "string" ? edge.label : "request",
          mode
        };
      });
    return { nodes, edges, notes: parsed.notes };
  } catch {
    return null;
  }
}

function nextNodeOrdinal(nodes: DesignNode[]): number {
  return (
    nodes.reduce(
      (highest, node) => Math.max(highest, Number(node.id.match(/(\d+)$/)?.[1] ?? 0)),
      0
    ) + 1
  );
}

function isEditingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

import { z } from "zod";

export const SYSTEM_DESIGN_CANVAS_SCHEMA_VERSION = 1 as const;

export const systemDesignCanvasNodeKinds = [
  "client",
  "gateway",
  "service",
  "database",
  "cache",
  "queue",
  "storage",
  "external",
  "note"
] as const;

export const systemDesignCanvasNodeSchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(systemDesignCanvasNodeKinds),
  label: z.string().max(120),
  detail: z.string().max(300),
  x: z.number().finite().min(0).max(20_000),
  y: z.number().finite().min(0).max(20_000)
});

export const systemDesignCanvasEdgeSchema = z.object({
  id: z.string().min(1).max(120),
  from: z.string().min(1).max(80),
  to: z.string().min(1).max(80),
  label: z.string().max(120),
  mode: z.enum(["sync", "async", "data"])
});

export const systemDesignCanvasDocumentSchema = z
  .object({
    schemaVersion: z.literal(SYSTEM_DESIGN_CANVAS_SCHEMA_VERSION),
    nodes: z.array(systemDesignCanvasNodeSchema).max(100),
    edges: z.array(systemDesignCanvasEdgeSchema).max(250),
    notes: z.string().max(12_000)
  })
  .superRefine((document, context) => {
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    if (nodeIds.size !== document.nodes.length) {
      context.addIssue({ code: "custom", message: "Canvas node IDs must be unique" });
    }
    const edgeIds = new Set(document.edges.map((edge) => edge.id));
    if (edgeIds.size !== document.edges.length) {
      context.addIssue({ code: "custom", message: "Canvas edge IDs must be unique" });
    }
    document.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        context.addIssue({
          code: "custom",
          path: ["edges", index],
          message: "Canvas connections must reference existing nodes"
        });
      }
    });
  });

export type SystemDesignCanvasDocument = z.infer<typeof systemDesignCanvasDocumentSchema>;
export type SystemDesignCanvasNode = z.infer<typeof systemDesignCanvasNodeSchema>;
export type SystemDesignCanvasEdge = z.infer<typeof systemDesignCanvasEdgeSchema>;

export interface VersionedSystemDesignCanvas {
  document: SystemDesignCanvasDocument;
  revision: number;
  updatedAt: number;
}

export const EMPTY_SYSTEM_DESIGN_CANVAS: SystemDesignCanvasDocument = {
  schemaVersion: SYSTEM_DESIGN_CANVAS_SCHEMA_VERSION,
  nodes: [],
  edges: [],
  notes: ""
};

/**
 * A deliberately flat, near-black first frame for teacher portraits.
 *
 * Assessment cards can mount immediately after a WebGL interview is torn
 * down. Giving Next Image an explicit dark placeholder prevents its empty
 * image layer from ever exposing the browser canvas/page colour in between.
 */
export const DARK_PORTRAIT_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDE2IDIwIj48cmVjdCB3aWR0aD0iMTYiIGhlaWdodD0iMjAiIGZpbGw9IiMwODA5MGEiLz48L3N2Zz4=";

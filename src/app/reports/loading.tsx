export default function Loading() {
  // The empty report experience has its own immediate Maya stage. Avoid briefly
  // replacing it with generic cards during a refresh or dynamic server render.
  return null;
}

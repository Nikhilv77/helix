import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import voice from "./voice-levels.json";

export const TEACHERS = ["maya", "daniel", "olivia", "ryan", "claire"] as const;
export type TeacherId = (typeof TEACHERS)[number];

/** Portrait canvas: head and shoulders, drawn at 2x so the face stays sharp at 1080p. */
export const W = 760;
export const H = 720;
const PIXEL_RATIO = 2;

type Slot = { values: number[]; index: number };
type Loaded = { model: THREE.Object3D; slots: Map<string, Slot[]>; focusY: number; lookY: number; distance: number };
type Rig = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; teachers: Map<TeacherId, Loaded> };

/**
 * Frame-deterministic version of the app's avatar stage. Every teacher is loaded
 * once; the frame decides who is on screen and how open their mouth is, from
 * loudness measured off their own recorded greeting (`voice-levels.json`).
 */
export function SpeakingTeacher({ frame, teacher, speakingFrom }: { frame: number; teacher: TeacherId; speakingFrom: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rig = useRef<Rig | null>(null);
  const [handle] = useState(() => delayRender("Load the teachers' 3D portraits"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvas.current) return;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ canvas: canvas.current, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(PIXEL_RATIO);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0xffffff, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 100);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    scene.environment = environment.texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb7a899, 0.9));
    const key = new THREE.DirectionalLight(0xfff5e9, 1.6);
    key.position.set(1.2, 2.2, 1.8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe6eeff, 0.7);
    fill.position.set(-1.8, 1.5, 2);
    scene.add(fill);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const teachers: Rig["teachers"] = new Map();
    Promise.all(
      TEACHERS.map(
        (id) =>
          new Promise<void>((resolve, reject) =>
            loader.load(
              staticFile(`${id}.glb`),
              ({ scene: model }) => {
                const slots = new Map<string, Slot[]>();
                model.traverse((child) => {
                  if (!(child instanceof THREE.Mesh) || !child.morphTargetDictionary || !child.morphTargetInfluences) return;
                  for (const [name, index] of Object.entries(child.morphTargetDictionary)) {
                    const group = slots.get(name) ?? [];
                    group.push({ values: child.morphTargetInfluences, index });
                    slots.set(name, group);
                  }
                });
                // The app's geometry-based head-and-shoulders framing, per model.
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const centre = box.getCenter(new THREE.Vector3());
                model.position.x -= centre.x;
                model.position.z -= centre.z;
                const focusY = box.max.y - size.y * 0.1;
                const framedHeight = size.y * 0.27;
                const distance = framedHeight / 2 / Math.tan((camera.fov / 2) * THREE.MathUtils.DEG2RAD);
                model.visible = false;
                scene.add(model);
                teachers.set(id, { model, slots, focusY, lookY: focusY - size.y * 0.012, distance });
                resolve();
              },
              undefined,
              reject
            )
          )
      )
    )
      .then(() => {
        if (disposed) return;
        rig.current = { renderer, scene, camera, teachers };
        setReady(true);
      })
      .catch((error) => cancelRender(error));

    return () => {
      disposed = true;
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (Array.isArray(child.material) ? child.material : [child.material]).forEach((material) => material.dispose());
        }
      });
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      rig.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const r = rig.current;
    if (!r || !ready) return;
    const current = r.teachers.get(teacher);
    if (!current) return;
    for (const [id, loaded] of r.teachers) loaded.model.visible = id === teacher;
    r.camera.position.set(0, current.focusY, current.distance);
    r.camera.lookAt(0, current.lookY, 0);

    const levels = (voice as Record<string, { levels: number[] }>)[teacher]?.levels ?? [];
    const at = frame - speakingFrom;
    // Two frames of smoothing: the mouth follows the voice without chattering.
    const loudness = (levels[at] ?? 0) * 0.55 + (levels[at - 1] ?? 0) * 0.3 + (levels[at - 2] ?? 0) * 0.15;
    const mouth = Math.min(0.42, loudness * 0.62);
    const set = (name: string, value: number) => current.slots.get(name)?.forEach(({ values, index }) => { values[index] = value; });
    set("jawOpen", mouth * 0.7);
    set("viseme_aa", mouth * 0.38);
    set("viseme_O", mouth * (0.15 + Math.sin(frame * 0.2) * 0.12));
    set("viseme_E", mouth * (0.15 + Math.cos(frame * 0.15) * 0.12));
    set("mouthSmileLeft", 0.04);
    set("mouthSmileRight", 0.04);
    const blinkFrame = frame % 212;
    const blink = blinkFrame < 11 ? Math.sin((blinkFrame / 11) * Math.PI) : 0;
    set("eyeBlinkLeft", blink);
    set("eyeBlinkRight", blink);
    set("browInnerUp", mouth * 0.12);
    current.model.rotation.y = Math.sin(frame / 96) * 0.028;
    current.model.rotation.z = Math.sin(frame / 134) * 0.006;
    r.renderer.render(r.scene, r.camera);
    continueRender(handle);
  }, [frame, teacher, speakingFrom, ready, handle]);

  return (
    <canvas
      ref={canvas}
      width={W * PIXEL_RATIO}
      height={H * PIXEL_RATIO}
      style={{ width: W, height: H, display: "block", maskImage: "radial-gradient(ellipse 60% 56% at 50% 38%, black 60%, transparent 100%)" }}
    />
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { attachTrack, detachVoice, readVoice, type VoiceBands } from "@/lib/voice-bus";
import type { PresenceState } from "./interviewer-presence";

/** Feathers the bottom of the canvas so the figure is not visibly cut off. */
const FADE =
  "linear-gradient(to bottom, #000 0%, #000 72%, rgba(0,0,0,0.55) 88%, transparent 100%)";

interface AvatarStageProps {
  /** The agent's audio. Drives the mouth. */
  agentTrack: MediaStreamTrack | null;
  state: PresenceState;
  /**
   * Any .glb carrying ARKit blendshapes and Oculus visemes — an Avaturn
   * export, or a local file under /public. Model-agnostic: the rig below
   * looks morph targets up by name.
   */
  url: string;
}

/**
 * Rigged humanoid avatar with amplitude-driven mouth shapes.
 *
 * Deepgram Aura returns no phoneme timings, so the mouth is driven by loudness
 * and spectral tilt rather than true visemes: louder opens the jaw, and bright
 * versus dark audio leans the shape between a wide "E" and a rounded "O". It
 * reads correctly in conversation without pretending to be real lip sync.
 */
const SILENT_VOICE: VoiceBands = { level: 0, low: 0, mid: 0, high: 0, silent: true };

export function AvatarStage({ agentTrack, state, url }: AvatarStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  // A LiveKit track feeds the shared bus; elsewhere Maya's <audio> element has
  // already registered itself there, so the mouth works on every surface.
  useEffect(() => {
    if (!agentTrack) return;
    attachTrack(agentTrack);
    return () => detachVoice();
  }, [agentTrack]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

    // Creating the context throws outright when WebGL is unavailable — hardware
    // acceleration switched off, a crashed GPU process, some VMs and remote
    // desktops. Unhandled, that error escaped the effect and took the whole
    // page down with it, which is severe for a decorative avatar that already
    // has an "unavailable" state to fall back to.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus("failed");
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Filmic tone mapping plus image-based lighting: PBR skin and hair look
    // flat and plastic under direct lights alone.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Cool ambient with a cream key and a blue rim, so the avatar sits inside
    // the blueprint palette rather than looking pasted onto it.
    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1b3480, 1.5));
    const key = new THREE.DirectionalLight(0xefe8d6, 2.4);
    key.position.set(1.2, 2.2, 1.8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f9bff, 2.2);
    rim.position.set(-2, 1.4, -1.6);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xefe8d6, 0.6);
    fill.position.set(-0.8, 0.6, 2);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    let morphMeshes: THREE.Mesh[] = [];
    let disposed = false;
    let frame = 0;

    let blinkAt = performance.now() + 2500;
    let blinkPhase = -1;
    let lastFrame = 0;
    // One value per shape, each eased separately: mouths open fast and close
    // slowly, and a single shared scalar could not express that.
    const shapes = {
      jaw: 0,
      aa: 0,
      E: 0,
      O: 0,
      U: 0,
      I: 0,
      sil: 0,
      press: 0,
      smile: 0
    };
    let clock = 0;

    function resize() {
      const rect = mount!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // updateStyle must stay on: without it Three sets the drawing buffer to
      // width * devicePixelRatio but leaves the element unstyled, so the canvas
      // displays at 2x on a retina screen and overflows its container.
      renderer.setSize(rect.width, rect.height);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    new GLTFLoader().load(
      url,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        root.add(model);

        model.traverse((child) => {
          if (child instanceof THREE.Mesh && child.morphTargetDictionary) {
            morphMeshes.push(child);
          }
        });

        // Frame from geometry, not node names. Matching a node called "head"
        // is unreliable across rigs — several models aim the camera at the
        // knees. Human proportions put the head centre about 7% down from the
        // top of the bounding box, whatever the rig calls its bones.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const headY = box.max.y - size.y * 0.075;
        const framedHeight = size.y * 0.36;

        model.position.x -= centre.x;
        model.position.z -= centre.z;

        const distance = framedHeight / 2 / Math.tan((camera.fov / 2) * THREE.MathUtils.DEG2RAD);
        camera.position.set(0, headY, distance);
        camera.lookAt(0, headY - size.y * 0.02, 0);

        resize();
        setStatus("ready");
      },
      undefined,
      () => {
        if (!disposed) setStatus("failed");
      }
    );

    /** Ease toward a target with separate attack and release rates. */
    function ease(current: number, target: number, attack: number, release: number, delta: number) {
      const rate = target > current ? attack : release;
      // Frame-rate independent: the same motion on a 60Hz and a 120Hz display.
      return current + (target - current) * (1 - Math.exp(-rate * delta));
    }

    function shapeMouth(voice: VoiceBands, delta: number, speaking: boolean) {
      const energy = voice.low + voice.mid + voice.high || 1;
      const lowShare = voice.low / energy;
      const midShare = voice.mid / energy;
      const highShare = voice.high / energy;

      const open = voice.level;
      const voicing = speaking && !voice.silent;
      // Lips only meet between words *within* a line. At rest every mouth shape
      // returns to zero, otherwise the face sits there with pressed lips.
      const betweenWords = speaking && voice.silent;

      // One shape at a time. Blend targets are additive, so driving aa, E, I, O
      // and U together summed into a pucker no real mouth makes. Pick the vowel
      // the spectrum actually points at and let the rest fall to zero.
      const rounded = lowShare > 0.52 && highShare < 0.24;
      let aa = 0;
      let E = 0;
      let I = 0;
      let O = 0;
      let U = 0;

      if (voicing) {
        if (rounded) {
          O = open * 0.62;
          U = open * 0.18;
        } else if (highShare > midShare && highShare > lowShare) {
          I = open * 0.5;
        } else if (midShare >= lowShare) {
          E = open * 0.66;
        } else {
          aa = open * 0.8;
        }
      }

      shapes.jaw = ease(shapes.jaw, open * 0.7, 26, 13, delta);
      shapes.aa = ease(shapes.aa, aa, 24, 14, delta);
      shapes.E = ease(shapes.E, E, 26, 15, delta);
      shapes.I = ease(shapes.I, I, 28, 16, delta);
      shapes.O = ease(shapes.O, O, 20, 12, delta);
      shapes.U = ease(shapes.U, U, 18, 11, delta);
      shapes.sil = ease(shapes.sil, betweenWords ? 0.22 : 0, 22, 18, delta);
      shapes.press = ease(shapes.press, betweenWords ? 0.07 : 0, 20, 16, delta);
      // Barely there. On this rig the smile target pushes the lips up and out,
      // so anything higher reads as a pout rather than a resting expression.
      shapes.smile = ease(shapes.smile, speaking ? 0 : 0.025, 6, 6, delta);

      // jawOpen and mouthOpen both open the mouth; applying both doubles it.
      if (hasMorph("jawOpen")) {
        setMorph("jawOpen", shapes.jaw);
      } else {
        setMorph("mouthOpen", shapes.jaw * 0.7);
      }
      setMorph("viseme_aa", shapes.aa);
      setMorph("viseme_E", shapes.E);
      setMorph("viseme_I", shapes.I);
      setMorph("viseme_O", shapes.O);
      setMorph("viseme_U", shapes.U);
      setMorph("viseme_sil", shapes.sil);
      setMorph("mouthClose", shapes.press);
      setMorph("viseme_PP", shapes.press * 0.5);
      if (hasMorph("mouthSmile")) {
        setMorph("mouthSmile", shapes.smile);
      } else {
        setMorph("mouthSmileLeft", shapes.smile);
        setMorph("mouthSmileRight", shapes.smile);
      }
      setMorph("browInnerUp", shapes.jaw * 0.12);
    }

    function hasMorph(name: string): boolean {
      return morphMeshes.some((mesh) => mesh.morphTargetDictionary?.[name] !== undefined);
    }

    function setMorph(name: string, value: number) {
      for (const mesh of morphMeshes) {
        const index = mesh.morphTargetDictionary?.[name];
        if (index === undefined || !mesh.morphTargetInfluences) continue;
        mesh.morphTargetInfluences[index] = value;
      }
    }

    function render(now: number) {
      frame = requestAnimationFrame(render);
      const delta = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
      lastFrame = now;
      clock += delta;

      const speaking = stateRef.current === "speaking";
      const voice = speaking ? readVoice() : SILENT_VOICE;
      shapeMouth(voice, delta, speaking);

      // Blink.      // Blink.
      if (blinkPhase < 0 && now > blinkAt) {
        blinkPhase = 0;
        blinkAt = now + 2600 + Math.random() * 3800;
      }
      if (blinkPhase >= 0) {
        blinkPhase += 0.16;
        const shut = Math.sin(Math.min(Math.PI, blinkPhase));
        setMorph("eyeBlinkLeft", shut);
        setMorph("eyeBlinkRight", shut);
        if (blinkPhase >= Math.PI) blinkPhase = -1;
      }

      if (!reduced) {
        // Breathing and a little attention drift, so it is never truly still.
        root.position.y = Math.sin(clock * 1.1) * 0.004;
        root.rotation.y =
          Math.sin(clock * 0.35) * 0.05 + (speaking ? Math.sin(clock * 2.4) * 0.012 : 0);
        root.rotation.x = Math.sin(clock * 0.27) * 0.02;
      }

      renderer.render(scene, camera);
    }

    frame = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      morphMeshes = [];
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((m) => m.dispose());
          else material.dispose();
        }
      });
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [url]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={mountRef}
        className="h-full w-full"
        style={{
          maskImage: FADE,
          WebkitMaskImage: FADE
        }}
      />

      {status !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="blueprint-label text-cream/40">
            {status === "loading" ? "Loading interviewer" : "Avatar unavailable"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Loudness plus spectral tilt from the live agent audio. */

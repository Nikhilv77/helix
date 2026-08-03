"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { PresenceState } from "./interviewer-presence";

/** Feathers the bottom of the canvas so the figure is not visibly cut off. */
const FADE = "linear-gradient(to bottom, #000 0%, #000 72%, rgba(0,0,0,0.55) 88%, transparent 100%)";

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
export function AvatarStage({ agentTrack, state, url }: AvatarStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const analyser = useAudioAnalyser(agentTrack);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    let mouth = 0;
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

        const distance =
          framedHeight / 2 / Math.tan((camera.fov / 2) * THREE.MathUtils.DEG2RAD);
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

    function setMorph(name: string, value: number) {
      for (const mesh of morphMeshes) {
        const index = mesh.morphTargetDictionary?.[name];
        if (index === undefined || !mesh.morphTargetInfluences) continue;
        mesh.morphTargetInfluences[index] = value;
      }
    }

    function render(now: number) {
      frame = requestAnimationFrame(render);
      clock += 0.016;

      const speaking = stateRef.current === "speaking";
      const { level, brightness } = analyser.current.read();
      const target = speaking ? level : 0;
      mouth += (target - mouth) * 0.35;

      // Loudness opens the jaw; spectral tilt leans the shape.
      setMorph("jawOpen", mouth * 0.75);
      setMorph("mouthOpen", mouth * 0.5);
      setMorph("viseme_aa", mouth * 0.55);
      setMorph("viseme_O", mouth * (1 - brightness) * 0.5);
      setMorph("viseme_E", mouth * brightness * 0.45);
      setMorph("mouthSmile", stateRef.current === "listening" ? 0.12 : 0.04);

      // Blink.
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
        root.rotation.y = Math.sin(clock * 0.35) * 0.05 + (speaking ? Math.sin(clock * 2.4) * 0.012 : 0);
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
  }, [analyser, url]);

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
function useAudioAnalyser(track: MediaStreamTrack | null) {
  const ref = useRef({ read: () => ({ level: 0, brightness: 0.5 }) });

  useEffect(() => {
    if (!track) {
      ref.current = { read: () => ({ level: 0, brightness: 0.5 }) };
      return;
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const source = context.createMediaStreamSource(new MediaStream([track]));
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;

    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(analyser);
    analyser.connect(mute);
    mute.connect(context.destination);
    void context.resume().catch(() => null);

    const time = new Uint8Array(analyser.fftSize);
    const freq = new Uint8Array(analyser.frequencyBinCount);

    ref.current = {
      read: () => {
        analyser.getByteTimeDomainData(time as Uint8Array<ArrayBuffer>);
        analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>);

        let sum = 0;
        for (let i = 0; i < time.length; i += 1) {
          const centred = ((time[i] ?? 128) - 128) / 128;
          sum += centred * centred;
        }

        let low = 0;
        let high = 0;
        const split = Math.floor(freq.length * 0.18);
        for (let i = 0; i < freq.length; i += 1) {
          if (i < split) low += freq[i] ?? 0;
          else high += freq[i] ?? 0;
        }

        return {
          level: Math.min(1, Math.sqrt(sum / time.length) * 4.2),
          brightness: low + high === 0 ? 0.5 : Math.min(1, (high / (low + high)) * 2.2)
        };
      }
    };

    return () => {
      ref.current = { read: () => ({ level: 0, brightness: 0.5 }) };
      source.disconnect();
      analyser.disconnect();
      mute.disconnect();
      void context.close().catch(() => null);
    };
  }, [track]);

  return ref;
}

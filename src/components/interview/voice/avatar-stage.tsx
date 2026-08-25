"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { attachTrack, detachVoice, readVoice, type VoiceBands } from "@/lib/voice/voice-bus";
import { DEFAULT_RIG, type AvatarRig } from "@/lib/avatars/personas";
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
  framing?: "default" | "marketing" | "portrait";
  performanceProfile?: "default" | "marketing" | "preview";
  /** Hide the stage status when the surrounding UI supplies its own visual state. */
  showStatus?: boolean;
  /** Keep the full portrait visible instead of fading it into a card edge. */
  feather?: boolean;
  /** Plays a short smile-and-nod gesture at the start of an introduction. */
  introducing?: boolean;
  /**
   * Set false to park the render loop while the avatar is still mounted. The
   * marketing hero is `position: sticky`, so it never leaves the viewport and
   * an IntersectionObserver alone cannot tell that the page has scrolled over
   * the top of it.
   */
  active?: boolean;
  /**
   * Per-persona motion constants. Two personas can share a mesh and still read
   * as different people: the blink rate, resting mouth and idle sway carry most
   * of it. Defaults to the neutral rig.
   */
  rig?: AvatarRig;
}

/**
 * How densely to render, per device.
 *
 * The marketing hero puts the canvas inside a `scale-[1.18]` on small screens,
 * so the compositor resamples whatever we draw before it reaches the glass.
 * Rendering at the plain device ratio therefore lands *below* one device pixel
 * per displayed pixel on a phone, which reads as a soft, aliased face — the
 * hair and the glasses frames give it away first. Phones get headroom above
 * the desktop cap to absorb that upscale.
 *
 * MSAA stays on everywhere. Making it conditional is what broke this the first
 * time — it was switched off on the grounds that a 2x buffer supersamples it
 * away, while the very next line capped the buffer at 1.5x and removed the
 * supersampling it was counting on. Mobile GPUs are tile-based and resolve
 * multisampling inside tile memory, so it is far cheaper there than the
 * bandwidth argument against it suggests.
 *
 * Raise MOBILE_PIXEL_RATIO_CAP for a sharper phone render at a squarely
 * quadratic cost in fragment work; lower it if frames start dropping.
 */
const MOBILE_PIXEL_RATIO_CAP = 2.5;
const MARKETING_MOBILE_PIXEL_RATIO_CAP = 1.75;
const DESKTOP_PIXEL_RATIO_CAP = 2;

function mobileProfile(performanceProfile: "default" | "marketing" | "preview") {
  const dpr = window.devicePixelRatio || 1;
  if (performanceProfile === "preview") {
    return {
      antialias: true,
      pixelRatio: Math.min(dpr, 1),
      frameInterval: 0
    };
  }
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  const constrained = coarse && small;
  const marketingMobile = constrained && performanceProfile === "marketing";

  return {
    antialias: true,
    pixelRatio: Math.min(
      dpr,
      marketingMobile
        ? MARKETING_MOBILE_PIXEL_RATIO_CAP
        : constrained
          ? MOBILE_PIXEL_RATIO_CAP
          : DESKTOP_PIXEL_RATIO_CAP
    ),
    frameInterval: marketingMobile ? 1000 / 30 : 0
  };
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

/** Radians per second through the blink arc — 0.16 per frame at 60Hz. */
const BLINK_RATE = 9.6;

export function AvatarStage({
  agentTrack,
  state,
  url,
  framing = "default",
  active = true,
  performanceProfile = "default",
  showStatus = true,
  feather = true,
  introducing = false,
  rig = DEFAULT_RIG
}: AvatarStageProps) {
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
  // Read inside the loop's gate rather than in the dependency list: rebuilding
  // the scene and re-downloading the model every time the hero scrolls past
  // would cost far more than the loop it is trying to stop.
  const activeRef = useRef(active);
  activeRef.current = active;
  // Also read inside the loop rather than through the dependency list: swapping
  // a persona's motion constants must not re-download the model.
  const rigRef = useRef(rig);
  rigRef.current = rig;
  const introducingRef = useRef(introducing);
  introducingRef.current = introducing;
  const syncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const profile = mobileProfile(performanceProfile);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

    // Creating the context throws outright when WebGL is unavailable — hardware
    // acceleration switched off, a crashed GPU process, some VMs and remote
    // desktops. Unhandled, that error escaped the effect and took the whole
    // page down with it, which is severe for a decorative avatar that already
    // has an "unavailable" state to fall back to.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: profile.antialias, alpha: true });
    } catch {
      setStatus("failed");
      return;
    }

    renderer.setPixelRatio(profile.pixelRatio);
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

    // Resolved once at load. Walking every mesh's morphTargetDictionary for
    // each of the fourteen shapes below, sixty times a second, was pure
    // per-frame string hashing on the main thread.
    let morphSlots = new Map<string, Array<{ influences: number[]; index: number }>>();
    let disposed = false;
    let frame = 0;

    let blinkAt = performance.now() + rigRef.current.blinkIntervalMs[0];
    let blinkPhase = -1;
    let lastFrame = 0;
    let lastRenderedFrame = 0;
    let head: THREE.Object3D | null = null;
    const headRest = new THREE.Quaternion();
    const nodRotation = new THREE.Quaternion();
    const nodAxis = new THREE.Vector3(1, 0, 0);
    let wasIntroducing = false;
    let introductionElapsed = Number.POSITIVE_INFINITY;
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
      smile: 0,
      cheek: 0
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

    // The model ships meshopt-compressed: vertex and morph-target data is
    // quantized and byte-packed, which more than halves the download at the
    // cost of a decode measured in single-digit milliseconds. The decoder is
    // pure JS + wasm and rides in this chunk, which is already lazy.
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
      url,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        root.add(model);

        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const dictionary = child.morphTargetDictionary;
          const influences = child.morphTargetInfluences;
          if (!dictionary || !influences) return;

          for (const [name, index] of Object.entries(dictionary)) {
            const slots = morphSlots.get(name);
            if (slots) slots.push({ influences, index });
            else morphSlots.set(name, [{ influences, index }]);
          }
        });

        // Both supported skeleton families expose a head bone, but use
        // different names. Keep its authored rest pose and layer only a tiny
        // greeting nod on top so the model never snaps into a generic pose.
        head =
          model.getObjectByName("Head") ??
          model.getObjectByName("Bip01 Head") ??
          model.children.find((child) => /(^|\s)head$/i.test(child.name)) ??
          null;
        if (head) headRest.copy(head.quaternion);

        // Frame from geometry, not node names. Matching a node called "head"
        // is unreliable across rigs — several models aim the camera at the
        // knees. Human proportions put the head centre about 7% down from the
        // top of the bounding box, whatever the rig calls its bones.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const centre = box.getCenter(new THREE.Vector3());
        const marketingFrame = framing === "marketing";
        const portraitFrame = framing === "portrait";
        const focusY = box.max.y - size.y * 0.075;
        const framedHeight = size.y * (marketingFrame ? 0.34 : portraitFrame ? 0.56 : 0.36);

        model.position.x -= centre.x;
        model.position.z -= centre.z;

        const distance = framedHeight / 2 / Math.tan((camera.fov / 2) * THREE.MathUtils.DEG2RAD);
        camera.position.set(0, focusY, distance);
        camera.lookAt(0, focusY - size.y * 0.02, 0);

        resize();
        // Parked preview stages still need one frame on screen. Their render
        // loops remain stopped after this initial draw.
        renderer.render(scene, camera);
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

    function shapeMouth(
      voice: VoiceBands,
      delta: number,
      speaking: boolean,
      introductionAmount: number
    ) {
      const energy = voice.low + voice.mid + voice.high || 1;
      const lowShare = voice.low / energy;
      const midShare = voice.mid / energy;
      const highShare = voice.high / energy;

      // Raw audio energy is too wide for these morphs: jaw and vowel targets
      // compound visually even though only one vowel is active. Keep the face
      // articulate without stretching the lips to their authored extremes.
      const open = voice.level * 0.58;
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
          O = open * 0.5;
          U = open * 0.14;
        } else if (highShare > midShare && highShare > lowShare) {
          I = open * 0.4;
        } else if (midShare >= lowShare) {
          E = open * 0.52;
        } else {
          aa = open * 0.62;
        }
      }

      shapes.jaw = ease(shapes.jaw, open * 0.54, 18, 11, delta);
      shapes.aa = ease(shapes.aa, aa, 17, 11, delta);
      shapes.E = ease(shapes.E, E, 18, 12, delta);
      shapes.I = ease(shapes.I, I, 19, 12, delta);
      shapes.O = ease(shapes.O, O, 16, 10, delta);
      shapes.U = ease(shapes.U, U, 15, 10, delta);
      shapes.sil = ease(shapes.sil, betweenWords ? 0.16 : 0, 16, 13, delta);
      shapes.press = ease(shapes.press, betweenWords ? 0.05 : 0, 15, 12, delta);
      // Barely there. On this rig the smile target pushes the lips up and out,
      // so anything much higher reads as a pout rather than a resting
      // expression — which is why personas vary it only within a narrow band.
      const smileTarget =
        introductionAmount > 0
          ? Math.max(rigRef.current.restingSmile, introductionAmount * 0.075)
          : speaking
            ? 0
            : rigRef.current.restingSmile;
      shapes.smile = ease(shapes.smile, smileTarget, 8, 6, delta);
      shapes.cheek = ease(shapes.cheek, introductionAmount * 0.035, 8, 6, delta);

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
      setMorph("cheekSquintLeft", shapes.cheek);
      setMorph("cheekSquintRight", shapes.cheek);
      setMorph("browInnerUp", shapes.jaw * rigRef.current.browActivity);
    }

    function hasMorph(name: string): boolean {
      return morphSlots.has(name);
    }

    function setMorph(name: string, value: number) {
      const slots = morphSlots.get(name);
      if (!slots) return;
      for (const slot of slots) slot.influences[slot.index] = value;
    }

    function render(now: number) {
      frame = requestAnimationFrame(render);
      if (profile.frameInterval > 0 && now - lastRenderedFrame < profile.frameInterval) return;
      lastRenderedFrame = now;

      const delta = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
      lastFrame = now;
      clock += delta;

      const speaking = stateRef.current === "speaking";
      const introducingNow = introducingRef.current;
      if (introducingNow && !wasIntroducing) introductionElapsed = 0;
      if (introducingNow) introductionElapsed += delta;
      wasIntroducing = introducingNow;

      // One smooth down-and-up nod with a smile that fades before the spoken
      // introduction finishes. Squaring the sine removes the sharp endpoints.
      const introductionProgress = Math.min(1, introductionElapsed / 2.1);
      const introductionAmount =
        introductionProgress < 1 ? Math.sin(Math.PI * introductionProgress) ** 2 : 0;
      const voice = speaking ? readVoice() : SILENT_VOICE;
      shapeMouth(voice, delta, speaking, introductionAmount);

      if (head) {
        const nodAngle = reduced ? 0 : introductionAmount * 0.075;
        nodRotation.setFromAxisAngle(nodAxis, nodAngle);
        head.quaternion.copy(headRest).multiply(nodRotation);
      }

      // Blink. Advanced by elapsed time, not by frame: at a fixed step per
      // frame the same blink took half as long on a 120Hz display as on a
      // 60Hz one. BLINK_RATE reproduces the 60Hz timing exactly.
      if (blinkPhase < 0 && now > blinkAt) {
        blinkPhase = 0;
        const [minGap, maxGap] = rigRef.current.blinkIntervalMs;
        blinkAt = now + minGap + Math.random() * (maxGap - minGap);
      }
      if (blinkPhase >= 0) {
        blinkPhase += delta * BLINK_RATE;
        const shut = Math.sin(Math.min(Math.PI, blinkPhase));
        setMorph("eyeBlinkLeft", shut);
        setMorph("eyeBlinkRight", shut);
        if (blinkPhase >= Math.PI) blinkPhase = -1;
      }

      if (!reduced) {
        // Breathing and a little attention drift, so it is never truly still.
        // `motion` scales the amplitudes but not the frequencies: a composed
        // interviewer moves less, not more slowly.
        const motion = rigRef.current.motion;
        root.position.y = Math.sin(clock * 1.1) * 0.004 * motion;
        root.rotation.y =
          (Math.sin(clock * 0.35) * 0.05 + (speaking ? Math.sin(clock * 2.4) * 0.012 : 0)) * motion;
        root.rotation.x = Math.sin(clock * 0.27) * 0.02 * motion;
      }

      renderer.render(scene, camera);
    }

    /*
     * The loop is the single most expensive thing on the marketing page, and
     * for most of that page nobody can see it: the hero is `position: sticky`,
     * so the canvas stays pinned in the viewport while the sections scroll
     * over the top of it, and WebGL happily keeps shading a fully occluded
     * figure at full rate against the scroll. Three gates park it — the tab is
     * backgrounded, the canvas is genuinely off-screen, or the owner says it
     * is covered. Pausing leaves the last frame in the canvas, so resuming is
     * invisible.
     */
    let onScreen = true;
    let pageVisible = document.visibilityState === "visible";
    let running = false;

    function startLoop() {
      if (running || disposed) return;
      running = true;
      // Reset the clock so the first delta after a pause is one frame, not the
      // whole time spent parked.
      lastFrame = performance.now();
      lastRenderedFrame = 0;
      frame = requestAnimationFrame(render);
    }

    function stopLoop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
      frame = 0;
    }

    function sync() {
      if (onScreen && pageVisible && activeRef.current) startLoop();
      else stopLoop();
    }

    syncRef.current = sync;

    const visibility = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
        sync();
      },
      { rootMargin: "120px" }
    );
    visibility.observe(mount);

    function onPageVisibility() {
      pageVisible = document.visibilityState === "visible";
      sync();
    }

    document.addEventListener("visibilitychange", onPageVisibility);
    sync();

    return () => {
      disposed = true;
      syncRef.current = null;
      stopLoop();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onPageVisibility);
      visibility.disconnect();
      observer.disconnect();
      morphSlots = new Map();
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
  }, [framing, performanceProfile, url]);

  // Nudges the gate above. Deliberately separate from the scene effect: `active`
  // flips on every scroll past the hero, and rebuilding the renderer there
  // would be far worse than the loop it stops.
  useEffect(() => {
    syncRef.current?.();
  }, [active]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={mountRef}
        className="h-full w-full"
        style={feather ? { maskImage: FADE, WebkitMaskImage: FADE } : undefined}
      />

      {showStatus && status !== "ready" ? (
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

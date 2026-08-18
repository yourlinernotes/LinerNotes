"use client";
// LinerNotes jewel-case viz — the three interaction scenarios:
//  A) coverMode="disc": art on the disc, closed clear case; review-click -> small spin beat
//  B) coverMode="pane": art on the front pane, reflective disc; review-click -> disc peeks out
//  Player) playerOpen: lid swings open on the spine hinge, disc spins continuously
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, Lightformer, OrbitControls, useTexture, Center, MeshReflectorMaterial } from "@react-three/drei";
import { Suspense, useRef, useMemo, useEffect } from "react";
import { useControls } from "leva";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";

// ---- procedural texture kit: photoreal = layered imperfection ----------------
function makeDiscMaps() {
  const size = 1024, cx = size / 2;
  // color: silver with real CD ring structure + radial hairline streaks
  const c1 = document.createElement("canvas"); c1.width = c1.height = size;
  const a = c1.getContext("2d")!;
  a.fillStyle = "#ccd2d8"; a.fillRect(0, 0, size, size);
  const band = (r0: number, r1: number, fill: string) => {
    a.beginPath(); a.arc(cx, cx, r1, 0, 7); a.arc(cx, cx, r0, 0, 7, true);
    a.closePath(); a.fillStyle = fill; a.fill();
  };
  band(size * 0.055, size * 0.115, "#e8ebee"); // clamp ring
  band(size * 0.115, size * 0.155, "#dde1e6"); // stacking ring
  band(size * 0.155, size * 0.185, "#f3f5f8"); // mirror band
  band(size * 0.185, size * 0.485, "#d5dbe2"); // data band (bright mirror)
  a.globalAlpha = 0.10;                        // radial micro-scratches (the track catch)
  for (let i = 0; i < 1600; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r0 = size * (0.16 + Math.random() * 0.31), len = size * (0.015 + Math.random() * 0.05);
    a.strokeStyle = Math.random() < 0.5 ? "#ffffff" : "#8f959c"; a.lineWidth = 1;
    a.beginPath();
    a.moveTo(cx + Math.cos(ang) * r0, cx + Math.sin(ang) * r0);
    a.lineTo(cx + Math.cos(ang) * (r0 + len), cx + Math.sin(ang) * (r0 + len));
    a.stroke();
  }
  a.globalAlpha = 1;
  // concentric moulding rings in the clear hub (reads as a different material)
  a.strokeStyle = "#b9bfc6"; a.globalAlpha = 0.5;
  for (let rr = 0.06; rr < 0.155; rr += 0.012) {
    a.lineWidth = 1.2; a.beginPath(); a.arc(cx, cx, size * rr, 0, 7); a.stroke();
  }
  a.globalAlpha = 1;
  const color = new THREE.CanvasTexture(c1);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;

  // property map: GREEN = roughness, BLUE = metalness (three.js channel conventions)
  const c3 = document.createElement("canvas"); c3.width = c3.height = size;
  const d = c3.getContext("2d")!;
  d.fillStyle = "rgb(0,30,255)"; d.fillRect(0, 0, size, size);      // data band: polished metal
  d.beginPath(); d.arc(cx, cx, size * 0.155, 0, 7); d.arc(cx, cx, size * 0.05, 0, 7, true);
  d.closePath(); d.fillStyle = "rgb(0,95,110)"; d.fill();           // hub: rough clear plastic
  const props = new THREE.CanvasTexture(c3);

  return { color, props };
}

// record-shop price sticker: rating as a physical object detail
function makeStickerMap(rating: number) {
  const size = 256, c = document.createElement("canvas"); c.width = c.height = size;
  const a = c.getContext("2d")!;
  a.clearRect(0, 0, size, size);
  a.beginPath(); a.arc(size / 2, size / 2, size / 2 - 6, 0, 7);
  a.fillStyle = "#f7f2e2"; a.fill();
  a.lineWidth = 3; a.strokeStyle = "#d9d2ba"; a.stroke();
  a.fillStyle = "#c0392b";
  a.font = "700 92px 'Helvetica Neue', system-ui, sans-serif";
  a.textAlign = "center"; a.textBaseline = "middle";
  a.fillText(rating.toFixed(1), size / 2, size / 2 - 14);
  a.fillStyle = "#1c1c1c";
  a.font = "46px system-ui, sans-serif";
  const full = Math.round(rating);
  const stars = "\u2605".repeat(Math.min(5, full)) + "\u2606".repeat(Math.max(0, 5 - full));
  a.fillText(stars, size / 2, size / 2 + 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// paper obi (Japanese CD spine band): title block + vertical text + rating
// album-accent: hue from the art, saturation/lightness clamped so it can never go muddy
function deriveAccent(img: CanvasImageSource | undefined): string {
  const FALLBACK = "#c0392b"; // classic obi red for colourless covers
  if (!img) return FALLBACK;
  try {
    const n = 24, c = document.createElement("canvas"); c.width = c.height = n;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0, n, n);
    const d = x.getImageData(0, 0, n, n).data;
    let sx = 0, sy = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
      if (sat < 0.15 || l < 0.12 || l > 0.92) continue; // skip mud + near-b&w
      let h = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
      h *= 60; if (h < 0) h += 360;
      sx += Math.cos(h * Math.PI / 180) * sat; sy += Math.sin(h * Math.PI / 180) * sat; w += sat;
    }
    if (w < 3) return FALLBACK; // not enough real colour in the art
    const h = (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360;
    return `hsl(${h.toFixed(0)} 62% 46%)`; // fixed vivid S/L — shareable-pretty by construction
  } catch { return FALLBACK; }
}

function makeObiMap(rating: number, accent: string = "#c0392b") {
  const w = 256, h = 1024;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const a = c.getContext("2d")!;
  a.fillStyle = "#f4efe1"; a.fillRect(0, 0, w, h);          // paper
  a.fillStyle = accent; a.fillRect(0, 0, w, 150);           // accent block (album-derived)
  a.save();                                                  // vertical artist / title
  a.translate(w / 2 + 30, 200); a.rotate(Math.PI / 2);
  a.fillStyle = "#1c1c1c"; a.textAlign = "left";
  a.font = "600 56px system-ui, sans-serif";
  a.fillText("ninajirachi", 0, 0);
  a.restore();
  a.save();
  a.translate(w / 2 - 42, 200); a.rotate(Math.PI / 2);
  a.fillStyle = "#6b6b6b"; a.textAlign = "left";
  a.font = "44px system-ui, sans-serif";
  a.fillText("i love my computer", 0, 0);
  a.restore();
  // vertical star column
  const full = Math.round(rating);
  a.fillStyle = accent; a.textAlign = "center";
  a.font = "58px system-ui, sans-serif";
  for (let i = 0; i < 5; i++) {
    a.fillText(i < full ? "\u2605" : "\u2606", w / 2, h - 330 + i * 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// fade mask for the light-mode mirror: transparent near the case, white outward
function makeMirrorFade() {
  const c = document.createElement("canvas"); c.width = 4; c.height = 512;
  const a = c.getContext("2d")!;
  const g = a.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.40, "rgba(255,255,255,0.5)");
  g.addColorStop(0.60, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,1)");
  a.fillStyle = g; a.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// hand-made shadow blob: radial gradient on a small plane — no render passes,
// no depth capture, cannot draw outside its own ellipse (drei ContactShadows
// painted its whole patch grey in this scene; this cannot)
function makeShadowBlob() {
  const size = 256, c = document.createElement("canvas"); c.width = c.height = size;
  const a = c.getContext("2d")!;
  const g = a.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.6)");
  g.addColorStop(0.55, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  a.fillStyle = g; a.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// clear hub: concentric moulding rings on a light base — presence without opacity
function makeHubMap() {
  const size = 512, cx = size / 2;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const a = c.getContext("2d")!;
  a.fillStyle = "#eef1f4"; a.fillRect(0, 0, size, size);
  a.strokeStyle = "#c3c9cf";
  for (let rr = 0.04; rr < 0.5; rr += 0.028) {
    a.globalAlpha = 0.55; a.lineWidth = 2;
    a.beginPath(); a.arc(cx, cx, size * rr, 0, 7); a.stroke();
    a.globalAlpha = 0.25; a.lineWidth = 5;
    a.beginPath(); a.arc(cx, cx, size * (rr + 0.011), 0, 7); a.stroke();
  }
  a.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// underside (data side): fully reflective — NO rim/ring structure, just mirror + track scratches
function makeUndersideMap() {
  const size = 1024, cx = size / 2;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const a = c.getContext("2d")!;
  a.fillStyle = "#d8dee5"; a.fillRect(0, 0, size, size);
  a.globalAlpha = 0.10;
  for (let i = 0; i < 1600; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r0 = size * (0.07 + Math.random() * 0.40), len = size * (0.015 + Math.random() * 0.05);
    a.strokeStyle = Math.random() < 0.5 ? "#ffffff" : "#8f959c"; a.lineWidth = 1;
    a.beginPath();
    a.moveTo(cx + Math.cos(ang) * r0, cx + Math.sin(ang) * r0);
    a.lineTo(cx + Math.cos(ang) * (r0 + len), cx + Math.sin(ang) * (r0 + len));
    a.stroke();
  }
  a.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// ------------------------------------------------------------------------------

type Tuning = {
  discRough: number; discEnv: number; spectral: number; anisotropy: number; iridescence: number; hubOpacity: number;
  artEnv: number; artClearcoat: number;
  glassEnv: number; glassSmudge: number; glassRough: number; glassClearcoat: number; baseOpacity: number; baseRealGlass: boolean; glassTint: string;
  exposure: number;
};

type Props = {
  albumArt?: string;
  coverMode?: "disc" | "pane";
  playerOpen?: boolean;
  reviewBeat?: number; // increment to trigger the click-into-review animation
  theme?: "dark" | "light";
  background?: string; // surface colour the scene blends into (match the host card)
  walls?: boolean;     // museum niche walls (off = object-on-page)
  debug?: boolean; // dev-only orbit controls
};

function Case({ albumArt, coverMode, playerOpen, reviewBeat, tuning, extrasMode, rating }: Required<Props> & { tuning: Tuning; extrasMode: string; rating: number }) {
  const { scene } = useGLTF("/cd_case.glb?v=3");
  const cover = useTexture(albumArt);

  const discRef = useRef<THREE.Object3D | null>(null);   // the "scaled_cd" GROUP (multi-material disc)
  const discMeshes = useRef<THREE.Mesh[]>([]);           // its primitive sub-meshes
  const hingeRef = useRef<THREE.Group | null>(null);
  const spinAxis = useRef(new THREE.Vector3(0, 1, 0));
  const flipAxis = useRef(new THREE.Vector3(1, 0, 0)); // in-plane axis for the B-side flip
  const baseQuat = useRef(new THREE.Quaternion());
  const discHome = useRef(new THREE.Vector3());
  const peekDir = useRef(new THREE.Vector3(-1, 0, 0)); // slides out flat, from behind the art like a sleeve
  const spinVel = useRef(0);
  const peekT = useRef(0);
  const peekUntil = useRef(0);
  const lastBeat = useRef(reviewBeat);
  const glassMats = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const baseMats = useRef<{ mesh: THREE.Mesh; real: THREE.MeshPhysicalMaterial; fake: THREE.MeshPhysicalMaterial } | null>(null);
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;

  const { paneMesh } = useMemo(() => {
    cover.colorSpace = THREE.SRGBColorSpace;
    cover.anisotropy = 16; // kills the "crunchy" shimmer on oblique/refracted views
    scene.updateMatrixWorld(true);

    // Object semantics (user-confirmed):
    //   "cd lid"  = the clear cover with the RIDGED side rails -> swings open on the spine
    //   "cd base" = the tray with the centre ROSETTE + spine   -> stays put; disc seated in it
    let lidMesh: THREE.Mesh | null = null;
    let baseMesh: THREE.Mesh | null = null;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name.toLowerCase();
      if (name.startsWith("cdviz")) return; // our own helper objects
      if (name.includes("lid")) lidMesh = mesh;
      else if (name.includes("base")) baseMesh = mesh;
    });
    // the disc exports as a GROUP of primitives (one per Blender material slot) —
    // grab the group for motion, and its meshes for material assignment
    const discNode = scene.getObjectByName("scaled_cd")
      ?? scene.children.find((o) => !o.name.startsWith("cdviz") && o !== lidMesh && o !== baseMesh && o.name.toLowerCase().includes("cd"))
      ?? null;
    if (discNode) {
      discRef.current = discNode;
      discMeshes.current = [];
      discNode.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        // tag by original Blender slot name (CD / Transparent Plastic / PRINT) once
        if (!mesh.userData.slot) {
          const mn = ((mesh.material as THREE.Material)?.name || "").toLowerCase();
          mesh.userData.slot = mn.includes("print") ? "print"
            : (mn.includes("plastic") || mn.includes("transparent")) ? "hub" : "cd";
        }
        discMeshes.current.push(mesh);
      });
    }

    const smudge = (() => {
      const size = 512, c = document.createElement("canvas"); c.width = c.height = size;
      const g = c.getContext("2d")!;
      g.fillStyle = "rgb(0,22,0)"; g.fillRect(0, 0, size, size);     // base: near-polished
      g.filter = "blur(26px)";                                        // SOFT smudges, not grain
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(0,${46 + Math.random() * 34},0,0.5)`;
        g.beginPath();
        g.ellipse(Math.random() * size, Math.random() * size,
                  30 + Math.random() * 90, 15 + Math.random() * 50,
                  Math.random() * 3, 0, 7);
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    })();
    glassMats.current = [];
    // LID: true transmission — it's the layer you look THROUGH.
    if (lidMesh) {
      const m = new THREE.MeshPhysicalMaterial({
        transmission: 1, thickness: 0.0015, roughness: 0.0,
        ior: 1.5, transparent: true,
        clearcoat: 1, clearcoatRoughness: 1, clearcoatRoughnessMap: smudge,
        envMapIntensity: 2.2, specularIntensity: 1.2,
      });
      (lidMesh as THREE.Mesh).material = m;
      glassMats.current.push(m);
    }
    // BASE: two selectable materials —
    //  real transmission glass (looks best; rosette vanishes through the closed lid,
    //  a three.js limitation: transmission can't see transmission behind it)
    //  vs opacity-glass (rosette visible closed; slightly cheaper).
    if (baseMesh) {
      const real = new THREE.MeshPhysicalMaterial({
        transmission: 1, thickness: 0.004, roughness: 0.04,
        ior: 1.5, transparent: true,
        clearcoat: 1, clearcoatRoughness: 0.12,
        envMapIntensity: 2.2, specularIntensity: 1.2,
      });
      const fake = new THREE.MeshPhysicalMaterial({
        color: 0x0d0d10, transparent: true, opacity: 0.28, roughness: 0.05,
        clearcoat: 1, clearcoatRoughness: 0.12,
        envMapIntensity: 2.4, specularIntensity: 1.4,
        depthWrite: false,
      });
      baseMats.current = { mesh: baseMesh as THREE.Mesh, real, fake };
      (baseMesh as THREE.Mesh).material = real;
      glassMats.current.push(real, fake);
    }

    const disc = discRef.current;
    if (disc && discMeshes.current.length) {
      // combined local bbox across all primitives
      const bb = new THREE.Box3();
      for (const m of discMeshes.current) {
        m.geometry.computeBoundingBox();
        bb.union(m.geometry.boundingBox!);
      }
      const size = new THREE.Vector3(); bb.getSize(size);
      const dims: Array<[number, THREE.Vector3]> = [
        [size.x, new THREE.Vector3(1, 0, 0)],
        [size.y, new THREE.Vector3(0, 1, 0)],
        [size.z, new THREE.Vector3(0, 0, 1)],
      ];
      dims.sort((a, b) => a[0] - b[0]);
      spinAxis.current = dims[0][1];
      flipAxis.current = dims[1][1];

      // rebuild UVs (shared centre/scale) on EVERY primitive: centred, square-inscribed
      const centre = new THREE.Vector3(); bb.getCenter(centre);
      const axisIdx = [0, 1, 2].sort((i, j) =>
        size.getComponent(i) - size.getComponent(j)); // [thin, planeA, planeB]
      const ia = axisIdx[1], ib = axisIdx[2];
      const R = Math.max(size.getComponent(ia), size.getComponent(ib)) / 2;
      const v3 = new THREE.Vector3();
      for (const m of discMeshes.current) {
        const posAttr = m.geometry.attributes.position;
        const uvArr = new Float32Array(posAttr.count * 2);
        for (let i = 0; i < posAttr.count; i++) {
          v3.fromBufferAttribute(posAttr, i);
          uvArr[i * 2] = (v3.getComponent(ia) - centre.getComponent(ia)) / (2 * R) + 0.5;
          uvArr[i * 2 + 1] = 1 - ((v3.getComponent(ib) - centre.getComponent(ib)) / (2 * R) + 0.5);
        }
        m.geometry.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
      }
    }

    let paneMesh: THREE.Mesh | null = null;
    if (lidMesh && baseMesh && disc) {
      const lm = lidMesh as THREE.Mesh;
      let hinge = scene.getObjectByName("cdviz_hinge") as THREE.Group | null;
      if (!hinge) {
        const lidBox = new THREE.Box3().setFromObject(lm);
        hinge = new THREE.Group();
        hinge.name = "cdviz_hinge";
        // hinge under the SCENE ROOT with the pivot in root space — no parent-offset error.
        // spine side is +x (pre-yaw); vertical hinge axis at the lid's spine edge.
        hinge.position.set(lidBox.max.x, (lidBox.min.y + lidBox.max.y) / 2, (lidBox.min.z + lidBox.max.z) / 2);
        scene.add(hinge);
        hinge.attach(lm); // only the ridged lid swings; base + disc stay seated

        // front pane (Option B art) — lid front MINUS the spine zone (spine belongs to the base)
        const spineW = lidBox.max.z - lidBox.min.z; // spine width ~= case depth
        const w = (lidBox.max.x - lidBox.min.x - spineW) * 0.97;
        const h = (lidBox.max.y - lidBox.min.y) * 0.97;
        const pane = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.7 })
        );
        pane.name = "cdviz_pane";
        // pinned to the lid's front face — it IS the lid's printed front
        pane.position.set((lidBox.min.x + lidBox.max.x) / 2 - spineW / 2, (lidBox.min.y + lidBox.max.y) / 2, lidBox.min.z + 0.0004);
        hinge.attach(pane); // art rides with the lid

        // price sticker: top-right of the lid front, slightly rotated — the artifact detail
        const sticker = new THREE.Mesh(
          new THREE.CircleGeometry(0.017, 48),
          new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.6, side: THREE.DoubleSide })
        );
        sticker.name = "cdviz_sticker";
        sticker.position.set(lidBox.min.x + 0.026, lidBox.max.y - 0.026, lidBox.min.z - 0.0004);
        sticker.rotation.set(0, Math.PI, 0.13); // faces the camera post-yaw, cocked ~7°
        hinge.attach(sticker);

        // paper obi band over the spine side of the lid front
        const obiW = 0.034;
        const obi = new THREE.Mesh(
          new THREE.PlaneGeometry(obiW, (lidBox.max.y - lidBox.min.y) * 0.995),
          new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide })
        );
        obi.name = "cdviz_obi";
        obi.position.set(lidBox.max.x - obiW / 2 - 0.004, (lidBox.min.y + lidBox.max.y) / 2, lidBox.min.z - 0.0005);
        obi.rotation.set(0, Math.PI, 0);
        hinge.attach(obi);
      }
      hingeRef.current = hinge;
      paneMesh = scene.getObjectByName("cdviz_pane") as THREE.Mesh | null;
      if (paneMesh) {
        const m = paneMesh.material as THREE.MeshStandardMaterial;
        m.map = cover; m.needsUpdate = true;
      }
      discHome.current.copy(disc.position);
      baseQuat.current.copy(disc.quaternion);
    }
    return { paneMesh };
  }, [scene, cover]);

  // ---- material routing per cover mode
  useEffect(() => {
    const disc = discRef.current;
    if (disc && discMeshes.current.length) {
      // materials per ORIGINAL slot: hub stays clear plastic always;
      // A: art on the raised PRINT face, CD body = reflective rim; B: all-mirror underside
      const artMat = (() => {
        const m = new THREE.MeshPhysicalMaterial({ map: cover, metalness: 0.25, roughness: 0.4, envMapIntensity: 0.8, clearcoat: 0.35, clearcoatRoughness: 0.3 });
        m.userData.kind = "art";
        return m;
      })();
      const hubMat = (() => {
        // OPAQUE frosted plastic: transparent objects are excluded from the lid's
        // transmission buffer (engine limit) — an opaque scattering hub is both visible
        // through the closed case AND how a real moulded hub actually reads
        const m = new THREE.MeshPhysicalMaterial({
          map: makeHubMap(), roughness: 0.22,
          clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.6,
          specularIntensity: 1.2,
        });
        m.userData.kind = "hub";
        return m;
      })();
      const silverMat = (() => {
        const m = new THREE.MeshPhysicalMaterial({
          map: makeUndersideMap(), metalness: 1, roughness: 0.2, envMapIntensity: 1.9,
          iridescence: 0.25, iridescenceIOR: 1.7,
        });
        (m as unknown as { anisotropy: number }).anisotropy = 0.9;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uSpectral = { value: 0.5 };
          shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform float uSpectral;")
            .replace(
              "#include <emissivemap_fragment>",
              `#include <emissivemap_fragment>
              {
                vec3 nrm = normalize( normal );
                vec3 vdir = normalize( vViewPosition );
                float ndv = clamp( dot( nrm, vdir ), 0.0, 1.0 );
                float sinT = sqrt( 1.0 - ndv * ndv );
                vec2 duv = vMapUv - 0.5;
                float r = length( duv );
                float band = smoothstep( 0.055, 0.10, r ) * ( 1.0 - smoothstep( 0.465, 0.50, r ) );
                float ang = atan( duv.y, duv.x );
                float t = 7.0 * sinT + ang * 0.6366;
                vec3 rainbow = 0.5 + 0.5 * cos( 6.2831 * ( t + vec3( 0.0, 0.33, 0.67 ) ) );
                float w = pow( sinT, 1.4 ) * 0.85 + 0.06;
                totalEmissiveRadiance += rainbow * band * w * uSpectral;
              }`
            );
          m.userData.shader = shader;
        };
        m.userData.kind = "silver";
        return m;
      })();
      for (const m of discMeshes.current) {
        const slot = m.userData.slot as string;
        if (slot === "hub") m.material = hubMat;
        else if (coverMode === "disc" && slot === "print") m.material = artMat;
        else m.material = silverMat; // CD body: the reflective rim in A, full mirror in B
      }
    }
    if (paneMesh) paneMesh.visible = coverMode === "pane";
    // extras: price sticker (A only) or paper obi (both modes)
    const sticker = scene.getObjectByName("cdviz_sticker") as THREE.Mesh | null;
    if (sticker) {
      sticker.visible = coverMode === "disc" && extrasMode === "sticker";
      const sm = sticker.material as THREE.MeshStandardMaterial;
      sm.map = makeStickerMap(rating); sm.needsUpdate = true;
    }
    const obi = scene.getObjectByName("cdviz_obi") as THREE.Mesh | null;
    if (obi) {
      obi.visible = extrasMode === "obi";
      const om = obi.material as THREE.MeshStandardMaterial;
      om.map = makeObiMap(rating, deriveAccent(cover.image as CanvasImageSource)); om.needsUpdate = true;
    }
    // B = the disc physically flipped: flat data side out (the label-side ridges are
    // real geometry — no texture can hide them, so we turn the disc over, as per spec)
    if (disc) {
      disc.quaternion.copy(baseQuat.current);
      if (coverMode === "pane") disc.rotateOnAxis(flipAxis.current, Math.PI);
    }
  }, [coverMode, cover, paneMesh, extrasMode, rating, scene]);

  // ---- review-click beat: spin impulse (A) or peek (B)
  useEffect(() => {
    if (reviewBeat === lastBeat.current) return;
    lastBeat.current = reviewBeat;
    if (coverMode === "disc") spinVel.current = 6; // one-shot spin, decays
    else peekUntil.current = performance.now() + 1200; // slide out, hold, return
  }, [reviewBeat, coverMode]);

  useFrame((state, dt) => {
    // @ts-expect-error debug probe
    window.__scene = scene;
    const t = tuningRef.current;
    state.gl.toneMappingExposure = t.exposure;
    const disc = discRef.current;
    if (disc) {
      // live-apply the tuning panel to whichever disc material is active
      for (const dm of discMeshes.current) {
        const m = dm.material as THREE.MeshPhysicalMaterial;
        if (m.userData.kind === "silver") {
          m.roughness = t.discRough; m.envMapIntensity = t.discEnv; m.iridescence = t.iridescence;
          (m as unknown as { anisotropy: number }).anisotropy = t.anisotropy;
          const sh = m.userData.shader as { uniforms: { uSpectral: { value: number } } } | undefined;
          if (sh) sh.uniforms.uSpectral.value = t.spectral;
        } else if (m.userData.kind === "art") {
          m.envMapIntensity = t.artEnv; m.clearcoat = t.artClearcoat;
        } else if (m.userData.kind === "hub") {
          m.color.setScalar(t.hubOpacity); // brightness of the frosted hub
        }
      }
      // continuous spin in the player; decaying beat-spin otherwise
      const base = playerOpen ? 1.2 : 0;
      disc.rotateOnAxis(spinAxis.current, (base + spinVel.current) * dt);
      spinVel.current = THREE.MathUtils.damp(spinVel.current, 0, 3, dt);
      // peek slide (Option B)
      const targetPeek = performance.now() < peekUntil.current ? 1 : 0;
      peekT.current = THREE.MathUtils.damp(peekT.current, targetPeek, 6, dt);
      disc.position.copy(discHome.current).addScaledVector(peekDir.current, peekT.current * 0.055);
    }
    if (baseMats.current) {
      const want = t.baseRealGlass ? baseMats.current.real : baseMats.current.fake;
      if (baseMats.current.mesh.material !== want) baseMats.current.mesh.material = want;
    }
    for (const g of glassMats.current) {
      g.envMapIntensity = t.glassEnv;
      g.color.set(t.glassTint); // faint grey on light surfaces: form without opacity
      if (g.transmission > 0) { g.clearcoatRoughness = t.glassSmudge; g.roughness = t.glassRough; g.clearcoat = t.glassClearcoat; }
      else g.opacity = t.baseOpacity; // the opacity-glass base
    }
    // idle sway: slow museum-turntable drift around the yaw
    scene.rotation.y = Math.PI + Math.sin(state.clock.elapsedTime * 0.3) * 0.065;
    scene.rotation.x = Math.sin(state.clock.elapsedTime * 0.21) * 0.012;
    // lid swing for the player (book-style around the spine hinge)
    if (hingeRef.current) {
      const target = playerOpen ? -0.9 : 0; // ~50° — opens toward the viewer
      hingeRef.current.rotation.y = THREE.MathUtils.damp(hingeRef.current.rotation.y, target, 5, dt);
    }
  });

  // 180° yaw + gentle idle sway (the case slowly breathes — no user drag needed)
  return <Center><primitive object={scene} rotation={[0, Math.PI, 0]} /></Center>;
}

export default function CDCaseViewer({
  albumArt = "/cover-ilmc.jpg",
  coverMode = "disc",
  playerOpen = false,
  reviewBeat = 0,
  theme = "dark",
  background,
  walls = false,
  debug = false,
}: Props) {
  // the scene blends into its host surface; explicit background wins over theme
  const bg = background ?? (theme === "light" ? "#fbfcfe" : "#15151a");
  const vitrine = bg;
  // photography-seamless treatment for light surfaces: the shadow anchors the glass
  const lum = parseInt(bg.slice(1, 3), 16) / 255;
  const isLight = lum > 0.5;
  const shade = (hex: string, f: number) => {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };
  const floorCol = isLight ? shade(bg, 0.93) : "#050505"; // subtle sweep, not a box
  const disc = useControls("disc (silver)", {
    discRough: { value: 0.24, min: 0, max: 0.6, step: 0.01 },
    discEnv: { value: 2.0, min: 0, max: 6, step: 0.1 },
    spectral: { value: 0.56, min: 0, max: 1, step: 0.01 },
    anisotropy: { value: 1.0, min: 0, max: 1, step: 0.05 },
    iridescence: { value: 0.4, min: 0, max: 1, step: 0.05 },
    hubOpacity: { value: 0.85, min: 0.3, max: 1.3, step: 0.05 }, // hub brightness
  });
  const art = useControls("disc (art)", {
    artEnv: { value: 0.8, min: 0, max: 3, step: 0.05 },
    artClearcoat: { value: 0.35, min: 0, max: 1, step: 0.05 },
  });
  const glass = useControls("case glass", {
    glassEnv: { value: 2.2, min: 0, max: 5, step: 0.1 },
    glassSmudge: { value: 1.0, min: 0, max: 2, step: 0.05 },
    glassRough: { value: 0.0, min: 0, max: 0.3, step: 0.005 },
    glassClearcoat: { value: 0.45, min: 0, max: 1, step: 0.05 },
    baseOpacity: { value: 0.28, min: 0.05, max: 0.8, step: 0.01 },
    baseRealGlass: true,
  });
  const light = useControls("lighting", {
    keyIntensity: { value: 1.4, min: 0, max: 4, step: 0.1 },
    frontIntensity: { value: 1.2, min: 0, max: 4, step: 0.1 },
    frontX: { value: 3.5, min: -4, max: 4, step: 0.1 }, // well off-axis: angled key look at rest
    frontY: { value: 1.3, min: -1, max: 3, step: 0.1 },
    ambient: { value: 0.35, min: 0, max: 1, step: 0.05 },
    exposure: { value: 0.9, min: 0.4, max: 1.6, step: 0.05 },
  });
  const stickerCtl = useControls("extras", {
    extrasMode: { options: ["obi", "sticker", "none"], value: "obi" },
    rating: { value: 4.5, min: 0, max: 5, step: 0.5 },
  });
  // Light-mode env rig. The env map drives REFLECTIONS only — the white page comes
  // from `bg`/`floorCol`, which are separate. Clear glass reads its edges from DARK
  // reflections, so the env must stay mostly black even on a white page. The two big
  // fills (ceiling + camera-side) are what previously covered the whole sphere and
  // left the case with no edges; they're on sliders now so their coverage is tunable.
  const rig = useControls("light rig (env)", {
    ceilingIntensity: { value: 0.35, min: 0, max: 2, step: 0.05 },
    ceilingScale: { value: 4, min: 1, max: 12, step: 0.5 }, // was 12 — a full white sky
    backfillIntensity: { value: 0.18, min: 0, max: 1.5, step: 0.02 }, // was 0.75 — the milk
    backfillScale: { value: 4, min: 1, max: 10, step: 0.5 }, // was 10x7
    topIntensity: { value: 4, min: 0, max: 8, step: 0.1 }, // keep: defines the case TOP
    backIntensity: { value: 2.4, min: 0, max: 6, step: 0.1 }, // keep: rims the silhouette
    sideIntensity: { value: 2, min: 0, max: 6, step: 0.1 },
  });
  const floor = useControls("floor (iPod ad)", {
    mirror: { value: 0.5, min: 0, max: 1, step: 0.05 },
    floorBlur: { value: 420, min: 0, max: 800, step: 10 },
    mixStrength: { value: 65, min: 0, max: 120, step: 1 },
    floorColor: "#0b0b0e",
    fogShade: { value: 0.62, min: 0.3, max: 1.2, step: 0.02 }, // join darkness at the sweep base
  });
  const joinTone = isLight ? shade(bg, 0.9) : shade(bg, floor.fogShade);
  const backdropTex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 4; c.height = 512;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 512, 0, 0); // bottom -> top
    g.addColorStop(0, joinTone);      // meets the floor
    g.addColorStop(0.42, bg);         // melts into the surface colour
    g.addColorStop(1, bg);
    x.fillStyle = g; x.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [bg, joinTone]);
  const shadowBlob = useMemo(() => makeShadowBlob(), []);
  const mirrorFade = useMemo(() => makeMirrorFade(), []);
  const lightMirror = useMemo(() => {
    const m = new Reflector(new THREE.PlaneGeometry(6, 6), {
      clipBias: 0.003, textureWidth: 256, textureHeight: 256, color: 0xffffff,
    });
    m.rotation.x = -Math.PI / 2;
    m.position.y = -0.062;
    return m;
  }, []);
  const tuning: Tuning = { ...disc, ...art, ...glass, exposure: light.exposure, glassTint: "#ffffff" };
  return (
    <Canvas
      camera={{ position: [0.015, 0.012, 0.36], fov: 35 }}
      dpr={[1, 2]}
      gl={{ alpha: false }}
      onCreated={({ gl }) => {
        // full-res transmission buffer: crisp view through the lid, no rim shimmer
        if ("transmissionResolutionScale" in gl) (gl as unknown as { transmissionResolutionScale: number }).transmissionResolutionScale = 1.0;
      }}
    >
      {/* declarative background: re-themes live (a one-time clearColor went stale on toggle) */}
      <color attach="background" args={[bg]} />
      <ambientLight intensity={light.ambient} />
      <directionalLight position={[2.6, 2.6, 3.2]} intensity={light.keyIntensity} />
      <directionalLight position={[-3, 1, -2]} intensity={0.7} />
      <directionalLight position={[light.frontX, light.frontY, 3]} intensity={light.frontIntensity} />
      {/* small side accent: a glint that travels across the disc as it spins */}
      <pointLight position={[-0.45, 0.12, 0.3]} intensity={0.6} distance={1.5} decay={2} />
      <Suspense fallback={null}>
        {isLight ? (
          <Environment resolution={256}>
            {/* white softboxes for the premium streaks... */}
            {/* dim camera-side backfill: floors the disc's mirror at silver without
                sheeting the glass (the old bright version was the milk) */}
            <Lightformer intensity={rig.backfillIntensity} position={[0, 1, 4.5]} scale={[rig.backfillScale, rig.backfillScale * 0.7, 1]} />
            {/* museum toplight: reflects on the case TOP, not the front pane — art stays clear */}
            <Lightformer intensity={rig.topIntensity} position={[0, 4, 0.6]} rotation-x={Math.PI / 2.4} scale={[5, 2.6, 1]} />
            <Lightformer intensity={rig.ceilingIntensity} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[rig.ceilingScale, rig.ceilingScale, 1]} />
            {/* backlight: rims the silhouette through the glass edges */}
            <Lightformer intensity={rig.backIntensity} position={[0, 1.2, -4]} scale={[5, 4, 1]} />
            {/* side boxes dimmed: glints, not veils */}
            <Lightformer intensity={rig.sideIntensity} position={[-3.5, 1.2, 0.5]} rotation-y={Math.PI / 2.6} scale={[2.4, 2, 1]} />
            <Lightformer intensity={rig.sideIntensity * 0.7} position={[3.5, 0.8, 1]} rotation-y={-Math.PI / 2.6} scale={[1.8, 1.6, 1]} />
            {/* ...everything else stays BLACK: the dark-card reflections that
                define clear glass against a white page */}
          </Environment>
        ) : (
          <Environment preset="studio" />
        )}
        <Case albumArt={albumArt} coverMode={coverMode} playerOpen={playerOpen} reviewBeat={reviewBeat} tuning={tuning} extrasMode={stickerCtl.extrasMode} rating={stickerCtl.rating} />
        {/* studio sweep backdrop: gradient from join-tone up to the surface colour.
            Hides the floor's far edge by occlusion — no fog, so the case stays crisp. */}
        {!isLight && (
          <mesh position={[0, 1.51, -0.62]}>
            <planeGeometry args={[8, 3.2]} />
            <meshBasicMaterial map={backdropTex} toneMapped={false} />
          </mesh>
        )}
        {/* dark: glossy mirrored countertop; light: matte seamless, shadow does the grounding */}
        {isLight && (
          <group>
            {/* true mirror: reflects the scene incl. the white void (no black buffer) */}
            <primitive object={lightMirror} />
            {/* white fade: reflection lives near the case, melts to void outward */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0617, 0]}>
              <planeGeometry args={[6, 6]} />
              <meshBasicMaterial map={mirrorFade} transparent toneMapped={false} depthWrite={false} />
            </mesh>
          </group>
        )}
        {!isLight && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.066, 0]}>
          <planeGeometry args={[6, 6]} />
          <MeshReflectorMaterial
            blur={[floor.floorBlur, floor.floorBlur / 3]}
            resolution={2048}
            mixBlur={1}
            mixStrength={floor.mixStrength}
            mirror={floor.mirror}
            roughness={1}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color={bg}
            metalness={0}
          />
        </mesh>}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, isLight ? -0.0615 : -0.0652, 0.01]} scale={[0.34, 0.16, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={shadowBlob} transparent opacity={isLight ? 0.4 : 0.55} depthWrite={false} toneMapped={false} />
        </mesh>
        {walls && <group>
        {/* museum niche walls (vitrine mode) */}
        <mesh position={[0, 0.23, -0.28]}>
          <planeGeometry args={[3, 0.6]} />
          <meshStandardMaterial color={vitrine ?? floor.floorColor} roughness={0.95} metalness={0} envMapIntensity={0.12} />
        </mesh>
        <mesh position={[-0.55, 0.23, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[3, 0.6]} />
          <meshStandardMaterial color={vitrine ?? floor.floorColor} roughness={0.95} metalness={0} envMapIntensity={0.12} />
        </mesh>
        <mesh position={[0.55, 0.23, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[3, 0.6]} />
          <meshStandardMaterial color={vitrine ?? floor.floorColor} roughness={0.95} metalness={0} envMapIntensity={0.12} />
        </mesh>
        </group>}
      </Suspense>
      {debug && <OrbitControls makeDefault enablePan={false} />}
    </Canvas>
  );
}
useGLTF.preload("/cd_case.glb?v=3");

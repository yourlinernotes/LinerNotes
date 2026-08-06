"use client";
// LinerNotes jewel-case viz — the three interaction scenarios:
//  A) coverMode="disc": art on the disc, closed clear case; review-click -> small spin beat
//  B) coverMode="pane": art on the front pane, reflective disc; review-click -> disc peeks out
//  Player) playerOpen: lid swings open on the spine hinge, disc spins continuously
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls, useTexture, Center, ContactShadows } from "@react-three/drei";
import { Suspense, useRef, useMemo, useEffect } from "react";
import * as THREE from "three";

type Props = {
  albumArt?: string;
  coverMode?: "disc" | "pane";
  playerOpen?: boolean;
  reviewBeat?: number; // increment to trigger the click-into-review animation
};

function Case({ albumArt, coverMode, playerOpen, reviewBeat }: Required<Props>) {
  const { scene } = useGLTF("/cd_case.glb?v=3");
  const cover = useTexture(albumArt);

  const discRef = useRef<THREE.Mesh | null>(null);
  const hingeRef = useRef<THREE.Group | null>(null);
  const spinAxis = useRef(new THREE.Vector3(0, 1, 0));
  const discHome = useRef(new THREE.Vector3());
  const peekDir = useRef(new THREE.Vector3(-1, 0, 0)); // slides out flat, from behind the art like a sleeve
  const spinVel = useRef(0);      // extra one-shot spin velocity
  const peekT = useRef(0);        // 0..1 peek amount
  const peekUntil = useRef(0);    // timestamp the peek holds until
  const lastBeat = useRef(reviewBeat);

  const { paneMesh } = useMemo(() => {
    cover.colorSpace = THREE.SRGBColorSpace;
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
      else discRef.current = mesh;
    });

    const glass = () => new THREE.MeshPhysicalMaterial({
      transmission: 1, thickness: 0.004, roughness: 0.08, ior: 1.5, transparent: true,
      clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 2.2,
      specularIntensity: 1.2,
    });
    if (lidMesh) (lidMesh as THREE.Mesh).material = glass();
    if (baseMesh) (baseMesh as THREE.Mesh).material = glass();

    const disc = discRef.current;
    if (disc) {
      disc.geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      disc.geometry.boundingBox!.getSize(size);
      const dims: Array<[number, THREE.Vector3]> = [
        [size.x, new THREE.Vector3(1, 0, 0)],
        [size.y, new THREE.Vector3(0, 1, 0)],
        [size.z, new THREE.Vector3(0, 0, 1)],
      ];
      dims.sort((a, b) => a[0] - b[0]);
      spinAxis.current = dims[0][1];
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
          new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide })
        );
        pane.name = "cdviz_pane";
        // pinned to the lid's front face — it IS the lid's printed front
        pane.position.set((lidBox.min.x + lidBox.max.x) / 2 - spineW / 2, (lidBox.min.y + lidBox.max.y) / 2, lidBox.min.z + 0.0004);
        hinge.attach(pane); // art rides with the lid
      }
      hingeRef.current = hinge;
      paneMesh = scene.getObjectByName("cdviz_pane") as THREE.Mesh | null;
      if (paneMesh) {
        const m = paneMesh.material as THREE.MeshStandardMaterial;
        m.map = cover; m.needsUpdate = true;
      }
      discHome.current.copy(disc.position);
    }
    return { paneMesh };
  }, [scene, cover]);

  // ---- material routing per cover mode
  useEffect(() => {
    const disc = discRef.current;
    if (disc) {
      disc.material = coverMode === "disc"
        ? new THREE.MeshPhysicalMaterial({ map: cover, metalness: 0.35, roughness: 0.35, envMapIntensity: 1.4, clearcoat: 0.6, clearcoatRoughness: 0.25 })
        : new THREE.MeshPhysicalMaterial({
            color: 0xf2f5f8, metalness: 1, roughness: 0.18, envMapIntensity: 3.5,
            iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [140, 700],
          }); // iridescent CD data side — the rainbow sheen
    }
    if (paneMesh) paneMesh.visible = coverMode === "pane";
  }, [coverMode, cover, paneMesh]);

  // ---- review-click beat: spin impulse (A) or peek (B)
  useEffect(() => {
    if (reviewBeat === lastBeat.current) return;
    lastBeat.current = reviewBeat;
    if (coverMode === "disc") spinVel.current = 6; // one-shot spin, decays
    else peekUntil.current = performance.now() + 1200; // slide out, hold, return
  }, [reviewBeat, coverMode]);

  useFrame((_, dt) => {
    const disc = discRef.current;
    if (disc) {
      // continuous spin in the player; decaying beat-spin otherwise
      const base = playerOpen ? 1.2 : 0;
      disc.rotateOnAxis(spinAxis.current, (base + spinVel.current) * dt);
      spinVel.current = THREE.MathUtils.damp(spinVel.current, 0, 3, dt);
      // peek slide (Option B)
      const targetPeek = performance.now() < peekUntil.current ? 1 : 0;
      peekT.current = THREE.MathUtils.damp(peekT.current, targetPeek, 6, dt);
      disc.position.copy(discHome.current).addScaledVector(peekDir.current, peekT.current * 0.055);
    }
    // lid swing for the player (book-style around the spine hinge)
    if (hingeRef.current) {
      const target = playerOpen ? -0.9 : 0; // ~50° — opens toward the viewer
      hingeRef.current.rotation.y = THREE.MathUtils.damp(hingeRef.current.rotation.y, target, 5, dt);
    }
  });

  // 180° yaw: spine to the left, lid face toward the camera
  return <Center><primitive object={scene} rotation={[0, Math.PI, 0]} /></Center>;
}

export default function CDCaseViewer({
  albumArt = "/placeholder-cover.png?v=2",
  coverMode = "disc",
  playerOpen = false,
  reviewBeat = 0,
}: Props) {
  return (
    <Canvas
      camera={{ position: [0, 0, 0.4], fov: 35 }}
      dpr={[1, 2]}
      gl={{ alpha: false }}
      onCreated={({ gl }) => gl.setClearColor("#15151a")}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 3, 4]} intensity={2.5} />
      <directionalLight position={[-3, 1, -2]} intensity={1.2} />
      <directionalLight position={[0, 0.5, 3]} intensity={1.6} />
      <Suspense fallback={null}>
        <Environment preset="studio" />
        <Case albumArt={albumArt} coverMode={coverMode} playerOpen={playerOpen} reviewBeat={reviewBeat} />
        <ContactShadows position={[0, -0.085, 0]} opacity={0.55} scale={0.5} blur={2.2} far={0.2} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} />
    </Canvas>
  );
}
useGLTF.preload("/cd_case.glb?v=3");

import * as THREE from 'three';

// Placeholder scene: a ground plane and one box, to prove the toolchain works.
export function startScene(parent: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  parent.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb4c4);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(6, 4, 8);
  camera.lookAt(0, 0.5, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x556655, 1.2));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x6b7a5a }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(4, 1, 2),
    new THREE.MeshStandardMaterial({ color: 0xb5532f }),
  );
  box.position.y = 0.5;
  scene.add(box);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(() => {
    box.rotation.y += 0.005;
    renderer.render(scene, camera);
  });
}

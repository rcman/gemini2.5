// js/sceneSetup.js
import * as THREE from './libs/three.min.js';

export function setupScene(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error("Game container not found!");
        return null;
    }

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaaaaaa); // Basic grey background
    scene.fog = new THREE.Fog(0xaaaaaa, 50, 200); // Add fog for distance effect

    // Camera (Perspective)
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10); // Initial camera position (will be updated by player)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft white light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50); // Position the light source
    directionalLight.castShadow = true;
    // Configure shadow properties for quality/performance
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -250;
    directionalLight.shadow.camera.right = 250;
    directionalLight.shadow.camera.top = 250;
    directionalLight.shadow.camera.bottom = -250;

    scene.add(directionalLight);
    // Optional: Add a light helper to visualize direction
    // const dirLightHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
    // scene.add(dirLightHelper);
     // const shadowCamHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
     // scene.add(shadowCamHelper);


    // Handle Window Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }, false);

    return { scene, camera, renderer };
}

// js/world.js
// Handles initial world generation (ground, features like trees, rocks)

import { items } from './items.js';
import * as Config from './config.js';

// --- World Generation Functions ---

// Creates the ground plane
function createGround(scene) {
    const groundGeo = new THREE.PlaneGeometry(Config.worldScale, Config.worldScale, 50, 50);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x556b2f, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    ground.name = "ground"; // Important for raycasting identification
    scene.add(ground);
    return ground; // Return ground mesh if needed elsewhere
}

// Populates the world with features using a factory function
function createFeatures(scene, objectsArray, factory, count) {
    const range = Config.worldScale * 0.48; // Place within ~96% of the ground area
    for (let i = 0; i < count; i++) {
        const obj = factory(); // Use the provided factory (createTree, createRock)
        if (!obj) continue;

        // Set random position and rotation
        obj.position.set(
            (Math.random() - 0.5) * range * 2,
            obj.position.y, // Keep the y position set by the factory (usually based on object height)
            (Math.random() - 0.5) * range * 2
        );
        obj.rotation.y = Math.random() * Math.PI * 2;

        // Enable shadows
        obj.castShadow = true;
        obj.receiveShadow = true; // Objects like rocks might receive shadows too

        scene.add(obj);
        objectsArray.push(obj); // Add to the global list of interactable objects
    }
}

// Factory function for creating tree objects
function createTree() {
    // Group to hold trunk and foliage
    const group = new THREE.Group();

    // Trunk
    const trunkHeight = 4 + Math.random() * 2;
    const trunkRadius = 0.3 + Math.random() * 0.2;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius, trunkHeight, 8),
        items.wood.material // Use pre-defined wood material
    );
    trunk.position.y = trunkHeight / 2; // Center trunk vertically
    trunk.castShadow = true;
    group.add(trunk);

    // Foliage (Leaves)
    const foliageRadius = 1.5 + Math.random();
    const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(foliageRadius, 8, 6), // Lower poly sphere
        items.leaves.material // Use pre-defined leaves material
    );
    foliage.position.y = trunkHeight + foliageRadius * 0.5; // Position above trunk
    foliage.castShadow = true;
    group.add(foliage);

    // Add harvestable resource data to the group's userData
    group.userData = {
        type: "tree",
        resource: "wood",
        secondaryResource: "leaves",
        yieldAmount: 3 + Math.floor(Math.random() * 3),
        secondaryYield: 1 + Math.floor(Math.random() * 2),
        tool: "axe" // Required tool
    };
    group.name = "tree_group_" + Math.random().toString(16).substring(2, 8); // Unique-ish name
    group.position.y = 0; // Base of the tree group sits on the ground

    return group;
}

// Factory function for creating rock objects
function createRock() {
    const size = 0.8 + Math.random() * 1.2;
    const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0), // Simple geometric rock shape
        items.stone.material // Use pre-defined stone material
    );
    // Randomly scale height for variation
    rock.scale.y = 0.6 + Math.random() * 0.4;
    // Adjust position so the bottom sits near y=0
    rock.position.y = (size * rock.scale.y) / 2 * 0.9; // Slightly lower than half height
    rock.castShadow = true;

    // Add harvestable resource data
    rock.userData = {
        type: "rock",
        resource: "stone",
        yieldAmount: 2 + Math.floor(Math.random() * 3),
        tool: "pickaxe" // Required tool
    };
    rock.name = "rock_object_" + Math.random().toString(16).substring(2, 8); // Unique-ish name

    return rock;
}


// --- Main Export Function ---
// Initializes the world environment (lighting, ground, features)
export function createInitialWorld(scene, objectsArray) {
    // Lighting (Ambient + Directional)
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(75, 150, 100); // Position the light source
    directionalLight.castShadow = true;
    // Configure shadow properties
    directionalLight.shadow.mapSize.set(1024, 1024); // Lower res for potentially better performance on older THREE versions
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    const shadowCamSize = Config.worldScale * 0.6;
    directionalLight.shadow.camera.left = -shadowCamSize;
    directionalLight.shadow.camera.right = shadowCamSize;
    directionalLight.shadow.camera.top = shadowCamSize;
    directionalLight.shadow.camera.bottom = -shadowCamSize;
    scene.add(directionalLight);

    // Add the ground plane
    createGround(scene);

    // Add features (trees, rocks)
    createFeatures(scene, objectsArray, createTree, 30); // Add 30 trees
    createFeatures(scene, objectsArray, createRock, 40); // Add 40 rocks

    if (Config.DEBUG) console.log("World generated with ground, lighting, and features.");
}
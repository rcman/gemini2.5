// js/world.js
import * as THREE from './libs/three.min.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.objects = []; // Keep track of interactable objects
        this.createGround();
        this.createSky(); // Add a simple skybox
        this.spawnResources();
        this.spawnContainers(); // Add barrels etc.
        // this.spawnAnimals(); // Placeholder
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50); // Large flat plane
        // Simple green texture or color
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x55aa55, // Greenish
            // map: textureLoader.load('textures/grass.jpg'), // Example texture
            metalness: 0.1,
            roughness: 0.8,
            // wireframe: true // For debugging segments
        });
        // groundMaterial.map.wrapS = THREE.RepeatWrapping;
        // groundMaterial.map.wrapT = THREE.RepeatWrapping;
        // groundMaterial.map.repeat.set(100, 100); // Repeat texture

        const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        groundMesh.rotation.x = -Math.PI / 2; // Rotate flat
        groundMesh.receiveShadow = true;
        groundMesh.name = "Ground";
        this.scene.add(groundMesh);
    }

     createSky() {
        // Simple gradient sky or skybox
        const skyGeometry = new THREE.SphereGeometry(300, 32, 16); // Large sphere
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB, // Sky blue
            side: THREE.BackSide // Render inside of sphere
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        sky.name = "Sky";
        this.scene.add(sky);

        // Or use a CubeTextureLoader for a proper skybox
        /*
        const loader = new THREE.CubeTextureLoader();
        const texture = loader.setPath('textures/skybox/').load([
            'px.jpg', 'nx.jpg',
            'py.jpg', 'ny.jpg',
            'pz.jpg', 'nz.jpg'
        ]);
        this.scene.background = texture;
        */
    }

    spawnResources() {
        const treeGeometry = new THREE.CylinderGeometry(0.5, 0.7, 8, 8);
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown trunk
        const leavesGeometry = new THREE.SphereGeometry(3, 8, 6);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Green leaves

        const rockGeometry = new THREE.DodecahedronGeometry(1, 0); // Polygonal rock shape
        const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.9, metalness: 0.2 });

        const grassGeometry = new THREE.PlaneGeometry(0.5, 1); // Simple quad for grass
        const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x7CFC00, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }); // Use alphaTest for cutout

        // Spawn Trees
        for (let i = 0; i < 50; i++) {
            const treeTrunk = new THREE.Mesh(treeGeometry, treeMaterial);
            const treeLeaves = new THREE.Mesh(leavesGeometry, leavesMaterial);

            const x = (Math.random() - 0.5) * 480;
            const z = (Math.random() - 0.5) * 480;
            treeTrunk.position.set(x, 4, z); // Position base of trunk
            treeLeaves.position.set(x, 8, z); // Position leaves above trunk

            treeTrunk.castShadow = true;
            treeLeaves.castShadow = true;
            treeTrunk.userData = { resourceType: 'wood', name: 'Tree', health: 20 }; // Add data for interaction
            treeLeaves.userData = { resourceType: 'wood', name: 'Tree', health: 20 }; // Link leaves too

            this.scene.add(treeTrunk);
            this.scene.add(treeLeaves);
            this.objects.push(treeTrunk); // Only add trunk as interactable? Or group them?
            this.objects.push(treeLeaves); // Add leaves too
        }

        // Spawn Rocks
        for (let i = 0; i < 30; i++) {
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            const scale = Math.random() * 1.5 + 0.8; // Vary size
            rock.scale.set(scale, scale, scale);
             const x = (Math.random() - 0.5) * 480;
             const z = (Math.random() - 0.5) * 480;
             rock.position.set(x, scale * 0.5, z); // Position base on ground
             rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI); // Random rotation
             rock.castShadow = true;
             rock.userData = { resourceType: 'stone', name: 'Rock', health: 15 };
             this.scene.add(rock);
             this.objects.push(rock);
        }

        // Spawn Tall Grass Patches
        for (let i = 0; i < 100; i++) {
            const grass = new THREE.Mesh(grassGeometry, grassMaterial);
             const x = (Math.random() - 0.5) * 480;
             const z = (Math.random() - 0.5) * 480;
             grass.position.set(x, 0.5, z); // Position base
             grass.rotation.y = Math.random() * Math.PI * 2; // Random facing
             // No shadow casting for performance usually
             grass.userData = { resourceType: 'grass', name: 'Tall Grass', health: 1 }; // Very easy to gather
             this.scene.add(grass);
             this.objects.push(grass);
        }

         // Spawn Loose Scrap Metal
         const scrapGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.8);
         const scrapMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.6 });
         for (let i = 0; i < 20; i++) {
             const scrap = new THREE.Mesh(scrapGeometry, scrapMaterial);
             const x = (Math.random() - 0.5) * 480;
             const z = (Math.random() - 0.5) * 480;
             scrap.position.set(x, 0.05, z); // Lay flat
             scrap.rotation.y = Math.random() * Math.PI;
             scrap.userData = { resourceType: 'scrap_metal', name: 'Scrap Metal', health: 1 };
             this.scene.add(scrap);
             this.objects.push(scrap);
         }
    }

    spawnContainers() {
        const barrelGeometry = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16);
        const barrelMaterial = new THREE.MeshStandardMaterial({ color: 0xA0522D, roughness: 0.7 }); // Sienna color

        for (let i = 0; i < 10; i++) {
            const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
             const x = (Math.random() - 0.5) * 450; // Keep slightly away from edge
             const z = (Math.random() - 0.5) * 450;
             barrel.position.set(x, 0.6, z);
             barrel.castShadow = true;
             barrel.userData = {
                 isContainer: true,
                 name: 'Barrel',
                 lootTable: 'generic_medium' // Define loot tables elsewhere
             };
             this.scene.add(barrel);
             this.objects.push(barrel);
        }

        // TODO: Add empty building structures (groups of meshes) with loot spots
    }

    spawnAnimals() {
        // Placeholder: Use simple shapes for now
        const animalGeometry = new THREE.BoxGeometry(1.5, 0.8, 2.5);
        const animalMaterial = new THREE.MeshStandardMaterial({ color: 0xD2B48C }); // Tan color

        for (let i = 0; i < 5; i++) {
            const animal = new THREE.Mesh(animalGeometry, animalMaterial);
             const x = (Math.random() - 0.5) * 400;
             const z = (Math.random() - 0.5) * 400;
             animal.position.set(x, 0.4, z);
             animal.castShadow = true;
             animal.userData = {
                 isAnimal: true,
                 name: 'Deer', // Example
                 health: 10,
                 isDead: false, // Flag for state
                 resourceType: 'animal' // Type for butchering logic
             };
             this.scene.add(animal);
             this.objects.push(animal);
             // TODO: Add simple AI (random wander, flee) and animation hooks
        }
    }

    // Function to add a placed object (called by player)
    spawnPlacedObject(itemId, position, rotation) {
        console.log(`World spawning: ${itemId}`);
        let geometry, material;
        // Define geometries/materials for placeable items
        switch (itemId) {
            case 'campfire':
                geometry = new THREE.CylinderGeometry(0.8, 0.6, 0.4, 12);
                material = new THREE.MeshStandardMaterial({ color: 0x404040 }); // Dark grey stones
                // Could add logs on top etc.
                break;
            case 'crafting_table':
                 geometry = new THREE.BoxGeometry(1.5, 0.8, 1);
                 material = new THREE.MeshStandardMaterial({ color: 0xDEB887 }); // BurlyWood
                 break;
             case 'forge':
                 geometry = new THREE.BoxGeometry(1.2, 1.0, 1.2);
                 material = new THREE.MeshStandardMaterial({ color: 0x696969 }); // DimGray stone
                 break;
             default:
                 console.warn("Trying to place unknown object:", itemId);
                 return null; // Or return a default placeholder?
        }

        if (geometry && material) {
            const placedMesh = new THREE.Mesh(geometry, material);
            placedMesh.position.copy(position);
            // Adjust position based on object height to sit on ground
            placedMesh.position.y += (geometry.parameters.height || 1) / 2; // Adjust based on geom height
            placedMesh.rotation.copy(rotation); // Use player's rotation or placement rotation
            placedMesh.castShadow = true;
            placedMesh.receiveShadow = true;
            placedMesh.userData = {
                 isPlaced: true,
                 itemId: itemId, // Link back to item type
                 owner: 'player' // Could add ownership
            };
            this.scene.add(placedMesh);
            this.objects.push(placedMesh); // Add to interactable objects if needed (e.g., use Forge)
            return placedMesh;
        }
        return null;
    }


    getInteractableObjects() {
        return this.objects;
    }
}

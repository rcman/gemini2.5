// js/world.js

const World = {
    scene: null,
    collidableObjects: [], // Store meshes player can collide with
    interactableObjects: [], // Store objects player can interact with (trees, rocks, etc.)
    animals: [], // Store animal objects/meshes
    lootContainers: [], // Store container objects

    // Simple materials (replace with textures later)
    materials: {
        ground: new THREE.MeshLambertMaterial({ color: 0x556B2F }), // Dark Olive Green
        treeTrunk: new THREE.MeshLambertMaterial({ color: 0x8B4513 }), // Saddle Brown
        treeLeaves: new THREE.MeshLambertMaterial({ color: 0x228B22 }), // Forest Green
        rock: new THREE.MeshLambertMaterial({ color: 0x808080 }), // Gray
        water: new THREE.MeshLambertMaterial({ color: 0x1E90FF, transparent: true, opacity: 0.7 }), // Dodger Blue
        building: new THREE.MeshLambertMaterial({ color: 0xBC8F8F }), // Rosy Brown
        barrel: new THREE.MeshLambertMaterial({ color: 0xD2691E }), // Chocolate
        crate: new THREE.MeshLambertMaterial({ color: 0xB8860B }), // DarkGoldenrod
        scrap: new THREE.MeshLambertMaterial({ color: 0x696969 }), // DimGray
        grass: new THREE.MeshLambertMaterial({ color: 0x7CFC00 }), // LawnGreen
        animal: new THREE.MeshLambertMaterial({ color: 0xA0522D }), // Sienna (Generic Animal)
    },

    init(scene) {
        this.scene = scene;
        this.collidableObjects = [];
        this.interactableObjects = [];
        this.animals = [];
        this.lootContainers = [];
        Utils.logMessage("World initializing...");
        this.createEnvironment();
        this.scatterObjects();
        this.spawnAnimals();
        Utils.logMessage("World created.");
    },

    createEnvironment() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);
        const ground = new THREE.Mesh(groundGeometry, this.materials.ground);
        ground.rotation.x = -Math.PI / 2; // Rotate flat
        ground.receiveShadow = true;
        ground.userData = { type: 'ground' }; // Identify for raycasting maybe
        this.scene.add(ground);
        // No collision needed for ground usually, handled by player gravity

        // Water (simple plane)
        const waterGeometry = new THREE.PlaneGeometry(50, 50);
        const water = new THREE.Mesh(waterGeometry, this.materials.water);
        water.rotation.x = -Math.PI / 2;
        water.position.set(60, 0.1, 60); // Place it somewhere
        water.userData = { type: 'water' };
        this.scene.add(water);
        // Add collision if needed, or just check player position

        // Basic Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(30, 50, 20);
        directionalLight.castShadow = true;
        // Configure shadow properties if needed
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);
        this.scene.add(directionalLight.target); // Target follows default (0,0,0) or set explicitly
    },

    scatterObjects() {
        const area = 90; // Scatter within +/- 90 units from center

        // Trees
        for (let i = 0; i < 50; i++) {
            const x = Utils.getRandomInt(-area, area);
            const z = Utils.getRandomInt(-area, area);
             // Basic check to avoid spawning in water area (very rough)
             if (x > 40 && x < 90 && z > 40 && z < 90) continue;
            this.createTree(x, 0, z);
        }

        // Rocks
        for (let i = 0; i < 40; i++) {
            const x = Utils.getRandomInt(-area, area);
            const z = Utils.getRandomInt(-area, area);
            if (x > 40 && x < 90 && z > 40 && z < 90) continue;
            this.createRock(x, 0, z);
        }

        // Tall Grass (simple representation)
         for (let i = 0; i < 100; i++) {
            const x = Utils.getRandomInt(-area, area);
            const z = Utils.getRandomInt(-area, area);
             if (x > 40 && x < 90 && z > 40 && z < 90) continue;
            this.createGrassPatch(x, 0, z);
        }

        // Scrap Metal
         for (let i = 0; i < 20; i++) {
            const x = Utils.getRandomInt(-area, area);
            const z = Utils.getRandomInt(-area, area);
             if (x > 40 && x < 90 && z > 40 && z < 90) continue;
            this.createScrap(x, 0, z);
        }


        // Barrels (Loot)
        for (let i = 0; i < 10; i++) {
            const x = Utils.getRandomInt(-area, area);
            const z = Utils.getRandomInt(-area, area);
             if (x > 40 && x < 90 && z > 40 && z < 90) continue;
            this.createLootContainer(x, 0, z, 'barrel');
        }

        // Buildings
        this.createBuilding(-50, 0, -50, 10, 5, 15); // Basic box building
        this.createBuilding(50, 0, 50, 15, 6, 10);
    },

    createTree(x, y, z) {
        const trunkHeight = Utils.getRandomInt(4, 7);
        const trunkRadius = 0.3;
        const trunkGeo = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 8);
        const trunk = new THREE.Mesh(trunkGeo, this.materials.treeTrunk);
        trunk.position.set(x, y + trunkHeight / 2, z);
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        const leavesHeight = trunkHeight * 1.5;
        const leavesRadius = trunkRadius * 5;
        const leavesGeo = new THREE.ConeGeometry(leavesRadius, leavesHeight, 8); // Cone for simple tree top
        const leaves = new THREE.Mesh(leavesGeo, this.materials.treeLeaves);
        leaves.position.set(x, y + trunkHeight + leavesHeight / 3, z); // Position above trunk
        leaves.castShadow = true;
        // leaves.receiveShadow = true; // Less important for leaves

        // Group tree parts for easier interaction/removal later if needed
        const treeGroup = new THREE.Group();
        treeGroup.add(trunk);
        treeGroup.add(leaves);
        this.scene.add(treeGroup);

        // Use trunk for collision/interaction checks
        trunk.userData = { type: 'tree', health: 100, resource: 'wood', amount: Utils.getRandomInt(3, 6), group: treeGroup };
        this.collidableObjects.push(trunk);
        this.interactableObjects.push(trunk);
    },

    createRock(x, y, z) {
        const size = Utils.getRandomInt(1, 3) * 0.5;
        // Use Icosahedron for a more rock-like shape than a sphere
        const rockGeo = new THREE.IcosahedronGeometry(size, 0); // Low detail
        const rock = new THREE.Mesh(rockGeo, this.materials.rock);
        rock.position.set(x, y + size / 2, z); // Place on ground
        rock.castShadow = true;
        rock.receiveShadow = true;
        rock.rotation.set(Math.random(), Math.random(), Math.random()); // Random rotation

        rock.userData = { type: 'rock', health: 80, resource: 'stone', amount: Utils.getRandomInt(2, 5) };
        this.scene.add(rock);
        this.collidableObjects.push(rock);
        this.interactableObjects.push(rock);
    },

     createGrassPatch(x, y, z) {
        // Very simple representation: a small, thin green cylinder or box
        const grassHeight = 0.5;
        const grassGeo = new THREE.BoxGeometry(0.1, grassHeight, 0.1);
        const grass = new THREE.Mesh(grassGeo, this.materials.grass);
        grass.position.set(x, y + grassHeight / 2, z);
        // No shadow casting for performance
        grass.userData = { type: 'grass', resource: 'grass', amount: 1}; // Harvestable resource
        this.scene.add(grass);
        // No collision for grass typically
        this.interactableObjects.push(grass); // Make it interactable
    },

     createScrap(x, y, z) {
        // Simple representation: a small, flat grey box
        const scrapSize = 0.3;
        const scrapGeo = new THREE.BoxGeometry(scrapSize, 0.1, scrapSize * 1.5);
        const scrap = new THREE.Mesh(scrapGeo, this.materials.scrap);
        scrap.position.set(x, y + 0.05, z);
        scrap.rotation.y = Math.random() * Math.PI * 2;
        scrap.castShadow = true;
        scrap.userData = { type: 'scrap', resource: 'scrap_metal', amount: Utils.getRandomInt(1, 3)};
        this.scene.add(scrap);
        this.interactableObjects.push(scrap);
        // No collision usually needed for small items
    },


    createBuilding(x, y, z, width, height, depth) {
        const wallThickness = 0.5;

        // Main Box (outer shell for simplicity)
        const buildingGeo = new THREE.BoxGeometry(width, height, depth);
        const buildingMesh = new THREE.Mesh(buildingGeo, this.materials.building);
        buildingMesh.position.set(x, y + height / 2, z);
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        buildingMesh.userData = { type: 'building_wall' }; // Identify as part of building

        // !! Basic Collision: We add the whole box. More complex shapes need CSG or multiple boxes.
        this.scene.add(buildingMesh);
        this.collidableObjects.push(buildingMesh);

        // Add a "doorway" visually (just an opening conceptually for now)
        // Real doorways need geometry subtraction (CSG) or careful placement of wall segments.

        // Place loot containers inside
        const numCrates = Utils.getRandomInt(1, 3);
        for (let i = 0; i < numCrates; i++) {
            const crateX = x + Utils.getRandomInt(-width / 2 + 1, width / 2 - 1); // Place inside walls
            const crateZ = z + Utils.getRandomInt(-depth / 2 + 1, depth / 2 - 1);
            this.createLootContainer(crateX, y, crateZ, 'crate');
        }
    },

    createLootContainer(x, y, z, containerType = 'barrel') {
        let containerGeo, containerMat;
        const size = containerType === 'barrel' ? 0.6 : 0.8; // Barrels smaller than crates

        if (containerType === 'barrel') {
            containerGeo = new THREE.CylinderGeometry(size / 2, size / 2, size * 1.2, 12);
            containerMat = this.materials.barrel;
        } else { // crate
            containerGeo = new THREE.BoxGeometry(size, size, size);
            containerMat = this.materials.crate;
        }

        const containerMesh = new THREE.Mesh(containerGeo, containerMat);
        const posY = containerType === 'barrel' ? y + (size * 1.2) / 2 : y + size / 2;
        containerMesh.position.set(x, posY, z);
        containerMesh.castShadow = true;
        containerMesh.receiveShadow = true;

        // Define potential loot (item name and quantity range)
        const potentialLoot = [
            { item: 'scrap_metal', min: 1, max: 5 },
            { item: 'nail', min: 3, max: 10 },
            { item: 'rope', min: 1, max: 3 },
            // { item: 'canned_food', min: 1, max: 2 }, // Example future item
        ];
        const lootTable = [];
        const numItems = Utils.getRandomInt(1, 3); // 1 to 3 different item types per container
        for(let i=0; i<numItems; i++) {
            const lootEntry = potentialLoot[Utils.getRandomInt(0, potentialLoot.length - 1)];
            lootTable.push({
                 item: lootEntry.item,
                 quantity: Utils.getRandomInt(lootEntry.min, lootEntry.max)
            });
        }


        containerMesh.userData = {
            type: 'container',
            containerType: containerType,
            searched: false,
            loot: lootTable // Store the generated loot
        };
        this.scene.add(containerMesh);
        this.interactableObjects.push(containerMesh);
        // Make containers collidable too
        this.collidableObjects.push(containerMesh);
    },

    spawnAnimals() {
        const area = 80;
         for (let i = 0; i < 5; i++) { // Spawn 5 generic animals
            const x = Utils.getRandomInt(-area, area);
            const z = Utils.getRandomInt(-area, area);
             if (x > 40 && x < 90 && z > 40 && z < 90) continue; // Avoid water roughly

            const animalSize = 0.8;
            const animalGeo = new THREE.BoxGeometry(animalSize * 1.5, animalSize, animalSize); // Simple box animal
            const animalMesh = new THREE.Mesh(animalGeo, this.materials.animal);
            animalMesh.position.set(x, animalSize / 2, z);
            animalMesh.castShadow = true;

             animalMesh.userData = {
                type: 'animal',
                animalType: 'deer', // Example type
                health: 50,
                drops: [ // Resources dropped on death
                    { item: 'meat_raw', min: 2, max: 4 },
                    { item: 'leather', min: 1, max: 3 },
                    { item: 'fat', min: 0, max: 2 }
                ],
                // AI State
                aiState: 'idle', // 'idle', 'wandering', 'fleeing'
                wanderTarget: null,
                wanderTimer: 0,
            };

            this.scene.add(animalMesh);
            this.animals.push(animalMesh);
            this.interactableObjects.push(animalMesh); // Can be attacked
            this.collidableObjects.push(animalMesh); // Collide with animals
         }
    },

    updateAnimals(deltaTime) {
        const wanderSpeed = 1.5;
        const wanderWaitTime = 5; // Seconds
        const wanderRadius = 30; // Max distance to wander to

        this.animals.forEach(animal => {
            if (!animal.parent) return; // Skip if removed from scene

             animal.userData.wanderTimer -= deltaTime;

            if (animal.userData.aiState === 'idle') {
                 if (animal.userData.wanderTimer <= 0) {
                     animal.userData.aiState = 'wandering';
                     // Pick a random nearby target point
                     const targetX = animal.position.x + Utils.getRandomInt(-wanderRadius, wanderRadius);
                     const targetZ = animal.position.z + Utils.getRandomInt(-wanderRadius, wanderRadius);
                     // Clamp target to world bounds (approx)
                     const clampedX = Math.max(-95, Math.min(95, targetX));
                     const clampedZ = Math.max(-95, Math.min(95, targetZ));
                     animal.userData.wanderTarget = new THREE.Vector3(clampedX, animal.position.y, clampedZ);
                      // Look towards target (simple)
                    animal.lookAt(animal.userData.wanderTarget);
                 }
            }
            else if (animal.userData.aiState === 'wandering' && animal.userData.wanderTarget) {
                const direction = new THREE.Vector3().subVectors(animal.userData.wanderTarget, animal.position);
                const distance = direction.length();

                if (distance < 0.5) { // Reached target
                    animal.userData.aiState = 'idle';
                    animal.userData.wanderTarget = null;
                    animal.userData.wanderTimer = Utils.getRandomInt(2, wanderWaitTime); // Wait before wandering again
                } else {
                    // Move towards target
                    direction.normalize();
                    animal.position.add(direction.multiplyScalar(wanderSpeed * deltaTime));
                     // Keep looking at target (optional, can make movement smoother)
                     // animal.lookAt(animal.userData.wanderTarget);
                }
            }
             // Basic world bounds collision (prevent falling off edge)
             animal.position.x = Math.max(-98, Math.min(98, animal.position.x));
             animal.position.z = Math.max(-98, Math.min(98, animal.position.z));

            // TODO: Add fleeing state, collision with environment for animals
        });
    },

    removeObject(object) {
        if (!object || !object.parent) return; // Already removed or invalid

        // Remove from scene
        object.parent.remove(object); // If it's in a group
        this.scene.remove(object); // If it's directly in the scene

        // Remove from tracking arrays
        this.collidableObjects = this.collidableObjects.filter(o => o !== object);
        this.interactableObjects = this.interactableObjects.filter(o => o !== object);
        this.animals = this.animals.filter(o => o !== object);
        this.lootContainers = this.lootContainers.filter(o => o !== object); // Though containers usually aren't removed

         // Dispose geometry and material to free memory (important!)
         if (object.geometry) object.geometry.dispose();
         if (object.material) {
             // If material is shared, be careful not to dispose if still used elsewhere
             // In this simple setup, materials are somewhat shared by type, but not strictly managed.
             // A more robust system would track material usage.
             // For now, we assume materials can be disposed if the object type is unique enough.
             // Check if it's an array of materials
             if (Array.isArray(object.material)) {
                 object.material.forEach(m => m.dispose());
             } else {
                 object.material.dispose();
             }
         }

        // If it was part of a group (like a tree), remove the whole group
        if (object.userData && object.userData.group) {
             this.removeObject(object.userData.group); // Recursive call for group
        }


        console.log("Removed object:", object.userData.type || 'Unknown');
    }


};

// Make globally accessible
window.World = World;
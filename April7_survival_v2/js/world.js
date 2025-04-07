// js/world.js
const World = {
    ground: null,
    objects: [], // All static world objects (trees, rocks, buildings, AI, etc.)
    interactables: [], // Objects player can interact with (subset of objects or separate?)

    init: function() {
        // Create Ground
        const groundGeometry = new THREE.PlaneGeometry(500, 500, 50, 50); // Larger plane
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x556B2F, side: THREE.DoubleSide }); // Dark green
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2; // Rotate flat
        this.ground.receiveShadow = true;
        this.ground.position.y = 0; // Set ground level
        Engine.scene.add(this.ground);

        // --- Spawn Resources ---
        this.spawnResources();

         // Spawn some initial AI
         AI.spawnAgent('chicken', new THREE.Vector3(10, 0.5, 10));
         AI.spawnAgent('chicken', new THREE.Vector3(-5, 0.5, 15));
         AI.spawnAgent('wolf', new THREE.Vector3(25, 0.5, 25));


        console.log("World Initialized");
    },

    spawnResources: function() {
        // --- Define Geometries and Materials (can be reused) ---
        // Tree parts
        const trunkHeight = 4;
        const trunkRadiusBottom = 0.5;
        const trunkRadiusTop = 0.3;
        const treeTrunkGeometry = new THREE.CylinderGeometry(trunkRadiusTop, trunkRadiusBottom, trunkHeight, 8);
        const treeTrunkMaterial = new THREE.MeshLambertMaterial({ color: CONSTANTS.RESOURCES.WOOD.color }); // Brown

        const foliageHeight = 3;
        const foliageRadius = 1.5;
        const treeFoliageGeometry = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8); // Simple cone for leaves
        const treeFoliageMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Forest Green

        // Other resources
        const rockGeometry = new THREE.IcosahedronGeometry(0.8, 0); // Simple rock shape
        const rockMaterial = new THREE.MeshLambertMaterial({ color: CONSTANTS.RESOURCES.STONE.color }); // Grey

        const fiberGeometry = new THREE.BoxGeometry(0.3, 0.5, 0.3);
        const fiberMaterial = new THREE.MeshLambertMaterial({ color: CONSTANTS.RESOURCES.FIBER.color }); // Green

        // --- Placement Loops ---
        const placementArea = 450;
        const treeCount = 500;
        const rockCount = 300;
        const fiberCount = 400;

        // Spawn Trees
        for (let i = 0; i < treeCount; i++) {
            const x = (Math.random() - 0.5) * placementArea;
            const z = (Math.random() - 0.5) * placementArea;
            // Pass geometries and materials to avoid recreation
            this.spawnTree(
                new THREE.Vector3(x, trunkHeight / 2, z), // Position at base center
                treeTrunkGeometry, treeTrunkMaterial,
                treeFoliageGeometry, treeFoliageMaterial
            );
        }

        // Spawn Rocks
        for (let i = 0; i < rockCount; i++) {
            const x = (Math.random() - 0.5) * placementArea;
            const z = (Math.random() - 0.5) * placementArea;
            this.spawnRock(new THREE.Vector3(x, 0.4, z), rockGeometry, rockMaterial);
        }

        // Spawn Fiber
        for (let i = 0; i < fiberCount; i++) {
            const x = (Math.random() - 0.5) * placementArea;
            const z = (Math.random() - 0.5) * placementArea;
            this.spawnFiber(new THREE.Vector3(x, 0.25, z), fiberGeometry, fiberMaterial);
        }
    },

    // --- UPDATED Spawner Functions ---

    spawnTree: function(position, trunkGeom, trunkMat, foliageGeom, foliageMat) {
        const treeGroup = new THREE.Group(); // Create a group for the whole tree

        // Create Trunk Mesh
        const trunkMesh = new THREE.Mesh(trunkGeom, trunkMat);
        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true; // Trunk can receive shadow from leaves
        // Trunk position is relative to the group's origin (which is at the base)
        // Since CylinderGeometry origin is its center, no Y offset needed here IF group position is set correctly.
        treeGroup.add(trunkMesh); // Add trunk to the group

        // Create Foliage Mesh
        const foliageMesh = new THREE.Mesh(foliageGeom, foliageMat);
        foliageMesh.castShadow = true;
        // Position foliage relative to the group's origin (base of trunk)
        // Needs to be placed on top of the trunk.
        const trunkHeight = trunkGeom.parameters.height;
        const foliageHeight = foliageGeom.parameters.height;
        foliageMesh.position.y = trunkHeight / 2 + foliageHeight / 2 - 0.2; // Place center of cone above center of cylinder, adjust slightly
        treeGroup.add(foliageMesh); // Add foliage to the group

        // --- Configure the GROUP ---
        treeGroup.position.copy(position); // Set the world position of the group (base of the trunk)
        treeGroup.name = "Tree"; // Name the group

        // Attach interaction data to the GROUP
        treeGroup.userData = {
            interactable: true,
            resourceId: 'wood',
            hp: 10, // Tree health
            prompt: "Press [E] to Chop",
            // The 'object' passed here will be the GROUP
            onInteract: (objectGroup) => this.harvestResource(objectGroup, 'wood', 1) // Amount per hit
        };

        // Add the GROUP to the scene and world lists
        Engine.scene.add(treeGroup);
        this.objects.push(treeGroup); // Add the group to objects list
        this.interactables.push(treeGroup); // Add the group to interactables
    },

     spawnRock: function(position, geometry, material) {
        // Rock spawning remains the same
        const rock = new THREE.Mesh(geometry, material);
        rock.position.copy(position);
        rock.castShadow = true;
        rock.name = "Rock";
         rock.userData = {
             interactable: true,
             resourceId: 'stone',
             hp: 15,
             prompt: "Press [E] to Mine",
             onInteract: (object) => this.harvestResource(object, 'stone', 1) // Pass the mesh itself
         };
        Engine.scene.add(rock);
        this.objects.push(rock);
        this.interactables.push(rock);
    },

      spawnFiber: function(position, geometry, material) {
        // Fiber spawning remains the same
        const fiber = new THREE.Mesh(geometry, material);
        fiber.position.copy(position);
        fiber.castShadow = true;
        fiber.name = "Fiber Plant";
         fiber.userData = {
             interactable: true,
             resourceId: 'fiber',
             hp: 1,
             prompt: "Press [E] to Gather",
             onInteract: (object) => this.harvestResource(object, 'fiber', 2) // Pass the mesh itself
         };
        Engine.scene.add(fiber);
        this.objects.push(fiber);
        this.interactables.push(fiber);
    },


    // --- UPDATED Harvest Function ---
    harvestResource: function(interactedObject, resourceId, amountPerHit) {
        // interactedObject could be a Mesh (rock, fiber) or a Group (tree)
        if (!interactedObject || !interactedObject.userData || interactedObject.userData.hp <= 0) {
            return; // Already depleted or invalid object
        }

        // TODO: Check if player has the correct tool

        console.log(`Hitting ${interactedObject.name}`);
        interactedObject.userData.hp -= 1; // Decrease HP per hit

        if (interactedObject.userData.hp <= 0) {
            console.log(`${interactedObject.name} depleted!`);
            Inventory.addItem(resourceId, amountPerHit * 3); // Bonus amount on final hit
            Game.UIManager.logMessage(`Gathered ${resourceId}!`);

            // --- Remove object/group from scene and lists ---
            Engine.scene.remove(interactedObject); // Remove the Mesh or the entire Group

            const objIndex = this.objects.indexOf(interactedObject);
            if (objIndex > -1) this.objects.splice(objIndex, 1);

            const intIndex = this.interactables.indexOf(interactedObject);
            if (intIndex > -1) this.interactables.splice(intIndex, 1);

            // If the currently targeted object is the one just removed, clear interaction
            if (Interaction.intersectedObject === interactedObject) {
                 Interaction.intersectedObject = null;
                 Interaction.hidePrompt();
            }

            // Optional: Add respawn timer/logic here
            // Optional: Play destroy sound effect

            // If it was a group (like a tree), dispose geometries/materials of children?
             if (interactedObject.isGroup) {
                 interactedObject.traverse(child => {
                     if (child.isMesh) {
                         child.geometry?.dispose();
                         // Be careful disposing shared materials
                         // child.material?.dispose();
                     }
                 });
             } else if (interactedObject.isMesh) {
                interactedObject.geometry?.dispose();
                // interactedObject.material?.dispose();
             }

        } else {
            Inventory.addItem(resourceId, amountPerHit);
            Game.UIManager.logMessage(`Hit ${interactedObject.name}, got ${resourceId}`);
            // Optional: Play hit sound effect
            // Optional: Visual feedback (shake, particle effect) - applied to interactedObject (Mesh or Group)
        }
    },

    update: function(deltaTime) {
        // Update dynamic world elements if any (e.g., weather, time of day - not implemented)
    },

    // Function to add dynamically created objects (like buildings) to the world
    // (No changes needed here, it already handles adding Meshes or Groups)
    addWorldObject: function(meshOrGroup, isInteractable = false, isCollider = true) {
        Engine.scene.add(meshOrGroup);
        if (isCollider) {
            this.objects.push(meshOrGroup); // Add to general objects list
        }
        if (isInteractable) {
             if (!meshOrGroup.userData) meshOrGroup.userData = {}; // Ensure userData exists
             meshOrGroup.userData.interactable = true;
             this.interactables.push(meshOrGroup); // Add to interactables if needed
        }
    },

     // Function to remove dynamically created objects
     // (Needs slight modification to handle potential geometry disposal for groups)
    removeWorldObject: function(meshOrGroup) {
        if (!meshOrGroup) return;

        Engine.scene.remove(meshOrGroup);

        const objIndex = this.objects.indexOf(meshOrGroup);
        if (objIndex > -1) this.objects.splice(objIndex, 1);

        const intIndex = this.interactables.indexOf(meshOrGroup);
        if (intIndex > -1) this.interactables.splice(intIndex, 1);

        if (Interaction.intersectedObject === meshOrGroup) {
             Interaction.intersectedObject = null;
             Interaction.hidePrompt();
        }

        // Dispose geometry/materials to free memory
        if (meshOrGroup.isGroup) {
             meshOrGroup.traverse(child => {
                 if (child.isMesh) {
                     child.geometry?.dispose();
                     // Only dispose material if it's unique to this object
                     // If materials are shared (like placedMaterial in Building), don't dispose here.
                     // child.material?.dispose();
                 }
             });
         } else if (meshOrGroup.isMesh) {
            meshOrGroup.geometry?.dispose();
            // meshOrGroup.material?.dispose();
         }
    }
};

window.World = World;
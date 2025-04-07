// js/world.js
const World = {
    ground: null,
    objects: [], // All static world objects (trees, rocks, etc.)
    interactables: [], // Objects player can interact with

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
        const treeGeometry = new THREE.CylinderGeometry(0.3, 0.5, 4, 8);
        const treeMaterial = new THREE.MeshLambertMaterial({ color: CONSTANTS.RESOURCES.WOOD.color }); // Brown

        const rockGeometry = new THREE.IcosahedronGeometry(0.8, 0); // Simple rock shape
        const rockMaterial = new THREE.MeshLambertMaterial({ color: CONSTANTS.RESOURCES.STONE.color }); // Grey

         const fiberGeometry = new THREE.BoxGeometry(0.3, 0.5, 0.3);
         const fiberMaterial = new THREE.MeshLambertMaterial({ color: CONSTANTS.RESOURCES.FIBER.color }); // Green


        // Simple random placement
        for (let i = 0; i < 50; i++) { // Spawn 50 trees
            const x = (Math.random() - 0.5) * 450;
            const z = (Math.random() - 0.5) * 450;
            this.spawnTree(new THREE.Vector3(x, 2, z), treeGeometry, treeMaterial);
        }

        for (let i = 0; i < 30; i++) { // Spawn 30 rocks
            const x = (Math.random() - 0.5) * 450;
            const z = (Math.random() - 0.5) * 450;
             this.spawnRock(new THREE.Vector3(x, 0.4, z), rockGeometry, rockMaterial);
        }

         for (let i = 0; i < 40; i++) { // Spawn 40 fiber plants
             const x = (Math.random() - 0.5) * 450;
             const z = (Math.random() - 0.5) * 450;
             this.spawnFiber(new THREE.Vector3(x, 0.25, z), fiberGeometry, fiberMaterial);
         }
    },

    // --- Specific Spawner Functions ---

    spawnTree: function(position, geometry, material) {
        const tree = new THREE.Mesh(geometry, material);
        tree.position.copy(position);
        tree.castShadow = true;
        tree.name = "Tree";
        tree.userData = {
            interactable: true,
            resourceId: 'wood',
            hp: 10, // Tree health
            prompt: "Press [E] to Chop",
            onInteract: (object) => this.harvestResource(object, 'wood', 1) // Amount per hit
        };
        Engine.scene.add(tree);
        this.objects.push(tree);
        this.interactables.push(tree);
    },

     spawnRock: function(position, geometry, material) {
        const rock = new THREE.Mesh(geometry, material);
        rock.position.copy(position);
        rock.castShadow = true;
        rock.name = "Rock";
         rock.userData = {
             interactable: true,
             resourceId: 'stone', // Placeholder for various ores
             hp: 15,
             prompt: "Press [E] to Mine",
             onInteract: (object) => this.harvestResource(object, 'stone', 1) // Needs Pickaxe check later
         };
        Engine.scene.add(rock);
        this.objects.push(rock);
        this.interactables.push(rock);
    },

      spawnFiber: function(position, geometry, material) {
        const fiber = new THREE.Mesh(geometry, material);
        fiber.position.copy(position);
        fiber.castShadow = true;
        fiber.name = "Fiber Plant";
         fiber.userData = {
             interactable: true,
             resourceId: 'fiber',
             hp: 1, // Harvest instantly
             prompt: "Press [E] to Gather",
             onInteract: (object) => this.harvestResource(object, 'fiber', 2) // Yields 2 fiber
         };
        Engine.scene.add(fiber);
        this.objects.push(fiber);
        this.interactables.push(fiber);
    },


    harvestResource: function(object, resourceId, amountPerHit) {
         // TODO: Check if player has the correct tool (axe for wood, pickaxe for stone)
         // For now, allow harvesting anything

        if (object.userData.hp <= 0) return; // Already depleted

        console.log(`Hitting ${object.name}`);
        object.userData.hp -= 1; // Decrease HP per hit

        if (object.userData.hp <= 0) {
            console.log(`${object.name} depleted!`);
            Inventory.addItem(resourceId, amountPerHit * 3); // Bonus amount on final hit
            Game.UIManager.logMessage(`Gathered ${resourceId}!`);

            // Remove object from scene and lists
            Engine.scene.remove(object);

            const objIndex = this.objects.indexOf(object);
            if (objIndex > -1) this.objects.splice(objIndex, 1);

            const intIndex = this.interactables.indexOf(object);
            if (intIndex > -1) this.interactables.splice(intIndex, 1);

            Interaction.intersectedObject = null; // Clear interaction target
            Interaction.hidePrompt();

            // Optional: Add respawn timer/logic here
            // Optional: Play sound effect

        } else {
            Inventory.addItem(resourceId, amountPerHit);
            Game.UIManager.logMessage(`Hit ${object.name}, got ${resourceId}`);
            // Optional: Play hit sound effect
            // Optional: Visual feedback (shake, particle effect)
        }
    },

    update: function(deltaTime) {
        // Update dynamic world elements if any (e.g., weather, time of day - not implemented)
    },

    // Function to add dynamically created objects (like buildings) to the world
    addWorldObject: function(mesh, isInteractable = false, isCollider = true) {
        Engine.scene.add(mesh);
        if (isCollider) {
            this.objects.push(mesh); // Add to general objects list (for potential collision)
        }
        if (isInteractable) {
             if (!mesh.userData) mesh.userData = {}; // Ensure userData exists
             mesh.userData.interactable = true;
             this.interactables.push(mesh); // Add to interactables if needed
        }
    },

     // Function to remove dynamically created objects
    removeWorldObject: function(mesh) {
        Engine.scene.remove(mesh);

         const objIndex = this.objects.indexOf(mesh);
         if (objIndex > -1) this.objects.splice(objIndex, 1);

         const intIndex = this.interactables.indexOf(mesh);
         if (intIndex > -1) this.interactables.splice(intIndex, 1);

         if (Interaction.intersectedObject === mesh) {
              Interaction.intersectedObject = null;
              Interaction.hidePrompt();
         }
         // Note: This doesn't handle removing AI agents specifically, use AI.removeAgent for that
    }
};

window.World = World;
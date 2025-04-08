// js/world.js
class World {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.objects = []; // Trees, rocks, plants, etc.
        this.collidableObjects = []; // Objects for physics/raycast collision
         this.interactableObjects = []; // Objects the player can interact with
         this.aiEntities = []; // List of active AI controllers

        this.worldSize = 200; // Width/Depth of the world area
    }

    generate() {
        this.createGround();
        this.addFog();
        this.spawnResources();
        this.spawnInitialAI();

        // Add placed build objects to collidable/interactable lists if needed
         this.game.buildingSystem.placedObjects.forEach(obj => {
             this.collidableObjects.push(obj.mesh);
             if (ITEMS[obj.itemId]?.interactable) {
                 this.interactableObjects.push(obj.mesh);
             }
         });
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 50, 50); // W, H, Segments
        const groundMaterial = new THREE.MeshStandardMaterial({
             color: 0x556B2F, // Dark Olive Green
             wireframe: false, // Set true for debugging terrain shape
             // TODO: Add terrain texture, normal map, etc.
             });
        const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        groundMesh.rotation.x = -Math.PI / 2; // Rotate plane to be horizontal
        groundMesh.receiveShadow = true;
        groundMesh.userData.type = 'ground';
        this.scene.add(groundMesh);
        this.collidableObjects.push(groundMesh); // Ground is collidable
    }

    addFog() {
        const fogColor = 0xcccccc; // Light grey fog
        const near = 10; // Start distance
        const far = this.worldSize * 0.6; // End distance - adjust for desired view distance
        this.scene.fog = new THREE.Fog(fogColor, near, far);
        this.scene.background = new THREE.Color(fogColor); // Match background to fog
    }

    spawnResources() {
        const halfSize = this.worldSize / 2;
        const nodeDensity = 0.5; // Lower number = more space between nodes

        // Calculate number based on percentage coverage (approximate)
        const area = this.worldSize * this.worldSize;
        const treeCount = Math.floor(area * 0.75 / (5*5)); // Approx area per tree
        const stoneCount = Math.floor(area * 0.70 / (3*3));
        const fiberCount = Math.floor(area * 0.80 / (1*1));

        console.log(`Spawning ~${treeCount} trees, ${stoneCount} stones, ${fiberCount} fiber`);


        // Trees (75%)
        for (let i = 0; i < treeCount; i++) {
            const x = Utils.getRandomInt(-halfSize, halfSize);
            const z = Utils.getRandomInt(-halfSize, halfSize);
            this.spawnTree(new THREE.Vector3(x, 0, z));
        }

        // Stones (70% - Various types)
        for (let i = 0; i < stoneCount; i++) {
             const x = Utils.getRandomInt(-halfSize, halfSize);
             const z = Utils.getRandomInt(-halfSize, halfSize);
             this.spawnStone(new THREE.Vector3(x, 0, z));
        }

        // Fiber (80%)
        for (let i = 0; i < fiberCount; i++) {
             const x = Utils.getRandomInt(-halfSize, halfSize);
             const z = Utils.getRandomInt(-halfSize, halfSize);
             this.spawnFiber(new THREE.Vector3(x, 0, z));
        }

         // TODO: Spawn vegetables, medical plants, loot crates etc.
    }

     spawnTree(position) {
         // Placeholder Tree (Cylinder trunk, Sphere leaves)
         const trunkHeight = Utils.getRandomInt(4, 8);
         const trunkRadius = trunkHeight * 0.1;
         const trunkGeo = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 8);
         const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
         const trunk = new THREE.Mesh(trunkGeo, trunkMat);
         trunk.position.set(position.x, trunkHeight / 2, position.z); // Position base at y=0
         trunk.castShadow = true;
         trunk.userData = { resourceType: 'Wood', health: 10, type: 'resource_node' };

         const leavesRadius = trunkHeight * 0.4;
         const leavesGeo = new THREE.SphereGeometry(leavesRadius, 8, 6);
         const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest Green
         const leaves = new THREE.Mesh(leavesGeo, leavesMat);
         leaves.position.y = trunkHeight; // Position leaves on top of trunk
         leaves.castShadow = true;
         leaves.userData = { isDecoration: true }; // Mark leaves as non-interactable part

         // Group trunk and leaves (optional but good for organization)
         const treeGroup = new THREE.Group();
         treeGroup.add(trunk);
         treeGroup.add(leaves);
         treeGroup.position.copy(position); // Set group's base position
         treeGroup.userData.isTreeGroup = true; // Identify group if needed

         // Make the *trunk* the interactable part
         this.scene.add(trunk); // Add trunk directly to scene for interaction raycasting
         this.scene.add(leaves); // Add leaves separately
        // this.scene.add(treeGroup); // Or add the group
         this.objects.push(trunk); // Track the trunk
         this.objects.push(leaves); // Track the leaves
         this.collidableObjects.push(trunk); // Trees are collidable
         this.interactableObjects.push(trunk); // Trunks are interactable
     }

      spawnStone(position) {
          // Placeholder Stone (Irregular Sphere/Box)
          const size = Utils.getRandomInt(1, 3) * 0.5;
          // Use Box with slight random dimensions for variety? Or Icosahedron?
           const stoneGeo = new THREE.IcosahedronGeometry(size, 0); // Radius, detail level (0 = blocky)
          const stoneMat = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Grey

           // Determine ore type randomly
           let oreType = 'Stone';
           let health = 5;
           const rand = Math.random();
           if (rand < 0.15) { // 15% chance Iron
               oreType = 'Iron Ore';
               stoneMat.color.set(0xB87333); // Rusty color
               health = 8;
           } else if (rand < 0.25) { // 10% chance Copper
               oreType = 'Copper Ore';
               stoneMat.color.set(0xb87333); // Copper color
                health = 7;
           } else if (rand < 0.30) { // 5% chance Zinc
                oreType = 'Zinc Ore';
                stoneMat.color.set(0xc0c0c0); // Silvery color
                 health = 6;
           }


          const stone = new THREE.Mesh(stoneGeo, stoneMat);
           stone.position.set(position.x, size * 0.8, position.z); // Position slightly embedded in ground
          stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI); // Random rotation
          stone.castShadow = true;
           stone.userData = { resourceType: oreType, health: health, type: 'resource_node' };

          this.scene.add(stone);
          this.objects.push(stone);
          this.collidableObjects.push(stone);
          this.interactableObjects.push(stone);
      }

      spawnFiber(position) {
          // Placeholder Fiber (Small green sphere/sprite)
           const fiberGeo = new THREE.SphereGeometry(0.2, 5, 4);
           const fiberMat = new THREE.MeshBasicMaterial({ color: 0x90EE90 }); // Light Green (Basic material, no lighting needed?)
           const fiber = new THREE.Mesh(fiberGeo, fiberMat);
           fiber.position.set(position.x, 0.2, position.z);
           // No shadow casting for small objects usually
           fiber.userData = { resourceType: 'Fiber', health: 1, type: 'resource_node' }; // Only 1 hit to gather

           this.scene.add(fiber);
           this.objects.push(fiber);
           // Fiber usually isn't collidable
           this.interactableObjects.push(fiber);
      }

     spawnInitialAI() {
         const halfSize = this.worldSize / 2;
         const numPassive = 15; // Chickens, rabbits, deer
         const numHostile = 5; // Wolves, bears, hunters

         for (let i = 0; i < numPassive; i++) {
             const x = Utils.getRandomInt(-halfSize, halfSize);
             const z = Utils.getRandomInt(-halfSize, halfSize);
             // Choose type randomly
             const type = ['chicken', 'rabbit', 'deer'][Utils.getRandomInt(0, 1)]; // Add deer later
              const ai = createAI(this.game, type, new THREE.Vector3(x, 0, z));
              if(ai) this.aiEntities.push(ai);
         }

         for (let i = 0; i < numHostile; i++) {
             const x = Utils.getRandomInt(-halfSize, halfSize);
             const z = Utils.getRandomInt(-halfSize, halfSize);
             // Choose type randomly
             const type = ['wolf', 'hunter'][Utils.getRandomInt(0, 1)]; // Add bear/cougar later
             const ai = createAI(this.game, type, new THREE.Vector3(x, 0, z));
             if(ai) this.aiEntities.push(ai);
         }
          console.log(`Spawned ${this.aiEntities.length} AI entities.`);
     }

     // --- Object Management ---

     add(object) {
         // Add object to scene and appropriate lists
         this.scene.add(object);
         this.objects.push(object);
         if (object.userData.isCollidable) this.collidableObjects.push(object);
         if (object.userData.isInteractable) this.interactableObjects.push(object);
          if (object.userData.aiController) this.aiEntities.push(object.userData.aiController);
     }

     removeObject(objectToRemove) {
          // Remove from scene
          if (objectToRemove.parent) {
            objectToRemove.parent.remove(objectToRemove);
          }

          // Dispose geometry and material to free GPU memory
          if (objectToRemove.geometry) objectToRemove.geometry.dispose();
          if (objectToRemove.material) {
               if (Array.isArray(objectToRemove.material)) {
                   objectToRemove.material.forEach(m => m.dispose());
               } else {
                   objectToRemove.material.dispose();
               }
          }


          // Remove from internal lists
          this.objects = this.objects.filter(obj => obj !== objectToRemove);
          this.collidableObjects = this.collidableObjects.filter(obj => obj !== objectToRemove);
          this.interactableObjects = this.interactableObjects.filter(obj => obj !== objectToRemove);

         // If it's part of a group (like a tree), remove the whole group? Or just the part?
         // Need careful handling here. For now, assumes direct removal.
     }

      removeAI(aiController) {
         this.aiEntities = this.aiEntities.filter(ai => ai !== aiController);
         console.log(`Removed AI controller. Remaining AI: ${this.aiEntities.length}`);
         // Mesh removal is handled in aiController.die() or here if needed
          // this.removeObject(aiController.mesh);
     }


     // --- Getters for other systems ---
     getCollidableObjects() {
         // Return objects relevant for physics/movement collision
         // Might include placed build items as well
          return [
            ...this.collidableObjects,
             ...this.game.buildingSystem.placedObjects.map(p => p.mesh) // Add buildings dynamically
            ];
     }

     getInteractableObjects() {
         // Return objects player can interact with (harvest, open, use)
          return [
            ...this.interactableObjects,
             ...this.aiEntities.map(ai => ai.mesh), // AI are interactable (attack/loot)
             ...this.game.buildingSystem.placedObjects
                 .filter(p => ITEMS[p.itemId]?.interactable) // Only interactable buildings
                 .map(p => p.mesh)
             ];
     }

     // Optional: Update world elements (animations, weather, etc.)
     update(deltaTime) {
          // Update all active AI
          this.aiEntities.forEach(ai => ai.update(deltaTime));

         // Update other world systems (weather, day/night cycle, resource respawning?)
     }

      createLootDrop(position, items) {
         // Simple placeholder: a small bag mesh
         // TODO: Make this interactable to pick up items
          const lootBagGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
          const lootBagMat = new THREE.MeshStandardMaterial({ color: 0x SaddleBrown });
          const lootBagMesh = new THREE.Mesh(lootBagGeo, lootBagMat);
          lootBagMesh.position.copy(position);
          lootBagMesh.position.y = Math.max(0.15, position.y); // Ensure slightly above ground
          lootBagMesh.userData = { type: 'loot_container', items: items, isInteractable: true };

          this.scene.add(lootBagMesh);
          this.objects.push(lootBagMesh);
          this.interactableObjects.push(lootBagMesh); // Make it interactable

          console.log("Created loot drop at", position, "with", items);

           // Add interaction logic in player.js to pick up items from 'loot_container'
           // Add despawn timer?
           setTimeout(() => {
               if (lootBagMesh.parent) {
                    console.log("Despawning loot bag");
                    this.removeObject(lootBagMesh);
               }
           }, 60000); // Despawn after 1 minute
      }

}

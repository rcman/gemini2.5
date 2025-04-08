// js/world.js
class World {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.objects = []; // All managed objects (resources, loot, etc.)
        this.collidableObjects = []; // Objects for physics/raycast collision (terrain, static meshes)
        this.interactableObjects = []; // Objects the player can interact with (harvest nodes, loot, AI?)
        this.aiEntities = []; // List of active AI controllers

        this.worldSize = 200; // Width/Depth of the world area
        this.groundMesh = null; // Keep a reference to the ground
    }

    generate() {
        this.createGround();
        this.addFog();
        this.spawnResources();
        this.spawnInitialAI();

        // Note: Placed build objects are added dynamically via getCollidableObjects/getInteractableObjects
        // using game.buildingSystem.placedObjects, no need to add them here explicitly.
    }

    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 50, 50);
        const groundMaterial = new THREE.MeshStandardMaterial({
             color: 0x556B2F, // Dark Olive Green
             // roughness: 0.9, metalness: 0.1, // Less shiny ground
             // TODO: Add terrain texture, normal map, etc.
             });
        this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.receiveShadow = true;
        this.groundMesh.userData = { type: 'ground', isCollidable: true }; // Mark as ground and collidable
        this.scene.add(this.groundMesh);
        this.collidableObjects.push(this.groundMesh); // Ground is collidable
    }

    addFog() {
        const fogColor = 0xcccccc; // Light grey fog
        const near = 15; // Start distance
        const far = this.worldSize * 0.7; // End distance
        this.scene.fog = new THREE.Fog(fogColor, near, far);
        this.scene.background = new THREE.Color(fogColor);
    }

    spawnResources() {
        const halfSize = this.worldSize / 2 * 0.95; // Spawn slightly away from edges
        const density = 0.015; // Resources per sq meter (adjust)
        const area = this.worldSize * this.worldSize;
        const totalNodes = Math.floor(area * density);

        const resourceTypes = [
            { type: 'Tree', chance: 0.30, func: this.spawnTree.bind(this) },
            { type: 'StoneNode', chance: 0.35, func: this.spawnStone.bind(this) }, // Includes ores
            { type: 'Fiber', chance: 0.30, func: this.spawnFiber.bind(this) },
            // Add blueberry bush etc.
             { type: 'BlueberryBush', chance: 0.05, func: this.spawnBlueberry.bind(this) },
        ];

        console.log(`Attempting to spawn ~${totalNodes} resource nodes...`);
        let spawnedCount = 0;

        for (let i = 0; i < totalNodes; i++) {
            const x = Utils.getRandomInt(-halfSize, halfSize);
            const z = Utils.getRandomInt(-halfSize, halfSize);
            const y = 0; // Base height, adjust with raycast down if terrain is uneven

            // TODO: Raycast down from (x, 50, z) to find actual ground height 'y' for uneven terrain

            const rand = Math.random();
            let cumulativeChance = 0;
            for (const res of resourceTypes) {
                cumulativeChance += res.chance;
                if (rand < cumulativeChance) {
                    res.func(new THREE.Vector3(x, y, z));
                    spawnedCount++;
                    break; // Spawn one type per location
                }
            }
        }
         console.log(`Successfully spawned ${spawnedCount} resource nodes.`);
    }

     spawnTree(position) {
         const trunkHeight = Utils.getRandomInt(4, 8);
         const trunkRadius = trunkHeight * 0.1;
         const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius, trunkHeight, 8); // Tapered trunk
         const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
         const trunk = new THREE.Mesh(trunkGeo, trunkMat);
         // Position base at calculated Y (position.y)
         trunk.position.set(position.x, position.y + trunkHeight / 2, position.z);
         trunk.castShadow = true;
         trunk.userData = { resourceType: 'Wood', health: 50, type: 'resource_node', isCollidable: true, isInteractable: true };

         const leavesRadius = trunkHeight * Utils.getRandomInt(3, 5) * 0.1;
         // Use Icosahedron for slightly more varied leaf shape
         const leavesGeo = new THREE.IcosahedronGeometry(leavesRadius, 0);
         const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228B22, flatShading: true }); // Flat shading for low poly look
         const leaves = new THREE.Mesh(leavesGeo, leavesMat);
         // Position leaves relative to trunk top
         leaves.position.set(position.x, position.y + trunkHeight + leavesRadius * 0.5, position.z);
         leaves.castShadow = true;
         leaves.userData = { type: 'decoration', isCollidable: false }; // Leaves usually not collidable/interactable

         this.scene.add(trunk);
         this.scene.add(leaves); // Add leaves separately for visuals
         this.objects.push(trunk); // Track the interactable part
         this.objects.push(leaves); // Track visuals too if needed for removal later
         this.collidableObjects.push(trunk); // Trunk is collidable
         this.interactableObjects.push(trunk); // Trunk is interactable
     }

      spawnStone(position) {
          const size = Utils.getRandomInt(1, 3) * 0.5;
          const stoneGeo = new THREE.IcosahedronGeometry(size, Utils.getRandomInt(0, 1)); // Random detail level
          const stoneMat = new THREE.MeshStandardMaterial({ color: 0x808080, flatShading: true });

          let oreType = 'Stone';
          let health = 25;
          const rand = Math.random();
          if (rand < 0.20) { // 20% chance Iron
               oreType = 'Iron Ore'; stoneMat.color.set(0xF0A060); health = 35;
           } else if (rand < 0.35) { // 15% chance Copper
               oreType = 'Copper Ore'; stoneMat.color.set(0xb87333); health = 30;
           } else if (rand < 0.45) { // 10% chance Zinc
                oreType = 'Zinc Ore'; stoneMat.color.set(0xc0c0c0); health = 30;
           } // Else: 55% chance Stone

          const stone = new THREE.Mesh(stoneGeo, stoneMat);
          stone.position.set(position.x, position.y + size * 0.6, position.z); // Embed slightly
          stone.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          stone.castShadow = true;
          stone.userData = { resourceType: oreType, health: health, type: 'resource_node', isCollidable: true, isInteractable: true };

          this.scene.add(stone);
          this.objects.push(stone);
          this.collidableObjects.push(stone);
          this.interactableObjects.push(stone);
      }

      spawnFiber(position) {
           // Maybe use a small plane with texture later? For now, sphere.
           const fiberGeo = new THREE.SphereGeometry(0.2, 5, 4);
           const fiberMat = new THREE.MeshStandardMaterial({ color: 0x90EE90, roughness: 0.8 });
           const fiber = new THREE.Mesh(fiberGeo, fiberMat);
           fiber.position.set(position.x, position.y + 0.2, position.z);
           fiber.userData = { resourceType: 'Fiber', health: 1, type: 'resource_node', isCollidable: false, isInteractable: true };

           this.scene.add(fiber);
           this.objects.push(fiber);
           // Fiber not collidable
           this.interactableObjects.push(fiber);
      }

       spawnBlueberry(position) {
           // Placeholder: Small green sphere bush
           const bushGeo = new THREE.SphereGeometry(0.4, 6, 5);
           const bushMat = new THREE.MeshStandardMaterial({ color: 0x2E8B57 }); // SeaGreen
           const bush = new THREE.Mesh(bushGeo, bushMat);
           bush.position.set(position.x, position.y + 0.4, position.z);
           bush.castShadow = true;
           // Single hit deplete for now
           bush.userData = { resourceType: 'Blueberry', health: 1, type: 'resource_node', isCollidable: false, isInteractable: true };

           this.scene.add(bush);
           this.objects.push(bush);
           this.interactableObjects.push(bush);
      }


     spawnInitialAI() {
         const halfSize = this.worldSize / 2 * 0.9; // Spawn slightly away from edge
         const numPassive = 15;
         const numHostile = 8; // Increased hostile count

         const passiveTypes = ['chicken']; // Add 'rabbit', 'deer' later
         const hostileTypes = ['wolf', 'hunter']; // Add 'bear' later

         for (let i = 0; i < numPassive; i++) {
             const x = Utils.getRandomInt(-halfSize, halfSize);
             const z = Utils.getRandomInt(-halfSize, halfSize);
             // TODO: Raycast down to find ground Y
             const type = passiveTypes[Utils.getRandomInt(0, passiveTypes.length - 1)];
             const ai = createAI(this.game, type, new THREE.Vector3(x, 0, z)); // Pass 0 Y for now
             if(ai) this.aiEntities.push(ai);
         }

         for (let i = 0; i < numHostile; i++) {
             const x = Utils.getRandomInt(-halfSize, halfSize);
             const z = Utils.getRandomInt(-halfSize, halfSize);
             // TODO: Raycast down to find ground Y
             const type = hostileTypes[Utils.getRandomInt(0, hostileTypes.length - 1)];
             const ai = createAI(this.game, type, new THREE.Vector3(x, 0, z)); // Pass 0 Y for now
             if(ai) this.aiEntities.push(ai);
         }
          console.log(`Spawned ${this.aiEntities.length} AI entities.`);
     }

     // --- Object Management ---

     removeObject(objectToRemove) {
          if (!objectToRemove) return;

          // Remove associated objects (like tree leaves if removing trunk)
          if (objectToRemove.userData?.type === 'resource_node' && objectToRemove.userData?.resourceType === 'Wood') {
             // Find and remove corresponding leaves (this is inefficient, better to group them)
             const leavesToRemove = this.objects.find(obj =>
                 obj.userData?.type === 'decoration' &&
                 Math.abs(obj.position.x - objectToRemove.position.x) < 0.1 &&
                 Math.abs(obj.position.z - objectToRemove.position.z) < 0.1
             );
             if (leavesToRemove) {
                 this.removeObject(leavesToRemove); // Recursive call (careful!) or direct removal
             }
          }


          // Remove from scene
          if (objectToRemove.parent) {
            objectToRemove.parent.remove(objectToRemove);
          }

          // Dispose geometry and material to free GPU memory
          try {
              if (objectToRemove.geometry) {
                  objectToRemove.geometry.dispose();
              }
              if (objectToRemove.material) {
                  if (Array.isArray(objectToRemove.material)) {
                      objectToRemove.material.forEach(m => {
                          if (m.map) m.map.dispose();
                          // Dispose other textures...
                          m.dispose();
                      });
                  } else {
                      if (objectToRemove.material.map) objectToRemove.material.map.dispose();
                      // Dispose other textures...
                      objectToRemove.material.dispose();
                  }
              }
          } catch (error) {
              console.error("Error during resource disposal:", error, objectToRemove);
          }


          // Remove from internal lists using filter (creates new arrays)
          this.objects = this.objects.filter(obj => obj !== objectToRemove);
          this.collidableObjects = this.collidableObjects.filter(obj => obj !== objectToRemove);
          this.interactableObjects = this.interactableObjects.filter(obj => obj !== objectToRemove);
     }

      removeAI(aiController) {
         // Mesh removal and disposal should happen in aiController.die() or here
         // Let's assume die handles mesh removal after animation timer
         this.aiEntities = this.aiEntities.filter(ai => ai !== aiController);
         console.log(`Removed AI controller. Remaining AI: ${this.aiEntities.length}`);
     }


     // --- Getters for other systems ---
     getCollidableObjects() {
         // Combine static world colliders with dynamic ones (buildings, potentially large AI?)
          return [
            ...this.collidableObjects, // Ground, rocks, tree trunks
             ...this.game.buildingSystem.placedObjects.map(p => p.mesh).filter(mesh => !!mesh), // Add building meshes
             // Optionally add AI meshes if they should block other AI/player significantly
             // ...this.aiEntities.map(ai => ai.mesh).filter(mesh => !!mesh && mesh.userData?.isCollidable)
            ];
     }

     getInteractableObjects() {
         // Combine static interactables with dynamic ones (AI, buildings, loot)
          return [
            ...this.interactableObjects, // Harvest nodes
             ...this.aiEntities.map(ai => ai.mesh).filter(mesh => !!mesh && ai.health > 0), // Active AI are interactable (attack)
             ...this.game.buildingSystem.placedObjects
                 .filter(p => p.mesh && ITEMS[p.itemId]?.interactable) // Only interactable buildings (workbench, forge)
                 .map(p => p.mesh),
             ...this.objects.filter(o => o.userData?.type === 'loot_container') // Loot bags
             ];
     }

     update(deltaTime) {
         if (deltaTime > 0.1) deltaTime = 0.1; // Clamp delta time

          // Update all active AI - use a copy of the array in case AI dies and removes itself during iteration
         [...this.aiEntities].forEach(ai => {
             if (ai && ai.update) { // Check if ai and update method exist
                 try {
                    ai.update(deltaTime);
                 } catch (error) {
                     console.error("Error updating AI:", ai.mesh?.uuid, error);
                      // Optionally remove the broken AI?
                      // if (ai.mesh) this.removeObject(ai.mesh);
                      // this.removeAI(ai);
                 }
             }
         });

         // TODO: Update other world systems (weather, day/night cycle, resource respawning?)
     }

      createLootDrop(position, items) {
         // Simple placeholder: a small brown box 'bag'
          const lootBagGeo = new THREE.BoxGeometry(0.35, 0.25, 0.35);
          const lootBagMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown hex
          const lootBagMesh = new THREE.Mesh(lootBagGeo, lootBagMat);
          // Place slightly above the source position's Y
          lootBagMesh.position.copy(position);
          lootBagMesh.position.y = Math.max(position.y + 0.15, 0.15); // Ensure slightly above ground 0
          lootBagMesh.userData = {
              type: 'loot_container',
              items: items,
              isInteractable: true,
              isCollidable: false // Loot bags usually not collidable
          };

          this.scene.add(lootBagMesh);
          this.objects.push(lootBagMesh); // Track loot bag
          this.interactableObjects.push(lootBagMesh); // Make it interactable

          console.log("Created loot drop at", position.toArray().map(n=>n.toFixed(1)), "with", items.length, "item stacks");

           // Add despawn timer
           const despawnTime = 120000; // 2 minutes
           setTimeout(() => {
               if (lootBagMesh.parent) { // Check if still exists
                    console.log("Despawning loot bag:", lootBagMesh.uuid);
                    this.removeObject(lootBagMesh);
               }
           }, despawnTime);
      }

}
// js/building.js
const Building = {
    isPlacing: false, // Changed from isBuilding
    ghostObject: null,
    buildMaterialValid: null,
    buildMaterialInvalid: null,
    currentItemInfo: null, // { itemId: string, source: 'inventory' | 'quickbar', slotIndex?: number }
    gridSnapSize: 1.0,

    init: function() {
        this.buildMaterialValid = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        this.buildMaterialInvalid = new THREE.MeshBasicMaterial({ color: 0xFF0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        console.log("Building System Initialized (Placement Mode)");
    },

    // Called by UI when an item is selected for placement
    startPlacement: function(itemInfo) {
        const buildableData = CONSTANTS.BUILDABLES[itemInfo.itemId];
        if (!buildableData) {
            console.warn("Unknown buildable item selected for placement:", itemInfo.itemId);
            return;
        }

        // Check if player actually has the item (important!)
        if (Inventory.getItemCount(itemInfo.itemId) < 1) {
             Game.UIManager.logMessage(`You don't have any ${buildableData.name} to place.`);
             this.cancelPlacement(); // Ensure we exit any prior placement state
             return;
        }

        this.currentItemInfo = itemInfo;
        this.isPlacing = true;

        // Create ghost object
        if (this.ghostObject) Engine.scene.remove(this.ghostObject);
        this.ghostObject = new THREE.Mesh(buildableData.geometry.clone(), this.buildMaterialValid); // Use cloned geometry
        this.ghostObject.userData.isGhost = true;
        Engine.scene.add(this.ghostObject);

        Game.UIManager.logMessage(`Placing: ${buildableData.name}. Left click to place, Right click to cancel.`);
        console.log("Entered placement mode for:", itemInfo.itemId);

        // Ensure pointer lock is active for placement aiming
        if (!Input.isPointerLocked) {
            document.body.requestPointerLock();
        }
    },

    cancelPlacement: function() {
        this.clearGhostObject();
        this.isPlacing = false;
        const lastItemInfo = this.currentItemInfo; // Store before clearing
        this.currentItemInfo = null;
        Player.clearSelection(); // Tell player they are no longer selecting an item
        Game.UIManager.clearSelectionHighlights(); // Remove UI highlights

        // Only log cancellation if we were actually placing something meaningful
        if (lastItemInfo) {
            console.log("Exited placement mode");
            Game.UIManager.logMessage("Placement cancelled.");
        }
    },

    clearGhostObject: function() {
        if (this.ghostObject) {
            Engine.scene.remove(this.ghostObject);
            // Consider disposing geometry/material if performance becomes an issue
            // this.ghostObject.geometry.dispose();
        }
        this.ghostObject = null;
    },

    // Called by the main game loop (in main.js)
    updatePlacementGhost: function(camera, groundPlane) {
        if (!this.isPlacing || !this.ghostObject || !camera || !groundPlane) return;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, camera); // Center of screen

        // Raycast against ground AND potentially other placed building objects for vertical stacking
        const targets = [groundPlane, ...World.objects.filter(o => o.userData?.isBuilding)]; // Include ground and buildings
        const intersects = raycaster.intersectObjects(targets, false); // Don't recurse children

        if (intersects.length > 0) {
            const intersect = intersects[0];
            const intersectPoint = intersect.point;
            const targetObject = intersect.object;

            let placeX = Math.round(intersectPoint.x / this.gridSnapSize) * this.gridSnapSize;
            let placeY = intersectPoint.y;
            let placeZ = Math.round(intersectPoint.z / this.gridSnapSize) * this.gridSnapSize;

            const buildableData = CONSTANTS.BUILDABLES[this.currentItemInfo.itemId];
            let objectHeight = 0;
            if (buildableData && buildableData.geometry.parameters) {
                 objectHeight = buildableData.geometry.parameters.height || 0;
             } else if (buildableData && buildableData.geometry instanceof THREE.CylinderGeometry) {
                 objectHeight = buildableData.geometry.parameters.height || 0; // Cylinder also has height
             }

             // Adjust Y based on the target surface
             if (targetObject === groundPlane) {
                 placeY = intersectPoint.y + objectHeight / 2; // Place on ground
             } else if (targetObject.userData?.isBuilding) {
                 // Snap to top of existing building piece (approximate)
                 const targetBox = new THREE.Box3().setFromObject(targetObject);
                 placeY = targetBox.max.y + objectHeight / 2;
             } else {
                  // Default for unexpected targets (shouldn't happen with current filter)
                  placeY = intersectPoint.y + objectHeight / 2;
             }

            // --- Rotation Handling (Example: Use R key) ---
            if (Input.keys['r']) {
                this.ghostObject.rotation.y += Math.PI / 2; // Rotate 90 degrees
                 // Clamp rotation to prevent floating point issues with checks
                 this.ghostObject.rotation.y = Math.round(this.ghostObject.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
                Input.keys['r'] = false; // Consume key press
            }
            // --- End Rotation ---

            this.ghostObject.position.set(placeX, placeY, placeZ);
            const canPlace = this.checkPlacementValidity(this.ghostObject); // Pass ghost itself
            this.ghostObject.material = canPlace ? this.buildMaterialValid : this.buildMaterialInvalid;

        } else {
            // Optionally hide or move the ghost far away if not pointing at a valid target
             if(this.ghostObject) {
                 this.ghostObject.position.set(0,-1000,0); // Hide it
                 this.ghostObject.material = this.buildMaterialInvalid; // Mark as invalid when hidden
             }
        }
    },

     checkPlacementValidity: function(ghost) { // Pass the ghost object itself
         if (!ghost) return false;
         if(ghost.position.y < 0.01) return false; // Check if underground (adjust based on lowest buildable point)

         const ghostBox = new THREE.Box3().setFromObject(ghost);

         // Check against world objects (trees, rocks, other buildings)
         for(const obj of World.objects) {
              if(obj === ghost || obj.userData?.isGhost) continue; // Don't check self
              if(obj.geometry) { // Ensure object has geometry to calculate bounding box
                   const objBox = new THREE.Box3().setFromObject(obj);
                   if(ghostBox.intersectsBox(objBox)) {
                        // Optional: Allow minor overlap for snapping? Needs more complex logic.
                       // console.log("Collision with World Object:", obj.name);
                       return false;
                   }
              }
         }
          // Check against AI agents
          for(const agent of AI.agents) {
               if(agent.geometry) {
                   const agentBox = new THREE.Box3().setFromObject(agent);
                   if(ghostBox.intersectsBox(agentBox)) {
                        // console.log("Collision with AI:", agent.name);
                       return false;
                   }
               }
          }
         // Check against player (optional, prevent building inside player)
         // const playerBox = new THREE.Box3().setFromObject(Player.mesh);
         // if(ghostBox.intersectsBox(playerBox)) {
         //      // console.log("Collision with Player");
         //      return false;
         // }

         return true; // No collision found
     },

    // Called by Player.update when left-click occurs during placement
    placeSelectedItem: function() {
        if (!this.isPlacing || !this.currentItemInfo || !this.ghostObject) return;

        // Final validity check
        if (this.ghostObject.material === this.buildMaterialInvalid) {
            Game.UIManager.logMessage("Cannot place item here!");
            return;
        }

        // Consume one item from inventory/quickbar
        const consumed = Inventory.consumeItemForPlacement(this.currentItemInfo);

        if (consumed) {
            // Create the real object
            const buildableData = CONSTANTS.BUILDABLES[this.currentItemInfo.itemId];
             const placedMaterial = new THREE.MeshLambertMaterial({
                 color: (this.currentItemInfo.itemId === 'campfire' ? 0x404040 : 0xA0522D) // Example colors based on type
             });

            const placedObject = new THREE.Mesh(buildableData.geometry.clone(), placedMaterial);
            placedObject.position.copy(this.ghostObject.position);
            placedObject.rotation.copy(this.ghostObject.rotation); // Copy rotation
            placedObject.castShadow = true;
            placedObject.receiveShadow = true;
            placedObject.name = buildableData.name; // Use proper name
             placedObject.userData = {
                 isBuilding: true, // Mark as a constructed object
                 // Add health, owner etc. later
             };

            World.addWorldObject(placedObject, false, true); // Add to world as collider
            Game.UIManager.logMessage(`Placed ${buildableData.name}!`);
            console.log(`Placed ${buildableData.name} at`, placedObject.position);

            // Check if player ran out of this item
            if (Inventory.getItemCount(this.currentItemInfo.itemId) < 1) {
                Game.UIManager.logMessage(`No more ${buildableData.name} left.`);
                this.cancelPlacement(); // Automatically exit placement mode
            }
             // Otherwise, stay in placement mode to place the next one
        } else {
            // This should theoretically not happen if startPlacement checks correctly, but handle anyway
            Game.UIManager.logMessage(`Failed to place ${this.currentItemInfo.itemId} (Item not found?).`);
            this.cancelPlacement();
        }
    },

    // --- Called by UI buttons via UIManager.setupBuildMenuButtons ---
    craftBuildable: function(itemId) {
         const recipe = Crafting.recipes[itemId];
         const buildableData = CONSTANTS.BUILDABLES[itemId];
         const itemName = buildableData?.name || itemId;

         if (!recipe) {
             console.warn(`No recipe found to craft buildable: ${itemId}`);
             Game.UIManager.logMessage(`Cannot craft ${itemName}: No recipe.`);
             return;
         }
         if (!buildableData) {
             console.warn(`No buildable data found for item: ${itemId}`);
             // Still allow crafting if recipe exists, could be a component?
         }

         // Attempt to craft the item into inventory
         if (Crafting.attemptCraft(itemId)) {
             // attemptCraft already logs success/failure and updates inventory UI
         }
         // Optional: Close build menu after crafting attempt?
         // Game.UIManager.toggleBuildMenu();
     }
};

window.Building = Building;
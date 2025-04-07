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
             // Use the proper name from buildableData if available
             const itemName = buildableData.name || itemInfo.itemId;
             Game.UIManager.logMessage(`You don't have any ${itemName} to place.`);
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
            // if (this.ghostObject.geometry) this.ghostObject.geometry.dispose();
            // if (this.ghostObject.material) this.ghostObject.material.dispose();
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
            // Safely access geometry parameters
             if (buildableData && buildableData.geometry && buildableData.geometry.parameters) {
                 objectHeight = buildableData.geometry.parameters.height || 0;
             }

             // Adjust Y based on the target surface
             if (targetObject === groundPlane) {
                 placeY = intersectPoint.y + objectHeight / 2; // Place on ground
             } else if (targetObject.userData?.isBuilding) {
                 // Snap to top of existing building piece (approximate using bounding box)
                 const targetBox = new THREE.Box3().setFromObject(targetObject);
                 placeY = targetBox.max.y + objectHeight / 2;
             } else {
                  // Default for unexpected targets
                  placeY = intersectPoint.y + objectHeight / 2;
             }

            // --- Rotation Handling (Example: Use R key) ---
            if (Input.keys['r']) {
                this.ghostObject.rotation.y += Math.PI / 2; // Rotate 90 degrees
                 // Clamp rotation to prevent floating point issues with checks
                 // Use a small epsilon for comparison robustness
                 const piOverTwo = Math.PI / 2;
                 const epsilon = 0.001;
                 this.ghostObject.rotation.y = Math.round(this.ghostObject.rotation.y / piOverTwo) * piOverTwo;
                 // Wrap rotation around 2*PI if needed
                 if(this.ghostObject.rotation.y >= Math.PI * 2 - epsilon) this.ghostObject.rotation.y -= Math.PI * 2;
                 if(this.ghostObject.rotation.y < -epsilon) this.ghostObject.rotation.y += Math.PI * 2;

                Input.keys['r'] = false; // Consume key press
                // Force re-check of placement validity after rotation
                const canPlaceAfterRotate = this.checkPlacementValidity(this.ghostObject);
                this.ghostObject.material = canPlaceAfterRotate ? this.buildMaterialValid : this.buildMaterialInvalid;
            }
            // --- End Rotation ---

            this.ghostObject.position.set(placeX, placeY, placeZ);
             // Check validity unless we just rotated (already checked above)
             if (!Input.keys['r']) { // Avoid double-check if R was just pressed
                const canPlace = this.checkPlacementValidity(this.ghostObject);
                this.ghostObject.material = canPlace ? this.buildMaterialValid : this.buildMaterialInvalid;
             }

        } else {
            // Optionally hide or move the ghost far away if not pointing at a valid target
             if(this.ghostObject) {
                 this.ghostObject.position.set(0,-1000,0); // Hide it
                 this.ghostObject.material = this.buildMaterialInvalid; // Mark as invalid when hidden
             }
        }
    },

    // *** MODIFIED FUNCTION ***
    checkPlacementValidity: function(ghost) {
        if (!ghost || !ghost.geometry) return false; // Basic checks

        const ghostBoxCheck = new THREE.Box3().setFromObject(ghost);
        const ghostLowestY = ghostBoxCheck.min.y;
        // Allow slightly below 0 for ground placement tolerance if needed
        if(ghostLowestY < -0.05) { // Adjusted tolerance slightly
             // console.log("Placement failed: Ghost below ground");
             return false;
        }

        const ghostBox = new THREE.Box3().setFromObject(ghost); // Recalculate after potential position change
        // Ensure currentItemInfo exists before accessing itemId
        const ghostItemId = this.currentItemInfo ? this.currentItemInfo.itemId : null;
        if (!ghostItemId) return false; // Cannot check validity without knowing what item it is

        // Check against world objects (trees, rocks, other buildings)
        for(const obj of World.objects) {
             // Skip self or objects without geometry/bounding box calculation possible
             if(obj === ghost || !obj.geometry) continue;

             // It's safer to recalculate objBox each time in case objects move,
             // but for static world objects, calculating once might be faster if needed.
             const objBox = new THREE.Box3().setFromObject(obj);

             if(ghostBox.intersectsBox(objBox)) {
                   // --- APPROACH 1: COLLISION EXCEPTION ---
                   const targetItemName = obj.name; // Get the NAME set during placement

                   // Check if placing a 'wall' and hitting a 'Foundation'
                   if (ghostItemId === 'wall' && targetItemName === 'Foundation') {
                        // Check vertical alignment: Wall base should be near foundation top
                        const foundationTopY = objBox.max.y;
                        const wallBottomY = ghostBox.min.y;
                        const verticalTolerance = 0.15; // Allow slightly more overlap/gap tolerance

                        if (Math.abs(wallBottomY - foundationTopY) < verticalTolerance) {
                             // It's a wall likely snapping onto a foundation below it.
                             // Allow this specific intersection.
                             // Continue checking against OTHER objects.
                             console.log(`Collision check: Allowing Wall on Foundation (Y diff: ${Math.abs(wallBottomY - foundationTopY).toFixed(3)})`); // Debug log
                             continue; // Skip this collision check, proceed to next object
                        } else {
                             // Intersects foundation, but vertical alignment is wrong. Treat as collision.
                             console.log(`Collision with Foundation, wrong Y: WallBase=${wallBottomY.toFixed(2)}, FoundationTop=${foundationTopY.toFixed(2)}`);
                             return false;
                        }
                   }
                   // --- Add similar exceptions here for other pairings (e.g., wall on wall) ---
                   // Example:
                   // else if (ghostItemId === 'wall' && targetItemName === 'Wall') { ... check alignment ... continue; }
                   // else if (ghostItemId === 'ceiling' && targetItemName === 'Wall') { ... check alignment ... continue; }

                   // If it wasn't an allowed exception, it's a definite collision.
                   console.log(`Collision with World Object: ${targetItemName || 'Unnamed'}`);
                   return false; // Return false for any non-excepted intersection
             }
        }
         // Check against AI agents
         for(const agent of AI.agents) {
             if(!agent.geometry) continue; // Skip AI without geometry
             const agentBox = new THREE.Box3().setFromObject(agent);
             if(ghostBox.intersectsBox(agentBox)) {
                 console.log(`Collision with AI: ${agent.name}`);
                 return false;
             }
         }
         // Optional: Check against player
         // const playerBox = new THREE.Box3().setFromObject(Player.mesh);
         // if(ghostBox.intersectsBox(playerBox)) return false;

        return true; // No invalid collision found
    },


    // *** ENSURE NAME IS SET CORRECTLY HERE ***
    placeSelectedItem: function() {
        if (!this.isPlacing || !this.currentItemInfo || !this.ghostObject) return;

        // Final validity check (re-check just before placing)
        if (!this.checkPlacementValidity(this.ghostObject)) {
             Game.UIManager.logMessage("Cannot place item here!");
             // Make ghost red again if it turned green somehow between frames
             this.ghostObject.material = this.buildMaterialInvalid;
             return;
        }
         // Check material just in case checkPlacementValidity had a different result previously
         if (this.ghostObject.material === this.buildMaterialInvalid) {
              Game.UIManager.logMessage("Cannot place item here! (Material Invalid)");
              return;
         }


        // Consume one item from inventory/quickbar
        const consumed = Inventory.consumeItemForPlacement(this.currentItemInfo);

        if (consumed) {
            const buildableData = CONSTANTS.BUILDABLES[this.currentItemInfo.itemId];
             const placedMaterial = new THREE.MeshLambertMaterial({
                 color: (this.currentItemInfo.itemId === 'campfire' ? 0x404040 : 0xA0522D) // Example colors
             });

            const placedObject = new THREE.Mesh(buildableData.geometry.clone(), placedMaterial);
            placedObject.position.copy(this.ghostObject.position);
            placedObject.rotation.copy(this.ghostObject.rotation); // Copy rotation
            placedObject.castShadow = true;
            placedObject.receiveShadow = true;

            // *** Set the name based on buildableData.name for the collision check ***
            placedObject.name = buildableData.name; // e.g., "Foundation", "Wall", "Campfire"

            placedObject.userData = {
                 isBuilding: true, // Mark as a constructed object
                 buildId: this.currentItemInfo.itemId, // Store ID for potential future use
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
            // This might happen if the item was somehow removed between selection and click
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
         // Removed redundant buildableData check here, recipe check is primary

         // Attempt to craft the item into inventory
         if (Crafting.attemptCraft(itemId)) {
             // attemptCraft already logs success/failure and updates inventory UI
         }
         // Optional: Close build menu after crafting attempt?
         // Game.UIManager.toggleBuildMenu();
     }
};

window.Building = Building;
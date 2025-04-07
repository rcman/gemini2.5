// js/building.js
const Building = {
    isBuilding: false,
    ghostObject: null, // The transparent preview object
    buildMaterialValid: null,
    buildMaterialInvalid: null,
    currentBuildItem: null, // e.g., { id: 'foundation', cost: { wood: 10 }, size: [4, 0.2, 4] }
    gridSnapSize: 1.0, // Snap to 1-meter grid (adjust as needed)

    init: function() {
        this.buildMaterialValid = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        this.buildMaterialInvalid = new THREE.MeshBasicMaterial({ color: 0xFF0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        console.log("Building System Initialized");
    },

    enterBuildMode: function(itemId) {
         // Define buildable items data (could be moved to constants.js)
         const buildables = {
             'foundation': { cost: { wood: 4, stone: 2 }, geometry: new THREE.BoxGeometry(4, 0.2, 4) },
             'wall': { cost: { wood: 2 }, geometry: new THREE.BoxGeometry(4, 3, 0.2) },
             'campfire': { cost: { wood: 5, fiber: 2}, geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12)}
             // Add more items...
         };

        if (!buildables[itemId]) {
            console.warn("Unknown build item:", itemId);
            return;
        }
        const itemData = buildables[itemId];

        // Check if player has resources (optional preview check)
        // if (!Inventory.hasItems(itemData.cost)) {
        //     Game.UIManager.logMessage(`Not enough resources for ${itemId}`);
        //     return;
        // }

        this.isBuilding = true;
        this.currentBuildItem = { id: itemId, ...itemData }; // Store item details

        // Create ghost object
        if (this.ghostObject) Engine.scene.remove(this.ghostObject);
        this.ghostObject = new THREE.Mesh(itemData.geometry, this.buildMaterialValid); // Start with valid material
        this.ghostObject.userData.isGhost = true; // Mark as ghost
        Engine.scene.add(this.ghostObject);

        Game.UIManager.logMessage(`Building: ${itemId}. Left click to place, Right click to cancel.`);
        console.log("Entered build mode for:", itemId);
    },

    exitBuildMode: function() {
        if (this.ghostObject) {
            Engine.scene.remove(this.ghostObject);
            // Dispose geometry/material if created dynamically and not reused
            // this.ghostObject.geometry.dispose();
        }
        this.ghostObject = null;
        this.isBuilding = false;
        this.currentBuildItem = null;
        console.log("Exited build mode");
         Game.UIManager.logMessage("Exited build mode.");
    },

    update: function(camera, groundPlane) {
        if (!this.isBuilding || !this.ghostObject || !camera || !groundPlane) return;

        // Raycast from camera to find placement position on the ground
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, camera); // Center of screen

        const intersects = raycaster.intersectObject(groundPlane); // Intersect only with ground for now

        if (intersects.length > 0) {
            const intersectPoint = intersects[0].point;

            // Apply grid snapping
            let placeX = Math.round(intersectPoint.x / this.gridSnapSize) * this.gridSnapSize;
            let placeY = intersectPoint.y; // Use intersect Y, adjust based on object height later
            let placeZ = Math.round(intersectPoint.z / this.gridSnapSize) * this.gridSnapSize;

            // Adjust Y based on object's height to place it ON the ground/surface
             if (this.currentBuildItem.geometry.parameters) {
                  const height = this.currentBuildItem.geometry.parameters.height || 0;
                  placeY += height / 2; // Place center at height/2 above ground
             } else {
                 // Default for non-box geometries (like campfire cylinder)
                 placeY += 0.15; // Small offset for campfire
             }


            this.ghostObject.position.set(placeX, placeY, placeZ);

            // TODO: Add collision checks here
            // Check if ghostObject overlaps with other world objects (trees, rocks, other buildings)
            const canPlace = this.checkPlacementValidity(this.ghostObject.position);
            this.ghostObject.material = canPlace ? this.buildMaterialValid : this.buildMaterialInvalid;

        }

        // Handle Placement Input (Left Click)
        if (Input.mouse.left) {
            this.placeCurrentItem();
            Input.mouse.left = false; // Consume click
        }

         // Handle Cancellation (Right Click)
        if (Input.mouse.right) {
             this.exitBuildMode();
             Input.mouse.right = false; // Consume click
        }
    },

     checkPlacementValidity: function(position) {
         // TODO: Implement actual collision checks
         // For now, just assume it's valid if on the ground plane raycast hit
         if(this.ghostObject.position.y < 0.01) return false; // Don't place underground

         // Basic check against existing world objects (very inefficient - use spatial hashing later)
         const ghostBox = new THREE.Box3().setFromObject(this.ghostObject);
         for(const obj of World.objects) {
              if(obj === this.ghostObject || obj.userData?.isGhost) continue; // Don't collide with self or other ghosts
              const objBox = new THREE.Box3().setFromObject(obj);
              if(ghostBox.intersectsBox(objBox)) {
                  // console.log("Placement blocked by:", obj.name);
                  return false; // Collision detected
              }
         }
          for(const agent of AI.agents) { // Also check AI agents
              const agentBox = new THREE.Box3().setFromObject(agent);
              if(ghostBox.intersectsBox(agentBox)) {
                  // console.log("Placement blocked by AI:", agent.name);
                  return false;
              }
         }


         return true; // No collision found
     },

    placeCurrentItem: function() {
        if (!this.isBuilding || !this.currentBuildItem || !this.ghostObject) return;

        // Final check for validity and resources
        if (this.ghostObject.material === this.buildMaterialInvalid) {
            Game.UIManager.logMessage("Cannot place item here!");
            return;
        }
        if (!Inventory.hasItems(this.currentBuildItem.cost)) {
            Game.UIManager.logMessage(`Not enough resources for ${this.currentBuildItem.id}`);
             this.exitBuildMode(); // Exit build mode if out of resources
            return;
        }

        // Consume resources
        for (const itemId in this.currentBuildItem.cost) {
            Inventory.removeItem(itemId, this.currentBuildItem.cost[itemId]);
        }

        // Create the real object
        // Use a standard material for placed objects
        const placedMaterial = new THREE.MeshLambertMaterial({ color: 0xA0522D }); // Wood color for example
        if (this.currentBuildItem.id === 'campfire') {
             placedMaterial.color.setHex(0x404040); // Grey for campfire
        }
        // Clone geometry to avoid issues if the original is modified
        const placedObject = new THREE.Mesh(this.currentBuildItem.geometry.clone(), placedMaterial);
        placedObject.position.copy(this.ghostObject.position);
        placedObject.rotation.copy(this.ghostObject.rotation); // Copy rotation if implemented
        placedObject.castShadow = true;
        placedObject.receiveShadow = true;
        placedObject.name = this.currentBuildItem.id;
         placedObject.userData = {
             isBuilding: true,
             // Add health, interaction points etc. later
         };

        // Add to the world
        World.addWorldObject(placedObject, false, true); // Add as collider, not interactable by default

        Game.UIManager.logMessage(`Placed ${this.currentBuildItem.id}!`);
        console.log(`Placed ${this.currentBuildItem.id} at`, placedObject.position);

        // Continue building the same item? Or exit?
        // For now, let's stay in build mode for the same item.
        // this.exitBuildMode(); // Uncomment to exit after each placement
    },

     // Called from HTML button click
     placeItem: function(itemId) {
         this.enterBuildMode(itemId);
         // Optional: Hide the build menu UI after selection
         // document.getElementById('build-menu').style.display = 'none';
     }


};

window.Building = Building;
// js/building.js
class BuildingSystem {
    constructor(game) {
        this.game = game;
        this.isBuilding = false;
        this.currentItemId = null; // e.g., 'foundation', 'wall'
        this.ghostMesh = null; // Transparent preview mesh
        this.placementValid = false;
        this.gridSize = 2; // Example: Snap to 2x2 meter grid
        this.buildRotation = 0; // Rotation in degrees (0, 90, 180, 270)

        this.raycaster = new THREE.Raycaster();
        this.mouseVector = new THREE.Vector2();
        this.placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Helper plane for ground placement

         this.placedObjects = []; // Keep track of built objects in the world
    }

    toggleBuildMode() {
        if (this.isBuilding) {
            this.exitBuildMode();
        } else {
            // Enter build mode - usually triggered by UI selection first
            // this.enterBuildMode('foundation'); // Example: default to foundation
            console.log("Open Build Menu (B)"); // Let UI handle menu display
             this.game.uiManager.toggleBuildMenu();
        }
    }

    selectBuildItem(itemId) {
        if (!ITEMS[itemId] || ITEMS[itemId].type !== 'building_part' && ITEMS[itemId].type !== 'placeable') {
             console.warn("Cannot build item:", itemId);
             this.exitBuildMode(); // Exit if invalid item selected
             return;
        }

        // Check if player has the item in inventory
        if (!this.game.inventoryManager.has(itemId, 1)) {
             console.log("Need", ITEMS[itemId].name, "to build.");
             // Maybe show feedback in UI
             this.exitBuildMode();
             return;
        }


        this.isBuilding = true;
        this.currentItemId = itemId;
        this.createGhostMesh();
        this.game.uiManager.hideBuildMenu(); // Hide menu once item selected
        console.log("Entering build mode with:", itemId);
    }

    exitBuildMode() {
        this.isBuilding = false;
        this.currentItemId = null;
        if (this.ghostMesh) {
            this.game.scene.remove(this.ghostMesh);
            this.ghostMesh.geometry.dispose();
            this.ghostMesh.material.dispose();
            this.ghostMesh = null;
        }
        console.log("Exiting build mode");
    }

    createGhostMesh() {
        if (this.ghostMesh) {
            this.game.scene.remove(this.ghostMesh);
            // Dispose geometry/material if needed
        }

        const itemData = ITEMS[this.currentItemId];
        let geometry;
        // Use actual dimensions later
        switch (this.currentItemId) {
            case 'foundation':
                geometry = new THREE.BoxGeometry(this.gridSize, 0.2, this.gridSize);
                break;
            case 'wall':
            case 'wall_window':
                geometry = new THREE.BoxGeometry(this.gridSize, 2.5, 0.2); // Example dims
                break;
            case 'ceiling':
                 geometry = new THREE.BoxGeometry(this.gridSize, 0.2, this.gridSize);
                 break;
            case 'workbench':
            case 'forge':
                geometry = new THREE.BoxGeometry(1, 1, 1); // Placeholder cube
                break;
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
        }

        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Green for valid placement
            transparent: true,
            opacity: 0.5,
            depthWrite: false // Render ghost on top
        });
        this.ghostMesh = new THREE.Mesh(geometry, material);
        this.ghostMesh.visible = false; // Hide initially
        this.game.scene.add(this.ghostMesh);
    }

    update(camera, mouse) {
        if (!this.isBuilding || !this.ghostMesh) return;

        // 1. Raycast from camera using mouse position (normalized)
        this.mouseVector.x = (mouse.x / window.innerWidth) * 2 - 1;
        this.mouseVector.y = -(mouse.y / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouseVector, camera);

        // Intersect with the ground plane or existing build pieces
        // For simplicity, let's use the ground plane for now
        const intersectPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.placementPlane, intersectPoint)) {

            // 2. Snap to grid
            const snappedX = Math.round(intersectPoint.x / this.gridSize) * this.gridSize;
            // Adjust Y based on item type (foundation on ground, walls on foundations)
            let snappedY = 0; // Default ground level
            const snappedZ = Math.round(intersectPoint.z / this.gridSize) * this.gridSize;


            // TODO: More sophisticated placement logic
            // - Check if placing on a valid surface (e.g., wall on foundation)
            // - Check for collisions with other objects/terrain

            if (this.currentItemId === 'foundation' || ITEMS[this.currentItemId]?.type === 'placeable') {
                snappedY = 0.1; // Slightly above ground
            } else if (this.currentItemId === 'wall' || this.currentItemId === 'wall_window') {
                // Check if there's a foundation below
                 const foundationCheckPos = new THREE.Vector3(snappedX, -0.5, snappedZ); // Check slightly below target
                 const foundation = this.findNearestBuildingPart('foundation', foundationCheckPos, this.gridSize * 0.6);
                 if (foundation) {
                     snappedY = 0.1 + 2.5 / 2; // Foundation height + half wall height
                 } else {
                     this.placementValid = false; // Cannot place wall without foundation
                 }
            } else if (this.currentItemId === 'ceiling') {
                 // Check for supporting walls nearby? Or just place relative to foundation grid?
                 // For now, place relative to foundation grid height + wall height
                 const foundationCheckPos = new THREE.Vector3(snappedX, -0.5, snappedZ);
                 const foundation = this.findNearestBuildingPart('foundation', foundationCheckPos, this.gridSize * 0.6);
                 if(foundation) {
                    snappedY = 0.1 + 2.5; // Foundation height + full wall height
                 } else {
                     this.placementValid = false;
                 }
            }


            this.ghostMesh.position.set(snappedX, snappedY, snappedZ);

            // 3. Apply Rotation
            this.ghostMesh.rotation.y = THREE.MathUtils.degToRad(this.buildRotation);

            // 4. Check Placement Validity (collision, requirements met)
             if (snappedY > 0 || this.currentItemId === 'foundation' || ITEMS[this.currentItemId]?.type === 'placeable') { // Simple check if position seems valid (not below ground for walls etc.)
                  this.placementValid = !this.checkCollision(this.ghostMesh); // Check overlap
             }


            // Update ghost mesh color based on validity
            this.ghostMesh.material.color.set(this.placementValid ? 0x00ff00 : 0xff0000);
            this.ghostMesh.visible = true;

        } else {
            // Ray didn't hit the plane (pointing away?)
            this.ghostMesh.visible = false;
            this.placementValid = false;
        }
    }

    checkCollision(meshToCheck) {
        // Basic AABB collision check against other placed objects
        // More robust checking (OBB or physics engine) is better
        const checkBB = new THREE.Box3().setFromObject(meshToCheck);
        for (const placed of this.placedObjects) {
            const placedBB = new THREE.Box3().setFromObject(placed.mesh);
             if (checkBB.intersectsBox(placedBB)) {
                 // Allow minor overlap for snapping? Needs refinement.
                 // For now, any intersection is invalid.
                 // Exception: Walls *should* intersect foundations slightly. Add logic here.
                 if ( (ITEMS[this.currentItemId]?.type === 'building_part' && ITEMS[placed.itemId]?.type === 'building_part') ) {
                    // Special snapping overlap check needed here
                 } else {
                     return true; // Collision detected
                 }
            }
        }
        // TODO: Check collision with world objects (trees, rocks) if needed
        return false; // No collision
    }

     findNearestBuildingPart(type, position, maxDistance) {
         let nearest = null;
         let minDistSq = maxDistance * maxDistance;

         for(const placed of this.placedObjects) {
             if (placed.itemId === type) {
                 const distSq = placed.mesh.position.distanceToSquared(position);
                 if (distSq < minDistSq) {
                     minDistSq = distSq;
                     nearest = placed;
                 }
             }
         }
         return nearest;
     }

    rotate(direction) {
        if (!this.isBuilding) return;
        this.buildRotation += direction * 90; // Rotate by 90 degrees
        this.buildRotation %= 360; // Keep within 0-359
        if (this.buildRotation < 0) this.buildRotation += 360;
        console.log("Build Rotation:", this.buildRotation);
        // Update ghost mesh rotation immediately in the update loop
    }

    placeItem() {
        if (!this.isBuilding || !this.placementValid || !this.currentItemId) return;

        // 1. Check inventory again (important!)
        if (!this.game.inventoryManager.has(this.currentItemId, 1)) {
            console.log("Cannot place: Item missing from inventory!");
            this.exitBuildMode(); // Exit if item somehow disappeared
            return;
        }

        // 2. Consume item from inventory
        this.game.inventoryManager.remove(this.currentItemId, 1);

        // 3. Create the actual object in the world
        const itemData = ITEMS[this.currentItemId];
        const geometry = this.ghostMesh.geometry.clone(); // Use same geometry as ghost
        const material = new THREE.MeshStandardMaterial({
             color: 0xaaaaaa, // Use appropriate material/texture later
             map: null // TODO: Assign textures based on item type
            });
        // Assign different colors/materials for different build parts if desired
        if(this.currentItemId === 'foundation') material.color.set(0x8B4513); // Brownish
        else if(this.currentItemId === 'wall') material.color.set(0xA0522D); // Sienna
        else if(this.currentItemId === 'wall_window') material.color.set(0xB8860B); // DarkGoldenrod
        else if(this.currentItemId === 'ceiling') material.color.set(0xD2691E); // Chocolate


        const newBuildMesh = new THREE.Mesh(geometry, material);
        newBuildMesh.position.copy(this.ghostMesh.position);
        newBuildMesh.rotation.copy(this.ghostMesh.rotation);
        newBuildMesh.userData = { buildItemId: this.currentItemId, type: 'building' }; // Store item ID

        this.game.scene.add(newBuildMesh);
         this.placedObjects.push({ mesh: newBuildMesh, itemId: this.currentItemId }); // Track placed object

        console.log(`Placed ${this.currentItemId} at ${newBuildMesh.position.toArray().map(n => n.toFixed(1))}`);

        // 4. Continue building with the same item or exit?
        // For now, stay in build mode with the same item selected.
        // Re-check inventory for the next placement
         if (!this.game.inventoryManager.has(this.currentItemId, 1)) {
            console.log("Ran out of", itemData.name);
            this.exitBuildMode();
         } else {
             // Keep ghost visible but mark placement as invalid until mouse moves
             this.placementValid = false;
             this.ghostMesh.material.color.set(0xff0000);
         }
    }

    removeObject(intersectedObject) {
         if (intersectedObject && intersectedObject.userData.buildItemId) {
             const itemId = intersectedObject.userData.buildItemId;
             console.log("Attempting to remove:", itemId);

             // Find the tracked object
             const index = this.placedObjects.findIndex(obj => obj.mesh === intersectedObject);
             if (index > -1) {
                // 1. Remove from scene
                this.game.scene.remove(intersectedObject);
                // 2. Dispose geometry/material
                if (intersectedObject.geometry) intersectedObject.geometry.dispose();
                if (intersectedObject.material) {
                    if (Array.isArray(intersectedObject.material)) {
                        intersectedObject.material.forEach(m => m.dispose());
                    } else {
                        intersectedObject.material.dispose();
                    }
                }
                 // 3. Remove from tracked list
                 this.placedObjects.splice(index, 1);

                 // 4. Return resources to player (optional, based on game rules)
                 // Example: give back 50% of base materials
                 const itemData = ITEMS[itemId];
                 console.log(`Removed ${itemId}. TODO: Return materials.`);
                 // Find recipe for 'itemId' if it was crafted, or base item if placeable
                 this.game.inventoryManager.add(itemId, 1); // Simple: give back the placement item


                 return true; // Removal successful
             }
         }
         return false; // Not a removable build object
     }
}

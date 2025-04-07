// js/building.js
const Building = {
    isPlacing: false,
    ghostObject: null,
    buildMaterialValid: null,
    buildMaterialInvalid: null,
    currentItemInfo: null,
    gridSnapSize: 1.0, // Base grid snap, specific checks might override

    init: function() {
        this.buildMaterialValid = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        this.buildMaterialInvalid = new THREE.MeshBasicMaterial({ color: 0xFF0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        console.log("Building System Initialized (Placement Mode)");
    },

    startPlacement: function(itemInfo) {
        const buildableData = CONSTANTS.BUILDABLES[itemInfo.itemId];
        if (!buildableData) {
            console.warn("Unknown buildable item selected for placement:", itemInfo.itemId);
            return;
        }
        if (Inventory.getItemCount(itemInfo.itemId) < 1) {
             const itemName = buildableData.name || itemInfo.itemId;
             Game.UIManager.logMessage(`You don't have any ${itemName} to place.`);
             this.cancelPlacement();
             return;
        }

        this.currentItemInfo = itemInfo;
        this.isPlacing = true;

        if (this.ghostObject) Engine.scene.remove(this.ghostObject); // Remove previous ghost if any

        // Clone geometry for the ghost
        const ghostGeometry = buildableData.geometry.clone();
        this.ghostObject = new THREE.Mesh(ghostGeometry, this.buildMaterialValid);

        // Special handling for door ghost offset (to match placed door pivot)
        if(itemInfo.itemId === 'door') {
            const doorWidth = ghostGeometry.parameters?.width || 1.4; // Use parameters if BoxGeometry
            if (doorWidth) { // Only offset if width is known (e.g., BoxGeometry)
                 this.ghostObject.position.x += doorWidth / 2;
            } else {
                console.warn("Could not determine door width for ghost offset.");
            }
        }

        this.ghostObject.userData.isGhost = true;
        // Important: Reset rotation when starting placement for a new item type or instance
        this.ghostObject.rotation.set(0, 0, 0);
        Engine.scene.add(this.ghostObject); // Add ghost mesh to scene

        Game.UIManager.logMessage(`Placing: ${buildableData.name}. Left click to place, Right click to cancel. Wheel to rotate.`);
        console.log("Entered placement mode for:", itemInfo.itemId);

        if (!Input.isPointerLocked) {
            document.body.requestPointerLock();
        }
    },

    cancelPlacement: function() {
        this.clearGhostObject();
        this.isPlacing = false;
        const lastItemInfo = this.currentItemInfo;
        this.currentItemInfo = null;
        Player.clearSelection(); // Ensure player selection state is also cleared
        Game.UIManager.clearSelectionHighlights(); // Clear UI highlights

        if (lastItemInfo) {
            console.log("Exited placement mode");
            Game.UIManager.logMessage("Placement cancelled.");
        }
    },

    clearGhostObject: function() {
        if (this.ghostObject) {
            if (this.ghostObject.parent) this.ghostObject.parent.remove(this.ghostObject);
            Engine.scene.remove(this.ghostObject);
             if (this.ghostObject.geometry) this.ghostObject.geometry.dispose();
             // Dispose shared materials carefully or don't dispose them here
             // if (this.ghostObject.material) this.ghostObject.material.dispose();
        }
        this.ghostObject = null;
    },

    updatePlacementGhost: function(camera, groundPlane) {
        if (!this.isPlacing || !this.ghostObject || !camera || !groundPlane) return;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);

        // Include ground and existing buildables as potential targets
        const targets = [groundPlane, ...World.objects.filter(o => o.userData?.isBuilding && !o.userData?.isGhost)];
        const intersects = raycaster.intersectObjects(targets, false);

        let placementIsValid = false; // Track validity
        let ghostBasePosition = this.ghostObject.position; // Use current position as default

        let pivotPosition = new THREE.Vector3(); // Position where the item/pivot would be placed
        let pivotRotation = new THREE.Euler(0, this.ghostObject.rotation.y, 0, 'YXZ'); // Keep track of target rotation


        if (intersects.length > 0) {
            const intersect = intersects[0];
            const intersectPoint = intersect.point;
            const targetObject = intersect.object;

            // Apply grid snapping to the intersect point
            // Snapping should be relative to the world origin or a defined grid
            let placeX = Math.round(intersectPoint.x / this.gridSnapSize) * this.gridSnapSize;
            let placeY = intersectPoint.y;
            let placeZ = Math.round(intersectPoint.z / this.gridSnapSize) * this.gridSnapSize;

            const buildableData = CONSTANTS.BUILDABLES[this.currentItemInfo.itemId];
            let objectHeight = 0;
            // Get height more reliably using Box3
             if (buildableData && buildableData.geometry) {
                 const tempBox = new THREE.Box3().setFromObject(new THREE.Mesh(buildableData.geometry)); // Temp mesh to get size
                 objectHeight = tempBox.max.y - tempBox.min.y;
             }

             // Adjust Y based on the target surface
             if (targetObject === groundPlane) {
                 placeY = intersectPoint.y + objectHeight / 2; // Place object center relative to intersection point
             } else if (targetObject.userData?.isBuilding) {
                 // When placing on another building piece, use its top surface
                 targetObject.updateMatrixWorld(true); // Ensure target matrix is updated before getting box
                 const targetBox = new THREE.Box3().setFromObject(targetObject);
                 placeY = targetBox.max.y + objectHeight / 2; // Place object center relative to target top
             } else {
                 // Fallback, should ideally hit ground or building
                 placeY = intersectPoint.y + objectHeight / 2;
             }

            // Calculated center point for the object/pivot
            pivotPosition.set(placeX, placeY, placeZ);


            // --- Rotation Handling with Mouse Wheel ---
            if (Input.mouse.wheelDelta !== 0) {
                const rotationDirection = Input.mouse.wheelDelta;
                const angleIncrement = Math.PI / 2; // 90 degrees
                pivotRotation.y += rotationDirection * angleIncrement;
                const piOverTwo = Math.PI / 2;
                pivotRotation.y = Math.round(pivotRotation.y / piOverTwo) * piOverTwo;
                const twoPi = Math.PI * 2;
                pivotRotation.y = ((pivotRotation.y % twoPi) + twoPi) % twoPi;

                this.ghostObject.rotation.y = pivotRotation.y; // Update ghost's actual rotation immediately
            }
            // --- End Rotation Handling ---

            // Set the base/pivot position and rotation for the ghost object
            // For doors, the mesh might have a local offset, but the pivot (ghostObject's position) is placed at pivotPosition.
            this.ghostObject.position.copy(pivotPosition);
            this.ghostObject.rotation.copy(pivotRotation); // Apply the calculated rotation

            // Force update matrix for accurate validity check using the ghost's new transform
            this.ghostObject.updateMatrixWorld(true);

            // Check placement validity *after* position and rotation are determined
            placementIsValid = this.checkPlacementValidity(this.ghostObject);

        } else {
            // Hide ghost and mark as invalid if not pointing at a valid target
            this.ghostObject.position.set(0,-1000,0); // Move far away
            placementIsValid = false;
        }

        // Update ghost material based on final validity for the frame
        this.ghostObject.material = placementIsValid ? this.buildMaterialValid : this.buildMaterialInvalid;
    },


    // *** UPDATED FUNCTION with Perpendicular Wall Snapping ***
    checkPlacementValidity: function(ghost) {
        if (!ghost || !ghost.geometry) return false;

        ghost.updateMatrixWorld(true);
        const ghostBox = new THREE.Box3().setFromObject(ghost);

        const ghostLowestY = ghostBox.min.y;
        if (ghostLowestY < -0.01) { return false; }

        const ghostItemId = this.currentItemInfo ? this.currentItemInfo.itemId : null;
        if (!ghostItemId) return false;

        const ghostCenter = new THREE.Vector3();
        ghostBox.getCenter(ghostCenter);

        // Tolerances (keep the slightly increased ones)
        const generalVerticalTolerance = 0.1;
        const generalHorizontalTolerance = 0.15; // Used for parallel/foundation snapping
        const cornerTolerance = 0.2; // Tolerance for corner alignment (dx/dz matching half-width)

        const wallTypes = ['wall', 'wall_doorway', 'wall_window'];
        const isGhostWall = wallTypes.includes(ghostItemId);
        const foundationSize = 4;
        const wallWidth = 4;
        const halfWallWidth = wallWidth / 2; // For corner checks

        for (const obj of World.objects) {
            if (obj === ghost || obj.userData?.isGhost || !obj.geometry || obj.userData?.isPartOfDoor) continue;

            let objBox;
            let targetItemName = obj.name;
            let targetItemId = obj.userData?.buildId;

            if (obj.type === 'Group' && obj.userData?.isDoorPivot) {
                 objBox = new THREE.Box3();
                 obj.traverse((child) => {
                     if (child.isMesh) {
                         child.updateMatrixWorld(true);
                         objBox.expandByObject(child);
                     }
                 });
                 targetItemName = obj.name;
                 targetItemId = obj.userData?.buildId;
            } else {
                 obj.updateMatrixWorld(true);
                 objBox = new THREE.Box3().setFromObject(obj);
            }

            if (ghostBox.intersectsBox(objBox)) {

                const targetCenter = new THREE.Vector3();
                objBox.getCenter(targetCenter);
                const isTargetWall = targetItemId && wallTypes.includes(targetItemId);
                const isTargetFoundation = targetItemId === 'foundation';

                // Rotation helper functions (updated slightly for robustness)
                const pi2 = Math.PI * 2;
                const normalizeAngle = (angle) => ((angle % pi2) + pi2) % pi2; // Normalize to 0 - 2PI
                const approxEquals = (a, b, tolerance = 0.1) => Math.abs(normalizeAngle(a) - normalizeAngle(b)) < tolerance || Math.abs(normalizeAngle(a) - normalizeAngle(b) - pi2) < tolerance || Math.abs(normalizeAngle(a) - normalizeAngle(b) + pi2) < tolerance;

                const approxZero = (angle) => approxEquals(angle, 0);
                const approxPi = (angle) => approxEquals(angle, Math.PI);
                const approxPiOverTwo = (angle) => approxEquals(angle, Math.PI / 2);
                const approxThreePiOverTwo = (angle) => approxEquals(angle, 3 * Math.PI / 2);


                // --- COLLISION EXCEPTIONS ---

                // 1. Wall on Foundation (Keep as before)
                if (isGhostWall && isTargetFoundation) {
                    const foundationTopY = objBox.max.y;
                    const wallBottomY = ghostBox.min.y;
                    if (Math.abs(wallBottomY - foundationTopY) < generalVerticalTolerance) {
                        if (ghostCenter.x >= objBox.min.x - generalHorizontalTolerance && ghostCenter.x <= objBox.max.x + generalHorizontalTolerance &&
                            ghostCenter.z >= objBox.min.z - generalHorizontalTolerance && ghostCenter.z <= objBox.max.z + generalHorizontalTolerance)
                        { continue; } else { /*console.log("W-F Horiz Fail");*/ return false; }
                    } else { /*console.log("W-F Vert Fail");*/ return false; }
                }

                // 2. Foundation next to Foundation (Keep as before)
                else if (ghostItemId === 'foundation' && isTargetFoundation) {
                   if (Math.abs(ghostCenter.y - targetCenter.y) < generalVerticalTolerance) {
                       const dx = Math.abs(ghostCenter.x - targetCenter.x);
                       const dz = Math.abs(ghostCenter.z - targetCenter.z);
                       const alignedX = Math.abs(dx - foundationSize) < generalHorizontalTolerance && dz < generalHorizontalTolerance;
                       const alignedZ = Math.abs(dz - foundationSize) < generalHorizontalTolerance && dx < generalHorizontalTolerance;
                       if (alignedX || alignedZ) { continue; } else { /*console.log("F-F Horiz Fail");*/ return false; }
                   } else { /*console.log("F-F Vert Fail");*/ return false; }
                }

                // --- MODIFIED: 3. Wall next to Wall (Allow Parallel & Perpendicular) ---
                else if (isGhostWall && isTargetWall) {
                     // A. Vertical Alignment Check (Must always align vertically)
                     if (Math.abs(ghostBox.min.y - objBox.min.y) >= generalVerticalTolerance) {
                         // console.log("Wall-Wall Fail: Vertical mismatch.");
                         return false;
                     }

                     const dx = Math.abs(ghostCenter.x - targetCenter.x);
                     const dz = Math.abs(ghostCenter.z - targetCenter.z);
                     const ghostRotY = ghost.rotation.y;
                     const targetRotY = obj.rotation.y;

                     // B. Check Parallel Alignment
                     let isParallelMatch = false;
                     if (approxZero(ghostRotY - targetRotY) || approxPi(ghostRotY - targetRotY)) {
                         // Check horizontal distance for parallel walls
                         const alignedX = Math.abs(dx - wallWidth) < generalHorizontalTolerance && dz < generalHorizontalTolerance;
                         const alignedZ = Math.abs(dz - wallWidth) < generalHorizontalTolerance && dx < generalHorizontalTolerance;
                         if (alignedX || alignedZ) {
                             isParallelMatch = true;
                             // console.log("Wall-Wall Snap: Parallel");
                         }
                     }

                     // C. Check Perpendicular Alignment (Corner)
                     let isPerpendicularMatch = false;
                     // Check only if not already parallel, check for 90 or 270 deg difference
                     if (!isParallelMatch && (approxPiOverTwo(ghostRotY - targetRotY) || approxThreePiOverTwo(ghostRotY - targetRotY))) {
                         // Check horizontal distance for corner walls (dx and dz approx halfWallWidth)
                         if (Math.abs(dx - halfWallWidth) < cornerTolerance && Math.abs(dz - halfWallWidth) < cornerTolerance) {
                             isPerpendicularMatch = true;
                            // console.log("Wall-Wall Snap: Perpendicular (Corner)");
                         }
                     }

                     // D. Allow Placement if EITHER Parallel or Perpendicular match
                     if (isParallelMatch || isPerpendicularMatch) {
                         continue; // Valid adjacent wall placement (either parallel or corner)
                     } else {
                         // console.log(`Wall-Wall Fail: No valid snap. dx:${dx.toFixed(2)}, dz:${dz.toFixed(2)}, rotDiff:${normalizeAngle(ghostRotY - targetRotY).toFixed(2)}`);
                         return false; // Neither parallel nor perpendicular snap conditions met
                     }
                }
                // --- END MODIFIED WALL-WALL CHECK ---

                // 4. Door aligning with Doorway Wall (Keep as before, using general tolerances)
                else if (ghostItemId === 'door' && targetItemId === 'wall_doorway') {
                     const doorBottomY = ghostBox.min.y;
                     const wallBottomY = objBox.min.y;
                     if (Math.abs(doorBottomY - wallBottomY) > generalVerticalTolerance) { return false; }

                     const wallRotationY = obj.rotation.y;
                     let centersAlignedHorizontally = false;
                     if (approxZero(wallRotationY) || approxPi(wallRotationY)) {
                        centersAlignedHorizontally = Math.abs(ghostCenter.z - targetCenter.z) < generalHorizontalTolerance;
                     } else if (approxPiOverTwo(wallRotationY) || approxThreePiOverTwo(wallRotationY)) {
                        centersAlignedHorizontally = Math.abs(ghostCenter.x - targetCenter.x) < generalHorizontalTolerance;
                     }
                     if (!centersAlignedHorizontally) { return false; }

                     const rotationDiff = ghost.rotation.y - wallRotationY;
                     if (!(approxZero(rotationDiff) || approxPi(rotationDiff))) { return false; }
                     continue;
                }

                // --- DEFAULT COLLISION ---
                // console.log(`Overlap detected and no snapping rule applied between ${ghostItemId} and ${targetItemId || 'Unknown'}`);
                return false; // Intersecting and no exception matched
            }
        } // End loop through world objects

        // Check against AI agents (Keep as before)
        for (const agent of AI.agents) {
             if (!agent.geometry) continue;
             agent.updateMatrixWorld(true);
             const agentBox = new THREE.Box3().setFromObject(agent);
             if (ghostBox.intersectsBox(agentBox)) { return false; }
         }

        return true; // No invalid collision found
    },

    // placeSelectedItem and craftBuildable remain the same as the last complete version
    placeSelectedItem: function() {
        if (!this.isPlacing || !this.currentItemInfo || !this.ghostObject) return;

        if (!this.checkPlacementValidity(this.ghostObject)) {
             Game.UIManager.logMessage("Cannot place item here!");
             if(this.ghostObject) this.ghostObject.material = this.buildMaterialInvalid;
             return;
        }
         if (this.ghostObject.material === this.buildMaterialInvalid) {
              Game.UIManager.logMessage("Cannot place item here! (Material Invalid)");
              return;
         }

        const consumed = Inventory.consumeItemForPlacement(this.currentItemInfo);

        if (consumed) {
            const buildableData = CONSTANTS.BUILDABLES[this.currentItemInfo.itemId];
            const itemId = this.currentItemInfo.itemId;

            let itemColor;
            switch (itemId) {
                 case 'campfire': itemColor = 0x404040; break;
                 case 'crafting_table': itemColor = 0x966F33; break;
                 case 'forge': itemColor = 0x606060; break;
                 case 'wall_window': itemColor = 0xB8860B; break;
                 case 'wall_doorway': itemColor = 0xCD853F; break;
                 case 'door': itemColor = 0x8B4513; break;
                 default: itemColor = 0xA0522D;
            }
            const placedMaterial = new THREE.MeshLambertMaterial({ color: itemColor });

            let objectToAdd;

            if (itemId === 'door') {
                const pivotGroup = new THREE.Group();
                pivotGroup.position.copy(this.ghostObject.position);
                pivotGroup.rotation.copy(this.ghostObject.rotation);

                const doorMesh = new THREE.Mesh(buildableData.geometry.clone(), placedMaterial);
                doorMesh.castShadow = true;
                doorMesh.receiveShadow = true;
                doorMesh.name = buildableData.name;
                doorMesh.userData.isPartOfDoor = true;

                 const doorWidth = doorMesh.geometry.parameters?.width || 1.4;
                 if (doorWidth) {
                     doorMesh.position.x += doorWidth / 2;
                 } else {
                     console.error("Could not get door width to apply placement offset!");
                 }

                pivotGroup.add(doorMesh);

                pivotGroup.name = buildableData.name + " Pivot";
                pivotGroup.userData = {
                    isBuilding: true, buildId: itemId, interactable: true,
                    prompt: `[E] Open/Close Door`, isOpen: false,
                    originalYRotation: pivotGroup.rotation.y,
                    onInteract: (group) => {
                        const openAngle = -Math.PI / 2 * 0.95;
                        if (group.userData.isOpen) {
                            group.rotation.y = group.userData.originalYRotation;
                            group.userData.isOpen = false; Game.UIManager.logMessage("Door Closed");
                        } else {
                            group.rotation.y = group.userData.originalYRotation + openAngle;
                            group.userData.isOpen = true; Game.UIManager.logMessage("Door Opened");
                        }
                    }
                };
                pivotGroup.userData.isDoorPivot = true;
                objectToAdd = pivotGroup;
            } else {
                const placedObject = new THREE.Mesh(buildableData.geometry.clone(), placedMaterial);
                placedObject.position.copy(this.ghostObject.position);
                placedObject.rotation.copy(this.ghostObject.rotation);
                placedObject.castShadow = true;
                placedObject.receiveShadow = true;
                placedObject.name = buildableData.name;
                placedObject.userData = { isBuilding: true, buildId: itemId, interactable: false };

                const isInteractableStation = ['crafting_table', 'forge'].includes(itemId);
                if (isInteractableStation) {
                    placedObject.userData.interactable = true;
                    placedObject.userData.prompt = `[E] Use ${buildableData.name}`;
                    placedObject.userData.onInteract = (object) => {
                         console.log(`Interacting with ${object.userData.buildId}`);
                         Game.UIManager.logMessage(`Used ${object.name}`);
                         // TODO: UIManager.openCraftingStationUI(object.userData.buildId);
                    };
                }
                objectToAdd = placedObject;
            }

            World.addWorldObject(objectToAdd, objectToAdd.userData.interactable, true);
            Game.UIManager.logMessage(`Placed ${buildableData.name}!`);
            console.log(`Placed ${buildableData.name} at`, objectToAdd.position);

            if (Inventory.getItemCount(itemId) < 1) {
                Game.UIManager.logMessage(`No more ${buildableData.name} left.`);
                this.cancelPlacement();
            }
        } else {
            Game.UIManager.logMessage(`Failed to place ${this.currentItemInfo.itemId} (Item not found?).`);
            this.cancelPlacement();
        }
    },

    craftBuildable: function(itemId) {
         const recipe = Crafting.recipes[itemId];
         const buildableData = CONSTANTS.BUILDABLES[itemId];
         const itemName = buildableData?.name || itemId;
         if (!recipe) {
             console.warn(`No recipe found to craft buildable: ${itemId}`);
             Game.UIManager.logMessage(`Cannot craft ${itemName}: No recipe.`);
             return;
         }
         Crafting.attemptCraft(itemId);
    }

}; // End of Building object

window.Building = Building;// js/building.js
const Building = {
    isPlacing: false,
    ghostObject: null,
    buildMaterialValid: null,
    buildMaterialInvalid: null,
    currentItemInfo: null,
    gridSnapSize: 1.0, // Base grid snap, specific checks might override

    init: function() {
        this.buildMaterialValid = new THREE.MeshBasicMaterial({ color: 0x00FF00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        this.buildMaterialInvalid = new THREE.MeshBasicMaterial({ color: 0xFF0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        console.log("Building System Initialized (Placement Mode)");
    },

    startPlacement: function(itemInfo) {
        const buildableData = CONSTANTS.BUILDABLES[itemInfo.itemId];
        if (!buildableData) {
            console.warn("Unknown buildable item selected for placement:", itemInfo.itemId);
            return;
        }
        if (Inventory.getItemCount(itemInfo.itemId) < 1) {
             const itemName = buildableData.name || itemInfo.itemId;
             Game.UIManager.logMessage(`You don't have any ${itemName} to place.`);
             this.cancelPlacement();
             return;
        }

        this.currentItemInfo = itemInfo;
        this.isPlacing = true;

        if (this.ghostObject) Engine.scene.remove(this.ghostObject); // Remove previous ghost if any

        // Clone geometry for the ghost
        const ghostGeometry = buildableData.geometry.clone();
        this.ghostObject = new THREE.Mesh(ghostGeometry, this.buildMaterialValid);

        // Special handling for door ghost offset (to match placed door pivot)
        if(itemInfo.itemId === 'door') {
            const doorWidth = ghostGeometry.parameters?.width || 1.4; // Use parameters if BoxGeometry
            if (doorWidth) { // Only offset if width is known (e.g., BoxGeometry)
                 this.ghostObject.position.x += doorWidth / 2;
            } else {
                console.warn("Could not determine door width for ghost offset.");
            }
        }

        this.ghostObject.userData.isGhost = true;
        // Important: Reset rotation when starting placement for a new item type or instance
        this.ghostObject.rotation.set(0, 0, 0);
        Engine.scene.add(this.ghostObject); // Add ghost mesh to scene

        Game.UIManager.logMessage(`Placing: ${buildableData.name}. Left click to place, Right click to cancel. Wheel to rotate.`);
        console.log("Entered placement mode for:", itemInfo.itemId);

        if (!Input.isPointerLocked) {
            document.body.requestPointerLock();
        }
    },

    cancelPlacement: function() {
        this.clearGhostObject();
        this.isPlacing = false;
        const lastItemInfo = this.currentItemInfo;
        this.currentItemInfo = null;
        Player.clearSelection(); // Ensure player selection state is also cleared
        Game.UIManager.clearSelectionHighlights(); // Clear UI highlights

        if (lastItemInfo) {
            console.log("Exited placement mode");
            Game.UIManager.logMessage("Placement cancelled.");
        }
    },

    clearGhostObject: function() {
        if (this.ghostObject) {
            if (this.ghostObject.parent) this.ghostObject.parent.remove(this.ghostObject);
            Engine.scene.remove(this.ghostObject);
             if (this.ghostObject.geometry) this.ghostObject.geometry.dispose();
             // Dispose shared materials carefully or don't dispose them here
             // if (this.ghostObject.material) this.ghostObject.material.dispose();
        }
        this.ghostObject = null;
    },

    updatePlacementGhost: function(camera, groundPlane) {
        if (!this.isPlacing || !this.ghostObject || !camera || !groundPlane) return;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x: 0, y: 0 }, camera);

        // Include ground and existing buildables as potential targets
        const targets = [groundPlane, ...World.objects.filter(o => o.userData?.isBuilding && !o.userData?.isGhost)];
        const intersects = raycaster.intersectObjects(targets, false);

        let placementIsValid = false; // Track validity
        let ghostBasePosition = this.ghostObject.position; // Use current position as default

        let pivotPosition = new THREE.Vector3(); // Position where the item/pivot would be placed
        let pivotRotation = new THREE.Euler(0, this.ghostObject.rotation.y, 0, 'YXZ'); // Keep track of target rotation


        if (intersects.length > 0) {
            const intersect = intersects[0];
            const intersectPoint = intersect.point;
            const targetObject = intersect.object;

            // Apply grid snapping to the intersect point
            // Snapping should be relative to the world origin or a defined grid
            let placeX = Math.round(intersectPoint.x / this.gridSnapSize) * this.gridSnapSize;
            let placeY = intersectPoint.y;
            let placeZ = Math.round(intersectPoint.z / this.gridSnapSize) * this.gridSnapSize;

            const buildableData = CONSTANTS.BUILDABLES[this.currentItemInfo.itemId];
            let objectHeight = 0;
            // Get height more reliably using Box3
             if (buildableData && buildableData.geometry) {
                 const tempBox = new THREE.Box3().setFromObject(new THREE.Mesh(buildableData.geometry)); // Temp mesh to get size
                 objectHeight = tempBox.max.y - tempBox.min.y;
             }

             // Adjust Y based on the target surface
             if (targetObject === groundPlane) {
                 placeY = intersectPoint.y + objectHeight / 2; // Place object center relative to intersection point
             } else if (targetObject.userData?.isBuilding) {
                 // When placing on another building piece, use its top surface
                 targetObject.updateMatrixWorld(true); // Ensure target matrix is updated before getting box
                 const targetBox = new THREE.Box3().setFromObject(targetObject);
                 placeY = targetBox.max.y + objectHeight / 2; // Place object center relative to target top
             } else {
                 // Fallback, should ideally hit ground or building
                 placeY = intersectPoint.y + objectHeight / 2;
             }

            // Calculated center point for the object/pivot
            pivotPosition.set(placeX, placeY, placeZ);


            // --- Rotation Handling with Mouse Wheel ---
            if (Input.mouse.wheelDelta !== 0) {
                const rotationDirection = Input.mouse.wheelDelta;
                const angleIncrement = Math.PI / 2; // 90 degrees
                pivotRotation.y += rotationDirection * angleIncrement;
                const piOverTwo = Math.PI / 2;
                pivotRotation.y = Math.round(pivotRotation.y / piOverTwo) * piOverTwo;
                const twoPi = Math.PI * 2;
                pivotRotation.y = ((pivotRotation.y % twoPi) + twoPi) % twoPi;

                this.ghostObject.rotation.y = pivotRotation.y; // Update ghost's actual rotation immediately
            }
            // --- End Rotation Handling ---

            // Set the base/pivot position and rotation for the ghost object
            // For doors, the mesh might have a local offset, but the pivot (ghostObject's position) is placed at pivotPosition.
            this.ghostObject.position.copy(pivotPosition);
            this.ghostObject.rotation.copy(pivotRotation); // Apply the calculated rotation

            // Force update matrix for accurate validity check using the ghost's new transform
            this.ghostObject.updateMatrixWorld(true);

            // Check placement validity *after* position and rotation are determined
            placementIsValid = this.checkPlacementValidity(this.ghostObject);

        } else {
            // Hide ghost and mark as invalid if not pointing at a valid target
            this.ghostObject.position.set(0,-1000,0); // Move far away
            placementIsValid = false;
        }

        // Update ghost material based on final validity for the frame
        this.ghostObject.material = placementIsValid ? this.buildMaterialValid : this.buildMaterialInvalid;
    },


    // *** UPDATED FUNCTION with Perpendicular Wall Snapping ***
    checkPlacementValidity: function(ghost) {
        if (!ghost || !ghost.geometry) return false;

        ghost.updateMatrixWorld(true);
        const ghostBox = new THREE.Box3().setFromObject(ghost);

        const ghostLowestY = ghostBox.min.y;
        if (ghostLowestY < -0.01) { return false; }

        const ghostItemId = this.currentItemInfo ? this.currentItemInfo.itemId : null;
        if (!ghostItemId) return false;

        const ghostCenter = new THREE.Vector3();
        ghostBox.getCenter(ghostCenter);

        // Tolerances (keep the slightly increased ones)
        const generalVerticalTolerance = 0.1;
        const generalHorizontalTolerance = 0.15; // Used for parallel/foundation snapping
        const cornerTolerance = 0.2; // Tolerance for corner alignment (dx/dz matching half-width)

        const wallTypes = ['wall', 'wall_doorway', 'wall_window'];
        const isGhostWall = wallTypes.includes(ghostItemId);
        const foundationSize = 4;
        const wallWidth = 4;
        const halfWallWidth = wallWidth / 2; // For corner checks

        for (const obj of World.objects) {
            if (obj === ghost || obj.userData?.isGhost || !obj.geometry || obj.userData?.isPartOfDoor) continue;

            let objBox;
            let targetItemName = obj.name;
            let targetItemId = obj.userData?.buildId;

            if (obj.type === 'Group' && obj.userData?.isDoorPivot) {
                 objBox = new THREE.Box3();
                 obj.traverse((child) => {
                     if (child.isMesh) {
                         child.updateMatrixWorld(true);
                         objBox.expandByObject(child);
                     }
                 });
                 targetItemName = obj.name;
                 targetItemId = obj.userData?.buildId;
            } else {
                 obj.updateMatrixWorld(true);
                 objBox = new THREE.Box3().setFromObject(obj);
            }

            if (ghostBox.intersectsBox(objBox)) {

                const targetCenter = new THREE.Vector3();
                objBox.getCenter(targetCenter);
                const isTargetWall = targetItemId && wallTypes.includes(targetItemId);
                const isTargetFoundation = targetItemId === 'foundation';

                // Rotation helper functions (updated slightly for robustness)
                const pi2 = Math.PI * 2;
                const normalizeAngle = (angle) => ((angle % pi2) + pi2) % pi2; // Normalize to 0 - 2PI
                const approxEquals = (a, b, tolerance = 0.1) => Math.abs(normalizeAngle(a) - normalizeAngle(b)) < tolerance || Math.abs(normalizeAngle(a) - normalizeAngle(b) - pi2) < tolerance || Math.abs(normalizeAngle(a) - normalizeAngle(b) + pi2) < tolerance;

                const approxZero = (angle) => approxEquals(angle, 0);
                const approxPi = (angle) => approxEquals(angle, Math.PI);
                const approxPiOverTwo = (angle) => approxEquals(angle, Math.PI / 2);
                const approxThreePiOverTwo = (angle) => approxEquals(angle, 3 * Math.PI / 2);


                // --- COLLISION EXCEPTIONS ---

                // 1. Wall on Foundation (Keep as before)
                if (isGhostWall && isTargetFoundation) {
                    const foundationTopY = objBox.max.y;
                    const wallBottomY = ghostBox.min.y;
                    if (Math.abs(wallBottomY - foundationTopY) < generalVerticalTolerance) {
                        if (ghostCenter.x >= objBox.min.x - generalHorizontalTolerance && ghostCenter.x <= objBox.max.x + generalHorizontalTolerance &&
                            ghostCenter.z >= objBox.min.z - generalHorizontalTolerance && ghostCenter.z <= objBox.max.z + generalHorizontalTolerance)
                        { continue; } else { /*console.log("W-F Horiz Fail");*/ return false; }
                    } else { /*console.log("W-F Vert Fail");*/ return false; }
                }

                // 2. Foundation next to Foundation (Keep as before)
                else if (ghostItemId === 'foundation' && isTargetFoundation) {
                   if (Math.abs(ghostCenter.y - targetCenter.y) < generalVerticalTolerance) {
                       const dx = Math.abs(ghostCenter.x - targetCenter.x);
                       const dz = Math.abs(ghostCenter.z - targetCenter.z);
                       const alignedX = Math.abs(dx - foundationSize) < generalHorizontalTolerance && dz < generalHorizontalTolerance;
                       const alignedZ = Math.abs(dz - foundationSize) < generalHorizontalTolerance && dx < generalHorizontalTolerance;
                       if (alignedX || alignedZ) { continue; } else { /*console.log("F-F Horiz Fail");*/ return false; }
                   } else { /*console.log("F-F Vert Fail");*/ return false; }
                }

                // --- MODIFIED: 3. Wall next to Wall (Allow Parallel & Perpendicular) ---
                else if (isGhostWall && isTargetWall) {
                     // A. Vertical Alignment Check (Must always align vertically)
                     if (Math.abs(ghostBox.min.y - objBox.min.y) >= generalVerticalTolerance) {
                         // console.log("Wall-Wall Fail: Vertical mismatch.");
                         return false;
                     }

                     const dx = Math.abs(ghostCenter.x - targetCenter.x);
                     const dz = Math.abs(ghostCenter.z - targetCenter.z);
                     const ghostRotY = ghost.rotation.y;
                     const targetRotY = obj.rotation.y;

                     // B. Check Parallel Alignment
                     let isParallelMatch = false;
                     if (approxZero(ghostRotY - targetRotY) || approxPi(ghostRotY - targetRotY)) {
                         // Check horizontal distance for parallel walls
                         const alignedX = Math.abs(dx - wallWidth) < generalHorizontalTolerance && dz < generalHorizontalTolerance;
                         const alignedZ = Math.abs(dz - wallWidth) < generalHorizontalTolerance && dx < generalHorizontalTolerance;
                         if (alignedX || alignedZ) {
                             isParallelMatch = true;
                             // console.log("Wall-Wall Snap: Parallel");
                         }
                     }

                     // C. Check Perpendicular Alignment (Corner)
                     let isPerpendicularMatch = false;
                     // Check only if not already parallel, check for 90 or 270 deg difference
                     if (!isParallelMatch && (approxPiOverTwo(ghostRotY - targetRotY) || approxThreePiOverTwo(ghostRotY - targetRotY))) {
                         // Check horizontal distance for corner walls (dx and dz approx halfWallWidth)
                         if (Math.abs(dx - halfWallWidth) < cornerTolerance && Math.abs(dz - halfWallWidth) < cornerTolerance) {
                             isPerpendicularMatch = true;
                            // console.log("Wall-Wall Snap: Perpendicular (Corner)");
                         }
                     }

                     // D. Allow Placement if EITHER Parallel or Perpendicular match
                     if (isParallelMatch || isPerpendicularMatch) {
                         continue; // Valid adjacent wall placement (either parallel or corner)
                     } else {
                         // console.log(`Wall-Wall Fail: No valid snap. dx:${dx.toFixed(2)}, dz:${dz.toFixed(2)}, rotDiff:${normalizeAngle(ghostRotY - targetRotY).toFixed(2)}`);
                         return false; // Neither parallel nor perpendicular snap conditions met
                     }
                }
                // --- END MODIFIED WALL-WALL CHECK ---

                // 4. Door aligning with Doorway Wall (Keep as before, using general tolerances)
                else if (ghostItemId === 'door' && targetItemId === 'wall_doorway') {
                     const doorBottomY = ghostBox.min.y;
                     const wallBottomY = objBox.min.y;
                     if (Math.abs(doorBottomY - wallBottomY) > generalVerticalTolerance) { return false; }

                     const wallRotationY = obj.rotation.y;
                     let centersAlignedHorizontally = false;
                     if (approxZero(wallRotationY) || approxPi(wallRotationY)) {
                        centersAlignedHorizontally = Math.abs(ghostCenter.z - targetCenter.z) < generalHorizontalTolerance;
                     } else if (approxPiOverTwo(wallRotationY) || approxThreePiOverTwo(wallRotationY)) {
                        centersAlignedHorizontally = Math.abs(ghostCenter.x - targetCenter.x) < generalHorizontalTolerance;
                     }
                     if (!centersAlignedHorizontally) { return false; }

                     const rotationDiff = ghost.rotation.y - wallRotationY;
                     if (!(approxZero(rotationDiff) || approxPi(rotationDiff))) { return false; }
                     continue;
                }

                // --- DEFAULT COLLISION ---
                // console.log(`Overlap detected and no snapping rule applied between ${ghostItemId} and ${targetItemId || 'Unknown'}`);
                return false; // Intersecting and no exception matched
            }
        } // End loop through world objects

        // Check against AI agents (Keep as before)
        for (const agent of AI.agents) {
             if (!agent.geometry) continue;
             agent.updateMatrixWorld(true);
             const agentBox = new THREE.Box3().setFromObject(agent);
             if (ghostBox.intersectsBox(agentBox)) { return false; }
         }

        return true; // No invalid collision found
    },

    // placeSelectedItem and craftBuildable remain the same as the last complete version
    placeSelectedItem: function() {
        if (!this.isPlacing || !this.currentItemInfo || !this.ghostObject) return;

        if (!this.checkPlacementValidity(this.ghostObject)) {
             Game.UIManager.logMessage("Cannot place item here!");
             if(this.ghostObject) this.ghostObject.material = this.buildMaterialInvalid;
             return;
        }
         if (this.ghostObject.material === this.buildMaterialInvalid) {
              Game.UIManager.logMessage("Cannot place item here! (Material Invalid)");
              return;
         }

        const consumed = Inventory.consumeItemForPlacement(this.currentItemInfo);

        if (consumed) {
            const buildableData = CONSTANTS.BUILDABLES[this.currentItemInfo.itemId];
            const itemId = this.currentItemInfo.itemId;

            let itemColor;
            switch (itemId) {
                 case 'campfire': itemColor = 0x404040; break;
                 case 'crafting_table': itemColor = 0x966F33; break;
                 case 'forge': itemColor = 0x606060; break;
                 case 'wall_window': itemColor = 0xB8860B; break;
                 case 'wall_doorway': itemColor = 0xCD853F; break;
                 case 'door': itemColor = 0x8B4513; break;
                 default: itemColor = 0xA0522D;
            }
            const placedMaterial = new THREE.MeshLambertMaterial({ color: itemColor });

            let objectToAdd;

            if (itemId === 'door') {
                const pivotGroup = new THREE.Group();
                pivotGroup.position.copy(this.ghostObject.position);
                pivotGroup.rotation.copy(this.ghostObject.rotation);

                const doorMesh = new THREE.Mesh(buildableData.geometry.clone(), placedMaterial);
                doorMesh.castShadow = true;
                doorMesh.receiveShadow = true;
                doorMesh.name = buildableData.name;
                doorMesh.userData.isPartOfDoor = true;

                 const doorWidth = doorMesh.geometry.parameters?.width || 1.4;
                 if (doorWidth) {
                     doorMesh.position.x += doorWidth / 2;
                 } else {
                     console.error("Could not get door width to apply placement offset!");
                 }

                pivotGroup.add(doorMesh);

                pivotGroup.name = buildableData.name + " Pivot";
                pivotGroup.userData = {
                    isBuilding: true, buildId: itemId, interactable: true,
                    prompt: `[E] Open/Close Door`, isOpen: false,
                    originalYRotation: pivotGroup.rotation.y,
                    onInteract: (group) => {
                        const openAngle = -Math.PI / 2 * 0.95;
                        if (group.userData.isOpen) {
                            group.rotation.y = group.userData.originalYRotation;
                            group.userData.isOpen = false; Game.UIManager.logMessage("Door Closed");
                        } else {
                            group.rotation.y = group.userData.originalYRotation + openAngle;
                            group.userData.isOpen = true; Game.UIManager.logMessage("Door Opened");
                        }
                    }
                };
                pivotGroup.userData.isDoorPivot = true;
                objectToAdd = pivotGroup;
            } else {
                const placedObject = new THREE.Mesh(buildableData.geometry.clone(), placedMaterial);
                placedObject.position.copy(this.ghostObject.position);
                placedObject.rotation.copy(this.ghostObject.rotation);
                placedObject.castShadow = true;
                placedObject.receiveShadow = true;
                placedObject.name = buildableData.name;
                placedObject.userData = { isBuilding: true, buildId: itemId, interactable: false };

                const isInteractableStation = ['crafting_table', 'forge'].includes(itemId);
                if (isInteractableStation) {
                    placedObject.userData.interactable = true;
                    placedObject.userData.prompt = `[E] Use ${buildableData.name}`;
                    placedObject.userData.onInteract = (object) => {
                         console.log(`Interacting with ${object.userData.buildId}`);
                         Game.UIManager.logMessage(`Used ${object.name}`);
                         // TODO: UIManager.openCraftingStationUI(object.userData.buildId);
                    };
                }
                objectToAdd = placedObject;
            }

            World.addWorldObject(objectToAdd, objectToAdd.userData.interactable, true);
            Game.UIManager.logMessage(`Placed ${buildableData.name}!`);
            console.log(`Placed ${buildableData.name} at`, objectToAdd.position);

            if (Inventory.getItemCount(itemId) < 1) {
                Game.UIManager.logMessage(`No more ${buildableData.name} left.`);
                this.cancelPlacement();
            }
        } else {
            Game.UIManager.logMessage(`Failed to place ${this.currentItemInfo.itemId} (Item not found?).`);
            this.cancelPlacement();
        }
    },

    craftBuildable: function(itemId) {
         const recipe = Crafting.recipes[itemId];
         const buildableData = CONSTANTS.BUILDABLES[itemId];
         const itemName = buildableData?.name || itemId;
         if (!recipe) {
             console.warn(`No recipe found to craft buildable: ${itemId}`);
             Game.UIManager.logMessage(`Cannot craft ${itemName}: No recipe.`);
             return;
         }
         Crafting.attemptCraft(itemId);
    }

}; // End of Building object

window.Building = Building;
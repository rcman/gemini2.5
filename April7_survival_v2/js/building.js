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
                 // Offset the visual mesh *relative to its pivot (ghostObject.position)*
                 // Note: This offset happens *after* the ghostObject position is set in updatePlacementGhost
                 // So, we store the desired offset. It might be better applied when creating the *actual* placed object.
                 // For the ghost visual, we might not need this offset if the pivot placement is correct.
                 // Let's comment this out for the ghost and apply it during placeSelectedItem only.
                 // this.ghostObject.position.x += doorWidth / 2;
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
             // if (this.ghostObject.material === this.buildMaterialValid) this.buildMaterialValid.dispose(); // Don't dispose shared
             // if (this.ghostObject.material === this.buildMaterialInvalid) this.buildMaterialInvalid.dispose(); // Don't dispose shared
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
        // let ghostBasePosition = this.ghostObject.position; // Use current position as default - not needed here

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
                 // Create a temporary mesh just for bounding box calculation, don't add to scene
                 const tempMesh = new THREE.Mesh(buildableData.geometry);
                 const tempBox = new THREE.Box3().setFromObject(tempMesh); // Temp mesh to get size
                 objectHeight = tempBox.max.y - tempBox.min.y;
             }

             // Adjust Y based on the target surface
             if (targetObject === groundPlane) {
                 placeY = intersectPoint.y + objectHeight / 2; // Place object center relative to intersection point on ground
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
                const rotationDirection = Input.mouse.wheelDelta; // +1 or -1
                const angleIncrement = Math.PI / 2; // 90 degrees
                pivotRotation.y += rotationDirection * angleIncrement; // Adjust target rotation
                // Snap rotation to nearest 90 degrees
                const piOverTwo = Math.PI / 2;
                pivotRotation.y = Math.round(pivotRotation.y / piOverTwo) * piOverTwo;
                // Keep rotation within 0 to 2PI range
                const twoPi = Math.PI * 2;
                pivotRotation.y = ((pivotRotation.y % twoPi) + twoPi) % twoPi; // Normalize angle

                // Update the ghost object's actual rotation immediately for visual feedback
                this.ghostObject.rotation.y = pivotRotation.y;
            }
            // --- End Rotation Handling ---

            // Set the base/pivot position and rotation for the ghost object
            // The ghostObject itself represents the pivot point.
            this.ghostObject.position.copy(pivotPosition);
            // Ensure rotation is applied from the potentially updated pivotRotation
            this.ghostObject.rotation.y = pivotRotation.y; // Apply the calculated rotation Y axis

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

        ghost.updateMatrixWorld(true); // Ensure ghost's transform is up-to-date
        const ghostBox = new THREE.Box3().setFromObject(ghost);

        // Check if ghost is below ground (small tolerance)
        const ghostLowestY = ghostBox.min.y;
        if (ghostLowestY < -0.01) {
            // console.log("Placement Fail: Below ground");
            return false;
         }

        const ghostItemId = this.currentItemInfo ? this.currentItemInfo.itemId : null;
        if (!ghostItemId) return false; // Should not happen if placing

        const ghostCenter = new THREE.Vector3();
        ghostBox.getCenter(ghostCenter);

        // Tolerances
        const generalVerticalTolerance = 0.1;    // For aligning tops/bottoms
        const generalHorizontalTolerance = 0.15; // For general side-by-side checks (foundations, parallel walls)
        const cornerTolerance = 0.2;             // For corner wall alignment (half-width checks)

        // Item Dimensions/Types (using CONSTANTS dimensions where possible)
        const wallTypes = ['wall', 'wall_doorway', 'wall_window'];
        const isGhostWall = wallTypes.includes(ghostItemId);
        const foundationSize = CONSTANTS.BUILDABLES.foundation.geometry.parameters.width; // Assuming BoxGeometry
        const wallWidth = CONSTANTS.BUILDABLES.wall.geometry.parameters.width;       // Assuming BoxGeometry or equivalent Extrude width
        const halfWallWidth = wallWidth / 2;

        // Rotation helper functions (more robust angle comparisons)
        const pi2 = Math.PI * 2;
        const normalizeAngle = (angle) => ((angle % pi2) + pi2) % pi2; // Normalize to 0 - 2PI
        const approxEquals = (a, b, tolerance = 0.1) => {
            const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
            return diff < tolerance || diff > pi2 - tolerance; // Check closeness in both directions around the circle
        };
        const approxZero = (angle, tolerance = 0.1) => approxEquals(angle, 0, tolerance);
        const approxPi = (angle, tolerance = 0.1) => approxEquals(angle, Math.PI, tolerance);
        const approxPiOverTwo = (angle, tolerance = 0.1) => approxEquals(angle, Math.PI / 2, tolerance);
        const approxThreePiOverTwo = (angle, tolerance = 0.1) => approxEquals(angle, 3 * Math.PI / 2, tolerance);
        const arePerpendicular = (angleA, angleB, tolerance = 0.1) => {
             const diff = Math.abs(normalizeAngle(angleA) - normalizeAngle(angleB));
             return approxEquals(diff, Math.PI / 2, tolerance) || approxEquals(diff, 3 * Math.PI / 2, tolerance);
        };
        const areParallel = (angleA, angleB, tolerance = 0.1) => {
             const diff = Math.abs(normalizeAngle(angleA) - normalizeAngle(angleB));
             return approxEquals(diff, 0, tolerance) || approxEquals(diff, Math.PI, tolerance);
        };


        // --- Check against other World Objects ---
        for (const obj of World.objects) {
            // Skip self, other ghosts, objects without geometry, or parts of an already placed door group
            if (obj === ghost || obj.userData?.isGhost || !obj.geometry || obj.userData?.isPartOfDoor) continue;

            let objBox;
            let targetItemName = obj.name;
            let targetItemId = obj.userData?.buildId;

            // Handle Doors (Groups) vs single Meshes for bounding box
            if (obj.type === 'Group' && obj.userData?.isDoorPivot) {
                 // Calculate bounding box for the entire group
                 objBox = new THREE.Box3();
                 obj.traverse((child) => {
                     if (child.isMesh) {
                         child.updateMatrixWorld(true); // Ensure child matrix is current
                         const childBox = new THREE.Box3().setFromObject(child);
                         objBox.union(childBox); // Expand group box by child box
                     }
                 });
                 targetItemName = obj.name; // Use group name
                 targetItemId = obj.userData?.buildId; // Use group buildId
            } else if (obj.isMesh){ // Standard mesh object
                 obj.updateMatrixWorld(true);
                 objBox = new THREE.Box3().setFromObject(obj);
            } else {
                continue; // Skip objects that aren't Groups or Meshes with geometry
            }

            // --- Primary Intersection Check ---
            if (ghostBox.intersectsBox(objBox)) {
                // console.log(`Intersection detected between ghost (${ghostItemId}) and world object (${targetItemId || targetItemName})`); // Debug

                const targetCenter = new THREE.Vector3();
                objBox.getCenter(targetCenter);
                const isTargetWall = targetItemId && wallTypes.includes(targetItemId);
                const isTargetFoundation = targetItemId === 'foundation';
                const isTargetDoor = targetItemId === 'door'; // Should check userData.isDoorPivot

                // --- COLLISION EXCEPTION RULES (Snapping Logic) ---

                // 1. Wall ON Foundation (Ghost=Wall, Target=Foundation)
                if (isGhostWall && isTargetFoundation) {
                    const foundationTopY = objBox.max.y;
                    const wallBottomY = ghostBox.min.y;
                    // Check vertical alignment (wall bottom near foundation top)
                    if (Math.abs(wallBottomY - foundationTopY) < generalVerticalTolerance) {
                        // Check horizontal containment (wall center within foundation bounds, tolerance allows snapping near edge)
                        if (ghostCenter.x >= objBox.min.x - generalHorizontalTolerance && ghostCenter.x <= objBox.max.x + generalHorizontalTolerance &&
                            ghostCenter.z >= objBox.min.z - generalHorizontalTolerance && ghostCenter.z <= objBox.max.z + generalHorizontalTolerance)
                        {
                            // console.log("W-F Snap: Vertical & Horizontal OK");
                            continue; // Valid placement, ignore intersection
                        } else {
                            // console.log("W-F Snap Fail: Horizontal containment");
                             return false; // Invalid horizontal position
                        }
                    } else {
                         // console.log(`W-F Snap Fail: Vertical mismatch (WallBottom: ${wallBottomY.toFixed(2)}, FounTop: ${foundationTopY.toFixed(2)})`);
                         return false; // Invalid vertical position
                    }
                }

                // 2. Foundation NEXT TO Foundation (Ghost=Foundation, Target=Foundation)
                else if (ghostItemId === 'foundation' && isTargetFoundation) {
                   // Check vertical alignment (centers should be close)
                   if (Math.abs(ghostCenter.y - targetCenter.y) < generalVerticalTolerance) {
                       const dx = Math.abs(ghostCenter.x - targetCenter.x);
                       const dz = Math.abs(ghostCenter.z - targetCenter.z);
                       // Check if aligned along X axis (centers are foundationSize apart in X, close in Z)
                       const alignedX = Math.abs(dx - foundationSize) < generalHorizontalTolerance && dz < generalHorizontalTolerance;
                       // Check if aligned along Z axis (centers are foundationSize apart in Z, close in X)
                       const alignedZ = Math.abs(dz - foundationSize) < generalHorizontalTolerance && dx < generalHorizontalTolerance;
                       if (alignedX || alignedZ) {
                           // console.log("F-F Snap: OK");
                            continue; // Valid adjacent placement
                       } else {
                            // console.log("F-F Snap Fail: Horizontal alignment");
                            return false; // Not aligned properly side-by-side
                       }
                   } else {
                       // console.log("F-F Snap Fail: Vertical mismatch");
                        return false; // Not at the same height
                   }
                }

                // 3. Wall NEXT TO Wall (Ghost=Wall, Target=Wall)
                else if (isGhostWall && isTargetWall) {
                     // A. Vertical Alignment Check (Bottoms must align)
                     if (Math.abs(ghostBox.min.y - objBox.min.y) >= generalVerticalTolerance) {
                         // console.log("W-W Snap Fail: Vertical mismatch.");
                         return false;
                     }

                     const dx = Math.abs(ghostCenter.x - targetCenter.x);
                     const dz = Math.abs(ghostCenter.z - targetCenter.z);
                     const ghostRotY = ghost.rotation.y;
                     const targetRotY = obj.rotation.y; // Assuming wall rotation is on the mesh itself

                     // B. Check PARALLEL Alignment
                     if (areParallel(ghostRotY, targetRotY, 0.1)) {
                         // Check horizontal distance for parallel walls (centers should be wallWidth apart in one axis, close in the other)
                         const alignedX = Math.abs(dx - wallWidth) < generalHorizontalTolerance && dz < generalHorizontalTolerance;
                         const alignedZ = Math.abs(dz - wallWidth) < generalHorizontalTolerance && dx < generalHorizontalTolerance;
                         if (alignedX || alignedZ) {
                             // console.log("W-W Snap: Parallel OK");
                             continue; // Valid parallel placement
                         } else {
                              // console.log(`W-W Snap Fail: Parallel horizontal distance (dx:${dx.toFixed(2)}, dz:${dz.toFixed(2)})`);
                              return false;
                         }
                     }
                     // C. Check PERPENDICULAR (Corner) Alignment
                     else if (arePerpendicular(ghostRotY, targetRotY, 0.1)) {
                         // Check horizontal distance for corner walls (centers should be approx halfWallWidth apart in *both* X and Z)
                         if (Math.abs(dx - halfWallWidth) < cornerTolerance && Math.abs(dz - halfWallWidth) < cornerTolerance) {
                            // console.log("W-W Snap: Perpendicular (Corner) OK");
                             continue; // Valid corner placement
                         } else {
                            // console.log(`W-W Snap Fail: Corner distance (dx:${dx.toFixed(2)}, dz:${dz.toFixed(2)}, needed ~${halfWallWidth.toFixed(2)})`);
                            return false;
                         }
                     }
                     // D. If neither parallel nor perpendicular alignment is met
                     else {
                         // console.log(`W-W Snap Fail: Not Parallel or Perpendicular (RotDiff: ${normalizeAngle(ghostRotY - targetRotY).toFixed(2)})`);
                         return false;
                     }
                }

                // 4. Door aligning with Doorway Wall (Ghost=Door, Target=Wall_Doorway)
                else if (ghostItemId === 'door' && targetItemId === 'wall_doorway') {
                     // A. Vertical check (door bottom should align with wall bottom)
                     if (Math.abs(ghostBox.min.y - objBox.min.y) > generalVerticalTolerance) {
                         // console.log("Door-Doorway Snap Fail: Vertical mismatch");
                         return false;
                     }

                     // B. Horizontal check (door center should align with wall center along the wall's facing direction)
                     const wallRotationY = obj.rotation.y;
                     let centersAlignedHorizontally = false;
                     // If wall faces roughly along Z (rot 0 or PI)
                     if (approxZero(wallRotationY) || approxPi(wallRotationY)) {
                        // Centers should align in Z, be close in X (within doorway tolerance potentially)
                        centersAlignedHorizontally = Math.abs(ghostCenter.z - targetCenter.z) < generalHorizontalTolerance && Math.abs(ghostCenter.x - targetCenter.x) < 0.5; // Allow some X offset
                     }
                     // If wall faces roughly along X (rot PI/2 or 3PI/2)
                     else if (approxPiOverTwo(wallRotationY) || approxThreePiOverTwo(wallRotationY)) {
                         // Centers should align in X, be close in Z
                        centersAlignedHorizontally = Math.abs(ghostCenter.x - targetCenter.x) < generalHorizontalTolerance && Math.abs(ghostCenter.z - targetCenter.z) < 0.5; // Allow some Z offset
                     }
                     if (!centersAlignedHorizontally) {
                         // console.log("Door-Doorway Snap Fail: Horizontal center alignment");
                         return false;
                     }

                     // C. Rotation check (door must be parallel to the wall)
                     if (!areParallel(ghost.rotation.y, wallRotationY)) {
                         // console.log("Door-Doorway Snap Fail: Rotation mismatch");
                         return false;
                     }

                     // console.log("Door-Doorway Snap: OK");
                     continue; // Valid door placement within doorway
                }

                // --- DEFAULT: No specific snapping rule applied ---
                // If an intersection occurs and none of the above snapping rules allow it, it's an invalid placement.
                // console.log(`Placement Fail: Intersection between ${ghostItemId} and ${targetItemId || targetItemName} with no valid snap rule.`);
                return false;
            }
        } // --- End loop through World.objects ---

        // --- Check against AI agents ---
        for (const agent of AI.agents) {
             if (!agent.geometry) continue;
             agent.updateMatrixWorld(true);
             const agentBox = new THREE.Box3().setFromObject(agent);
             if (ghostBox.intersectsBox(agentBox)) {
                 // console.log("Placement Fail: Intersects AI agent");
                 return false; // Cannot place on top of AI
             }
         }

        // --- If no invalid intersections found ---
        return true;
    },


    placeSelectedItem: function() {
        if (!this.isPlacing || !this.currentItemInfo || !this.ghostObject) return;

        // Final validity check right before placing
        if (!this.checkPlacementValidity(this.ghostObject)) {
             Game.UIManager.logMessage("Cannot place item here!");
             // Ensure ghost material reflects invalid state if check fails here
             if(this.ghostObject) this.ghostObject.material = this.buildMaterialInvalid;
             return;
        }
         // Also check the material just in case (redundant but safe)
         if (this.ghostObject.material === this.buildMaterialInvalid) {
              Game.UIManager.logMessage("Cannot place item here! (Invalid Location)");
              return;
         }

        // Attempt to consume the item from inventory/quickbar
        const consumed = Inventory.consumeItemForPlacement(this.currentItemInfo);

        if (consumed) {
            const buildableData = CONSTANTS.BUILDABLES[this.currentItemInfo.itemId];
            const itemId = this.currentItemInfo.itemId;

            // --- Create the actual placed object ---
            let itemColor; // Basic colors, consider more advanced materials later
            switch (itemId) {
                 case 'campfire': itemColor = 0x404040; break;
                 case 'crafting_table': itemColor = 0x966F33; break;
                 case 'forge': itemColor = 0x606060; break;
                 case 'wall_window': itemColor = 0xB8860B; break; // Dark Goldenrod
                 case 'wall_doorway': itemColor = 0xCD853F; break; // Peru
                 case 'door': itemColor = 0x8B4513; break; // Saddle Brown
                 case 'wall': itemColor = 0xA0522D; break; // Sienna (for solid wall)
                 case 'foundation': itemColor = 0x696969; break; // Dim Gray (for foundation)
                 default: itemColor = 0xA0522D; // Default Sienna
            }
            const placedMaterial = new THREE.MeshLambertMaterial({ color: itemColor });

            let objectToAdd;

            // --- Special Handling for Doors (Pivot Group) ---
            if (itemId === 'door') {
                const pivotGroup = new THREE.Group();
                // Place the PIVOT at the ghost's final position/rotation
                pivotGroup.position.copy(this.ghostObject.position);
                pivotGroup.rotation.copy(this.ghostObject.rotation);

                // Create the door MESH using cloned geometry and the final material
                const doorMesh = new THREE.Mesh(buildableData.geometry.clone(), placedMaterial);
                doorMesh.castShadow = true;
                doorMesh.receiveShadow = true;
                doorMesh.name = buildableData.name; // Name the mesh part
                doorMesh.userData.isPartOfDoor = true; // Mark mesh as part of a door group

                // --- Apply Offset to the MESH relative to the PIVOT ---
                 const doorWidth = doorMesh.geometry.parameters?.width || 1.4;
                 if (doorWidth) {
                     // Shift the door mesh along its local X-axis so it rotates around the edge (pivot)
                     doorMesh.position.x += doorWidth / 2;
                 } else {
                     console.error("Could not get door width to apply placement offset!");
                 }
                // --- End Offset ---

                pivotGroup.add(doorMesh); // Add the offset mesh to the pivot group

                // --- Configure Pivot Group ---
                pivotGroup.name = buildableData.name + " Pivot"; // Name the group
                pivotGroup.userData = {
                    isBuilding: true,       // Mark as a building piece
                    buildId: itemId,        // Store the item ID
                    isDoorPivot: true,      // Specific flag for door pivots
                    interactable: true,     // Make the pivot interactable
                    prompt: `[E] Open/Close Door`,
                    isOpen: false,          // Initial state
                    originalYRotation: pivotGroup.rotation.y, // Store initial rotation for closing
                    // Interaction logic for the door
                    onInteract: (group) => {
                        const openAngle = -Math.PI / 2 * 0.95; // Open angle (slightly less than 90 deg)
                        if (group.userData.isOpen) {
                            // Close the door: Reset to original rotation
                            group.rotation.y = group.userData.originalYRotation;
                            group.userData.isOpen = false;
                            Game.UIManager.logMessage("Door Closed");
                        } else {
                            // Open the door: Add open angle to original rotation
                            group.rotation.y = group.userData.originalYRotation + openAngle;
                            group.userData.isOpen = true;
                            Game.UIManager.logMessage("Door Opened");
                        }
                    }
                };
                objectToAdd = pivotGroup; // The group is the object added to the world

            } else {
                // --- Standard Buildable Object (Mesh) ---
                const placedObject = new THREE.Mesh(buildableData.geometry.clone(), placedMaterial);
                placedObject.position.copy(this.ghostObject.position);
                placedObject.rotation.copy(this.ghostObject.rotation);
                placedObject.castShadow = true;
                placedObject.receiveShadow = true;
                placedObject.name = buildableData.name;
                placedObject.userData = { isBuilding: true, buildId: itemId, interactable: false }; // Default non-interactable

                // Check if it's an interactable crafting station
                const isInteractableStation = ['crafting_table', 'forge', 'campfire'].includes(itemId); // Add campfire
                if (isInteractableStation) {
                    placedObject.userData.interactable = true;
                    placedObject.userData.prompt = `[E] Use ${buildableData.name}`;
                    placedObject.userData.onInteract = (object) => {
                         console.log(`Interacting with ${object.userData.buildId}`);
                         Game.UIManager.logMessage(`Used ${object.name}`);
                         // TODO: Implement UI opening for specific stations
                         // Example: if (object.userData.buildId === 'crafting_table') UIManager.openCraftingStationUI('crafting_table');
                    };
                }
                objectToAdd = placedObject; // The mesh is the object added
            }

            // Add the final object (Mesh or Group) to the world simulation
            World.addWorldObject(objectToAdd, objectToAdd.userData.interactable, true);
            Game.UIManager.logMessage(`Placed ${buildableData.name}!`);
            console.log(`Placed ${buildableData.name} at`, objectToAdd.position);

            // --- Check if more items remain for placement ---
            if (Inventory.getItemCount(itemId) < 1) {
                // Out of this item, automatically cancel placement mode
                Game.UIManager.logMessage(`No more ${buildableData.name} left.`);
                this.cancelPlacement(); // This also clears selections and the ghost
            } else {
                // Still have items left, keep placement mode active for the next one.
                // Ghost remains visible, user can click to place again.
                 // We might want to slightly move the ghost or require mouse movement before next check? (Optional refinement)
            }

        } else {
            // Item consumption failed (should be rare if validity checks pass)
            Game.UIManager.logMessage(`Failed to place ${this.currentItemInfo.itemId} (Item vanished?).`);
            this.cancelPlacement(); // Cancel placement if consumption failed
        }
    },

    craftBuildable: function(itemId) {
         const recipe = Crafting.recipes[itemId];
         const buildableData = CONSTANTS.BUILDABLES[itemId];
         const itemName = buildableData?.name || itemId; // Get display name

         if (!recipe) {
             console.warn(`No recipe found to craft buildable: ${itemId}`);
             Game.UIManager.logMessage(`Cannot craft ${itemName}: No recipe.`);
             return;
         }

         // AttemptCraft handles checking resources, consuming them, and adding the item
         const success = Crafting.attemptCraft(itemId);

         if(success) {
             // Optionally close the build menu after successful craft? Or keep it open?
             // UIManager.toggleBuildMenu();
         }
         // Crafting.attemptCraft already logs success/failure messages
    }

}; // End of Building object

window.Building = Building;
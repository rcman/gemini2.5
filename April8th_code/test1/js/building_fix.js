// js/building.js - Fixed building placement system
class BuildingSystem {
    constructor(game) {
        this.game = game;
        this.isBuilding = false;
        this.currentItemId = null; // e.g., 'foundation', 'wall'
        this.ghostMesh = null; // Transparent preview mesh
        this.placementValid = false;
        this.gridSize =
 2; // Example: Snap to 2x2 meter grid
        this.buildRotation = 0; // Rotation in degrees (0, 90, 180, 270)
        this.placementMaxDistance = 10.0; // How far player can place items
        this.lastPlacementPosition = new THREE.Vector3(); // Track last placement position

        this.raycaster = new THREE.Raycaster();

        this.placedObjects = []; // Keep track of built objects { mesh, itemId }
        this.foundationHeight = 0.2;
        this.wallHeight = 2.5;
        this.ceilingHeight = 0.2;
    }

    toggleBuildMode() {
        if (this.isBuilding) {
            this.exitBuildMode();
        } else {
            console.log("Open Build Menu (B)");
            this.game.uiManager.toggleBuildMenu();
        }
    }

    selectBuildItem(itemId) {
        const itemData = ITEMS[itemId];
        if (!itemData || (itemData.type !== 'building_part' && itemData.type !== 'placeable')) {
             console.warn("Cannot build item:", itemId);
             this.exitBuildMode();
             return;
        }

        // Check if player has the required item in inventory
        if (!this.game.inventoryManager.has(itemId, 1)) {
             console.log("Need 1x", itemData.name, "in inventory to place.");
             this.game.uiManager.showNotification(`Need 1x ${itemData.name}`);
             return;
        }

        this.isBuilding = true;
        this.currentItemId = itemId;
        this.createGhostMesh(); // Create or update ghost mesh
        this.game.uiManager.hideBuildMenu(); // Hide menu once item selected
        console.log("Entering build mode with:", itemId);
        
        // Force an immediate update of ghost position
        this.update(this.game.camera, this.game.inputHandler.mouse, 0);
    }

    exitBuildMode() {
        this.isBuilding = false;
        this.currentItemId = null;
        if (this.ghostMesh) {
            this.game.scene.remove(this.ghostMesh);
            // Geometry/Material disposal handled in createGhostMesh if replaced
            if (this.ghostMesh.geometry) this.ghostMesh.geometry.dispose();
            if (this.ghostMesh.material) this.ghostMesh.material.dispose();
            this.ghostMesh = null;
        }
        console.log("Exiting build mode");
        
        // Ensure pause state is correct if no other menus are open
        this.game.setPaused(this.game.uiManager.isAnyMenuOpen());
    }

    createGhostMesh() {
        if (this.ghostMesh) {
            if (this.ghostMesh.geometry) this.ghostMesh.geometry.dispose();
            if (this.ghostMesh.material) this.ghostMesh.material.dispose();
            this.game.scene.remove(this.ghostMesh);
            this.ghostMesh = null;
        }

        if (!this.currentItemId) return;

        const itemData = ITEMS[this.currentItemId];
        if (!itemData) return;

        let geometry;
        // Use actual dimensions
        switch (itemData.id) {
            case 'foundation':
                geometry = new THREE.BoxGeometry(this.gridSize, this.foundationHeight, this.gridSize);
                break;
            case 'wall':
                geometry = new THREE.BoxGeometry(this.gridSize, this.wallHeight, 0.2);
                break;
            case 'wall_window':
                 geometry = new THREE.BoxGeometry(this.gridSize, this.wallHeight, 0.2);
                break;
            case 'ceiling':
                 geometry = new THREE.BoxGeometry(this.gridSize, this.ceilingHeight, this.gridSize);
                 break;
            case 'workbench':
            case 'forge':
                geometry = new THREE.BoxGeometry(1.2, 1, 0.8);
                break;
            default:
                console.warn("No geometry specified for build item:", this.currentItemId);
                geometry = new THREE.BoxGeometry(1, 1, 1); // Default fallback
        }

        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            wireframe: true // Wireframe often clearer for placement
        });
        
        this.ghostMesh = new THREE.Mesh(geometry, material);
        this.ghostMesh.visible = false; // Hide initially
        this.game.scene.add(this.ghostMesh);
    }

    update(camera, mouse, deltaTime) {
        if (!this.isBuilding || !this.ghostMesh || !this.currentItemId) return;

        // 1. Raycast from camera center forward
        this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
        this.raycaster.far = this.placementMaxDistance;

        const itemData = ITEMS[this.currentItemId];
        if (!itemData) { this.exitBuildMode(); return; }

        // Determine what the ray should collide with based on item type
        let collidableRayTargets = [];
        if (itemData.type === 'placeable' || itemData.id === 'foundation') {
            // Placeables & Foundations target ground and potentially other foundations/floors
             collidableRayTargets = this.game.world.getCollidableObjects().filter(o => 
                o.userData?.type === 'ground' || 
                o.userData?.buildItemId === 'foundation' || 
                o.userData?.buildItemId === 'ceiling'
             );
        } else if (itemData.id === 'wall' || itemData.id === 'wall_window') {
            // Walls target foundations or ceilings/floors
             collidableRayTargets = this.placedObjects.map(p => p.mesh).filter(m => 
                m.userData?.buildItemId === 'foundation' || 
                m.userData?.buildItemId === 'ceiling'
             );
        } else if (itemData.id === 'ceiling') {
            // Ceilings target tops of walls or foundations
             collidableRayTargets = this.placedObjects.map(p => p.mesh).filter(m => 
                m.userData?.buildItemId === 'foundation' || 
                m.userData?.buildItemId === 'ceiling' || 
                m.userData?.buildItemId === 'wall'
             );
        } else {
            // Default: target ground and buildings
            collidableRayTargets = this.game.world.getCollidableObjects();
        }

        // Filter out the ghost mesh itself from raycast targets
        collidableRayTargets = collidableRayTargets.filter(o => o !== this.ghostMesh);

        const intersects = this.raycaster.intersectObjects(collidableRayTargets, false);

        this.placementValid = false; // Assume invalid until proven otherwise
        this.ghostMesh.visible = false;

        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitPoint = hit.point;
            const hitObject = hit.object;
            const hitNormal = hit.face.normal.clone();
            // Transform normal to world space if the object is rotated
            hitNormal.transformDirection(hitObject.matrixWorld).normalize();

            // Check if placement surface is suitable (e.g., mostly flat for foundations)
            const placementAngleThreshold = 0.95; // Allow placement on near-flat surfaces
            if (hitNormal.dot(new THREE.Vector3(0, 1, 0)) < placementAngleThreshold && 
               (itemData.type === 'placeable' || itemData.id === 'foundation')) {
                // Trying to place foundation/placeable on steep slope or wall side
                return; // Keep placement invalid, ghost hidden
            }

            // Calculate Snapped Position
            let snappedPosition = this.calculateSnappedPosition(hitPoint, hitObject, itemData);

            if (snappedPosition) {
                // Store distance from last placement position to avoid jitter
                const distanceFromLast = snappedPosition.distanceTo(this.lastPlacementPosition);
                
                // Only update if position changed significantly or first placement
                if (distanceFromLast > 0.01 || !this.ghostMesh.visible) {
                    this.ghostMesh.position.copy(snappedPosition);
                    this.lastPlacementPosition.copy(snappedPosition);
                }
                
                this.ghostMesh.rotation.y = THREE.MathUtils.degToRad(this.buildRotation);
                this.ghostMesh.visible = true;

                // Check Validity (Collision, Support)
                this.placementValid = this.checkPlacementValidity(itemData);

                // Update ghost mesh color based on validity
                this.ghostMesh.material.color.set(this.placementValid ? 0x00ff00 : 0xff0000);
            }
        }
    }

    calculateSnappedPosition(hitPoint, hitObject, itemData) {
        let snappedX = Math.round(hitPoint.x / this.gridSize) * this.gridSize;
        let snappedZ = Math.round(hitPoint.z / this.gridSize) * this.gridSize;
        let snappedY = hitPoint.y; // Start with hit point Y

        // Adjust Y based on item type and what it's placed on
        switch (itemData.id) {
            case 'foundation':
                snappedY = Math.round(hitPoint.y / this.gridSize) * this.gridSize;
                snappedY += this.foundationHeight / 2;
                break;
            case 'workbench':
            case 'forge':
                snappedY = hitPoint.y + (this.ghostMesh.geometry.parameters.height / 2 || 0.5);
                // For placeables, snap to 0.5m grid
                snappedX = Math.round(hitPoint.x * 2) / 2;
                snappedZ = Math.round(hitPoint.z * 2) / 2;
                break;
            case 'wall':
            case 'wall_window':
                // Snap to grid X/Z. Y should be based on foundation/ceiling below.
                const checkPosWall = new THREE.Vector3(snappedX, hitPoint.y - this.wallHeight / 2, snappedZ);
                const supportWall = this.findNearestBuildingPart(['foundation', 'ceiling'], checkPosWall, this.gridSize * 0.7);
                if (supportWall) {
                    // Snap Y to top of foundation or bottom of ceiling
                    const supportBB = new THREE.Box3().setFromObject(supportWall.mesh);
                    if (supportWall.itemId === 'foundation') {
                        snappedY = supportBB.max.y + this.wallHeight / 2;
                    } else { // Hit a ceiling, place below it
                        snappedY = supportBB.min.y - this.wallHeight / 2;
                    }
                } else {
                    return null; // Invalid placement if no support found
                }
                break;
            case 'ceiling':
                // Snap to grid X/Z. Y should be based on foundation grid level + wall height, or top of supporting walls
                const checkPosCeiling = new THREE.Vector3(snappedX, hitPoint.y - this.wallHeight - this.foundationHeight, snappedZ);
                const foundationCeiling = this.findNearestBuildingPart('foundation', checkPosCeiling, this.gridSize * 0.7);
                if (foundationCeiling) {
                    const foundationBB = new THREE.Box3().setFromObject(foundationCeiling.mesh);
                    snappedY = foundationBB.max.y + this.wallHeight + this.ceilingHeight / 2;
                } else {
                    return null; // For now, require foundation context
                }
                break;
            default:
                // Default case, place on ground or surface
                snappedY = hitPoint.y + (this.ghostMesh.geometry.parameters.height / 2 || 0.5);
        }

        // Make sure parameter access is safe
        if (!this.ghostMesh || !this.ghostMesh.geometry || !this.ghostMesh.geometry.parameters) {
            console.error("Ghost mesh geometry invalid in calculateSnappedPosition");
            return null;
        }

        // Final check: ensure position is valid
        const minY = (this.ghostMesh.geometry.parameters.height / 2 || 0) * 0.9;
        if (snappedY < minY) {
            return null; // Invalidate if too low
        }

        return new THREE.Vector3(snappedX, snappedY, snappedZ);
    }

    checkPlacementValidity(itemData) {
        if (!this.ghostMesh || !this.ghostMesh.visible) return false;

        // 1. Check for collisions with other placed objects and world features
        if (this.checkCollision(this.ghostMesh, itemData)) {
            return false;
        }

        // 2. Check for required support
        if (itemData.id === 'wall' || itemData.id === 'wall_window') {
            // Re-check support 
            const checkPosBelow = this.ghostMesh.position.clone().add(new THREE.Vector3(0, -this.wallHeight / 2 - 0.1, 0));
            const support = this.findNearestBuildingPart(['foundation', 'ceiling'], checkPosBelow, this.gridSize * 0.7);
            if (!support) {
                return false;
            }
        } else if (itemData.id === 'ceiling') {
            // Requires wall support at edges and foundation context
            const checkPosBelowFoundation = this.ghostMesh.position.clone().add(new THREE.Vector3(0, -this.wallHeight - this.foundationHeight, 0));
            const foundationContext = this.findNearestBuildingPart('foundation', checkPosBelowFoundation, this.gridSize * 0.7);
            if (!foundationContext) {
                return false;
            }
            
            // Additionally, check for wall support at the edges
            const edgeOffsets = [
                new THREE.Vector3(this.gridSize/2, -this.ceilingHeight/2, 0), // Right
                new THREE.Vector3(-this.gridSize/2, -this.ceilingHeight/2, 0), // Left
                new THREE.Vector3(0, -this.ceilingHeight/2, this.gridSize/2), // Front
                new THREE.Vector3(0, -this.ceilingHeight/2, -this.gridSize/2)  // Back
            ];
            
            // Ceilings need at least one wall support
            let hasWallSupport = false;
            for (const offset of edgeOffsets) {
                // Rotate offset based on building rotation
                const rotatedOffset = offset.clone();
                if (this.buildRotation !== 0) {
                    const angle = THREE.MathUtils.degToRad(this.buildRotation);
                    rotatedOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
                }
                
                const checkPos = this.ghostMesh.position.clone().add(rotatedOffset);
                const wallSupport = this.findNearestBuildingPart(['wall', 'wall_window'], checkPos, 0.5);
                if (wallSupport) {
                    hasWallSupport = true;
                    break;
                }
            }
            
            // If no wall support found, check if this is connected to another ceiling that has support
            if (!hasWallSupport) {
                const ceilingNeighbors = this.findNeighboringCeilings(this.ghostMesh.position);
                if (ceilingNeighbors.length === 0) {
                    return false; // No support and no neighbors, invalid placement
                }
            }
        }

        return true; // Passed all checks
    }

    // Find neighboring ceiling pieces at the same height
    findNeighboringCeilings(position) {
        const neighbors = [];
        const neighborOffsets = [
            new THREE.Vector3(this.gridSize, 0, 0),
            new THREE.Vector3(-this.gridSize, 0, 0),
            new THREE.Vector3(0, 0, this.gridSize),
            new THREE.Vector3(0, 0, -this.gridSize)
        ];
        
        for (const offset of neighborOffsets) {
            const neighborPos = position.clone().add(offset);
            const ceiling = this.findNearestBuildingPart('ceiling', neighborPos, 0.5);
            if (ceiling) {
                neighbors.push(ceiling);
            }
        }
        
        return neighbors;
    }

    checkCollision(meshToCheck, itemData) {
        if (!meshToCheck || !meshToCheck.geometry) return true; // Invalid mesh

        // Use Box3 for collision detection
        const checkBB = new THREE.Box3().setFromObject(meshToCheck);

        // Check against other placed building parts
        for (const placed of this.placedObjects) {
            if (placed.mesh === meshToCheck) continue; // Skip self
            if (!placed.mesh || !placed.mesh.geometry) continue; // Skip invalid placed meshes

            const placedBB = new THREE.Box3().setFromObject(placed.mesh);

            if (checkBB.intersectsBox(placedBB)) {
                // Allow specific overlaps for snapping
                let allowedOverlap = false;
                const placedItemId = placed.itemId;

                // Walls should slightly overlap foundations/ceilings
                if ((itemData.id === 'wall' || itemData.id === 'wall_window') && 
                    (placedItemId === 'foundation' || placedItemId === 'ceiling')) {
                    // Check vertical overlap is minimal
                    const yIntersection = Math.max(0, Math.min(checkBB.max.y, placedBB.max.y) - Math.max(checkBB.min.y, placedBB.min.y));
                    const maxHeight = Math.max(checkBB.max.y - checkBB.min.y, placedBB.max.y - placedBB.min.y);
                    if (yIntersection < maxHeight * 0.1) {
                        allowedOverlap = true;
                    }
                }
                // Ceilings on Walls
                else if (itemData.id === 'ceiling' && (placedItemId === 'wall' || placedItemId === 'wall_window')) {
                    const yIntersection = Math.max(0, Math.min(checkBB.max.y, placedBB.max.y) - Math.max(checkBB.min.y, placedBB.min.y));
                    const maxHeight = Math.max(checkBB.max.y - checkBB.min.y, placedBB.max.y - placedBB.min.y);
                    if (yIntersection < maxHeight * 0.1) {
                        allowedOverlap = true;
                    }
                }
                // Adjacent ceiling pieces
                else if (itemData.id === 'ceiling' && placedItemId === 'ceiling') {
                    // Allow adjacent ceiling pieces (sharing an edge)
                    const xOverlap = Math.max(0, Math.min(checkBB.max.x, placedBB.max.x) - Math.max(checkBB.min.x, placedBB.min.x));
                    const zOverlap = Math.max(0, Math.min(checkBB.max.z, placedBB.max.z) - Math.max(checkBB.min.z, placedBB.min.z));
                    
                    // If overlapping in only one dimension and the overlap is small
                    if ((xOverlap < 0.1 && zOverlap > 0) || (zOverlap < 0.1 && xOverlap > 0)) {
                        allowedOverlap = true;
                    }
                }

                if (!allowedOverlap) {
                    return true; // Collision detected
                }
            }
        }

        // Check collision with world objects (trees, rocks)
        const worldCollidables = this.game.world.getCollidableObjects().filter(o => 
            o.userData?.type === 'resource_node' || o.userData?.type === 'ai'
        );
        
        for (const worldObj of worldCollidables) {
            if (!worldObj.geometry) continue;
            const worldBB = new THREE.Box3().setFromObject(worldObj);
            if (checkBB.intersectsBox(worldBB)) {
                return true; // Collision with world object
            }
        }

        return false; // No collision
    }
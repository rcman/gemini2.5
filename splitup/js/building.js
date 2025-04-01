// js/building.js
// Handles object placement and the build indicator visualization

import { items } from './items.js';
import * as Config from './config.js';
import { inventory, removeFromInventory, getSelectedItem } from './inventory.js';
import { showActionFeedback } from './utils.js';
import { getControls } from './controls.js';

// --- State ---
let buildIndicatorMesh = null;

// --- Setup ---
export function setupBuildIndicator(scene) {
    // Basic wireframe material for the indicator
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,       // White wireframe
        wireframe: true,
        transparent: true,
        opacity: 0.5,
        depthTest: false     // Render on top without depth testing
    });
    // Placeholder geometry, will be replaced dynamically
    buildIndicatorMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    buildIndicatorMesh.visible = false; // Initially hidden
    buildIndicatorMesh.renderOrder = 1; // Attempt to render after solid objects (may or may not work perfectly in r128)
    scene.add(buildIndicatorMesh);
    if (Config.DEBUG) console.log("Build indicator mesh created.");
}

// --- Core Logic ---

// Updates the position, rotation, and visibility of the build indicator
export function updateBuildIndicator(intersection, camera) {
     const controls = getControls();
    // Determine the item the player intends to build
    const selectedItemId = getSelectedItem();
    const itemToBuild = items[selectedItemId];

    // Conditions for showing the indicator:
    // - Controls locked
    // - An item is selected in the toolbar
    // - The selected item is placeable
    // - There's a valid intersection point within reach
    const shouldBeVisible =
        controls && controls.isLocked &&
        selectedItemId &&
        itemToBuild &&
        itemToBuild.placeable &&
        intersection &&
        intersection.distance <= Config.PLACEMENT_REACH;

    if (!buildIndicatorMesh) return; // Safety check

    if (shouldBeVisible) {
        const pos = calculateSnappedPosition(intersection, itemToBuild);
        if (!pos) { // If snapping fails (e.g., invalid surface)
            buildIndicatorMesh.visible = false;
            return;
        }

        // Update geometry if the selected item changed
        if (buildIndicatorMesh.geometry !== itemToBuild.geometry) {
            // Dispose of old geometry (good practice, might not be strictly necessary or work fully in r128)
            if (buildIndicatorMesh.geometry && buildIndicatorMesh.geometry.dispose) {
                buildIndicatorMesh.geometry.dispose();
            }
            buildIndicatorMesh.geometry = itemToBuild.geometry;
        }

        // Set position and rotation
        buildIndicatorMesh.position.copy(pos);
        buildIndicatorMesh.rotation.copy(calculatePlacementRotation(itemToBuild, camera)); // Calculate rotation based on item type and view

        buildIndicatorMesh.visible = true;
    } else {
        // Hide the indicator if conditions aren't met
        buildIndicatorMesh.visible = false;
    }
}

// Calculates the grid-snapped position for placement
function calculateSnappedPosition(intersection, item) {
    if (!intersection || !item || !item.size || !intersection.face || !intersection.object) {
        // console.warn("Cannot calculate snapped position: Missing data", { intersection, item });
        return null;
    }

    const normal = intersection.face.normal.clone();
    const point = intersection.point.clone();
    const size = item.size; // Pre-calculated item size
    // Determine grid size based on build type (foundations, walls use larger grid)
    const grid = (item.buildType === "foundation" || item.buildType === "wall" || item.buildType === "roof" || item.buildType === "door" || item.buildType === "wall_window" || item.buildType === "wall_door")
                 ? Config.PLACEMENT_GRID_SIZE : 1; // Smaller items snap to 1x1 grid
    const offsetDistance = 0.01; // Small offset to avoid z-fighting

    // Move point slightly along the normal away from the surface
    const adjustedPoint = point.add(normal.multiplyScalar(offsetDistance));

    // Snap X and Z coordinates to the grid
    let snapX = Math.round(adjustedPoint.x / grid) * grid;
    let snapZ = Math.round(adjustedPoint.z / grid) * grid;
    let snapY;

    const targetObject = intersection.object;
    const targetIsGround = targetObject.name === 'ground';
    // Check if target is a placed object by checking its userData (more reliable than array check)
    const targetIsPlaced = targetObject.userData && targetObject.userData.placedTime;
    const targetBuildType = targetObject.userData?.buildType;
    const targetGeometryParams = targetObject.geometry?.parameters; // Check if parameters exist (BoxGeometry should have them)

    // Calculate Y position based on item type and what it's being placed on
    // Default: Place base slightly above intersection point
    snapY = adjustedPoint.y + size.y / 2;

    if (item.buildType === 'foundation') {
         // Snap foundation base height to grid increments or place on ground
         snapY = targetIsGround ? Config.foundationH / 2 : Math.round(adjustedPoint.y / Config.foundationH) * Config.foundationH + Config.foundationH / 2;
    } else if (item.buildType === 'wall' || item.buildType === 'wall_window' || item.buildType === 'wall_door') {
        // Place on top of foundations or other walls
        if (targetIsPlaced && targetBuildType === 'foundation' && targetGeometryParams?.height) {
            snapY = targetObject.position.y + targetGeometryParams.height / 2 + size.y / 2;
        }
        // Allow stacking walls (might need refinement for stability)
        else if (targetIsPlaced && targetBuildType === 'wall' && targetGeometryParams?.height) {
             snapY = targetObject.position.y + targetGeometryParams.height / 2 + size.y / 2;
        }
        // Adjust X/Z snapping relative to the target point for walls
         snapX = Math.round(point.x / grid) * grid;
         snapZ = Math.round(point.z / grid) * grid;
    } else if (item.buildType === 'roof') {
         // Place on top of walls
        if (targetIsPlaced && (targetBuildType === 'wall' || targetBuildType === 'wall_window' || targetBuildType === 'wall_door') && targetGeometryParams?.height) {
            snapY = targetObject.position.y + targetGeometryParams.height / 2 + size.y / 2;
        }
         snapX = Math.round(point.x / grid) * grid;
         snapZ = Math.round(point.z / grid) * grid;
    } else if (item.buildType === 'door') {
         // Doors are typically placed within 'wall_door' frames, snap relative to point
         snapY = adjustedPoint.y + size.y / 2; // Adjust Y based on the target surface, assuming it's the bottom of the doorway
         // Find the wall it's attached to? For now, basic snapping.
          snapX = Math.round(point.x / grid) * grid;
          snapZ = Math.round(point.z / grid) * grid;
          // Needs logic to ensure it's placed *inside* a Wall(Door) frame, potentially using the normal/intersection face.
    } else if (item.buildType === 'torch') {
         // Place torch slightly offset from the wall surface
         snapY = point.y + size.y * 0.4; // Place base near intersection point
    }


    // Ensure object base is slightly above ground level
    if (snapY - size.y / 2 < 0.01) {
        snapY = size.y / 2 + 0.01;
    }

    return new THREE.Vector3(snapX, snapY, snapZ);
}

// Calculates the Y rotation for placement (e.g., aligning walls)
function calculatePlacementRotation(item, camera) {
     const rotation = new THREE.Euler(0, 0, 0, 'YXZ'); // Use Euler for simplicity

     // Walls, doors, etc., should align parallel or perpendicular to player view
    if (item.buildType === "wall" || item.buildType === "door" || item.buildType === "wall_window" || item.buildType === "wall_door") {
        const lookDirection = new THREE.Vector3();
        camera.getWorldDirection(lookDirection); // Get camera's forward direction
        lookDirection.y = 0; // Ignore vertical component
        lookDirection.normalize();

        // Snap rotation to 0 or 90 degrees based on whether X or Z component is larger
        rotation.y = Math.abs(lookDirection.x) > Math.abs(lookDirection.z) ? Math.PI / 2 : 0;
    }
    // Other items (like foundations, resources, torches) typically don't need specific rotation on placement
    // else { rotation.y = 0; } // Default rotation

    return rotation;
}


// Attempts to place the currently selected item at the targeted location
export function placeSelectedItem(raycaster, camera, scene, placedObjectsArray) {
    const itemId = getSelectedItem();
    const item = items[itemId];

    // Check if placement is possible
    if (!itemId || !item || !item.placeable || !buildIndicatorMesh || !buildIndicatorMesh.visible) {
         // showActionFeedback("Cannot place item"); // Feedback given by indicator visibility
        return;
    }
     const controls = getControls();
     if (!controls || !controls.isLocked) return; // Need controls locked


    // Perform raycast again specifically for placement action (indicator might use cached result)
    try {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); // Ray from center screen
    } catch (e) {
        console.error("Raycaster failed in placeSelectedItem:", e);
        showActionFeedback("Placement Error (Raycaster)");
        return;
    }

    // Define potential targets: ground and already placed objects
    const targets = [scene.getObjectByName("ground"), ...placedObjectsArray].filter(Boolean);
    const intersects = raycaster.intersectObjects(targets, false); // Don't check children unless needed

    if (intersects.length > 0) {
        const intersection = intersects[0];
        // Double-check reach just before placing
        if (intersection.distance > Config.PLACEMENT_REACH) {
            showActionFeedback("Too far away");
            return;
        }

        // Use the indicator's calculated position and rotation for consistency
        const pos = buildIndicatorMesh.position.clone();
        const rot = buildIndicatorMesh.rotation.clone();

        // Check inventory and remove item
        if (removeFromInventory(itemId, 1)) {
            // Create the mesh for the placed object
            const mesh = new THREE.Mesh(item.geometry, item.material);
            mesh.position.copy(pos);
            mesh.rotation.copy(rot);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            // Store item info in userData for later identification
            mesh.userData = {
                itemId: itemId,
                buildType: item.buildType,
                placedTime: Date.now() // Useful for identifying placed objects
            };
            mesh.name = `placed_${itemId}_${placedObjectsArray.length}`; // Unique-ish name

            scene.add(mesh);
            placedObjectsArray.push(mesh); // Add to the list of placed objects

            // Add light source for items like torches
            if (item.light) {
                // PointLight args: color, intensity, distance (r128)
                const light = new THREE.PointLight(0xffaa00, 0.8, 12);
                light.castShadow = false; // Usually don't need shadows from small lights
                // Position light source relative to the object (e.g., top of torch)
                light.position.set(0, item.size.y * 0.4, 0); // Adjust as needed
                mesh.add(light); // Attach light to the mesh
            }

            showActionFeedback(`Placed ${item.name}`);
            // UI updates are handled by removeFromInventory

        } else {
             // This case should be less common now as indicator visibility depends on having the item
            showActionFeedback(`No ${item.name} in inventory`);
        }
    } else {
        // showActionFeedback("Cannot place here"); // Feedback handled by indicator
    }
}
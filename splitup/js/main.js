// js/main.js
// Main application entry point, orchestrates modules and runs the game loop

// External Libs (Assume loaded globally via script tags in index.html)
// import * as THREE from 'three'; // Not needed if using global THREE from CDN

// Core Modules
import * as Config from './config.js';
import { items, initializeItemData } from './items.js';
import { recipes } from './recipes.js';
import { showActionFeedback } from './utils.js';
import { inventory, initializeInventory, addToInventory, setSelectedToolbarIndex, getSelectedItem, toolbarItems } from './inventory.js';
import { updateInventoryUI, updateToolbarUI, updateCraftingUI, toggleCraftingMenu, setupUICloseButtons } from './ui.js';
import { craftItem } from './crafting.js';
import { createInitialWorld } from './world.js';
import { setupControls, getControls } from './controls.js';
import { setupBuildIndicator, updateBuildIndicator, placeSelectedItem } from './building.js';


// --- Global Variables (Game State) ---
let camera, scene, renderer;
let controls = null; // Will be initialized by setupControls
const objects = []; // Harvestable/interactable world objects (trees, rocks)
const placedObjects = []; // Objects placed by the player
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// Raycasting
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0); // Center of the screen for raycasting


// --- Initialization ---
function init() {
    if (Config.DEBUG) console.log("init() started - Using THREE r128 (Modular)");

    // Basic THREE.js setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0x87CEEB, 50, Config.worldScale * 0.85); // Fog matches background

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Camera position will be set by controls later

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
     // r128 might default to PCFShadowMap or require setting slightly differently
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Keep trying PCFSoft
    document.body.appendChild(renderer.domElement);

    // Pre-process item data (materials, sizes) AFTER THREE is ready
    initializeItemData();

    // Generate the world (lighting, ground, features)
    // Pass scene and the objects array for population
    createInitialWorld(scene, objects);

    // Setup player inventory
    initializeInventory();

    // Initial UI updates
    updateInventoryUI();
    updateToolbarUI();
    updateCraftingUI(); // Initial population, even if hidden
    setupUICloseButtons(); // Hook up close buttons

    // Setup build indicator mesh
    setupBuildIndicator(scene); // Pass the scene to add the mesh

    // Setup pointer lock controls
    // Pass camera and the renderer's DOM element (for event listeners)
    controls = setupControls(camera, renderer.domElement);
    if (!controls) {
        console.error("Controls setup failed. Game cannot run correctly.");
        // Blocker should already show error message
        return; // Stop initialization if controls failed
    }
     // Set initial player position via the controls object
     // controls.getObject() returns the camera holder (Object3D)
     controls.getObject().position.set(0, Config.playerHeight, 5);
     scene.add(controls.getObject()); // Add the controls' object (camera holder) to the scene

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    // Use pointerdown for mouse clicks (covers touch and mouse)
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

     // Prevent context menu on right-click (for placement)
     document.addEventListener('contextmenu', (event) => {
         if (controls && controls.isLocked) {
             event.preventDefault();
         }
     });


    // Start the animation loop
    animate();
    if (Config.DEBUG) console.log("Initialization complete. Starting animation loop.");
}

// --- Player Actions ---

function useTool() {
    if (!controls || !controls.isLocked) return;

    const selectedItemId = getSelectedItem();
    const toolItem = items[selectedItemId];

    // Check if a valid tool is selected
    // Allow interaction even without a tool (e.g., punching - add later?)
    // if (!toolItem || !toolItem.toolType) {
    //     showActionFeedback("Select a tool");
    //     return;
    // }

    // Perform raycast from camera center
    try {
        raycaster.setFromCamera(pointer, camera);
    } catch (e) {
        console.error("Raycaster failed in useTool:", e);
        showActionFeedback("Interaction Error (Raycaster)");
        return;
    }

    // Intersect against harvestable objects ('objects' array)
    // Pass `true` for recursive check if interactable parts are children of a group (like trees)
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        if (intersection.distance <= Config.INTERACTION_REACH) {
            let targetObject = intersection.object;
            // Traverse up the hierarchy to find the parent group with userData (e.g., for trees)
            while (targetObject.parent && (!targetObject.userData || !targetObject.userData.type)) {
                targetObject = targetObject.parent;
            }

            // Check if the found object has harvestable data
            if (targetObject.userData && targetObject.userData.type && targetObject.userData.resource) {
                const data = targetObject.userData;
                // Check if the correct tool is equipped (or if no tool is required)
                if (!data.tool || (toolItem && data.tool === toolItem.toolType)) {
                    harvestResource(targetObject);
                } else if (data.tool) {
                    showActionFeedback(`Requires ${data.tool}`);
                } else {
                     // This case shouldn't normally happen if data.resource exists
                     showActionFeedback("Cannot harvest this");
                }
            } else {
                 // Clicked on something within reach, but not harvestable
                 // showActionFeedback("Cannot interact"); // Optional feedback
            }
        } else {
             // Object hit, but too far away
             // showActionFeedback("Too far away"); // Optional feedback
        }
    }
}

function harvestResource(targetObject) {
    if (!targetObject || !targetObject.userData) return;

    const data = targetObject.userData;
    const resource = data.resource;
    const amount = data.yieldAmount;
    const secondaryResource = data.secondaryResource;
    const secondaryAmount = data.secondaryYield;
    let feedback = "";

    // Add primary resource
    if (resource && amount > 0 && items[resource]) {
        addToInventory(resource, amount);
        feedback += `+${amount} ${items[resource].name}`;
    }
    // Add secondary resource (if any)
    if (secondaryResource && secondaryAmount > 0 && items[secondaryResource]) {
        addToInventory(secondaryResource, secondaryAmount);
        feedback += (feedback ? " " : "") + `+${secondaryAmount} ${items[secondaryResource].name}`; // Add space if needed
    }

    if(feedback) showActionFeedback(feedback);

    // Remove the object from the scene and the interactable list
    scene.remove(targetObject);
    const index = objects.indexOf(targetObject);
    if (index > -1) {
        objects.splice(index, 1);
    } else {
        console.warn("Harvested object not found in 'objects' array?", targetObject.name);
    }
    // UI updates are handled by addToInventory calls
}


// --- Event Handlers ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerDown(event) {
     if (controls && controls.isLocked) {
         // event.button: 0 = Left, 1 = Middle, 2 = Right
        switch (event.button) {
            case 0: // Left Click - Harvest/Attack/Interact
                useTool();
                break;
            case 2: // Right Click - Place Item
                 // placeSelectedItem handles reach check and inventory deduction
                 placeSelectedItem(raycaster, camera, scene, placedObjects);
                 // Prevent context menu from appearing
                 event.preventDefault();
                break;
        }
    }
    // Note: No preventDefault needed for left click here, as it doesn't have a default browser action in this context
}


function onKeyDown(event) {
    // Handle UI toggles regardless of lock state
    switch (event.code) {
        case "KeyC":
            toggleCraftingMenu(); // Handles its own lock/unlock logic
            return; // Prevent movement keys if opening menu
        case "Digit1": case "Digit2": case "Digit3": case "Digit4": case "Digit5":
        case "Digit6": case "Digit7": case "Digit8": case "Digit9":
             const index = parseInt(event.code.slice(5)) - 1;
             if (setSelectedToolbarIndex(index)) {
                  // Selection changed, update build indicator immediately
                  updateBuildIndicator(null, camera); // Pass null intersection, camera needed for rotation calc
             }
            return; // Prevent default number actions
    }

    // Handle movement only if controls are locked
    if (controls && controls.isLocked) {
        switch (event.code) {
            case "ArrowUp": case "KeyW": moveForward = true; break;
            case "ArrowLeft": case "KeyA": moveLeft = true; break;
            case "ArrowDown": case "KeyS": moveBackward = true; break;
            case "ArrowRight": case "KeyD": moveRight = true; break;
            case "Space":
                 if (canJump) {
                     velocity.y += 350; // Apply jump force (adjust value as needed)
                     canJump = false;
                 }
                 break;
        }
    }
}

function onKeyUp(event) {
    // Update movement flags (works fine regardless of lock state)
    switch (event.code) {
        case "ArrowUp": case "KeyW": moveForward = false; break;
        case "ArrowLeft": case "KeyA": moveLeft = false; break;
        case "ArrowDown": case "KeyS": moveBackward = false; break;
        case "ArrowRight": case "KeyD": moveRight = false; break;
    }
}


// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate); // Loop

    const time = performance.now();
    const delta = (time - prevTime) / 1000; // Time delta in seconds
    let intersection = null; // Result of raycast for interaction/building preview

    // --- Update logic only when controls are locked ---
    if (controls && controls.isLocked) {
        // 1. Physics Simulation (Simplified)
        velocity.x -= velocity.x * 10.0 * delta; // Air resistance / damping X
        velocity.z -= velocity.z * 10.0 * delta; // Air resistance / damping Z
        velocity.y -= 9.8 * 100.0 * delta; // Gravity (scaled for effect)

        // Calculate movement direction based on input flags
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // Ensure consistent speed diagonally

        // Apply movement velocity based on direction
        const speed = 400.0; // Movement speed factor
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

        // Apply movement using controls methods (handles rotation)
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);

        // Apply vertical velocity (jumping/falling)
        controls.getObject().position.y += velocity.y * delta;

        // 2. Collision Detection (Simple Ground Collision)
        if (controls.getObject().position.y < Config.playerHeight) {
            velocity.y = 0; // Stop falling
            controls.getObject().position.y = Config.playerHeight; // Prevent sinking
            canJump = true; // Allow jumping again
        }

        // 3. Raycasting for Interaction/Building Preview
        try {
             raycaster.setFromCamera(pointer, camera);
             // Define potential targets for the preview raycast
             const interactionTargets = [scene.getObjectByName("ground"), ...placedObjects, ...objects].filter(Boolean);
             // Check recursively for complex objects (like trees)
             const intersects = raycaster.intersectObjects(interactionTargets, true);

             // Find the closest valid intersection within reach
             for (const hit of intersects) {
                 // Check if the hit object is suitable (not the build indicator itself)
                  if (hit.object !== buildIndicatorMesh && hit.distance <= Config.PLACEMENT_REACH) {
                      intersection = hit;
                      break; // Use the first valid hit
                  }
             }
        } catch (e) {
            if (Config.DEBUG) console.warn("Raycasting failed in animate loop:", e);
            intersection = null; // Ensure intersection is null if raycast fails
        }

    } // --- End of (controls && controls.isLocked) block ---

    // 4. Update Build Indicator (runs even if unlocked to hide it correctly)
    // Pass the current intersection result and camera
     updateBuildIndicator(intersection, camera);

    // 5. Rendering
    renderer.render(scene, camera);
    prevTime = time; // Update previous time for next frame delta
}


// --- Start Application ---
// Perform initial checks
function run() {
    const loadingErrorElement = document.getElementById("loading-error");
    const versionWarningElement = document.getElementById("version-warning");

    // Check if THREE core loaded
    if (typeof THREE === 'undefined') {
        loadingErrorElement.textContent = "FATAL ERROR: Three.js core library (r128) failed to load from HTTP CDN. Check network or CDN link.";
        // Blocker remains visible by default
        return; // Stop execution
    }

     // Check if PointerLockControls loaded (it attaches to THREE in r128)
     if (typeof THREE.PointerLockControls === 'undefined') {
          // Log error, but attempt to continue - setupControls will handle the fatal aspect
          loadingErrorElement.textContent = "ERROR: PointerLockControls (for r128) failed to load. Controls will NOT work.";
     } else {
         loadingErrorElement.textContent = ""; // Clear loading errors if core libs are okay
     }

     // Add general warning about the version/HTTP
     versionWarningElement.textContent = "Warning: Using older Three.js (r128) via potentially unreliable HTTP. Some features might differ from modern versions.";


    // If THREE is loaded, proceed with initialization
    init();
}

// Run the application initialization checks
run();
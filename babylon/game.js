// Ensure Babylon.js and loaders/GUI are loaded before this script in index.html

// Get the canvas element
const canvas = document.getElementById('renderCanvas');
// Get UI elements
const uiContainer = document.getElementById('uiContainer');
const inventoryPanel = document.getElementById('inventoryPanel');
const inventoryGrid = document.getElementById('inventoryGrid');
const closeInventoryBtn = document.getElementById('closeInventoryBtn');
const quickBarSlots = document.querySelectorAll('#quickBar .slot');
const interactionPrompt = document.getElementById('interactionPrompt');
const craftingMenu = document.getElementById('craftingMenu');
const craftingList = document.getElementById('craftingList');
const closeCraftingBtn = document.getElementById('closeCraftingBtn');
const lootContainer = document.getElementById('lootContainer');
const lootGrid = document.getElementById('lootGrid');
const closeLootBtn = document.getElementById('closeLootBtn');
const messageLog = document.getElementById('messageLog');


// --- Babylon.js Engine Setup ---
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
let scene; // Global scene object

// --- Game State ---
let player = null;
let playerInventory = []; // Array to hold inventory items { id: 'wood', name: 'Wood', quantity: 10, icon: 'path/to/wood.png' }
let quickBar = new Array(5).fill(null); // Fixed size quick bar
let isInventoryOpen = false;
let isCraftingOpen = false;
let isLootOpen = false;
const PLAYER_REACH = 5; // How far the player can interact
let highlightedMesh = null; // Mesh the player is looking at
let currentLootSource = null; // Reference to the barrel/container being looted
const inputMap = {}; // Stores current key states
const MAX_INVENTORY_SLOTS = 20;


// --- Item & Crafting Definitions ---
// IMPORTANT: Replace 'assets/icons/...' with actual paths to your icon images
const items = {
    'wood': { name: 'Wood', stackable: true, icon: 'assets/icons/wood.png' },
    'stone': { name: 'Stone', stackable: true, icon: 'assets/icons/stone.png' },
    'scrap_metal': { name: 'Scrap Metal', stackable: true, icon: 'assets/icons/scrap.png' },
    'nails': { name: 'Nails', stackable: true, icon: 'assets/icons/nails.png' },
    'grass': { name: 'Grass', stackable: true, icon: 'assets/icons/grass.png' },
    'rope': { name: 'Rope', stackable: true, icon: 'assets/icons/rope.png' },
    'raw_meat': { name: 'Raw Meat', stackable: true, icon: 'assets/icons/raw_meat.png' },
    'cooked_meat': { name: 'Cooked Meat', stackable: true, icon: 'assets/icons/cooked_meat.png' },
    'leather': { name: 'Leather', stackable: true, icon: 'assets/icons/leather.png' },
    'fat': { name: 'Animal Fat', stackable: true, icon: 'assets/icons/fat.png' },
    'water_dirty': { name: 'Dirty Water', stackable: false, icon: 'assets/icons/water_dirty.png' }, // Can only be in canteen
    'water_clean': { name: 'Clean Water', stackable: false, icon: 'assets/icons/water_clean.png' }, // Can only be in canteen
    'axe': { name: 'Axe', stackable: false, placeable: false, tool: 'axe', icon: 'assets/icons/axe.png' },
    'pickaxe': { name: 'Pickaxe', stackable: false, placeable: false, tool: 'pickaxe', icon: 'assets/icons/pickaxe.png' },
    'knife': { name: 'Knife', stackable: false, placeable: false, tool: 'knife', icon: 'assets/icons/knife.png' },
    'canteen': { name: 'Canteen', stackable: false, placeable: false, icon: 'assets/icons/canteen.png', contains: null, capacity: 1 }, // Special item
    'campfire': { name: 'Campfire', stackable: true, placeable: true, icon: 'assets/icons/campfire.png', model: 'campfire.glb' }, // NOTE: Uses simple stacking for now, should maybe be false. Model path relative to assets/models/
    'crafting_table': { name: 'Crafting Table', stackable: true, placeable: true, icon: 'assets/icons/crafting_table.png', model: 'crafting_table.glb' },
    'forge': { name: 'Forge', stackable: true, placeable: true, icon: 'assets/icons/forge.png', model: 'forge.glb' },
    'metal_ingot': { name: 'Metal Ingot', stackable: true, icon: 'assets/icons/ingot.png' },
    // Add more items...
};

const recipes = {
    'rope': { requires: { 'grass': 4 }, creates: { id: 'rope', quantity: 1 } },
    'axe': { requires: { 'wood': 5, 'stone': 3 }, creates: { id: 'axe', quantity: 1 } },
    'pickaxe': { requires: { 'wood': 5, 'stone': 3 }, creates: { id: 'pickaxe', quantity: 1 } },
    'campfire': { requires: { 'wood': 8, 'stone': 4 }, creates: { id: 'campfire', quantity: 1 } },
    'crafting_table': { requires: { 'wood': 10, 'nails': 4 }, creates: { id: 'crafting_table', quantity: 1 } },
    'forge': { requires: { 'stone': 20, 'wood': 5 }, creates: { id: 'forge', quantity: 1 } },
    // Add more recipes...
    // 'metal_ingot': { requires: {'scrap_metal': 5, /* fuel? */}, creates: {id: 'metal_ingot', quantity: 1}, station: 'forge'} // Example requiring forge
};


// --- Function to Create the Scene ---
async function createScene() {
    scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;
    // Optional: Add fog
    // scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    // scene.fogDensity = 0.01;
    // scene.fogColor = new BABYLON.Color3(0.7, 0.8, 0.9);

    // Camera - ArcRotateCamera for 3rd person view
    // Using UniversalCamera might be better for direct player control feel
    const camera = new BABYLON.UniversalCamera("playerCamera", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero()); // Initial target
    camera.attachControl(canvas, true);
    camera.speed = 0.15; // Adjust camera movement speed if needed (mostly for detached mode)
    camera.inputs.remove(camera.inputs.attached.keyboard); // Remove default keyboard input, we'll control player directly
    camera.inputs.removeByType("FreeCameraMouseInput"); // Remove default mouse look, we'll implement our own or use pointer lock

    // We need pointer lock for typical 3rd person mouse look
    scene.onPointerDown = (evt) => {
        if (!isInventoryOpen && !isCraftingOpen && !isLootOpen && evt.button === 0) { // Left click
            canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
            canvas.requestPointerLock();
        }
    };


    // Lighting
    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0.5, 1, 0.25), scene);
    light.intensity = 0.8;
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, light); // Optional shadows
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;


    // --- Player Setup ---
    // *** Replace with actual player model loading ***
    player = BABYLON.MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
    player.position = new BABYLON.Vector3(0, 1, 0); // Start position slightly above ground
    player.checkCollisions = true;
    player.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4); // Collision volume
    player.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0); // Center the ellipsoid
    player.speed = 4; // Player movement speed (units per second)
    player.rotationQuaternion = BABYLON.Quaternion.Identity(); // Use quaternions for rotations
    player.inventory = playerInventory; // Link inventory data
    player.quickBar = quickBar;         // Link quick bar data

    // Make player mesh invisible, or load a real model and parent the camera to it/its head bone
    player.visibility = 0.0; // Hide the capsule

    // Attach camera to player capsule (simple attachment)
    camera.parent = player;
    camera.position = new BABYLON.Vector3(0, 1.6, -3); // Offset behind and slightly above the player capsule's origin


    // --- Ground ---
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
    ground.checkCollisions = true;
    ground.receiveShadows = true; // Allow shadows on the ground
    // Apply a texture (replace 'assets/textures/ground.jpg' with your texture)
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    try { // Use try-catch for texture loading
        groundMat.diffuseTexture = new BABYLON.Texture("assets/textures/grass.jpg", scene); // Example texture
        groundMat.diffuseTexture.uScale = 10; // Tile texture
        groundMat.diffuseTexture.vScale = 10;
        groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Reduce shininess
    } catch (e) { console.warn("Ground texture not found"); }
    ground.material = groundMat;


    // --- World Objects (Placeholders - Replace with Asset Loading & Random Placement) ---
    // Trees
    for (let i = 0; i < 30; i++) {
        // *** Replace with Tree model loading ***
        const tree = BABYLON.MeshBuilder.CreateCylinder(`tree_${i}`, { height: 8 + Math.random() * 4, diameterTop: 0.2 + Math.random() * 0.5, diameterBottom: 1 + Math.random(), tessellation: 12 }, scene);
        tree.position = new BABYLON.Vector3((Math.random() - 0.5) * 180, tree.scaling.y * (tree.height / 2), (Math.random() - 0.5) * 180);
        tree.checkCollisions = true;
        tree.metadata = { type: "resource", resourceId: "wood", health: 100, tool: "axe" };
        shadowGenerator.addShadowCaster(tree);
         // Simple brown material
        const treeMat = new BABYLON.StandardMaterial(`treeMat_${i}`, scene);
        treeMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.15);
        tree.material = treeMat;
    }

    // Rocks
    for (let i = 0; i < 40; i++) {
        // *** Replace with Rock model loading ***
        const rock = BABYLON.MeshBuilder.CreateSphere(`rock_${i}`, { diameter: 1 + Math.random() * 2, segments: 8 }, scene);
        rock.position = new BABYLON.Vector3((Math.random() - 0.5) * 180, rock.scaling.y * (rock.diameter / 2), (Math.random() - 0.5) * 180);
        rock.checkCollisions = true;
        rock.metadata = { type: "resource", resourceId: "stone", health: 80, tool: "pickaxe" };
        shadowGenerator.addShadowCaster(rock);
        // Simple gray material
        const rockMat = new BABYLON.StandardMaterial(`rockMat_${i}`, scene);
        rockMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
        rock.material = rockMat;
    }

    // Barrels (Lootable)
    for (let i = 0; i < 10; i++) {
         // *** Replace with Barrel model loading ***
        const barrel = BABYLON.MeshBuilder.CreateCylinder(`barrel_${i}`, { height: 1.2, diameter: 0.8, tessellation: 12 }, scene);
        barrel.position = new BABYLON.Vector3((Math.random() - 0.5) * 150, 0.6, (Math.random() - 0.5) * 150);
        barrel.checkCollisions = true;
        barrel.metadata = { type: "lootable", lootTable: ["scrap_metal", "nails", "rope", "fat"] }; // Example loot pool
        shadowGenerator.addShadowCaster(barrel);
        // Simple brown material
        const barrelMat = new BABYLON.StandardMaterial(`barrelMat_${i}`, scene);
        barrelMat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2);
        barrel.material = barrelMat;
    }

    // Building Placeholder
     // *** Replace with actual Building model loading, including interior and doorways ***
    const building = BABYLON.MeshBuilder.CreateBox("building", {width: 8, height: 4, depth: 6}, scene);
    building.position = new BABYLON.Vector3(-15, 2, -10);
    building.checkCollisions = true;
    building.metadata = { type: "building" }; // Could contain lootable containers inside later
    shadowGenerator.addShadowCaster(building);


    // Scrap Metal Pickup (Example)
    // *** Replace with Scrap model loading ***
    const scrap = BABYLON.MeshBuilder.CreatePlane("scrap", {size: 0.5}, scene);
    scrap.position = new BABYLON.Vector3(2, 0.1, 3); // Slightly above ground
    scrap.rotation.x = Math.PI / 2;
    scrap.metadata = { type: "pickup", itemId: "scrap_metal", quantity: Math.floor(Math.random() * 3) + 1 };
    // Simple gray material
    const scrapMat = new BABYLON.StandardMaterial(`scrapMat`, scene);
    scrapMat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.7);
    scrapMat.backFaceCulling = false; // See both sides of the plane
    scrap.material = scrapMat;

    // Tall Grass (Visual only placeholder - Use billboards or instanced planes with texture)
    // ... implementation requires more detail ...

    // Water Plane (Needs better material like WaterMaterial for proper look)
    const water = BABYLON.MeshBuilder.CreateGround("water", {width: 80, height: 80}, scene);
    water.position = new BABYLON.Vector3(60, -0.1, 60); // Slightly below ground
    const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
    waterMat.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8);
    waterMat.alpha = 0.7; // Transparency
    water.material = waterMat;
    water.metadata = { type: "water" };


    // --- Animated Animals (Complex - Placeholder Logic) ---
    // *** Requires loading animated models and implementing AI ***
    /*
    try {
        const animalResult = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/models/", "animated_deer.glb", scene);
        const deer = animalResult.meshes[0];
        deer.position = new BABYLON.Vector3(15, 0, 15);
        deer.metadata = {
             type: "animal",
             species: "deer",
             health: 50,
             isDead: false,
             drops: { 'raw_meat': 3, 'leather': 2, 'fat': 1 },
             state: 'idle' // For AI: idle, roam, flee, attack
        };
        shadowGenerator.addShadowCaster(deer);
        // Need to handle animation groups and AI logic (roaming, fleeing, etc.)
        // const idleAnim = scene.getAnimationGroupByName("Idle");
        // const runAnim = scene.getAnimationGroupByName("Run");
        // if (idleAnim) idleAnim.start(true);
    } catch (e) { console.warn("Could not load animal model"); }
    */


    // --- Initialize Player Gear ---
    addItemToInventory('axe', 1);
    addItemToInventory('pickaxe', 1);
    addItemToInventory('knife', 1);
    addItemToInventory('canteen', 1); // The canteen object itself
    // Optionally fill the canteen with dirty water initially
    const canteenItem = findInventoryItem('canteen');
    if (canteenItem) {
         canteenItem.item.contains = { id: 'water_dirty', quantity: 1 };
    }
    // Move first 4 items to quickbar
    moveItem('inventory', 0); // Axe to QB 0
    moveItem('inventory', 0); // Pickaxe to QB 1 (inv index 0 shifts)
    moveItem('inventory', 0); // Knife to QB 2
    moveItem('inventory', 0); // Canteen to QB 3


    // --- Initial UI Update ---
    updateInventoryUI();
    updateQuickBarUI();
    updateCraftingUI();


    // --- Input Handling Setup ---
    // Action Manager needs to be attached to the scene *after* it's created
    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = true;
        handleKeyPress(evt.sourceEvent.key.toLowerCase()); // Handle single presses for UI toggles etc.
    }));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = false;
    }));
    // --- End Input Handling Setup ---


    // --- Physics Engine (Optional but recommended for gravity/more complex collisions) ---
    // scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), new BABYLON.CannonJSPlugin()); // Or OimoJSPlugin
    // ground.physicsImpostor = new BABYLON.PhysicsImpostor(ground, BABYLON.PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 0.9 }, scene);
    // player.physicsImpostor = new BABYLON.PhysicsImpostor(player, BABYLON.PhysicsImpostor.CapsuleImpostor, { mass: 1, restitution: 0.1 }, scene);
    // Need to adjust movement logic if using physics impostors


    return scene; // Return the fully initialized scene
}


// --- Input Handling for Single Presses ---
function handleKeyPress(key) {
    if (key === "tab") {
        // Allow opening inventory even if other menus are open (to close them implicitly)
        toggleInventory();
    } else if (key === "c" && !isInventoryOpen && !isLootOpen) { // Example: 'C' for crafting
         toggleCraftingMenu();
    } else if (key === "escape") { // Escape to close any open UI
         if (isInventoryOpen) toggleInventory();
         else if (isCraftingOpen) toggleCraftingMenu();
         else if (isLootOpen) closeLootContainer();
         // Could add a pause menu here too
    } else if (key === "e") {
        // Interaction handled in render loop via handleInteraction() checking inputMap["e"]
        // We check inputMap["e"] there to prevent interacting multiple times per press
    } else if (key === "p") {
        // Placing handled in render loop via handlePlacing() checking inputMap["p"]
    }
     // Quick Bar Selection (Example: 1-5 keys)
     if (!isInventoryOpen && !isCraftingOpen && !isLootOpen) {
         const numKey = parseInt(key);
         if (!isNaN(numKey) && numKey >= 1 && numKey <= quickBar.length) {
             setActiveQuickBarSlot(numKey - 1);
         }
     }
}

let activeQuickBarIndex = 0; // Track the active slot
function setActiveQuickBarSlot(index) {
    // Remove highlight from previous slot
    if (quickBarSlots[activeQuickBarIndex]) {
        quickBarSlots[activeQuickBarIndex].style.border = '1px solid #555';
    }
    activeQuickBarIndex = index;
    // Add highlight to new slot
    if (quickBarSlots[activeQuickBarIndex]) {
        quickBarSlots[activeQuickBarIndex].style.border = '2px solid yellow';
    }
    logMessage(`Selected: ${items[quickBar[activeQuickBarIndex]?.id]?.name || 'Empty Slot'}`);
}


// --- Player Movement & Look ---
let playerTargetRotationY = 0;
const rotationSpeed = 0.05; // Mouse sensitivity

function handlePlayerMovement(deltaTime) {
    if (!player || isInventoryOpen || isCraftingOpen || isLootOpen) return; // Don't move if UI is open

    const moveSpeed = player.speed * deltaTime; // Speed adjusted for frame time
    let moveDirection = BABYLON.Vector3.Zero();

    // --- Mouse Look (only when pointer is locked) ---
    if (document.pointerLockElement === canvas) {
        // Simplified mouse look - directly rotate the player capsule horizontally
        playerTargetRotationY += engine.getRenderingCanvas().movementX * rotationSpeed * 0.01; // Adjust sensitivity multiplier as needed
        // Apply rotation smoothly (optional, can directly set rotation.y)
         player.rotationQuaternion = BABYLON.Quaternion.RotationYawPitchRoll(playerTargetRotationY, 0, 0);

        // Camera Pitch (Vertical Look) - Clamp to prevent flipping
        camera.rotation.x += engine.getRenderingCanvas().movementY * rotationSpeed * 0.01;
        camera.rotation.x = BABYLON.Scalar.Clamp(camera.rotation.x, -Math.PI / 2.2, Math.PI / 2.2);
    }


    // --- Keyboard Movement ---
    // Calculate movement vector based on player's current forward/right directions
    const forward = player.forward.scale(moveSpeed);
    const right = player.right.scale(moveSpeed);

    if (inputMap["w"]) {
        moveDirection.addInPlace(player.forward);
    }
    if (inputMap["s"]) {
        moveDirection.subtractInPlace(player.forward);
    }
    if (inputMap["a"]) {
        moveDirection.subtractInPlace(player.right);
    }
    if (inputMap["d"]) {
        moveDirection.addInPlace(player.right);
    }


    if (moveDirection.lengthSquared() > 0) {
        moveDirection.normalize().scaleInPlace(moveSpeed);

        // Apply gravity manually if not using physics engine
        if (!scene.isPhysicsEnabled) {
            // Simple downward velocity check - needs improvement for jumping, slopes etc.
             const gravity = new BABYLON.Vector3(0, -0.5 * deltaTime, 0); // Adjust gravity strength
             moveDirection.addInPlace(gravity);
        }

        player.moveWithCollisions(moveDirection);

        // Basic Footstep Sounds (Requires sound setup)
        // playFootstepSound();
    }
}


// --- Interaction Logic ---
function castRay() {
    // Raycast from screen center
    const ray = scene.createPickingRay(canvas.width / 2, canvas.height / 2, BABYLON.Matrix.Identity(), camera);
    const hit = scene.pickWithRay(ray, (mesh) => {
        // Only pick meshes that are interactable and enabled
        return mesh !== player && mesh !== ground && mesh.metadata && mesh.isEnabled();
    });

    let previouslyHighlighted = highlightedMesh;

    if (hit.pickedMesh && hit.distance <= PLAYER_REACH) {
        highlightedMesh = hit.pickedMesh;
        if (highlightedMesh !== previouslyHighlighted) {
            // Reset previous highlight
            if (previouslyHighlighted && previouslyHighlighted.renderOutline) {
                previouslyHighlighted.renderOutline = false;
            }
            // Apply highlight (outline)
            highlightedMesh.outlineWidth = 0.05;
            highlightedMesh.outlineColor = BABYLON.Color3.Yellow();
            highlightedMesh.renderOutline = true;
            showInteractionPrompt(true, highlightedMesh.metadata.type);
        }
    } else {
        highlightedMesh = null; // Nothing in range or looking away
        if (previouslyHighlighted && previouslyHighlighted.renderOutline) {
            previouslyHighlighted.renderOutline = false; // Remove highlight
        }
        showInteractionPrompt(false); // Hide prompt
    }
}

function handleInteraction() {
    // Check the inputMap state for 'e' - ensures single interaction per press/hold
    if (inputMap["e"] && highlightedMesh) {
        const meta = highlightedMesh.metadata;
        if (!meta) return;

        logMessage(`Interacting with ${meta.type}...`);

        if (meta.type === "resource") {
            gatherResource(highlightedMesh);
        } else if (meta.type === "pickup") {
            pickupItem(highlightedMesh);
        } else if (meta.type === "lootable") {
            openLootContainer(highlightedMesh);
        } else if (meta.type === "animal" && meta.isDead) {
             harvestAnimal(highlightedMesh);
        } else if (meta.type === "animal" && !meta.isDead) {
             attackAnimal(highlightedMesh); // Interact to attack if alive
        } else if (meta.type === "water") {
             fillCanteen(highlightedMesh);
        } else if (meta.type === "placed_object" && meta.originalItemId === 'campfire') {
             interactWithCampfire(highlightedMesh); // Example specific interaction
        }
        // Add more interaction types: Doors, Forge, Crafting Table, etc.

        inputMap["e"] = false; // Consume the input for this frame to prevent rapid multi-interact
    }
}

function showInteractionPrompt(show, type = "") {
     if (show && type && highlightedMesh) { // Ensure highlightedMesh is valid
        let text = "Press E to Interact";
        const meta = highlightedMesh.metadata;
        if (type === "resource") text = `Press E to Gather ${items[meta.resourceId]?.name || 'Resource'}`;
        else if (type === "pickup") text = `Press E to Pickup ${items[meta.itemId]?.name || 'Item'}`;
        else if (type === "lootable") text = `Press E to Search`;
        else if (type === "animal" && meta.isDead) text = `Press E to Harvest ${meta.species}`;
        else if (type === "animal" && !meta.isDead) text = `Press E to Attack ${meta.species}`;
        else if (type === "water") text = `Press E to Fill Canteen`;
        else if (type === "placed_object") text = `Press E to Use ${items[meta.originalItemId]?.name || 'Object'}`;
        // Add more specific prompts

        interactionPrompt.textContent = text;
        interactionPrompt.classList.remove('hidden');
     } else {
         interactionPrompt.classList.add('hidden');
     }
}


// --- Resource Gathering ---
function gatherResource(resourceMesh) {
    const meta = resourceMesh.metadata;
    if (!meta || meta.health <= 0) return;

    const requiredTool = meta.tool; // e.g., 'axe' or 'pickaxe'
    const heldItem = getHeldItem(); // Check player's active quick bar slot

    if (requiredTool && (!heldItem || items[heldItem.id]?.tool !== requiredTool)) {
        logMessage(`You need a ${requiredTool} to gather this.`);
        return;
    }

    logMessage(`Gathering ${items[meta.resourceId]?.name}...`);
    // Add animation/sound effect here
    meta.health -= 25; // Damage per hit

    if (meta.health <= 0) {
        const amount = Math.floor(Math.random() * 4) + 2; // Random amount
        logMessage(`Gathered ${amount} ${items[meta.resourceId]?.name}!`);
        addItemToInventory(meta.resourceId, amount);

        // Disable or remove the mesh
        resourceMesh.setEnabled(false); // Simple disable
        resourceMesh.checkCollisions = false; // Stop colliding
        // Or maybe respawn logic later:
        // setTimeout(() => {
        //     resourceMesh.setEnabled(true);
        //     resourceMesh.checkCollisions = true;
        //     meta.health = 100;
        //     logMessage(`${items[meta.resourceId]?.name} has respawned.`);
        // }, 60000 * 5); // Respawn after 5 minutes

        if (highlightedMesh === resourceMesh) {
             highlightedMesh = null; // Clear highlight if it was the gathered one
             showInteractionPrompt(false);
        }
    } else {
        // Optional: Play hitting sound, show visual effect (e.g., particles)
    }
}


// --- Item Pickup ---
function pickupItem(itemMesh) {
    const meta = itemMesh.metadata;
    if (!meta) return;

    if (addItemToInventory(meta.itemId, meta.quantity || 1)) {
        logMessage(`Picked up ${meta.quantity || 1} ${items[meta.itemId]?.name}`);
        itemMesh.dispose(); // Remove the item mesh from the world
        if (highlightedMesh === itemMesh) {
             highlightedMesh = null;
             showInteractionPrompt(false);
        }
    } else {
        // Inventory was full, message already shown by addItemToInventory
    }
}


// --- Looting ---
function openLootContainer(containerMesh) {
     if (isInventoryOpen || isCraftingOpen) return; // Prevent opening multiple panels

     closeAllPanels(); // Close others just in case

     currentLootSource = containerMesh;
     const meta = containerMesh.metadata;
     if (!meta || !meta.lootTable) return; // Make sure it's lootable

     lootGrid.innerHTML = ''; // Clear previous loot

     // Generate or retrieve loot
     // Generate only once per container instance unless it should refresh
     if (!meta.currentLoot || meta.isLootRefreshed) { // Add a flag if loot should refresh
        meta.currentLoot = generateLoot(meta.lootTable);
        meta.isLootRefreshed = false; // Mark as generated
     }


     if (!meta.currentLoot || meta.currentLoot.filter(Boolean).length === 0) { // Check if truly empty (all nulls)
         logMessage("Container is empty.");
         currentLootSource = null; // Don't open panel if empty
         return;
     }

     meta.currentLoot.forEach((item, index) => {
         const slotDiv = document.createElement('div');
         slotDiv.classList.add('slot');
         slotDiv.style.pointerEvents = 'all'; // Make slots clickable in loot panel

         if (item) { // Only draw slot if item exists
             const itemDef = items[item.id];
             slotDiv.style.backgroundImage = `url(${itemDef?.icon || ''})`;
             slotDiv.title = `${itemDef?.name || 'Unknown Item'} (${item.quantity})`;
             slotDiv.dataset.itemId = item.id;
             slotDiv.dataset.index = index; // Index within the container's loot

             if (itemDef?.stackable && item.quantity > 1) {
                const countSpan = document.createElement('span');
                countSpan.classList.add('item-count');
                countSpan.textContent = item.quantity;
                slotDiv.appendChild(countSpan);
             }

             slotDiv.onclick = () => takeLootItem(index); // Click to take
         } else {
             // Optionally display an empty slot graphic or leave blank
             slotDiv.style.backgroundColor = 'rgba(0,0,0,0.2)';
         }
         lootGrid.appendChild(slotDiv);
     });

     lootContainer.classList.remove('hidden');
     isLootOpen = true;
     pauseGame(); // Pause game rendering/logic while looting
}

function closeLootContainer() {
     lootContainer.classList.add('hidden');
     isLootOpen = false;
     currentLootSource = null; // Clear reference
     resumeGame(); // Resume game
}

function generateLoot(lootTable) {
    // Simple: Pick a few random items from the table
    let loot = [];
    const numItems = Math.floor(Math.random() * 4) + 1; // 1-4 items
    for (let i = 0; i < numItems; i++) {
        const randomItemId = lootTable[Math.floor(Math.random() * lootTable.length)];
        if (items[randomItemId]) {
            // Avoid adding duplicates directly, could combine quantities later
             loot.push({
                 id: randomItemId,
                 quantity: items[randomItemId].stackable ? (Math.floor(Math.random() * 5) + 1) : 1
             });
        }
    }
    // Pad with nulls for consistent grid size? Or adjust grid CSS. For now, just return items found.
    return loot;
}

function takeLootItem(index) {
    if (!currentLootSource || !currentLootSource.metadata.currentLoot) return;

    const lootItem = currentLootSource.metadata.currentLoot[index];
    if (!lootItem) return; // Clicked an empty/already taken slot

    if (addItemToInventory(lootItem.id, lootItem.quantity)) {
        logMessage(`Took ${lootItem.quantity} ${items[lootItem.id]?.name}`);
        currentLootSource.metadata.currentLoot[index] = null; // Mark as taken in the source
        // Refresh loot UI dynamically instead of re-opening
        updateLootUI();
    } else {
        // Inventory full message handled by addItemToInventory
    }
}

function updateLootUI() {
    // Similar logic to openLootContainer, but just updates the grid content
    if (!isLootOpen || !currentLootSource) return;
    const meta = currentLootSource.metadata;
    lootGrid.innerHTML = '';

     if (!meta.currentLoot || meta.currentLoot.filter(Boolean).length === 0) {
         closeLootContainer(); // Close if now empty
         logMessage("Container is empty.");
         return;
     }

    meta.currentLoot.forEach((item, index) => {
         const slotDiv = document.createElement('div');
         slotDiv.classList.add('slot');
         slotDiv.style.pointerEvents = 'all';
         if (item) {
            const itemDef = items[item.id];
            slotDiv.style.backgroundImage = `url(${itemDef?.icon || ''})`;
            slotDiv.title = `${itemDef?.name || 'Unknown Item'} (${item.quantity})`;
            slotDiv.dataset.itemId = item.id;
            slotDiv.dataset.index = index;
            if (itemDef?.stackable && item.quantity > 1) {
                const countSpan = document.createElement('span');
                countSpan.classList.add('item-count');
                countSpan.textContent = item.quantity;
                slotDiv.appendChild(countSpan);
            }
            slotDiv.onclick = () => takeLootItem(index);
         } else {
            slotDiv.style.backgroundColor = 'rgba(0,0,0,0.2)';
         }
         lootGrid.appendChild(slotDiv);
     });
}


// --- Inventory Management ---
function addItemToInventory(itemId, quantity = 1) {
    const itemDef = items[itemId];
    if (!itemDef) {
        console.error(`Attempted to add unknown item: ${itemId}`);
        return false;
    }

    let remainingQuantity = quantity;

    // 1. Try stacking in Quick Bar first
    if (itemDef.stackable) {
        for (let i = 0; i < quickBar.length; i++) {
            if (quickBar[i] && quickBar[i].id === itemId) {
                // Add stack size limit check here if needed
                quickBar[i].quantity += remainingQuantity;
                remainingQuantity = 0; // All added
                logMessage(`Added ${quantity} ${itemDef.name} to quick bar stack.`);
                updateQuickBarUI();
                updateCraftingUI();
                return true;
            }
        }
    }

    // 2. Try stacking in Main Inventory
    if (itemDef.stackable && remainingQuantity > 0) {
        for (let i = 0; i < playerInventory.length; i++) {
            if (playerInventory[i] && playerInventory[i].id === itemId) {
                // Add stack size limit check here if needed
                playerInventory[i].quantity += remainingQuantity;
                remainingQuantity = 0; // All added
                logMessage(`Added ${quantity} ${itemDef.name} to inventory stack.`);
                updateInventoryUI();
                updateCraftingUI();
                return true;
            }
        }
    }

    // 3. Find an empty slot in Main Inventory
    if (remainingQuantity > 0) {
        let emptyInvSlotIndex = playerInventory.findIndex(slot => !slot);
        if (emptyInvSlotIndex !== -1 && emptyInvSlotIndex < MAX_INVENTORY_SLOTS) {
             playerInventory[emptyInvSlotIndex] = { id: itemId, quantity: remainingQuantity };
             logMessage(`Added ${remainingQuantity} ${itemDef.name} to inventory.`);
             remainingQuantity = 0;
             updateInventoryUI();
             updateCraftingUI();
             return true;
        }
         // Check if we can push if array size < max (though findIndex should cover this if using fixed size)
         else if (playerInventory.length < MAX_INVENTORY_SLOTS) {
              playerInventory.push({ id: itemId, quantity: remainingQuantity });
              logMessage(`Added ${remainingQuantity} ${itemDef.name} to inventory.`);
              remainingQuantity = 0;
              updateInventoryUI();
              updateCraftingUI();
              return true;
         }
    }

    // 4. Find an empty slot in Quick Bar (if not stackable or no room in main inv)
     if (remainingQuantity > 0) {
        let emptyQBSlotIndex = quickBar.findIndex(slot => !slot);
        if (emptyQBSlotIndex !== -1) {
             quickBar[emptyQBSlotIndex] = { id: itemId, quantity: remainingQuantity };
             logMessage(`Added ${remainingQuantity} ${itemDef.name} to quick bar.`);
             remainingQuantity = 0;
             updateQuickBarUI();
             updateCraftingUI();
             return true;
        }
    }


    if (remainingQuantity > 0) {
        logMessage("Inventory is full!");
        return false; // Could not add the item
    }
    return true; // Item was added somewhere
}

function removeItemFromInventory(itemId, quantity = 1, specificSlot = null, source = 'any') {
    // source can be 'inventory', 'quickbar', or 'any'
    // specificSlot: { type: 'inventory'/'quickbar', index: slotIndex }
    const itemDef = items[itemId];
    if (!itemDef) return false;

    let removedQuantity = 0;

    const searchAndRemove = (list, listType) => {
        for (let i = list.length - 1; i >= 0; i--) {
            const currentSlot = list[i];
            if (currentSlot && currentSlot.id === itemId) {
                // If a specific slot is requested, only check that one
                if (specificSlot && specificSlot.type === listType && specificSlot.index !== i) {
                     continue;
                }

                const amountToRemove = Math.min(quantity - removedQuantity, currentSlot.quantity);
                currentSlot.quantity -= amountToRemove;
                removedQuantity += amountToRemove;

                if (currentSlot.quantity <= 0) {
                    list[i] = null; // Clear the slot
                }

                if (removedQuantity >= quantity) {
                    return true; // Enough removed
                }
            }
        }
        return false; // Not enough removed from this list (yet)
    };

    let qbSuccess = false;
    let invSuccess = false;

    // Prioritize specific slot if requested
    if (specificSlot) {
        if (specificSlot.type === 'quickbar' && (source === 'quickbar' || source === 'any')) {
            qbSuccess = searchAndRemove(quickBar, 'quickbar');
        } else if (specificSlot.type === 'inventory' && (source === 'inventory' || source === 'any')) {
            invSuccess = searchAndRemove(playerInventory, 'inventory');
        }
    }

    // If not enough removed, or no specific slot, search generally based on source
    if (removedQuantity < quantity && (source === 'quickbar' || source === 'any')) {
         qbSuccess = searchAndRemove(quickBar, 'quickbar') || qbSuccess; // Search QB
    }
    if (removedQuantity < quantity && (source === 'inventory' || source === 'any')) {
         invSuccess = searchAndRemove(playerInventory, 'inventory') || invSuccess; // Search Inv
    }


    if (removedQuantity > 0) {
        updateInventoryUI();
        updateQuickBarUI();
        updateCraftingUI(); // Ingredients might change availability
    }

    return removedQuantity >= quantity; // Return true if the required quantity was removed
}

function findInventoryItem(itemId) {
     // Finds the first instance of an item and returns its info
     let invIndex = playerInventory.findIndex(i => i?.id === itemId);
     if (invIndex !== -1) {
         return { item: playerInventory[invIndex], type: 'inventory', index: invIndex };
     }
     let qbIndex = quickBar.findIndex(i => i?.id === itemId);
     if (qbIndex !== -1) {
         return { item: quickBar[qbIndex], type: 'quickbar', index: qbIndex };
     }
     return null; // Not found
}


function hasResources(requirements) {
    for (const itemId in requirements) {
        const requiredQty = requirements[itemId];
        let currentQty = 0;
        // Check both inventory and quick bar
        [...playerInventory, ...quickBar].forEach(slot => {
            if (slot && slot.id === itemId) {
                currentQty += slot.quantity;
            }
        });
        if (currentQty < requiredQty) {
            logMessage(`Need ${requiredQty - currentQty} more ${items[itemId]?.name || itemId}`);
            return false; // Not enough of this item
        }
    }
    return true; // Has all required items
}

function closeAllPanels() {
     if (isInventoryOpen) toggleInventory(false); // Force close
     if (isCraftingOpen) toggleCraftingMenu(false);
     if (isLootOpen) closeLootContainer();
}

function pauseGame() {
    engine.stopRenderLoop(); // Pause game rendering/logic
    document.exitPointerLock(); // Unlock mouse cursor
    uiContainer.style.pointerEvents = 'all'; // Allow UI interaction
}

function resumeGame() {
     // Only resume if no panels are open
    if (!isInventoryOpen && !isCraftingOpen && !isLootOpen) {
         engine.runRenderLoop(renderLoop); // Resume game
         uiContainer.style.pointerEvents = 'none'; // Disable UI interaction unless over specific elements
         // Re-lock cursor (requires user click on canvas again usually)
         // We set up the click listener on the scene to handle this
    }
}


function toggleInventory(forceState = null) {
    const newState = forceState !== null ? forceState : !isInventoryOpen;

    if (newState && (isCraftingOpen || isLootOpen)) {
         closeAllPanels(); // Close others before opening inventory
    }

    isInventoryOpen = newState;
    inventoryPanel.classList.toggle('hidden', !isInventoryOpen);

    if (isInventoryOpen) {
        updateInventoryUI(); // Refresh UI when opening
        pauseGame();
    } else {
        resumeGame();
    }
}

function updateInventoryUI() {
    inventoryGrid.innerHTML = ''; // Clear existing slots

    // Ensure playerInventory has fixed size for UI consistency
     while (playerInventory.length < MAX_INVENTORY_SLOTS) {
         playerInventory.push(null);
     }
     // Trim if needed (e.g. if MAX changed) - better to manage fixed size carefully
     // playerInventory = playerInventory.slice(0, MAX_INVENTORY_SLOTS);


    for (let index = 0; index < MAX_INVENTORY_SLOTS; index++) {
         const item = playerInventory[index];
         const slotDiv = document.createElement('div');
         slotDiv.classList.add('slot');
         slotDiv.style.pointerEvents = 'all'; // Allow clicking slots in panel
         slotDiv.dataset.slotType = 'inventory';
         slotDiv.dataset.index = index;

         if (item) {
             const itemDef = items[item.id];
             slotDiv.style.backgroundImage = `url(${itemDef?.icon || ''})`;
             slotDiv.title = `${itemDef?.name || 'Unknown Item'} (${item.quantity})`; // Tooltip

             if (itemDef?.stackable && item.quantity > 1) {
                 const countSpan = document.createElement('span');
                 countSpan.classList.add('item-count');
                 countSpan.textContent = item.quantity;
                 slotDiv.appendChild(countSpan);
             }
             // Add canteen water level display
             if (item.id === 'canteen' && item.contains) {
                 const waterIconDiv = document.createElement('div');
                 waterIconDiv.style.position = 'absolute';
                 waterIconDiv.style.bottom = '5px';
                 waterIconDiv.style.left = '5px';
                 waterIconDiv.style.width = '20px';
                 waterIconDiv.style.height = '20px';
                 waterIconDiv.style.backgroundImage = `url(${items[item.contains.id]?.icon || ''})`;
                 waterIconDiv.style.backgroundSize = 'contain';
                 waterIconDiv.style.opacity = '0.9';
                 slotDiv.appendChild(waterIconDiv);
                 slotDiv.title += ` - Contains: ${items[item.contains.id]?.name}`;
             }
         }

         slotDiv.onclick = (event) => handleSlotClick(event, slotDiv, 'inventory', index);
         inventoryGrid.appendChild(slotDiv);
    }
}

function updateQuickBarUI() {
    quickBarSlots.forEach((slotDiv, index) => {
        const item = quickBar[index];
        slotDiv.innerHTML = ''; // Clear previous content (like count)
        slotDiv.style.backgroundImage = ''; // Clear background image
        slotDiv.dataset.slotType = 'quickbar';
        slotDiv.dataset.index = index;
        // Keep border style based on active slot
        slotDiv.style.border = index === activeQuickBarIndex ? '2px solid yellow' : '1px solid #555';
         slotDiv.style.pointerEvents = 'all'; // Allow clicking slots in panel when open

        if (item) {
            const itemDef = items[item.id];
            slotDiv.style.backgroundImage = `url(${itemDef?.icon || ''})`;
            slotDiv.title = `${itemDef?.name || 'Unknown Item'} (${item.quantity})`;

            if (itemDef?.stackable && item.quantity > 1) {
                const countSpan = document.createElement('span');
                countSpan.classList.add('item-count');
                countSpan.textContent = item.quantity;
                slotDiv.appendChild(countSpan);
            }
             // Add canteen water level display
             if (item.id === 'canteen' && item.contains) {
                 const waterIconDiv = document.createElement('div');
                 // Style water icon... (similar to inventory)
                 waterIconDiv.style.position = 'absolute';
                 waterIconDiv.style.bottom = '5px';
                 waterIconDiv.style.left = '5px';
                 waterIconDiv.style.width = '20px';
                 waterIconDiv.style.height = '20px';
                 waterIconDiv.style.backgroundImage = `url(${items[item.contains.id]?.icon || ''})`;
                 waterIconDiv.style.backgroundSize = 'contain';
                 waterIconDiv.style.opacity = '0.9';
                 slotDiv.appendChild(waterIconDiv);
                 slotDiv.title += ` - Contains: ${items[item.contains.id]?.name}`;
             }
        } else {
             slotDiv.title = 'Empty Slot';
        }

        // Click handler for moving items when inventory is open
        slotDiv.onclick = (event) => {
            if(isInventoryOpen) {
                 handleSlotClick(event, slotDiv, 'quickbar', index);
            } else {
                 setActiveQuickBarSlot(index); // Select slot if inventory is closed
            }
        };
    });
}

function handleSlotClick(event, slotDiv, sourceType, sourceIndex) {
    if (!isInventoryOpen) return; // Only allow moving items when inventory is open

    if (event.shiftKey) {
        moveItem(sourceType, sourceIndex);
    } else {
        // Handle other clicks? Select item? Use item? (Not implemented here)
        // console.log(`Clicked ${sourceType} slot ${sourceIndex}`);
    }
}

function moveItem(sourceType, sourceIndex) {
    const sourceList = sourceType === 'inventory' ? playerInventory : quickBar;
    const targetList = sourceType === 'inventory' ? quickBar : playerInventory;
    const targetMaxSize = sourceType === 'inventory' ? quickBar.length : MAX_INVENTORY_SLOTS;
    const targetType = sourceType === 'inventory' ? 'quickbar' : 'inventory';

    const itemToMove = sourceList[sourceIndex];
    if (!itemToMove) return; // Clicked empty slot

    // Find first empty slot in target
    let targetIndex = -1;
     // Look for null/undefined slots first
     for(let i=0; i<targetList.length; i++){
         if (!targetList[i]) {
             targetIndex = i;
             break;
         }
     }
     // If targetList is the inventory and not yet full, and no nulls found, append
     if(targetIndex === -1 && targetType === 'inventory' && targetList.length < targetMaxSize){
         targetIndex = targetList.length;
     }


    if (targetIndex !== -1 && targetIndex < targetMaxSize) { // Ensure index is valid for fixed size arrays
        // Perform the move
        if(targetIndex >= targetList.length) { // Handle appending for inventory
            targetList.push(itemToMove);
        } else {
            targetList[targetIndex] = itemToMove;
        }
        sourceList[sourceIndex] = null; // Clear original slot

        // Refresh UIs
        updateInventoryUI();
        updateQuickBarUI();
         logMessage(`Moved ${items[itemToMove.id]?.name}`);
    } else {
        logMessage(`Target ${targetType === 'quickbar' ? 'Quick Bar' : 'Inventory'} is full.`);
    }
}


// --- Crafting ---
function toggleCraftingMenu(forceState = null) {
    const newState = forceState !== null ? forceState : !isCraftingOpen;

    if (newState && (isInventoryOpen || isLootOpen)) {
        closeAllPanels(); // Close others before opening crafting
    }

    isCraftingOpen = newState;
    craftingMenu.classList.toggle('hidden', !isCraftingOpen);

    if (isCraftingOpen) {
        updateCraftingUI(); // Refresh UI when opening
        pauseGame();
    } else {
        resumeGame();
    }
}

function updateCraftingUI() {
    craftingList.innerHTML = ''; // Clear previous list

    for (const itemId in recipes) {
        const recipe = recipes[itemId];
        const itemDef = items[itemId];
        if (!itemDef) continue;

        // TODO: Add check for required crafting station (e.g., crafting table, forge)
        // let stationRequirementMet = !recipe.station || isNearStation(recipe.station);
        let stationRequirementMet = true; // Assume met for now

        const resourcesAvailable = hasResources(recipe.requires);
        const canCraft = resourcesAvailable && stationRequirementMet;

        const li = document.createElement('li');
        li.style.pointerEvents = 'all';
        li.dataset.itemId = itemId;

        // Build description string
        let reqString = Object.entries(recipe.requires)
            .map(([reqId, reqQty]) => `${reqQty} ${items[reqId]?.name || '???'}`)
            .join(', ');
        li.textContent = `${itemDef.name} (Needs: ${reqString})`;
        // if (recipe.station) {
        //     li.textContent += ` [Requires ${recipe.station}]`;
        // }

        li.classList.toggle('can-craft', canCraft);
        li.classList.toggle('cannot-craft', !canCraft);

        if (canCraft) {
            li.onclick = () => craftItem(itemId);
        } else {
            li.title = stationRequirementMet ? "Not enough resources" : `Requires nearby ${recipe.station}`;
        }

        craftingList.appendChild(li);
    }
}

function craftItem(itemId) {
    const recipe = recipes[itemId];
    if (!recipe) return;

     // Re-check resources and station just before crafting
     // let stationRequirementMet = !recipe.station || isNearStation(recipe.station);
     let stationRequirementMet = true; // Assume met for now

    if (hasResources(recipe.requires) && stationRequirementMet) {
        // Consume resources
        let consumedSuccessfully = true;
        for (const reqId in recipe.requires) {
            if (!removeItemFromInventory(reqId, recipe.requires[reqId])) {
                 logMessage(`Error: Could not remove required ${items[reqId]?.name}`);
                 consumedSuccessfully = false;
                 // TODO: Rollback any previously removed items for this craft attempt? Complex. Best to ensure hasResources is accurate.
                 break;
             }
        }

        // Add crafted item if consumption was successful
        if (consumedSuccessfully) {
             const created = recipe.creates;
             if (addItemToInventory(created.id, created.quantity)) {
                 logMessage(`Crafted ${created.quantity} ${items[created.id]?.name}!`);
             } else {
                 logMessage(`Inventory full, cannot receive ${items[created.id]?.name}!`);
                 // TODO: Give back consumed resources if inventory is full? Hard, maybe drop item in world?
             }
             updateCraftingUI(); // Re-check craftable status after consumption
        }
    } else {
        logMessage(stationRequirementMet ? "Not enough resources!" : `Requires nearby ${recipe.station}`);
    }
}

// --- Placing Items ---
function handlePlacing() {
     // Check inputMap state for 'p'
     if (inputMap["p"]) {
         const itemToPlace = getHeldItem(); // Get item from active quick bar slot

         if (itemToPlace && items[itemToPlace.id]?.placeable) {
             const placeableItemDef = items[itemToPlace.id];

             // Raycast to find placement position on the ground/valid surface
             const ray = scene.createPickingRay(canvas.width / 2, canvas.height / 2, BABYLON.Matrix.Identity(), camera);
             const hit = scene.pickWithRay(ray, (mesh) => mesh === ground /*|| mesh.metadata?.type === 'building_floor'*/); // Only place on ground for now

             if (hit.pickedPoint && hit.distance < PLAYER_REACH + 2) { // Allow placing slightly further away
                 // *** IMPORTANT: This needs actual 3D models (.glb/.gltf) ***
                 const modelFileName = placeableItemDef.model; // e.g., 'campfire.glb'
                 if (modelFileName) {
                     logMessage(`Placing ${placeableItemDef.name}...`);
                     BABYLON.SceneLoader.ImportMeshAsync("", "assets/models/", modelFileName, scene)
                         .then((result) => {
                             if (!result.meshes || result.meshes.length === 0) {
                                 throw new Error("Loaded model has no meshes.");
                             }
                             const placedMesh = result.meshes[0]; // Assuming root mesh is the one we want
                             placedMesh.position = hit.pickedPoint.clone();
                             // Adjust Y position based on model's bounding box if needed
                             // placedMesh.position.y += placedMesh.getBoundingInfo().boundingBox.extendSize.y;
                             placedMesh.position.y += 0.1; // Simple offset
                             placedMesh.checkCollisions = true; // Make placed object solid
                             placedMesh.metadata = { type: "placed_object", originalItemId: itemToPlace.id };
                             shadowGenerator.addShadowCaster(placedMesh); // Add to shadows

                             // Add specific logic for campfire/forge (e.g., interaction points, fuel state)
                             if (itemToPlace.id === 'campfire') {
                                 placedMesh.metadata.fuel = 0;
                                 placedMesh.metadata.isLit = false;
                                 placedMesh.metadata.cookingSlots = [null, null, null]; // e.g., 3 cooking slots
                             }

                             logMessage(`Placed ${placeableItemDef.name} successfully.`);

                             // Remove one item from the specific quickbar slot
                             if (removeItemFromInventory(itemToPlace.id, 1, { type: 'quickbar', index: activeQuickBarIndex }, 'quickbar')) {
                                 // Item removed successfully
                             } else {
                                 console.error("Failed to remove placed item from quickbar slot", activeQuickBarIndex);
                                 // Should ideally not happen if checks passed, maybe revert placement?
                                 placedMesh.dispose();
                             }

                         }).catch(error => {
                              console.error("Error loading model for placement:", modelFileName, error);
                              logMessage(`Error placing ${placeableItemDef.name}. Model not found or invalid?`);
                         });
                 } else {
                     logMessage(`No model defined for placable item ${placeableItemDef.name}`);
                 }

             } else {
                 logMessage("Cannot place item here (too far or invalid surface).");
             }
         } else {
             // Log only if P was pressed without a valid item? Maybe too noisy.
             // logMessage("Select a placeable item from the quick bar first.");
         }
         inputMap["p"] = false; // Consume input for this frame
     }
}


// --- Cooking / Boiling / Station Interaction (Conceptual Placeholders) ---
function interactWithCampfire(campfireMesh) {
    // --- This needs a dedicated UI Panel ---
    const meta = campfireMesh.metadata;
    if (!meta) return;

    logMessage(`Interacting with Campfire. Fuel: ${meta.fuel}, Lit: ${meta.isLit}`);

    // Example Actions (replace with UI):
    // 1. Add Fuel: Check inventory for 'wood', remove wood, add to meta.fuel
    // 2. Light/Extinguish: Toggle meta.isLit (if fuel > 0)
    // 3. Add Item to Cook: Check inventory for 'raw_meat' or 'canteen' with dirty water. Find empty slot in meta.cookingSlots. Add item data { id: 'raw_meat', cookTime: 0, cookDuration: 30 }
    // 4. Remove Cooked Item: Check slots for items where cookTime >= cookDuration. Give player 'cooked_meat' or update 'canteen' contents. Clear slot.

    // Needs timer updates in the main loop (updateWorldTimers)
    logMessage("Campfire interaction UI not implemented.");
}

function fillCanteen(waterMesh) {
     const canteenInfo = findInventoryItem('canteen'); // Find canteen in inv or QB

     if (canteenInfo) {
         const theCanteen = canteenInfo.item;
         if (!theCanteen.contains || theCanteen.contains.id !== 'water_dirty') { // Allow filling only if empty or not already dirty
             theCanteen.contains = { id: 'water_dirty', quantity: 1 }; // Assume capacity 1
             logMessage("Filled canteen with dirty water.");
             updateInventoryUI(); // Update both in case it's in inventory
             updateQuickBarUI(); // Or quick bar
         } else if (theCanteen.contains.id === 'water_dirty'){
             logMessage("Canteen already contains dirty water.");
         } else {
             logMessage("Canteen contains clean water.");
         }
     } else {
         logMessage("You need a canteen to collect water.");
     }
}


// --- Animal Handling (Conceptual Placeholders) ---
function updateAnimals(deltaTime) {
    // Find all animal meshes in the scene (e.g., using scene.getMeshesByTags("animal"))
    // For each animal:
    //  - If not dead: Update its AI state (idle, roam, flee, attack) based on proximity to player, health etc.
    //  - Move the animal based on its state (e.g., random walk, move away from player)
    //  - Handle collisions with environment/player
    //  - Play animations corresponding to state using AnimationGroups
    // This requires significant AI programming (state machines, perhaps basic pathfinding)
}

function attackAnimal(animalMesh) {
     const meta = animalMesh.metadata;
     if (!meta || meta.isDead) return;

     const heldItem = getHeldItem();
     const weaponDamage = (heldItem && items[heldItem.id]?.tool === 'knife') ? 20 : 5; // Example: Knife does more damage

     if (!heldItem || (items[heldItem.id]?.tool !== 'knife' && items[heldItem.id]?.tool !== 'axe')) { // Allow axe/knife?
         logMessage("You need a suitable weapon (Knife/Axe).");
         return;
     }

     meta.health -= weaponDamage;
     logMessage(`Attacked ${meta.species}, health: ${meta.health}`);
     // Play attack sound/animation

     if (meta.health <= 0) {
         logMessage(`${meta.species} killed!`);
         meta.isDead = true;
         meta.health = 0;
         // Stop AI, play death animation
         // Change interaction prompt via castRay update
         // Stop animal movement/animations
         // const deathAnim = scene.getAnimationGroupByName("Death"); // Get specific animation
         // if (deathAnim) deathAnim.start(false); // Play once, don't loop
     } else {
         // Trigger flee or attack AI state in the animal's logic
         meta.state = 'flee'; // Simple example: always flee when hit
         // Play hit animation/sound on animal
     }
}

function harvestAnimal(animalMesh) {
     const meta = animalMesh.metadata;
     if (!meta || !meta.isDead || meta.harvested) return;

     const heldItem = getHeldItem();
      if (!heldItem || items[heldItem.id]?.tool !== 'knife') {
         logMessage(`You need a knife to harvest the ${meta.species}.`);
         return;
     }

     logMessage(`Harvesting ${meta.species}...`);
     let harvestedSomething = false;
     if (meta.drops) {
         for (const itemId in meta.drops) {
             const quantity = Math.floor(Math.random() * meta.drops[itemId]) + 1; // Random drop amount up to max
             if (quantity > 0) {
                addItemToInventory(itemId, quantity);
                harvestedSomething = true;
             }
         }
     }

     if (harvestedSomething) {
        meta.harvested = true; // Prevent multiple harvests
        // Optionally: Make corpse disappear after a while or on harvest
        logMessage(`Harvested ${meta.species}.`);
        setTimeout(() => {
            if (animalMesh) animalMesh.dispose();
        }, 10000); // Dispose after 10 seconds
        if (highlightedMesh === animalMesh) {
            highlightedMesh = null;
            showInteractionPrompt(false);
        }
     } else {
         logMessage(`Nothing useful was recovered from the ${meta.species}.`);
         meta.harvested = true; // Still mark as harvested attempt
     }

}


// --- Utility Functions ---
function getHeldItem() {
    // Get item from the currently selected quick bar slot
    return quickBar[activeQuickBarIndex];
}

function logMessage(message, duration = 3500) {
    console.log("LOG:", message); // Also log to console for debugging
    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;
    messageLog.appendChild(msgDiv);

    // Limit number of messages shown
     const maxMessages = 5;
     while(messageLog.children.length > maxMessages) {
         messageLog.removeChild(messageLog.firstChild);
     }

    // Remove the message after a delay + fade
    const fadeOutTimer = setTimeout(() => {
        msgDiv.style.opacity = '0';
        msgDiv.style.transition = 'opacity 0.5s ease-out';
        // Remove from DOM after fade out
        setTimeout(() => {
            if (msgDiv.parentNode === messageLog) { // Check if still attached
                 messageLog.removeChild(msgDiv);
            }
        }, 500); // Match CSS transition duration
    }, duration);

     // Optional: Clear timer if message is clicked?
     // msgDiv.onclick = () => { clearTimeout(fadeOutTimer); messageLog.removeChild(msgDiv); };
}


// --- Main Render Loop ---
function renderLoop() {
    if (!scene) return;

     const deltaTime = engine.getDeltaTime() / 1000.0; // Time since last frame in seconds

    // Only process game logic if game is not paused
    if (!isInventoryOpen && !isCraftingOpen && !isLootOpen) {
         // Handle player input for movement & look
         handlePlayerMovement(deltaTime);

         // Handle interactions (looking at things, pressing E)
         castRay(); // Continuously check what player is looking at
         handleInteraction(); // Check if interaction key was pressed

         // Handle placing items (pressing P)
         handlePlacing();

         // Update game logic (e.g., animal AI, cooking timers)
         // updateAnimals(deltaTime);
         // updateWorldTimers(deltaTime); // For cooking, smelting, plant growth etc.
    }

    scene.render();
}


// --- Game Initialization ---
async function startGame() {
    logMessage("Initializing game...", 5000);
    try {
        scene = await createScene(); // Create the scene and its objects

        // Event Listeners for UI Buttons
        closeInventoryBtn.onclick = () => toggleInventory(false); // Force close
        closeCraftingBtn.onclick = () => toggleCraftingMenu(false); // Force close
        closeLootBtn.onclick = closeLootContainer;

        // Global key listeners (already set up in createScene via ActionManager)
        // We handle single key presses like Tab/C/Esc in handleKeyPress

         // Set initial active quickbar slot visual
         setActiveQuickBarSlot(0);

        // Start the render loop
        engine.runRenderLoop(renderLoop);
        logMessage("Game started!", 5000);

        // Watch for browser/canvas resize events
        window.addEventListener('resize', () => {
            engine.resize();
        });

    } catch (error) {
        console.error("Error starting game:", error);
        logMessage(`FATAL ERROR: ${error.message}. Check console.`, 60000);
        // Display error prominently on screen?
         const errorDiv = document.createElement('div');
         errorDiv.style.position = 'absolute';
         errorDiv.style.top = '10px';
         errorDiv.style.left = '10px';
         errorDiv.style.padding = '10px';
         errorDiv.style.backgroundColor = 'red';
         errorDiv.style.color = 'white';
         errorDiv.style.zIndex = '100';
         errorDiv.textContent = `ERROR INITIALIZING GAME: ${error.message}. See console (F12) for details.`;
         document.body.appendChild(errorDiv);
    }
}

// --- Run the Game ---
startGame();

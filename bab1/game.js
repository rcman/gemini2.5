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
let player = null; // Global player object
let camera; // Global camera object <<< DECLARED GLOBALLY

// --- Game State ---
let playerInventory = []; // Array to hold inventory items { id: 'wood', name: 'Wood', quantity: 10, icon: 'path/to/wood.png' }
let quickBar = new Array(5).fill(null); // Fixed size quick bar
let activeQuickBarIndex = 0; // Track the active slot
let isInventoryOpen = false;
let isCraftingOpen = false;
let isLootOpen = false;
const PLAYER_REACH = 5; // How far the player can interact
let highlightedMesh = null; // Mesh the player is looking at
let currentLootSource = null; // Reference to the barrel/container being looted
const inputMap = {}; // Stores current key states
const MAX_INVENTORY_SLOTS = 20;


// --- Item & Crafting Definitions ---
// IMPORTANT: Replace 'assets/icons/...' and 'assets/models/...' with actual paths
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
    'campfire': { name: 'Campfire', stackable: true, placeable: true, icon: 'assets/icons/campfire.png', model: 'campfire.glb' }, // NOTE: Uses simple stacking for now. Model path relative to assets/models/
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
    scene.gravity = new BABYLON.Vector3(0, -9.81 / 60, 0); // Apply gravity per frame
    scene.workerCollisions = true; // Use worker thread for collisions if available

    // Camera - UniversalCamera for 3rd person control
    // Assign to the global variable, don't re-declare with const/let
    camera = new BABYLON.UniversalCamera("playerCamera", new BABYLON.Vector3(0, 5, -10), scene); // <<< ASSIGN TO GLOBAL CAMERA
    camera.setTarget(BABYLON.Vector3.Zero()); // Initial target
    // Control attachment/detachment handled by pointer lock listener
    camera.speed = 0; // We control player capsule movement directly
    camera.inputs.remove(camera.inputs.attached.keyboard); // Remove default WASD camera input
    camera.minZ = 0.1; // Prevent clipping through nearby objects

    // --- Lighting ---
    // Ambient light
    const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0.1, 1, 0.1), scene);
    ambientLight.intensity = 0.4;
    ambientLight.groundColor = new BABYLON.Color3(0.4, 0.4, 0.5);

    // Directional light (casts shadows)
    const shadowLight = new BABYLON.DirectionalLight("shadowLight", new BABYLON.Vector3(-0.6, -0.8, -0.4), scene);
    shadowLight.intensity = 0.6;
    shadowLight.position = new BABYLON.Vector3(50, 100, 50);

    // Shadow Generator
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, shadowLight); // <<< USES shadowLight
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    shadowGenerator.darkness = 0.5;
    shadowGenerator.bias = 0.005;
    shadowLight.shadowMinZ = 1;
    shadowLight.shadowMaxZ = 200;


    // --- Player Setup ---
    // Assign to the global player variable
    player = BABYLON.MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4, subdivisions: 6 }, scene);
    player.position = new BABYLON.Vector3(0, 5, 0); // Start slightly higher
    player.checkCollisions = true;
    player.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);
    player.ellipsoidOffset = new BABYLON.Vector3(0, 0.9, 0);
    player.speed = 4.5;
    player.applyGravity = true; // Use scene's gravity
    player.rotationQuaternion = BABYLON.Quaternion.Identity();
    player.visibility = 0.0; // Hide capsule (use model later)

    // Attach the global camera to the global player
    camera.parent = player;
    camera.position = new BABYLON.Vector3(0, 1.6, -3.5);
    camera.lockedTarget = new BABYLON.Vector3(0, 1.0, 0);

    player.inventory = playerInventory;
    player.quickBar = quickBar;


    // --- Ground ---
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
    ground.checkCollisions = true;
    ground.receiveShadows = true;
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    try {
        groundMat.diffuseTexture = new BABYLON.Texture("assets/grass.png", scene);
        groundMat.diffuseTexture.uScale = 15; groundMat.diffuseTexture.vScale = 15;
        groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        groundMat.useLogarithmicDepth = true;
    } catch (e) { console.warn("Ground texture not found"); }
    ground.material = groundMat;


    // --- World Objects (Placeholders - Replace with Asset Loading & Instancing) ---
    // Trees
    const treeMat = new BABYLON.StandardMaterial(`treeMat`, scene);
    treeMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.15);
    for (let i = 0; i < 40; i++) {
        const treeHeight = 8 + Math.random() * 4;
        const tree = BABYLON.MeshBuilder.CreateCylinder(`tree_${i}`, { height: treeHeight, diameterTop: 0.2 + Math.random() * 0.5, diameterBottom: 1 + Math.random(), tessellation: 8 }, scene);
        tree.position = new BABYLON.Vector3((Math.random() - 0.5) * 180, treeHeight / 2, (Math.random() - 0.5) * 180);
        tree.checkCollisions = true;
        tree.metadata = { type: "resource", resourceId: "wood", health: 100, tool: "axe" };
        tree.material = treeMat;
        shadowGenerator.addShadowCaster(tree);
    }

    // Rocks
    const rockMat = new BABYLON.StandardMaterial(`rockMat`, scene);
    rockMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    for (let i = 0; i < 50; i++) {
        const rockDiameter = 1 + Math.random() * 2;
        const rock = BABYLON.MeshBuilder.CreateSphere(`rock_${i}`, { diameter: rockDiameter, segments: 6 }, scene);
        rock.position = new BABYLON.Vector3((Math.random() - 0.5) * 180, rockDiameter / 2, (Math.random() - 0.5) * 180);
        rock.checkCollisions = true;
        rock.metadata = { type: "resource", resourceId: "stone", health: 80, tool: "pickaxe" };
        rock.material = rockMat;
        rock.receiveShadows = true;
        shadowGenerator.addShadowCaster(rock);
    }

    // Barrels (Lootable)
    const barrelMat = new BABYLON.StandardMaterial(`barrelMat`, scene);
    barrelMat.diffuseColor = new BABYLON.Color3(0.6, 0.4, 0.2);
    for (let i = 0; i < 15; i++) {
        const barrel = BABYLON.MeshBuilder.CreateCylinder(`barrel_${i}`, { height: 1.2, diameter: 0.8, tessellation: 12 }, scene);
        barrel.position = new BABYLON.Vector3((Math.random() - 0.5) * 150, 0.6, (Math.random() - 0.5) * 150);
        barrel.checkCollisions = true;
        barrel.metadata = { type: "lootable", lootTable: ["scrap_metal", "nails", "rope", "fat", "canteen"], name: "Barrel" };
        barrel.material = barrelMat;
        barrel.receiveShadows = true;
        shadowGenerator.addShadowCaster(barrel);
    }

    // Building Placeholder
    const building = BABYLON.MeshBuilder.CreateBox("building", {width: 8, height: 4, depth: 6}, scene);
    building.position = new BABYLON.Vector3(-15, 2, -10);
    building.checkCollisions = true;
    building.metadata = { type: "building" };
    building.receiveShadows = true;
    shadowGenerator.addShadowCaster(building);
    const buildMat = new BABYLON.StandardMaterial(`buildMat`, scene);
    buildMat.diffuseColor = new BABYLON.Color3(0.8, 0.75, 0.7);
    building.material = buildMat;


    // Scrap Metal Pickup (Example)
    const scrapMat = new BABYLON.StandardMaterial(`scrapMat`, scene);
    scrapMat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.7);
    scrapMat.backFaceCulling = false;
    for (let i=0; i<10; ++i) {
        const scrap = BABYLON.MeshBuilder.CreatePlane(`scrap_${i}`, {size: 0.5}, scene);
        scrap.position = new BABYLON.Vector3((Math.random() - 0.5) * 50, 0.1, (Math.random() - 0.5) * 50);
        scrap.rotation.x = Math.PI / 2;
        scrap.metadata = { type: "pickup", itemId: "scrap_metal", quantity: Math.floor(Math.random() * 3) + 1 };
        scrap.material = scrapMat;
    }

    // Water Plane
    const water = BABYLON.MeshBuilder.CreateGround("water", {width: 80, height: 80}, scene);
    water.position = new BABYLON.Vector3(60, -0.1, 60);
    const waterMat = new BABYLON.StandardMaterial("waterMat", scene);
    waterMat.diffuseColor = new BABYLON.Color3(0.2, 0.4, 0.8);
    waterMat.alpha = 0.6;
    water.material = waterMat;
    water.metadata = { type: "water" };


    // --- Animated Animals (Placeholder) ---
    // ... (Load models and setup AI here) ...


    // --- Initialize Player Gear ---
    addItemToInventory('axe', 1);
    addItemToInventory('pickaxe', 1);
    addItemToInventory('knife', 1);
    addItemToInventory('canteen', 1);
    const canteenItem = findInventoryItem('canteen');
    if (canteenItem) { canteenItem.item.contains = { id: 'water_dirty', quantity: 1 }; }
    moveItem('inventory', 0); moveItem('inventory', 0); moveItem('inventory', 0); moveItem('inventory', 0);


    // --- Initial UI Update ---
    updateInventoryUI();
    updateQuickBarUI();
    updateCraftingUI();


    // --- Input Handling Setup ---
    scene.actionManager = new BABYLON.ActionManager(scene); // <<< INITIALIZED HERE
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = true;
        handleKeyPress(evt.sourceEvent.key.toLowerCase());
    }));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
        inputMap[evt.sourceEvent.key.toLowerCase()] = false;
    }));


    // --- Pointer Lock ---
    const pointerLockChange = () => {
        const controlEnabled = !!(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement);
        if (camera) { // Check if camera exists
             if (!controlEnabled) {
                 camera.detachControl(canvas);
             } else {
                 camera.attachControl(canvas);
             }
        }
    };
    document.addEventListener("pointerlockchange", pointerLockChange, false);
    document.addEventListener("mozpointerlockchange", pointerLockChange, false);
    document.addEventListener("webkitpointerlockchange", pointerLockChange, false);

    scene.onPointerDown = (evt) => {
        if (!isInventoryOpen && !isCraftingOpen && !isLootOpen && evt.button === 0) {
            canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
            if(canvas.requestPointerLock) canvas.requestPointerLock();
        }
    };

    return scene;
}


// --- Input Handling for Single Presses ---
function handleKeyPress(key) {
    if (key === "tab") {
        toggleInventory();
    } else if (key === "c") {
        toggleCraftingMenu();
    } else if (key === "escape") {
         if (isInventoryOpen || isCraftingOpen || isLootOpen) closeAllPanels();
         else console.log("Escape pressed, no panels open."); // Optional pause menu trigger
    }
    // E and P interactions handled in render loop checks
    // Quick Bar Selection (1-5)
    if (!isInventoryOpen && !isCraftingOpen && !isLootOpen) {
         const numKey = parseInt(key);
         if (!isNaN(numKey) && numKey >= 1 && numKey <= quickBar.length) setActiveQuickBarSlot(numKey - 1);
     }
}

function setActiveQuickBarSlot(index) {
    if (index < 0 || index >= quickBar.length) return;
    if (quickBarSlots[activeQuickBarIndex]) quickBarSlots[activeQuickBarIndex].style.border = '1px solid #555';
    activeQuickBarIndex = index;
    if (quickBarSlots[activeQuickBarIndex]) quickBarSlots[activeQuickBarIndex].style.border = '2px solid yellow';
}


// --- Player Movement & Look ---
function handlePlayerMovement(deltaTime) {
    // Use global 'player' and 'camera' - check they exist
    if (!player || !camera || isInventoryOpen || isCraftingOpen || isLootOpen) return;

    const moveSpeed = player.speed * deltaTime;
    let moveDirection = BABYLON.Vector3.Zero();

    // Keyboard Movement Direction (Horizontal Plane)
    const forward = player.forward.clone(); forward.y = 0; forward.normalize();
    const right = player.right.clone(); right.y = 0; right.normalize();
    if (inputMap["w"]) moveDirection.addInPlace(forward);
    if (inputMap["s"]) moveDirection.subtractInPlace(forward);
    if (inputMap["a"]) moveDirection.subtractInPlace(right);
    if (inputMap["d"]) moveDirection.addInPlace(right);

    // Apply Movement
    if (moveDirection.lengthSquared() > 0) {
        moveDirection.normalize().scaleInPlace(moveSpeed);
        player.moveWithCollisions(moveDirection);
    }

    // Player Rotation based on Camera Yaw
    const cameraYaw = camera.rotation.y; // <<< USES GLOBAL CAMERA
    const targetRotation = BABYLON.Quaternion.RotationYawPitchRoll(cameraYaw, 0, 0);
    player.rotationQuaternion = BABYLON.Quaternion.Slerp(player.rotationQuaternion, targetRotation, 0.15);

    // Camera pitch is handled by UniversalCamera's mouse input when pointer locked
}


// --- Interaction Logic ---
function castRay() {
    // Use global 'camera' - check it exists
    if (!camera) return; // <<< SAFETY CHECK

    const ray = new BABYLON.Ray(camera.globalPosition, camera.getForwardRay().direction, PLAYER_REACH); // <<< USES GLOBAL CAMERA
    const hit = scene.pickWithRay(ray, (mesh) => mesh !== player && mesh.metadata?.type && mesh.isEnabled());

    let previouslyHighlighted = highlightedMesh;
    highlightedMesh = hit.pickedMesh || null; // Set to null if no hit

    if (highlightedMesh !== previouslyHighlighted) {
        // Remove highlight from previous
        if (previouslyHighlighted?.renderOutline) {
            previouslyHighlighted.renderOutline = false;
            previouslyHighlighted.outlineColor = BABYLON.Color3.Black();
        }
        // Add highlight to new (if exists)
        if (highlightedMesh) {
            highlightedMesh.renderOutline = true;
            highlightedMesh.outlineWidth = 0.05;
            highlightedMesh.outlineColor = BABYLON.Color3.Yellow();
        }
        // Update prompt (will hide if highlightedMesh is null)
        showInteractionPrompt(!!highlightedMesh, highlightedMesh?.metadata?.type);
    }
}

function handleInteraction() {
    if (inputMap["e"] && highlightedMesh) {
        const meta = highlightedMesh.metadata;
        if (!meta?.type) return;

        switch (meta.type) {
            case "resource": gatherResource(highlightedMesh); break;
            case "pickup": pickupItem(highlightedMesh); break;
            case "lootable": openLootContainer(highlightedMesh); break;
            case "animal": if (meta.isDead) harvestAnimal(highlightedMesh); else attackAnimal(highlightedMesh); break;
            case "water": fillCanteen(highlightedMesh); break;
            case "placed_object":
                if (meta.originalItemId === 'campfire') interactWithCampfire(highlightedMesh);
                else if (meta.originalItemId === 'forge') interactWithForge(highlightedMesh);
                else if (meta.originalItemId === 'crafting_table') logMessage("Using crafting table nearby.");
                break;
            default: logMessage(`Cannot interact with ${meta.type}`);
        }
        inputMap["e"] = false; // Consume input
    }
}

function showInteractionPrompt(show, type = "") {
     interactionPrompt.classList.toggle('hidden', !show);
     if (show && type && highlightedMesh) {
        let text = `Press E to Interact`;
        const meta = highlightedMesh.metadata;
        try {
            switch(type) {
                case "resource": text = `Press E to Gather ${items[meta.resourceId]?.name || 'Resource'}`; break;
                case "pickup": text = `Press E to Pickup ${items[meta.itemId]?.name || 'Item'}`; break;
                case "lootable": text = `Press E to Search ${meta.name || 'Container'}`; break;
                case "animal": text = meta.isDead ? `Press E to Harvest ${meta.species || 'Animal'}` : `Press E to Attack ${meta.species || 'Animal'}`; break;
                case "water": text = `Press E to Fill Canteen`; break;
                case "placed_object": text = `Press E to Use ${items[meta.originalItemId]?.name || 'Object'}`; break;
                default: text = `Press E to Interact with ${type}`;
            }
            interactionPrompt.textContent = text;
        } catch (e) { console.error("Error creating interaction prompt:", e); interactionPrompt.classList.add('hidden');}
     }
}


// --- Resource Gathering ---
function gatherResource(resourceMesh) {
    const meta = resourceMesh.metadata;
    if (!meta || meta.health <= 0) return;
    const requiredTool = meta.tool;
    const heldItem = getHeldItem();
    if (requiredTool && (!heldItem || items[heldItem.id]?.tool !== requiredTool)) {
        logMessage(`You need a ${requiredTool} to gather this.`); return;
    }
    meta.health -= 25;
    if (meta.health <= 0) {
        const amount = Math.floor(Math.random() * 4) + 2;
        logMessage(`Gathered ${amount} ${items[meta.resourceId]?.name}!`);
        addItemToInventory(meta.resourceId, amount);
        resourceMesh.setEnabled(false); resourceMesh.checkCollisions = false; // Disable mesh
        // Respawn logic placeholder
        if (highlightedMesh === resourceMesh) { highlightedMesh = null; showInteractionPrompt(false); }
    }
}


// --- Item Pickup ---
function pickupItem(itemMesh) {
    const meta = itemMesh.metadata; if (!meta) return;
    if (addItemToInventory(meta.itemId, meta.quantity || 1)) {
        logMessage(`Picked up ${meta.quantity || 1} ${items[meta.itemId]?.name}`);
        if (highlightedMesh === itemMesh) { highlightedMesh = null; showInteractionPrompt(false); }
        itemMesh.dispose();
    }
}


// --- Looting ---
function openLootContainer(containerMesh) {
     if (isInventoryOpen || isCraftingOpen) return; closeAllPanels();
     currentLootSource = containerMesh;
     const meta = containerMesh.metadata; if (!meta?.lootTable) return;
     lootGrid.innerHTML = '';
     if (!meta.currentLoot || meta.isLootRefreshed) { meta.currentLoot = generateLoot(meta.lootTable); meta.isLootRefreshed = false; }
     if (!meta.currentLoot || meta.currentLoot.filter(Boolean).length === 0) { logMessage("Container is empty."); currentLootSource = null; return; }
     lootContainer.querySelector('h2').textContent = meta.name || 'Loot';
     updateLootUI();
     lootContainer.classList.remove('hidden'); isLootOpen = true; pauseGame();
}
function closeLootContainer() { lootContainer.classList.add('hidden'); isLootOpen = false; currentLootSource = null; resumeGame(); }
function generateLoot(lootTable) {
    let loot = [];
    const numItems = Math.floor(Math.random() * 4) + 2; // 2-5 items
    for (let i = 0; i < numItems; i++) {
        const randomItemId = lootTable[Math.floor(Math.random() * lootTable.length)];
        if (items[randomItemId]) {
            const existing = loot.find(item => item.id === randomItemId);
            const quantity = items[randomItemId].stackable ? (Math.floor(Math.random() * 5) + 1) : 1;
            if (existing && items[randomItemId].stackable) {
                 existing.quantity += quantity; // Stack if already present
            } else {
                 loot.push({ id: randomItemId, quantity: quantity });
            }
        }
    }
    return loot;
}
function takeLootItem(index) {
    if (!currentLootSource || !currentLootSource.metadata.currentLoot) return;
    const lootItem = currentLootSource.metadata.currentLoot[index]; if (!lootItem) return;
    if (addItemToInventory(lootItem.id, lootItem.quantity)) {
        logMessage(`Took ${lootItem.quantity} ${items[lootItem.id]?.name}`);
        currentLootSource.metadata.currentLoot[index] = null; // Mark as taken
        updateLootUI(); // Refresh loot UI
    }
}
function updateLootUI() {
    if (!isLootOpen || !currentLootSource || !currentLootSource.metadata) return;
    const meta = currentLootSource.metadata; lootGrid.innerHTML = '';
    if (!meta.currentLoot || meta.currentLoot.filter(Boolean).length === 0) { closeLootContainer(); logMessage("Container is empty."); return; }
    meta.currentLoot.forEach((item, index) => {
         const slotDiv = document.createElement('div'); slotDiv.classList.add('slot'); slotDiv.style.pointerEvents = 'all';
         if (item) {
            const itemDef = items[item.id]; slotDiv.style.backgroundImage = `url(${itemDef?.icon || ''})`; slotDiv.title = `${itemDef?.name || '?'} (${item.quantity})`; slotDiv.dataset.itemId = item.id; slotDiv.dataset.index = index;
            if (itemDef?.stackable && item.quantity > 1) { const countSpan = document.createElement('span'); countSpan.classList.add('item-count'); countSpan.textContent = item.quantity; slotDiv.appendChild(countSpan); }
            slotDiv.onclick = () => takeLootItem(index);
         } else { slotDiv.style.backgroundColor = 'rgba(0,0,0,0.2)'; }
         lootGrid.appendChild(slotDiv);
     });
}


// --- Inventory Management ---
function addItemToInventory(itemId, quantity = 1) {
    const itemDef = items[itemId]; if (!itemDef) { console.error(`Unknown item: ${itemId}`); return false; }
    let remainingQuantity = quantity;
    const lists = [quickBar, playerInventory];
    // 1. Try stacking
    if (itemDef.stackable) {
        for (let listIdx = 0; listIdx < lists.length; listIdx++) {
            const currentList = lists[listIdx];
            for (let i = 0; i < currentList.length; i++) {
                if (currentList[i]?.id === itemId) { currentList[i].quantity += remainingQuantity; remainingQuantity = 0; updateInventoryUI(); updateQuickBarUI(); updateCraftingUI(); return true; }
            }
        }
    }
    // 2. Find empty slot (Inv first)
    if (remainingQuantity > 0) {
        let emptyInvSlotIndex = playerInventory.findIndex(slot => !slot);
        if (emptyInvSlotIndex !== -1 && emptyInvSlotIndex < MAX_INVENTORY_SLOTS) { playerInventory[emptyInvSlotIndex] = { id: itemId, quantity: remainingQuantity }; remainingQuantity = 0; updateInventoryUI(); updateQuickBarUI(); updateCraftingUI(); return true; }
        else if (playerInventory.length < MAX_INVENTORY_SLOTS) { playerInventory.push({ id: itemId, quantity: remainingQuantity }); remainingQuantity = 0; updateInventoryUI(); updateQuickBarUI(); updateCraftingUI(); return true; }
        else { let emptyQBSlotIndex = quickBar.findIndex(slot => !slot); if (emptyQBSlotIndex !== -1) { quickBar[emptyQBSlotIndex] = { id: itemId, quantity: remainingQuantity }; remainingQuantity = 0; updateInventoryUI(); updateQuickBarUI(); updateCraftingUI(); return true; } }
    }
    if (remainingQuantity > 0) { logMessage("Inventory is full!"); return false; } return true;
 }
function removeItemFromInventory(itemId, quantity = 1, specificSlot = null, source = 'any') {
    const itemDef = items[itemId]; if (!itemDef) return false;
    let removedQuantity = 0; let qbSearched = false; let invSearched = false;
    const searchList = (list, listType) => { if (source !== 'any' && source !== listType) return false; for (let i = list.length - 1; i >= 0; i--) { const cs = list[i]; if (cs?.id === itemId) { if (specificSlot && (specificSlot.type !== listType || specificSlot.index !== i)) continue; const amount = Math.min(quantity - removedQuantity, cs.quantity); cs.quantity -= amount; removedQuantity += amount; if (cs.quantity <= 0) list[i] = null; if (removedQuantity >= quantity) return true; } } return false; };
    if (specificSlot) { if (specificSlot.type === 'quickbar') { if (searchList(quickBar, 'quickbar')) qbSearched = true; } else if (specificSlot.type === 'inventory') { if (searchList(playerInventory, 'inventory')) invSearched = true; } if (removedQuantity >= quantity) { updateInventoryUI(); updateQuickBarUI(); updateCraftingUI(); return true; } }
    if (removedQuantity < quantity && !qbSearched) { if (searchList(quickBar, 'quickbar')) qbSearched = true; if (removedQuantity >= quantity) { updateInventoryUI(); updateQuickBarUI(); updateCraftingUI(); return true; } }
    if (removedQuantity < quantity && !invSearched) { if (searchList(playerInventory, 'inventory')) invSearched = true; }
    if (removedQuantity > 0) { updateInventoryUI(); updateQuickBarUI(); updateCraftingUI(); } return removedQuantity >= quantity;
 }
function findInventoryItem(itemId) {
    let qbIndex = quickBar.findIndex(i => i?.id === itemId); if (qbIndex !== -1) return { item: quickBar[qbIndex], type: 'quickbar', index: qbIndex };
    let invIndex = playerInventory.findIndex(i => i?.id === itemId); if (invIndex !== -1) return { item: playerInventory[invIndex], type: 'inventory', index: invIndex }; return null;
}
function hasResources(requirements) {
    for (const itemId in requirements) { const req = requirements[itemId]; let cur = 0; quickBar.forEach(s => { if (s?.id === itemId) cur += s.quantity; }); playerInventory.forEach(s => { if (s?.id === itemId) cur += s.quantity; }); if (cur < req) return false; } return true;
}
function closeAllPanels() {
    if (isInventoryOpen) toggleInventory(false); if (isCraftingOpen) toggleCraftingMenu(false); if (isLootOpen) closeLootContainer();
    if (highlightedMesh?.renderOutline) { highlightedMesh.renderOutline = false; highlightedMesh = null; showInteractionPrompt(false); }
}
function pauseGame() { engine.stopRenderLoop(); document.exitPointerLock(); uiContainer.style.pointerEvents = 'all'; }
function resumeGame() { if (!isInventoryOpen && !isCraftingOpen && !isLootOpen) { engine.runRenderLoop(renderLoop); uiContainer.style.pointerEvents = 'none'; } }
function toggleInventory(forceState = null) {
    const willBeOpen = forceState !== null ? forceState : !isInventoryOpen; if (willBeOpen === isInventoryOpen) return;
    if (willBeOpen && (isCraftingOpen || isLootOpen)) closeAllPanels();
    isInventoryOpen = willBeOpen; inventoryPanel.classList.toggle('hidden', !isInventoryOpen);
    if (isInventoryOpen) { updateInventoryUI(); pauseGame(); } else resumeGame();
}
function updateInventoryUI() {
    inventoryGrid.innerHTML = ''; while (playerInventory.length < MAX_INVENTORY_SLOTS) playerInventory.push(null); if (playerInventory.length > MAX_INVENTORY_SLOTS) playerInventory.length = MAX_INVENTORY_SLOTS;
    for (let index = 0; index < MAX_INVENTORY_SLOTS; index++) {
         const item = playerInventory[index]; const slotDiv = document.createElement('div'); slotDiv.classList.add('slot'); slotDiv.style.pointerEvents = 'all'; slotDiv.dataset.slotType = 'inventory'; slotDiv.dataset.index = index;
         if (item) { const itemDef = items[item.id]; if (!itemDef) { console.warn(`Inv item? ${item.id}`); continue; } slotDiv.style.backgroundImage = `url(${itemDef.icon || ''})`; slotDiv.title = `${itemDef.name || '?'} (${item.quantity})`; if (itemDef.stackable && item.quantity > 1) { const cs = document.createElement('span'); cs.classList.add('item-count'); cs.textContent = item.quantity; slotDiv.appendChild(cs); } if (item.id === 'canteen' && item.contains) { const wi = document.createElement('div'); wi.style.cssText = `position: absolute; bottom: 3px; left: 3px; width: 18px; height: 18px; background-image: url(${items[item.contains.id]?.icon || ''}); background-size: contain; opacity: 0.9; pointer-events: none;`; slotDiv.appendChild(wi); slotDiv.title += ` - Contains: ${items[item.contains.id]?.name}`; }
         } else { slotDiv.title = 'Empty Inventory Slot'; }
         slotDiv.onclick = (event) => handleSlotClick(event, slotDiv, 'inventory', index); inventoryGrid.appendChild(slotDiv);
    }
 }
function updateQuickBarUI() {
    quickBarSlots.forEach((slotDiv, index) => {
        const item = quickBar[index]; slotDiv.innerHTML = ''; slotDiv.style.backgroundImage = ''; slotDiv.dataset.slotType = 'quickbar'; slotDiv.dataset.index = index; slotDiv.style.border = index === activeQuickBarIndex ? '2px solid yellow' : '1px solid #555'; slotDiv.style.pointerEvents = 'all';
        if (item) { const itemDef = items[item.id]; if (!itemDef) { console.warn(`QB item? ${item.id}`); return; } slotDiv.style.backgroundImage = `url(${itemDef.icon || ''})`; slotDiv.title = `${itemDef.name || '?'} (${item.quantity})`; if (itemDef.stackable && item.quantity > 1) { const cs = document.createElement('span'); cs.classList.add('item-count'); cs.textContent = item.quantity; slotDiv.appendChild(cs); } if (item.id === 'canteen' && item.contains) { const wi = document.createElement('div'); wi.style.cssText = `position: absolute; bottom: 3px; left: 3px; width: 18px; height: 18px; background-image: url(${items[item.contains.id]?.icon || ''}); background-size: contain; opacity: 0.9; pointer-events: none;`; slotDiv.appendChild(wi); slotDiv.title += ` - Contains: ${items[item.contains.id]?.name}`; }
        } else { slotDiv.title = 'Empty Quick Bar Slot'; }
        slotDiv.onclick = (event) => { if(isInventoryOpen) handleSlotClick(event, slotDiv, 'quickbar', index); else setActiveQuickBarSlot(index); };
    });
}
function handleSlotClick(event, slotDiv, sourceType, sourceIndex) { if (!isInventoryOpen) return; if (event.shiftKey) moveItem(sourceType, sourceIndex); }
function moveItem(sourceType, sourceIndex) {
    const sourceList = sourceType === 'inventory' ? playerInventory : quickBar; const targetList = sourceType === 'inventory' ? quickBar : playerInventory; const targetMaxSize = sourceType === 'inventory' ? quickBar.length : MAX_INVENTORY_SLOTS; const targetType = sourceType === 'inventory' ? 'quickbar' : 'inventory'; const itemToMove = sourceList[sourceIndex]; if (!itemToMove) return;
    let targetIndex = -1; for (let i = 0; i < targetMaxSize; i++) { if (i >= targetList.length || !targetList[i]) { targetIndex = i; break; } }
    if (targetIndex !== -1 && targetIndex < targetMaxSize) { while (targetIndex >= targetList.length && targetType === 'inventory') targetList.push(null); targetList[targetIndex] = itemToMove; sourceList[sourceIndex] = null; updateInventoryUI(); updateQuickBarUI(); } else logMessage(`Target ${targetType === 'quickbar' ? 'Quick Bar' : 'Inventory'} is full.`);
}


// --- Crafting ---
function toggleCraftingMenu(forceState = null) {
    const willBeOpen = forceState !== null ? forceState : !isCraftingOpen; if (willBeOpen === isCraftingOpen) return;
    if (willBeOpen && (isInventoryOpen || isLootOpen)) closeAllPanels();
    isCraftingOpen = willBeOpen; craftingMenu.classList.toggle('hidden', !isCraftingOpen);
    if (isCraftingOpen) { updateCraftingUI(); pauseGame(); } else resumeGame();
}
function isNearStation(stationType) { /* Placeholder - Requires proximity check */ return true; }
function updateCraftingUI() {
    craftingList.innerHTML = '';
    for (const itemId in recipes) {
        const recipe = recipes[itemId]; const itemDef = items[itemId]; if (!itemDef) continue;
        const stationOk = !recipe.station || isNearStation(recipe.station); const resOk = hasResources(recipe.requires); const canCraft = resOk && stationOk;
        const li = document.createElement('li'); li.style.pointerEvents = 'all'; li.dataset.itemId = itemId;
        let reqStr = Object.entries(recipe.requires).map(([reqId, qty]) => `${qty} ${items[reqId]?.name || '???'}`).join(', ');
        li.textContent = `${itemDef.name} (Needs: ${reqStr})`; if (recipe.station) li.textContent += ` [At ${items[recipe.station]?.name || recipe.station}]`;
        li.classList.toggle('can-craft', canCraft); li.classList.toggle('cannot-craft', !canCraft);
        if (canCraft) li.onclick = () => craftItem(itemId); else { li.title = stationOk ? "Not enough resources" : `Requires nearby ${items[recipe.station]?.name || recipe.station}`; li.style.cursor = 'not-allowed'; }
        craftingList.appendChild(li);
    }
}
function craftItem(itemId) {
    const recipe = recipes[itemId]; if (!recipe) return;
    const stationOk = !recipe.station || isNearStation(recipe.station);
    if (hasResources(recipe.requires) && stationOk) { let consumedOk = true; for (const reqId in recipe.requires) { if (!removeItemFromInventory(reqId, recipe.requires[reqId])) { console.error(`Craft Error: Remove ${items[reqId]?.name}`); logMessage(`Craft failed: resource error.`); consumedOk = false; break; } } if (consumedOk) { const created = recipe.creates; if (addItemToInventory(created.id, created.quantity)) logMessage(`Crafted ${created.quantity} ${items[created.id]?.name}!`); else logMessage(`Inventory full! Cannot receive crafted ${items[created.id]?.name}!`); updateCraftingUI(); }
    } else logMessage(stationOk ? "Not enough resources!" : `Requires nearby ${items[recipe.station]?.name || recipe.station}`);
}


// --- Placing Items ---
function handlePlacing() {
     if (inputMap["p"]) {
         const itemToPlace = getHeldItem(); if (!itemToPlace || !items[itemToPlace.id]?.placeable) { inputMap["p"]=false; return; }
         const placeableItemDef = items[itemToPlace.id]; const modelFileName = placeableItemDef.model; if (!modelFileName) { logMessage(`No model for ${placeableItemDef.name}`); inputMap["p"]=false; return; }
         const ray = new BABYLON.Ray(camera.globalPosition, camera.getForwardRay().direction, PLAYER_REACH + 2); const hit = scene.pickWithRay(ray, (mesh) => mesh === ground);
         if (hit.pickedPoint) { logMessage(`Placing ${placeableItemDef.name}...`); BABYLON.SceneLoader.ImportMeshAsync("", "assets/models/", modelFileName, scene) .then((result) => { if (!result.meshes?.length) throw new Error("Model has no meshes."); const placedMesh = result.meshes[0]; placedMesh.position = hit.pickedPoint.clone(); const bounds = placedMesh.getHierarchyBoundingVectors(true); const heightOffset = placedMesh.position.y - bounds.min.y; placedMesh.position.y += heightOffset + 0.01; placedMesh.checkCollisions = true; placedMesh.metadata = { type: "placed_object", originalItemId: itemToPlace.id }; shadowGenerator.addShadowCaster(placedMesh); placedMesh.receiveShadows = true; if (itemToPlace.id === 'campfire') { placedMesh.metadata.fuel = 0; placedMesh.metadata.isLit = false; placedMesh.metadata.cookingSlots = [null, null, null]; } else if (itemToPlace.id === 'forge') { placedMesh.metadata.fuel = 0; placedMesh.metadata.isLit = false; placedMesh.metadata.smeltingSlot = null; placedMesh.metadata.outputSlot = null; } logMessage(`Placed ${placeableItemDef.name} ok.`); if (!removeItemFromInventory(itemToPlace.id, 1, { type: 'quickbar', index: activeQuickBarIndex }, 'quickbar')) { console.error("Failed remove placed item!"); placedMesh.dispose(); logMessage("Placement failed (item error)."); } }).catch(error => { console.error("Error loading/placing model:", modelFileName, error); logMessage(`Error placing ${placeableItemDef.name}. Model missing/invalid?`); });
         } else logMessage("Cannot place item here.");
         inputMap["p"] = false;
     }
}


// --- Cooking / Boiling / Station Interaction (Placeholders) ---
function interactWithCampfire(campfireMesh) { logMessage("Campfire UI not implemented."); }
function interactWithForge(forgeMesh) { logMessage("Forge UI not implemented."); }
function fillCanteen(waterMesh) {
    const canteenInfo = findInventoryItem('canteen'); if (canteenInfo) { const theCanteen = canteenInfo.item; if (!theCanteen.contains || theCanteen.contains.id !== 'water_dirty') { theCanteen.contains = { id: 'water_dirty', quantity: 1 }; logMessage("Filled canteen with dirty water."); updateInventoryUI(); updateQuickBarUI(); } else logMessage("Canteen already contains dirty water."); } else logMessage("You need a canteen.");
}


// --- Central Timer Update Loop (Placeholder) ---
function updateWorldTimers(deltaTime) { /* Needs implementation */ }


// --- Animal Handling (Placeholders) ---
function updateAnimals(deltaTime) { /* Needs implementation */ }
function attackAnimal(animalMesh) {
    const meta = animalMesh.metadata; if (!meta || meta.isDead) return; const heldItem = getHeldItem(); const dmg = (heldItem && items[heldItem.id]?.tool === 'knife') ? 25 : (heldItem && items[heldItem.id]?.tool === 'axe') ? 15 : 5; if (!heldItem || !items[heldItem.id]?.tool) { logMessage("Need tool to attack."); return; } meta.health -= dmg; logMessage(`Attacked ${meta.species || 'Animal'}, health: ${meta.health}`); if (meta.health <= 0) { logMessage(`${meta.species || 'Animal'} killed!`); meta.isDead = true; meta.health = 0; } else meta.state = 'flee';
}
function harvestAnimal(animalMesh) {
    const meta = animalMesh.metadata; if (!meta || !meta.isDead || meta.harvested) return; const heldItem = getHeldItem(); if (!heldItem || items[heldItem.id]?.tool !== 'knife') { logMessage(`Need knife to harvest.`); return; } logMessage(`Harvesting ${meta.species || 'Animal'}...`); let harvested = false; if (meta.drops) { for (const itemId in meta.drops) { const qty = Math.floor(Math.random() * meta.drops[itemId]) + 1; if (qty > 0 && addItemToInventory(itemId, qty)) harvested = true; } } if (harvested) { meta.harvested = true; logMessage(`Harvested.`); setTimeout(() => { if (animalMesh) animalMesh.dispose(); }, 15000); if (highlightedMesh === animalMesh) { highlightedMesh = null; showInteractionPrompt(false); } } else { logMessage(`Nothing useful recovered.`); meta.harvested = true; setTimeout(() => { if (animalMesh) animalMesh.dispose(); }, 5000); }
}


// --- Utility Functions ---
function getHeldItem() { return (activeQuickBarIndex >= 0 && activeQuickBarIndex < quickBar.length) ? quickBar[activeQuickBarIndex] : null; }
function logMessage(message, duration = 3500) {
    const msgDiv = document.createElement('div'); msgDiv.textContent = message; messageLog.appendChild(msgDiv); const maxMessages = 5; while(messageLog.children.length > maxMessages) messageLog.removeChild(messageLog.firstChild);
    const fadeOutTimer = setTimeout(() => { msgDiv.style.opacity = '0'; msgDiv.style.transition = 'opacity 0.5s ease-out'; setTimeout(() => { if (msgDiv.parentNode === messageLog) messageLog.removeChild(msgDiv); }, 500); }, duration);
}


// --- Main Render Loop ---
let lastFrameTime = Date.now();
function renderLoop() {
    if (!scene || !engine) return; // Ensure engine/scene exists
    const currentTime = Date.now(); const deltaTime = (currentTime - lastFrameTime) / 1000.0; lastFrameTime = currentTime;
    // Only process game logic if not paused
    if (!isInventoryOpen && !isCraftingOpen && !isLootOpen) {
         handlePlayerMovement(deltaTime);
         castRay();
         handleInteraction();
         handlePlacing();
         // updateAnimals(deltaTime); // Placeholder
         // updateWorldTimers(deltaTime); // Placeholder
    }
    // Render the scene regardless of pause state
    scene.render();
}


// --- Game Initialization ---
async function startGame() {
    logMessage("Initializing game...", 5000);
    try {
        canvas.style.width = '100%'; canvas.style.height = '100%'; // Ensure canvas size
        scene = await createScene(); // Create scene, player, camera, etc.
        // UI Listeners
        closeInventoryBtn.onclick = () => toggleInventory(false); closeCraftingBtn.onclick = () => toggleCraftingMenu(false); closeLootBtn.onclick = closeLootContainer;
        setActiveQuickBarSlot(0); // Set initial QB highlight
        engine.runRenderLoop(renderLoop); // Start the main game loop
        logMessage("Game started!", 5000);
        window.addEventListener('resize', () => { engine.resize(); }); // Handle window resize
    } catch (error) {
        console.error("Error starting game:", error); logMessage(`FATAL ERROR: ${error.message}. Check console (F12).`, 60000);
        const errorDiv = document.createElement('div'); errorDiv.style.cssText = `position: absolute; top: 10px; left: 10px; padding: 15px; background-color: #8B0000; color: white; z-index: 100; border: 2px solid red; font-family: sans-serif; font-size: 1.1em;`; errorDiv.textContent = `ERROR INITIALIZING GAME: ${error.message}. See console (F12) for details.`; document.body.appendChild(errorDiv);
        if (engine) engine.stopRenderLoop(); // Stop loop if error occurred during init
    }
}

// --- Run the Game ---
document.addEventListener('DOMContentLoaded', () => {
    if (BABYLON.Engine.isSupported()) {
        startGame();
    } else {
        alert('Babylon.js is not supported on your browser!');
    }
});

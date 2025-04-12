// Wait for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("renderCanvas");
    const loadingScreen = document.getElementById("loadingScreen");
    const gameOverScreen = document.getElementById("gameOverScreen"); // Get game over screen

    // --- Engine Setup ---
    const engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false
    });
    engine.displayLoadingUI();

    // --- Global Game State ---
    let scene;
    let playerCamera; // Reference to the camera for position checks
    let gameRunning = true; // Flag to control game state
    let updateIntervalHandle = null; // Handle for the needs update interval

    // --- Survival Stats ---
    const MAX_NEED = 100;
    const STARTING_NEED = 80;
    let playerState = {
        hunger: STARTING_NEED,
        thirst: STARTING_NEED,
        wood: 0,
        stone: 0,
    };

    // --- UI Elements ---
    let ui; // AdvancedDynamicTexture (fullscreen UI)
    let hungerText, thirstText, woodText, stoneText, interactionText;

    // --- Configuration ---
    const HUNGER_DECAY_RATE = 0.2; // Points per second
    const THIRST_DECAY_RATE = 0.35; // Points per second
    const GATHER_DISTANCE = 5; // Max distance to gather resources

    // --- Create UI Function ---
    const createUI = () => {
        ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI");

        const panel = new BABYLON.GUI.StackPanel();
        panel.width = "220px";
        panel.isVertical = true;
        panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
        panel.paddingTop = "10px";
        panel.paddingLeft = "10px";
        ui.addControl(panel);

        const createText = (name, initialValue = "") => {
            const textBlock = new BABYLON.GUI.TextBlock(name, initialValue);
            textBlock.height = "30px";
            textBlock.color = "white";
            textBlock.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            textBlock.fontSize = 16;
            panel.addControl(textBlock);
            return textBlock;
        };

        hungerText = createText("hungerText", `Hunger: ${Math.floor(playerState.hunger)}%`);
        thirstText = createText("thirstText", `Thirst: ${Math.floor(playerState.thirst)}%`);
        woodText = createText("woodText", `Wood: ${playerState.wood}`);
        stoneText = createText("stoneText", `Stone: ${playerState.stone}`);

        // Interaction text (centered) - initially hidden
        interactionText = new BABYLON.GUI.TextBlock("interactionText", "");
        interactionText.color = "yellow";
        interactionText.fontSize = 20;
        interactionText.height = "40px";
        interactionText.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
        interactionText.isVisible = false;
        ui.addControl(interactionText);

    };

    // --- Update UI Function ---
    const updateUI = () => {
        if (!ui || !gameRunning) return; // Only update if UI exists and game is running
        hungerText.text = `Hunger: ${Math.floor(playerState.hunger)}%`;
        thirstText.text = `Thirst: ${Math.floor(playerState.thirst)}%`;
        woodText.text = `Wood: ${playerState.wood}`;
        stoneText.text = `Stone: ${playerState.stone}`;

        // Update text colors based on need level (visual warning)
        hungerText.color = playerState.hunger < 25 ? "red" : "white";
        thirstText.color = playerState.thirst < 25 ? "red" : "white";
    };

    // --- Update Needs Function (Called periodically) ---
    const updateNeeds = () => {
        if (!gameRunning) return;

        const deltaTime = engine.getDeltaTime() / 1000; // Time since last frame in seconds

        playerState.hunger -= HUNGER_DECAY_RATE * deltaTime;
        playerState.thirst -= THIRST_DECAY_RATE * deltaTime;

        // Clamp needs to 0
        playerState.hunger = Math.max(0, playerState.hunger);
        playerState.thirst = Math.max(0, playerState.thirst);

        updateUI(); // Update the display

        // Check for Game Over condition
        if (playerState.hunger <= 0 || playerState.thirst <= 0) {
            endGame();
        }
    };

    // --- Game Over Function ---
    const endGame = () => {
        if (!gameRunning) return; // Prevent multiple calls
        console.log("Game Over!");
        gameRunning = false;
        if (updateIntervalHandle) {
            clearInterval(updateIntervalHandle); // Stop the needs update timer
        }
        engine.stopRenderLoop(); // Stop rendering
        gameOverScreen.style.display = 'flex'; // Show the game over screen
        document.exitPointerLock(); // Release pointer lock
    };

    // --- Create Scene Function (Modified) ---
    const createScene = () => {
        scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color3(0.8, 0.9, 1);
        scene.collisionsEnabled = true;
        scene.gravity = new BABYLON.Vector3(0, -9.81 / 60, 0); // Adjusted gravity application

        // --- Camera (Store reference) ---
        playerCamera = new BABYLON.FreeCamera("playerCamera", new BABYLON.Vector3(0, 5, -10), scene);
        playerCamera.setTarget(BABYLON.Vector3.Zero());
        playerCamera.attachControl(canvas, true);
        playerCamera.checkCollisions = true;
        playerCamera.applyGravity = true;
        playerCamera.ellipsoid = new BABYLON.Vector3(0.6, 1.8, 0.6);
        playerCamera.minZ = 0.45;
        playerCamera.keysUp.push(87); // W
        playerCamera.keysDown.push(83); // S
        playerCamera.keysLeft.push(65); // A
        playerCamera.keysRight.push(68); // D
        playerCamera.speed = 0.35;
        playerCamera.angularSensibility = 4000;

        // --- Lighting ---
        const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0.5, 1, 0.2), scene);
        light.intensity = 0.8;

        // --- Ground ---
        const groundSize = 200;
        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: groundSize, height: groundSize, subdivisions: 50 }, scene);
        ground.checkCollisions = true;
        const groundMaterial = new BABYLON.StandardMaterial("groundMat", scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.6, 0.2); // Fallback color
        groundMaterial.diffuseTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/grass.png", scene);
        groundMaterial.diffuseTexture.uScale = 30;
        groundMaterial.diffuseTexture.vScale = 30;
        groundMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        ground.material = groundMaterial;

        // --- Skybox ---
        const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 500.0 }, scene);
        const skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMat", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://www.babylonjs-playground.com/textures/skybox", scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.disableLighting = true;
        skybox.material = skyboxMaterial;
        skybox.infiniteDistance = true;

        // --- Asset Creation Functions (Add Metadata) ---

        const createTree = (position, index) => {
            // ... (Tree creation code as before) ...
             const trunkHeight = 3 + Math.random() * 3;
            const trunkRadius = 0.2 + Math.random() * 0.3;
            const leavesRadius = 1.2 + Math.random() * 0.8;
            const trunk = BABYLON.MeshBuilder.CreateCylinder(`trunk_${index}`, {height: trunkHeight, diameter: trunkRadius * 2, tessellation: 8}, scene);
            trunk.position = position.clone();
            trunk.position.y += trunkHeight / 2;
            const trunkMaterial = new BABYLON.StandardMaterial(`trunkMat_${index}`, scene);
            trunkMaterial.diffuseColor = new BABYLON.Color3(0.45, 0.3, 0.18);
            trunk.material = trunkMaterial;
            trunk.checkCollisions = true;

            const leaves = BABYLON.MeshBuilder.CreateSphere(`leaves_${index}`, {diameter: leavesRadius * 2, segments: 10}, scene);
            leaves.position = trunk.position.clone();
            leaves.position.y += trunkHeight / 2 + leavesRadius * 0.5;
            const leavesMaterial = new BABYLON.StandardMaterial(`leavesMat_${index}`, scene);
            leavesMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.5 + Math.random()*0.1, 0.1 + Math.random() * 0.2);
            leaves.material = leavesMaterial;
            leaves.checkCollisions = true;
            leaves.setParent(trunk);

            // --- ADD METADATA for interaction ---
            trunk.metadata = { type: "tree", gathered: false };
            leaves.metadata = { type: "tree", gathered: false }; // Apply to leaves too if needed

            return trunk;
        };

        const createRock = (position, index) => {
             // ... (Rock creation code as before) ...
            const rockSize = 0.5 + Math.random() * 1.8;
            const rock = BABYLON.MeshBuilder.CreateSphere(`rock_${index}`, {diameterX: rockSize * (0.8 + Math.random() * 0.4), diameterY: rockSize * (0.6 + Math.random() * 0.4), diameterZ: rockSize * (0.8 + Math.random() * 0.4), segments: 8}, scene);
            rock.position = position.clone();
            rock.position.y += rock.getBoundingInfo().boundingBox.extendSize.y * rock.scaling.y;
            const rockMaterial = new BABYLON.StandardMaterial(`rockMat_${index}`, scene);
            const greyVal = 0.4 + Math.random() * 0.25;
            rockMaterial.diffuseColor = new BABYLON.Color3(greyVal, greyVal, greyVal + 0.02);
            rockMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
            rock.material = rockMaterial;
            rock.checkCollisions = true;
            rock.rotation.x = Math.random() * Math.PI * 2;
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.rotation.z = Math.random() * Math.PI * 2;

            // --- ADD METADATA for interaction ---
            rock.metadata = { type: "rock", gathered: false };

            return rock;
        };

        const createBuilding = (position, index) => {
            // ... (Building creation code as before, no metadata needed for basic version) ...
             const buildingWidth = 6 + Math.random() * 6;
            const buildingDepth = 6 + Math.random() * 6;
            const buildingHeight = 4 + Math.random() * 4;
            const wallThickness = 0.3;
            const buildingRoot = new BABYLON.TransformNode(`buildingRoot_${index}`, scene);
            buildingRoot.position = position.clone();
            const wallMat = new BABYLON.StandardMaterial(`buildingMat_${index}`, scene);
            const colorVal = 0.7 + Math.random() * 0.2;
            wallMat.diffuseColor = new BABYLON.Color3(colorVal, colorVal * 0.95, colorVal * 0.85);
            wallMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
            const wallN = BABYLON.MeshBuilder.CreateBox(`wallN_${index}`, {width: buildingWidth, height: buildingHeight, depth: wallThickness}, scene);
            wallN.position = new BABYLON.Vector3(0, buildingHeight / 2, buildingDepth / 2 - wallThickness / 2);
            wallN.material = wallMat; wallN.checkCollisions = true; wallN.setParent(buildingRoot);
            const wallS = BABYLON.MeshBuilder.CreateBox(`wallS_${index}`, {width: buildingWidth, height: buildingHeight, depth: wallThickness}, scene);
            wallS.position = new BABYLON.Vector3(0, buildingHeight / 2, -buildingDepth / 2 + wallThickness / 2);
            wallS.material = wallMat; wallS.checkCollisions = true; wallS.setParent(buildingRoot);
            const wallE = BABYLON.MeshBuilder.CreateBox(`wallE_${index}`, {width: wallThickness, height: buildingHeight, depth: buildingDepth - wallThickness*2 }, scene);
            wallE.position = new BABYLON.Vector3(buildingWidth / 2 - wallThickness / 2, buildingHeight / 2, 0);
            wallE.material = wallMat; wallE.checkCollisions = true; wallE.setParent(buildingRoot);
            const wallW = BABYLON.MeshBuilder.CreateBox(`wallW_${index}`, {width: wallThickness, height: buildingHeight, depth: buildingDepth - wallThickness*2 }, scene);
            wallW.position = new BABYLON.Vector3(-buildingWidth / 2 + wallThickness / 2, buildingHeight / 2, 0);
            wallW.material = wallMat; wallW.checkCollisions = true; wallW.setParent(buildingRoot);
            const roof = BABYLON.MeshBuilder.CreateBox(`roof_${index}`, {width: buildingWidth, height: wallThickness, depth: buildingDepth}, scene);
            roof.position = new BABYLON.Vector3(0, buildingHeight - wallThickness / 2, 0);
            roof.material = wallMat; roof.checkCollisions = true; roof.setParent(buildingRoot);
            buildingRoot.rotation.y = Math.random() * Math.PI * 0.15 - 0.075;
            return buildingRoot;
        };

        // --- Create Long Grass ---
        const createGrassPatch = (position, index, material) => {
            const grassHeight = 0.8 + Math.random() * 0.4;
            const grassWidth = 0.5 + Math.random() * 0.3;
            // Use CreatePlane for simple grass representation
            const plane = BABYLON.MeshBuilder.CreatePlane(`grass_${index}`, {height: grassHeight, width: grassWidth}, scene);
            plane.material = material;
            plane.position = position.clone();
            plane.position.y += grassHeight / 2; // Position base near ground
            plane.checkCollisions = false; // Grass shouldn't block player
            // Make grass always face the camera (Y-axis billboard)
            plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
            return plane;
        };

        // --- Populate World ---
        const numTrees = 80;
        const numRocks = 100;
        const numBuildings = 8;
        const numGrassPatches = 500; // Add lots of grass
        const placementArea = groundSize * 0.9;
        const halfPlacementArea = placementArea / 2;

        const getRandomPosition = () => new BABYLON.Vector3(
            Math.random() * placementArea - halfPlacementArea,
            0, // Base Y position
            Math.random() * placementArea - halfPlacementArea
        );

        console.log("Placing assets...");
        for (let i = 0; i < numTrees; i++) createTree(getRandomPosition(), i);
        for (let i = 0; i < numRocks; i++) createRock(getRandomPosition(), i);
        for (let i = 0; i < numBuildings; i++) {
            let pos;
            do { pos = getRandomPosition(); } while (Math.abs(pos.x) < 15 && Math.abs(pos.z) < 15);
            createBuilding(pos, i);
        }

        // Create Grass Material (Needs a transparent texture)
        const grassMat = new BABYLON.StandardMaterial("grassMat", scene);
        // Use a texture with transparency (alpha). Find/create a suitable PNG.
        // Placeholder using a playground texture - replace with a real grass sprite PNG
        grassMat.diffuseTexture = new BABYLON.Texture("https://playground.babylonjs.com/textures/grass.png", scene); // Needs alpha! Replace this texture.
        grassMat.diffuseTexture.hasAlpha = true; // Indicate texture has alpha channel
        grassMat.useAlphaFromDiffuseTexture = true; // Use the alpha channel for transparency
        grassMat.backFaceCulling = false; // Render both sides of the plane
        grassMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Reduce shininess
        grassMat.ambientColor = new BABYLON.Color3(0.8, 0.8, 0.8); // Make grass brighter

        // Place Grass Patches
        for (let i = 0; i < numGrassPatches; i++) {
            createGrassPatch(getRandomPosition(), i, grassMat);
        }

        console.log("Asset placement complete.");

        // --- Interaction Logic ---
        scene.onPointerDown = (evt, pickResult) => {
            if (!gameRunning || !pickResult.hit || !pickResult.pickedMesh) {
                return; // Only interact if game is running and something was hit
            }

            const mesh = pickResult.pickedMesh;
            const distance = BABYLON.Vector3.Distance(playerCamera.position, mesh.getAbsolutePosition());

            if (distance <= GATHER_DISTANCE) {
                if (mesh.metadata?.type === "tree" && !mesh.metadata.gathered) {
                    console.log("Gathering Wood");
                    playerState.wood += 1; // Simple gain
                    // Optional: Mark as gathered, change appearance, or remove mesh
                    // mesh.metadata.gathered = true;
                    // mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5); // Example: Shrink
                    mesh.setEnabled(false); // Example: Disable/hide the mesh (simplest)
                    updateUI();
                } else if (mesh.metadata?.type === "rock" && !mesh.metadata.gathered) {
                    console.log("Gathering Stone");
                    playerState.stone += 1;
                    // mesh.metadata.gathered = true;
                    mesh.setEnabled(false);
                    updateUI();
                }
            }
        };

        // --- Hint Text Logic (Show what player is looking at) ---
        scene.onBeforeRenderObservable.add(() => {
            if (!gameRunning) return;
             // Update needs based on delta time in the render loop
             updateNeeds();

            const ray = playerCamera.getForwardRay(GATHER_DISTANCE + 1); // Ray slightly longer than gather distance
            const pickInfo = scene.pickWithRay(ray, (mesh) => {
                // Only consider meshes that are gatherable resources
                return mesh.metadata?.type === 'tree' || mesh.metadata?.type === 'rock';
            });

            if (pickInfo && pickInfo.hit && pickInfo.pickedMesh && pickInfo.distance <= GATHER_DISTANCE) {
                const mesh = pickInfo.pickedMesh;
                if (mesh.metadata?.type && !mesh.metadata.gathered && mesh.isEnabled()) { // Check if enabled
                    interactionText.text = `Click to gather ${mesh.metadata.type}`;
                    interactionText.isVisible = true;
                } else {
                    interactionText.isVisible = false;
                }
            } else {
                interactionText.isVisible = false;
            }
        });


        // --- Scene Ready ---
        engine.hideLoadingUI();
        loadingScreen.classList.add("hidden");

        return scene;
    };

    // --- Main Execution ---
    scene = createScene(); // Create the scene
    createUI(); // Create the UI elements

    // --- Start Game Loop ---
    engine.runRenderLoop(() => {
        if (scene && scene.activeCamera && gameRunning) {
            scene.render();
        }
    });

    // --- Handle Window Resize ---
    window.addEventListener("resize", () => {
        engine.resize();
    });

    // --- Pointer Lock ---
    canvas.addEventListener("click", () => {
        if (gameRunning) { // Only lock if game is running
            canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
            if (canvas.requestPointerLock) {
                canvas.requestPointerLock();
            }
        }
    }, false);

}); // End DOMContentLoaded
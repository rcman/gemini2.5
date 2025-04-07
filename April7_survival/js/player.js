// js/player.js
const Player = {
    mesh: null,
    camera: null, // Reference to the main camera
    velocity: new THREE.Vector3(),
    onGround: false,
    health: 100,
    hunger: 100,
    stamina: 100,
    maxStamina: 100,
    staminaRegenRate: 5, // units per second
    sprintDrainRate: 10, // units per second
    hungerDrainRate: 0.1, // units per second
    lookSpeed: CONSTANTS.MOUSE_SENSITIVITY || 0.002, // Use constant or default
    canJump: true,

    // Camera control related
    pitchObject: null, // For up/down look
    yawObject: null,  // For left/right look (the player mesh itself)

    init: function(camera) {
        this.camera = camera;

        const playerHeight = 1.8;
        const playerRadius = 0.4;
        // More accurate capsule shape later, start with a box helper
        const geometry = new THREE.BoxGeometry(playerRadius * 2, playerHeight, playerRadius * 2);
        // Make player invisible or use a proper model later
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, visible: false });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, playerHeight / 2 + 5, 5); // Start slightly above ground

        // Set up camera hierarchy for FPS controls
        this.pitchObject = new THREE.Object3D();
        this.pitchObject.add(this.camera); // Add camera to pitch group

        this.yawObject = this.mesh; // Use the player mesh itself for yaw
        this.yawObject.add(this.pitchObject); // Add pitch group to yaw group (player mesh)

        // Set camera position relative to player center (eye level)
        this.camera.position.set(0, playerHeight * 0.4, 0); // Adjust y for eye level inside the invisible mesh

        Engine.scene.add(this.yawObject); // Add the player group to the scene

        console.log("Player Initialized");
        this.updateStatsUI(); // Initial UI update
    },

    update: function(deltaTime, worldColliders) {
        const speed = CONSTANTS.PLAYER_SPEED;
        const sprintMultiplier = CONSTANTS.PLAYER_SPRINT_MULTIPLIER;
        const gravity = CONSTANTS.GRAVITY;

        // --- Camera Rotation ---
        if (Input.isPointerLocked) {
             // Yaw (Left/Right) - Rotate the whole player object
             this.yawObject.rotation.y -= Input.mouse.x * this.lookSpeed;

             // Pitch (Up/Down) - Rotate the pitchObject
             this.pitchObject.rotation.x -= Input.mouse.y * this.lookSpeed;

             // Clamp pitch to prevent flipping over
             this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
        }
        Input.resetMouseDeltas(); // Reset mouse movement deltas


        // --- Movement ---
        let moveForward = 0;
        let moveRight = 0;

        if (Input.isKeyDown('w')) moveForward += 1;
        if (Input.isKeyDown('s')) moveForward -= 1;
        if (Input.isKeyDown('a')) moveRight -= 1;
        if (Input.isKeyDown('d')) moveRight += 1;

        let currentSpeed = speed;
        let isSprinting = false;
        if (Input.isKeyDown('shift') && this.stamina > 0 && moveForward > 0) { // Can only sprint forward
             currentSpeed *= sprintMultiplier;
             isSprinting = true;
             this.stamina -= this.sprintDrainRate * deltaTime;
             if (this.stamina < 0) this.stamina = 0;
        }

        // Calculate movement direction based on player's yaw rotation
        const moveDirection = new THREE.Vector3(moveRight, 0, moveForward);
        moveDirection.normalize(); // Ensure consistent speed regardless of diagonal movement
        moveDirection.applyEuler(new THREE.Euler(0, this.yawObject.rotation.y, 0, 'YXZ')); // Apply player's rotation

        this.velocity.x = moveDirection.x * currentSpeed;
        this.velocity.z = moveDirection.z * currentSpeed;


        // --- Jumping & Gravity ---
        // Simple ground check (replace with raycasting later)
        const groundY = 0.9; // Player mesh height / 2
        if (this.mesh.position.y <= groundY) {
            this.mesh.position.y = groundY;
            this.velocity.y = Math.max(0, this.velocity.y); // Stop falling velocity, allow jump impulse
            this.onGround = true;
            this.canJump = true; // Reset jump ability
        } else {
            this.onGround = false;
        }

        if (Input.isKeyDown(' ') && this.canJump && this.onGround && this.stamina >= 5) { // Jump requires some stamina
            this.velocity.y = CONSTANTS.PLAYER_JUMP_FORCE;
            this.stamina -= 5;
            this.canJump = false; // Prevent double jump in air
            this.onGround = false;
        }

        // Apply gravity if not on ground
        if (!this.onGround) {
             this.velocity.y += gravity * deltaTime;
        }


        // --- Apply Velocity ---
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        // --- Collision Detection (Very Basic Placeholder) ---
        // TODO: Implement proper collision with worldColliders (trees, rocks, buildings)
        // This might involve checking bounding boxes or using a physics engine


        // --- Stats Update ---
        if (!isSprinting && this.stamina < this.maxStamina) {
            this.stamina += this.staminaRegenRate * deltaTime;
            this.stamina = Math.min(this.stamina, this.maxStamina);
        }

        this.hunger -= this.hungerDrainRate * deltaTime;
        if (this.hunger < 0) this.hunger = 0;
        // TODO: Add effects for low hunger/stamina (e.g., health loss, reduced speed)

        if (this.hunger <= 0) {
            // Start taking health damage or other penalties
        }


        // Update UI periodically (or check if values changed)
        this.updateStatsUI(); // Inefficient to call every frame, optimize later

        // --- Interaction Check ---
        Interaction.update(this.camera, Game.World?.interactables || []); // Pass interactable objects from World

        // Handle Interaction Input
        if (Input.keys['e']) { // Check for 'e' press (only trigger once)
           Interaction.interact();
           Input.keys['e'] = false; // Consume the key press
        }

        // Handle Build Menu Toggle
        if (Input.keys['b']) {
            Game.UIManager.toggleBuildMenu();
            Input.keys['b'] = false; // Consume key press
            // Unlock pointer if opening menu
            if(Game.UIManager.isMenuOpen()) document.exitPointerLock();
        }
         // Handle Inventory Menu Toggle
        if (Input.keys['i']) {
            Game.UIManager.toggleInventoryMenu();
            Input.keys['i'] = false; // Consume key press
             if(Game.UIManager.isMenuOpen()) document.exitPointerLock();
        }

    },

    updateStatsUI: function() {
        Game.UIManager.updateStat('health', Math.floor(this.health));
        Game.UIManager.updateStat('hunger', Math.floor(this.hunger));
        Game.UIManager.updateStat('stamina', Math.floor(this.stamina));
    },

    // Function to be called by external events (e.g., eating, taking damage)
    changeHealth: function(amount) {
        this.health += amount;
        this.health = Math.max(0, Math.min(100, this.health)); // Clamp between 0 and 100
        this.updateStatsUI();
        if (this.health <= 0) {
            this.die();
        }
    },

    changeHunger: function(amount) {
        this.hunger += amount;
        this.hunger = Math.max(0, Math.min(100, this.hunger));
        this.updateStatsUI();
    },

    die: function() {
        console.log("Player Died!");
        Game.UIManager.logMessage("You have died!");
        // TODO: Implement respawn logic, game over screen, etc.
        // For now, maybe just reset position and stats
        this.mesh.position.set(0, 5, 5);
        this.health = 100;
        this.hunger = 100;
        this.stamina = 100;
        this.velocity.set(0,0,0);
        Inventory.items = {}; // Clear inventory on death (harsh!)
        Inventory.updateUI();
        this.updateStatsUI();
    },

    getPosition: function() {
        return this.mesh.position.clone();
    }
};

window.Player = Player;
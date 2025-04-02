// Fix for player movement and physics in player.js

// Improved updateMovement method
updateMovement(deltaTime) {
    // Calculate movement direction
    const moveDir = new THREE.Vector3();
    
    // Forward/backward movement
    if (this.keys.forward) {
        moveDir.z -= 1;
    }
    if (this.keys.backward) {
        moveDir.z += 1;
    }
    
    // Left/right movement
    if (this.keys.left) {
        moveDir.x -= 1;
    }
    if (this.keys.right) {
        moveDir.x += 1;
    }
    
    // Normalize movement direction if the player is moving
    if (moveDir.length() > 0) {
        moveDir.normalize();
    }
    
    // Apply rotation to movement - fix to use camera rotation properly
    const rotation = new THREE.Euler(0, this.camera.rotation.y, 0);
    moveDir.applyEuler(rotation);
    
    // Apply movement speed
    let currentSpeed = this.moveSpeed;
    if (this.keys.sprint) {
        currentSpeed *= 1.5;
    }
    if (this.keys.crouch) {
        currentSpeed *= 0.5;
    }
    
    // Apply movement
    this.velocity.x = moveDir.x * currentSpeed;
    this.velocity.z = moveDir.z * currentSpeed;
    
    // Apply gravity if not grounded
    if (!this.isGrounded) {
        this.velocity.y -= this.gravity * deltaTime;
    } else {
        // Small downward force when grounded to help maintain ground contact
        this.velocity.y = -0.1;
    }
    
    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
    
    // Apply boundaries to keep player in the playable area
    const worldLimit = this.world ? this.world.worldSize / 2 * 0.95 : 100;
    this.position.x = Utils.clamp(this.position.x, -worldLimit, worldLimit);
    this.position.z = Utils.clamp(this.position.z, -worldLimit, worldLimit);
}

// Improved checkGrounded method
checkGrounded() {
    if (!this.world) return false;
    
    // Cast a short ray downward to check if player is grounded
    const rayStart = new THREE.Vector3(this.position.x, this.position.y + 0.1, this.position.z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    
    const raycaster = new THREE.Raycaster(rayStart, rayDirection, 0, 0.3);
    const collidableObjects = this.world.getCollidableObjects();
    
    if (collidableObjects.length === 0) return false;
    
    const intersects = raycaster.intersectObjects(collidableObjects, true);
    
    this.isGrounded = intersects.length > 0;
    this.canJump = this.isGrounded;
    
    return this.isGrounded;
}

// Improved inventory interaction method for handling items
handleItemUse(activeItem) {
    if (!activeItem) return false;
    
    // Handle different item types
    switch (activeItem.type) {
        case 'food':
            // Consume food
            if (activeItem.foodValue > 0) {
                this.feed(activeItem.foodValue);
                this.inventory.removeItem(activeItem.id, 1);
                console.log(`Consumed ${activeItem.name} and restored ${activeItem.foodValue} hunger`);
                return true;
            }
            break;
            
        case 'tool':
            // Just show tool use animation
            console.log(`Used ${activeItem.name}`);
            return true;
            
        default:
            // No special action for other items
            return false;
    }
    
    return false;
}

// Add this new method to handle environment effects
updateEnvironmentEffects(deltaTime) {
    // Apply environmental effects based on conditions
    
    // Check if player is in water
    if (this.position.y <= this.world.waterLevel + 1) {
        // Slow down movement in water
        this.velocity.x *= 0.8;
        this.velocity.z *= 0.8;
        
        // Cause gradual thirst regeneration when in water (but unpurified)
        this.thirst = Math.min(100, this.thirst + 0.01 * deltaTime);
    }
    
    // Weather effects could be added here in future
    
    // Apply hunger/thirst impacts based on activities
    if (this.keys.sprint) {
        // Sprinting consumes more hunger
        this.hunger = Math.max(0, this.hunger - 0.015 * deltaTime);
        this.thirst = Math.max(0, this.thirst - 0.02 * deltaTime);
    }
}

// Now modify the update method to call this new function
update(deltaTime) {
    if (!this.controls) return;
    
    // Update movement
    this.updateMovement(deltaTime);
    
    // Update physics
    this.updatePhysics(deltaTime);
    
    // Update camera position
    this.updateCamera();
    
    // Check for interactions
    this.checkInteractions();
    
    // Update survival stats
    this.updateStats(deltaTime);
    
    // Add call to the new method
    this.updateEnvironmentEffects(deltaTime);
}
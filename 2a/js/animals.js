// Improved animal update method for smoother animation and fixes to animal behaviors

// Update a single animal - improved version
updateAnimal(animal, deltaTime, player) {
    const userData = animal.userData;
    
    if (!userData) return;
    
    // Calculate time since last update
    const now = Date.now();
    const elapsed = (now - userData.lastUpdateTime) / 1000;
    userData.lastUpdateTime = now;
    
    // Check player distance with improved performance
    const playerDistance = Utils.distance(animal.position, player.position);
    
    // Update animal state
    this.updateAnimalState(animal, playerDistance);
    
    // Handle movement based on state
    switch (userData.state) {
        case 'idle':
            // Small idle animation can be added here
            // For example, slight head movement
            animal.rotation.y += Math.sin(now * 0.001) * 0.01;
            break;
            
        case 'wandering':
            this.handleWandering(animal, elapsed);
            break;
            
        case 'fleeing':
            this.handleFleeing(animal, player, elapsed);
            break;
    }
    
    // Ensure the animal stays on terrain
    this.updateAnimalTerrainPosition(animal);
    
    // Prevent animals from going too far from their spawn point
    this.enforceWanderRadius(animal);
}

// New method to keep animals on terrain
updateAnimalTerrainPosition(animal) {
    if (!this.world) return;
    
    const terrainPos = this.world.getHeightAtPosition(animal.position.x, animal.position.z);
    if (terrainPos) {
        // Smoothly adjust height to terrain
        animal.position.y += (terrainPos.y - animal.position.y) * 0.1;
    }
}

// New method to keep animals within their wander radius
enforceWanderRadius(animal) {
    const userData = animal.userData;
    if (!userData || !userData.spawnPosition) return;
    
    const distanceFromSpawn = Utils.distance(animal.position, userData.spawnPosition);
    
    // If the animal has wandered too far, guide it back
    if (distanceFromSpawn > userData.wanderRadius * 1.2) {
        // Calculate direction back to spawn point
        const direction = new THREE.Vector3();
        direction.subVectors(userData.spawnPosition, animal.position).normalize();
        
        // Update target position to move back toward spawn
        if (!userData.targetPosition) {
            userData.targetPosition = new THREE.Vector3();
        }
        
        // Set a new target position halfway between current position and spawn
        userData.targetPosition.x = animal.position.x + direction.x * userData.wanderRadius * 0.5;
        userData.targetPosition.z = animal.position.z + direction.z * userData.wanderRadius * 0.5;
        
        // Update height at this position
        const terrainPos = this.world.getHeightAtPosition(userData.targetPosition.x, userData.targetPosition.z);
        if (terrainPos) {
            userData.targetPosition.y = terrainPos.y;
        }
        
        // Change state to wandering if not fleeing
        if (userData.state !== 'fleeing') {
            userData.state = 'wandering';
            userData.stateTimer = 5 + Math.random() * 5;
        }
    }
}

// Improved rotateAnimalToDirection for smoother rotation
rotateAnimalToDirection(animal, direction, elapsed) {
    const userData = animal.userData;
    
    // Calculate target rotation
    const targetRotation = Math.atan2(direction.x, direction.z);
    
    // Get current rotation
    let currentRotation = animal.rotation.y;
    
    // Calculate shortest rotation distance
    let rotationDiff = targetRotation - currentRotation;
    
    // Normalize to [-PI, PI]
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    
    // Apply rotation based on turn rate with smoothing
    const turnSpeed = userData.turnRate * elapsed;
    const rotationStep = Math.sign(rotationDiff) * Math.min(Math.abs(rotationDiff), turnSpeed);
    animal.rotation.y += rotationStep;
}

// Fix the wandering behavior to prevent animals getting stuck
handleWandering(animal, elapsed) {
    const userData = animal.userData;
    
    if (!userData.targetPosition) {
        // If no target, set a new random target
        this.setRandomWanderTarget(animal);
        return;
    }
    
    // Calculate direction to target
    const direction = new THREE.Vector3();
    direction.subVectors(userData.targetPosition, animal.position).normalize();
    
    // Move towards target
    animal.position.x += direction.x * userData.speed * elapsed;
    animal.position.z += direction.z * userData.speed * elapsed;
    
    // Rotate to face direction of movement
    this.rotateAnimalToDirection(animal, direction, elapsed);
    
    // Check if we've reached the target
    const distanceToTarget = Utils.distance2D(animal.position, userData.targetPosition);
    if (distanceToTarget < 1) {
        // Target reached, go idle for a bit
        userData.state = 'idle';
        userData.stateTimer = 2 + Math.random() * 5;
        userData.targetPosition = null;
    }
}

// New helper method to set a random wander target
setRandomWanderTarget(animal) {
    const userData = animal.userData;
    if (!userData || !userData.spawnPosition || !this.world) return;
    
    // Choose random target within wander radius
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * userData.wanderRadius * 0.7; // Stay within 70% of max radius for normal wandering
    
    const targetX = userData.spawnPosition.x + Math.cos(angle) * distance;
    const targetZ = userData.spawnPosition.z + Math.sin(angle) * distance;
    
    // Find height at target position
    const targetPos = this.world.getHeightAtPosition(targetX, targetZ);
    
    if (targetPos) {
        userData.targetPosition = targetPos;
    }
}
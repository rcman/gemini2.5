// js/ai.js

// Basic structure for AI entities
class AIController {
    constructor(game, mesh, config = {}) {
        this.game = game;
        this.mesh = mesh; // The Three.js mesh for this AI
        if (!this.mesh.userData) this.mesh.userData = {}; // Ensure userData exists
        this.mesh.userData.aiController = this; // Link controller back to mesh

        // Calculate height based on bounding box for more reliable ground check later
        const box = new THREE.Box3().setFromObject(this.mesh);
        this.height = box.max.y - box.min.y;
        this.halfHeight = this.height / 2;
        this.radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;

        this.health = config.health || 50;
        this.maxHealth = config.health || 50;
        this.speed = config.speed || 2.0;
        this.sightRange = config.sightRange || 20.0;
        this.attackRange = config.attackRange || 1.5;
        this.attackDamage = config.attackDamage || 10;
        this.attackCooldown = config.attackCooldown || 1.5; // Seconds between attacks
        this.lastAttackTime = 0;

        this.state = config.state || 'idle'; // Allow initial state override
        this.target = null; // Usually the player mesh
        this.wanderTargetPosition = null;
        this.wanderTime = Utils.getRandomInt(3, 8); // Start with some idle time
        
        this.stuckCheckInterval = 2.0; // Check for being stuck every 2 seconds
        this.stuckCheckTimer = 0;
        this.lastPosition = this.mesh.position.clone();
        this.stuckThreshold = 0.5; // If moved less than this in stuckCheckInterval, consider stuck
        
        this.pathRetryCount = 0;
        this.maxPathRetries = 3;

        this.velocity = new THREE.Vector3(); // For movement
        this.gravity = -15;
        this.onGround = false;
        this.collisionCooldown = 0; // Prevent getting stuck oscillating
    }

    update(deltaTime) {
        if(this.health <= 0 || this.state === 'dead') return; // Dead AI does nothing

        // Prevent updates if deltaTime is too large
        if (deltaTime > 0.1) deltaTime = 0.1;
        this.collisionCooldown -= deltaTime;
        
        // Update stuck check timer
        this.stuckCheckTimer += deltaTime;
        if (this.stuckCheckTimer >= this.stuckCheckInterval) {
            this.checkIfStuck();
            this.stuckCheckTimer = 0;
        }

        this.updateState(deltaTime);

        switch (this.state) {
            case 'idle':
                this.idle(deltaTime);
                break;
            case 'wander':
                this.wander(deltaTime);
                break;
            case 'chase':
                this.chase(deltaTime);
                break;
            case 'attack':
                this.attack(deltaTime);
                break;
            case 'flee':
                this.flee(deltaTime);
                break;
        }

        this.applyGravity(deltaTime);
        // Perform ground check *before* applying velocity to determine if gravity should apply next frame
        this.checkGroundStatus();
        this.applyVelocity(deltaTime);
    }
    
    checkIfStuck() {
        // Skip if we're in a valid non-movement state
        if (this.state === 'idle' || this.state === 'dead' || this.state === 'attack') {
            // Reset last position when in states where we expect no movement
            this.lastPosition.copy(this.mesh.position);
            return;
        }
        
        // Check movement since last check
        const distanceMoved = this.mesh.position.distanceTo(this.lastPosition);
        
        // If we've barely moved and we're not in idle state (handled above)
        if (distanceMoved < this.stuckThreshold) {
            this.pathRetryCount++;
            console.log(`AI ${this.mesh.uuid.substring(0,5)} might be stuck (retry ${this.pathRetryCount})`);
            
            if (this.pathRetryCount >= this.maxPathRetries) {
                // AI is stuck, take drastic action
                console.log(`AI ${this.mesh.uuid.substring(0,5)} is definitely stuck. Resetting...`);
                
                // Clear any target or wander position
                if (this.state === 'chase' || this.state === 'flee') {
                    this.target = null;
                }
                
                // Force state to wander which will select a new wander target
                this.setState('wander');
                this.wanderTargetPosition = null;
                this.velocity.set(0, 0, 0);
                
                // Reset path retry count
                this.pathRetryCount = 0;
            } else {
                // Try a small random move to get unstuck
                const randomAngle = Math.random() * Math.PI * 2;
                this.velocity.x = Math.cos(randomAngle) * this.speed;
                this.velocity.z = Math.sin(randomAngle) * this.speed;
            }
        } else {
            // We moved enough, reset the retry counter
            this.pathRetryCount = 0;
        }
        
        // Update last position for next check
        this.lastPosition.copy(this.mesh.position);
    }

    updateState(deltaTime) {
        const player = this.game.player;
        // If player doesn't exist or is dead, AI should go back to wandering/idle
        if (!player || player.health <= 0) {
            if (this.state !== 'wander' && this.state !== 'idle') {
                this.setState('wander');
            }
            this.target = null; // Clear target if player is invalid
            return; // Don't check distances etc. if no valid player
        }

        const distanceToPlayerSq = this.mesh.position.distanceToSquared(player.mesh.position);
        const sightRangeSq = this.sightRange * this.sightRange;
        const attackRangeSq = this.attackRange * this.attackRange;

        // State transitions (example for hostile hunter)
        switch (this.state) {
            case 'idle':
            case 'wander':
                if (distanceToPlayerSq < sightRangeSq) {
                    // Basic Line of Sight Check (optional but good)
                    if (this.hasLineOfSight(player.mesh)) {
                        this.setState('chase');
                        this.target = player.mesh;
                    }
                } else if (this.state === 'idle') {
                    // Handled within idle state now
                }
                break;
            case 'chase':
                if (!this.target || this.target.userData.type !== 'player') { // Target lost or invalid
                    this.setState('wander');
                    break;
                }
                if (distanceToPlayerSq <= attackRangeSq) {
                    this.setState('attack');
                } else if (distanceToPlayerSq > sightRangeSq * 1.5) { // Lose sight if too far
                    this.setState('wander'); // Go back to wandering
                    this.target = null;
                } else if (!this.hasLineOfSight(this.target)) { // Lose sight if blocked
                    // FIXED: Instead of immediately forgetting player, 
                    // wander towards last known position
                    this.wanderTargetPosition = this.target.position.clone();
                    this.wanderTime = 5; // Search for 5 seconds
                    this.setState('wander');
                    this.target = null;
                }
                break;
            case 'attack':
                if (!this.target || this.target.userData.type !== 'player' || player.health <= 0) { // Target lost or invalid
                    this.setState('wander');
                    break;
                }
                if (distanceToPlayerSq > attackRangeSq * 1.2) { // If player moves out of attack range
                    this.setState('chase'); // Chase again
                }
                // Could potentially transition to 'flee' if low health (add config option?)
                if (this.health < this.maxHealth * 0.2 && this.mesh.userData.aiType === 'chicken') {
                    this.setState('flee');
                }
                break;
            case 'flee':
                if (!this.target || this.target.userData.type !== 'player') { // Danger gone
                    this.setState('wander');
                    break;
                }
                // Transition back to wander if far enough from danger
                if (distanceToPlayerSq > sightRangeSq * 2.0) {
                    this.setState('wander');
                    this.target = null;
                }
                break;
            case 'dead':
                // No transitions out of dead state
                break;
        }
    }

    hasLineOfSight(targetMesh) {
        if (!targetMesh) return false;
        const raycaster = new THREE.Raycaster();
        const origin = this.mesh.position.clone().add(new THREE.Vector3(0, this.halfHeight * 0.8, 0)); // Ray origin near 'eyes'
        const targetPosition = targetMesh.position.clone().add(new THREE.Vector3(0, this.game.player.height / 2, 0)); // Aim for player center
        const direction = targetPosition.sub(origin).normalize();
        raycaster.set(origin, direction);
        raycaster.far = this.sightRange * 1.1; // Check slightly beyond sight range

        const collidableObjects = this.game.world.getCollidableObjects().filter(obj => 
            obj !== this.mesh && obj !== targetMesh
        );

        const intersects = raycaster.intersectObjects(collidableObjects);

        if (intersects.length > 0) {
            // Check if the first thing hit is closer than the target
            const distanceToTargetSq = origin.distanceToSquared(targetMesh.position);
            if (intersects[0].distance * intersects[0].distance < distanceToTargetSq) {
                return false; // Blocked
            }
        }
        return true; // Not blocked or hit target first/only
    }

    setState(newState) {
        if (this.state !== newState && this.state !== 'dead') { // Don't change state if dead
            console.log(`AI ${this.mesh.uuid.substring(0,5)} changing state from ${this.state} to ${newState}`);
            this.state = newState;
            
            // Reset state-specific variables
            if (newState === 'wander') {
                // Only clear wander target if not set manually (e.g. from chase)
                if (!this.wanderTargetPosition) {
                    this.wanderTargetPosition = null; // Find new wander target
                }
                this.target = null; // Clear explicit target when wandering
                if (!this.wanderTime || this.wanderTime <= 0) {
                    this.wanderTime = Utils.getRandomInt(5, 15);
                }
            } else if (newState === 'idle') {
                this.wanderTime = Utils.getRandomInt(3, 8); // Time to stay idle
                this.velocity.x = 0;
                this.velocity.z = 0;
            } else if (newState === 'flee') {
                // Make sure target is set for fleeing
                if (!this.target && this.game.player) {
                    this.target = this.game.player.mesh;
                }
            }
        }
    }

    // --- State Behaviors ---
    idle(deltaTime) {
        // Stand still, maybe play idle animation
        this.velocity.x = 0;
        this.velocity.z = 0;
        
        // Randomly start wandering
        this.wanderTime -= deltaTime;
        if (this.wanderTime <= 0) {
            this.setState('wander');
        }
    }

    wander(deltaTime) {
        if (!this.wanderTargetPosition || this.mesh.position.distanceToSquared(this.wanderTargetPosition) < 1.0) {
            this.findNewWanderTarget();
        }

        if(this.wanderTargetPosition) {
            this.moveTo(this.wanderTargetPosition, this.speed * 0.5, deltaTime); // Move slower when wandering
        }

        // Transition back to idle after a while
        this.wanderTime -= deltaTime;
        if (this.wanderTime <= 0 && this.state === 'wander') { // Only transition if still wandering
            this.setState('idle');
        }
    }

    findNewWanderTarget() {
        const wanderRadius = 15;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
            const randomAngle = Math.random() * Math.PI * 2;
            const randomDist = Math.random() * wanderRadius + 5; // Wander at least 5m away
            const targetPos = this.mesh.position.clone().add(
                new THREE.Vector3(Math.cos(randomAngle) * randomDist, 0, Math.sin(randomAngle) * randomDist)
            );

            // Basic check: Is the target point inside world bounds?
            const halfSize = this.game.world.worldSize / 2;
            if (targetPos.x < -halfSize || targetPos.x > halfSize || targetPos.z < -halfSize || targetPos.z > halfSize) {
                attempts++;
                continue; // Target outside world, try again
            }

            // Raycast down from slightly above the target position to find ground height
            const raycaster = new THREE.Raycaster(
                targetPos.clone().add(new THREE.Vector3(0, 30, 0)), // Start ray high up
                new THREE.Vector3(0, -1, 0) // Cast downwards
            );
            
            const groundIntersects = raycaster.intersectObjects(
                this.game.world.getCollidableObjects().filter(obj => obj.userData?.type === 'ground'), 
                false
            );

            if (groundIntersects.length > 0) {
                targetPos.y = groundIntersects[0].point.y; // Set Y to ground height
                this.wanderTargetPosition = targetPos;
                this.wanderTime = Utils.getRandomInt(8, 20); // Wander towards this point
                return; // Found valid target
            } else {
                attempts++; // No ground found below target, try again
            }
        }
        
        // If max attempts reached, just stay idle for a bit
        console.log(`AI ${this.mesh.uuid.substring(0,5)} failed to find wander target after ${maxAttempts} attempts.`);
        this.wanderTargetPosition = null;
        this.setState('idle');
    }

    chase(deltaTime) {
        if (this.target) {
            this.moveTo(this.target.position, this.speed, deltaTime);
            
            // Face the target while chasing
            const targetPos = this.target.position;
            this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);
        } else {
            this.setState('wander'); // Lost target
        }
    }

    attack(deltaTime) {
        this.velocity.x = 0; // Stop moving while attacking
        this.velocity.z = 0;

        if (this.target && this.game.player && this.game.player.health > 0) {
            // Face the target
            const targetPos = this.target.position;
            this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);

            const now = this.game.clock.getElapsedTime();
            if (now - this.lastAttackTime >= this.attackCooldown) {
                // Check distance again right before attacking
                if (this.mesh.position.distanceToSquared(targetPos) <= this.attackRange * this.attackRange * 1.1) {
                    console.log(`AI ${this.mesh.uuid.substring(0,5)} attacking player!`);
                    // Perform attack - deal damage to player
                    this.game.player.takeDamage(this.attackDamage);
                    this.lastAttackTime = now;
                    
                    // Show damage indicator
                    this.game.uiManager.showDamageIndicator();
                    
                    // Play attack animation/sound (placeholder)
                    this.playAttackAnimation();
                } else {
                    // Player moved out of range just before attack landed
                    this.setState('chase');
                }
            }
        } else {
            this.setState('wander'); // Target disappeared or died
        }
    }
    
    playAttackAnimation() {
        // Placeholder for attack animation
        // Could scale the mesh briefly, change color, etc.
        const originalScale = this.mesh.scale.clone();
        
        // Quick "lunge" animation
        this.mesh.scale.multiplyScalar(1.2);
        
        // Reset after short delay
        setTimeout(() => {
            if(this.mesh) {
                this.mesh.scale.copy(originalScale);
            }
        }, 150);
    }

    flee(deltaTime) {
        if (this.target) {
            const fleeDirection = this.mesh.position.clone().sub(this.target.position).normalize();
            fleeDirection.y = 0; // Flee horizontally
            
            // Check if flee direction is blocked
            if (this.isPathBlocked(fleeDirection, 1.5)) {
                // If blocked, try to flee left or right relative to the obstacle/target
                const right = fleeDirection.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
                if (!this.isPathBlocked(right, 1.5)) {
                    fleeDirection.copy(right);
                } else {
                    const left = right.clone().negate();
                    if (!this.isPathBlocked(left, 1.5)) {
                        fleeDirection.copy(left);
                    } else {
                        // Trapped - try moving in random directions
                        const randomAngle = Math.random() * Math.PI * 2;
                        fleeDirection.set(
                            Math.cos(randomAngle),
                            0,
                            Math.sin(randomAngle)
                        ).normalize();
                    }
                }
            }

            const fleeSpeed = this.speed * 1.2;
            this.velocity.x = fleeDirection.x * fleeSpeed;
            this.velocity.z = fleeDirection.z * fleeSpeed;
            this.rotateTowardsVelocity();

        } else {
            this.setState('wander'); // Danger gone
        }
    }

    // --- Movement Helpers ---
    moveTo(targetPosition, speed, deltaTime) {
        const direction = targetPosition.clone().sub(this.mesh.position);
        direction.y = 0; // Move horizontally only
        const distanceSq = direction.lengthSq();

        // Avoid moving if very close to prevent jittering
        if (distanceSq < 0.1) {
            this.velocity.x = 0;
            this.velocity.z = 0;
            return;
        }
        
        direction.normalize();

        // Improved Obstacle Avoidance with multiple rays
        if (this.isPathBlocked(direction, 1.5)) {
            // Cast rays at different angles to find a clear path
            const angles = [30, 60, -30, -60, 90, -90, 120, -120, 150, -150, 180]; // Degrees
            let bestDirection = null;
            let maxClearDistance = 0;
            
            for (const angle of angles) {
                const radians = THREE.MathUtils.degToRad(angle);
                // Rotate around Y axis
                const testDir = direction.clone();
                testDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), radians);
                
                // Check how far we can go in this direction
                const clearDistance = this.getClearPathDistance(testDir, 3.0);
                
                if (clearDistance > maxClearDistance) {
                    maxClearDistance = clearDistance;
                    bestDirection = testDir;
                }
            }
            
            if (bestDirection && maxClearDistance > 0.5) {
                // Use the best direction found
                direction.copy(bestDirection);
            } else {
                // All directions blocked, stop and wait
                this.velocity.x = 0;
                this.velocity.z = 0;
                return;
            }
        }

        this.velocity.x = direction.x * speed;
        this.velocity.z = direction.z * speed;

        this.rotateTowardsVelocity();
    }
    
    getClearPathDistance(direction, maxDistance) {
        const raycaster = new THREE.Raycaster();
        const origin = this.mesh.position.clone().add(new THREE.Vector3(0, this.halfHeight * 0.5, 0));
        raycaster.set(origin, direction);
        raycaster.far = maxDistance;

        const collidables = this.game.world.getCollidableObjects().filter(obj => obj !== this.mesh);
        const intersects = raycaster.intersectObjects(collidables);

        if (intersects.length > 0) {
            return intersects[0].distance - this.radius; // Return clear distance minus our radius
        }
        
        return maxDistance; // No obstacle within maxDistance
    }

    rotateTowardsVelocity() {
        // Rotate AI to face movement direction
        if (this.velocity.lengthSq() > 0.01) { // Only rotate if moving significantly
            const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
            // Smooth rotation with interpolation
            const currentAngle = this.mesh.rotation.y;
            let angleDiff = targetAngle - currentAngle;
            
            // Handle angle wrapping
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            const rotationSpeed = Math.PI * 2; // Radians per second
            const delta = this.game.clock.getDelta();
            const step = Math.min(Math.abs(angleDiff), rotationSpeed * delta);
            const newAngle = currentAngle + Math.sign(angleDiff) * step;
            
            this.mesh.rotation.y = newAngle;
        }
    }

    isPathBlocked(direction, distance) {
        if (this.collisionCooldown > 0) return false; // Temporarily disable check after recent collision

        const raycaster = new THREE.Raycaster();
        const origin = this.mesh.position.clone().add(new THREE.Vector3(0, this.halfHeight * 0.5, 0));
        raycaster.set(origin, direction);
        raycaster.far = distance + this.radius;

        const collidables = this.game.world.getCollidableObjects().filter(obj => obj !== this.mesh);
        const intersects = raycaster.intersectObjects(collidables);

        if (intersects.length > 0) {
            this.collisionCooldown = 0.2; // Prevent rapid checks when blocked
            return true;
        }
        return false;
    }

    applyGravity(deltaTime) {
        if (!this.onGround) {
            this.velocity.y += this.gravity * deltaTime;
            // Terminal velocity
            this.velocity.y = Math.max(this.velocity.y, -50.0);
        } else if (this.velocity.y < 0) {
            // Stop downward velocity if on ground
            this.velocity.y = 0;
        }
    }

    applyVelocity(deltaTime) {
        // Clone current position before moving
        const originalPosition = this.mesh.position.clone();
        
        // Calculate the move step
        const moveStep = this.velocity.clone().multiplyScalar(deltaTime);
        
        // Try horizontal movement first
        if (Math.abs(moveStep.x) > 0.001 || Math.abs(moveStep.z) > 0.001) {
            // Try x-axis movement
            const xStep = new THREE.Vector3(moveStep.x, 0, 0);
            const newPositionX = originalPosition.clone().add(xStep);
            
            // Check if x movement is blocked
            const xDir = new THREE.Vector3(Math.sign(moveStep.x), 0, 0);
            if (!this.isPathBlocked(xDir, Math.abs(moveStep.x) + this.radius)) {
                this.mesh.position.x = newPositionX.x;
            } else {
                this.velocity.x = 0; // Stop x movement if blocked
            }
            
            // Try z-axis movement
            const zStep = new THREE.Vector3(0, 0, moveStep.z);
            const newPositionZ = this.mesh.position.clone().add(zStep);
            
            // Check if z movement is blocked
            const zDir = new THREE.Vector3(0, 0, Math.sign(moveStep.z));
            if (!this.isPathBlocked(zDir, Math.abs(moveStep.z) + this.radius)) {
                this.mesh.position.z = newPositionZ.z;
            } else {
                this.velocity.z = 0; // Stop z movement if blocked
            }
        }
        
        // Apply vertical movement
        this.mesh.position.y += moveStep.y;
    }

    checkGroundStatus() {
        const raycaster = new THREE.Raycaster();
        // Start ray slightly above feet, cast down slightly more than half height
        const rayOrigin = this.mesh.position.clone().add(new THREE.Vector3(0, this.halfHeight * 0.5, 0));
        const rayLength = this.halfHeight + 0.2; // Check slightly below feet
        raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
        raycaster.far = rayLength;

        const collidables = this.game.world.getCollidableObjects().filter(obj => obj !== this.mesh);
        const intersects = raycaster.intersectObjects(collidables);

        let foundGround = false;
        if (intersects.length > 0) {
            const groundPoint = intersects[0].point;
            const groundDist = intersects[0].distance;
            
            // Check if the hit point is reasonably close to the feet
            if (groundDist < rayLength) {
                foundGround = true;
                // Snap to ground if slightly penetrating or floating
                this.mesh.position.y = groundPoint.y + this.halfHeight;
                this.velocity.y = Math.max(0, this.velocity.y); // Stop downward velocity
            }
        }

        this.onGround = foundGround;

        // Fallback check for extreme cases
        if (!this.onGround && this.mesh.position.y < this.halfHeight) {
            this.mesh.position.y = this.halfHeight;
            this.velocity.y = 0;
            this.onGround = true;
        }
    }

    // --- Damage & Death ---
    takeDamage(amount) {
        if (this.health <= 0 || this.state === 'dead') return; // Already dead

        this.health -= amount;
        console.log(`AI ${this.mesh.uuid.substring(0,5)} took ${amount} damage, health: ${this.health}`);

        // Show "hit" effect
        this.showHitEffect();

        if (this.health <= 0) {
            this.die();
        } else {
            // Potential behavior change on taking damage
            if (this.state === 'idle' || this.state === 'wander') {
                // If hit while idle/wandering, start chasing (if player exists)
                if (this.game.player && this.game.player.health > 0) {
                    this.target = this.game.player.mesh;
                    // Check LOS before chasing
                    if (this.hasLineOfSight(this.target)) {
                        this.setState('chase');
                    } else {
                        // Wander towards damage source
                        this.wanderTargetPosition = this.game.player.mesh.position.clone();
                        this.wanderTime = 5; // Search for 5 seconds
                        this.setState('wander');
                    }
                }
            } else if (this.health < this.maxHealth * 0.2) {
                // Flee if low health AND is a non-aggressive type
                if (this.mesh.userData.aiType === 'chicken') {
                    this.setState('flee');
                }
            }
        }
    }
    
    showHitEffect() {
        // Simple hit effect - flash the mesh red
        const originalMaterial = this.mesh.material;
        const originalColor = originalMaterial.color.clone();
        
        // Create a red hit material
        const hitMaterial = originalMaterial.clone();
        hitMaterial.color.set(0xff0000);
        this.mesh.material = hitMaterial;
        
        // Reset after a short delay
        setTimeout(() => {
            if (this.mesh && this.mesh.material) {
                this.mesh.material.dispose();
                this.mesh.material = originalMaterial;
                this.mesh.material.color.copy(originalColor);
            }
        }, 150);
    }

    die() {
        if (this.state === 'dead') return; // Prevent multiple deaths

        console.log(`AI ${this.mesh.uuid.substring(0,5)} died.`);
        this.health = 0;
        this.setState('dead'); // Use the state machine
        this.velocity.set(0, 0, 0); // Stop moving
        this.target = null;

        // "Death" animation - fall over
        this.mesh.rotation.x = Math.PI / 2; // Rotate to lie on side
        
        // Make non-collidable immediately
        this.mesh.userData.isCollidable = false;
        this.mesh.userData.isInteractable = false;

        // Drop loot
        this.dropLoot();

        // Remove after a delay (allows animation/death state to be visible)
        const removeDelay = 5000; // ms
        setTimeout(() => {
            if(this.mesh && this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
                // Dispose geometry/material
                if (this.mesh.geometry) this.mesh.geometry.dispose();
                if (this.mesh.material) {
                    if (Array.isArray(this.mesh.material)) {
                        this.mesh.material.forEach(m => m.dispose());
                    } else {
                        this.mesh.material.dispose();
                    }
                }
                
                // Clean up references
                this.game.world.removeAI(this);
            }
        }, removeDelay);
    }

    dropLoot() {
        // Ensure loot table exists in userData
        const lootTable = this.mesh.userData?.lootTable || [];
        if(lootTable.length === 0) {
            return;
        }
        
        console.log("Dropping loot for", this.mesh.uuid.substring(0,5), lootTable);

        let itemsToDrop = [];
        lootTable.forEach(itemDrop => {
            if (Math.random() < (itemDrop.chance ?? 1.0)) {
                const quantity = Utils.getRandomInt(itemDrop.min ?? 1, itemDrop.max ?? 1);
                if (quantity > 0 && itemDrop.itemId) {
                    console.log(` - Rolled ${quantity}x ${itemDrop.itemId}`);
                    itemsToDrop.push({ itemId: itemDrop.itemId, quantity: quantity });
                }
            }
        });

        if (itemsToDrop.length > 0) {
            this.game.world.createLootDrop(this.mesh.position, itemsToDrop);
        }
    }
}


// Factory function to create specific AI types
function createAI(game, type, position) {
    let mesh;
    let config = {};
    let userData = { type: 'ai', aiType: type, isCollidable: true, isInteractable: true }; // Base user data

    let geometry, material;
    let yOffset = 0; // Adjust based on model center

    switch (type) {
        case 'chicken':
             geometry = new THREE.SphereGeometry(0.3, 10, 8);
             material = new THREE.MeshStandardMaterial({ color: 0xffffff });
             yOffset = 0.3;
             config = { health: 10, speed: 1.5, sightRange: 8, attackRange: 0, attackDamage: 0, state: 'wander' };
             userData.type = 'ai_animal';
             userData.lootTable = [
                {itemId: 'raw_meat', min: 1, max: 1, chance: 0.9},
                {itemId: 'feathers', min: 2, max: 5, chance: 0.8}
             ];
            break;
        case 'wolf':
             geometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8); // Capsule better than box
             material = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Grey
             // Rotate capsule to be horizontal
             geometry.rotateX(Math.PI / 2);
             yOffset = 0.3; // Capsule radius
             config = { health: 75, speed: 5.0, sightRange: 25, attackRange: 1.8, attackDamage: 12, attackCooldown: 1.2 };
             userData.type = 'ai_hostile';
             userData.lootTable = [
                 {itemId: 'raw_meat', min: 1, max: 2, chance: 1.0},
                 {itemId: 'leather', min: 0, max: 1, chance: 0.6},
                 {itemId: 'fat', min: 0, max: 1, chance: 0.4}
             ];
            break;
        case 'hunter': // Hostile Human AI
             geometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8); // Height 1.0 + 2*Radius = 1.8 total height
             material = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown capsule
             yOffset = 0.9; // Capsule center = radius + height/2
             config = { health: 120, speed: 3.5, sightRange: 40, attackRange: 2.0 /* Or ranged attack */, attackDamage: 18, attackCooldown: 1.8 };
             userData.type = 'ai_hostile';
             userData.lootTable = [ // Example hunter loot
                {itemId: 'cooked_meat', min: 0, max: 1, chance: 0.3},
                {itemId: 'canteen', min: 0, max: 1, chance: 0.1}, // Low chance for gear
                // Add ammo, bandages etc. later
             ];
            break;
        // Add cases for deer, bear, rabbit, cougar etc.
        default:
            console.warn("Unknown AI type requested:", type);
            return null;
    }

    mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y + yOffset, position.z); // Use calculated yOffset
    mesh.castShadow = true;
    mesh.userData = userData; // Assign specific user data
    game.scene.add(mesh);

    const aiController = new AIController(game, mesh, config);
    mesh.userData.aiController = aiController; // Ensure link is set AFTER controller created

    // Add AI mesh to world's interactable list (needed for player interaction raycast)
    // This can also be handled dynamically by world.getInteractableObjects()
    // game.world.interactableObjects.push(mesh); // Might be redundant if getter is used

    return aiController;
}
// js/ai.js - Fixed AI movement and pathfinding
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
        if (!this.wanderTargetPosition || this.mesh.position.distanceToSquared(this
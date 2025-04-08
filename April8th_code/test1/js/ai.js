// js/ai.js

// Basic structure for AI entities
class AIController {
    constructor(game, mesh, config = {}) {
        this.game = game;
        this.mesh = mesh; // The Three.js mesh for this AI
        this.mesh.userData.aiController = this; // Link controller back to mesh

        this.health = config.health || 50;
        this.maxHealth = config.health || 50;
        this.speed = config.speed || 2.0;
        this.sightRange = config.sightRange || 20.0;
        this.attackRange = config.attackRange || 1.5;
        this.attackDamage = config.attackDamage || 10;
        this.attackCooldown = config.attackCooldown || 1.5; // Seconds between attacks
        this.lastAttackTime = 0;

        this.state = 'idle'; // 'idle', 'wander', 'chase', 'attack', 'flee'
        this.target = null; // Usually the player mesh
        this.wanderTargetPosition = null;
        this.wanderTime = 0;

         this.velocity = new THREE.Vector3(); // For movement
         this.gravity = -15;
         this.onGround = false;
    }

    update(deltaTime) {
         if(this.health <= 0) return; // Dead AI does nothing

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
         this.applyVelocity(deltaTime);
          this.checkGroundStatus(); // Simple ground check
    }

    updateState(deltaTime) {
         const player = this.game.player;
         if (!player || player.health <= 0) {
            if (this.state !== 'wander' && this.state !== 'idle') {
                 this.setState('wander'); // Player gone or dead, go back to wandering
            }
             return;
         }

         const distanceToPlayerSq = this.mesh.position.distanceToSquared(player.mesh.position);
         const sightRangeSq = this.sightRange * this.sightRange;
         const attackRangeSq = this.attackRange * this.attackRange;

         // State transitions (example for hostile hunter)
         switch (this.state) {
            case 'idle':
            case 'wander':
                if (distanceToPlayerSq < sightRangeSq) {
                    this.setState('chase');
                    this.target = player.mesh;
                } else if (this.state === 'idle') {
                     // Randomly decide to start wandering after a delay
                     if(Math.random() < 0.01) this.setState('wander');
                }
                break;
            case 'chase':
                if (distanceToPlayerSq <= attackRangeSq) {
                    this.setState('attack');
                } else if (distanceToPlayerSq > sightRangeSq * 1.5) { // Lose sight if too far
                    this.setState('wander'); // Go back to wandering
                    this.target = null;
                }
                break;
            case 'attack':
                if (distanceToPlayerSq > attackRangeSq * 1.2) { // If player moves out of attack range
                    this.setState('chase'); // Chase again
                }
                 // Could potentially transition to 'flee' if low health
                break;
            case 'flee':
                // Transition back to wander if far enough from danger?
                break;
         }
    }

     setState(newState) {
         if (this.state !== newState) {
            // console.log(`AI ${this.mesh.uuid} changing state from ${this.state} to ${newState}`);
             this.state = newState;
             // Reset state-specific variables if needed
             if (newState === 'wander') {
                 this.wanderTargetPosition = null; // Find new wander target
             }
             this.velocity.x = 0; // Stop horizontal movement on state change often makes sense
             this.velocity.z = 0;
         }
     }


    // --- State Behaviors (Placeholders - NEED IMPLEMENTATION) ---
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
            // Find a new random point nearby
            const wanderRadius = 15;
            const randomAngle = Math.random() * Math.PI * 2;
             const randomDist = Math.random() * wanderRadius;
            this.wanderTargetPosition = this.mesh.position.clone().add(
                new THREE.Vector3(Math.cos(randomAngle) * randomDist, 0, Math.sin(randomAngle) * randomDist)
            );
             // Basic check: ensure target isn't below ground? Raycast down?
             this.wanderTargetPosition.y = this.mesh.position.y; // Keep wander on same level for simplicity
             // Set a time limit for wandering towards this point
             this.wanderTime = Utils.getRandomInt(5, 15); // Wander for 5-15 seconds or until point reached
         }

         if(this.wanderTargetPosition) {
             this.moveTo(this.wanderTargetPosition, this.speed * 0.5, deltaTime); // Move slower when wandering
         }

         // Transition back to idle after a while?
         this.wanderTime -= deltaTime;
         if (this.wanderTime <= 0) {
             this.setState('idle');
             this.wanderTime = Utils.getRandomInt(3, 8); // Idle for 3-8 seconds
         }
    }

    chase(deltaTime) {
        if (this.target) {
             this.moveTo(this.target.position, this.speed, deltaTime);
        } else {
             this.setState('wander'); // Lost target
        }
    }

    attack(deltaTime) {
         this.velocity.x = 0; // Stop moving while attacking
         this.velocity.z = 0;

        if (this.target) {
             // Face the target
             this.mesh.lookAt(this.target.position.x, this.mesh.position.y, this.target.position.z); // Look at target on same Y level

             const now = this.game.clock.getElapsedTime();
             if (now - this.lastAttackTime >= this.attackCooldown) {
                 console.log(`AI ${this.mesh.uuid} attacking player!`);
                 // Perform attack - deal damage to player
                 this.game.player.takeDamage(this.attackDamage);
                 this.lastAttackTime = now;
                 // Play attack animation/sound
             }
        } else {
             this.setState('wander'); // Target disappeared?
        }
    }

    flee(deltaTime) {
         if (this.target) {
            const fleeDirection = this.mesh.position.clone().sub(this.target.position).normalize();
            fleeDirection.y = 0; // Flee horizontally
            const fleeTarget = this.mesh.position.clone().addScaledVector(fleeDirection, this.speed * 1.2); // Flee faster
             this.moveTo(fleeTarget, this.speed * 1.2, deltaTime);
        } else {
            this.setState('wander'); // Danger gone
        }
    }

     // --- Movement Helpers ---
      moveTo(targetPosition, speed, deltaTime) {
         const direction = targetPosition.clone().sub(this.mesh.position);
         direction.y = 0; // Move horizontally only for now
         direction.normalize();

         this.velocity.x = direction.x * speed;
         this.velocity.z = direction.z * speed;

         // Rotate AI to face movement direction
          if (this.velocity.lengthSq() > 0.01) { // Only rotate if moving significantly
             const angle = Math.atan2(this.velocity.x, this.velocity.z);
             this.mesh.rotation.y = angle;
          }
     }

     applyGravity(deltaTime) {
         if (!this.onGround) {
             this.velocity.y += this.gravity * deltaTime;
         }
     }

     applyVelocity(deltaTime) {
         const moveStep = this.velocity.clone().multiplyScalar(deltaTime);
         const newPosition = this.mesh.position.clone().add(moveStep);

         // Basic floor collision
         // TODO: Replace with better ground checking/physics
         const groundY = this.mesh.geometry.parameters.height / 2 || 0.5; // Adjust based on mesh origin
         if (newPosition.y < groundY) {
             newPosition.y = groundY;
             this.velocity.y = 0;
             this.onGround = true;
         }

         this.mesh.position.copy(newPosition);
     }

     checkGroundStatus() {
          // Simple check for now
          const groundY = this.mesh.geometry.parameters.height / 2 || 0.5;
          this.onGround = this.mesh.position.y <= groundY + 0.1;
     }

    // --- Damage & Death ---
    takeDamage(amount) {
        if (this.health <= 0) return; // Already dead

        this.health -= amount;
        console.log(`AI ${this.mesh.uuid} took ${amount} damage, health: ${this.health}`);

        if (this.health <= 0) {
            this.die();
        } else {
            // Potential behavior change on taking damage (e.g., flee, become more aggressive)
             if(this.state !== 'chase' && this.state !== 'attack' && this.state !== 'flee') {
                 // If hit while idle/wandering, start chasing
                 this.target = this.game.player.mesh;
                 this.setState('chase');
             } else if (this.health < this.maxHealth * 0.2) {
                  // Flee if low health? (Based on AI type)
                 // this.setState('flee');
             }
        }
    }

    die() {
        console.log(`AI ${this.mesh.uuid} died.`);
        this.health = 0;
        this.setState('dead'); // Special state?
         this.velocity.set(0,0,0); // Stop moving

        // TODO: Play death animation, disable collision, maybe despawn after a timer
         // Drop loot?
         this.dropLoot();

         // Simple removal after a delay
         setTimeout(() => {
              if(this.mesh.parent) this.mesh.parent.remove(this.mesh);
              // Clean up controller? Remove from game's AI list?
              this.game.world.removeAI(this);
         }, 10000); // Remove after 10 seconds

         // Make mesh non-interactable immediately?
         this.mesh.userData = {}; // Clear user data to prevent further interaction
    }

     dropLoot() {
        // Determine loot based on AI type (from config?)
        const lootTable = this.mesh.userData.lootTable || []; // e.g., [{itemId: 'raw_meat', min: 1, max: 2, chance: 1.0}, ...]
        console.log("Dropping loot for", this.mesh.uuid, lootTable)

         lootTable.forEach(itemDrop => {
             if (Math.random() < itemDrop.chance) {
                 const quantity = Utils.getRandomInt(itemDrop.min, itemDrop.max);
                 if (quantity > 0) {
                    console.log(` - Dropping ${quantity}x ${itemDrop.itemId}`);
                     // TODO: Create a physical loot bag object in the world at AI's position
                     // For now, maybe just add directly to player if close enough? (Less realistic)
                     // this.game.inventoryManager.add(itemDrop.itemId, quantity);
                     this.game.world.createLootDrop(this.mesh.position, [{itemId: itemDrop.itemId, quantity: quantity}]);
                 }
             }
         });
     }
}


// Factory function to create specific AI types
function createAI(game, type, position) {
    let mesh;
    let config = {};
    let userData = { type: 'ai', aiType: type }; // Base user data

    switch (type) {
        case 'chicken':
            mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
             mesh.position.set(position.x, 0.3, position.z);
            config = { health: 10, speed: 1.5, sightRange: 5, attackRange: 0, attackDamage: 0, state: 'wander' };
            userData.type = 'ai_animal';
             userData.lootTable = [
                {itemId: 'raw_meat', min: 1, max: 1, chance: 0.9},
                {itemId: 'feathers', min: 2, max: 5, chance: 0.8}
             ];
            break;
        case 'wolf':
             mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x808080 })); // Grey box
             mesh.position.set(position.x, 0.3, position.z);
            config = { health: 75, speed: 5.0, sightRange: 25, attackRange: 1.8, attackDamage: 12, attackCooldown: 1.2 };
            userData.type = 'ai_hostile';
             userData.lootTable = [
                 {itemId: 'raw_meat', min: 1, max: 2, chance: 1.0},
                 {itemId: 'leather', min: 0, max: 1, chance: 0.6},
                 {itemId: 'fat', min: 0, max: 1, chance: 0.4}
             ];
            break;
        case 'hunter': // Hostile Human AI
             mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.0, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8B4513 })); // Brown capsule
             mesh.position.set(position.x, 0.9, position.z); // Y adjusted for capsule center
            config = { health: 120, speed: 3.5, sightRange: 40, attackRange: 2.0 /* Or ranged attack */, attackDamage: 18, attackCooldown: 1.8 };
            userData.type = 'ai_hostile';
             // TODO: Add loot for hunters (ammo, bandages, etc.)
            break;
        // Add cases for deer, bear, rabbit, cougar etc.
        default:
            console.warn("Unknown AI type requested:", type);
            return null;
    }

    mesh.castShadow = true;
     mesh.userData = userData; // Assign specific user data
    game.scene.add(mesh);
    return new AIController(game, mesh, config);
}

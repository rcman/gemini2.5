// Physics system for handling collisions and physics interactions
class Physics {
    constructor() {
        this.colliders = {
            boxes: [],
            spheres: [],
            cylinders: [],
            terrain: null,
            player: null
        };
        
        this.gravity = 9.8;
    }
    
    addBoxCollider(collider) {
        this.colliders.boxes.push(collider);
    }
    
    addSphereCollider(collider) {
        this.colliders.spheres.push(collider);
    }
    
    addCylinderCollider(collider) {
        this.colliders.cylinders.push(collider);
    }
    
    addTerrainCollider(collider) {
        this.colliders.terrain = collider;
    }
    
    addPlayerCollider(collider) {
        this.colliders.player = collider;
    }
    
    removeCollider(collider) {
        // Check in boxes
        const boxIndex = this.colliders.boxes.indexOf(collider);
        if (boxIndex !== -1) {
            this.colliders.boxes.splice(boxIndex, 1);
            return;
        }
        
        // Check in spheres
        const sphereIndex = this.colliders.spheres.indexOf(collider);
        if (sphereIndex !== -1) {
            this.colliders.spheres.splice(sphereIndex, 1);
            return;
        }
        
        // Check in cylinders
        const cylinderIndex = this.colliders.cylinders.indexOf(collider);
        if (cylinderIndex !== -1) {
            this.colliders.cylinders.splice(cylinderIndex, 1);
            return;
        }
        
        // Check if it's the terrain or player
        if (this.colliders.terrain === collider) {
            this.colliders.terrain = null;
        }
        
        if (this.colliders.player === collider) {
            this.colliders.player = null;
        }
    }
    
    updateCollider(collider) {
        // Update collider properties (usually after player settings change)
        // Currently only used for player height changes
        
        if (collider === this.colliders.player) {
            // Update player collider geometry
            this.colliders.player.mesh.geometry.dispose();
            this.colliders.player.mesh.geometry = new THREE.CapsuleGeometry(
                collider.radius, 
                collider.height - collider.radius * 2, 
                8, 
                16
            );
        }
    }
    
    update(deltaTime) {
        // Perform physics updates
        // For now, we're only handling collisions
        
        // Update player-terrain collision
        if (this.colliders.player && this.colliders.terrain) {
            this.checkPlayerTerrainCollision();
        }
    }
    
    checkCollisions(collider) {
        const collisions = [];
        
        // Check collisions with boxes
        for (const box of this.colliders.boxes) {
            const collision = this.checkCollision(collider, box);
            if (collision) {
                collisions.push({
                    self: collider,
                    other: box,
                    normal: collision.normal,
                    depth: collision.depth
                });
            }
        }
        
        // Check collisions with spheres
        for (const sphere of this.colliders.spheres) {
            const collision = this.checkCollision(collider, sphere);
            if (collision) {
                collisions.push({
                    self: collider,
                    other: sphere,
                    normal: collision.normal,
                    depth: collision.depth
                });
            }
        }
        
        // Check collisions with cylinders
        for (const cylinder of this.colliders.cylinders) {
            const collision = this.checkCollision(collider, cylinder);
            if (collision) {
                collisions.push({
                    self: collider,
                    other: cylinder,
                    normal: collision.normal,
                    depth: collision.depth
                });
            }
        }
        
        return collisions;
    }
    
    checkCollision(colliderA, colliderB) {
        // Handle different collision types
        if (colliderA.type === 'player' && colliderB.type === 'box') {
            return this.checkCapsuleBoxCollision(colliderA, colliderB);
        }
        
        if (colliderA.type === 'player' && colliderB.type === 'sphere') {
            return this.checkCapsuleSphereCollision(colliderA, colliderB);
        }
        
        if (colliderA.type === 'player' && colliderB.type === 'cylinder') {
            return this.checkCapsuleCylinderCollision(colliderA, colliderB);
        }
        
        // Default: no collision
        return null;
    }
    
    checkPlayerTerrainCollision() {
        // For simple terrain, we cast a ray down from the player
        // and adjust height to stay on the terrain
        
        const player = this.colliders.player;
        const terrain = this.colliders.terrain;
        
        if (!player || !terrain) return;
        
        const playerPos = player.mesh.position.clone();
        
        // Cast ray down from player position
        const raycaster = new THREE.Raycaster(
            new THREE.Vector3(playerPos.x, playerPos.y + 10, playerPos.z),
            new THREE.Vector3(0, -1, 0)
        );
        
        const intersects = raycaster.intersectObject(terrain.mesh);
        
        if (intersects.length > 0) {
            const groundHeight = intersects[0].point.y;
            
            // Check if player is below ground level
            if (playerPos.y < groundHeight + player.height / 2) {
                // Adjust player position to stay on ground
                player.mesh.position.y = groundHeight + player.height / 2;
                
                // Return collision result
                return {
                    normal: new THREE.Vector3(0, 1, 0),
                    depth: groundHeight - (playerPos.y - player.height / 2)
                };
            }
        }
        
        return null;
    }
    
    checkCapsuleBoxCollision(capsule, box) {
        // Simplified capsule-box collision
        // We treat the capsule as a sphere for simplicity
        
        const capsulePos = capsule.mesh.position.clone();
        const boxPos = box.mesh.position.clone();
        
        // Get box dimensions
        const boxWidth = box.width || 1;
        const boxHeight = box.height || 1;
        const boxDepth = box.depth || 1;
        
        // Get closest point on box to capsule center
        const closestPoint = new THREE.Vector3(
            Math.max(boxPos.x - boxWidth / 2, Math.min(capsulePos.x, boxPos.x + boxWidth / 2)),
            Math.max(boxPos.y - boxHeight / 2, Math.min(capsulePos.y, boxPos.y + boxHeight / 2)),
            Math.max(boxPos.z - boxDepth / 2, Math.min(capsulePos.z, boxPos.z + boxDepth / 2))
        );
        
        // Calculate distance to closest point
        const distance = capsulePos.distanceTo(closestPoint);
        
        // Check if collision occurs
        if (distance < capsule.radius) {
            // Calculate collision normal
            const normal = new THREE.Vector3().subVectors(capsulePos, closestPoint).normalize();
            
            // Calculate penetration depth
            const depth = capsule.radius - distance;
            
            return { normal, depth };
        }
        
        return null;
    }
    
    checkCapsuleSphereCollision(capsule, sphere) {
        // Simplified capsule-sphere collision
        // We treat the capsule as a sphere for simplicity
        
        const capsulePos = capsule.mesh.position.clone();
        const spherePos = sphere.mesh.position.clone();
        
        // Calculate distance between centers
        const distance = capsulePos.distanceTo(spherePos);
        
        // Calculate sum of radii
        const radiusSum = capsule.radius + sphere.radius;
        
        // Check if collision occurs
        if (distance < radiusSum) {
            // Calculate collision normal
            const normal = new THREE.Vector3().subVectors(capsulePos, spherePos).normalize();
            
            // Calculate penetration depth
            const depth = radiusSum - distance;
            
            return { normal, depth };
        }
        
        return null;
    }
    
    checkCapsuleCylinderCollision(capsule, cylinder) {
        // Simplified capsule-cylinder collision
        // We treat both shapes as spheres for simplicity
        
        const capsulePos = capsule.mesh.position.clone();
        const cylinderPos = cylinder.mesh.position.clone();
        
        // Calculate 2D distance (ignoring y-axis for cylinder)
        const xDiff = capsulePos.x - cylinderPos.x;
        const zDiff = capsulePos.z - cylinderPos.z;
        const distance2D = Math.sqrt(xDiff * xDiff + zDiff * zDiff);
        
        // Check if collision occurs in 2D
        if (distance2D < capsule.radius + cylinder.radius) {
            // Calculate collision normal
            const normal = new THREE.Vector3(xDiff, 0, zDiff).normalize();
            
            // Calculate penetration depth
            const depth = (capsule.radius + cylinder.radius) - distance2D;
            
            return { normal, depth };
        }
        
        return null;
    }
}
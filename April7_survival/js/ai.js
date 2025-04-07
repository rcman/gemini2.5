// js/ai.js
const AI = {
    agents: [], // Array to hold all AI agents (animals, hunters)

    init: function() {
        console.log("AI System Initialized");
        // Example: Spawn a simple "chicken" (just a cube for now)
        // this.spawnAgent('chicken', new THREE.Vector3(10, 0.5, 10));
    },

    spawnAgent: function(type, position) {
        let agentMesh;
        const agentData = { type: type, health: 5, state: 'idle' /* wandering, fleeing, attacking */ };

        // Create a visual representation (replace with models later)
        if (type === 'chicken') {
            const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const material = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // White
            agentMesh = new THREE.Mesh(geometry, material);
            agentMesh.castShadow = true;
            agentData.health = 3;
        } else if (type === 'wolf') {
             const geometry = new THREE.BoxGeometry(1.2, 0.8, 0.6);
             const material = new THREE.MeshLambertMaterial({ color: 0x555555 }); // Grey
             agentMesh = new THREE.Mesh(geometry, material);
             agentMesh.castShadow = true;
             agentData.health = 25;
             agentData.state = 'wandering';
        }
         else {
            console.warn("Unknown AI type to spawn:", type);
            return null;
        }

        agentMesh.position.copy(position);
        agentMesh.userData = agentData; // Store AI data here
        agentMesh.name = type; // Helpful for debugging

        Engine.scene.add(agentMesh);
        this.agents.push(agentMesh);
        console.log(`Spawned ${type} at`, position);
        return agentMesh;
    },

    update: function(deltaTime, playerPosition) {
        if (!playerPosition) return;

        this.agents.forEach(agent => {
            // Simple Placeholder AI Logic:
            const data = agent.userData;
            const distToPlayer = agent.position.distanceTo(playerPosition);

            if (data.type === 'chicken') {
                // Flee if player is close
                if (distToPlayer < 8 && data.state !== 'fleeing') {
                    data.state = 'fleeing';
                    console.log("Chicken fleeing!");
                } else if (distToPlayer >= 15 && data.state === 'fleeing') {
                     data.state = 'idle'; // Stop fleeing if player is far away
                     console.log("Chicken calmed down.");
                }

                if (data.state === 'fleeing') {
                    const fleeDirection = agent.position.clone().sub(playerPosition).normalize();
                    agent.position.add(fleeDirection.multiplyScalar(2 * deltaTime)); // Move away
                    // Simple ground clamp
                    agent.position.y = Math.max(0.25, agent.position.y - 1 * deltaTime);
                } else {
                    // Idle wander (very basic)
                    if (Math.random() < 0.01) { // Occasionally change direction
                        data.wanderDirection = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    }
                    if (data.wanderDirection) {
                        agent.position.add(data.wanderDirection.clone().multiplyScalar(0.5 * deltaTime));
                         agent.position.y = Math.max(0.25, agent.position.y - 1 * deltaTime);
                    }
                }
            } else if (data.type === 'wolf') {
                // Basic Hunter Logic
                if (distToPlayer < 20 && data.state !== 'attacking') {
                    data.state = 'attacking';
                    console.log("Wolf detected player!");
                } else if (distToPlayer >= 30 && data.state === 'attacking') {
                     data.state = 'wandering';
                     console.log("Wolf lost player");
                }

                 if (data.state === 'attacking') {
                     const attackDirection = playerPosition.clone().sub(agent.position).normalize();
                     // Prevent flying wolves
                     attackDirection.y = 0;
                     agent.position.add(attackDirection.multiplyScalar(3 * deltaTime)); // Move towards player

                     // Basic attack (if very close)
                     if(distToPlayer < 1.5) {
                         // Damage player (needs rate limiting!)
                         if(!data.attackCooldown || Date.now() > data.attackCooldown) {
                              console.log("Wolf attacks!");
                              Player.changeHealth(-10); // Damage player
                              data.attackCooldown = Date.now() + 1500; // 1.5 sec cooldown
                         }
                     }

                 } else if (data.state === 'wandering') {
                      // Idle wander
                     if (Math.random() < 0.02) {
                         data.wanderDirection = new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                     }
                     if (data.wanderDirection) {
                         agent.position.add(data.wanderDirection.clone().multiplyScalar(1.5 * deltaTime));
                     }
                 }
                 // Simple ground clamp
                 agent.position.y = Math.max(0.4, agent.position.y - 2 * deltaTime);
            }

            // TODO: Add more complex behaviors, pathfinding, health management, etc.
             // TODO: Make AI interact with the environment (avoid obstacles)
        });
    },

    removeAgent: function(agentMesh) {
        const index = this.agents.indexOf(agentMesh);
        if (index > -1) {
            this.agents.splice(index, 1);
            Engine.scene.remove(agentMesh);
            // Dispose geometry/material if needed
            // agentMesh.geometry.dispose();
            // agentMesh.material.dispose();
            console.log("Removed AI agent:", agentMesh.name);
        }
    }
};

window.AI = AI;
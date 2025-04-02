// Update the noise-related methods in the World class
// Replace these methods in the world.js file

createTerrain() {
    // Create ground plane
    const terrainSize = this.worldSize;
    const terrainSegments = 100;
    
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    
    // Apply some terrain height variation
    const vertices = geometry.attributes.position.array;
    
    for (let i = 0; i < vertices.length; i += 3) {
        // Skip the edges to create a flat border
        const x = vertices[i];
        const z = vertices[i + 2];
        const distanceFromCenter = Math.sqrt(x * x + z * z);
        const normalizedDistance = distanceFromCenter / (terrainSize / 2);
        
        // Apply height with Perlin noise
        if (normalizedDistance < 0.8) {
            // Use our improved noise function for terrain height
            const noiseScale = 0.02;
            const height = Utils.noise(vertices[i] * noiseScale, vertices[i + 2] * noiseScale) * this.terrainHeight;
            vertices[i + 1] = height;
        } else {
            // Create a slope toward the edges
            const t = (normalizedDistance - 0.8) / 0.2;
            const height = Utils.noise(vertices[i] * 0.02, vertices[i + 2] * 0.02) * this.terrainHeight;
            vertices[i + 1] = height * (1 - t) + this.waterLevel * t;
        }
    }
    
    // Update geometry
    geometry.computeVertexNormals();
    geometry.attributes.position.needsUpdate = true;
    
    // Create terrain material with texture
    const material = new THREE.MeshStandardMaterial({
        color: 0x54852C,
        roughness: 0.9,
        metalness: 0.1
    });
    
    // Apply texture if available
    if (this.assetLoader.getTexture('terrain')) {
        material.map = this.assetLoader.getTexture('terrain');
        material.map.repeat.set(20, 20);
    }
    
    // Create mesh and add to scene
    const terrain = new THREE.Mesh(geometry, material);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    
    this.scene.add(terrain);
    this.objects.push(terrain);
    this.groundObjects.push(terrain);
    
    // Create terrain collider
    const terrainCollider = {
        mesh: terrain,
        type: 'terrain'
    };
    
    this.physics.addTerrainCollider(terrainCollider);
    terrain.physics = { collider: terrainCollider };
}

// Remove these methods from world.js as they're now in Utils
// noise(x, z) { ... }
// fade(t) { ... }
// lerp(a, b, t) { ... }
// pseudoRandom(n) { ... }
// js/constants.js

// --- Helper functions to create wall geometries with holes ---
function createWallGeometry(width = 4, height = 3, depth = 0.2) {
    // Simple solid wall using BoxGeometry for simplicity and matching foundation width
    return new THREE.BoxGeometry(width, height, depth);
}

function createWindowWallGeometry(width = 4, height = 3, depth = 0.2) {
    const windowWidth = 2;    // Width of the window opening
    const windowHeight = 1.2; // Height of the window opening
    const windowBottom = 1.0; // Distance from wall bottom to window bottom

    const wallShape = new THREE.Shape();

    // Outer boundary (counter-clockwise) - Width matches foundation
    wallShape.moveTo(-width / 2, 0);
    wallShape.lineTo(width / 2, 0);
    wallShape.lineTo(width / 2, height);
    wallShape.lineTo(-width / 2, height);
    wallShape.lineTo(-width / 2, 0);

    // Window hole (clockwise)
    const windowHole = new THREE.Path();
    const winLeft = -windowWidth / 2;
    const winRight = windowWidth / 2;
    const winTop = windowBottom + windowHeight;

    windowHole.moveTo(winLeft, windowBottom); // Start bottom-left of hole
    windowHole.lineTo(winLeft, winTop);       // Go up
    windowHole.lineTo(winRight, winTop);      // Go right
    windowHole.lineTo(winRight, windowBottom); // Go down
    windowHole.lineTo(winLeft, windowBottom);  // Close path

    wallShape.holes.push(windowHole);

    const extrudeSettings = {
        steps: 1,
        depth: depth,
        bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);
    // MUST Center it like BoxGeometry for placement/collision logic to work correctly.
    geometry.translate(0, -height / 2, -depth / 2); // Center it vertically and depth-wise

    return geometry;
}

function createDoorwayWallGeometry(width = 4, height = 3, depth = 0.2) {
    // Define doorway size relative to the standard door size (1.4w x 2.8h)
    const doorWidth = 1.6;  // Make doorway slightly wider than the door
    // --- THIS VALUE WAS UPDATED ---
    const doorHeight = 2.85; // Make doorway slightly taller than the door
    // --- END UPDATE ---

    const wallShape = new THREE.Shape();

    // Outer boundary (counter-clockwise) - Width matches foundation
    wallShape.moveTo(-width / 2, 0);
    wallShape.lineTo(width / 2, 0);
    wallShape.lineTo(width / 2, height);
    wallShape.lineTo(-width / 2, height);
    wallShape.lineTo(-width / 2, 0);

    // Doorway hole (clockwise)
    const doorHole = new THREE.Path();
    const doorLeft = -doorWidth / 2;
    const doorRight = doorWidth / 2;
    const doorTop = doorHeight; // Doorway height from the floor (y=0)

    doorHole.moveTo(doorLeft, 0);       // Start bottom-left of hole (at floor level)
    doorHole.lineTo(doorLeft, doorTop); // Go up
    doorHole.lineTo(doorRight, doorTop); // Go right across the top of the opening
    doorHole.lineTo(doorRight, 0);      // Go down to floor level

    wallShape.holes.push(doorHole);

    const extrudeSettings = {
        steps: 1,
        depth: depth,
        bevelEnabled: false,
    };

    const geometry = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);
    // MUST Center it like BoxGeometry for placement/collision/door alignment logic
    geometry.translate(0, -height / 2, -depth / 2);

    return geometry;
}
// --- End Helper Functions ---


const CONSTANTS = {
    PLAYER_SPEED: 5.0,
    PLAYER_SPRINT_MULTIPLIER: 1.8,
    PLAYER_JUMP_FORCE: 7.0,
    GRAVITY: -19.6,
    INTERACTION_RANGE: 2.5,
    MOUSE_SENSITIVITY: 0.002,
    RESOURCES: {
        WOOD: { id: 'wood', name: 'Wood', color: 0x8B4513 },
        STONE: { id: 'stone', name: 'Stone', color: 0x808080 },
        FIBER: { id: 'fiber', name: 'Fiber', color: 0x00FF00 },
    },
    // Define buildable items using the new geometries
    BUILDABLES: {
        // Width = 4
        foundation: { id: 'foundation', name: 'Foundation', geometry: new THREE.BoxGeometry(4, 0.2, 4) },
        // Uses helper with default width = 4
        wall: { id: 'wall', name: 'Wall', geometry: createWallGeometry() },
        // Uses helper with default width = 4
        wall_doorway: { id: 'wall_doorway', name: 'Wall w/ Doorway', geometry: createDoorwayWallGeometry() },
        // Uses helper with default width = 4
        wall_window: { id: 'wall_window', name: 'Wall w/ Window', geometry: createWindowWallGeometry() },
        // Door dimensions (doesn't need to match foundation width)
        door: { id: 'door', name: 'Door', geometry: new THREE.BoxGeometry(1.4, 2.8, 0.1) },
        // Other items
        campfire: { id: 'campfire', name: 'Campfire', geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12)},
        crafting_table: { id: 'crafting_table', name: 'Crafting Table', geometry: new THREE.BoxGeometry(1.5, 1, 1) },
        forge: { id: 'forge', name: 'Forge', geometry: new THREE.BoxGeometry(1.2, 0.8, 1.2) },
    },
    // Crafting Recipes
    RECIPES: {
        // Tools
        axe: { wood: 3, stone: 2 },
        // Buildables
        foundation: { wood: 4, stone: 2 },
        wall: { wood: 2 },
        wall_doorway: { wood: 2 },
        wall_window: { wood: 2 },
        door: { wood: 4 },
        crafting_table: { wood: 10 },
        forge: { stone: 15, wood: 5 },
        campfire: { wood: 5, fiber: 2 },
    }
};

window.CONSTANTS = CONSTANTS;
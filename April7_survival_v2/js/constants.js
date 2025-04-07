// js/constants.js

// --- Helper functions to create wall geometries with holes ---
// (Keep these helper functions exactly as they were)
function createWallGeometry(width = 4, height = 3, depth = 0.2) {
    return new THREE.BoxGeometry(width, height, depth);
}

function createWindowWallGeometry(width = 4, height = 3, depth = 0.2) {
    const windowWidth = 2;
    const windowHeight = 1.2;
    const windowBottom = 1.0;
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-width / 2, 0);
    wallShape.lineTo(width / 2, 0);
    wallShape.lineTo(width / 2, height);
    wallShape.lineTo(-width / 2, height);
    wallShape.lineTo(-width / 2, 0);
    const windowHole = new THREE.Path();
    const winLeft = -windowWidth / 2;
    const winRight = windowWidth / 2;
    const winTop = windowBottom + windowHeight;
    windowHole.moveTo(winLeft, windowBottom);
    windowHole.lineTo(winLeft, winTop);
    windowHole.lineTo(winRight, winTop);
    windowHole.lineTo(winRight, windowBottom);
    windowHole.lineTo(winLeft, windowBottom);
    wallShape.holes.push(windowHole);
    const extrudeSettings = { steps: 1, depth: depth, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);
    geometry.translate(0, -height / 2, -depth / 2);
    return geometry;
}

function createDoorwayWallGeometry(width = 4, height = 3, depth = 0.2) {
    const doorWidth = 1.6;
    const doorHeight = 2.85; // Updated height
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-width / 2, 0);
    wallShape.lineTo(width / 2, 0);
    wallShape.lineTo(width / 2, height);
    wallShape.lineTo(-width / 2, height);
    wallShape.lineTo(-width / 2, 0);
    const doorHole = new THREE.Path();
    const doorLeft = -doorWidth / 2;
    const doorRight = doorWidth / 2;
    const doorTop = doorHeight;
    doorHole.moveTo(doorLeft, 0);
    doorHole.lineTo(doorLeft, doorTop);
    doorHole.lineTo(doorRight, doorTop);
    doorHole.lineTo(doorRight, 0);
    wallShape.holes.push(doorHole);
    const extrudeSettings = { steps: 1, depth: depth, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);
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
        // Add other resources if needed
    },
    BUILDABLES: {
        foundation: { id: 'foundation', name: 'Foundation', geometry: new THREE.BoxGeometry(4, 0.2, 4) },
        wall: { id: 'wall', name: 'Wall', geometry: createWallGeometry() },
        wall_doorway: { id: 'wall_doorway', name: 'Wall w/ Doorway', geometry: createDoorwayWallGeometry() },
        wall_window: { id: 'wall_window', name: 'Wall w/ Window', geometry: createWindowWallGeometry() },
        door: { id: 'door', name: 'Door', geometry: new THREE.BoxGeometry(1.4, 2.8, 0.1) },
        campfire: { id: 'campfire', name: 'Campfire', geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12)},
        crafting_table: { id: 'crafting_table', name: 'Crafting Table', geometry: new THREE.BoxGeometry(1.5, 1, 1) },
        forge: { id: 'forge', name: 'Forge', geometry: new THREE.BoxGeometry(1.2, 0.8, 1.2) },
        // Add other buildables
    },
    // Crafting Recipes
    RECIPES: {
        // Tools
        axe: { wood: 3, stone: 2 },
        // *** ADDED PLACEHOLDERS FOR NEW STARTING ITEMS ***
        pickaxe: { wood: 3, stone: 4, name: 'Pickaxe' }, // Added name property for clarity
        knife:   { wood: 1, stone: 1, name: 'Knife' },    // Added name property
        canteen: { fiber: 5, wood: 1, name: 'Canteen' }, // Added name property
        // *** END ADDED PLACEHOLDERS ***

        // Buildables
        foundation: { wood: 4, stone: 2 },
        wall: { wood: 2 },
        wall_doorway: { wood: 2 },
        wall_window: { wood: 2 },
        door: { wood: 4 },
        crafting_table: { wood: 10 },
        forge: { stone: 15, wood: 5 },
        campfire: { wood: 5, fiber: 2 },
        // Add other real recipes
    }
};

window.CONSTANTS = CONSTANTS;
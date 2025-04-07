// js/constants.js
const CONSTANTS = {
    PLAYER_SPEED: 5.0,
    PLAYER_SPRINT_MULTIPLIER: 1.8,
    PLAYER_JUMP_FORCE: 7.0,
    GRAVITY: -19.6,
    INTERACTION_RANGE: 2.5,
    MOUSE_SENSITIVITY: 0.002, // Added sensitivity constant here
    // Add more constants: AI speeds etc.
    RESOURCES: {
        WOOD: { id: 'wood', name: 'Wood', color: 0x8B4513 },
        STONE: { id: 'stone', name: 'Stone', color: 0x808080 },
        FIBER: { id: 'fiber', name: 'Fiber', color: 0x00FF00 },
        // Add all other resources... Iron, Copper, etc.
    },
    // Define buildable items here too for reference (name, geometry)
    BUILDABLES: {
        foundation: { id: 'foundation', name: 'Foundation', geometry: new THREE.BoxGeometry(4, 0.2, 4) },
        wall: { id: 'wall', name: 'Wall', geometry: new THREE.BoxGeometry(4, 3, 0.2) },
        campfire: { id: 'campfire', name: 'Campfire', geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12)}
        // Add more buildables...
    },
    // Crafting Recipes (ItemToCraft: { IngredientID: AmountNeeded })
    RECIPES: {
        // Tools / Existing Items
        axe: { wood: 3, stone: 2 },
        // Buildables (Ensure keys match BUILDABLES keys)
        foundation: { wood: 4, stone: 2 },
        wall: { wood: 2 },
        campfire: { wood: 5, fiber: 2 },
        // ... more recipes
    }
};

// Make constants globally accessible (or use modules if preferred)
window.CONSTANTS = CONSTANTS;
// js/constants.js
const CONSTANTS = {
    PLAYER_SPEED: 5.0,
    PLAYER_SPRINT_MULTIPLIER: 1.8,
    PLAYER_JUMP_FORCE: 7.0,
    GRAVITY: -19.6,
    INTERACTION_RANGE: 2.5,
    // Add more constants: resource IDs, crafting costs, AI speeds etc.
    RESOURCES: {
        WOOD: { id: 'wood', name: 'Wood', color: 0x8B4513 },
        STONE: { id: 'stone', name: 'Stone', color: 0x808080 }, // Placeholder for ore
        FIBER: { id: 'fiber', name: 'Fiber', color: 0x00FF00 },
        // Add all other resources... Iron, Copper, etc.
    },
    // Basic Crafting Recipes (ItemToCraft: { IngredientID: AmountNeeded })
    RECIPES: {
        axe: { wood: 3, stone: 2 },
        campfire: { wood: 5, fiber: 2 },
        // ... more recipes
    }
};

// Make constants globally accessible (or use modules if preferred)
window.CONSTANTS = CONSTANTS;
// js/itemSystem.js

// Basic definition of items in the game
export const ITEMS = {
    // Tools
    axe: { name: 'Axe', type: 'tool', stackable: false, gatherBonus: { wood: 2 } },
    pickaxe: { name: 'Pickaxe', type: 'tool', stackable: false, gatherBonus: { stone: 2 } },
    knife: { name: 'Knife', type: 'tool', stackable: false, gatherBonus: { meat: 1, leather: 1, fat: 1 } },
    canteen: { name: 'Canteen', type: 'tool', stackable: false }, // Functionality TBD
    pistol: { name: 'Pistol', type: 'weapon', stackable: false },

    // Resources
    wood: { name: 'Wood', type: 'resource', stackable: true, stackSize: 50 },
    stone: { name: 'Stone', type: 'resource', stackable: true, stackSize: 50 },
    scrap_metal: { name: 'Scrap Metal', type: 'resource', stackable: true, stackSize: 50 },
    feathers: { name: 'Feathers', type: 'resource', stackable: true, stackSize: 100 },
    nails: { name: 'Nails', type: 'resource', stackable: true, stackSize: 100 },
    leather: { name: 'Leather', type: 'resource', stackable: true, stackSize: 20 },
    rope: { name: 'Rope', type: 'resource', stackable: true, stackSize: 20 },
    grass: { name: 'Grass Fiber', type: 'resource', stackable: true, stackSize: 50 },
    meat: { name: 'Raw Meat', type: 'resource', stackable: true, stackSize: 10 }, // Could add 'cooked' state later
    fat: { name: 'Animal Fat', type: 'resource', stackable: true, stackSize: 10 },
    metal_ingot: { name: 'Metal Ingot', type: 'resource', stackable: true, stackSize: 50 },

    // Ammo
    arrows: { name: 'Arrows', type: 'ammo', stackable: true, stackSize: 50 },
    ammo_pistol: { name: 'Pistol Ammo', type: 'ammo', stackable: true, stackSize: 50 },

    // Placeables
    campfire: { name: 'Campfire', type: 'placeable', stackable: false },
    crafting_table: { name: 'Crafting Table', type: 'placeable', stackable: false },
    forge: { name: 'Forge', type: 'placeable', stackable: false },
};

// Function to get item definition
export function getItemDef(itemId) {
    return ITEMS[itemId];
}

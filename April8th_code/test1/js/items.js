// js/items.js
const ITEMS = {
    // Resources
    wood: { id: 'wood', name: 'Wood', stackable: true, maxStack: 50, type: 'resource' },
    fiber: { id: 'fiber', name: 'Fiber', stackable: true, maxStack: 50, type: 'resource' },
    stone: { id: 'stone', name: 'Stone', stackable: true, maxStack: 50, type: 'resource' },
    iron_ore: { id: 'iron_ore', name: 'Iron Ore', stackable: true, maxStack: 30, type: 'resource' },
    copper_ore: { id: 'copper_ore', name: 'Copper Ore', stackable: true, maxStack: 30, type: 'resource' },
    zinc_ore: { id: 'zinc_ore', name: 'Zinc Ore', stackable: true, maxStack: 30, type: 'resource' },
    blueberry: { id: 'blueberry', name: 'Blueberry', stackable: true, maxStack: 20, type: 'food', hungerValue: 5 },
    carrot: { id: 'carrot', name: 'Carrot', stackable: true, maxStack: 10, type: 'food', hungerValue: 8 },
    // ... other vegetables, medical plants

    // Animal Products
    raw_meat: { id: 'raw_meat', name: 'Raw Meat', stackable: true, maxStack: 10, type: 'food', spoilage: true },
    cooked_meat: { id: 'cooked_meat', name: 'Cooked Meat', stackable: true, maxStack: 10, type: 'food', hungerValue: 25 },
    leather: { id: 'leather', name: 'Leather', stackable: true, maxStack: 20, type: 'resource' },
    fat: { id: 'fat', name: 'Animal Fat', stackable: true, maxStack: 10, type: 'resource' },
    feathers: { id: 'feathers', name: 'Feathers', stackable: true, maxStack: 50, type: 'resource' },

    // Tools
    axe: { id: 'axe', name: 'Axe', stackable: false, type: 'tool', equipSlot: 'hand' },
    pickaxe: { id: 'pickaxe', name: 'Pickaxe', stackable: false, type: 'tool', equipSlot: 'hand' },
    knife: { id: 'knife', name: 'Knife', stackable: false, type: 'tool', equipSlot: 'hand' },
    canteen: { id: 'canteen', name: 'Canteen', stackable: false, type: 'tool', capacity: 5, current: 5 }, // Capacity for water
    // ... fishing rod, bow, etc.

    // Crafted / Building
    wood_planks: { id: 'wood_planks', name: 'Wood Planks', stackable: true, maxStack: 50, type: 'building_material' },
    nails: { id: 'nails', name: 'Nails', stackable: true, maxStack: 100, type: 'component' },
    rope: { id: 'rope', name: 'Rope', stackable: true, maxStack: 20, type: 'component' },
    foundation: { id: 'foundation', name: 'Foundation', stackable: true, maxStack: 10, type: 'building_part' },
    wall: { id: 'wall', name: 'Wall', stackable: true, maxStack: 10, type: 'building_part' },
    wall_window: { id: 'wall_window', name: 'Wall w/ Window', stackable: true, maxStack: 10, type: 'building_part' },
    ceiling: { id: 'ceiling', name: 'Ceiling', stackable: true, maxStack: 10, type: 'building_part' },
    workbench: { id: 'workbench', name: 'Workbench', stackable: true, maxStack: 1, type: 'placeable', interactable: true },
    forge: { id: 'forge', name: 'Forge', stackable: true, maxStack: 1, type: 'placeable', interactable: true },
    // ... ammo, medical items, etc.

    // Ingots
    iron_ingot: { id: 'iron_ingot', name: 'Iron Ingot', stackable: true, maxStack: 20, type: 'resource' },
    copper_ingot: { id: 'copper_ingot', name: 'Copper Ingot', stackable: true, maxStack: 20, type: 'resource' },
    zinc_ingot: { id: 'zinc_ingot', name: 'Zinc Ingot', stackable: true, maxStack: 20, type: 'resource' },
};

function getItemData(itemId) {
    return ITEMS[itemId] ? { ...ITEMS[itemId] } : null; // Return a copy
}
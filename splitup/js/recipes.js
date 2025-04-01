// js/recipes.js
// Defines crafting recipes

export const recipes = {
    'planks': { name: "Wooden Planks", requires: { wood: 1 }, produces: 4 },
    'workbench': { name: "Workbench", requires: { planks: 4 }, produces: 1 },
    'torch': { name: "Torch", requires: { wood: 1, leaves: 1 }, produces: 2 },
    'foundation': { name: "Foundation", requires: { stone: 4 }, produces: 1 },
    'wall': { name: "Wall", requires: { stone: 2 }, produces: 1 },
    'wall_window': { name: "Wall (Window)", requires: { stone: 2 }, produces: 1 },
    'wall_door': { name: "Wall (Doorway)", requires: { stone: 2 }, produces: 1 },
    'door': { name: "Wooden Door", requires: { planks: 3 }, produces: 1 },
    'roof': { name: "Roof Section", requires: { stone: 1, planks: 1 }, produces: 1 },
    // Add more recipes here (e.g., for tools if desired)
    // 'axe': { name: "Stone Axe", requires: { wood: 2, stone: 3 }, produces: 1 },
    // 'pickaxe': { name: "Stone Pickaxe", requires: { wood: 2, stone: 3 }, produces: 1 },
};
// js/crafting.js
import { getItemDef } from './itemSystem.js';
import { showMessage } from './ui.js'; // For feedback

// Define crafting recipes
const RECIPES = {
    rope: { requires: { grass: 3 }, produces: { itemId: 'rope', quantity: 1 } },
    axe: { requires: { wood: 5, stone: 3, rope: 1 }, produces: { itemId: 'axe', quantity: 1 } },
    pickaxe: { requires: { wood: 5, stone: 5, rope: 1 }, produces: { itemId: 'pickaxe', quantity: 1 } },
    campfire: { requires: { wood: 10, stone: 5 }, produces: { itemId: 'campfire', quantity: 1 } },
    crafting_table: { requires: { wood: 15, stone: 5 }, produces: { itemId: 'crafting_table', quantity: 1 } },
    forge: { requires: { stone: 20, wood: 5 }, produces: { itemId: 'forge', quantity: 1 } },
    // Smelting is not crafting, but a forge action (would be handled differently)
    // metal_ingot: { requires: { scrap_metal: 2 }, furnace: true, produces... } // Example
};

// Function to check if an item can be crafted
export function canCraft(itemId, inventory) {
    const recipe = RECIPES[itemId];
    if (!recipe) {
        console.warn(`No recipe found for ${itemId}`);
        return false;
    }
    // Check inventory (quick bar + main)
    return inventory.hasResources(recipe.requires);
}

// Function to craft an item
export function craftItem(itemId, inventory) {
    const recipe = RECIPES[itemId];
    if (!recipe) {
        showMessage(`Cannot craft ${itemId}: No recipe.`);
        return false;
    }

    // 1. Check if resources are available
    if (inventory.hasResources(recipe.requires)) {
        // 2. Consume resources
        if (inventory.consumeResources(recipe.requires)) {
            // 3. Add crafted item
            const craftedItem = recipe.produces;
            if (inventory.addItem(craftedItem.itemId, craftedItem.quantity)) {
                const itemDef = getItemDef(craftedItem.itemId);
                showMessage(`Crafted ${itemDef.name}`);
                console.log(`Crafted ${itemDef.name}`);
                return true;
            } else {
                 // Failed to add item (e.g., inventory full) - ideally, give resources back
                 console.error("Crafting failed: Could not add crafted item to inventory (maybe full?). Resources consumed!");
                 // TODO: Implement rollback of resource consumption
                 showMessage(`Crafting failed: Inventory full?`);
                 return false;
            }
        } else {
            // Should not happen if hasResources check passed, but safety check
            console.error("Crafting failed during resource consumption!");
            showMessage(`Crafting failed: Resource error.`);
            return false;
        }
    } else {
        const itemName = getItemDef(itemId)?.name || itemId;
        showMessage(`Cannot craft ${itemName}: Missing resources.`);
        console.log(`Cannot craft ${itemName}: Missing resources.`);
        return false;
    }
}

// Example: Smelting in a forge (would be called when interacting with a placed forge)
export function smeltIngot(inventory) {
    const required = { scrap_metal: 2 }; // Example cost
    const produced = { itemId: 'metal_ingot', quantity: 1 };

    if (inventory.hasResources(required)) {
        if (inventory.consumeResources(required)) {
            if (inventory.addItem(produced.itemId, produced.quantity)) {
                 showMessage(`Smelted Metal Ingot`);
                 return true;
            } else {
                // Rollback needed
                showMessage(`Smelting failed: Inventory full?`);
                inventory.addItem('scrap_metal', required.scrap_metal); // Give back
                return false;
            }
        } else {
             showMessage(`Smelting failed: Resource error.`);
             return false;
        }
    } else {
         showMessage(`Need 2 Scrap Metal to smelt.`);
         return false;
    }
}

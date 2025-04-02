// js/crafting.js

const Crafting = {
    recipes: {
        // Tools
        'axe': { wood: 3, stone: 2 },
        'pickaxe': { wood: 3, stone: 3 },
        // Basic
        'rope': { grass: 5 }, // Added grass harvesting later
        'campfire': { wood: 5, stone: 3 },
        // Advanced (placeholders for now)
        'crafting_table': { wood: 10, stone: 4 },
        'forge': { stone: 15, wood: 5 }, // Requires refining scrap later
        // Materials (Example - refined in forge later)
        // 'iron_ingot': { scrap_metal: 3 },
    },

    canCraft(itemName) {
        const recipe = this.recipes[itemName];
        if (!recipe) return false;

        for (const resource in recipe) {
            if (!Inventory.hasItem(resource, recipe[resource])) {
                return false; // Not enough resources
            }
        }
        return true; // Has all resources
    },

    craftItem(itemName) {
        const recipe = this.recipes[itemName];
        if (!recipe) {
            Utils.logMessage(`Cannot craft '${itemName}': Unknown recipe.`);
            return false;
        }

        // Double-check resources (could have changed since UI update)
        if (!this.canCraft(itemName)) {
             Utils.logMessage(`Cannot craft '${itemName}': Missing resources.`);
             UI.updateCraftingMenu(); // Refresh UI state
             return false;
        }

        // Consume resources
        for (const resource in recipe) {
            if (!Inventory.removeItem(resource, recipe[resource])) {
                // This *shouldn't* happen if canCraft passed, but good failsafe
                console.error(`Failed to remove ${recipe[resource]} ${resource} during crafting!`);
                // TODO: Consider how to handle partial resource removal failure (rollback?)
                 Utils.logMessage(`Crafting failed: Error removing resources.`);
                return false;
            }
        }

        // Add crafted item (tries quickbar first, then inventory)
        if (Inventory.addItem(itemName, 1)) {
            Utils.logMessage(`Crafted 1x ${itemName}.`);
            UI.updateInventory(); // Update inventory display
            UI.updateCraftingMenu(); // Update craftable status
            return true;
        } else {
            Utils.logMessage(`Crafting failed: Inventory full.`);
            // TODO: Ideally, resources should be given back if the item can't be placed.
            // This requires a more robust transaction system. For now, they are lost.
             UI.updateInventory();
             UI.updateCraftingMenu();
            return false;
        }
    }
};

// Make globally accessible
window.Crafting = Crafting;
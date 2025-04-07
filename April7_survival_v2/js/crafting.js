// js/crafting.js
const Crafting = {
    recipes: CONSTANTS.RECIPES, // Get recipes from constants

    init: function() {
        console.log("Crafting System Initialized");
    },

    getRecipe: function(itemName) {
        const recipe = this.recipes[itemName];
        if (!recipe) return null;

        // Try to get a display name from BUILDABLES or RESOURCES first
        const buildableData = CONSTANTS.BUILDABLES[itemName];
        const resourceData = Resources.getResourceData(itemName);
        // Simple tools/items might not be in either, use the key name
        const displayName = buildableData?.name || resourceData?.name || itemName;

        return { name: displayName, ingredients: recipe };
    },

    canCraft: function(itemName) {
        const recipe = this.recipes[itemName];
        if (!recipe) return false; // No recipe found

        return Inventory.hasItems(recipe); // hasItems checks total count (inv + quickbar)
    },

    attemptCraft: function(itemName) {
        const recipe = this.recipes[itemName];
        const recipeData = this.getRecipe(itemName); // Use updated getRecipe for name
        const displayName = recipeData?.name || itemName;

        if (!recipe) {
            Game.UIManager.logMessage(`Cannot craft ${displayName}: Recipe unknown.`);
            console.warn(`Recipe not found for ${itemName}`);
            return false;
        }

        if (this.canCraft(itemName)) {
            // Consume ingredients - This needs to be more robust later
            // For now, try removing from main inventory first.
            let ingredientsRemovedSuccessfully = true;
            for (const ingredientId in recipe) {
                 const needed = recipe[ingredientId];
                 // Simple removal strategy: Try main inventory first.
                 // TODO: Implement smarter removal (e.g., check quickbar too, or specific stacks)
                 if (!Inventory.removeItem(ingredientId, needed)) {
                      console.error(`Failed to remove required ingredient ${ingredientId} (Qty: ${needed}) from main inventory during crafting, even though canCraft passed! Inventory discrepancy?`);
                      Game.UIManager.logMessage(`Crafting failed: Error removing ${ingredientId}.`);
                      ingredientsRemovedSuccessfully = false;
                      // Attempt to rollback? Very hard without transactions. Log error and stop.
                      break; // Stop trying to remove ingredients
                 }
            }

            if (!ingredientsRemovedSuccessfully) {
                // TODO: Rollback previously removed ingredients if possible?
                return false; // Prevent adding crafted item if ingredients failed
            }

            // Add crafted item (which might be a buildable)
            Inventory.addItem(itemName, 1); // Assuming recipes craft 1 item
            Game.UIManager.logMessage(`Crafted ${displayName}!`);
            console.log(`Crafted ${itemName}`);
            return true;
        } else {
            // Provide more detail on missing ingredients
            let missing = [];
            for (const ingredientId in recipe) {
                const required = recipe[ingredientId];
                const have = Inventory.getItemCount(ingredientId); // Checks total
                if (have < required) {
                     const ingredientName = Resources.getResourceData(ingredientId)?.name || ingredientId;
                     missing.push(`${ingredientName} (Need ${required}, Have ${have})`);
                }
            }
            if(missing.length > 0) {
                 const missingMsg = `Missing: ${missing.join(', ')}`;
                 console.log(`Failed to craft ${itemName}, ${missingMsg}`);
                 Game.UIManager.logMessage(missingMsg);
            } else {
                 // This case should ideally not happen if canCraft is accurate
                 console.log(`Failed to craft ${itemName}, missing ingredients (unknown reason).`);
                 Game.UIManager.logMessage(`Cannot craft ${displayName}: Missing ingredients.`);
            }

            return false;
        }
    }
    // Add functions for different crafting stations (Workbench, Forge, etc.) later
};

window.Crafting = Crafting;
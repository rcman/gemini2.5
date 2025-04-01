// js/crafting.js
// Handles the logic for crafting items based on recipes

import { recipes } from './recipes.js';
import { items } from './items.js';
import { inventory, hasEnoughItems, addToInventory, removeFromInventory } from './inventory.js';
import { showActionFeedback } from './utils.js'; // For user feedback
import * as Config from './config.js';


export function craftItem(itemId) {
    const recipe = recipes[itemId];
    const productItem = items[itemId];

    if (!recipe || !productItem) {
        console.error(`Invalid item ID to craft: ${itemId}`);
        showActionFeedback("Crafting recipe error!");
        return;
    }

    // Check if player has enough resources
    if (hasEnoughItems(recipe.requires)) {
        // Consume required items
        let consumedAll = true;
        for (const reqItem in recipe.requires) {
            if (!removeFromInventory(reqItem, recipe.requires[reqItem])) {
                // This should ideally not happen if hasEnoughItems passed, but check anyway
                console.error(`Crafting failed: Could not remove required item ${reqItem}`);
                showActionFeedback("Crafting error!");
                 // TODO: Consider how to handle partially consumed items if this fails mid-way (rollback?)
                 consumedAll = false;
                 break;
            }
        }

         // If all items were consumed successfully, add the crafted item(s)
         if (consumedAll) {
             addToInventory(itemId, recipe.produces);
             showActionFeedback(`Crafted ${recipe.produces}x ${productItem.name}`);
             // UI updates are handled by addToInventory/removeFromInventory
         }

    } else {
        showActionFeedback("Not enough resources");
    }
}
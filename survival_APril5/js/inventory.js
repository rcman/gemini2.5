// js/inventory.js
import { getItemDef } from './itemSystem.js';
import { updateInventoryUI } from './ui.js'; // Import UI update function

export class Inventory {
    constructor(maxSlots = 20) {
        this.items = {}; // Stores items like { itemId: quantity }
        this.maxSlots = maxSlots; // Example slot limit
        // Quick bar could be a separate array/object or the first N slots
        this.quickBarSlots = 5; // Example
    }

    // Adds an item, considering stack sizes
    addItem(itemId, quantity = 1) {
        const itemDef = getItemDef(itemId);
        if (!itemDef) {
            console.warn(`Attempted to add unknown item: ${itemId}`);
            return false;
        }

        if (itemDef.stackable) {
            if (this.items[itemId]) {
                // Check if adding exceeds stack size - for simplicity, we'll just add now
                // A real system might need to create new stacks
                this.items[itemId] += quantity;
                console.log(`Added ${quantity} ${itemDef.name}. Total: ${this.items[itemId]}`);
            } else {
                // Check if inventory is full before adding new stack
                if (Object.keys(this.items).length >= this.maxSlots) {
                    console.log("Inventory is full!");
                    // Add message to UI - import { showMessage } from './ui.js'; showMessage("Inventory is full!");
                    return false;
                }
                this.items[itemId] = quantity;
                console.log(`Added new stack of ${quantity} ${itemDef.name}.`);
            }
        } else { // Not stackable
            // Check if inventory is full
            if (Object.keys(this.items).length >= this.maxSlots) {
                console.log("Inventory is full!");
                 // Add message to UI - showMessage("Inventory is full!");
                return false;
            }
             // Non-stackable items usually have unique IDs or are just counted
             // For simplicity, we'll store them with quantity 1, assuming only one instance allowed for now
            if (!this.items[itemId]) {
                 this.items[itemId] = 1; // Representing presence
                 console.log(`Added ${itemDef.name}.`);
            } else {
                console.log(`${itemDef.name} already in inventory (non-stackable).`);
                // Maybe return false or handle multiple non-stackables differently
                return false; // Prevent adding duplicates of non-stackables for now
            }
        }

        updateInventoryUI(this.items); // Update the visual display
        return true;
    }

    // Removes an item or quantity
    removeItem(itemId, quantity = 1) {
        const itemDef = getItemDef(itemId);
        if (!itemDef || !this.items[itemId]) {
            console.warn(`Attempted to remove non-existent item: ${itemId}`);
            return false;
        }

        if (this.items[itemId] >= quantity) {
            this.items[itemId] -= quantity;
            console.log(`Removed ${quantity} ${itemDef.name}. Remaining: ${this.items[itemId]}`);
            if (this.items[itemId] <= 0) {
                delete this.items[itemId];
                console.log(`Removed last ${itemDef.name} stack.`);
            }
            updateInventoryUI(this.items); // Update the visual display
            return true;
        } else {
            console.warn(`Not enough ${itemDef.name} to remove.`);
            return false;
        }
    }

    // Checks if the inventory has enough of an item
    hasItem(itemId, quantity = 1) {
        return this.items[itemId] && this.items[itemId] >= quantity;
    }

    // Get all items (e.g., for UI or crafting checks)
    getItems() {
        return this.items;
    }

     // Check resources needed for crafting (searches quick bar + main inv)
    hasResources(requiredResources) {
        for (const itemId in requiredResources) {
            const requiredQuantity = requiredResources[itemId];
            if (!this.hasItem(itemId, requiredQuantity)) {
                return false; // Missing required resource
            }
        }
        return true; // All resources found
    }

    // Consume resources for crafting
    consumeResources(resources) {
         for (const itemId in resources) {
            const quantity = resources[itemId];
            if (!this.removeItem(itemId, quantity)) {
                 // This should ideally not happen if hasResources was checked first
                 console.error(`Failed to consume ${quantity} of ${itemId} during crafting!`);
                 // Rollback logic might be needed in a real game
                 return false;
            }
        }
        return true;
    }
}

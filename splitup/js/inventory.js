// js/inventory.js
// Manages player inventory state and logic

import { items } from './items.js';
import * as Config from './config.js';
import { updateInventoryUI, updateToolbarUI, updateCraftingUI } from './ui.js'; // Import UI update functions

// --- State ---
export let inventory = {}; // The main inventory object
export let selectedToolbarIndex = 0;
export const toolbarItems = []; // Array mapping toolbar index to item ID

// --- Initialization ---
export function initializeInventory() {
    Object.assign(inventory, Config.STARTING_INVENTORY);
    if (Config.DEBUG) console.log("Inventory initialized:", inventory);
}

// --- Core Logic ---
export function addToInventory(item, amount = 1) {
    if (!items[item]) {
        console.warn(`Attempted to add unknown item: ${item}`);
        return;
    }
    inventory[item] = (inventory[item] || 0) + amount;
    if (Config.DEBUG) console.log(`Added ${amount}x ${item}, total: ${inventory[item]}`);
    // Trigger UI updates AFTER modifying inventory
    updateInventoryUI(inventory, items);
    updateToolbarUI(inventory, items, toolbarItems, selectedToolbarIndex);
    updateCraftingUI(); // Crafting UI depends on inventory state
}

export function removeFromInventory(item, amount = 1) {
    if (!inventory[item] || inventory[item] < amount) {
        return false; // Not enough items
    }
    inventory[item] -= amount;
    if (inventory[item] <= 0) {
        delete inventory[item];
        if (Config.DEBUG) console.log(`Removed all ${item}`);
    } else {
        if (Config.DEBUG) console.log(`Removed ${amount}x ${item}, remaining: ${inventory[item]}`);
    }
    // Trigger UI updates AFTER modifying inventory
    updateInventoryUI(inventory, items);
    updateToolbarUI(inventory, items, toolbarItems, selectedToolbarIndex);
    updateCraftingUI(); // Crafting UI depends on inventory state
    return true;
}

export function hasEnoughItems(requirements) {
    for (const item in requirements) {
        if (!inventory[item] || inventory[item] < requirements[item]) {
            return false;
        }
    }
    return true;
}

// --- Toolbar Management ---
export function setSelectedToolbarIndex(index) {
    if (index >= 0 && index < Config.MAX_TOOLBAR_SLOTS) {
        if (selectedToolbarIndex !== index) {
            selectedToolbarIndex = index;
            // Update only the toolbar UI when selection changes
            updateToolbarUI(inventory, items, toolbarItems, selectedToolbarIndex);
             return true; // Indicate selection changed
        }
    }
     return false; // Indicate selection did not change
}

// Function to get the currently selected item ID from the toolbar
export function getSelectedItem() {
    return toolbarItems[selectedToolbarIndex] || null;
}
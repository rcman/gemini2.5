// js/inventory.js
const Inventory = {
    items: {}, // Format: { 'itemId': quantity } e.g., {'wood': 50, 'stone': 20}
    quickBarItems: new Array(8).fill(null), // Array for 8 quick slots, null if empty, { itemId: string, quantity: number } if occupied
    maxSlots: 20, // Example limit for main inventory

    init: function() {
        console.log("Inventory Initialized");
        // Load saved inventory if implementing saving/loading
        this.updateUI(); // Updates main inventory panel
        this.updateQuickBarUI(); // Updates the quick-bar display
    },

    // --- Main Inventory Functions ---

    addItem: function(itemId, quantity = 1) {
        if (!Resources.getResourceData(itemId) && !Crafting.getRecipe(itemId)) { // Check if it's a known resource or craftable item
             console.warn(`Attempted to add unknown item: ${itemId}`);
             return false;
        }

        // Try to stack in quick-bar first (optional, but common)
        let remainingQuantity = this.tryStackInQuickBar(itemId, quantity);
        if (remainingQuantity <= 0) {
             this.updateQuickBarUI(); // Update quick-bar if item was added/stacked there
             return true;
        }

        // Add remaining to main inventory
        if (this.items[itemId]) {
            this.items[itemId] += remainingQuantity;
        } else {
            // Check if inventory is full (optional based on game design)
            // if (Object.keys(this.items).length >= this.maxSlots) {
            //     Game.UIManager.logMessage("Inventory full!");
            //     return false;
            // }
            this.items[itemId] = remainingQuantity;
        }
        console.log(`Added ${remainingQuantity} ${itemId} to main inventory. Total: ${this.items[itemId]}`);
        this.updateUI(); // Update main inventory panel
        return true;
    },

    removeItem: function(itemId, quantity = 1) {
        // Prioritize removing from main inventory. Quick-bar removal is explicit.
        if (!this.items[itemId] || this.items[itemId] < quantity) {
            console.warn(`Not enough ${itemId} in main inventory to remove.`);
            return false; // Not enough items
        }
        this.items[itemId] -= quantity;
        if (this.items[itemId] <= 0) {
            delete this.items[itemId];
        }
        console.log(`Removed ${quantity} ${itemId} from main inventory. Remaining: ${this.items[itemId] || 0}`);
        this.updateUI();
        return true;
    },

    getItemCount: function(itemId) {
        // Returns total count across main inventory and quick-bar
        let total = this.items[itemId] || 0;
        this.quickBarItems.forEach(item => {
            if (item && item.itemId === itemId) {
                total += item.quantity;
            }
        });
        return total;
    },

    hasItems: function(requiredItems) { // requiredItems = { 'itemId': amount, ... }
        for (const itemId in requiredItems) {
            if (this.getItemCount(itemId) < requiredItems[itemId]) {
                return false; // Missing required item (checks both inventories)
            }
        }
        return true; // Has all required items
    },

    // --- Quick Bar Functions ---

    tryStackInQuickBar: function(itemId, quantity) {
        let remainingQuantity = quantity;
        for (let i = 0; i < this.quickBarItems.length; i++) {
            const slotItem = this.quickBarItems[i];
            if (slotItem && slotItem.itemId === itemId) {
                // Add to existing stack (assuming infinite stack size for simplicity)
                slotItem.quantity += remainingQuantity;
                remainingQuantity = 0;
                console.log(`Stacked ${quantity} ${itemId} into quick slot ${i}.`);
                break; // Stop after stacking in the first matching slot
            }
        }
        // We don't automatically fill empty quick-bar slots on pickup here,
        // but we could add that logic if desired.
        return remainingQuantity;
    },

    addToQuickBar: function(itemData, targetSlotIndex) {
         // itemData = { itemId: string, quantity: number }
        if (targetSlotIndex < 0 || targetSlotIndex >= this.quickBarItems.length) {
            console.warn("Invalid quick slot index:", targetSlotIndex);
            return false;
        }

        const currentItem = this.quickBarItems[targetSlotIndex];

        if (currentItem) {
            // Slot is occupied - check if we can stack
            if (currentItem.itemId === itemData.itemId) {
                currentItem.quantity += itemData.quantity;
                 console.log(`Stacked ${itemData.quantity} ${itemData.itemId} onto quick slot ${targetSlotIndex}`);
                 this.updateQuickBarUI();
                 return true;
            } else {
                // Cannot stack (different items) - maybe swap later? For now, fail.
                console.log(`Quick slot ${targetSlotIndex} occupied by different item.`);
                 Game.UIManager.logMessage("Slot occupied by different item."); // User feedback
                return false; // Or implement swap logic here
            }
        } else {
            // Slot is empty - place the item
            this.quickBarItems[targetSlotIndex] = { ...itemData }; // Use spread to copy
            console.log(`Placed ${itemData.quantity} ${itemData.itemId} into quick slot ${targetSlotIndex}`);
            this.updateQuickBarUI();
            return true;
        }
    },

    removeFromQuickBar: function(slotIndex, quantityToRemove = -1) { // -1 means remove all
         if (slotIndex < 0 || slotIndex >= this.quickBarItems.length || !this.quickBarItems[slotIndex]) {
            console.warn("Cannot remove from empty or invalid quick slot:", slotIndex);
            return null; // Return null if nothing was removed
        }

        const itemInSlot = this.quickBarItems[slotIndex];
        let removedItemData;

        if (quantityToRemove === -1 || quantityToRemove >= itemInSlot.quantity) {
            // Remove the entire stack
            removedItemData = { ...itemInSlot }; // Copy the data
            this.quickBarItems[slotIndex] = null; // Clear the slot
            console.log(`Removed all ${itemInSlot.itemId} from quick slot ${slotIndex}`);
        } else {
             // Remove partial quantity
            itemInSlot.quantity -= quantityToRemove;
            removedItemData = { itemId: itemInSlot.itemId, quantity: quantityToRemove };
            console.log(`Removed ${quantityToRemove} ${itemInSlot.itemId} from quick slot ${slotIndex}. Remaining: ${itemInSlot.quantity}`);
        }

        this.updateQuickBarUI();
        return removedItemData; // Return the item data that was removed
    },

    // --- Transfer Functions ---

    moveItemToQuickBar: function(itemId, quantityToMove = 1) {
        if (!this.items[itemId] || this.items[itemId] < quantityToMove) {
            console.warn(`Not enough ${itemId} in main inventory to move to quick bar.`);
            Game.UIManager.logMessage(`Not enough ${itemId} in inventory.`);
            return;
        }

        // Find the first suitable quick bar slot (stack or empty)
        let targetSlot = -1;
        // Prioritize stacking
        for(let i = 0; i < this.quickBarItems.length; i++) {
             if (this.quickBarItems[i] && this.quickBarItems[i].itemId === itemId) {
                 targetSlot = i;
                 break;
             }
        }
        // If no stack found, find first empty slot
        if (targetSlot === -1) {
             for(let i = 0; i < this.quickBarItems.length; i++) {
                 if (!this.quickBarItems[i]) {
                     targetSlot = i;
                     break;
                 }
             }
        }

        if (targetSlot !== -1) {
             // Remove from main inventory first
             if (this.removeItem(itemId, quantityToMove)) { // removeItem already updates main UI
                  // Add to the quick bar slot
                  const itemData = { itemId: itemId, quantity: quantityToMove };
                  this.addToQuickBar(itemData, targetSlot); // This handles stacking or placing & updates quickbar UI
             }
        } else {
             console.log("Quick bar is full or no stackable slot found.");
             Game.UIManager.logMessage("Quick bar full.");
        }
    },

    moveItemToInventory: function(slotIndex) {
        const removedItem = this.removeFromQuickBar(slotIndex); // Removes all quantity by default & updates quickbar UI
        if (removedItem) {
             // Add the removed item back to the main inventory
             if (this.items[removedItem.itemId]) {
                 this.items[removedItem.itemId] += removedItem.quantity;
             } else {
                 this.items[removedItem.itemId] = removedItem.quantity;
             }
             console.log(`Moved ${removedItem.quantity} ${removedItem.itemId} from quick slot ${slotIndex} to main inventory.`);
             this.updateUI(); // Update main inventory panel
        }
    },

    // --- UI Update Triggers ---

    updateUI: function() {
        // Update the main inventory list in the HTML
        UIManager.updateInventoryList(this.items); // Delegate rendering to UIManager
    },

    updateQuickBarUI: function() {
        // Update the quick bar display in the HTML
        UIManager.updateQuickBar(this.quickBarItems); // Delegate rendering to UIManager
    }
};

window.Inventory = Inventory;
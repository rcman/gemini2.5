// js/inventory.js
const Inventory = {
    items: {}, // Format: { 'itemId': quantity } e.g., {'wood': 50, 'stone': 20}
    quickBarItems: new Array(8).fill(null), // Array for 8 quick slots, null if empty, { itemId: string, quantity: number } if occupied
    maxSlots: 20, // Example limit for main inventory

    init: function() {
        console.log("Inventory Initialized");
        this.updateUI();
        this.updateQuickBarUI();
    },

    // --- Main Inventory Functions ---

    addItem: function(itemId, quantity = 1) {
        // Check if it's a known resource, craftable item, OR buildable
         if (!Resources.getResourceData(itemId) && !Crafting.getRecipe(itemId) && !CONSTANTS.BUILDABLES[itemId]) {
             console.warn(`Attempted to add unknown item: ${itemId}`);
             return false;
         }

        // Prefer stacking in quick bar if item already exists there
        let remainingQuantity = quantity;
        let stackedInQuickBar = false;
        for (let i = 0; i < this.quickBarItems.length; i++) {
            const slotItem = this.quickBarItems[i];
            if (slotItem && slotItem.itemId === itemId) {
                slotItem.quantity += remainingQuantity;
                console.log(`Stacked ${remainingQuantity} ${itemId} into quick slot ${i}.`);
                remainingQuantity = 0;
                stackedInQuickBar = true;
                break;
            }
        }

        if (stackedInQuickBar) {
             this.updateQuickBarUI();
             return true;
        }

        // Add remaining (or all) to main inventory
        if (remainingQuantity > 0) {
            if (this.items[itemId]) {
                this.items[itemId] += remainingQuantity;
            } else {
                 // Check if main inventory has space for a *new* stack type (optional)
                // if (Object.keys(this.items).length >= this.maxSlots) {
                //     Game.UIManager.logMessage("Main inventory full!");
                //     // Try adding to quickbar empty slot if possible? More complex logic.
                //     return false; // Cannot add new item type
                // }
                this.items[itemId] = remainingQuantity;
            }
            console.log(`Added ${remainingQuantity} ${itemId} to main inventory. Total: ${this.items[itemId]}`);
            this.updateUI();
        }
        return true;
    },

    // Basic removeItem, primarily intended for crafting ingredients from main inventory.
    // Returns true if removal was fully successful, false otherwise.
    removeItem: function(itemId, quantity = 1) {
        if (!this.items[itemId] || this.items[itemId] < quantity) {
            // Don't log warning here, as crafting check might expect this
            return false; // Not enough in main inventory
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
                return false; // Missing required item (checks combined total)
            }
        }
        return true;
    },


    // --- Quick Bar Functions ---

    addToQuickBar: function(itemData, targetSlotIndex) {
        if (targetSlotIndex < 0 || targetSlotIndex >= this.quickBarItems.length) {
            console.warn("Invalid quick slot index:", targetSlotIndex);
            return false;
        }
        const currentItem = this.quickBarItems[targetSlotIndex];
        if (currentItem) {
            if (currentItem.itemId === itemData.itemId) {
                currentItem.quantity += itemData.quantity;
                console.log(`Stacked ${itemData.quantity} ${itemData.itemId} onto quick slot ${targetSlotIndex}`);
                this.updateQuickBarUI();
                return true;
            } else {
                console.log(`Quick slot ${targetSlotIndex} occupied by different item.`);
                Game.UIManager.logMessage("Slot occupied by different item.");
                return false; // Cannot place/stack
            }
        } else {
            this.quickBarItems[targetSlotIndex] = { ...itemData }; // Place new item
            console.log(`Placed ${itemData.quantity} ${itemData.itemId} into quick slot ${targetSlotIndex}`);
            this.updateQuickBarUI();
            return true;
        }
    },

    removeFromQuickBar: function(slotIndex, quantityToRemove = -1) { // -1 means remove all
        if (slotIndex < 0 || slotIndex >= this.quickBarItems.length || !this.quickBarItems[slotIndex]) {
            console.warn("Cannot remove from empty or invalid quick slot:", slotIndex);
            return null;
        }
        const itemInSlot = this.quickBarItems[slotIndex];
        let removedItemData;
        if (quantityToRemove === -1 || quantityToRemove >= itemInSlot.quantity) {
            removedItemData = { ...itemInSlot }; // Copy data
            this.quickBarItems[slotIndex] = null; // Clear slot
            console.log(`Removed all ${itemInSlot.itemId} from quick slot ${slotIndex}`);
        } else if (quantityToRemove > 0) {
            itemInSlot.quantity -= quantityToRemove;
            removedItemData = { itemId: itemInSlot.itemId, quantity: quantityToRemove };
            console.log(`Removed ${quantityToRemove} ${itemInSlot.itemId} from quick slot ${slotIndex}. Remaining: ${itemInSlot.quantity}`);
        } else {
             return null; // Invalid quantity to remove
        }
        this.updateQuickBarUI();
        return removedItemData;
    },

    // --- Transfer Functions ---

    moveItemToQuickBar: function(itemId, quantityToMove = 1) {
        if (!this.items[itemId] || this.items[itemId] < quantityToMove) {
            console.warn(`Not enough ${itemId} in main inventory to move to quick bar.`);
            Game.UIManager.logMessage(`Not enough ${itemId} in inventory.`);
            return;
        }
        let targetSlot = -1;
        // Prioritize stacking
        for(let i = 0; i < this.quickBarItems.length; i++) {
             if (this.quickBarItems[i] && this.quickBarItems[i].itemId === itemId) {
                 targetSlot = i; break;
             }
        }
        // Find first empty if no stack found
        if (targetSlot === -1) {
             for(let i = 0; i < this.quickBarItems.length; i++) {
                 if (!this.quickBarItems[i]) {
                     targetSlot = i; break;
                 }
             }
        }
        if (targetSlot !== -1) {
             if (this.removeItem(itemId, quantityToMove)) { // Remove from main inv first
                  this.addToQuickBar({ itemId: itemId, quantity: quantityToMove }, targetSlot); // Add to quickbar
             }
        } else {
             console.log("Quick bar is full or no stackable slot found.");
             Game.UIManager.logMessage("Quick bar full.");
        }
    },

    moveItemToInventory: function(slotIndex) {
        const removedItem = this.removeFromQuickBar(slotIndex); // Removes all quantity & updates quickbar UI
        if (removedItem) {
             // Add the removed item back to the main inventory (uses standard addItem logic)
             this.addItem(removedItem.itemId, removedItem.quantity); // addItem updates main UI if needed
             console.log(`Moved ${removedItem.quantity} ${removedItem.itemId} from quick slot ${slotIndex} to main inventory.`);
             // Note: addItem handles the updateUI call internally now
        }
    },

    // --- Consume item for placement ---
    consumeItemForPlacement: function(itemInfo) {
        const { itemId, source, slotIndex } = itemInfo;

        // Prioritize consuming from the specified source
        if (source === 'quickbar' && slotIndex !== undefined) {
            const itemInSlot = this.quickBarItems[slotIndex];
            if (itemInSlot && itemInSlot.itemId === itemId && itemInSlot.quantity > 0) {
                itemInSlot.quantity -= 1;
                if (itemInSlot.quantity <= 0) {
                    this.quickBarItems[slotIndex] = null; // Clear slot if empty
                }
                this.updateQuickBarUI(); // Update UI after consumption
                console.log(`Consumed 1 ${itemId} from quick slot ${slotIndex}`);
                return true; // Successfully consumed
            } else {
                // Item mismatch or empty slot - Log warning and fall through to try main inventory
                console.warn(`Quick slot ${slotIndex} didn't contain expected ${itemId} or was empty, trying main inventory as fallback.`);
            }
        }

        // If source is 'inventory' or the quickbar attempt failed/wasn't specified, try main inventory
        if (this.items[itemId] && this.items[itemId] > 0) {
            this.items[itemId] -= 1;
            if (this.items[itemId] <= 0) {
                delete this.items[itemId];
            }
            this.updateUI(); // Update main inventory UI
            console.log(`Consumed 1 ${itemId} from main inventory`);
            return true; // Successfully consumed
        }

        // If neither worked (e.g., item disappeared between selection and placement click)
        console.error(`Could not find 1 ${itemId} to consume for placement! Source: ${source}, Slot: ${slotIndex}`);
        Game.UIManager.logMessage(`Could not find ${itemId} to place.`); // User feedback
        return false;
    },

    // --- UI Update Triggers ---
    updateUI: function() {
        UIManager.updateInventoryList(this.items);
    },
    updateQuickBarUI: function() {
        UIManager.updateQuickBar(this.quickBarItems);
    }
};

window.Inventory = Inventory;
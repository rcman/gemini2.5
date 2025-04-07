// js/inventory.js
const Inventory = {
    items: {}, // Format: { 'itemId': quantity } e.g., {'wood': 50, 'stone': 20}
    maxSlots: 20, // Example limit

    init: function() {
        console.log("Inventory Initialized");
        // Load saved inventory if implementing saving/loading
        this.updateUI();
    },

    addItem: function(itemId, quantity = 1) {
        if (!Resources.getResourceData(itemId) && !Crafting.getRecipe(itemId)) { // Check if it's a known resource or craftable item
             console.warn(`Attempted to add unknown item: ${itemId}`);
             return false;
        }

        if (this.items[itemId]) {
            this.items[itemId] += quantity;
        } else {
            // Check if inventory is full (optional based on game design)
            // if (Object.keys(this.items).length >= this.maxSlots) {
            //     Game.UIManager.logMessage("Inventory full!");
            //     return false;
            // }
            this.items[itemId] = quantity;
        }
        console.log(`Added ${quantity} ${itemId}. Total: ${this.items[itemId]}`);
        this.updateUI();
        return true;
    },

    removeItem: function(itemId, quantity = 1) {
        if (!this.items[itemId] || this.items[itemId] < quantity) {
            console.warn(`Not enough ${itemId} to remove.`);
            return false; // Not enough items
        }
        this.items[itemId] -= quantity;
        if (this.items[itemId] <= 0) {
            delete this.items[itemId];
        }
        console.log(`Removed ${quantity} ${itemId}. Remaining: ${this.items[itemId] || 0}`);
        this.updateUI();
        return true;
    },

    getItemCount: function(itemId) {
        return this.items[itemId] || 0;
    },

    hasItems: function(requiredItems) { // requiredItems = { 'itemId': amount, ... }
        for (const itemId in requiredItems) {
            if (this.getItemCount(itemId) < requiredItems[itemId]) {
                return false; // Missing required item
            }
        }
        return true; // Has all required items
    },

    updateUI: function() {
        // Update the inventory list in the HTML
        const listElement = document.getElementById('inventory-list');
        if (!listElement) return;

        listElement.innerHTML = ''; // Clear previous list
        if (Object.keys(this.items).length === 0) {
            listElement.innerHTML = '<li>Empty</li>';
        } else {
            for (const itemId in this.items) {
                const itemData = Resources.getResourceData(itemId) || Crafting.getRecipe(itemId); // Get name
                const name = itemData ? (itemData.name || itemId) : itemId;
                const listItem = document.createElement('li');
                listItem.textContent = `${name}: ${this.items[itemId]}`;
                listElement.appendChild(listItem);
            }
        }
    }
};

window.Inventory = Inventory;
// js/ui.js
const UIManager = {
    healthValueElement: null,
    hungerValueElement: null,
    staminaValueElement: null,
    messageLogElement: null,
    buildMenuElement: null,
    inventoryMenuElement: null,
    inventoryListElement: null, // Added reference
    quickBarElement: null, // Added reference
    quickSlotElements: [], // Added reference
    messageTimeout: null,

    init: function() {
        this.healthValueElement = document.getElementById('health-value');
        this.hungerValueElement = document.getElementById('hunger-value');
        this.staminaValueElement = document.getElementById('stamina-value');
        this.messageLogElement = document.getElementById('message-log');
        this.buildMenuElement = document.getElementById('build-menu');
        this.inventoryMenuElement = document.getElementById('inventory-menu');
        this.inventoryListElement = document.getElementById('inventory-list'); // Get inventory list UL
        this.quickBarElement = document.getElementById('quick-bar'); // Get quick bar container
        this.quickSlotElements = this.quickBarElement ? this.quickBarElement.querySelectorAll('.quick-slot') : []; // Get all slot divs safely

        // Add initial event listeners for quick bar slots
        if (this.quickSlotElements.length > 0) {
            this.quickSlotElements.forEach((slot, index) => {
                // Right-click to move from quick-bar to inventory
                slot.addEventListener('contextmenu', (event) => {
                    event.preventDefault(); // Prevent browser context menu
                    if (!Input.isPointerLocked) { // Only allow inventory interaction when menus are potentially open
                        Inventory.moveItemToInventory(index);
                    }
                });
                // Left-click could be used for selecting active item later
                slot.addEventListener('click', (event) => {
                    // TODO: Implement selecting active item logic
                    console.log(`Left clicked quick slot ${index}`);
                    // Example: if (!Input.isPointerLocked) { Player.setActiveQuickslot(index); }
                });
            });
        } else {
            console.warn("Could not find quick bar slots for UI initialization.");
        }


        console.log("UI Manager Initialized");
    },

    updateStat: function(statName, value) {
        const element = this[`${statName}ValueElement`];
        if (element && element.textContent != value) { // Only update if value changed
            element.textContent = value;
        }
    },

    logMessage: function(message, duration = 3000) {
        if (this.messageLogElement) {
            this.messageLogElement.textContent = message;
            if (this.messageTimeout) clearTimeout(this.messageTimeout);
            this.messageTimeout = setTimeout(() => {
                 if(this.messageLogElement.textContent === message) this.messageLogElement.textContent = "";
            }, duration);
        }
        console.log("UI Log:", message);
    },

    toggleBuildMenu: function() {
         if (!this.buildMenuElement) return;

        const isOpen = this.buildMenuElement.style.display !== 'none';
        if (isOpen) {
            this.buildMenuElement.style.display = 'none';
            if (Building.isBuilding) Building.exitBuildMode();
        } else {
            if (this.inventoryMenuElement && this.inventoryMenuElement.style.display !== 'none') {
                this.inventoryMenuElement.style.display = 'none'; // Close other menu
            }
            this.buildMenuElement.style.display = 'block';
        }
    },

     toggleInventoryMenu: function() {
         if (!this.inventoryMenuElement) return;

        const isOpen = this.inventoryMenuElement.style.display !== 'none';
        if (isOpen) {
            this.inventoryMenuElement.style.display = 'none';
        } else {
             if (this.buildMenuElement && this.buildMenuElement.style.display !== 'none') {
                  this.buildMenuElement.style.display = 'none'; // Close other menu
                  if (Building.isBuilding) Building.exitBuildMode();
             }
            Inventory.updateUI(); // Refresh inventory list when opening (now calls updateInventoryList)
            this.inventoryMenuElement.style.display = 'block';
        }
    },

    isMenuOpen: function() {
         return (this.buildMenuElement && this.buildMenuElement.style.display !== 'none') ||
               (this.inventoryMenuElement && this.inventoryMenuElement.style.display !== 'none');
    },

    // --- Inventory & Quick Bar Rendering ---

    updateInventoryList: function(items) {
        if (!this.inventoryListElement) return;

        this.inventoryListElement.innerHTML = ''; // Clear previous list

        if (Object.keys(items).length === 0) {
            this.inventoryListElement.innerHTML = '<li>Empty</li>';
        } else {
            for (const itemId in items) {
                const itemData = Resources.getResourceData(itemId) || Crafting.getRecipe(itemId);
                const name = itemData ? (itemData.name || itemId) : itemId;
                const quantity = items[itemId];

                const listItem = document.createElement('li');
                listItem.textContent = `${name}: ${quantity}`;
                listItem.style.cursor = 'pointer'; // Indicate clickable
                listItem.dataset.itemId = itemId; // Store itemId for click handler

                // Click listener to move item FROM inventory TO quick-bar
                listItem.addEventListener('click', (event) => {
                     // Only allow interaction when inventory menu is visible
                    if (this.inventoryMenuElement && this.inventoryMenuElement.style.display !== 'none') {
                        const clickedItemId = event.target.dataset.itemId;
                        if (clickedItemId) {
                            // Move one item at a time for simplicity
                            Inventory.moveItemToQuickBar(clickedItemId, 1);
                        }
                    }
                });

                this.inventoryListElement.appendChild(listItem);
            }
        }
    },

    updateQuickBar: function(quickBarItems) {
        if (!this.quickBarElement || this.quickSlotElements.length === 0) return;

        this.quickSlotElements.forEach((slot, index) => {
            const item = quickBarItems[index];
            slot.innerHTML = ''; // Clear previous content

            if (item) {
                const itemData = Resources.getResourceData(item.itemId) || Crafting.getRecipe(item.itemId);
                const name = itemData ? (itemData.name || item.itemId) : item.itemId;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'item-name';
                nameSpan.textContent = name.substring(0, 8); // Shorten name if needed
                slot.appendChild(nameSpan);

                if (item.quantity > 1) {
                    const quantitySpan = document.createElement('span');
                    quantitySpan.className = 'item-quantity';
                    quantitySpan.textContent = item.quantity;
                    slot.appendChild(quantitySpan);
                }
                 slot.dataset.itemId = item.itemId; // Store itemId if needed for selection logic
            } else {
                 delete slot.dataset.itemId; // Remove itemId if slot is empty
            }
        });
    }
};

window.UIManager = UIManager;
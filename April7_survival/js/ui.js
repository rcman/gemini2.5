// js/ui.js
const UIManager = {
    healthValueElement: null,
    hungerValueElement: null,
    staminaValueElement: null,
    messageLogElement: null,
    buildMenuElement: null,
    inventoryMenuElement: null,
    messageTimeout: null,

    init: function() {
        this.healthValueElement = document.getElementById('health-value');
        this.hungerValueElement = document.getElementById('hunger-value');
        this.staminaValueElement = document.getElementById('stamina-value');
        this.messageLogElement = document.getElementById('message-log');
        this.buildMenuElement = document.getElementById('build-menu');
        this.inventoryMenuElement = document.getElementById('inventory-menu');

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

            // Clear previous timeout if exists
            if (this.messageTimeout) {
                clearTimeout(this.messageTimeout);
            }

            // Set timeout to clear message
            this.messageTimeout = setTimeout(() => {
                 if(this.messageLogElement.textContent === message) { // Avoid clearing newer messages
                    this.messageLogElement.textContent = "";
                 }
            }, duration);
        }
        console.log("UI Log:", message); // Also log to console
    },

    toggleBuildMenu: function() {
        if (!this.buildMenuElement) return;

        const isOpen = this.buildMenuElement.style.display !== 'none';
        if (isOpen) {
            this.buildMenuElement.style.display = 'none';
            // If closing build menu, also exit build mode
            if (Building.isBuilding) {
                 Building.exitBuildMode();
            }
        } else {
            // Close inventory if open
            if (this.inventoryMenuElement.style.display !== 'none') {
                 this.inventoryMenuElement.style.display = 'none';
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
             // Close build menu if open
             if (this.buildMenuElement.style.display !== 'none') {
                  this.buildMenuElement.style.display = 'none';
                  if (Building.isBuilding) Building.exitBuildMode(); // Exit build mode if closing menu while building
             }
            Inventory.updateUI(); // Refresh inventory list when opening
            this.inventoryMenuElement.style.display = 'block';
        }
    },

    // Helper to check if any overlay menu is open
    isMenuOpen: function() {
        return (this.buildMenuElement && this.buildMenuElement.style.display !== 'none') ||
               (this.inventoryMenuElement && this.inventoryMenuElement.style.display !== 'none');
    }
};

window.UIManager = UIManager;
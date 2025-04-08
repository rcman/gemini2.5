// js/ui.js - Adding proper build menu functionality
class UIManager {
    // ... existing constructor and other methods ...

    // Fixed method to toggle and properly populate the build menu
    toggleBuildMenu() {
        this.isBuildMenuOpen = !this.isBuildMenuOpen;
        this.buildMenu.classList.toggle('hidden', !this.isBuildMenuOpen);
        this.game.setPaused(this.isInventoryOpen || this.isBuildMenuOpen || this.isWorkbenchOpen || this.isForgeOpen);

        if(this.isBuildMenuOpen) {
            // Populate build options based on available items
            this.populateBuildMenu();
        } else {
            // If closing menu while in build preview mode, cancel build preview
            if (this.game.buildingSystem.isBuilding) {
                this.game.buildingSystem.exitBuildMode();
            }
        }
    }

    // New method to populate build menu with available building options
    populateBuildMenu() {
        // Clear existing build options
        this.buildOptions.innerHTML = '';
        
        // Get all building items from ITEMS
        const buildingItems = Object.values(ITEMS).filter(item => 
            item.type === 'building_part' || item.type === 'placeable'
        );
        
        // Create buttons for each building item
        buildingItems.forEach(item => {
            const hasItem = this.game.inventoryManager.has(item.id, 1);
            
            const button = document.createElement('button');
            button.textContent = item.name;
            button.dataset.item = item.id;
            button.disabled = !hasItem;
            
            if (hasItem) {
                button.addEventListener('click', () => {
                    this.game.buildingSystem.selectBuildItem(item.id);
                });
            }
            
            this.buildOptions.appendChild(button);
        });
    }

    // Fixed method to handle notifications
    showNotification(message, duration = 3000) {
        const notificationArea = document.getElementById('notification-area');
        const notification = document.createElement('div');
        notification.classList.add('notification');
        notification.textContent = message;
        notificationArea.appendChild(notification);
        
        // Remove after duration
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500); // Give time for fade-out animation
        }, duration);
    }

    // Fixed update slot element to show proper item visuals
    updateSlotElement(slotElement, item) {
        // Clear previous content
        slotElement.innerHTML = '';
        slotElement.title = ''; // Clear tooltip

        if (item) {
            const itemData = getItemData(item.itemId);
            // Use better item representation
            const nameSpan = document.createElement('span');
            nameSpan.textContent = itemData.name;
            slotElement.appendChild(nameSpan);
            slotElement.title = `${itemData.name} (${item.quantity})`; // Tooltip

            // Add item count
            if (itemData.stackable && item.quantity > 1) {
                const countSpan = document.createElement('span');
                countSpan.classList.add('item-count');
                countSpan.textContent = item.quantity;
                slotElement.appendChild(countSpan);
            }
            
            // Add slot number for quick bar slots
            if (slotElement.classList.contains('quick-bar-slot')) {
                const slotIndex = parseInt(slotElement.dataset.index);
                const slotNumber = document.createElement('span');
                slotNumber.classList.add('slot-number');
                slotNumber.textContent = slotIndex + 1; // Display 1-8 instead of 0-7
                slotElement.appendChild(slotNumber);
            }
        }
    }
}
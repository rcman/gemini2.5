// js/ui.js
// Functions for updating the DOM (User Interface)

import { items } from './items.js';
import { recipes } from './recipes.js';
import * as Config from './config.js';
import { inventory, hasEnoughItems, toolbarItems, selectedToolbarIndex, setSelectedToolbarIndex } from './inventory.js'; // Import inventory state/helpers
import { craftItem } from './crafting.js'; // Import crafting logic
import { getControls } from './controls.js'; // To lock/unlock controls


// --- UI Update Functions ---

export function updateInventoryUI() {
    const list = document.getElementById("inventory-list");
    if (!list) return;
    list.innerHTML = "";
    let empty = true;
    // Get current inventory keys, filter valid items, sort alphabetically
    const sortedInventory = Object.keys(inventory)
        .filter(id => inventory[id] > 0 && items[id])
        .sort((a, b) => items[a].name.localeCompare(items[b].name));

    for (const id of sortedInventory) {
        const item = items[id];
        const count = inventory[id];
        const div = document.createElement("div");
        div.textContent = `${item.name}: ${count}`;
        list.appendChild(div);
        empty = false;
    }
    if (empty) {
        list.textContent = "Empty";
    }
}

export function updateToolbarUI() {
    const toolbar = document.getElementById("toolbar-ui");
    if (!toolbar) return;
    toolbar.innerHTML = "";
    toolbarItems.length = 0; // Clear the mapping array

    // Find items in inventory suitable for the toolbar
    const available = Object.keys(inventory)
        .filter(id => items[id] && (items[id].placeable || items[id].toolType) && inventory[id] > 0)
        .sort((a, b) => items[a].name.localeCompare(items[b].name)) // Sort alphabetically
        .slice(0, Config.MAX_TOOLBAR_SLOTS); // Limit to max slots

    for (let i = 0; i < Config.MAX_TOOLBAR_SLOTS; i++) {
        const itemId = available[i]; // Get item ID for this slot, if any
        const slot = document.createElement("div");
        slot.classList.add("toolbar-slot");
        slot.dataset.index = i; // Store index for click handling

        if (itemId) {
            const item = items[itemId];
            const count = inventory[itemId];
            toolbarItems[i] = itemId; // Map index to item ID

            slot.textContent = item.name.substring(0, 3).toUpperCase(); // Display short name
            slot.title = `${item.name}`; // Full name on hover

            // Show count if > 1 or if it's a placeable stack (like wood)
            if (count > 1 || item.placeable) {
                 slot.title += ` (${count})`;
                 const countSpan = document.createElement("span");
                 countSpan.classList.add("count");
                 countSpan.textContent = count;
                 slot.appendChild(countSpan);
            }
        } else {
            toolbarItems[i] = null; // No item in this slot
        }

        // Highlight the selected slot
        if (i === selectedToolbarIndex) {
            slot.classList.add("selected");
        }

        // Add click listener to change selection
        slot.addEventListener("click", () => {
             setSelectedToolbarIndex(i); // Update selection state
             // No need to call updateToolbarUI() here, setSelectedToolbarIndex already does
             // Potentially trigger build indicator update if needed:
             // import { updateBuildIndicator } from './building.js'; updateBuildIndicator(null);
        });

        toolbar.appendChild(slot);
    }
}


export function updateCraftingUI() {
    const list = document.getElementById("crafting-list");
    if (!list) return;
    list.innerHTML = "";

    const sortedRecipes = Object.keys(recipes)
        .sort((a, b) => recipes[a].name.localeCompare(recipes[b].name)); // Sort recipes alphabetically

    for (const id of sortedRecipes) {
        const recipe = recipes[id];
        const productItem = items[id];
        if (!productItem) continue; // Skip if item definition is missing

        const canCraft = hasEnoughItems(recipe.requires); // Check if player has resources

        const div = document.createElement("div");
        div.classList.add("crafting-recipe");

        // Build requirements text with color coding
        const reqText = Object.entries(recipe.requires)
            .map(([reqId, quantity]) => {
                const reqItem = items[reqId];
                const currentAmount = inventory[reqId] || 0;
                const color = currentAmount >= quantity ? 'lightgreen' : 'salmon'; // Green if enough, red if not
                return `<span style="color:${color}">${quantity}x ${reqItem ? reqItem.name : reqId}</span>`;
            }).join(", ");

        // Recipe name and requirements
        div.innerHTML = `<span><b>${recipe.produces}x ${recipe.name}</b><br/><small>Requires: ${reqText}</small></span>`;

        // Craft button
        const btn = document.createElement("button");
        btn.textContent = "Craft";
        btn.disabled = !canCraft; // Disable if requirements not met
        btn.onclick = () => {
            craftItem(id); // Call the crafting function
            // UI updates are handled within inventory modification functions called by craftItem
        };
        div.appendChild(btn);

        list.appendChild(div);
    }

    if (list.children.length === 0) {
        list.textContent = "No recipes available.";
    }
}

export function toggleCraftingMenu() {
    const ui = document.getElementById("crafting-ui");
    const controls = getControls(); // Get controls object
    if (!ui || !controls) return;

    const isOpen = ui.style.display === "block";

    if (isOpen) {
        ui.style.display = "none";
        // If controls exist and were unlocked by the menu, lock them again
        if (!controls.isLocked) {
            controls.lock();
        }
    } else {
        updateCraftingUI(); // Update content before showing
        ui.style.display = "block";
        // If controls are locked, unlock them to interact with the menu
        if (controls.isLocked) {
            controls.unlock();
        }
    }
}

// Initial setup for the close button
export function setupUICloseButtons() {
    const closeCraftingBtn = document.getElementById('close-crafting-btn');
    if(closeCraftingBtn) {
        closeCraftingBtn.onclick = toggleCraftingMenu; // Reuse the toggle function
    }
}
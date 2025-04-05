// js/ui.js
import { getItemDef } from './itemSystem.js';

const inventoryUI = document.getElementById('inventory-ui');
const inventoryList = document.getElementById('inventory-list');
const infoTextElement = document.getElementById('info-text');
let infoTextTimeout;

export function toggleInventoryUI(inventoryData) {
    inventoryUI.classList.toggle('hidden');
    if (!inventoryUI.classList.contains('hidden')) {
        updateInventoryUI(inventoryData); // Update display when opened
    }
}

export function updateInventoryUI(items) {
    if (!inventoryUI || !inventoryList) return; // Guard against missing elements

    // Clear previous list
    inventoryList.innerHTML = '';

    // Populate list
    for (const itemId in items) {
        const quantity = items[itemId];
        const itemDef = getItemDef(itemId);
        if (itemDef && quantity > 0) {
            const listItem = document.createElement('li');
            listItem.textContent = `${itemDef.name}: ${quantity}`;
            inventoryList.appendChild(listItem);
        }
    }
     if (Object.keys(items).length === 0) {
         inventoryList.innerHTML = '<li>Empty</li>';
     }
}

// Display short messages to the player
export function showMessage(text, duration = 3000) {
    if (!infoTextElement) return;
    infoTextElement.textContent = text;
    infoTextElement.style.display = 'block';

    // Clear previous timeout if exists
    if (infoTextTimeout) {
        clearTimeout(infoTextTimeout);
    }

    // Set timeout to hide the message
    infoTextTimeout = setTimeout(() => {
        infoTextElement.style.display = 'none';
    }, duration);
}

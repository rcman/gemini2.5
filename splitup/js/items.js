// js/items.js
// Defines item properties, geometries, and materials
// Note: Assumes THREE is globally available from the CDN script in index.html

import * as Config from './config.js';

// --- Item Definitions ---
// Geometry/Material creation uses the globally available THREE object
export const items = {
    'wood': { name: 'Wood', placeable: true, color: 0x8b4513, geometry: new THREE.BoxGeometry(1, 1, 2), buildType: 'resource' },
    'stone': { name: 'Stone', placeable: true, color: 0x808080, geometry: new THREE.BoxGeometry(0.8, 0.8, 0.8), buildType: 'resource' },
    'leaves': { name: 'Leaves', placeable: true, color: 0x228B22, geometry: new THREE.BoxGeometry(1.5, 0.3, 1.5), buildType: 'resource' },
    'planks': { name: 'Planks', placeable: true, color: 0xdeb887, geometry: new THREE.BoxGeometry(0.2, 1, 2), buildType: 'material' },
    'workbench': { name: 'Workbench', placeable: true, color: 0xcd853f, geometry: new THREE.BoxGeometry(2, 1, 1), buildType: 'utility' },
    'torch': { name: 'Torch', placeable: true, color: 0xffff00, geometry: new THREE.CylinderGeometry(0.1, 0.1, 1, 8), light: true, buildType: 'utility' },
    'foundation': { name: 'Foundation', placeable: true, color: 0x777777, geometry: new THREE.BoxGeometry(Config.foundationW, Config.foundationH, Config.foundationD), buildType: 'foundation' },
    'wall': { name: 'Wall', placeable: true, color: 0xaaaaaa, geometry: new THREE.BoxGeometry(Config.wallW, Config.wallH, Config.wallD), buildType: 'wall' },
    'wall_window': { name: 'Wall (Window)', placeable: true, color: 0xaaaaaa, geometry: new THREE.BoxGeometry(Config.wallW, Config.wallH, Config.wallD), buildType: 'wall' }, // Visually same, differentiation is in build logic if needed
    'wall_door': { name: 'Wall (Door)', placeable: true, color: 0xaaaaaa, geometry: new THREE.BoxGeometry(Config.wallW, Config.wallH, Config.wallD), buildType: 'wall' }, // Visually same
    'door': { name: 'Door', placeable: true, color: 0x8b4513, geometry: new THREE.BoxGeometry(Config.doorW, Config.doorH, Config.doorD), buildType: 'door' },
    'roof': { name: 'Roof', placeable: true, color: 0x666666, geometry: new THREE.BoxGeometry(Config.roofW, Config.roofH, Config.roofD), buildType: 'roof' },
    'axe': { name: 'Axe', placeable: false, toolType: 'axe', color: 0xcccccc, geometry: new THREE.BoxGeometry(0.2, 1.5, 0.5) }, // Added basic geometry for potential future rendering
    'pickaxe': { name: 'Pickaxe', placeable: false, toolType: 'pickaxe', color: 0xaaaaaa, geometry: new THREE.BoxGeometry(0.2, 1.5, 0.5) },
    'knife': { name: 'Knife', placeable: false, toolType: 'knife', color: 0xbbbbbb, geometry: new THREE.BoxGeometry(0.1, 0.8, 0.2) }
};

// Function to pre-process item data (add materials, sizes)
export function initializeItemData() {
    for (const id in items) {
        const item = items[id];
        // Create material (MeshStandardMaterial should be available in r128)
        item.material = new THREE.MeshStandardMaterial({
            color: item.color,
            roughness: item.buildType ? 0.9 : 0.7, // Different roughness for buildables vs tools
            metalness: 0.1
        });

        // Calculate size from geometry
        if (item.geometry) {
             // Bounding box calculation should work similarly in r128
            item.geometry.computeBoundingBox();
            item.size = new THREE.Vector3();
             // .getSize() on boundingBox should exist in r128.
            item.geometry.boundingBox.getSize(item.size);
        } else {
             // console.warn(`Item ${id} has no geometry defined.`);
             item.size = new THREE.Vector3(1, 1, 1); // Default size if no geometry
        }
        item.id = id; // Add id for convenience
    }
     if (Config.DEBUG) console.log("Item data initialized.");
}
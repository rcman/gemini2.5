import random
import time # Make sure time is imported for time.dt
from ursina import *
from ursina.prefabs.first_person_controller import FirstPersonController

# --- Game Settings (Placeholders - ideally loaded from a menu) ---
INITIAL_RESOURCES = {'wood': 5, 'stone': 3} # Example starting resources
PLAYER_SPEED = 5
PLAYER_HEIGHT = 1.8

# --- Item Definitions ---
# Using simple strings for now, could be classes later for more properties
# Tool Durability, Item Effects etc. would go into item classes
ITEMS = {
    'axe': {'recipe': {'wood': 3, 'stone': 2}, 'type': 'tool'},
    'pickaxe': {'recipe': {'wood': 2, 'stone': 3}, 'type': 'tool'},
    'knife': {'recipe': None, 'type': 'tool'}, # Starting item
    'canteen': {'recipe': None, 'type': 'tool', 'water_level': 0, 'is_boiled': False}, # Starting item
    'campfire': {'recipe': {'wood': 10, 'stone': 5}, 'type': 'placeable'},
    'crafting_table': {'recipe': {'wood': 15}, 'type': 'placeable'},
    'forge': {'recipe': {'stone': 20, 'wood': 5}, 'type': 'placeable'},
    'rope': {'recipe': {'grass': 5}, 'type': 'material'},
    'wood': {'recipe': None, 'type': 'material'},
    'stone': {'recipe': None, 'type': 'material'},
    'tall_grass': {'recipe': None, 'type': 'resource_source'}, # Special case for harvesting
    'grass': {'recipe': None, 'type': 'material'}, # Harvested from tall_grass
    'scrap_metal': {'recipe': None, 'type': 'material'},
    'nail': {'recipe': None, 'type': 'material'}, # Found in loot
    'raw_meat': {'recipe': None, 'type': 'food'},
    'cooked_meat': {'recipe': None, 'type': 'food'},
    'leather': {'recipe': None, 'type': 'material'},
    'fat': {'recipe': None, 'type': 'material'},
}

# --- Player Class (Extending FirstPersonController) ---
class SurvivalPlayer(FirstPersonController):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.speed = PLAYER_SPEED
        # Note: Ursina's FPC height is controlled by camera_pivot.y and collider height.
        # Setting self.height doesn't directly change collision height here.
        # We adjust camera pivot based on it. The collider is separate.
        self.base_height = PLAYER_HEIGHT
        self.camera_pivot.y = self.base_height * 0.92 # Adjust camera height relative to base
        if self.collider:
            if isinstance(self.collider, BoxCollider):
                self.collider.scale = Vec3(self.collider.scale_x, self.base_height, self.collider.scale_z)
                self.collider.center = Vec3(0, self.base_height / 2, 0) # Center the collider
            # Add similar logic if using CapsuleCollider

        # Inventory
        self.inventory = {} # Using a dictionary: {'item_name': count}
        self.quick_bar = [None] * 9 # 9 quick slots
        self.quick_bar_selection = 0
        self.equipped_item = None

        # Starting Gear & Resources
        self.add_item('axe')
        self.add_item('pickaxe')
        self.add_item('knife')
        self.add_item('canteen')
        for item, count in INITIAL_RESOURCES.items():
             self.add_item(item, count)

        # Needs (Placeholders)
        self.hunger = 100
        self.thirst = 100
        self.health = 100

        # *** FIX: DO NOT call update_quick_bar_ui here ***
        # self.update_quick_bar_ui() # This caused the error because quick_bar_ui didn't exist yet

        # Initialize equipped item based on quick bar state AFTER adding items
        self.update_equipped_item()


    def add_item(self, item_name, count=1):
        if item_name not in ITEMS:
             print(f"Warning: Tried to add unknown item '{item_name}'")
             return

        if item_name in self.inventory:
            self.inventory[item_name] += count
        else:
            self.inventory[item_name] = count
        print(f"Added {count} {item_name}. Inventory: {self.inventory}")

        # Try placing in quick bar if it's a newly added type
        if self.inventory[item_name] == count: # If it's the first time adding this item type
            try:
                first_empty_slot = self.quick_bar.index(None)
                self.quick_bar[first_empty_slot] = item_name
                # *** FIX: It's safer NOT to update UI from here during setup ***
                # Instead, rely on the single update call after the UI is created.
                # If the UI object exists (i.e., game is running), this call is safe:
                # if 'quick_bar_ui' in globals() and quick_bar_ui:
                #    self.update_quick_bar_ui()
            except ValueError:
                 pass # No empty slots

        # Update inventory UI if it's open
        if 'inventory_panel' in globals() and inventory_panel and inventory_panel.enabled:
            inventory_panel.update_display()


    def remove_item(self, item_name, count=1):
        if item_name in self.inventory and self.inventory[item_name] >= count:
            self.inventory[item_name] -= count
            if self.inventory[item_name] <= 0:
                del self.inventory[item_name]
                # Remove from quick bar if it was there
                for i in range(len(self.quick_bar)):
                    if self.quick_bar[i] == item_name:
                        self.quick_bar[i] = None
                        # If it was equipped, unequip and update display
                        if self.quick_bar_selection == i:
                            self.equipped_item = None
                            # Add logic here to hide held item model if you have one
                # Update quick bar UI if it exists
                if 'quick_bar_ui' in globals() and quick_bar_ui:
                    self.update_quick_bar_ui()

            print(f"Removed {count} {item_name}. Inventory: {self.inventory}")
            # Update inventory UI if it's open
            if 'inventory_panel' in globals() and inventory_panel and inventory_panel.enabled:
                 inventory_panel.update_display()
            # Update crafting UI if it's open (recipes might become unavailable)
            if 'crafting_panel' in globals() and crafting_panel and crafting_panel.enabled:
                 crafting_panel.update_recipes()
            return True

        print(f"Could not remove {count} {item_name}.")
        return False

    def switch_quick_bar_slot(self, delta):
        self.quick_bar_selection = (self.quick_bar_selection + delta) % len(self.quick_bar)
        self.update_equipped_item()
        if 'quick_bar_ui' in globals() and quick_bar_ui: # Check if UI exists
             self.update_quick_bar_ui() # Highlight selected slot

    def update_equipped_item(self):
         self.equipped_item = self.quick_bar[self.quick_bar_selection]
         print(f"Equipped: {self.equipped_item}")
         # Add logic here to show/hide held item model if you have one

    def update_quick_bar_ui(self):
        # Update the visual representation of the quick bar
        # This function assumes 'quick_bar_ui' exists globally when called.
        if not 'quick_bar_ui' in globals() or not quick_bar_ui:
             print("Warning: update_quick_bar_ui called before quick_bar_ui exists.")
             return # Avoid error if called too early

        for i, item_name in enumerate(self.quick_bar):
            if item_name:
                quick_bar_ui.slots[i].text = item_name[:3] # Show first 3 letters
                quick_bar_ui.slots[i].tooltip = Tooltip(item_name)
            else:
                quick_bar_ui.slots[i].text = ""
                if quick_bar_ui.slots[i].tooltip:
                    destroy(quick_bar_ui.slots[i].tooltip) # Remove old tooltip
                quick_bar_ui.slots[i].tooltip = None

            # Highlight selected slot
            if i == self.quick_bar_selection:
                 quick_bar_ui.slots[i].color = color.white70 # Use a slightly different color for selection
            else:
                 quick_bar_ui.slots[i].color = color.dark_gray

    def input(self, key):
        # Allow pausing even if UI is open
        if key == 'escape':
            if inventory_panel.enabled: inventory_panel.disable()
            elif crafting_panel.enabled: crafting_panel.disable()
            # elif pause_menu.enabled: pause_menu.disable() # Add pause menu logic
            # else: pause_menu.enable() # Or add a pause menu toggle
            else: application.quit() # Simple quit on escape if nothing else is open

        # Prevent movement/actions if a UI panel is open
        ui_open = inventory_panel.enabled or crafting_panel.enabled # or pause_menu.enabled
        if ui_open:
            # Allow specific keys even if UI is open
             if key == 'tab' and not crafting_panel.enabled: # Allow toggling inventory unless crafting is open
                 inventory_panel.toggle()
             elif key == 'c' and not inventory_panel.enabled: # Allow toggling crafting unless inventory is open
                 crafting_panel.toggle()
             elif key == 'escape': # Already handled above
                 pass
             elif held_keys['left shift'] and key == 'left mouse down' and inventory_panel.enabled:
                 # Find which inventory slot was clicked (requires more complex UI logic)
                 print("Shift+Click Detected - Move item logic needed here")
             return # Stop processing other inputs if UI is open

        # --- Process game inputs only if UI is closed ---
        super().input(key) # Handle basic movement

        # --- Interaction ---
        if key == 'left mouse down':
            self.interact()
        if key == 'right mouse down':
             self.secondary_interact() # E.g., open barrel UI, place item

        # --- Inventory Toggle ---
        if key == 'tab':
            inventory_panel.toggle()
            crafting_panel.disable() # Close crafting if inventory opens

        # --- Quick Bar Selection ---
        if key.isdigit() and 0 < int(key) <= len(self.quick_bar):
            self.quick_bar_selection = int(key) - 1
            self.update_equipped_item()
            self.update_quick_bar_ui()
        if key == 'scroll up':
            self.switch_quick_bar_slot(-1)
        if key == 'scroll down':
            self.switch_quick_bar_slot(1)

        # --- Crafting Toggle ---
        if key == 'c': # Simple toggle for crafting menu
            crafting_panel.toggle()
            inventory_panel.disable() # Close inventory if crafting opens


    def interact(self):
        # Raycast to see what the player is looking at
        # Origin slightly in front of camera to avoid hitting player collider
        origin = self.camera_pivot.world_position + self.forward * 0.5
        hit_info = raycast(origin, camera.forward, distance=3, ignore=[self,]) # Ignore self

        if hit_info.hit:
            entity = hit_info.entity
            # Using hasattr to safely check for attributes like 'name' or 'tags'
            entity_name = getattr(entity, 'name', 'Unknown Entity')
            entity_tags = getattr(entity, 'tags', set())
            print(f"Looking at: {entity_name} (Tags: {entity_tags})")

            # Resource Gathering
            if isinstance(entity, Tree) and self.equipped_item == 'axe':
                print("Chopping tree...")
                entity.gather()
            elif isinstance(entity, Rock) and self.equipped_item == 'pickaxe':
                print("Mining rock...")
                entity.gather()
            elif isinstance(entity, TallGrass) and self.equipped_item: # Any tool or hand?
                print("Harvesting grass...")
                entity.gather()
            elif isinstance(entity, ScrapPile) and self.equipped_item:
                 print("Collecting scrap...")
                 entity.gather()
            elif isinstance(entity, Animal) and self.equipped_item in ['knife', 'axe', 'pickaxe']: # Hunt with tools
                print(f"Attacking {entity.name}...")
                # Define damage based on tool?
                damage = {'knife': 15, 'axe': 25, 'pickaxe': 20}.get(self.equipped_item, 5) # Default 5 damage?
                entity.take_damage(damage)
            elif isinstance(entity, WaterSource) or (hasattr(entity, 'trigger') and entity.trigger and 'water' in entity.trigger.tags):
                 # Check if looking at water trigger or surface
                 if self.equipped_item == 'canteen':
                     print("Collecting water...")
                     # TODO: Implement canteen state management
                     # Find the canteen item in inventory (assuming it's like ITEMS definition)
                     # For now, just print a message
                     print("DEBUG: Canteen filling logic needed")
                     # Example: self.inventory['canteen']['water_level'] = 1; self.inventory['canteen']['is_boiled'] = False
                 else:
                     print("Need a canteen equipped to collect water.")
            # Add more interactions: Collect water, talk to NPC, etc.

    def secondary_interact(self):
         # Raycast to see what the player is looking at
         origin = self.camera_pivot.world_position + self.forward * 0.5
         hit_info = raycast(origin, camera.forward, distance=3, ignore=[self,])

         if hit_info.hit:
             entity = hit_info.entity
             # Searching Containers
             if isinstance(entity, (Barrel, LootContainer)): # Check multiple types
                 print(f"Searching {entity.name}...")
                 entity.search()
             # Placing Items (Example: Campfire)
             elif self.equipped_item == 'campfire':
                  if self.remove_item('campfire'): # Try to remove first
                      place_position = hit_info.world_point + hit_info.normal * 0.1 # Slightly off surface
                      # TODO: Create Campfire class extend Entity
                      # Campfire(position=place_position)
                      print(f"DEBUG: Placed campfire at {place_position}")
                  else:
                       print("Could not remove campfire from inventory (shouldn't happen if equipped)")

         # If not hitting anything specific, maybe place on ground in front?
         elif self.equipped_item and ITEMS.get(self.equipped_item, {}).get('type') == 'placeable':
              if self.remove_item(self.equipped_item): # Try to remove first
                   # Place slightly in front of player on the ground
                   ground_hit = raycast(self.position + self.forward * 1.5 + self.up * 1, self.down, distance=5, ignore=[self,])
                   if ground_hit.hit:
                        place_position = ground_hit.world_point
                        # TODO: Instantiate the correct placeable item class
                        # e.g. if self.equipped_item == 'forge': Forge(position=place_position)
                        print(f"DEBUG: Placed {self.equipped_item} at {place_position}")
                   else:
                        print("Cannot place item here (no ground found).")
                        self.add_item(self.equipped_item) # Add back if placement failed
              else:
                   print("Could not remove item from inventory (shouldn't happen if equipped)")


    def update(self):
        super().update() # Handles existing controller updates (movement, gravity)

        # --- Needs Depletion (Example) ---
        # Simple decrement, replace with time.dt for frame-rate independence
        # Needs should only deplete if game is not paused!
        if not application.paused: # Check if game is paused
            # Rate: units per minute (approx)
            hunger_rate_per_min = 3.0
            thirst_rate_per_min = 4.5
            heal_rate_per_min = 2.0 # Healing if well fed/hydrated
            damage_rate_per_min = 5.0 # Damage if starving/dehydrated

            self.thirst -= (thirst_rate_per_min / 60) * time.dt
            self.hunger -= (hunger_rate_per_min / 60) * time.dt

            self.thirst = max(0, self.thirst) # Clamp at 0
            self.hunger = max(0, self.hunger)

            if self.thirst <= 0 or self.hunger <= 0:
                self.health -= (damage_rate_per_min / 60) * time.dt
                self.health = max(0, self.health) # Clamp health at 0
                # print(f"Taking damage! Health: {self.health:.1f}")
            elif self.thirst > 50 and self.hunger > 50 and self.health < 100:
                 # Heal slowly if needs are met and health isn't full
                 self.health += (heal_rate_per_min / 60) * time.dt
                 self.health = min(100, self.health) # Clamp health at 100


            if self.health <= 0:
                print("Player Died!")
                # Add death logic (respawn, game over screen, drop items?)
                self.position = (random.uniform(-5, 5), 5, random.uniform(-5, 5)) # Simple respawn
                self.health = 100
                self.hunger = 70 # Respawn slightly hungry/thirsty
                self.thirst = 70
                # Consider losing some items or resetting inventory

        # Debug Needs Display (optional)
        # print_on_screen(f"H:{self.hunger:.0f} T:{self.thirst:.0f} HP:{self.health:.0f}", position=(-0.8, 0.48), scale=1.5)


# --- Resource Nodes ---
class ResourceNode(Entity):
    def __init__(self, model, texture, collider, resource_type, yield_amount=1, health=3, **kwargs):
        super().__init__(model=model, texture=texture, collider=collider, **kwargs)
        self.resource_type = resource_type
        self.yield_amount = yield_amount
        self.max_health = health
        self.current_health = health
        self.tags.add('resource') # Add tag for easier identification

    def gather(self):
        self.current_health -= 1
        # Optional: Add visual feedback (shake, sound, particle)
        self.shake(duration=0.1, magnitude=0.05 * (self.max_health - self.current_health + 1)) # Shake more as it gets lower
        Audio('sounds/wood_chop.wav', volume=0.5, pitch=random.uniform(0.9, 1.1)) # Example sound - needs sound file!

        if self.current_health <= 0:
            print(f"Gathered {self.yield_amount} {self.resource_type}")
            player.add_item(self.resource_type, self.yield_amount)
            # Optional: Play destroy sound/effect, spawn particles
            # Position for particles/effects
            destroy_pos = self.world_position + self.up * self.scale_y / 2
            # Example particle effect (requires texture)
            # ParticleSystem(position=destroy_pos, texture='particle_texture.png')
            destroy(self)
        else:
            print(f"{self.name} health: {self.current_health}")

class Tree(ResourceNode):
    def __init__(self, position=(0,0,0)):
        tex = random.choice(['textures/bark1.png', 'textures/bark2.png']) # Need texture files
        tree_height = random.uniform(3, 6)
        tree_width = random.uniform(0.8, 1.5)
        super().__init__(
            model='models/tree_trunk.obj', # Placeholder - use a tree model!
            texture=tex if os.path.exists(tex) else 'brick', # Use texture if exists
            collider='mesh', # Use mesh collider for custom models
            scale=(tree_width, tree_height, tree_width),
            position=position,
            # color=color.brown, # Color may be overridden by texture
            resource_type='wood',
            yield_amount=random.randint(2, 5),
            health=5,
            name='Tree'
        )
        # Add leaves (optional) - Parented to the tree trunk
        leaves_tex = 'textures/leaves.png' # Need texture file
        Entity(model='models/tree_leaves.obj', #'sphere',
               texture=leaves_tex if os.path.exists(leaves_tex) else 'white_cube',
               scale=tree_width * 2.5 / self.scale_x, # Scale leaves relative to trunk
               color=color.green,
               position=Vec3(0, tree_height * 0.8 / self.scale_y , 0), # Position relative to trunk's origin
               collider=None, # No collision for leaves usually
               parent=self) # Parent to the trunk

class Rock(ResourceNode):
    def __init__(self, position=(0,0,0)):
        tex = 'textures/rock.png' # Need texture file
        super().__init__(
            model='models/rock.obj', # Placeholder - use a rock model!
            texture=tex if os.path.exists(tex) else 'white_cube', # Placeholder - use a rock texture!
            collider='mesh', # Use mesh collider for custom models
            scale=random.uniform(0.5, 1.5),
            position=position,
            # color=color.gray, # Color may be overridden by texture
            resource_type='stone',
            yield_amount=random.randint(1, 4),
            health=4,
            name='Rock'
        )

class TallGrass(ResourceNode):
     def __init__(self, position=(0,0,0)):
         # Use a simple quad or plane model with transparency for grass
         tex = 'textures/tall_grass.png' # Needs texture file with alpha
         super().__init__(
             model='quad', # Use quad for billboard effect maybe? Or simple plane model
             texture=tex if os.path.exists(tex) else 'white_cube',
             collider=None, # Player can walk through, only interactable via raycast
             scale=(0.8, random.uniform(0.5, 1.0), 0.8),
             position=position,
             color=color.lime,
             resource_type='grass', # Harvests into 'grass' item
             yield_amount=random.randint(1, 3),
             health=1, # Harvest in one hit
             name='TallGrass',
             double_sided=True, # Make texture visible from both sides
             billboard=True # Make it always face the camera
         )
         # Override gather sound
         self.gather_sound = Audio('sounds/grass_harvest.wav', autoplay=False, volume=0.6)

     def gather(self):
        # Override default gather to play specific sound
        self.current_health -= 1
        self.shake(duration=0.1, magnitude=0.1)
        if self.gather_sound: self.gather_sound.play()

        if self.current_health <= 0:
            print(f"Gathered {self.yield_amount} {self.resource_type}")
            player.add_item(self.resource_type, self.yield_amount)
            destroy(self)
        else:
             # This shouldn't happen for grass (health=1) but keep for consistency
             print(f"{self.name} health: {self.current_health}")


class ScrapPile(ResourceNode):
    def __init__(self, position=(0,0,0)):
        tex = 'textures/metal_scrap.png' # Need texture
        super().__init__(
            model='models/scrap_pile.obj', # Placeholder
            texture=tex if os.path.exists(tex) else 'white_cube',
            collider='mesh',
            scale=random.uniform(0.4, 0.8),
            position=position,
            # color=color.dark_gray,
            resource_type='scrap_metal',
            yield_amount=random.randint(1, 3),
            health=2,
            name='ScrapPile'
        )
        # Override gather sound
        self.gather_sound = Audio('sounds/metal_hit.wav', autoplay=False, volume=0.4)
        # Add gather logic here similar to TallGrass if needing custom sound


# --- Containers ---
class Searchable(Entity):
    def __init__(self, model, texture, collider, loot_table=None, **kwargs):
        # Ensure requires_string_or_texture decorator handles missing files
        if isinstance(texture, str) and not os.path.exists(texture):
            print(f"Warning: Texture not found for Searchable: {texture}. Using default.")
            texture = 'white_cube' # Fallback texture

        super().__init__(model=model, texture=texture, collider=collider, **kwargs)
        self.loot_table = loot_table if loot_table else {'nail': (1, 5), 'scrap_metal': (0, 2)} # Item: (min, max)
        self.searched = False
        self.tags.add('container')
        self.open_sound = Audio('sounds/chest_open.wav', autoplay=False, volume=0.5) # Needs sound
        self.empty_sound = Audio('sounds/click.wav', autoplay=False, volume=0.3) # Needs sound

    def search(self):
        if not self.searched:
            print(f"Searching {self.name}...")
            if self.open_sound: self.open_sound.play()
            found_loot = False
            loot_text = "Found: "
            for item, (min_q, max_q) in self.loot_table.items():
                 # Add chance component? e.g., 50% chance to even check this item
                 if random.random() < 0.8: # 80% chance to contain this type of loot if listed
                     quantity = random.randint(min_q, max_q)
                     if quantity > 0:
                         player.add_item(item, quantity)
                         loot_text += f"{quantity} {item}, "
                         found_loot = True

            if found_loot:
                print(loot_text.strip(', '))
                 # Simple feedback: disable interaction or change appearance
                if hasattr(self, 'original_color'): # Requires storing original color on init if needed
                    self.color = color.dark_gray
                else:
                    self.color = self.color * 0.5 # Darken color
                self.searched = True

            else:
                print("...it's empty.")
                if self.empty_sound: self.empty_sound.play()
                self.searched = True # Mark as searched even if empty this time
                self.color = self.color * 0.5 # Darken color
        else:
            print(f"{self.name} has already been searched.")
            if self.empty_sound: self.empty_sound.play()

class Barrel(Searchable):
     def __init__(self, position=(0,0,0)):
         model_path = 'models/barrel.obj' # Need model
         texture_path = 'textures/barrel.png' # Need texture
         super().__init__(
             model=model_path if os.path.exists(model_path) else 'cube',
             texture=texture_path if os.path.exists(texture_path) else 'white_cube',
             collider='mesh' if os.path.exists(model_path) else 'box',
             scale=(0.8, 1.2, 0.8) if not os.path.exists(model_path) else 1.0, # Adjust scale if using default cube
             position=position,
             # color=color.orange,
             name='Barrel',
             # More specific loot table possible
             loot_table={'scrap_metal': (1, 3), 'nail': (2, 6), 'canteen': (0, 1)} # Chance to find canteen
         )

class LootContainer(Searchable): # For inside buildings
     def __init__(self, position=(0,0,0)):
         model_path = 'models/crate.obj' # Need model
         texture_path = 'textures/crate.png' # Need texture
         super().__init__(
             model=model_path if os.path.exists(model_path) else 'cube',
             texture=texture_path if os.path.exists(texture_path) else 'white_cube',
             collider='mesh' if os.path.exists(model_path) else 'box',
             scale=(1, 0.6, 1.2) if not os.path.exists(model_path) else 1.0, # Adjust scale
             position=position,
             # color=color.white,
             name='Crate',
             loot_table={'raw_meat': (0, 2), 'fat': (0, 3), 'nail': (3, 8), 'wood': (0, 5)} # Valuables
         )


# --- Buildings (Simple Structures) ---
class Building(Entity):
     def __init__(self, position=(0,0,0), size=(5, 3, 6)):
         super().__init__(name='Building', position=position, enable=True) # Parent entity
         self.size = size
         wall_texture = 'textures/building_wall.png' # Need texture
         floor_texture = 'textures/building_floor.png' # Need texture

         # Floor
         Entity(model='cube', scale=(size[0], 0.1, size[2]),
                collider='box',
                texture=floor_texture if os.path.exists(floor_texture) else 'dark_gray',
                position=position + Vec3(0, -0.05, 0), parent=self)

         # Walls (with a doorway gap on one side)
         wall_thickness = 0.2
         wall_positions_scales = [
             (Vec3(0, size[1]/2, size[2]/2 - wall_thickness/2), Vec3(size[0], size[1], wall_thickness)), # Back
             # Front wall parts calculated below
             (Vec3(size[0]/2 - wall_thickness/2, size[1]/2, 0), Vec3(wall_thickness, size[1], size[2])), # Right
             (Vec3(-size[0]/2 + wall_thickness/2, size[1]/2, 0), Vec3(wall_thickness, size[1], size[2])), # Left
         ]

         door_width = 1.5
         door_height = 2.2

         # Create walls using the list
         for pos, scale in wall_positions_scales:
              Entity(model='cube', scale=scale, collider='box',
                     texture=wall_texture if os.path.exists(wall_texture) else 'white',
                     position=position + pos, parent=self)

         # Front Wall (split into two parts for doorway)
         front_wall_z = position.z - size[2]/2 + wall_thickness/2
         wall1_width = (size[0] - door_width - wall_thickness) / 2 # Account for thickness overlap later? Simplified here.
         wall1_center_x = position.x - size[0]/2 + wall_thickness/2 + wall1_width/2
         wall2_center_x = position.x + size[0]/2 - wall_thickness/2 - wall1_width/2

         # Front Left Part
         Entity(model='cube', scale=(wall1_width, size[1], wall_thickness), collider='box',
                texture=wall_texture if os.path.exists(wall_texture) else 'white',
                position=(wall1_center_x, position.y + size[1]/2, front_wall_z), parent=self)
         # Front Right Part
         Entity(model='cube', scale=(wall1_width, size[1], wall_thickness), collider='box',
                texture=wall_texture if os.path.exists(wall_texture) else 'white',
                position=(wall2_center_x, position.y + size[1]/2, front_wall_z), parent=self)
         # Lintel above door
         lintel_height = size[1] - door_height
         Entity(model='cube', scale=(door_width + wall_thickness, lintel_height, wall_thickness), collider='box',
                texture=wall_texture if os.path.exists(wall_texture) else 'white',
                position=(position.x, position.y + door_height + lintel_height/2 , front_wall_z), parent=self)


         # Add loot containers inside
         num_crates = random.randint(1, 3)
         for _ in range(num_crates):
             # Ensure crate is within building bounds
             crate_pos = position + Vec3(
                 random.uniform(-size[0]/2 * 0.7, size[0]/2 * 0.7),
                 0.3, # Crate height/2 - Assuming crate model origin is at base
                 random.uniform(-size[2]/2 * 0.7, size[2]/2 * 0.7)
             )
             # Ensure crate doesn't spawn in the doorway area
             if not (position.x - door_width/2 < crate_pos.x < position.x + door_width/2 and crate_pos.z < position.z - size[2]/2 + door_width): # Simple check
                 LootContainer(position=crate_pos)


# --- Animals (Simple Wander AI) ---
class Animal(Entity):
    def __init__(self, model='cube', texture='white_cube', collider='box', speed=2, health=100, loot=None, wander_range=15, **kwargs):
        # Fallback texture
        if isinstance(texture, str) and not os.path.exists(texture):
             texture = 'white_cube'

        super().__init__(model=model, texture=texture, collider=collider, **kwargs)
        self.speed = speed
        self.max_health = health
        self.current_health = health
        self.loot = loot if loot else {'raw_meat': (1,3), 'leather': (0,2), 'fat': (0,1)} # item: (min, max)
        self.tags.add('animal')
        self.wander_target = None
        self.wander_timer = random.uniform(3, 8) # Change direction every few seconds
        self.start_position = self.position # Remember where it spawned
        self.wander_range = wander_range # How far from start_position it wanders
        self.damage_sound = Audio('sounds/animal_hurt.wav', autoplay=False, volume=0.7) # Need sound
        self.death_sound = Audio('sounds/animal_death.wav', autoplay=False, volume=0.8) # Need sound

    def update(self):
        if application.paused: return # Don't update if paused

        self.wander_timer -= time.dt
        if self.wander_timer <= 0 or self.wander_target is None:
            # Pick a new random target within wander_range of start_position
            target_offset = Vec3(random.uniform(-self.wander_range, self.wander_range),
                                 0,
                                 random.uniform(-self.wander_range, self.wander_range))
            self.wander_target = self.start_position + target_offset
            self.wander_timer = random.uniform(5, 12) # Wander for longer
            # Smooth look towards target
            self.look_at(Vec3(self.wander_target.x, self.y, self.wander_target.z), duration=0.5)

        if self.wander_target:
            # Move towards target (simple linear movement)
            direction = (self.wander_target - self.position).normalized()
            distance_to_target = distance(self.position, self.wander_target)

            if distance_to_target > 1: # Only move if not already close
                 # Raycast ahead slightly to check for obstacles (ignore self, player, other animals?)
                 obstacle_check = raycast(self.world_position + self.up * 0.5, self.forward, distance=1.5, ignore=[self, player], debug=False) # Added player ignore
                 if not obstacle_check.hit or distance(obstacle_check.entity.world_position, self.world_position) < 0.5: # Avoid hitting self collider sometimes
                      self.position += direction * self.speed * time.dt
                 else:
                      # Hit obstacle, pick new target immediately by resetting timer
                      print(f"{self.name} hit obstacle {obstacle_check.entity.name}, changing direction.")
                      self.wander_target = None
                      self.wander_timer = 0 # Force new target next frame
            else:
                 # Reached target
                 self.wander_target = None


    def take_damage(self, amount):
        self.current_health -= amount
        print(f"{self.name} took {amount} damage. Health: {self.current_health}")
        # Add visual feedback (flash red, etc.)
        self.blink(color.red, duration=0.2)
        if self.damage_sound: self.damage_sound.play()

        if self.current_health <= 0:
            self.die()

    def die(self):
        print(f"{self.name} died.")
        if self.death_sound: self.death_sound.play()

        # Spawn loot item entities on the ground
        for item, (min_q, max_q) in self.loot.items():
            quantity = random.randint(min_q, max_q)
            if quantity > 0:
                 # TODO: Create a pickup-able item entity class instead of adding directly
                 # For now, just print and add to player if close enough (simplification)
                 if distance(self.position, player.position) < 5:
                      print(f"Added {quantity} {item} directly to player.")
                      player.add_item(item, quantity)
                 else:
                      # Spawn item on ground (needs an ItemPickup class)
                      # ItemPickup(item_name=item, position=self.world_position + Vec3(random.uniform(-0.5,0.5), 0.2, random.uniform(-0.5,0.5)))
                      print(f"Dropped {quantity} {item} on ground (placeholder).")

        # Optional: Ragdoll physics or death animation before destroying
        destroy(self)

class Deer(Animal): # Example specific animal
    def __init__(self, position=(0,0,0)):
         model_path = 'models/deer.obj' # Need model
         texture_path = 'textures/deer.png' # Need texture
         super().__init__(
              model=model_path if os.path.exists(model_path) else 'cube',
              texture=texture_path if os.path.exists(texture_path) else 'white_cube',
              collider='mesh' if os.path.exists(model_path) else 'box',
              # color=color.rgba(188, 143, 143, 255), # Brownish - texture overrides
              scale=1.0, # Adjust based on model size
              position=position,
              speed=3,
              health=50,
              name='Deer',
              loot={'raw_meat': (2, 4), 'leather': (1, 3), 'fat': (1, 2)},
              wander_range=25 # Deer might roam further
         )

# --- Water Source ---
class WaterSource(Entity):
    def __init__(self, position=(0,0,0), scale=(10, 0.1, 10)):
         water_tex = 'textures/water.png' # Need texture file or use color
         super().__init__(
              model='plane',
              texture=water_tex if os.path.exists(water_tex) else 'white_cube',
              collider=None, # Don't collide with water surface itself
              scale=scale,
              position=position,
              color=color.blue if not os.path.exists(water_tex) else color.white, # Apply color only if no texture
              name='Water'
         )
         # Use a trigger collider slightly below surface for detection via raycast or collision events
         # This trigger allows detection even if the visual plane has no collider
         self.trigger = Entity(model='box', scale=scale, collider='box', position=position - Vec3(0, 0.2, 0), visible=False, tags={'water'})
         self.tags.add('water_surface') # Tag the visual surface too if needed


# --- UI Elements ---
class InventoryPanel(WindowPanel):
    def __init__(self, **kwargs):
        super().__init__(
            title='Inventory',
            content=[], # We'll add items dynamically
            scale=0.4,
            origin=(-0.5, 0.5),
            position=(-0.85, 0.45), # Adjusted position (closer to top-left)
            enabled=False, # Start hidden
            popup=True, # Close with Escape
            **kwargs
        )
        self.item_buttons = {} # Store buttons mapped to item names for potential interaction

    def on_enable(self):
        super().on_enable() # Call parent method if needed
        mouse.locked = False # Unlock mouse when inventory opens
        self.update_display()

    def on_disable(self):
        super().on_disable()
        # Only lock mouse if other UI isn't open and game isn't paused
        if not crafting_panel.enabled and not application.paused:
            mouse.locked = True

    def update_display(self):
        # Clear existing content (buttons)
        for item_name, button in self.item_buttons.items():
            destroy(button)
        self.item_buttons.clear()
        # self.content = [] # Clear panel content reference (WindowPanel handles this)

        y_offset = -0.05 # Start position for first button
        x_pos = -0.45
        button_height = 0.08
        spacing = 0.01

        # Display inventory items as buttons
        for item_name, count in sorted(player.inventory.items()): # Sort for consistent order
             btn = Button(
                 parent=self.panel, # Parent to the panel part of WindowPanel
                 text=f"{item_name}: {count}",
                 scale=(0.9, button_height),
                 origin=(-0.5, 0.5),
                 position=(x_pos, y_offset),
                 tooltip=Tooltip(f"Click to use?\nShift+Click to move to Quickbar") # Placeholder tooltip
             )
             # Assign function to button click
             # Need a way to know if Shift is held during the click - requires tracking held_keys
             btn.on_click = Func(self.item_clicked, item_name)
             self.item_buttons[item_name] = btn
             y_offset -= (button_height + spacing)

        # Adjust panel height based on content (basic approximation)
        content_height = abs(y_offset) + 0.1 # Add some padding
        self.panel.scale_y = max(0.2, content_height) # Ensure minimum size


    def item_clicked(self, item_name):
         print(f"Clicked item: {item_name}")
         # Check if Shift is held
         if held_keys['left shift'] or held_keys['right shift']:
             print(f"Shift+Click on {item_name} - Moving to Quick Bar...")
             # Find first empty quick bar slot
             try:
                 empty_slot_index = player.quick_bar.index(None)
                 # Check if item is already on quick bar
                 if item_name in player.quick_bar:
                      print(f"{item_name} is already on the quick bar.")
                      # Optional: maybe swap positions? Too complex for now.
                      return

                 # Remove 1 from inventory (or all if non-stackable like tools?)
                 # For simplicity, assume we move the "concept" not a specific quantity here
                 # The quick bar just references the item type. Quantity is in inventory.
                 # No need to remove from inventory when adding to quickbar reference.

                 player.quick_bar[empty_slot_index] = item_name
                 player.update_quick_bar_ui() # Update the visual quick bar

                 # Optional: Update inventory display if needed (maybe not, item still exists)
                 # self.update_display()

             except ValueError:
                 print("Quick bar is full!")
         else:
             # Regular click - Placeholder for "Use Item" logic
             print(f"Used {item_name} (placeholder action)")
             # Example: if item_name == 'cooked_meat': player.eat('cooked_meat')
             # Example: if item_name == 'canteen' and player.thirst < 100: player.drink()


    def toggle(self):
         # Use enabled property setter which handles on_enable/on_disable
         self.enabled = not self.enabled


class QuickBarUI(Entity):
    def __init__(self, num_slots=9):
        super().__init__(parent=camera.ui, scale=0.07)
        self.num_slots = num_slots
        self.slots = []
        slot_size = 1.0 # Relative size within QuickBarUI entity's scale
        total_width = num_slots * slot_size
        start_x = -total_width / 2.0 + slot_size / 2.0

        slot_texture = 'textures/ui_slot.png' # Need UI texture

        for i in range(num_slots):
            slot = Button(
                parent=self,
                model='quad',
                texture=slot_texture if os.path.exists(slot_texture) else 'white_cube',
                color=color.dark_gray, # Base color, selection overrides
                highlight_color=color.gray, # Hover color
                pressed_color=color.light_gray, # Click color
                scale=slot_size * 0.95, # Slightly smaller than spacing allows for gaps
                origin=(0, 0),
                position=(start_x + i * slot_size, -7.0), # Position near bottom center (-7 Y is lower)
                text="", # Item name/icon later
                text_origin=(0,0),
                text_color=color.black,
                text_scale= 0.8 / (len(str(i+1))) # Adjust text size slightly based on number
            )
            # Add number label to slot
            Text(text=str(i+1), parent=slot, origin=(0.5, -0.5), position=(0.45, -0.4), scale=4)

            # Make buttons potentially clickable to select slot
            slot.on_click = Func(self.slot_clicked, i)
            self.slots.append(slot)

    def slot_clicked(self, index):
         # If player clicks a slot, select it
         print(f"Clicked quick slot {index+1}")
         player.quick_bar_selection = index
         player.update_equipped_item()
         player.update_quick_bar_ui() # Update visual selection


class CraftingPanel(WindowPanel):
    def __init__(self, **kwargs):
         super().__init__(
             title='Crafting',
             content=[],
             scale=0.35,
             origin=(0.5, 0.5),
             position=(window.top_right.x -0.05, window.top_right.y - 0.05), # Adjust position slightly
             enabled=False,
             popup=True,
            **kwargs
         )
         self.craft_buttons = {} # Dict to store buttons {item_name: button_entity}

    def on_enable(self):
        super().on_enable()
        mouse.locked = False
        self.update_recipes()

    def on_disable(self):
        super().on_disable()
        if not inventory_panel.enabled and not application.paused:
            mouse.locked = True

    def update_recipes(self):
         # Clear old buttons
         for btn in self.craft_buttons.values():
             destroy(btn)
         self.craft_buttons.clear()

         y_offset = -0.05
         button_height = 0.10
         spacing = 0.015

         # Display craftable items
         for item_name, data in sorted(ITEMS.items()):
             if data.get('recipe'): # Use .get for safety
                 # Check if player has enough resources
                 can_craft = True
                 tooltip_text = f"Craft {item_name}\nRequires: "
                 recipe_parts = []
                 for resource, required_count in data['recipe'].items():
                      # Check inventory AND quick bar resources (Pooling)
                      inv_count = player.inventory.get(resource, 0)
                      # Count how many times it appears in quick bar (simplistic - assumes 1 per slot counts)
                      # qb_count = player.quick_bar.count(resource) # This is wrong, quickbar is just reference
                      # Correct pooling: just check inventory total
                      have_count = inv_count # Total available is just inventory count

                      recipe_parts.append(f"{required_count} {resource} (Have: {have_count})")
                      if have_count < required_count:
                          can_craft = False
                 tooltip_text += "\n".join(recipe_parts)


                 # Create Button text (shorter)
                 btn_text = f"{item_name}" # Just the name on the button

                 btn = Button(
                     parent=self.panel,
                     scale=(0.9, button_height),
                     origin=(-0.5, 0.5),
                     position=(-0.45, y_offset),
                     text=btn_text,
                     tooltip=Tooltip(tooltip_text, scale=0.8), # Set detailed tooltip
                     on_click=Func(self.try_craft, item_name),
                     disabled=not can_craft # Disable button if resources not available
                 )
                 self.craft_buttons[item_name] = btn
                 y_offset -= (button_height + spacing)

         # Adjust panel height
         content_height = abs(y_offset) + 0.1
         self.panel.scale_y = max(0.2, content_height)


    def try_craft(self, item_name):
         print(f"Attempting to craft: {item_name}")
         recipe = ITEMS[item_name]['recipe']
         can_craft = True
         resources_to_remove = {}

         # Double-check resources just before crafting
         for resource, required_count in recipe.items():
             if player.inventory.get(resource, 0) < required_count:
                 print(f"Need {required_count} {resource}, have {player.inventory.get(resource, 0)}")
                 can_craft = False
                 break
             else:
                  resources_to_remove[resource] = required_count

         if can_craft:
             print("Crafting...")
             # Deduct resources
             for resource, required_count in resources_to_remove.items():
                 player.remove_item(resource, required_count) # remove_item handles inventory/UI updates

             # Add crafted item
             player.add_item(item_name) # add_item handles placing in inventory/quickbar

             # Update crafting panel again to reflect new resource counts
             self.update_recipes()
             # If inventory was open, update it too
             if inventory_panel.enabled: inventory_panel.update_display()

         else:
             print("Not enough resources! (Crafting check failed)")


    def toggle(self):
         self.enabled = not self.enabled


# --- Game Setup ---
# Check for asset folders
if not os.path.exists('models'): os.makedirs('models')
if not os.path.exists('textures'): os.makedirs('textures')
if not os.path.exists('sounds'): os.makedirs('sounds')
# You would place your .obj, .png, .wav files in these folders

app = Ursina(title='Python Survival Game', borderless=False, fullscreen=False, development_mode=True)

# Lighting and Sky
Sky()
AmbientLight(color=color.rgba(100, 100, 100, 255))
DirectionalLight(parent=pivot, y=5, z=3, shadows=True, rotation=(30, -45, 0))

# Ground - Use a texture file if available
ground_texture_path = 'textures/grass_ground.png'
ground = Entity(model='plane', scale=100,
                texture=ground_texture_path if os.path.exists(ground_texture_path) else 'grass',
                collider='mesh')


# Player - Ensure collider matches height adjustments
# Use a capsule collider for potentially better movement over small obstacles
player = SurvivalPlayer(
    model='cube', # Player model is usually invisible in FPS
    collider='box', # Or 'capsule'. BoxCollider: Vec3(width, height, depth)
    # For BoxCollider, set scale here if needed, center adjusted in __init__
    # scale=(0.8, PLAYER_HEIGHT, 0.8), # Example scale for box collider
    # For CapsuleCollider: (height, radius)
    # collider = 'capsule', capsule_collider = {'height': PLAYER_HEIGHT, 'radius': 0.4},
    origin_y = -0.5, # Set origin to bottom for easier positioning
    color = color.blue, # Visible for debugging, set alpha to 0 for game
    visible = False # Hide player model cube
    )
player.position = (0, player.base_height / 2 + 0.1, 0) # Start slightly above ground based on collider height


# --- World Generation ---
world_size = 40 # Half-size of the world area to spawn things in
num_entities = 150 # Total attempts to spawn things

# Store grid cell occupation to prevent too much overlap, very basic
occupied_cells = set()
cell_size = 5 # Size of grid cells for overlap check

print("Generating world...")
for _ in range(num_entities):
    x = random.uniform(-world_size, world_size)
    z = random.uniform(-world_size, world_size)

    # Basic overlap check
    grid_x, grid_z = int(x // cell_size), int(z // cell_size)
    if (grid_x, grid_z) in occupied_cells and random.random() < 0.7: # 70% chance to skip if cell occupied
         continue

    # Raycast down to find actual terrain height (important if using non-flat ground)
    hit_info = raycast(Vec3(x, 50, z), Vec3(0, -1, 0), distance=100, ignore=[player,], traverse_target=ground)
    if hit_info.hit and hit_info.entity == ground:
        terrain_y = hit_info.world_point.y
    else:
        terrain_y = 0 # Fallback to 0 if raycast fails or hits something else

    # Choose entity type based on probabilities
    rand_val = random.random()
    entity_type = 'none'

    if rand_val < 0.30: entity_type = 'tree'        # 30% Tree
    elif rand_val < 0.45: entity_type = 'rock'       # 15% Rock
    elif rand_val < 0.70: entity_type = 'grass'      # 25% Grass
    elif rand_val < 0.75: entity_type = 'scrap'      # 5% Scrap
    elif rand_val < 0.80: entity_type = 'barrel'     # 5% Barrel
    elif rand_val < 0.85: entity_type = 'building'   # 5% Building
    elif rand_val < 0.95: entity_type = 'animal'     # 10% Animal
    elif rand_val < 1.00: entity_type = 'water'      # 5% Water


    # Instantiate based on type
    spawn_pos = Vec3(x, terrain_y, z)
    if entity_type == 'tree':
        Tree(position=spawn_pos)
        occupied_cells.add((grid_x, grid_z))
    elif entity_type == 'rock':
        Rock(position=spawn_pos + Vec3(0, 0.1, 0)) # Slightly above ground
        occupied_cells.add((grid_x, grid_z))
    elif entity_type == 'grass':
        # Grass doesn't usually occupy cells in the same way
        TallGrass(position=spawn_pos + Vec3(0, 0.1, 0))
    elif entity_type == 'scrap':
        ScrapPile(position=spawn_pos + Vec3(0, 0.2, 0))
        occupied_cells.add((grid_x, grid_z))
    elif entity_type == 'barrel':
         Barrel(position=spawn_pos + Vec3(0, 0.6, 0)) # Barrels stand up
         occupied_cells.add((grid_x, grid_z))
    elif entity_type == 'building':
         # Add more robust overlap check for buildings?
         Building(position=spawn_pos)
         # Mark multiple cells as occupied by building
         for dx in range(-int(Building().size[0]/cell_size)//2, int(Building().size[0]/cell_size)//2 + 1):
              for dz in range(-int(Building().size[2]/cell_size)//2, int(Building().size[2]/cell_size)//2 + 1):
                  occupied_cells.add((grid_x + dx, grid_z + dz))
    elif entity_type == 'animal':
         Deer(position=spawn_pos + Vec3(0, 0.5, 0)) # Start slightly above ground
         # Animals move, so cell occupation is temporary logic here
    elif entity_type == 'water':
          water_size = random.uniform(5, 15)
          WaterSource(position=spawn_pos - Vec3(0, 0.1, 0), scale=water_size) # Slightly below ground
          # Mark water cells? Depends on if you want things spawning in water
          # occupied_cells.add((grid_x, grid_z))

print("World generation complete.")


# --- UI Instantiation ---
# Instantiate AFTER player exists, so UI can potentially reference player
inventory_panel = InventoryPanel()
quick_bar_ui = QuickBarUI() # Now 'quick_bar_ui' exists globally
crafting_panel = CraftingPanel()
# pause_menu = Panel(enabled=False) # Placeholder for pause menu

# --- Final Setup Steps ---
# Initial UI Update for Quick Bar (NOW it's safe to call)
player.update_quick_bar_ui()

# --- Placeholder Functions (To be tied to game actions) ---
# These would likely be methods within a Campfire class or similar
def start_cooking(item_name, campfire_entity):
    if item_name == 'raw_meat' and player.remove_item('raw_meat'): # Check and remove item first
        print(f"Starting to cook meat on {campfire_entity.name}...")
        # Need a timer system associated with the specific campfire instance
        # campfire_entity.start_timer(finish_cooking, item_name, 30) # Campfire manages its own timer
        # Using invoke for simplicity here, but doesn't tie to specific campfire easily
        invoke(finish_cooking, item_name, campfire_entity, delay=30)
    else:
        print("Need raw meat to cook.")

def finish_cooking(item_name, campfire_entity):
    print(f"Meat finished cooking on {campfire_entity.name}!")
    # Logic to add cooked meat to player inv or maybe campfire storage?
    player.add_item('cooked_meat')

def start_boiling(canteen_data, campfire_entity): # Pass the canteen object/data if complex
     # Assuming canteen is just the item name for now, player holds one
     # TODO: Need proper Canteen state management in player inventory
     # if player.inventory['canteen']['water_level'] > 0 and not player.inventory['canteen']['is_boiled']:
     if player.inventory.get('canteen'): # Basic check if player has a canteen
          print(f"Starting to boil water on {campfire_entity.name}...")
          # Need to track which canteen is boiling if player can have multiple
          invoke(finish_boiling, canteen_data, campfire_entity, delay=20) # Example boil time
     else:
          print("Need a canteen with unboiled water.")

def finish_boiling(canteen_data, campfire_entity):
     print(f"Water finished boiling on {campfire_entity.name}!")
     # TODO: Update the state of the specific canteen in player inventory
     # player.inventory['canteen']['is_boiled'] = True
     print("DEBUG: Canteen boiling state update needed.")


# --- Start the game ---
print("Starting game loop...")
# Mouse settings
mouse.locked = True # Lock mouse to center for FPS control
mouse.visible = False

app.run()
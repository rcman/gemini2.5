import pygame as pg
import numpy as np
import sys
from OpenGL.GL import *
from OpenGL.GLU import *
from pygame.locals import *
import random
import math
import time

# Initialize pygame
pg.init()

# Game constants
SCREEN_WIDTH = 1024
SCREEN_HEIGHT = 768
FPS = 60
FOV = 90
NEAR_CLIP = 0.1
FAR_CLIP = 1000.0
PLAYER_HEIGHT = 1.8
PLAYER_SPEED = 0.1
MOUSE_SENSITIVITY = 0.2

# Game state variables
player_pos = [0, PLAYER_HEIGHT, 0]
player_rot = [0, 0]  # [horizontal, vertical] rotation in degrees
player_inventory = {
    "axe": 1,
    "pick-axe": 1,
    "knife": 1,
    "canteen": 1,
    "water": 0,
    "wood": 0,
    "stone": 0,
    "rope": 0,
    "scrap_metal": 0,
    "nails": 0,
    "meat": 0,
    "leather": 0,
    "fat": 0,
    "cooked_meat": 0,
    "purified_water": 0
}
player_health = 100
player_hunger = 100
player_thirst = 100
player_stamina = 100
player_quick_bar = ["axe", "pick-axe", "knife", "canteen", None, None, None, None]
selected_slot = 0
show_inventory = False
crafting_menu_open = False
cooking_items = {}  # {item_id: end_time}
player_near_campfire = False

# Game objects
class GameObject:
    def __init__(self, position, model, size=1.0, collide=False, interactable=False, obj_type=None):
        self.position = np.array(position)
        self.model = model
        self.size = size
        self.collide = collide
        self.interactable = interactable
        self.type = obj_type
        self.contents = {}  # For searchable containers
        
        # If searchable, add random loot
        if self.type in ["barrel", "container"]:
            self.generate_loot()
            
    def generate_loot(self):
        # Potential loot with chances
        possible_loot = {
            "wood": 0.3,
            "stone": 0.2,
            "rope": 0.15,
            "scrap_metal": 0.25,
            "nails": 0.2,
            "meat": 0.1,
            "water": 0.25
        }
        
        # Generate 1-3 items
        num_items = random.randint(1, 3)
        for _ in range(num_items):
            item = random.choice(list(possible_loot.keys()))
            chance = possible_loot[item]
            if random.random() < chance:
                amount = random.randint(1, 5)
                if item in self.contents:
                    self.contents[item] += amount
                else:
                    self.contents[item] = amount
    
    def draw(self):
        # Simple placeholder for drawing objects
        glPushMatrix()
        glTranslatef(self.position[0], self.position[1], self.position[2])
        glScalef(self.size, self.size, self.size)
        
        # Different colors for different object types
        if self.type == "tree":
            glColor3f(0.0, 0.5, 0.0)  # Green
        elif self.type == "rock":
            glColor3f(0.5, 0.5, 0.5)  # Gray
        elif self.type == "water":
            glColor3f(0.0, 0.0, 0.7)  # Blue
        elif self.type == "grass":
            glColor3f(0.0, 0.7, 0.0)  # Light green
        elif self.type == "animal":
            glColor3f(0.8, 0.4, 0.0)  # Brown
        elif self.type == "metal":
            glColor3f(0.6, 0.6, 0.7)  # Metal color
        elif self.type == "barrel":
            glColor3f(0.5, 0.3, 0.0)  # Brown
        elif self.type == "building":
            glColor3f(0.7, 0.7, 0.7)  # Light gray
        elif self.type == "container":
            glColor3f(0.6, 0.4, 0.2)  # Wooden box color
        elif self.type == "campfire":
            glColor3f(0.8, 0.2, 0.0)  # Orange-red
        elif self.type == "crafting_table":
            glColor3f(0.6, 0.3, 0.0)  # Dark wood
        elif self.type == "forge":
            glColor3f(0.4, 0.4, 0.4)  # Dark gray
        else:
            glColor3f(1.0, 1.0, 1.0)  # White default
        
        # Draw simple cube for now - would be replaced with proper models
        glBegin(GL_QUADS)
        
        # Front face
        glVertex3f(-1.0, -1.0, 1.0)
        glVertex3f(1.0, -1.0, 1.0)
        glVertex3f(1.0, 1.0, 1.0)
        glVertex3f(-1.0, 1.0, 1.0)
        
        # Back face
        glVertex3f(-1.0, -1.0, -1.0)
        glVertex3f(-1.0, 1.0, -1.0)
        glVertex3f(1.0, 1.0, -1.0)
        glVertex3f(1.0, -1.0, -1.0)
        
        # Left face
        glVertex3f(-1.0, -1.0, -1.0)
        glVertex3f(-1.0, -1.0, 1.0)
        glVertex3f(-1.0, 1.0, 1.0)
        glVertex3f(-1.0, 1.0, -1.0)
        
        # Right face
        glVertex3f(1.0, -1.0, -1.0)
        glVertex3f(1.0, 1.0, -1.0)
        glVertex3f(1.0, 1.0, 1.0)
        glVertex3f(1.0, -1.0, 1.0)
        
        # Top face
        glVertex3f(-1.0, 1.0, -1.0)
        glVertex3f(-1.0, 1.0, 1.0)
        glVertex3f(1.0, 1.0, 1.0)
        glVertex3f(1.0, 1.0, -1.0)
        
        # Bottom face
        glVertex3f(-1.0, -1.0, -1.0)
        glVertex3f(1.0, -1.0, -1.0)
        glVertex3f(1.0, -1.0, 1.0)
        glVertex3f(-1.0, -1.0, 1.0)
        
        glEnd()
        glPopMatrix()

# Animal class that extends GameObject
class Animal(GameObject):
    def __init__(self, position, model, size=1.0, animal_type="deer"):
        super().__init__(position, model, size, True, True, "animal")
        self.animal_type = animal_type
        self.speed = random.uniform(0.01, 0.05)
        self.direction = np.array([random.uniform(-1, 1), 0, random.uniform(-1, 1)])
        self.direction = self.direction / np.linalg.norm(self.direction)
        self.last_direction_change = time.time()
    
    def update(self, game_objects):
        # Change direction randomly
        if time.time() - self.last_direction_change > random.uniform(3, 10):
            self.direction = np.array([random.uniform(-1, 1), 0, random.uniform(-1, 1)])
            self.direction = self.direction / np.linalg.norm(self.direction)
            self.last_direction_change = time.time()
        
        # Move in the current direction
        new_pos = self.position + self.direction * self.speed
        
        # Check for collisions
        can_move = True
        for obj in game_objects:
            if obj != self and obj.collide:
                distance = np.linalg.norm(new_pos - obj.position)
                if distance < (self.size + obj.size) * 0.8:
                    can_move = False
                    break
        
        if can_move:
            self.position = new_pos
        else:
            # If collision detected, change direction
            self.direction = -self.direction
            self.last_direction_change = time.time()

# Crafting recipes
crafting_recipes = {
    "axe": {"wood": 3, "stone": 2},
    "pick-axe": {"wood": 3, "stone": 3},
    "campfire": {"wood": 5, "stone": 3},
    "crafting_table": {"wood": 10},
    "forge": {"stone": 10, "scrap_metal": 5},
    "rope": {"grass": 5}
}

# Create game world
def generate_world():
    objects = []
    
    # Add trees
    for _ in range(50):
        pos = [random.uniform(-50, 50), 0, random.uniform(-50, 50)]
        objects.append(GameObject(pos, None, 2.0, True, True, "tree"))
    
    # Add rocks
    for _ in range(30):
        pos = [random.uniform(-50, 50), 0, random.uniform(-50, 50)]
        objects.append(GameObject(pos, None, 1.0, True, True, "rock"))
    
    # Add water areas
    for _ in range(5):
        pos = [random.uniform(-50, 50), -0.5, random.uniform(-50, 50)]
        objects.append(GameObject(pos, None, 5.0, False, True, "water"))
    
    # Add tall grass
    for _ in range(100):
        pos = [random.uniform(-50, 50), 0.5, random.uniform(-50, 50)]
        objects.append(GameObject(pos, None, 0.5, False, True, "grass"))
    
    # Add scrap metal
    for _ in range(20):
        pos = [random.uniform(-50, 50), 0.2, random.uniform(-50, 50)]
        objects.append(GameObject(pos, None, 0.5, False, True, "metal"))
    
    # Add nails
    for _ in range(25):
        pos = [random.uniform(-50, 50), 0.1, random.uniform(-50, 50)]
        objects.append(GameObject(pos, None, 0.2, False, True, "nails"))
    
    # Add barrels
    for _ in range(15):
        pos = [random.uniform(-50, 50), 0.5, random.uniform(-50, 50)]
        objects.append(GameObject(pos, None, 1.0, True, True, "barrel"))
    
    # Add animals (deer)
    for _ in range(10):
        pos = [random.uniform(-50, 50), 0.5, random.uniform(-50, 50)]
        objects.append(Animal(pos, None, 1.0, "deer"))
    
    # Add simple buildings with containers
    for _ in range(5):
        building_pos = [random.uniform(-50, 50), 0, random.uniform(-50, 50)]
        building = GameObject(building_pos, None, 5.0, True, False, "building")
        objects.append(building)
        
        # Add containers inside buildings
        for _ in range(random.randint(1, 3)):
            container_pos = [
                building_pos[0] + random.uniform(-3, 3),
                0.5,
                building_pos[2] + random.uniform(-3, 3)
            ]
            objects.append(GameObject(container_pos, None, 0.8, False, True, "container"))
    
    return objects

# Game objects
game_objects = generate_world()
        
# Set up the display
screen = pg.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT), DOUBLEBUF | OPENGL)
pg.display.set_caption("3D Survival Game")
clock = pg.time.Clock()

# Set up OpenGL
glViewport(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT)
glMatrixMode(GL_PROJECTION)
glLoadIdentity()
gluPerspective(FOV, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR_CLIP, FAR_CLIP)
glMatrixMode(GL_MODELVIEW)
glEnable(GL_DEPTH_TEST)

# Hide mouse and center it
pg.mouse.set_visible(False)
pg.event.set_grab(True)

# UI rendering functions
def render_text(text, position, size=30, color=(255, 255, 255)):
    font = pg.font.Font(None, size)
    text_surface = font.render(text, True, color)
    screen.blit(text_surface, position)

def draw_ui():
    # Switch to 2D mode for UI
    glMatrixMode(GL_PROJECTION)
    glPushMatrix()
    glLoadIdentity()
    glOrtho(0, SCREEN_WIDTH, SCREEN_HEIGHT, 0, -1, 1)
    glMatrixMode(GL_MODELVIEW)
    glPushMatrix()
    glLoadIdentity()
    glDisable(GL_DEPTH_TEST)
    
    # Draw 2D elements with Pygame on top of the 3D scene
    # We need to temporarily stop using OpenGL to draw with Pygame
    pg.display.flip()
    
    # Draw crosshair
    pg.draw.line(screen, (255, 255, 255), (SCREEN_WIDTH//2-10, SCREEN_HEIGHT//2), (SCREEN_WIDTH//2+10, SCREEN_HEIGHT//2), 2)
    pg.draw.line(screen, (255, 255, 255), (SCREEN_WIDTH//2, SCREEN_HEIGHT//2-10), (SCREEN_WIDTH//2, SCREEN_HEIGHT//2+10), 2)
    
    # Draw quick bar
    quick_bar_width = 400
    quick_bar_height = 50
    quick_bar_x = (SCREEN_WIDTH - quick_bar_width) // 2
    quick_bar_y = SCREEN_HEIGHT - quick_bar_height - 10
    
    # Draw slots
    for i in range(len(player_quick_bar)):
        slot_width = quick_bar_width // len(player_quick_bar)
        slot_x = quick_bar_x + i * slot_width
        
        # Draw selected slot with highlight
        if i == selected_slot:
            pg.draw.rect(screen, (200, 200, 100), (slot_x, quick_bar_y, slot_width, quick_bar_height), 2)
        else:
            pg.draw.rect(screen, (150, 150, 150), (slot_x, quick_bar_y, slot_width, quick_bar_height), 1)
        
        # Draw item name
        if player_quick_bar[i]:
            render_text(player_quick_bar[i], (slot_x + 5, quick_bar_y + 15))
    
    # Draw health, hunger, thirst, stamina bars
    bar_width = 150
    bar_height = 15
    bar_x = 20
    bar_y = 20
    
    # Health bar (red)
    pg.draw.rect(screen, (100, 0, 0), (bar_x, bar_y, bar_width, bar_height))
    pg.draw.rect(screen, (255, 0, 0), (bar_x, bar_y, bar_width * player_health / 100, bar_height))
    render_text("Health", (bar_x + 5, bar_y))
    
    # Hunger bar (orange)
    bar_y += bar_height + 5
    pg.draw.rect(screen, (100, 50, 0), (bar_x, bar_y, bar_width, bar_height))
    pg.draw.rect(screen, (255, 150, 0), (bar_x, bar_y, bar_width * player_hunger / 100, bar_height))
    render_text("Hunger", (bar_x + 5, bar_y))
    
    # Thirst bar (blue)
    bar_y += bar_height + 5
    pg.draw.rect(screen, (0, 0, 100), (bar_x, bar_y, bar_width, bar_height))
    pg.draw.rect(screen, (0, 0, 255), (bar_x, bar_y, bar_width * player_thirst / 100, bar_height))
    render_text("Thirst", (bar_x + 5, bar_y))
    
    # Stamina bar (green)
    bar_y += bar_height + 5
    pg.draw.rect(screen, (0, 100, 0), (bar_x, bar_y, bar_width, bar_height))
    pg.draw.rect(screen, (0, 255, 0), (bar_x, bar_y, bar_width * player_stamina / 100, bar_height))
    render_text("Stamina", (bar_x + 5, bar_y))
    
    # Show interaction prompt if player is near an interactable object
    for obj in game_objects:
        if obj.interactable:
            distance = np.linalg.norm(np.array(player_pos) - obj.position)
            if distance < obj.size + 2:  # Within interaction range
                prompt = f"Press E to interact with {obj.type}"
                render_text(prompt, (SCREEN_WIDTH//2 - 100, SCREEN_HEIGHT//2 + 50))
                break
    
    # Draw inventory if open
    if show_inventory:
        draw_inventory()
    
    # Draw crafting menu if open
    if crafting_menu_open:
        draw_crafting_menu()
    
    # Draw cooking status if items are cooking
    if cooking_items and player_near_campfire:
        cooking_y = 200
        render_text("Cooking:", (SCREEN_WIDTH - 200, cooking_y))
        cooking_y += 30
        
        for item, end_time in list(cooking_items.items()):
            remaining = end_time - time.time()
            if remaining <= 0:
                # Cooking finished
                if item == "meat":
                    player_inventory["cooked_meat"] = player_inventory.get("cooked_meat", 0) + 1
                elif item == "water":
                    player_inventory["purified_water"] = player_inventory.get("purified_water", 0) + 1
                
                cooking_items.pop(item)
            else:
                progress = (30 - remaining) / 30 * 100  # 30 seconds cooking time
                pg.draw.rect(screen, (50, 50, 50), (SCREEN_WIDTH - 200, cooking_y, 150, 20))
                pg.draw.rect(screen, (200, 100, 0), (SCREEN_WIDTH - 200, cooking_y, 150 * progress / 100, 20))
                render_text(f"{item}: {int(remaining)}s", (SCREEN_WIDTH - 190, cooking_y))
                cooking_y += 25
    
    # Switch back to 3D mode
    glEnable(GL_DEPTH_TEST)
    glMatrixMode(GL_PROJECTION)
    glPopMatrix()
    glMatrixMode(GL_MODELVIEW)
    glPopMatrix()

def draw_inventory():
    # Draw inventory background
    inventory_width = 600
    inventory_height = 400
    inventory_x = (SCREEN_WIDTH - inventory_width) // 2
    inventory_y = (SCREEN_HEIGHT - inventory_height) // 2
    
    pg.draw.rect(screen, (50, 50, 50, 200), (inventory_x, inventory_y, inventory_width, inventory_height))
    pg.draw.rect(screen, (200, 200, 200), (inventory_x, inventory_y, inventory_width, inventory_height), 2)
    
    render_text("Inventory (Press TAB to close)", (inventory_x + 10, inventory_y + 10), 30, (255, 255, 255))
    render_text("Hold SHIFT + Left-click to move items between inventory and quick bar", 
               (inventory_x + 10, inventory_y + 40), 20, (200, 200, 200))
    
    # Draw inventory items
    item_y = inventory_y + 80
    col = 0
    for item, amount in sorted(player_inventory.items()):
        if amount > 0:  # Only show items we have
            item_x = inventory_x + 20 + col * 200
            
            pg.draw.rect(screen, (70, 70, 70), (item_x, item_y, 180, 30))
            render_text(f"{item}: {amount}", (item_x + 10, item_y + 5), 25)
            
            col = (col + 1) % 3
            if col == 0:
                item_y += 40

def draw_crafting_menu():
    # Draw crafting menu background
    menu_width = 500
    menu_height = 500
    menu_x = (SCREEN_WIDTH - menu_width) // 2
    menu_y = (SCREEN_HEIGHT - menu_height) // 2
    
    pg.draw.rect(screen, (50, 50, 60, 200), (menu_x, menu_y, menu_width, menu_height))
    pg.draw.rect(screen, (180, 180, 200), (menu_x, menu_y, menu_width, menu_height), 2)
    
    render_text("Crafting Menu (Press C to close)", (menu_x + 10, menu_y + 10), 30, (255, 255, 255))
    
    # Draw craftable items
    item_y = menu_y + 60
    for item, requirements in crafting_recipes.items():
        # Check if player has the required materials
        can_craft = True
        for req_item, req_amount in requirements.items():
            if player_inventory.get(req_item, 0) < req_amount:
                can_craft = False
                break
        
        # Show the item with its requirements
        color = (255, 255, 255) if can_craft else (150, 150, 150)
        render_text(f"{item}:", (menu_x + 20, item_y), 25, color)
        
        # List requirements
        req_y = item_y + 30
        for req_item, req_amount in requirements.items():
            current_amount = player_inventory.get(req_item, 0)
            req_color = (255, 255, 255) if current_amount >= req_amount else (255, 100, 100)
            render_text(f"- {req_item}: {current_amount}/{req_amount}", (menu_x + 40, req_y), 20, req_color)
            req_y += 25
        
        # Draw craft button if can craft
        if can_craft:
            button_x = menu_x + menu_width - 100
            button_y = item_y
            pg.draw.rect(screen, (100, 150, 100), (button_x, button_y, 80, 30))
            render_text("Craft", (button_x + 20, button_y + 5), 25)
            
            # Check if the button is clicked
            mouse_pos = pg.mouse.get_pos()
            if pg.mouse.get_pressed()[0] and button_x <= mouse_pos[0] <= button_x + 80 and button_y <= mouse_pos[1] <= button_y + 30:
                craft_item(item)
        
        item_y = req_y + 20

def craft_item(item):
    global player_inventory, player_quick_bar
    
    # Check if we have the required materials
    requirements = crafting_recipes[item]
    for req_item, req_amount in requirements.items():
        if player_inventory.get(req_item, 0) < req_amount:
            return False
    
    # Remove required materials
    for req_item, req_amount in requirements.items():
        player_inventory[req_item] -= req_amount
    
    # Add the crafted item
    if item in player_inventory:
        player_inventory[item] += 1
    else:
        player_inventory[item] = 1
    
    # Try to add to quick bar if there's space
    if None in player_quick_bar:
        empty_slot = player_quick_bar.index(None)
        player_quick_bar[empty_slot] = item
    
    return True

def interact_with_object(obj):
    global player_inventory, player_quick_bar, player_near_campfire
    
    if obj.type == "tree":
        # Check if player has an axe equipped
        if player_quick_bar[selected_slot] == "axe":
            player_inventory["wood"] = player_inventory.get("wood", 0) + random.randint(2, 5)
            # Trees would be removed or marked as harvested
    
    elif obj.type == "rock":
        # Check if player has a pick-axe equipped
        if player_quick_bar[selected_slot] == "pick-axe":
            player_inventory["stone"] = player_inventory.get("stone", 0) + random.randint(2, 4)
            # Rocks would be removed or marked as harvested
    
    elif obj.type == "grass":
        player_inventory["grass"] = player_inventory.get("grass", 0) + random.randint(1, 3)
        # Would remove the grass object
    
    elif obj.type == "metal":
        player_inventory["scrap_metal"] = player_inventory.get("scrap_metal", 0) + random.randint(1, 2)
        # Would remove the metal object
    
    elif obj.type == "nails":
        player_inventory["nails"] = player_inventory.get("nails", 0) + random.randint(1, 3)
        # Would remove the nails object
    
    elif obj.type == "water":
        # Check if player has a canteen equipped
        if player_quick_bar[selected_slot] == "canteen":
            player_inventory["water"] = player_inventory.get("water", 0) + 1
    
    elif obj.type == "animal":
        # Check if player has knife equipped
        if player_quick_bar[selected_slot] == "knife":
            player_inventory["meat"] = player_inventory.get("meat", 0) + random.randint(1, 3)
            player_inventory["leather"] = player_inventory.get("leather", 0) + random.randint(1, 2)
            player_inventory["fat"] = player_inventory.get("fat", 0) + random.randint(0, 2)
            # Would remove the animal object
    
    elif obj.type in ["barrel", "container"]:
        # Loot the container
        for item, amount in obj.contents.items():
            player_inventory[item] = player_inventory.get(item, 0) + amount
        obj.contents = {}  # Empty the container
    
    elif obj.type == "campfire":
        player_near_campfire = True
        
        # If player has meat or water and campfire is active, start cooking
        if player_quick_bar[selected_slot] == "meat" and player_inventory["meat"] > 0:
            cooking_items["meat"] = time.time() + 30  # 30 seconds cooking time
            player_inventory["meat"] -= 1
        
        elif player_quick_bar[selected_slot] == "canteen" and player_inventory["water"] > 0:
            cooking_items["water"] = time.time() + 30  # 30 seconds boiling time
            player_inventory["water"] -= 1

def update_game_state(dt):
    global player_hunger, player_thirst, player_health, player_stamina, player_near_campfire, player_pos
    
    # Gradually decrease player stats
    player_hunger -= 0.01 * dt
    player_thirst -= 0.02 * dt
    player_stamina = min(100, player_stamina + 0.05 * dt)  # Stamina regenerates
    
    # Clamp values
    player_hunger = max(0, min(100, player_hunger))
    player_thirst = max(0, min(100, player_thirst))
    player_health = max(0, min(100, player_health))
    player_stamina = max(0, min(100, player_stamina))
    
    # If hunger or thirst are too low, lose health
    if player_hunger < 10 or player_thirst < 10:
        player_health -= 0.05 * dt
    
    # Update animal movement
    for obj in game_objects:
        if isinstance(obj, Animal):
            obj.update(game_objects)
    
    # Reset campfire proximity for this frame
    player_near_campfire = False
    
    # Check if player is near a campfire
    for obj in game_objects:
        if obj.type == "campfire":
            distance = np.linalg.norm(np.array(player_pos) - obj.position)
            if distance < obj.size + 3:  # Within range of campfire
                player_near_campfire = True
                break

def handle_input(dt):
    global player_pos, player_rot, show_inventory, crafting_menu_open, selected_slot
    
    # Mouse input for camera rotation
    mouse_dx, mouse_dy = pg.mouse.get_rel()
    player_rot[0] += mouse_dx * MOUSE_SENSITIVITY * dt
    player_rot[1] += mouse_dy * MOUSE_SENSITIVITY * dt
    
    # Clamp vertical rotation to prevent flipping
    player_rot[1] = max(-90, min(90, player_rot[1]))
    
    # Calculate forward and right vectors
    forward_vector = np.array([
        np.sin(np.radians(player_rot[0])),
        0,
        np.cos(np.radians(player_rot[0]))
    ])
    
    right_vector = np.array([
        np.sin(np.radians(player_rot[0] + 90)),
        0,
        np.cos(np.radians(player_rot[0] + 90))
    ])
    
    # Movement
    keys = pg.key.get_pressed()
    
    movement_speed = PLAYER_SPEED * dt
    move_vector = np.zeros(3)
    
    if keys[K_w]:  # Forward
        move_vector += forward_vector * movement_speed
    if keys[K_s]:  # Backward
        move_vector -= forward_vector * movement_speed
    if keys[K_a]:  # Left
        move_vector -= right_vector * movement_speed
    if keys[K_d]:  # Right
        move_vector += right_vector * movement_speed
    
    # Check for sprint
    if keys[K_LSHIFT] and player_stamina > 10:
        move_vector *= 1.5
        player_stamina -= 0.1 * dt
    
    # Check for collision before moving
    new_pos = np.array(player_pos) + move_vector
    can_move = True
    
    for obj in game_objects:
        if obj.collide:
            distance = np.linalg.norm(new_pos[:] - obj.position)
            if distance < (obj.size + 0.5):  # 0.5 is player's "size"
                can_move = False
                break
    
    if can_move:
        player_pos = new_pos.tolist()
    
    # Toggle inventory
    for event in pg.event.get():
        if event.type == pg.QUIT:
            pg.quit()
            sys.exit()
        elif event.type == pg.KEYDOWN:
            if event.key == K_TAB:
                show_inventory = not show_inventory
                crafting_menu_open = False
            elif event.key == K_c:
                crafting_menu_open = not crafting_menu_open
                show_inventory = False
            elif event.key == K_e:
                # Interact with nearest object
                nearest_obj = None
                nearest_distance = float('inf')
                
                for obj in game_objects:
                    if obj.interactable:
                        distance = np.linalg.norm(np.array(player_pos) - obj.position)
                        if distance < obj.size + 2 and distance < nearest_distance:  # Within interaction range
                            nearest_obj = obj
                            nearest_distance = distance
                
                if nearest_obj:
                    interact_with_object(nearest_obj)
            elif event.key >= K_1 and event.key <= K_8:
                # Select quick bar slot
                selected_slot = event.key - K_1  # K_1 is 49, so 49-49=0, 50-49=1, etc.
        elif event.type == pg.MOUSEBUTTONDOWN:
            if event.button == 1 and show_inventory:  # Left click while inventory is open
                # Handle inventory clicks
                if pg.key.get_mods() & pg.KMOD_SHIFT:  # Shift is held
                    # Move items between inventory and quick bar
                    # This would need more complex UI handling to determine which item was clicked
                    pass

def main_game_loop():
    global player_pos, player_health, game_objects
    
    # Initialize game settings based on player choice
    initialize_game_settings()
    
    running = True
    last_time = time.time()
    
    while running:
        # Calculate delta time
        current_time = time.time()
        dt = (current_time - last_time) * 1000.0  # Convert to milliseconds
        last_time = current_time
        
        # Cap to 60 FPS
        if dt < 1000.0 / FPS:
            pg.time.wait(int(1000.0 / FPS - dt))
            dt = 1000.0 / FPS
        
        # Handle input
        handle_input(dt)
        
        # Update game state
        update_game_state(dt)
        
        # Check if player is dead
        if player_health <= 0:
            print("Game over! You died.")
            running = False
        
        # Render the scene
        render_scene()
        
        # Update display
        pg.display.flip()
        clock.tick(FPS)
    
    pg.quit()
    sys.exit()

def initialize_game_settings():
    global player_pos, player_inventory, PLAYER_SPEED, PLAYER_HEIGHT
    
    # In a real game, this would show a UI for the player to select settings
    # For this example, we'll use default values
    starting_resources = 0  # 0: None, 1: Some, 2: Plenty
    
    if starting_resources == 1:
        player_inventory.update({
            "wood": 10,
            "stone": 10,
            "water": 5
        })
    elif starting_resources == 2:
        player_inventory.update({
            "wood": 25,
            "stone": 25,
            "water": 10,
            "meat": 5,
            "rope": 3
        })
    
    # Adjust player speed and height
    # These would be adjustable by the player
    PLAYER_SPEED = 0.1
    PLAYER_HEIGHT = 1.8
    
    # Place player in a safe starting location
    player_pos = [0, PLAYER_HEIGHT, 0]

def render_scene():
    # Clear the screen
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()
    
    # Apply camera rotation
    glRotatef(-player_rot[1], 1, 0, 0)
    glRotatef(-player_rot[0], 0, 1, 0)
    
    # Apply camera translation
    glTranslatef(-player_pos[0], -player_pos[1], -player_pos[2])
    
    # Draw the ground (simple grid)
    draw_ground()
    
    # Draw all objects
    for obj in game_objects:
        obj.draw()
    
    # Draw UI elements
    draw_ui()

def draw_ground():
    # Draw a simple grid as the ground
    glBegin(GL_LINES)
    glColor3f(0.3, 0.3, 0.3)
    
    grid_size = 100
    grid_step = 5
    
    for i in range(-grid_size, grid_size + 1, grid_step):
        glVertex3f(i, 0, -grid_size)
        glVertex3f(i, 0, grid_size)
        glVertex3f(-grid_size, 0, i)
        glVertex3f(grid_size, 0, i)
    
    glEnd()
    
    # Draw ground plane
    glBegin(GL_QUADS)
    glColor3f(0.2, 0.5, 0.2)  # Green for grass
    glVertex3f(-grid_size, -0.01, -grid_size)
    glVertex3f(-grid_size, -0.01, grid_size)
    glVertex3f(grid_size, -0.01, grid_size)
    glVertex3f(grid_size, -0.01, -grid_size)
    glEnd()

if __name__ == "__main__":
    main_game_loop()
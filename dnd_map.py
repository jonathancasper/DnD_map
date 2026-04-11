import os
import eel
import json
import base64
import socket
import shutil
import webbrowser
import time
import signal
import sys
from datetime import datetime

def signal_handler(sig, frame):
    print("\nServer shutting down...")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())

LOCAL_ASSETS_DIR = 'local_assets'
PROFILES_DIR = os.path.join(LOCAL_ASSETS_DIR, 'profiles')
PROFILES_INDEX = os.path.join(PROFILES_DIR, 'profiles.json')

def ensure_profiles_dir():
    if not os.path.exists(PROFILES_DIR):
        os.makedirs(PROFILES_DIR)

def get_profiles_index():
    ensure_profiles_dir()
    if os.path.exists(PROFILES_INDEX):
        with open(PROFILES_INDEX, 'r') as f:
            return json.load(f)
    return {"profiles": []}

def save_profiles_index(data):
    ensure_profiles_dir()
    with open(PROFILES_INDEX, 'w') as f:
        json.dump(data, f, indent=2)

def get_profile_path(profile_name):
    ensure_profiles_dir()
    safe_name = profile_name.replace('/', '_').replace('\\', '_')
    return os.path.join(PROFILES_DIR, safe_name)

def create_profile_folder(profile_name):
    profile_path = get_profile_path(profile_name)
    if os.path.exists(profile_path):
        shutil.rmtree(profile_path)
    os.makedirs(profile_path)
    return profile_path

def get_profile_files(profile_name):
    profile_path = get_profile_path(profile_name)
    return {
        'map': os.path.join(profile_path, 'map.png'),
        'fog': os.path.join(profile_path, 'fog.png'),
        'tokens': os.path.join(profile_path, 'tokens.json'),
        'settings': os.path.join(profile_path, 'settings.json')
    }

eel.init('web')

if not os.path.exists('local_assets'):
    os.makedirs('local_assets')

MAP_FILE = os.path.join('local_assets', 'saved_map.png')
FOG_FILE = os.path.join('local_assets', 'saved_fog.png')
TOKENS_FILE = os.path.join('local_assets', 'tokens.json')
SETTING_FILE = os.path.join('local_assets', 'settings.json')

@eel.expose
def get_profiles():
    index = get_profiles_index()
    return index.get('profiles', [])

@eel.expose
def create_profile(name, map_data, map_filename):
    profile_path = create_profile_folder(name)
    files = get_profile_files(name)
    
    if map_data:
        header, encoded = map_data.split(",", 1)
        data = base64.b64decode(encoded)
        with open(files['map'], "wb") as f:
            f.write(data)
        with open(MAP_FILE, "wb") as f:
            f.write(data)
    
    with open(files['fog'], "wb") as f:
        pass
    
    with open(files['tokens'], 'w') as f:
        json.dump([], f)
    
    with open(files['settings'], 'w') as f:
        json.dump({}, f)
    
    index = get_profiles_index()
    profiles = index.get('profiles', [])
    profiles = [p for p in profiles if p['name'] != name]
    profiles.append({
        'name': name,
        'map_filename': map_filename,
        'last_modified': datetime.now().isoformat()
    })
    save_profiles_index({'profiles': profiles})
    
    eel.recieve_map(map_data)
    return True

@eel.expose
def load_profile(name):
    files = get_profile_files(name)
    
    map_data = None
    if os.path.exists(files['map']) and os.path.getsize(files['map']) > 0:
        with open(files['map'], "rb") as f:
            map_data = f.read()
        map_data = "data:image/png;base64," + base64.b64encode(map_data).decode()
        # Sync to root files for players
        with open(MAP_FILE, "wb") as f:
            f.write(base64.b64decode(map_data.split(",", 1)[1]))
    
    fog_data = None
    if os.path.exists(files['fog']) and os.path.getsize(files['fog']) > 0:
        with open(files['fog'], "rb") as f:
            fog_data = f.read()
        fog_data = "data:image/png;base64," + base64.b64encode(fog_data).decode()
        # Sync to root files for players
        with open(FOG_FILE, "wb") as f:
            f.write(base64.b64decode(fog_data.split(",", 1)[1]))
    else:
        # Fog is empty or doesn't exist - clear saved_fog.png so players get empty fog
        with open(FOG_FILE, "wb") as f:
            pass
    
    tokens_data = []
    if os.path.exists(files['tokens']):
        with open(files['tokens'], 'r') as f:
            tokens_data = json.load(f)
        # Sync to root files for players
        with open(TOKENS_FILE, 'w') as f:
            json.dump(tokens_data, f, indent=2)
    
    settings_data = {}
    if os.path.exists(files['settings']):
        with open(files['settings'], 'r') as f:
            settings_data = json.load(f)
        # Sync to root files for players
        with open(SETTING_FILE, 'w') as f:
            json.dump(settings_data, f, indent=2)
    
    return {"map": map_data, "fog": fog_data, "tokens": tokens_data, "settings": settings_data, "profile_name": name}

@eel.expose
def delete_profile(name):
    profile_path = get_profile_path(name)
    if os.path.exists(profile_path):
        shutil.rmtree(profile_path)
    
    index = get_profiles_index()
    profiles = [p for p in index.get('profiles', []) if p['name'] != name]
    save_profiles_index({'profiles': profiles})
    return True

@eel.expose
def save_profile_state(profile_name, fog_data, tokens_data, settings_data):
    if not profile_name:
        return False
    
    files = get_profile_files(profile_name)
    
    if fog_data:
        header, encoded = fog_data.split(",", 1)
        data = base64.b64decode(encoded)
        with open(files['fog'], "wb") as f:
            f.write(data)
    
    if tokens_data is not None:
        with open(files['tokens'], 'w') as f:
            json.dump(tokens_data, f, indent=2)
    
    if settings_data:
        with open(files['settings'], 'w') as f:
            json.dump(settings_data, f, indent=2)
    
    index = get_profiles_index()
    for p in index.get('profiles', []):
        if p['name'] == profile_name:
            p['last_modified'] = datetime.now().isoformat()
    save_profiles_index(index)
    
    return True

@eel.expose
def broadcast_profile_to_players(profile_name):
    state = load_profile(profile_name)
    eel.recieve_map(state.get('map'))
    eel.recieve_fog(state.get('fog'))
    eel.recieve_tokens(state.get('tokens'))
    return True

@eel.expose
def save_map_state(map_data, profile_name=None):
    if not map_data or not map_data.startswith('data:image'):
        return True
    try:
        header, encoded = map_data.split(",", 1)
        data = base64.b64decode(encoded)
    except Exception:
        return True
    if profile_name:
        files = get_profile_files(profile_name)
        with open(files['map'], "wb") as f:
            f.write(data)
        with open(MAP_FILE, "wb") as f:
            f.write(data)
        eel.recieve_map(map_data)
    else:
        header, encoded = map_data.split(",", 1)
        data = base64.b64decode(encoded)
        with open(MAP_FILE, "wb") as f:
            f.write(data)
        eel.recieve_map(map_data)

@eel.expose
def save_fog_state(fog_data, profile_name=None):
    if not fog_data or not fog_data.startswith('data:image'):
        return True
    try:
        header, encoded = fog_data.split(",", 1)
        data = base64.b64decode(encoded)
    except Exception:
        return True
    if profile_name:
        files = get_profile_files(profile_name)
        with open(files['fog'], "wb") as f:
            f.write(data)
        with open(FOG_FILE, "wb") as f:
            f.write(data)
        eel.recieve_fog(fog_data)
    else:
        header, encoded = fog_data.split(",", 1)
        data = base64.b64decode(encoded)
        with open(FOG_FILE, "wb") as f:
            f.write(data)
        eel.recieve_fog(fog_data)

@eel.expose
def save_tokens_state(tokens_data, profile_name=None):
    if profile_name:
        files = get_profile_files(profile_name)
        with open(files['tokens'], 'w') as f:
            json.dump(tokens_data, f, indent=2)
        with open(TOKENS_FILE, 'w') as f:
            json.dump(tokens_data, f, indent=2)
        eel.recieve_tokens(tokens_data)
    else:
        with open(TOKENS_FILE, 'w') as f:
            json.dump(tokens_data, f, indent=2)
        eel.recieve_tokens(tokens_data)

@eel.expose
def save_inputs_state(inputs_data, profile_name=None):
    if profile_name:
        files = get_profile_files(profile_name)
        with open(files['settings'], 'w') as f:
            json.dump(inputs_data, f, indent=2)
        with open(SETTING_FILE, 'w') as f:
            json.dump(inputs_data, f, indent=2)
    else:
        with open(SETTING_FILE, 'w') as f:
            json.dump(inputs_data, f, indent=2)


@eel.expose
def send_new_pos(x, y, s):
    eel.recieve_position(x, y, s)
        

@eel.expose
def load_saved_state(profile_name=None):
    if profile_name:
        return load_profile(profile_name)
    
    map_data = None
    if os.path.exists(MAP_FILE) and os.path.getsize(MAP_FILE) > 0:
        with open(MAP_FILE, "rb") as f:
            map_data = f.read()
        map_data = "data:image/png;base64," + base64.b64encode(map_data).decode()

    fog_data = None
    if os.path.exists(FOG_FILE) and os.path.getsize(FOG_FILE) > 0:
        with open(FOG_FILE, "rb") as f:
            fog_data = f.read()
        fog_data = "data:image/png;base64," + base64.b64encode(fog_data).decode()

    tokens_data = []
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, 'r') as f:
            tokens_data = json.load(f)

    settings_data = {}
    if os.path.exists(SETTING_FILE):
        with open(SETTING_FILE, 'r') as f:
            settings_data = json.load(f)

    return {"map": map_data, "fog": fog_data, "tokens": tokens_data, "settings": settings_data}

@eel.expose
def get_initial_state():
    profiles = get_profiles()
    if profiles:
        return {"has_profiles": True, "profiles": profiles}
    
    old_map_exists = os.path.exists(MAP_FILE) and os.path.getsize(MAP_FILE) > 0
    return {"has_profiles": False, "old_map_exists": old_map_exists}

@eel.expose
def migrate_old_state(profile_name):
    old_state = load_saved_state()
    create_profile(profile_name, old_state.get('map'), 'migrated.png')
    files = get_profile_files(profile_name)
    
    if old_state.get('fog'):
        header, encoded = old_state['fog'].split(",", 1)
        data = base64.b64decode(encoded)
        with open(files['fog'], "wb") as f:
            f.write(data)
    
    if old_state.get('tokens'):
        with open(files['tokens'], 'w') as f:
            json.dump(old_state['tokens'], f, indent=2)
    
    if old_state.get('settings'):
        with open(files['settings'], 'w') as f:
            json.dump(old_state['settings'], f, indent=2)
    
    return load_profile(profile_name)

@eel.expose
def open_players():
    webbrowser.open(f'http://{local_ip}:8080/players.html')

@eel.expose
def quit_server():
    print("Quit requested from DM...")
    import sys
    sys.exit(0)

@eel.expose
def ping():
    return True

eel.start('dm.html', block=False, size=(900, 600), port=8080, mode=False, host='0.0.0.0')

local_ip = get_local_ip()
print(f"Server running at: http://{local_ip}:8080/dm.html")
print(f"Players can open: http://{local_ip}:8080/players.html")
print("Press Ctrl+C to quit server...")

webbrowser.open(f'http://127.0.0.1:8080/dm.html')

last_save_time = time.time()
while True:
    eel.sleep(10.0)
    if time.time() - last_save_time > 300:
        print("Auto-saving state (5 min interval)...")
        last_save_time = time.time()

print("Server stopped.")

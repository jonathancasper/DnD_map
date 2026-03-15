import os
import eel
import json
import base64
import socket

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())

# Inicjalizacja aplikacji
eel.init('web')

# Ścieżki do zapisania danych
MAP_FILE = 'saved_map.png'
FOG_FILE = 'saved_fog.png'
TOKENS_FILE = 'tokens.json'
SETTING_FILE = 'settings.json'

@eel.expose
def save_map_state(map_data):
    # Konwersja danych base64 na plik obrazu
    header, encoded = map_data.split(",", 1)
    data = base64.b64decode(encoded)

    with open(MAP_FILE, "wb") as f:
        f.write(data)

    eel.recieve_map(map_data)

@eel.expose
def save_fog_state(fog_data):
    # Konwersja danych base64 na plik obrazu
    header, encoded = fog_data.split(",", 1)
    data = base64.b64decode(encoded)

    with open(FOG_FILE, "wb") as f:
        f.write(data)

    eel.recieve_fog(fog_data)

@eel.expose
def save_tokens_state(tokens_data):
    with open(TOKENS_FILE, 'w') as f:
        json.dump(tokens_data, f, indent=2)

    eel.recieve_tokens(tokens_data)

@eel.expose
def save_inputs_state(inputs_data):
    with open(SETTING_FILE, 'w') as f:
        json.dump(inputs_data, f, indent=2)
    #recieve_position(inputs_data)


@eel.expose
def send_new_pos(x, y, s):
    eel.recieve_position(x, y, s)
        

@eel.expose
def load_saved_state():
    # Ładowanie zapisanej mapy
    map_data = None
    if os.path.exists(MAP_FILE):
        with open(MAP_FILE, "rb") as f:
            map_data = f.read()
        map_data = "data:image/png;base64," + base64.b64encode(map_data).decode()

    # Ładowanie zapisanej mgły
    fog_data = None
    if os.path.exists(FOG_FILE):
        with open(FOG_FILE, "rb") as f:
            fog_data = f.read()
        fog_data = "data:image/png;base64," + base64.b64encode(fog_data).decode()

    # Ładowanie zapisanych tokenów
    tokens_data = []
    if os.path.exists(TOKENS_FILE):
        with open(TOKENS_FILE, 'r') as f:
            tokens_data = json.load(f)

    # Ładowanie zapisanych ustawień
    settings_data = {}
    if os.path.exists(SETTING_FILE):
        with open(SETTING_FILE, 'r') as f:
            settings_data = json.load(f)

    return {"map": map_data, "fog": fog_data, "tokens": tokens_data, "settings": settings_data}

@eel.expose
def open_players():
    eel.show('players.html')

eel.start('dm.html', block=False, size=(900, 600), port=8080, mode='default', host='localhost')

local_ip = get_local_ip()
print(f"Server running at: http://{local_ip}:8080")
print(f"Players can open: http://{local_ip}:8080/players.html")

while True:
    eel.sleep(1.0)

const mapWrapper = document.getElementById('map-wrapper');
const fogCanvas = document.getElementById('fog-of-war');
const ctx = fogCanvas.getContext('2d');
const gridCanvas = document.getElementById('grid');
const gridCtx = gridCanvas.getContext('2d');
const mapContainer = document.getElementById('map-container');
const fileInput = document.getElementById('file-input');
const dragDropArea = document.getElementById('drag-drop-area');
const resetFogBtn = document.getElementById('reset-fog');
const openPlayersBtn = document.getElementById('open-players');
const changeMapBtn = document.getElementById('change-map-btn');
const tokenColorInput = document.getElementById('token-color');
const brushSizeControl = document.getElementById('brush-size-control');
const tokenCustomization = document.getElementById('token-customization');
const fogBrushIndicator = document.getElementById('fog-brush-indicator');
let fog_color = "#111";
let currentProfile = null;

const brushSizeSlider = document.getElementById('brush-size-slider');
const brushSizeInput = document.getElementById('brush-size-input');
brushSizeSlider.addEventListener('input', () => {
	brushSizeInput.value = brushSizeSlider.value;
	updateFogBrushIndicator();
});
const brushColorInput = document.getElementById('brush-color');
brushColorInput.addEventListener("change", () => {
	fog_color = brushColorInput.value;
	updateBrushIndicatorBorder();
})

brushSizeInput.addEventListener('input', () => {
	brushSizeSlider.value = brushSizeInput.value;
	updateFogBrushIndicator();
});

function updateBrushIndicatorBorder() {
	const hex = fog_color.replace('#', '');
	const r = parseInt(hex.substr(0, 2), 16);
	const g = parseInt(hex.substr(2, 2), 16);
	const b = parseInt(hex.substr(4, 2), 16);
	const brightness = (r * 299 + g * 587 + b * 114) / 1000;
	fogBrushIndicator.style.borderColor = brightness > 128 ? '#000' : '#fff';
}

function updateFogBrushIndicator() {
	const radius = parseInt(brushSizeInput.value, 10);
	const size = radius * 2 * scale;
	fogBrushIndicator.style.width = size + 'px';
	fogBrushIndicator.style.height = size + 'px';
}

const mapScale = document.getElementById('map-scale');
mapScale.addEventListener("change", () => {
	const oldScale = scale;
	scale = parseInt(mapScale.value, 10) / 100;
	zoom(oldScale, self.innerWidth/2, self.innerHeight/2)
	updateFogBrushIndicator();
})

const oriX = document.getElementById('originX');
const oriY = document.getElementById('originY');
oriX.addEventListener("change", () => {
	originX = parseInt(oriX.value)
})
oriY.addEventListener("change", () => {
	originY = parseInt(oriY.value)
})

const gridSizeInput = document.getElementById('grid-size');
gridSizeInput.addEventListener("change", () => {
	gridSize = parseFloat(gridSizeInput.value)
})

const fogToolRadio = document.getElementById('fog-tool');
const tokenToolRadio = document.getElementById('token-tool');
const panToolRadio = document.getElementById('pan-tool');
fogToolRadio.addEventListener('change', updateToolDisplay);
tokenToolRadio.addEventListener('change', updateToolDisplay);
panToolRadio.addEventListener('change', updateToolDisplay);
updateToolDisplay();

let scale = 1; // Początkowa skala
const minScale = 0.1; // 10% minimum
const maxScale = 3.0; // 300% maximum
let originX = 0; // Początkowe przesunięcie X
let originY = 0; // Początkowe przesunięcie Y
let isDragging = false;
let isErasing = false;
let isDrawing = false;
let draggedToken = false;
let startX, startY;
let grid_color = '#888';
let clickStartX, clickStartY;
const gridSize = 50;
// Historia zmian
const undoStack = [];
const maxUndoSteps = 50; // Maksymalna liczba kroków cofania

// Obsługa przeciągnij i upuść
mapContainer.addEventListener('dragover', (event) => {
	event.preventDefault();
	dragDropArea.style.display = 'flex';
});

mapContainer.addEventListener('dragenter', (event) => {
	event.preventDefault();
});

mapContainer.addEventListener('mouseleave', () => {
	fogBrushIndicator.style.display = 'none';
});

dragDropArea.addEventListener('dragleave', (event) => {
	dragDropArea.style.display = 'none';
});

dragDropArea.addEventListener('drop', (event) => {
	event.preventDefault();
	dragDropArea.style.display = 'none';
	
	eel.get_profiles()(function(profiles) {
		showProfileModal(profiles);
	});
});

document.addEventListener('contextmenu', event => event.preventDefault());

// Obsługa zoomowania
mapContainer.addEventListener('wheel', function(event) {
	event.preventDefault();
	const oldScale = scale;
	
	const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
    scale *= scaleFactor;
    scale = Math.max(minScale, Math.min(maxScale, scale));

	zoom(oldScale, event.clientX, event.clientY)
	mapScale.value = parseInt(scale*100)
	saveInputsState()
	drawGrid();
});

// Obsługa przesuwania mapy (dragging)
mapContainer.addEventListener('mousedown', function(event) {
	if (event.button === 1) { // Środkowy przycisk myszy
		isDragging = true;
		mapContainer.style.cursor = 'move';
		startX = event.clientX - originX;
		startY = event.clientY - originY;
	} else if (event.button === 0) { // Lewy przycisk myszy
		if (panToolRadio.checked) {
			isDragging = true;
			mapContainer.style.cursor = 'grabbing';
			startX = event.clientX - originX;
			startY = event.clientY - originY;
		} else if (fogToolRadio.checked) {
			isErasing = true;
			saveState(); // Zapisz stan przed usunięciem mgły
			eraseFog(event); // Usuwanie mgły w miejscu kliknięcia
		}
	} else if (event.button === 2) { // Prawy przycisk myszy
		if (fogToolRadio.checked) {
			isDrawing = true;
			saveState(); // Zapisz stan przed dodaniem mgły
			drawFog(event); // Dodanie mgły w miejscu kliknięcia
		}
	}
});

window.addEventListener('mousemove', function(event) {
	if (fogToolRadio.checked) {
		const rect = mapWrapper.getBoundingClientRect();
		const x = (event.clientX - rect.left) / scale;
		const y = (event.clientY - rect.top) / scale;
		const radius = parseInt(brushSizeInput.value, 10);
		const size = radius * 2 * scale;
		const indicatorX = x * scale - radius * scale;
		const indicatorY = y * scale - radius * scale;
		
		fogBrushIndicator.style.display = 'block';
		fogBrushIndicator.style.width = size + 'px';
		fogBrushIndicator.style.height = size + 'px';
		fogBrushIndicator.style.left = (originX + indicatorX) + 'px';
		fogBrushIndicator.style.top = (originY + indicatorY) + 'px';
	} else {
		fogBrushIndicator.style.display = 'none';
	}
	
	if (isDragging) {
		originX = event.clientX - startX;
		originY = event.clientY - startY;
		mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
		sendNewPos(originX, originY, scale)
		oriX.value = originX;
		oriY.value = originY;
		saveInputsState()
	} else if (isErasing) {
		eraseFog(event); // Usuwanie mgły podczas ruchu myszy
	} else if (isDrawing) {
		drawFog(event); // Dodawanie mgły podczas ruchu myszy
	}
	if (draggedToken) {
        const rect = mapWrapper.getBoundingClientRect();
        const x = (event.clientX - rect.left) / scale - draggedToken.offsetWidth / 2;
        const y = (event.clientY - rect.top) / scale - draggedToken.offsetHeight / 2;

        draggedToken.style.left = `${x}px`;
        draggedToken.style.top = `${y}px`;
    }
	drawGrid();
});

window.addEventListener('mouseup', function() {
	isDragging = false;
	if (isErasing) {saveFogState();}
	isErasing = false;
	if (isDrawing) {saveFogState();}
	isDrawing = false;
	if (panToolRadio.checked) {
		mapContainer.style.cursor = 'grab';
	} else {
		mapContainer.style.cursor = '';
	}
	if (draggedToken) {
        draggedToken = false; // Zresetowanie przeciąganego tokenu po upuszczeniu
        return; // Przerwij, aby zapobiec tworzeniu nowego tokenu
    }
	
	if (event.button === 0) { // Lewy przycisk myszy
		const clickEndX = event.clientX;
		const clickEndY = event.clientY;
		
		// Sprawdzenie, czy współrzędne wciśnięcia i upuszczenia są blisko siebie (czyli uznawane za kliknięcie)
		const threshold = 5; // Tolerancja w pikselach
		if (Math.abs(clickStartX - clickEndX) <= threshold && Math.abs(clickStartY - clickEndY) <= threshold && tokenToolRadio.checked && !event.target.classList.contains('token') && !event.target.classList.contains('token-label')) {
			const rect = mapWrapper.getBoundingClientRect();
			const x = (event.clientX - rect.left) / scale;
			const y = (event.clientY - rect.top) / scale;
			const size = parseInt(document.getElementById('token-size-input').value);
			createToken(x - size/2, y - size/2, size, document.getElementById('token-color').value, tokenCounter++);
		}
	}
	if (draggedToken) {
        draggedToken = null; // Zresetowanie przeciąganego tokenu po upuszczeniu
    }
});

// Obsługa cofania (Ctrl+Z)
window.addEventListener('keydown', function(event) {
	if (event.ctrlKey && event.key === 'z') {
		undo();
	}
});

window.addEventListener('resize', function() {
    gridCanvas.width = mapContainer.clientWidth;
    gridCanvas.height = mapContainer.clientHeight;
    drawGrid();
});

mapWrapper.addEventListener('mousedown', function(event) {
	if (event.button === 0) { // Lewy przycisk myszy
		clickStartX = event.clientX;
		clickStartY = event.clientY;
	}
});

document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', saveInputsState);
    input.addEventListener('change', saveInputsState);
});

resetFogBtn.addEventListener("click", () => {
	fogCanvas.width = mapWrapper.clientWidth;
	fogCanvas.height = mapWrapper.clientHeight;
	ctx.fillStyle = fog_color;
	ctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
	saveFogState()
})

openPlayersBtn.addEventListener("click", () => {
	eel.open_players();
})

let initialDistance = 0;
let initialScale = scale;
// Obsługa gestów na urządzeniach mobilnych
mapContainer.addEventListener('touchstart', function(event) {
    if (event.touches.length === 1) {
        // Przeciąganie
        isDragging = true;
        startX = event.touches[0].clientX - originX;
        startY = event.touches[0].clientY - originY;
    } else if (event.touches.length === 2) {
        // Zoomowanie (pinch-to-zoom)
        isDragging = false; // Wstrzymaj przeciąganie
        initialDistance = getDistance(event.touches);
        initialScale = scale;
    }
});

mapContainer.addEventListener('touchmove', function(event) {
    if (event.touches.length === 1 && isDragging) {
        // Przeciąganie
        originX = event.touches[0].clientX - startX;
        originY = event.touches[0].clientY - startY;
        mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
		sendNewPos(originX, originY, scale)
        oriX.value = originX;
        oriY.value = originY;
    } else if (event.touches.length === 2) {
        // Zoomowanie (pinch-to-zoom)
        const currentDistance = getDistance(event.touches);
        const scaleFactor = currentDistance / initialDistance;
        scale = Math.max(minScale, Math.min(maxScale, initialScale * scaleFactor));
        zoom(initialScale, (event.touches[0].clientX + event.touches[1].clientX) / 2, 
             (event.touches[0].clientY + event.touches[1].clientY) / 2);
        mapScale.value = parseInt(scale * 100);
    }
});

mapContainer.addEventListener('touchend', function(event) {
    isDragging = false;
});

// Funkcja do obliczania odległości między dwoma punktami dotyku
function getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleFile(file) {
	const reader = new FileReader();
	reader.onload = function(event) {
		let mapImg = document.getElementById('map');

		if (!mapImg) {
			// Jeśli mapImg nie istnieje, stwórz nowy element img
			mapImg = document.createElement('img');
			mapImg.id = 'map';
			mapImg.src = event.target.result;

			// Dodaj nowo stworzony element img jako pierwszy element w mapWrapper
			mapWrapper.insertBefore(mapImg, mapWrapper.firstChild);
		} else {
			mapImg.src = event.target.result;
		}

		mapImg.onload = function() {
			saveMapState(event.target.result);
			
			fogCanvas.width = mapImg.width;
			fogCanvas.height = mapImg.height;
			ctx.fillStyle = fog_color;
			ctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
		};
				
		
	};
	reader.readAsDataURL(file);
}

// zoom
function zoom(oldScale, centerX, centerY) {
	const offsetX = (centerX - originX) / oldScale;
    const offsetY = (centerY - originY) / oldScale;

    const newOffsetX = offsetX * scale;
    const newOffsetY = offsetY * scale;

    originX += centerX - (originX + newOffsetX);
    originY += centerY - (originY + newOffsetY);

	mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
	sendNewPos(originX, originY, scale)
}

// Funkcja przełączania widoczności
function updateToolDisplay() {
    if (panToolRadio.checked) {
        brushSizeControl.classList.add('hidden');
        tokenCustomization.classList.add('hidden');
        fogBrushIndicator.style.display = 'none';
        mapContainer.style.cursor = 'grab';
    } else if (fogToolRadio.checked) {
        brushSizeControl.classList.remove('hidden');
        tokenCustomization.classList.add('hidden');
        updateBrushIndicatorBorder();
        mapContainer.style.cursor = '';
    } else if (tokenToolRadio.checked) {
        brushSizeControl.classList.add('hidden');
        tokenCustomization.classList.remove('hidden');
        fogBrushIndicator.style.display = 'none';
        mapContainer.style.cursor = '';
    }
}

// Funkcja zapisu stanu mapy
function saveMapState(mapData) {
	eel.save_map_state(mapData, currentProfile);
}

function saveState() {
	// Zapisuje aktualny stan mgły na stosie cofania
	if (undoStack.length >= maxUndoSteps) {
		undoStack.shift(); // Usuwa najstarszy stan, jeśli przekroczono limit
	}
	undoStack.push(ctx.getImageData(0, 0, fogCanvas.width, fogCanvas.height));

	// Zapis stanu mgły w pliku
	saveFogState();
}

function undo() {
	if (undoStack.length > 0) {
		const lastState = undoStack.pop();
		ctx.putImageData(lastState, 0, 0);

		// Zapis stanu mgły w pliku po cofnięciu
		saveFogState();
	}
}

function eraseFog(event) {
	const rect = mapWrapper.getBoundingClientRect();
	const x = (event.clientX - rect.left) / scale;
	const y = (event.clientY - rect.top) / scale;
	const radius = parseInt(brushSizeInput.value, 10);

	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2, true);
	ctx.closePath();
	ctx.save();
	ctx.clip();
	ctx.clearRect(x - radius, y - radius, radius * 2, radius * 2);
	ctx.restore();
}

function drawFog(event) {
	const rect = mapWrapper.getBoundingClientRect();
	const x = (event.clientX - rect.left) / scale;
	const y = (event.clientY - rect.top) / scale;
	const radius = parseInt(brushSizeInput.value, 10);

	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2, true);
	ctx.fillStyle = fog_color;
	ctx.fill();
	ctx.closePath();
}

// Zapis stanu mgły do pliku
function saveFogState() {
	const fogData = fogCanvas.toDataURL();
	eel.save_fog_state(fogData, currentProfile);
}

let tokenCounter = 1; // Zmienna do śledzenia numeru tokenu
function createToken(x, y, size, color, text) {
    // Pobranie koloru i rozmiaru z inputów
    // const color = document.getElementById('token-color').value;
    // const size = document.getElementById('token-size-input').value;
    // const rect = mapWrapper.getBoundingClientRect();
    // const x = (event.clientX - rect.left) / scale - size/2;
    // const y = (event.clientY - rect.top) / scale - size/2;

    const token = document.createElement('div');
    token.className = 'token';
    token.style.left = `${x}px`;
    token.style.top = `${y}px`;
    token.style.width = `${size}px`;
    token.style.height = `${size}px`;
    token.style.backgroundColor = color;
    token.style.lineHeight = `${size/2}px`; // Centrowanie tekstu w pionie
    token.style.fontSize = `${size / 2.5}px`; // Proporcjonalny rozmiar tekstu

    // Dodanie numeru do tokenu
    const tokenLabel = document.createElement('div');
    tokenLabel.contentEditable = true; // Umożliwienie edycji tekstu
    tokenLabel.textContent = text;
    tokenLabel.style.cursor = 'text';
	tokenLabel.classList.add("token-label")
	tokenLabel.spellcheck = false;
    token.appendChild(tokenLabel);

    // Usuwanie żetonu po kliknięciu prawym przyciskiem myszy
    token.addEventListener('contextmenu', function(event) {
        event.preventDefault();
        token.remove();
		saveTokensState()
    });

    // Zapobieganie tworzeniu nowego tokenu przy kliknięciu na istniejący
    token.addEventListener('mousedown', function(event) {
        event.stopPropagation(); // Zatrzymanie propagacji zdarzenia
        if (event.button === 0) { // Lewy przycisk myszy
            draggedToken = token; // Ustawienie przeciąganego tokenu
            clickStartX = event.clientX;
            clickStartY = event.clientY;
			event.stopPropagation();
        }
    });

	token.addEventListener('mouseup', function(event) {
        if (event.button === 0) { // Lewy przycisk myszy
            // Sprawdzenie, czy wciśnięcie i upuszczenie były blisko siebie
            const clickEndX = event.clientX;
            const clickEndY = event.clientY;
            const threshold = 5; // Tolerancja w pikselach
            if (Math.abs(clickStartX - clickEndX) <= threshold && Math.abs(clickStartY - clickEndY) <= threshold && !event.target.classList.contains('token-label')) {
                // Zmiana koloru tokenu na losowy
                token.style.backgroundColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
				saveTokensState()
            }
            draggedToken = null; // Zresetowanie przeciąganego tokenu
        }
    });

    // Obsługa zmiany tekstu w tokenie
    tokenLabel.addEventListener('input', function(event) {
        console.log(`Token text changed to: ${tokenLabel.textContent}`);
		saveTokensState()
    });

    mapWrapper.appendChild(token);
	saveTokensState()
}

function saveTokensState() {
    const tokens = [];
    
    document.querySelectorAll('.token').forEach(token => {
        const tokenData = {
            left: parseInt(token.style.left),
            top: parseInt(token.style.top),
            size: parseInt(token.style.width),
            color: token.style.backgroundColor,
            text: token.querySelector('div').textContent
        };
        tokens.push(tokenData);
    });

    // Przesyłanie danych do Pythona
    eel.save_tokens_state(tokens, currentProfile);
}

function saveInputsState() {
    const inputsData = {};

    document.querySelectorAll('input').forEach(input => {
        if (input.type === 'radio' || input.type === 'checkbox') {
            inputsData[input.id] = input.checked;
        } else {
            inputsData[input.id] = input.value;
        }
    });

    // Przesyłanie danych do Pythona
    eel.save_inputs_state(inputsData, currentProfile);
}

function sendNewPos(x, y, s) {
	eel.send_new_pos(x, y, s);
}

// Ustawienia początkowe canvasa siatki
gridCanvas.width = mapContainer.clientWidth;
gridCanvas.height = mapContainer.clientHeight;

// Funkcja do rysowania siatki
drawGrid();
function drawGrid() {
    /*gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.strokeStyle = grid_color; // Kolor linii siatki
    gridCtx.lineWidth = 1; // Grubość linii siatki

    const scaledGridSize = gridSize * scale;

    // Obliczenie przesunięcia siatki względem położenia mapy w kontenerze
    const rect = mapWrapper.getBoundingClientRect();
    const offsetX = rect.left % scaledGridSize;
    const offsetY = rect.top % scaledGridSize;

    for (let x = offsetX; x < gridCanvas.width; x += scaledGridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(x+.5, 0+.5);
        gridCtx.lineTo(x+.5, gridCanvas.height+.5);
        gridCtx.stroke();
    }

    for (let y = offsetY; y < gridCanvas.height; y += scaledGridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(0+.5, y+.5);
        gridCtx.lineTo(gridCanvas.width+.5, y+.5);
        gridCtx.stroke();
    }*/
}

// Ładowanie zapisanego stanu mapy i mgły przy starcie
window.onload = function() {
	eel.get_initial_state()(function(initialState) {
		if (initialState.has_profiles) {
			showProfileModal(initialState.profiles);
		} else if (initialState.old_map_exists) {
			showProfileModal([], true);
		} else {
			showProfileModal([]);
		}
	});
	
	setupProfileModal();
};

function showProfileModal(profiles, showMigration = false) {
	const modal = document.getElementById('profile-modal');
	const select = document.getElementById('profile-select');
	const migrationSection = document.getElementById('migration-section');
	
	select.innerHTML = '<option value="">-- Select a profile --</option>';
	profiles.forEach(profile => {
		const option = document.createElement('option');
		option.value = profile.name;
		option.textContent = profile.name;
		select.appendChild(option);
	});
	
	if (showMigration) {
		migrationSection.classList.remove('hidden');
	} else {
		migrationSection.classList.add('hidden');
	}
	
	modal.classList.add('show');
}

function hideProfileModal() {
	const modal = document.getElementById('profile-modal');
	modal.classList.remove('show');
}

function loadProfileState(profileName) {
	eel.load_profile(profileName)(function(savedState) {
		currentProfile = profileName;
		hideProfileModal();
		loadStateIntoUI(savedState);
	});
}

function loadStateIntoUI(savedState) {
	document.querySelectorAll('.token').forEach(token => token.remove());
	tokenCounter = 1;
	
	if (savedState.map) {
		let mapImg = document.getElementById('map');

		if (!mapImg) {
			mapImg = document.createElement('img');
			mapImg.id = 'map';
			mapImg.src = savedState.map;
			mapWrapper.insertBefore(mapImg, mapWrapper.firstChild);
		} else {
			mapImg.src = savedState.map;
		}
		
		mapImg.onload = function() {
			fogCanvas.width = mapImg.width;
			fogCanvas.height = mapImg.height;
			if (savedState.fog) {
				const img = new Image();
				img.src = savedState.fog;
				img.onload = function() {
					ctx.drawImage(img, 0, 0);
				};
			} else {
				ctx.fillStyle = fog_color;
				ctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
			}

			if (savedState.tokens) {
				savedState.tokens.forEach(tokenData => {
					createToken(tokenData.left, tokenData.top, tokenData.size, tokenData.color, tokenData.text);
				});
			}
		};
		
		eel.broadcast_profile_to_players(currentProfile);
	}
	if (savedState.settings) {
		for (const id in savedState.settings) {
			const input = document.getElementById(id);
			if (input) {
				if (input.type === 'radio' || input.type === 'checkbox') {
					input.checked = savedState.settings[id];
				} else {
					input.value = savedState.settings[id];
				}
			}
		}
		updateToolDisplay();
		originX = parseInt(oriX.value);
		originY = parseInt(oriY.value);
		scale = parseInt(mapScale.value)/100;
		mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
		fog_color = brushColorInput.value;
	}
}

function setupProfileModal() {
	const changeMapBtn = document.getElementById('change-map-btn');
	const profileSelect = document.getElementById('profile-select');
	const loadProfileBtn = document.getElementById('load-profile-btn');
	const deleteProfileBtn = document.getElementById('delete-profile-btn');
	const newMapFile = document.getElementById('new-map-file');
	const newProfileName = document.getElementById('new-profile-name');
	const createProfileBtn = document.getElementById('create-profile-btn');
	const migrateBtn = document.getElementById('migrate-btn');
	const migrateProfileName = document.getElementById('migrate-profile-name');
	
	changeMapBtn.addEventListener('click', function() {
		eel.get_profiles()(function(profiles) {
			showProfileModal(profiles);
		});
	});
	
	loadProfileBtn.addEventListener('click', function() {
		const selectedProfile = profileSelect.value;
		if (selectedProfile) {
			loadProfileState(selectedProfile);
		}
	});
	
	deleteProfileBtn.addEventListener('click', function() {
		const selectedProfile = profileSelect.value;
		if (selectedProfile && confirm(`Delete profile "${selectedProfile}"? This cannot be undone.`)) {
			eel.delete_profile(selectedProfile)(function() {
				eel.get_profiles()(function(profiles) {
					showProfileModal(profiles);
				});
			});
		}
	});
	
	createProfileBtn.addEventListener('click', function() {
		const profileName = newProfileName.value.trim();
		const file = newMapFile.files[0];
		
		if (!profileName) {
			alert('Please enter a profile name');
			return;
		}
		if (!file) {
			alert('Please select a map image');
			return;
		}
		
		const reader = new FileReader();
		reader.onload = function(event) {
			eel.create_profile(profileName, event.target.result, file.name)(function() {
				loadProfileState(profileName);
			});
		};
		reader.readAsDataURL(file);
	});
	
	migrateBtn.addEventListener('click', function() {
		const profileName = migrateProfileName.value.trim();
		if (!profileName) {
			alert('Please enter a profile name');
			return;
		}
		
		eel.migrate_old_state(profileName)(function(savedState) {
			currentProfile = profileName;
			hideProfileModal();
			loadStateIntoUI(savedState);
		});
	});
}


const mapWrapper = document.getElementById('map-wrapper');
const fogCanvas = document.getElementById('fog-of-war');
const ctx = fogCanvas.getContext('2d');
const mapContainer = document.getElementById('map-container');
mapContainer.style.cursor = 'grab';
const mapScale = document.getElementById('map-scale');
mapScale.addEventListener("change", () => {
	const oldScale = scale;
	scale = parseInt(mapScale.value, 10) / 100;
	zoom(oldScale, self.innerWidth/2, self.innerHeight/2)
})
const oriX = document.getElementById('originX');
const oriY = document.getElementById('originY');
oriX.addEventListener("change", () => {
	originX = parseInt(oriX.value)
})
oriY.addEventListener("change", () => {
	originY = parseInt(oriY.value)
})

let scale = 1; // Początkowa skala
let originX = 0; // Początkowe przesunięcie X
let originY = 0; // Początkowe przesunięcie Y
let isDragging = false;
let startX, startY;
let fog_color = "#000";
let clickStartX, clickStartY;

// Obsługa zoomowania
mapContainer.addEventListener('wheel', function(event) {
	event.preventDefault();
	const oldScale = scale;
	
	const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
    scale *= scaleFactor;

	zoom(oldScale, event.clientX, event.clientY)
	mapScale.value = parseInt(scale*100)
});

// Obsługa przesuwania mapy (dragging)
mapContainer.addEventListener('mousedown', function(event) {
	if (event.button === 1) { // Środkowy przycisk myszy
		isDragging = true;
		mapContainer.style.cursor = 'move';
		startX = event.clientX - originX;
		startY = event.clientY - originY;
	} else if (event.button === 0) { // Lewy przycisk myszy - pan
		isDragging = true;
		mapContainer.style.cursor = 'grabbing';
		startX = event.clientX - originX;
		startY = event.clientY - originY;
	}
});

window.addEventListener('mousemove', function(event) {
	if (isDragging) {
		originX = event.clientX - startX;
		originY = event.clientY - startY;
		mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
		oriX.value = originX;
		oriY.value = originY;
	}
});

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
        oriX.value = originX;
        oriY.value = originY;
    } else if (event.touches.length === 2) {
        // Zoomowanie (pinch-to-zoom)
        const currentDistance = getDistance(event.touches);
        const scaleFactor = currentDistance / initialDistance;
        scale = initialScale * scaleFactor;
        zoom(initialScale, (event.touches[0].clientX + event.touches[1].clientX) / 2, 
             (event.touches[0].clientY + event.touches[1].clientY) / 2);
        mapScale.value = parseInt(scale * 100);
    }
});

mapContainer.addEventListener('touchend', function(event) {
    isDragging = false;
});

window.addEventListener('mouseup', function() {
	isDragging = false;
	mapContainer.style.cursor = 'grab';
});

// Funkcja do obliczania odległości między dwoma punktami dotyku
function getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
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
}

let tokenCounter = 1; // Zmienna do śledzenia numeru tokenu
function createToken(x, y, size, color, text) {

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
    tokenLabel.textContent = text;
    tokenLabel.style.cursor = 'text';
	tokenLabel.classList.add("token-label")
	tokenLabel.spellcheck = false;
    token.appendChild(tokenLabel);


    mapWrapper.appendChild(token);
}

// Ładowanie zapisanego stanu mapy i mgły przy starcie
window.onload = function() {
	eel.load_saved_state()(function(savedState) {
		if (savedState.map) {
			let mapImg = document.getElementById('map');

			if (!mapImg) {
				// Jeśli mapImg nie istnieje, stwórz nowy element img
				mapImg = document.createElement('img');
				mapImg.id = 'map';
				mapImg.src = savedState.map;

				// Dodaj nowo stworzony element img jako pierwszy element w mapWrapper
				mapWrapper.insertBefore(mapImg, mapWrapper.firstChild);
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
			originX = parseInt(oriX.value);
			originY = parseInt(oriY.value);
			scale = parseInt(mapScale.value)/100;
			mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
		}
	});
};

// Ładowanie mapy
eel.expose(recieve_map);
function recieve_map(map) {
	console.log(map);
    if (map) {
        let mapImg = document.getElementById('map');

        if (!mapImg) {
            mapImg = document.createElement('img');
            mapImg.id = 'map';
            mapWrapper.insertBefore(mapImg, mapWrapper.firstChild);
        }

        document.querySelectorAll('.token').forEach(token => token.remove());
        
        if (mapImg.naturalWidth > 0) {
            fogCanvas.width = mapImg.naturalWidth;
            fogCanvas.height = mapImg.naturalHeight;
        }
        
        mapImg.onload = function() {
            fogCanvas.width = mapImg.naturalWidth || mapImg.width;
            fogCanvas.height = mapImg.naturalHeight || mapImg.height;
            ctx.fillStyle = fog_color;
            ctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
        };

        mapImg.src = map;
	}
};

// Ładowanie mgły
eel.expose(recieve_fog);
function recieve_fog(fog) {
	if (!fog) {
		ctx.fillStyle = fog_color;
		ctx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
		return;
	}
	
	const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = fogCanvas.width;
    tempCanvas.height = fogCanvas.height;

    if (fog) {
        const img = new Image();
        img.src = fog;
        img.onload = function() {
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(img, 0, 0);

            // Po załadowaniu i narysowaniu obrazu, przenieś go na widoczne canvas
            ctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
            ctx.drawImage(tempCanvas, 0, 0);
        };
    }
};

// Ładowanie tokenów
eel.expose(recieve_tokens);
function recieve_tokens(tokens) {
	if (tokens) {
		const rmTokens = document.querySelectorAll('.token');
    	rmTokens.forEach(token => token.remove());
		tokens.forEach(tokenData => {
			createToken(tokenData.left, tokenData.top, tokenData.size, tokenData.color, tokenData.text);
		});
	}
};

// Ładowanie pozycji
eel.expose(recieve_position);
function recieve_position(x, y, s) {
	mapWrapper.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
};
// function recieve_position(settings) {
// 	if (settings) {
// 		//console.log(settings)
// 		for (const id in settings) {
// 			const input = document.getElementById(id);
// 			if (input) {
// 				if (input.type === 'radio' || input.type === 'checkbox') {
// 					input.checked = savedState.settings[id];
// 				} else {
// 					input.value = savedState.settings[id];
// 				}
// 			}
// 		}
// 		updateToolDisplay();
// 		console.log(oriX.value)
// 		originX = parseInt(oriX.value);
// 		originY = parseInt(oriY.value);
// 		scale = parseInt(mapScale.value)/100;
// 		mapWrapper.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
// 	}
// };

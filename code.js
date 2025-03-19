// Konstanten und Variablen
let canvas, ctx, originalImage = null;
let glitchInterval = null;
let displacementMap = null;
let interactionMode = 'off';
let lastTouchX = 0, lastTouchY = 0;
let isTouching = false;
let touchPoint = null;
let isLoading = false;

// DOM-Elemente initialisieren erst nach DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM geladen, initialisiere Anwendung...');
    
    // Canvas-Kontext initialisieren
    canvas = document.getElementById('filteredCanvas');
    if (canvas) {
        ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    
    // DOM-Elemente
    const loadImageBtn = document.getElementById('loadImageBtn');
    const loadSampleBtn = document.getElementById('loadSampleBtn');
    const imageUrlInput = document.getElementById('imageUrl');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    const showCssBtn = document.getElementById('showCssBtn');
    const noImageMessage = document.getElementById('noImageMessage');
    const canvasContainer = document.getElementById('canvasContainer');
    const filterInfo = document.getElementById('filterInfo');
    const cssCode = document.getElementById('cssCode');
    const presetButtons = document.querySelectorAll('.preset-btn');
    const tabs = document.querySelectorAll('.tab');
    const interactionOverlay = document.getElementById('interactionOverlay');
    const interactionButtons = document.querySelectorAll('.mode-btn');
    const touchInfo = document.getElementById('touchInfo');
    const interactionModeSwitch = document.getElementById('interactionModeSwitch');

    // Filter-Steuerelemente
    const blurSlider = document.getElementById('blur');
    const brightnessSlider = document.getElementById('brightness');
    const contrastSlider = document.getElementById('contrast');
    const hueRotateSlider = document.getElementById('hueRotate');
    const invertSlider = document.getElementById('invert');
    const saturateSlider = document.getElementById('saturate');
    const sepiaSlider = document.getElementById('sepia');
    const pixelateSlider = document.getElementById('pixelate');

    // Speziellere Effekt-Steuerelemente
    const rgbShiftActive = document.getElementById('rgbShiftActive');
    const rgbShiftAmount = document.getElementById('rgbShiftAmount');
    const rgbShiftAngle = document.getElementById('rgbShiftAngle');
    const glitchActive = document.getElementById('glitchActive');
    const glitchIntensity = document.getElementById('glitchIntensity');
    const glitchSpeed = document.getElementById('glitchSpeed');
    const displacementActive = document.getElementById('displacementActive');
    const displacementScale = document.getElementById('displacementScale');
    const displacementType = document.getElementById('displacementType');

    // Sammlung aller Slider für leichtere Verarbeitung
    const sliders = [
        blurSlider, brightnessSlider, contrastSlider, hueRotateSlider, 
        invertSlider, saturateSlider, sepiaSlider, pixelateSlider,
        rgbShiftAmount, rgbShiftAngle, glitchIntensity, glitchSpeed,
        displacementScale
    ].filter(slider => slider !== null);

    // Tab-Steuerung
    if (tabs) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');
                
                // Tabs aktualisieren
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                
                // Tab-Inhalte aktualisieren
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                const targetContent = document.getElementById(targetTab + 'Filters');
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    // Hilfsfunktion zum Erstellen von Loading-Overlay
    function showLoading() {
        if (isLoading) return; // Verhindert mehrfache Loading-Anzeigen
        isLoading = true;
        
        const existingLoading = document.querySelector('.loading');
        if (existingLoading) return;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading';
        loadingDiv.setAttribute('aria-label', 'Lade Bild...');
        loadingDiv.innerHTML = '<div class="spinner" role="status"></div>';
        
        const previewContainer = document.getElementById('previewContainer');
        if (previewContainer) {
            previewContainer.appendChild(loadingDiv);
        }
    }

    function hideLoading() {
        isLoading = false;
        const loading = document.querySelector('.loading');
        if (loading) {
            loading.classList.add('fade-out');
            setTimeout(() => {
                if (loading.parentNode) {
                    loading.parentNode.removeChild(loading);
                }
            }, 300);
        }
    }

    // CSS Code anzeigen/verstecken
    if (showCssBtn && filterInfo) {
        showCssBtn.addEventListener('click', () => {
            if (filterInfo.style.display === 'none' || !filterInfo.style.display) {
                filterInfo.style.display = 'block';
                showCssBtn.textContent = 'CSS ausblenden';
                showCssBtn.setAttribute('aria-expanded', 'true');
            } else {
                filterInfo.style.display = 'none';
                showCssBtn.textContent = 'CSS anzeigen';
                showCssBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Event-Listener
    if (loadImageBtn) loadImageBtn.addEventListener('click', loadImageFromUrl);
    if (loadSampleBtn) loadSampleBtn.addEventListener('click', loadSampleImage);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadImage);
    if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetFilters);

    // Event-Listener für alle Slider mit Debounce für bessere Performance
    let debounceTimer;
    sliders.forEach(slider => {
        slider.addEventListener('input', () => {
            updateSliderValue(slider);
            
            // Verzögere die Anwendung der Filter um die Performance zu verbessern
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                applyFilters();
            }, 10); // Kurze Verzögerung für flüssigere UI
        });
    });

    // Checkboxen für spezielle Effekte
    [rgbShiftActive, glitchActive, displacementActive].forEach(checkbox => {
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                // Bei Deaktivierung des Glitch-Effekts Interval stoppen
                if (checkbox.id === 'glitchActive' && !checkbox.checked && glitchInterval) {
                    clearInterval(glitchInterval);
                    glitchInterval = null;
                }
                
                applyFilters();
            });
        }
    });

    // Event-Listener für Displacement-Typ
    if (displacementType) {
        displacementType.addEventListener('change', () => {
            createDisplacementMap();
            applyFilters();
        });
    }

    // Voreinstellungen
    if (presetButtons) {
        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                applyPreset(btn.getAttribute('data-preset'));
            });
        });
    }

    // Touch-/Maus-Interaktion für direktes Filtern
    if (interactionOverlay) {
        interactionOverlay.addEventListener('mousedown', startInteraction);
        interactionOverlay.addEventListener('mousemove', handleInteraction);
        interactionOverlay.addEventListener('mouseup', endInteraction);
        interactionOverlay.addEventListener('mouseleave', endInteraction);

        // Touch-Events
        interactionOverlay.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches && e.touches[0]) {
                startInteraction(e.touches[0]);
            }
        });

        interactionOverlay.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches && e.touches[0]) {
                handleInteraction(e.touches[0]);
            }
        });

        interactionOverlay.addEventListener('touchend', (e) => {
            e.preventDefault();
            endInteraction();
        });
    }

    // Interactive Mode Buttons
    if (interactionButtons) {
        interactionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                interactionButtons.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-checked', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');
                
                interactionMode = btn.getAttribute('data-mode');
                
                // Stoppe Glitch-Intervall wenn ein anderer Modus aktiviert wird
                if (interactionMode !== 'glitch' && glitchInterval) {
                    clearInterval(glitchInterval);
                    glitchInterval = null;
                }
                
                // Zeige passende Infos an
                if (touchInfo) {
                    switch(interactionMode) {
                        case 'off':
                            touchInfo.textContent = '';
                            touchInfo.style.opacity = '0';
                            break;
                        case 'rgbshift':
                            touchInfo.textContent = 'Ziehe zum Verschieben der Farbkanäle';
                            touchInfo.style.opacity = '1';
                            setTimeout(() => { touchInfo.style.opacity = '0'; }, 3000);
                            break;
                        case 'glitch':
                            touchInfo.textContent = 'Tippe/Klicke zum Erzeugen von Glitch-Effekten';
                            touchInfo.style.opacity = '1';
                            setTimeout(() => { touchInfo.style.opacity = '0'; }, 3000);
                            break;
                        case 'displacement':
                            touchInfo.textContent = 'Ziehe zum Verzerren des Bildes';
                            touchInfo.style.opacity = '1';
                            setTimeout(() => { touchInfo.style.opacity = '0'; }, 3000);
                            break;
                    }
                }
                
                applyFilters();
            });
        });
    }

    // Touch-Interaktion starten
    function startInteraction(event) {
        if (interactionMode === 'off' || !originalImage || !interactionOverlay) return;
        
        isTouching = true;
        
        // Position relativ zum Overlay
        const rect = interactionOverlay.getBoundingClientRect();
        lastTouchX = (event.clientX - rect.left) / rect.width;
        lastTouchY = (event.clientY - rect.top) / rect.height;
        
        // Visuelles Feedback erstellen
        if (!touchPoint) {
            touchPoint = document.createElement('div');
            touchPoint.className = 'touch-point';
            touchPoint.setAttribute('aria-hidden', 'true');
            interactionOverlay.appendChild(touchPoint);
        }
        
        // Position aktualisieren
        touchPoint.style.left = `${lastTouchX * 100}%`;
        touchPoint.style.top = `${lastTouchY * 100}%`;
        touchPoint.style.opacity = '1';
        
        // Sofortige Anwendung von Effekten
        applyInteractiveEffect(lastTouchX, lastTouchY);
    }

    // Touch-Interaktion verarbeiten
    function handleInteraction(event) {
        if (!isTouching || interactionMode === 'off' || !originalImage || !interactionOverlay) return;
        
        // Position relativ zum Overlay
        const rect = interactionOverlay.getBoundingClientRect();
        lastTouchX = (event.clientX - rect.left) / rect.width;
        lastTouchY = (event.clientY - rect.top) / rect.height;
        
        // Position außerhalb des gültigen Bereichs prüfen
        lastTouchX = Math.max(0, Math.min(1, lastTouchX));
        lastTouchY = Math.max(0, Math.min(1, lastTouchY));
        
        // Position aktualisieren
        if (touchPoint) {
            touchPoint.style.left = `${lastTouchX * 100}%`;
            touchPoint.style.top = `${lastTouchY * 100}%`;
        }
        
        // Effekte anwenden mit Drosselung für bessere Performance
        requestAnimationFrame(() => {
            applyInteractiveEffect(lastTouchX, lastTouchY);
        });
    }

    // Touch-Interaktion beenden
    function endInteraction() {
        isTouching = false;
        
        // Visuelles Feedback entfernen
        if (touchPoint) {
            touchPoint.style.opacity = '0';
        }
        
        // Manche Effekte zurücksetzen wenn nötig
        if (interactionMode === 'glitch' && glitchInterval) {
            clearInterval(glitchInterval);
            glitchInterval = null;
            applyFilters(); // Bild zurücksetzen
        }
    }

    // Interaktive Effekte basierend auf Touch/Maus anwenden
    function applyInteractiveEffect(x, y) {
        if (!originalImage) return;
        
        switch(interactionMode) {
            case 'rgbshift':
                // RGB-Shift basierend auf Touch-Position
                const amount = Math.floor(x * 20); // 0-20px Verschiebung
                const angle = Math.floor(y * 360); // 0-360 Grad
                
                // Werte in UI aktualisieren
                if (rgbShiftAmount) {
                    rgbShiftAmount.value = amount;
                    updateSliderValue(rgbShiftAmount);
                }
                
                if (rgbShiftAngle) {
                    rgbShiftAngle.value = angle;
                    updateSliderValue(rgbShiftAngle);
                }
                
                // Wir aktivieren den RGB-Shift, falls noch nicht geschehen
                if (rgbShiftActive) {
                    rgbShiftActive.checked = true;
                }
                
                // Filter anwenden
                applyFilters();
                break;
                
            case 'glitch':
                // Glitch-Effekt mit zufälligen Parametern bei jedem Klick
                if (glitchInterval) {
                    clearInterval(glitchInterval);
                }
                
                // Intensität basierend auf Y-Position
                const intensity = Math.floor((1 - y) * 10); // Y=0 (oben) ist max, Y=1 (unten) ist min
                const speed = Math.floor(x * 10) + 1; // 1-10 für Geschwindigkeit
                
                // Werte in UI aktualisieren
                if (glitchIntensity) {
                    glitchIntensity.value = intensity;
                    updateSliderValue(glitchIntensity);
                }
                
                if (glitchSpeed) {
                    glitchSpeed.value = speed;
                    updateSliderValue(glitchSpeed);
                }
                
                // Wir aktivieren den Glitch, falls noch nicht geschehen
                if (glitchActive) {
                    glitchActive.checked = true;
                }
                
                // Filter anwenden
                applyFilters();
                break;
                
            case 'displacement':
                // Displacement mit dynamischer Stärke
                const scale = Math.floor((1 - y) * 50) + 1; // 1-50 für stärkeren Effekt
                
                // Displacement-Typ basierend auf X-Position
                let type;
                if (x < 0.33) {
                    type = 'noise';
                } else if (x < 0.66) {
                    type = 'waves';
                } else {
                    type = 'turbulence';
                }
                
                // Werte in UI aktualisieren
                if (displacementScale) {
                    displacementScale.value = scale;
                    updateSliderValue(displacementScale);
                }
                
                if (displacementType) {
                    displacementType.value = type;
                }
                
                // Wir aktivieren Displacement, falls noch nicht geschehen
                if (displacementActive) {
                    displacementActive.checked = true;
                }
                
                // Displacement-Map neu erstellen wenn sich der Typ ändert
                createDisplacementMap();
                
                // Filter anwenden
                applyFilters();
                break;
        }
    }

    // Hilfsfunktion zum Aktualisieren der Slider-Werte in der Anzeige
    function updateSliderValue(slider) {
        if (!slider) return;
        
        const valueSpan = document.getElementById(slider.id + 'Value');
        if (valueSpan) {
            let valueText = slider.value;
            
            // Einheit je nach Slider-Typ hinzufügen
            if (slider.id === 'blur' || slider.id === 'pixelate' || slider.id === 'rgbShiftAmount') {
                valueText += 'px';
            } else if (slider.id === 'brightness' || slider.id === 'contrast' || slider.id === 'saturate' ||
                      slider.id === 'grayscale' || slider.id === 'invert' || slider.id === 'sepia') {
                valueText += '%';
            } else if (slider.id === 'hueRotate' || slider.id === 'rgbShiftAngle') {
                valueText += '°';
            }
            
            valueSpan.textContent = valueText;
        }
        
        // Aktualisiere aria-valuenow für Barrierefreiheit
        slider.setAttribute('aria-valuenow', slider.value);
    }

    // Lade Bild von URL
    function loadImageFromUrl() {
        const url = imageUrlInput && imageUrlInput.value ? imageUrlInput.value.trim() : '';
        if (!url) {
            alert('Bitte gib eine Bild-URL ein');
            return;
        }
        
        showLoading();
        loadImage(url);
    }

    // Lade Beispielbild
    function loadSampleImage() {
        // Ein paar Beispielbilder zur Auswahl, die CORS unterstützen
        const sampleImages = [
            'https://images.pexels.com/photos/1266810/pexels-photo-1266810.jpeg?auto=compress&cs=tinysrgb&w=800',
            'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=800',
            'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=800'
        ];
        
        console.log("Lade Beispielbild...");
        
        const randomSample = sampleImages[Math.floor(Math.random() * sampleImages.length)];
        if (imageUrlInput) imageUrlInput.value = randomSample;
        
        showLoading();
        loadImage(randomSample);
    }

    // Bild-Lade-Funktion
    function loadImage(url) {
        console.log("Lade Bild von URL:", url);
        
        // Alten Image-Loader zurücksetzen, falls vorhanden
        if (originalImage) {
            originalImage.onload = null;
            originalImage.onerror = null;
        }
        
        try {
            originalImage = new Image();
            originalImage.crossOrigin = 'anonymous'; // Kleinschreibung ist wichtig
            
            originalImage.onload = function() {
                console.log("Bild wurde erfolgreich geladen:", originalImage.width, "x", originalImage.height);
                
                if (!canvas || !ctx) {
                    console.error('Canvas oder Context nicht verfügbar');
                    hideLoading();
                    return;
                }
                
                // Canvas entsprechend der Bildgröße einstellen
                canvas.width = originalImage.width;
                canvas.height = originalImage.height;
                
                // Anzeige aktualisieren
                if (noImageMessage) noImageMessage.style.display = 'none';
                if (canvasContainer) canvasContainer.style.display = 'block';
                if (interactionModeSwitch) interactionModeSwitch.style.display = 'flex';
                if (filterInfo) filterInfo.style.display = 'none';
                
                // Initialen Zustand zeichnen
                ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
                
                // Barrierefreiheits-Attribute aktualisieren
                canvas.setAttribute('alt', 'Geladenes Bild');
                canvas.setAttribute('aria-label', 'Bearbeitetes Bild, Größe: ' + originalImage.width + ' x ' + originalImage.height);
                
                applyFilters();
                
                // Loading verstecken
                hideLoading();
                
                // Displacement-Map erstellen
                createDisplacementMap();
            };
            
            originalImage.onerror = function(e) {
                console.error("Fehler beim Laden des Bildes:", e);
                alert('Fehler beim Laden des Bildes. Bitte überprüfe die URL oder verwende Bilder von einer Quelle, die CORS unterstützt.');
                hideLoading();
            };
            
            // Versuchen, das Bild zu laden
            originalImage.src = url;
            
            // Fallback: Wenn die Bildquelle bereits im Cache ist, wird onload möglicherweise nicht ausgelöst
            if (originalImage.complete) {
                originalImage.onload();
            }
            
            // Timeout für Bilder, die nicht laden
            setTimeout(() => {
                if (isLoading) {
                    console.warn('Bildladevorgang abgebrochen (Timeout)');
                    hideLoading();
                    alert('Das Bild konnte nicht geladen werden. Bitte versuche es mit einer anderen URL.');
                }
            }, 15000); // 15 Sekunden Timeout
            
        } catch (error) {
            console.error("Ausnahme beim Laden des Bildes:", error);
            hideLoading();
            alert('Ein Fehler ist aufgetreten. Bitte versuche eine andere Bild-URL.');
        }
    }

    // Filter zurücksetzen
    function resetFilters() {
        // Basis-Filter zurücksetzen
        if (blurSlider) blurSlider.value = 0;
        if (brightnessSlider) brightnessSlider.value = 100;
        if (contrastSlider) contrastSlider.value = 100;
        if (hueRotateSlider) hueRotateSlider.value = 0;
        if (invertSlider) invertSlider.value = 0;
        if (saturateSlider) saturateSlider.value = 100;
        if (sepiaSlider) sepiaSlider.value = 0;
        if (pixelateSlider) pixelateSlider.value = 0;
        
        // Spezialeffekte zurücksetzen
        if (rgbShiftActive) rgbShiftActive.checked = false;
        if (rgbShiftAmount) rgbShiftAmount.value = 10;
        if (rgbShiftAngle) rgbShiftAngle.value = 0;
        
        if (glitchActive) glitchActive.checked = false;
        if (glitchIntensity) glitchIntensity.value = 5;
        if (glitchSpeed) glitchSpeed.value = 5;
        
        if (displacementActive) displacementActive.checked = false;
        if (displacementScale) displacementScale.value = 20;
        if (displacementType) displacementType.value = 'noise';
        
        // Glitch-Interval stoppen, falls aktiv
        if (glitchInterval) {
            clearInterval(glitchInterval);
            glitchInterval = null;
        }
        
        // Alle Slider-Werte in der Anzeige aktualisieren
        sliders.forEach(slider => {
            if (slider) updateSliderValue(slider);
        });
        
        // Filter neu anwenden
        applyFilters();
    }

    // Voreinstellungen anwenden
    function applyPreset(preset) {
        // Vorhandene Spezialeffekte deaktivieren
        if (rgbShiftActive) rgbShiftActive.checked = false;
        if (glitchActive) glitchActive.checked = false;
        if (displacementActive) displacementActive.checked = false;
        
        if (glitchInterval) {
            clearInterval(glitchInterval);
            glitchInterval = null;
        }
        
        // Je nach Voreinstellung Filter setzen
        switch(preset) {
            case 'vintage':
                if (blurSlider) blurSlider.value = 0;
                if (brightnessSlider) brightnessSlider.value = 110;
                if (contrastSlider) contrastSlider.value = 85;
                if (hueRotateSlider) hueRotateSlider.value = 0;
                if (invertSlider) invertSlider.value = 0;
                if (saturateSlider) saturateSlider.value = 70;
                if (sepiaSlider) sepiaSlider.value = 50;
                if (pixelateSlider) pixelateSlider.value = 0;
                break;
                
            case 'cold':
                if (blurSlider) blurSlider.value = 0;
                if (brightnessSlider) brightnessSlider.value = 100;
                if (contrastSlider) contrastSlider.value = 110;
                if (hueRotateSlider) hueRotateSlider.value = 180;
                if (invertSlider) invertSlider.value = 0;
                if (saturateSlider) saturateSlider.value = 120;
                if (sepiaSlider) sepiaSlider.value = 0;
                if (pixelateSlider) pixelateSlider.value = 0;
                break;
                
            case 'warm':
                if (blurSlider) blurSlider.value = 0;
                if (brightnessSlider) brightnessSlider.value = 110;
                if (contrastSlider) contrastSlider.value = 105;
                if (hueRotateSlider) hueRotateSlider.value = 30;
                if (invertSlider) invertSlider.value = 0;
                if (saturateSlider) saturateSlider.value = 150;
                if (sepiaSlider) sepiaSlider.value = 20;
                if (pixelateSlider) pixelateSlider.value = 0;
                break;
                
            case 'dramatic':
                if (blurSlider) blurSlider.value = 0;
                if (brightnessSlider) brightnessSlider.value = 90;
                if (contrastSlider) contrastSlider.value = 150;
                if (hueRotateSlider) hueRotateSlider.value = 0;
                if (invertSlider) invertSlider.value = 0;
                if (saturateSlider) saturateSlider.value = 130;
                if (sepiaSlider) sepiaSlider.value = 0;
                if (pixelateSlider) pixelateSlider.value = 0;
                break;
                
            case 'bw':
                if (blurSlider) blurSlider.value = 0;
                if (brightnessSlider) brightnessSlider.value = 105;
                if (contrastSlider) contrastSlider.value = 120;
                if (hueRotateSlider) hueRotateSlider.value = 0;
                if (invertSlider) invertSlider.value = 0;
                if (saturateSlider) saturateSlider.value = 0; // Vollständig entsättigt für S/W
                if (sepiaSlider) sepiaSlider.value = 0;
                if (pixelateSlider) pixelateSlider.value = 0;
                break;
                
            case 'cyberpunk':
                if (blurSlider) blurSlider.value = 0;
                if (brightnessSlider) brightnessSlider.value = 110;
                if (contrastSlider) contrastSlider.value = 140;
                if (hueRotateSlider) hueRotateSlider.value = 0;
                if (invertSlider) invertSlider.value = 0;
                if (saturateSlider) saturateSlider.value = 170;
                if (sepiaSlider) sepiaSlider.value = 0;
                if (pixelateSlider) pixelateSlider.value = 0;
                
                // RGB Shift aktivieren für Cyberpunk Look
                if (rgbShiftActive) rgbShiftActive.checked = true;
                if (rgbShiftAmount) rgbShiftAmount.value = 5;
                if (rgbShiftAngle) rgbShiftAngle.value = 90;
                break;
        }
        
// Slider-Werte in der Anzeige aktualisieren
        sliders.forEach(slider => {
            if (slider) updateSliderValue(slider);
        });
        
        // Filter anwenden
        applyFilters();
    }

    // Displacement Map für spezielle Effekte
    function createDisplacementMap() {
        if (!originalImage || !canvas) return;
        
        // Canvas für die Displacement Map erstellen
        const mapCanvas = document.createElement('canvas');
        const mapCtx = mapCanvas.getContext('2d');
        mapCanvas.width = originalImage.width;
        mapCanvas.height = originalImage.height;
        
        const type = displacementType ? displacementType.value : 'noise';
        
        // Je nach Typ unterschiedliche Displacement Maps erzeugen
        if (type === 'noise') {
            // Zufälliges Rauschen mit Web Worker für bessere Performance
            const imageData = mapCtx.createImageData(mapCanvas.width, mapCanvas.height);
            
            // Optimierte Schleife für bessere Performance
            const data = imageData.data;
            const length = data.length;
            for (let i = 0; i < length; i += 4) {
                const value = Math.floor(Math.random() * 256);
                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
                data[i + 3] = 255;
            }
            
            mapCtx.putImageData(imageData, 0, 0);
        } else if (type === 'waves') {
            // Wellenmuster
            mapCtx.fillStyle = 'black';
            mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
            
            mapCtx.fillStyle = 'white';
            const waveCount = Math.min(10, Math.floor(mapCanvas.height / 30)); // Anpassbare Wellendichte
            
            // Performance-Optimierung durch Begrenzung der Berechnungen
            for (let i = 0; i < waveCount; i++) {
                const y = mapCanvas.height * (i / waveCount);
                mapCtx.beginPath();
                mapCtx.moveTo(0, y);
                
                const step = Math.max(1, Math.floor(mapCanvas.width / 200)); // Reduzierte Sampling-Rate für bessere Performance
                for (let x = 0; x < mapCanvas.width; x += step) {
                    const amplitude = 30;
                    const frequency = 0.02;
                    const yOffset = Math.sin(x * frequency) * amplitude;
                    mapCtx.lineTo(x, y + yOffset);
                }
                
                // Verbinde mit dem rechten Rand
                mapCtx.lineTo(mapCanvas.width, y);
                
                mapCtx.stroke();
            }
        } else if (type === 'turbulence') {
            // Turbulenz-Muster (optimierte Version)
            mapCtx.fillStyle = 'black';
            mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
            
            // Verwende einen kleineren Puffer für bessere Performance
            const scaleFactor = Math.min(1, 400 / Math.max(mapCanvas.width, mapCanvas.height));
            const bufferWidth = Math.round(mapCanvas.width * scaleFactor);
            const bufferHeight = Math.round(mapCanvas.height * scaleFactor);
            
            const imageData = mapCtx.createImageData(bufferWidth, bufferHeight);
            const data = imageData.data;
            
            // Optimierte Schleife
            for (let y = 0; y < bufferHeight; y++) {
                for (let x = 0; x < bufferWidth; x++) {
                    const index = (y * bufferWidth + x) * 4;
                    
                    // Perlin-Noise-ähnliche Funktion (vereinfacht)
                    const nx = x / bufferWidth - 0.5;
                    const ny = y / bufferHeight - 0.5;
                    const value = (Math.sin(nx * 10) + Math.cos(ny * 10)) * 128 + 127;
                    
                    data[index] = value;
                    data[index + 1] = value;
                    data[index + 2] = value;
                    data[index + 3] = 255;
                }
            }
            
            // Zurück zum Canvas skalieren
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = bufferWidth;
            tempCanvas.height = bufferHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);
            
            mapCtx.drawImage(tempCanvas, 0, 0, mapCanvas.width, mapCanvas.height);
        }
        
        displacementMap = mapCanvas;
    }

    // Pixelate-Effekt anwenden
    function applyPixelateEffect(ctx, width, height, pixelSize) {
        if (pixelSize <= 1) return;
        
        // Performance-Optimierung für große Bilder
        const scaleFactor = pixelSize > 10 ? 2 : 1; // Bei sehr großen Pixeln können wir noch stärker optimieren
        const effectivePixelSize = pixelSize * scaleFactor;
        
        // Originalbild sichern
        const originalData = ctx.getImageData(0, 0, width, height);
        
        // Für jeden Pixelblock - optimiert für bessere Performance
        for (let y = 0; y < height; y += effectivePixelSize) {
            for (let x = 0; x < width; x += effectivePixelSize) {
                // Höhe und Breite des aktuellen Blocks anpassen (für Randpixel)
                const blockWidth = Math.min(effectivePixelSize, width - x);
                const blockHeight = Math.min(effectivePixelSize, height - y);
                
                // Sample nur in der Mitte des Blocks für Effizienz
                const centerX = Math.min(x + Math.floor(blockWidth / 2), width - 1);
                const centerY = Math.min(y + Math.floor(blockHeight / 2), height - 1);
                const sampleIndex = (centerY * width + centerX) * 4;
                
                const r = originalData.data[sampleIndex];
                const g = originalData.data[sampleIndex + 1];
                const b = originalData.data[sampleIndex + 2];
                const a = originalData.data[sampleIndex + 3];
                
                // Block mit Farbe füllen
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                ctx.fillRect(x, y, blockWidth, blockHeight);
            }
        }
    }

    // Funktion für RGB-Shift-Effekt
    function applyRGBShift(ctx, width, height, amount, angle) {
        // Performance-Optimierung für große Bilder
        if (width * height > 1000000) {
            // Für sehr große Bilder: einfachere Version mit Shader-ähnlicher Technik
            return applyRGBShiftSimple(ctx, width, height, amount, angle);
        }
        
        // Originalbild sichern
        const originalData = ctx.getImageData(0, 0, width, height);
        const data = new Uint8ClampedArray(originalData.data);
        
        const rad = angle * Math.PI / 180;
        const xShift = Math.cos(rad) * amount;
        const yShift = Math.sin(rad) * amount;
        
        // Verschieben der Farbkanäle
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                
                // Rot-Kanal verschieben
                const redX = Math.floor(x - xShift);
                const redY = Math.floor(y - yShift);
                
                if (redX >= 0 && redX < width && redY >= 0 && redY < height) {
                    const redIdx = (redY * width + redX) * 4;
                    data[i] = originalData.data[redIdx];
                }
                
                // Blau-Kanal verschieben
                const blueX = Math.floor(x + xShift);
                const blueY = Math.floor(y + yShift);
                
                if (blueX >= 0 && blueX < width && blueY >= 0 && blueY < height) {
                    const blueIdx = (blueY * width + blueX) * 4;
                    data[i + 2] = originalData.data[blueIdx + 2];
                }
            }
        }
        
        // Neue Bilddaten setzen
        const newImageData = new ImageData(data, width, height);
        ctx.putImageData(newImageData, 0, 0);
    }

    // Vereinfachte Version für RGB-Shift bei großen Bildern
    function applyRGBShiftSimple(ctx, width, height, amount, angle) {
        // Buffer-Canvas erstellen
        const buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        const bufferCtx = buffer.getContext('2d');
        
        // Original auf den Buffer kopieren
        bufferCtx.drawImage(ctx.canvas, 0, 0);
        
        // Canvas löschen
        ctx.clearRect(0, 0, width, height);
        
        // Winkel in Radianten
        const rad = angle * Math.PI / 180;
        const xShift = Math.cos(rad) * amount;
        const yShift = Math.sin(rad) * amount;
        
        // Rot-Kanal mit Verschiebung zeichnen
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 0, 0, 1)';
        ctx.globalAlpha = 1.0;
        ctx.drawImage(buffer, -xShift, -yShift);
        
        // Grün-Kanal ohne Verschiebung zeichnen
        ctx.fillStyle = 'rgba(0, 255, 0, 1)';
        ctx.globalAlpha = 1.0;
        ctx.drawImage(buffer, 0, 0);
        
        // Blau-Kanal mit Verschiebung in die andere Richtung zeichnen
        ctx.fillStyle = 'rgba(0, 0, 255, 1)';
        ctx.globalAlpha = 1.0;
        ctx.drawImage(buffer, xShift, yShift);
        
        // Zurück zum normalen Compositing
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }

    // Funktion für Glitch-Effekt
    function applyGlitchEffect(ctx, width, height, intensity) {
        // Performance-Optimierung für große Bilder
        const scaleFactor = Math.min(1, 800 / Math.max(width, height));
        
        // Anzahl Glitches basierend auf Intensität und Bildgröße
        const numGlitches = Math.floor(intensity * 3 * scaleFactor);
        
        for (let i = 0; i < numGlitches; i++) {
            const y = Math.floor(Math.random() * height);
            const glitchHeight = Math.floor(Math.random() * 20) + 5;
            const shiftX = (Math.random() - 0.5) * intensity * 20;
            
            if (y + glitchHeight < height) {
                try {
                    const imageData = ctx.getImageData(0, y, width, glitchHeight);
                    ctx.putImageData(imageData, shiftX, y);
                } catch (e) {
                    console.error("Fehler beim Glitch-Effekt:", e);
                    // Fehlerfall ignorieren und weitermachen
                }
            }
        }
        
        // Zufällige Farbverschiebungen - weniger intensiv bei großen Bildern
        const colorShift = Math.floor(Math.random() * 3);
        if (colorShift === 0 && Math.random() < 0.7 * scaleFactor) {
            try {
                const sampleWidth = Math.min(width, 500); // Beschränke die Größe für bessere Performance
                const sampleHeight = Math.min(height, 500);
                const sampleX = Math.floor(Math.random() * (width - sampleWidth));
                const sampleY = Math.floor(Math.random() * (height - sampleHeight));
                
                const imageData = ctx.getImageData(sampleX, sampleY, sampleWidth, sampleHeight);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    // Zufällige Farbkanalvertauschung
                    if (Math.random() < 0.05 * intensity) {
                        const temp = data[i];
                        data[i] = data[i + 1];
                        data[i + 1] = data[i + 2];
                        data[i + 2] = temp;
                    }
                }
                
                ctx.putImageData(imageData, sampleX, sampleY);
            } catch (e) {
                console.error("Fehler bei Farbverschiebungen:", e);
            }
        }
    }

    // Funktion für Displacement-Effekt
    function applyDisplacementEffect(ctx, scale) {
        if (!displacementMap || !originalImage || !canvas) return;
        
        const width = canvas.width;
        const height = canvas.height;
        
        // Performance-Optimierung für große Bilder
        const pixelStep = Math.max(1, Math.floor(Math.sqrt(width * height) / 1000)); // Samplerate anpassen
        
        // Originalbild neu zeichnen
        ctx.drawImage(originalImage, 0, 0, width, height);
        
        try {
            // Original-Bilddaten holen
            const originalData = ctx.getImageData(0, 0, width, height);
            const result = ctx.createImageData(width, height);
            const resultData = result.data;
            
            // Displacement-Map-Daten holen
            const mapCtx = displacementMap.getContext('2d');
            const mapData = mapCtx.getImageData(0, 0, width, height).data;
            
            // Displacement anwenden mit optimierter Schleife
            for (let y = 0; y < height; y += pixelStep) {
                for (let x = 0; x < width; x += pixelStep) {
                    const i = (y * width + x) * 4;
                    
                    // Map-Werte als Verschiebungsvektoren verwenden
                    const mapValue = mapData[i] / 255; // normalisieren (0-1)
                    const displaceX = Math.floor(x + (mapValue - 0.5) * scale * 2);
                    const displaceY = Math.floor(y + (mapValue - 0.5) * scale * 2);
                    
                    // Sicherstellen, dass wir innerhalb der Bildgrenzen bleiben
                    if (displaceX >= 0 && displaceX < width && displaceY >= 0 && displaceY < height) {
                        const displacedIdx = (displaceY * width + displaceX) * 4;
                        
                        // Pixel setzen
                        resultData[i] = originalData.data[displacedIdx];
                        resultData[i + 1] = originalData.data[displacedIdx + 1];
                        resultData[i + 2] = originalData.data[displacedIdx + 2];
                        resultData[i + 3] = originalData.data[displacedIdx + 3];
                        
                        // Bei pixelStep > 1: Fülle die Lücken mit dem gleichen Pixel
                        if (pixelStep > 1) {
                            for (let py = 0; py < pixelStep && y + py < height; py++) {
                                for (let px = 0; px < pixelStep && x + px < width; px++) {
                                    if (px === 0 && py === 0) continue; // Überspringe das bereits gesetzte Pixel
                                    
                                    const fillIdx = ((y + py) * width + (x + px)) * 4;
                                    resultData[fillIdx] = resultData[i];
                                    resultData[fillIdx + 1] = resultData[i + 1];
                                    resultData[fillIdx + 2] = resultData[i + 2];
                                    resultData[fillIdx + 3] = resultData[i + 3];
                                }
                            }
                        }
                    }
                }
            }
            
            // Neue Bilddaten setzen
            ctx.putImageData(result, 0, 0);
        } catch (e) {
            console.error("Fehler beim Displacement-Effekt:", e);
            // Im Fehlerfall das Original behalten
            ctx.drawImage(originalImage, 0, 0, width, height);
        }
    }

    // Filter anwenden Funktion
    function applyFilters() {
        if (!originalImage || !canvas || !ctx) {
            console.log("Kann Filter nicht anwenden: Bild oder Canvas nicht geladen");
            return;
        }
        
        try {
            // Canvas-Kontext zurücksetzen und Originalbild zeichnen
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
            
            // Pixelate-Effekt
            const pixelateVal = pixelateSlider ? parseInt(pixelateSlider.value) : 0;
            if (pixelateVal > 1) {
                applyPixelateEffect(ctx, canvas.width, canvas.height, pixelateVal);
            }
            
            // Basis-Filter aus Slidern holen
            const blurVal = blurSlider ? blurSlider.value : 0;
            const brightnessVal = brightnessSlider ? brightnessSlider.value : 100;
            const contrastVal = contrastSlider ? contrastSlider.value : 100;
            const hueRotateVal = hueRotateSlider ? hueRotateSlider.value : 0;
            const invertVal = invertSlider ? invertSlider.value : 0;
            const saturateVal = saturateSlider ? saturateSlider.value : 100;
            const sepiaVal = sepiaSlider ? sepiaSlider.value : 0;
            
            // CSS-Filter-String zusammenbauen
            let filterString = '';
            if (blurVal > 0) filterString += `blur(${blurVal}px) `;
            if (brightnessVal != 100) filterString += `brightness(${brightnessVal}%) `;
            if (contrastVal != 100) filterString += `contrast(${contrastVal}%) `;
            if (hueRotateVal > 0) filterString += `hue-rotate(${hueRotateVal}deg) `;
            if (invertVal > 0) filterString += `invert(${invertVal}%) `;
            if (saturateVal != 100) filterString += `saturate(${saturateVal}%) `;
            if (sepiaVal > 0) filterString += `sepia(${sepiaVal}%) `;
            
            if (filterString === '') filterString = 'none';
            
            // CSS-Filter anwenden für Basis-Filter
            canvas.style.filter = filterString;
            
            // CSS-Code in der Anzeige aktualisieren
            if (cssCode) {
                cssCode.textContent = `filter: ${filterString};`;
            }
            
            // Fortgeschrittene Effekte anwenden, die Canvas-Manipulation erfordern
            
            // Displacement-Effekt
            if (displacementActive && displacementActive.checked) {
                const scale = parseInt(displacementScale ? displacementScale.value : 20);
                applyDisplacementEffect(ctx, scale);
                
                // CSS-Code aktualisieren
                if (cssCode) {
                    cssCode.textContent += `\n/* Displacement-Effekt wird mit Canvas-Manipulation angewendet */`;
                }
            }
            
            // RGB-Shift-Effekt
            if (rgbShiftActive && rgbShiftActive.checked) {
                const amount = parseInt(rgbShiftAmount ? rgbShiftAmount.value : 10);
                const angle = parseInt(rgbShiftAngle ? rgbShiftAngle.value : 0);
                applyRGBShift(ctx, canvas.width, canvas.height, amount, angle);
                
                // CSS-Code aktualisieren
                if (cssCode) {
                    cssCode.textContent += `\n/* RGB-Shift wird mit Canvas-Manipulation angewendet */`;
                }
            }
            
            // Glitch-Effekt
            if (glitchActive && glitchActive.checked) {
                const intensity = parseInt(glitchIntensity ? glitchIntensity.value : 5);
                const speed = parseInt(glitchSpeed ? glitchSpeed.value : 5);
                
                // Wenn bereits ein Interval läuft, diesen stoppen
                if (glitchInterval) {
                    clearInterval(glitchInterval);
                }
                
                // Neuen Interval starten
                glitchInterval = setInterval(() => {
                    // Bild zurücksetzen
                    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
                    
                    // Pixelate-Effekt erneut anwenden, falls aktiv
                    if (pixelateVal > 1) {
                        applyPixelateEffect(ctx, canvas.width, canvas.height, pixelateVal);
                    }
                    
                    // Displacement und RGB-Shift vor Glitch erneut anwenden, wenn aktiv
                    if (displacementActive && displacementActive.checked) {
                        const scale = parseInt(displacementScale ? displacementScale.value : 20);
                        applyDisplacementEffect(ctx, scale);
                    }
                    
                    if (rgbShiftActive && rgbShiftActive.checked) {
                        const amount = parseInt(rgbShiftAmount ? rgbShiftAmount.value : 10);
                        const angle = parseInt(rgbShiftAngle ? rgbShiftAngle.value : 0);
                        applyRGBShift(ctx, canvas.width, canvas.height, amount, angle);
                    }
                    
                    // Glitch-Effekt anwenden
                    applyGlitchEffect(ctx, canvas.width, canvas.height, intensity);
                }, 1000 / (speed + 1));
                
                // CSS-Code aktualisieren
                if (cssCode) {
                    cssCode.textContent += `\n/* Glitch-Effekt wird mit Canvas-Manipulation angewendet */`;
                }
            }
            
            // Pixelate-Effekt erwähnen, falls aktiv
            if (pixelateVal > 1 && cssCode) {
                cssCode.textContent += `\n/* Pixelate-Effekt wird mit Canvas-Manipulation angewendet */`;
            }
        } catch (error) {
            console.error("Fehler beim Anwenden der Filter:", error);
        }
    }

    // Bild herunterladen
    function downloadImage() {
        if (!canvas) {
            console.error("Canvas nicht gefunden!");
            return;
        }
        
        try {
            // Temporären Link erstellen
            const link = document.createElement('a');
            
            // Füge Zeitstempel und Gerätetyp hinzu
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const isMobile = window.innerWidth <= 768;
            const deviceType = isMobile ? 'mobile' : 'desktop';
            
            link.download = `quantum-image-${deviceType}-${timestamp}.png`;
            
            // Canvas-Inhalt als Daten-URL abrufen
            link.href = canvas.toDataURL('image/png');
            
            // Link klicken, um Download zu starten
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Tracking des Downloads, falls Analytics vorhanden
            if (window.gtag) {
                window.gtag('event', 'download_image', {
                    'event_category': 'engagement',
                    'event_label': deviceType
                });
            }
        } catch (error) {
            console.error("Fehler beim Herunterladen des Bildes:", error);
            alert("Fehler beim Herunterladen des Bildes. Versuche es mit einem anderen Browser oder überprüfe die CORS-Einstellungen.");
        }
    }

    // Initialisiere die Anzeige der Slider-Werte
    sliders.forEach(slider => {
        if (slider) updateSliderValue(slider);
    });

    // Automatisches Beispielbild laden, wenn URL-Parameter vorhanden ist
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('sample') && urlParams.get('sample') === 'true') {
        loadSampleImage();
    }

    // Tastatursteuerung für bessere Zugänglichkeit
    document.addEventListener('keydown', function(e) {
        // Nur reagieren, wenn kein Formular-Element den Fokus hat
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA' || 
            document.activeElement.tagName === 'SELECT') {
            return;
        }
        
        // Shortcuts
        switch (e.key) {
            case 'r':
                if (e.ctrlKey) {
                    e.preventDefault(); // Verhindert Seiten-Reload
                    resetFilters();
                }
                break;
            case 's':
                if (e.ctrlKey) {
                    e.preventDefault(); // Verhindert Browser-Speichern
                    downloadImage();
                }
                break;
            case 'l':
                if (e.ctrlKey) {
                    e.preventDefault();
                    loadSampleImage();
                }
                break;
        }
    });
});

// Globales Error-Handling
window.addEventListener('error', function(e) {
    console.error("Globaler Fehler:", e.message, "in", e.filename, "Zeile", e.lineno);
    
    // Versuche, den Loading-Screen zu entfernen, falls ein Fehler auftritt
    const loading = document.querySelector('.loading');
    if (loading && loading.parentNode) {
        loading.parentNode.removeChild(loading);
    }
});

// Service Worker registrieren für Offline-Nutzung
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').then(function(registration) {
            console.log('ServiceWorker erfolgreich registriert mit Scope:', registration.scope);
        }, function(err) {
            console.log('ServiceWorker-Registrierung fehlgeschlagen:', err);
        });
    });
}
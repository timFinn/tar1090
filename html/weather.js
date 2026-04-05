// weather.js — Weather overlay system for tar1090
// Core module: region detection, provider registry, animation controller

'use strict';

// ---- Global weather state ----
var weather_providers = [];
var weather_activeProvider = null;
var weather_layers = [];
var weather_animFrames = [];
var weather_animIndex = 0;
var weather_animPlaying = false;
var weather_animTimer = null;
var weather_animSpeed = 2; // frames per second (1x=1, 2x=2, 4x=4)
var weather_map = null;
var weather_enabled = (typeof weatherEnabled !== 'undefined') ? weatherEnabled : false;
var weather_defaultLayers = (typeof weatherDefaultLayers !== 'undefined') ? weatherDefaultLayers : [];

// ---- Region bounding boxes ----
var weather_regions = {
    us: { name: 'US', latMin: 24, latMax: 50, lonMin: -125, lonMax: -66 },
    eu: { name: 'EU', latMin: 35, latMax: 72, lonMin: -25, lonMax: 45 }
};

// ---- Region detection ----
function weatherDetectRegion() {
    if (typeof SiteLat === 'undefined' || typeof SiteLon === 'undefined') {
        return 'global';
    }
    var lat = Number(SiteLat);
    var lon = Number(SiteLon);
    for (var key in weather_regions) {
        var r = weather_regions[key];
        if (lat >= r.latMin && lat <= r.latMax && lon >= r.lonMin && lon <= r.lonMax) {
            return key;
        }
    }
    return 'global';
}

// ---- Provider registry ----
// Providers call weatherRegisterProvider() during their script load.
// Each provider object must have:
//   .region    - 'us', 'eu', or 'global'
//   .name      - display name
//   .getLayers() - returns array of OpenLayers layer objects
function weatherRegisterProvider(provider) {
    weather_providers.push(provider);
}

function weatherSelectProvider() {
    var region = weatherDetectRegion();
    // Try exact region match first
    for (var i = 0; i < weather_providers.length; i++) {
        if (weather_providers[i].region === region) {
            return weather_providers[i];
        }
    }
    // Fallback to global
    for (var i = 0; i < weather_providers.length; i++) {
        if (weather_providers[i].region === 'global') {
            return weather_providers[i];
        }
    }
    return null;
}

// ---- Animation controller ----
function weatherStartAnimation() {
    if (weather_animPlaying) return;
    weather_animPlaying = true;
    var delay = 1000 / weather_animSpeed;
    weather_animTimer = setInterval(weatherAdvanceFrame, delay);
    weatherUiUpdatePlayState(true);
}

function weatherStopAnimation() {
    weather_animPlaying = false;
    if (weather_animTimer) {
        clearInterval(weather_animTimer);
        weather_animTimer = null;
    }
    weatherUiUpdatePlayState(false);
}

function weatherToggleAnimation() {
    if (weather_animPlaying) {
        weatherStopAnimation();
    } else {
        weatherStartAnimation();
    }
}

function weatherSetSpeed(speed) {
    weather_animSpeed = speed;
    if (weather_animPlaying) {
        weatherStopAnimation();
        weatherStartAnimation();
    }
    weatherUiUpdateSpeed(speed);
}

function weatherAdvanceFrame() {
    if (weather_animFrames.length === 0) return;
    weather_animIndex++;
    if (weather_animIndex >= weather_animFrames.length) {
        // Pause briefly at newest frame, then loop
        weatherStopAnimation();
        weather_animIndex = weather_animFrames.length - 1;
        weatherShowFrame(weather_animIndex);
        setTimeout(function() {
            weather_animIndex = 0;
            weatherShowFrame(0);
            weatherStartAnimation();
        }, 1500);
        return;
    }
    weatherShowFrame(weather_animIndex);
}

function weatherStepForward() {
    weatherStopAnimation();
    if (weather_animIndex < weather_animFrames.length - 1) {
        weather_animIndex++;
        weatherShowFrame(weather_animIndex);
    }
}

function weatherStepBackward() {
    weatherStopAnimation();
    if (weather_animIndex > 0) {
        weather_animIndex--;
        weatherShowFrame(weather_animIndex);
    }
}

function weatherSkipToStart() {
    weatherStopAnimation();
    weather_animIndex = 0;
    weatherShowFrame(0);
}

function weatherSkipToEnd() {
    weatherStopAnimation();
    weather_animIndex = weather_animFrames.length - 1;
    weatherShowFrame(weather_animIndex);
}

function weatherShowFrame(index) {
    if (index < 0 || index >= weather_animFrames.length) return;
    var frame = weather_animFrames[index];

    // Hide all frame layers, show the active one
    for (var i = 0; i < weather_animFrames.length; i++) {
        if (weather_animFrames[i].layer) {
            weather_animFrames[i].layer.setVisible(i === index);
        }
    }

    // For WMS sources, update TIME parameter instead of swapping layers
    if (frame.wmsSource && frame.time) {
        frame.wmsSource.updateParams({ TIME: frame.time });
    }

    weatherUiUpdateSlider(index, weather_animFrames.length);
    weatherUiUpdateTimestamp(frame.timestamp);
}

// ---- Frame loading ----
// Called by the active provider when frames are fetched.
// frames: array of { timestamp (unix seconds), url (tile URL template), time (ISO string, for WMS) }
function weatherSetFrames(frames, sourceInfo) {
    // Clean up old frame layers
    for (var i = 0; i < weather_animFrames.length; i++) {
        if (weather_animFrames[i].layer && weather_map) {
            weather_map.removeLayer(weather_animFrames[i].layer);
        }
    }
    weather_animFrames = [];
    weather_animIndex = 0;

    if (!frames || frames.length === 0) return;

    // Limit to 24 frames max
    if (frames.length > 48) {
        frames = frames.slice(frames.length - 48);
    }

    for (var i = 0; i < frames.length; i++) {
        var f = frames[i];
        var layer = null;

        if (f.type === 'xyz') {
            layer = new ol.layer.Tile({
                source: new ol.source.XYZ({
                    url: f.url,
                    attributions: f.attribution || '',
                    maxZoom: f.maxZoom || 12,
                }),
                opacity: f.opacity || 0.35,
                visible: false,
                zIndex: 50,
            });
        } else if (f.type === 'wms') {
            // WMS layers share a single source; we just update TIME
            // The first frame creates the layer; subsequent frames reuse it
            if (i === 0) {
                var wmsSource = new ol.source.TileWMS({
                    url: f.url,
                    params: Object.assign({ TIME: f.time }, f.params || {}),
                    attributions: f.attribution || '',
                });
                layer = new ol.layer.Tile({
                    source: wmsSource,
                    opacity: f.opacity || 0.35,
                    visible: false,
                    zIndex: 50,
                });
                f.wmsSource = wmsSource;
            } else {
                // Reuse the first frame's layer and source
                layer = weather_animFrames[0].layer;
                f.layer = layer;
                f.wmsSource = weather_animFrames[0].wmsSource;
            }
        }

        if (layer && (f.type === 'xyz' || i === 0)) {
            weather_map.addLayer(layer);
        }

        weather_animFrames.push({
            timestamp: f.timestamp,
            time: f.time || null,
            layer: layer || (weather_animFrames.length > 0 ? weather_animFrames[0].layer : null),
            wmsSource: f.wmsSource || null,
            url: f.url,
        });
    }

    // Show the most recent frame
    weather_animIndex = weather_animFrames.length - 1;
    weatherShowFrame(weather_animIndex);

    // Update UI
    weatherUiSetSourceLabel(sourceInfo.label || 'Weather Radar');
    weatherUiSetLegend(sourceInfo.legend || null);
    weatherUiShow();

    // Auto-play animation when frames load
    weatherStartAnimation();
}

// ---- Blitzortung lightning (global) ----
var weather_lightningSource = null;
var weather_lightningLayer = null;
var weather_lightningWs = null;
var weather_lightningStrikes = [];
var WEATHER_LIGHTNING_MAX_AGE = 600000; // 10 minutes in ms

function weatherInitLightning() {
    weather_lightningSource = new ol.source.Vector();
    weather_lightningLayer = new ol.layer.Vector({
        name: 'lightning',
        title: 'Lightning (Blitzortung)',
        type: 'overlay',
        source: weather_lightningSource,
        visible: false,
        zIndex: 60,
        style: new ol.style.Style({
            image: new ol.style.Circle({
                radius: 3,
                fill: new ol.style.Fill({ color: 'rgba(255, 255, 100, 0.8)' }),
                stroke: new ol.style.Stroke({ color: 'rgba(255, 200, 0, 1)', width: 1 }),
            }),
        }),
    });
    return weather_lightningLayer;
}

function weatherConnectLightning() {
    if (weather_lightningWs) return;
    try {
        weather_lightningWs = new WebSocket('wss://ws1.blitzortung.org/');
        weather_lightningWs.onopen = function() {
            weather_lightningWs.send(JSON.stringify({ a: 111 }));
        };
        weather_lightningWs.onmessage = function(evt) {
            try {
                var data = JSON.parse(evt.data);
                if (data.lat && data.lon) {
                    var coords = ol.proj.fromLonLat([data.lon, data.lat]);
                    var feature = new ol.Feature({
                        geometry: new ol.geom.Point(coords),
                        timestamp: Date.now(),
                    });
                    weather_lightningSource.addFeature(feature);
                    weather_lightningStrikes.push(feature);
                }
            } catch (e) { /* ignore parse errors */ }
        };
        weather_lightningWs.onclose = function() {
            weather_lightningWs = null;
            setTimeout(weatherConnectLightning, 10000);
        };
        weather_lightningWs.onerror = function() {
            weather_lightningWs.close();
        };
    } catch (e) {
        console.warn('Blitzortung WebSocket unavailable:', e.message);
    }
}

function weatherPruneLightning() {
    var now = Date.now();
    var cutoff = now - WEATHER_LIGHTNING_MAX_AGE;
    var toRemove = [];
    for (var i = 0; i < weather_lightningStrikes.length; i++) {
        if (weather_lightningStrikes[i].get('timestamp') < cutoff) {
            toRemove.push(weather_lightningStrikes[i]);
        }
    }
    for (var i = 0; i < toRemove.length; i++) {
        weather_lightningSource.removeFeature(toRemove[i]);
    }
    weather_lightningStrikes = weather_lightningStrikes.filter(function(f) {
        return f.get('timestamp') >= cutoff;
    });
}

// ---- Initialization (called from script.js after map init) ----
function weatherInit(mapInstance) {
    if (!weather_enabled) return;

    weather_map = mapInstance;

    // Select provider based on station location
    weather_activeProvider = weatherSelectProvider();
    if (!weather_activeProvider) {
        console.warn('No weather provider available');
        return;
    }

    console.log('Weather: using ' + weather_activeProvider.name + ' provider (region: ' + weather_activeProvider.region + ')');

    // Initialize lightning (global, all providers)
    var lightningLayer = weatherInitLightning();

    // Get layers from the active provider
    var providerLayers = weather_activeProvider.getLayers();
    weather_layers = providerLayers.concat([lightningLayer]);

    // Build the Weather layer group for the layer switcher
    var weatherGroup = new ol.layer.Group({
        title: '\u26C5 Weather',
        layers: weather_layers,
    });

    // Insert the weather group into the existing layers_group
    if (typeof layers_group !== 'undefined') {
        var existingLayers = layers_group.getLayers();
        existingLayers.insertAt(1, weatherGroup);
    }

    // Create the animation UI
    weatherUiCreate();

    // Set default layer visibility from config
    for (var i = 0; i < weather_layers.length; i++) {
        var lyr = weather_layers[i];
        var lyrName = lyr.get('name');
        var stored = (typeof lopaStore !== 'undefined') ? lopaStore['layer_' + lyrName] : undefined;
        if (stored !== undefined) {
            lyr.setVisible(stored === 'true');
        } else if (weather_defaultLayers.indexOf(lyrName) >= 0 || (weather_defaultLayers.indexOf('radar') >= 0 && lyr.get('weatherType') === 'radar')) {
            lyr.setVisible(true);
        }
    }

    // Hook layer visibility changes to show/hide animation bar
    for (var i = 0; i < weather_layers.length; i++) {
        (function(lyr) {
            lyr.on('change:visible', function() {
                if (typeof lopaStore !== 'undefined') {
                    lopaStore['layer_' + lyr.get('name')] = lyr.getVisible() ? 'true' : 'false';
                }
                weatherOnLayerVisibilityChange(lyr);
            });
        })(weather_layers[i]);
    }

    // Start lightning pruning timer
    setInterval(weatherPruneLightning, 30000);
}

function weatherOnLayerVisibilityChange(changedLayer) {
    var anyRadarVisible = false;
    for (var i = 0; i < weather_layers.length; i++) {
        if (weather_layers[i].get('weatherType') === 'radar' && weather_layers[i].getVisible()) {
            anyRadarVisible = true;
            break;
        }
    }

    if (anyRadarVisible) {
        weatherUiShow();
        var visibleRadar = null;
        for (var i = 0; i < weather_layers.length; i++) {
            if (weather_layers[i].get('weatherType') === 'radar' && weather_layers[i].getVisible()) {
                visibleRadar = weather_layers[i];
                break;
            }
        }
        if (visibleRadar && visibleRadar.get('weatherLoadFrames')) {
            visibleRadar.get('weatherLoadFrames')();
        }
    } else {
        weatherStopAnimation();
        weatherUiHide();
    }

    if (weather_lightningLayer && weather_lightningLayer.getVisible()) {
        weatherConnectLightning();
    } else if (weather_lightningWs) {
        weather_lightningWs.close();
        weather_lightningWs = null;
    }
}

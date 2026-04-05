// weather-eu.js — European weather provider
// Sources: DWD RADOLAN (Germany/Central Europe)

'use strict';

(function() {
    var DWD_WMS_URL = 'https://maps.dwd.de/geoserver/wms';
    var DWD_LAYER = (typeof dwdLayers !== 'undefined') ? dwdLayers : 'dwd:RADOLAN-RY';
    var refreshTimer = null;

    // DWD extent (Germany + surrounding area)
    var dwdExtent = ol.proj.transformExtent([1.9, 46.2, 16.0, 55.0], 'EPSG:4326', 'EPSG:3857');

    function fetchDwdFrames() {
        var frames = [];
        var now = new Date();
        var interval = 300000; // 5 min in ms
        var count = 24;

        for (var i = count - 1; i >= 0; i--) {
            var t = new Date(now.getTime() - (i * interval));
            t.setMinutes(Math.floor(t.getMinutes() / 5) * 5, 0, 0);
            var isoTime = t.toISOString();

            frames.push({
                timestamp: Math.floor(t.getTime() / 1000),
                time: isoTime,
                url: DWD_WMS_URL,
                type: 'wms',
                params: {
                    LAYERS: DWD_LAYER,
                    FORMAT: 'image/png',
                    TRANSPARENT: true,
                },
                opacity: (typeof dwdRadolanOpacity !== 'undefined') ? dwdRadolanOpacity : 0.35,
                attribution: '© <a href="https://www.dwd.de/">Deutscher Wetterdienst</a>',
            });
        }

        weatherSetFrames(frames, {
            label: 'DWD RADOLAN — 2h history',
            legend: {
                label: 'dBZ',
                gradient: 'linear-gradient(90deg, #b3b3ff 0%, #6666ff 15%, #0000ff 25%, #00cc00 38%, #ffff00 50%, #ffcc00 62%, #ff6600 72%, #ff0000 82%, #cc0066 92%, #800080 100%)',
                stops: ['5', '10', '20', '30', '40', '50', '60', '70+'],
            },
        });
    }

    function createRadolanLayer() {
        var layer = new ol.layer.Tile({
            name: 'dwd_radolan',
            title: 'DWD RADOLAN Radar',
            type: 'overlay',
            visible: false,
            zIndex: 52,
            extent: dwdExtent,
            source: new ol.source.TileWMS({
                url: DWD_WMS_URL,
                params: {
                    LAYERS: DWD_LAYER,
                    FORMAT: 'image/png',
                    TRANSPARENT: true,
                },
            }),
            opacity: (typeof dwdRadolanOpacity !== 'undefined') ? dwdRadolanOpacity : 0.35,
        });
        layer.set('weatherType', 'radar');
        layer.set('weatherLoadFrames', function() {
            fetchDwdFrames();
            if (!refreshTimer) {
                refreshTimer = setInterval(fetchDwdFrames, 300000);
            }
        });
        return layer;
    }

    weatherRegisterProvider({
        region: 'eu',
        name: 'EU (DWD RADOLAN)',
        getLayers: function() {
            return [
                createRadolanLayer(),
            ];
        },
    });
})();

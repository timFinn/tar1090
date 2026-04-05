// weather-global.js — Global weather provider using RainViewer
// Fallback for stations outside US/EU coverage

'use strict';

(function() {
    var RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';
    var radarFrameData = null;
    var refreshTimer = null;

    function fetchRainViewerFrames() {
        fetch(RAINVIEWER_API)
            .then(function(resp) { return resp.json(); })
            .then(function(data) {
                radarFrameData = data;
                buildFrames();
            })
            .catch(function(err) {
                console.warn('RainViewer API error:', err.message);
            });
    }

    function buildFrames() {
        if (!radarFrameData) return;

        var past = radarFrameData.radar ? radarFrameData.radar.past : [];
        if (!past || past.length === 0) return;

        var host = radarFrameData.host || 'https://tilecache.rainviewer.com';
        var frames = [];

        for (var i = 0; i < past.length; i++) {
            frames.push({
                timestamp: past[i].time,
                url: host + past[i].path + '/256/{z}/{x}/{y}/2/1_1.png',
                type: 'xyz',
                maxZoom: 7,
                opacity: (typeof rainViewerRadarOpacity !== 'undefined') ? rainViewerRadarOpacity : 0.35,
                attribution: '© <a href="https://www.rainviewer.com/">RainViewer</a>',
            });
        }

        weatherSetFrames(frames, {
            label: 'RainViewer Radar — ' + Math.round(past.length * 10 / 60) + '0m history',
            legend: {
                label: 'dBZ',
                gradient: 'linear-gradient(90deg, #004488 0%, #009900 18%, #00cc00 30%, #ffcc00 45%, #ff6600 58%, #ff0000 72%, #cc00cc 88%, #ffffff 100%)',
                stops: ['5', '15', '25', '35', '45', '55', '65+'],
            },
        });
    }

    function createRadarLayer() {
        var layer = new ol.layer.Tile({
            name: 'rainviewer_radar',
            title: 'Radar (RainViewer)',
            type: 'overlay',
            visible: false,
            zIndex: 50,
            source: new ol.source.XYZ({ url: '' }),
        });
        layer.set('weatherType', 'radar');
        layer.set('weatherLoadFrames', function() {
            fetchRainViewerFrames();
            if (!refreshTimer) {
                refreshTimer = setInterval(fetchRainViewerFrames, 120000);
            }
        });
        return layer;
    }

    function createSatelliteLayer() {
        var layer = new ol.layer.Tile({
            name: 'rainviewer_satellite',
            title: 'Satellite (RainViewer)',
            type: 'overlay',
            visible: false,
            zIndex: 45,
            source: new ol.source.XYZ({ url: '' }),
        });
        layer.set('weatherType', 'satellite');
        layer.set('weatherLoadFrames', function() {
            fetch(RAINVIEWER_API)
                .then(function(resp) { return resp.json(); })
                .then(function(data) {
                    var infrared = data.satellite && data.satellite.infrared;
                    if (infrared && infrared.length > 0) {
                        var latest = infrared[infrared.length - 1];
                        var host = data.host || 'https://tilecache.rainviewer.com';
                        layer.getSource().setUrl(host + latest.path + '/256/{z}/{x}/{y}/0/0_0.png');
                        layer.getSource().refresh();
                    }
                })
                .catch(function(err) {
                    console.warn('RainViewer satellite error:', err.message);
                });
        });
        return layer;
    }

    weatherRegisterProvider({
        region: 'global',
        name: 'RainViewer (Global)',
        getLayers: function() {
            return [
                createRadarLayer(),
                createSatelliteLayer(),
            ];
        },
    });
})();

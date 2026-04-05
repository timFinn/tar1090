// weather-us.js — US weather provider (CONUS)
// Sources: MRMS (IEM), NEXRAD (IEM), GOES IR (NOAA NowCOAST)

'use strict';

(function() {
    var IEM_TILE_BASE = 'https://mesonet{1-3}.agron.iastate.edu/cache/tile.py/1.0.0';

    var mrmsRefreshTimer = null;
    var nexradRefreshTimer = null;

    // ---- MRMS Radar ----
    function fetchMrmsFrames() {
        var frames = [];
        var now = Math.floor(Date.now() / 1000);
        var interval = 300; // 5 minutes
        var count = 24; // 2 hours

        for (var i = count - 1; i >= 0; i--) {
            var ts = now - (i * interval);
            ts = Math.floor(ts / interval) * interval;
            frames.push({
                timestamp: ts,
                url: IEM_TILE_BASE + '/q2-n1p-900913/{z}/{x}/{y}.png?_=' + ts,
                type: 'xyz',
                maxZoom: 12,
                opacity: (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.35,
                attribution: '© <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a>',
            });
        }

        weatherSetFrames(frames, {
            label: 'MRMS Radar — 2h history',
            legend: {
                label: 'dBZ',
                gradient: 'linear-gradient(90deg, #004488 0%, #009900 18%, #00cc00 30%, #ffcc00 45%, #ff6600 58%, #ff0000 72%, #cc00cc 88%, #ffffff 100%)',
                stops: ['5', '15', '25', '35', '45', '55', '65+'],
            },
        });
    }

    function createMrmsLayer() {
        var layer = new ol.layer.Tile({
            name: 'mrms_radar',
            title: 'MRMS Radar (high-res)',
            type: 'overlay',
            visible: false,
            zIndex: 52,
            source: new ol.source.XYZ({ url: '' }),
        });
        layer.set('weatherType', 'radar');
        layer.set('weatherLoadFrames', function() {
            fetchMrmsFrames();
            if (!mrmsRefreshTimer) {
                mrmsRefreshTimer = setInterval(fetchMrmsFrames, 120000);
            }
        });
        return layer;
    }

    // ---- NEXRAD ----
    function fetchNexradFrames() {
        var frames = [];
        var now = Math.floor(Date.now() / 1000);
        var interval = 300;
        var count = 24;

        for (var i = count - 1; i >= 0; i--) {
            var ts = now - (i * interval);
            ts = Math.floor(ts / interval) * interval;
            frames.push({
                timestamp: ts,
                url: IEM_TILE_BASE + '/nexrad-n0q-900913/{z}/{x}/{y}.png?_=' + ts,
                type: 'xyz',
                maxZoom: 8,
                opacity: (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.35,
                attribution: '© <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a>',
            });
        }

        weatherSetFrames(frames, {
            label: 'NEXRAD Radar — 2h history',
            legend: {
                label: 'dBZ',
                gradient: 'linear-gradient(90deg, #004488 0%, #009900 18%, #00cc00 30%, #ffcc00 45%, #ff6600 58%, #ff0000 72%, #cc00cc 88%, #ffffff 100%)',
                stops: ['5', '15', '25', '35', '45', '55', '65+'],
            },
        });
    }

    function createNexradLayer() {
        var layer = new ol.layer.Tile({
            name: 'nexrad',
            title: 'NEXRAD Radar',
            type: 'overlay',
            visible: false,
            zIndex: 51,
            source: new ol.source.XYZ({ url: '' }),
        });
        layer.set('weatherType', 'radar');
        layer.set('weatherLoadFrames', function() {
            fetchNexradFrames();
            if (!nexradRefreshTimer) {
                nexradRefreshTimer = setInterval(fetchNexradFrames, 120000);
            }
        });
        return layer;
    }

    // ---- GOES IR Satellite ----
    function createGoesLayer() {
        var source = new ol.source.TileWMS({
            url: 'https://nowcoast.noaa.gov/geoserver/satellite/wms',
            params: {
                LAYERS: 'global_longwave_imagery_mosaic',
                FORMAT: 'image/png',
                TRANSPARENT: true,
            },
            attributions: '© <a href="https://nowcoast.noaa.gov/">NOAA NowCOAST</a>',
        });

        var layer = new ol.layer.Tile({
            name: 'goes_ir',
            title: 'GOES IR Satellite',
            type: 'overlay',
            visible: false,
            zIndex: 45,
            source: source,
            opacity: (typeof noaaInfraredOpacity !== 'undefined') ? noaaInfraredOpacity : 0.35,
        });
        layer.set('weatherType', 'satellite');

        // Auto-refresh every 15 minutes
        setInterval(function() {
            if (layer.getVisible()) {
                source.updateParams({ _t: Date.now() });
            }
        }, 900000);

        return layer;
    }

    weatherRegisterProvider({
        region: 'us',
        name: 'US (MRMS/NEXRAD/GOES)',
        getLayers: function() {
            return [
                createMrmsLayer(),
                createNexradLayer(),
                createGoesLayer(),
            ];
        },
    });
})();

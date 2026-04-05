// weather-us.js — US weather provider (CONUS)
// Sources: MRMS (IEM WMS), NEXRAD (IEM WMS), GOES IR (NOAA NowCOAST)

'use strict';

(function() {
    // IEM WMS endpoints support TIME parameter for historical frames
    var IEM_NEXRAD_WMS = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi';
    var IEM_MRMS_WMS = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/us/mrms_nn.cgi';

    var mrmsRefreshTimer = null;
    var nexradRefreshTimer = null;

    // Build WMS TIME frames for the last 4 hours at 5-minute intervals
    function buildWmsFrames(wmsUrl, layerName, opacity, label, maxCount) {
        var frames = [];
        var now = new Date();
        var interval = 300000; // 5 min in ms
        var count = maxCount || 48;

        for (var i = count - 1; i >= 0; i--) {
            var t = new Date(now.getTime() - (i * interval));
            // Round to nearest 5 minutes
            t.setMinutes(Math.floor(t.getMinutes() / 5) * 5, 0, 0);
            var isoTime = t.toISOString();

            frames.push({
                timestamp: Math.floor(t.getTime() / 1000),
                time: isoTime,
                url: wmsUrl,
                type: 'wms',
                params: {
                    LAYERS: layerName,
                    FORMAT: 'image/png',
                    TRANSPARENT: true,
                },
                opacity: opacity,
                attribution: '© <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a>',
            });
        }

        return frames;
    }

    // ---- MRMS Radar ----
    function fetchMrmsFrames() {
        var opacity = (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.35;
        var frames = buildWmsFrames(IEM_MRMS_WMS, 'mrms_nn', opacity, 'MRMS', 48);

        weatherSetFrames(frames, {
            label: 'MRMS Radar — 4h history',
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
            source: new ol.source.TileWMS({
                url: IEM_MRMS_WMS,
                params: { LAYERS: 'mrms_nn', FORMAT: 'image/png', TRANSPARENT: true },
                crossOrigin: 'anonymous',
            }),
            opacity: (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.35,
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
        var opacity = (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.35;
        var frames = buildWmsFrames(IEM_NEXRAD_WMS, 'nexrad-n0q-900913', opacity, 'NEXRAD', 48);

        weatherSetFrames(frames, {
            label: 'NEXRAD Radar — 4h history',
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
            source: new ol.source.TileWMS({
                url: IEM_NEXRAD_WMS,
                params: { LAYERS: 'nexrad-n0q-900913', FORMAT: 'image/png', TRANSPARENT: true },
                crossOrigin: 'anonymous',
            }),
            opacity: (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.35,
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
            crossOrigin: 'anonymous',
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

// weather-us.js — US weather provider (CONUS)
// Animation: RainViewer (real historical frames)
// Static hi-res: MRMS (IEM), NEXRAD (IEM), GOES IR (NOAA)

'use strict';

(function() {
    var RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';
    var IEM_TILE_BASE = 'https://mesonet{1-3}.agron.iastate.edu/cache/tile.py/1.0.0';
    var animRefreshTimer = null;

    // ---- Animated radar via RainViewer (real historical frames) ----
    function fetchAnimatedFrames() {
        fetch(RAINVIEWER_API)
            .then(function(resp) { return resp.json(); })
            .then(function(data) {
                var past = data.radar ? data.radar.past : [];
                if (!past || past.length === 0) return;

                var host = data.host || 'https://tilecache.rainviewer.com';
                var frames = [];

                for (var i = 0; i < past.length; i++) {
                    frames.push({
                        timestamp: past[i].time,
                        url: host + past[i].path + '/256/{z}/{x}/{y}/2/1_1.png',
                        type: 'xyz',
                        maxZoom: 7,
                        opacity: (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.35,
                        attribution: 'Radar: <a href="https://www.rainviewer.com/">RainViewer</a>',
                    });
                }

                var mins = Math.round(past.length * 10);
                var label = 'US Radar — ' + (mins >= 120 ? Math.round(mins/60) + 'h' : mins + 'm') + ' history';

                weatherSetFrames(frames, {
                    label: label,
                    legend: {
                        label: 'dBZ',
                        gradient: 'linear-gradient(90deg, #004488 0%, #009900 18%, #00cc00 30%, #ffcc00 45%, #ff6600 58%, #ff0000 72%, #cc00cc 88%, #ffffff 100%)',
                        stops: ['5', '15', '25', '35', '45', '55', '65+'],
                    },
                });
            })
            .catch(function(err) {
                console.warn('RainViewer API error:', err.message);
            });
    }

    function createAnimatedRadarLayer() {
        var layer = new ol.layer.Tile({
            name: 'us_radar_anim',
            title: 'Radar Animation',
            type: 'overlay',
            visible: false,
            zIndex: 50,
            source: new ol.source.XYZ({ url: '' }),
        });
        layer.set('weatherType', 'radar');
        layer.set('weatherLoadFrames', function() {
            fetchAnimatedFrames();
            if (!animRefreshTimer) {
                animRefreshTimer = setInterval(fetchAnimatedFrames, 120000);
            }
        });
        return layer;
    }

    // ---- Static hi-res MRMS (latest frame only) ----
    function createMrmsLayer() {
        var source = new ol.source.XYZ({
            url: IEM_TILE_BASE + '/q2-n1p-900913/{z}/{x}/{y}.png?_=' + Date.now(),
            attributions: '© <a href="https://mesonet.agron.iastate.edu/">IEM</a> MRMS',
            maxZoom: 12,
            crossOrigin: 'anonymous',
        });

        var layer = new ol.layer.Tile({
            name: 'mrms_static',
            title: 'MRMS Radar (hi-res, latest)',
            type: 'overlay',
            visible: false,
            zIndex: 53,
            source: source,
            opacity: (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.4,
        });
        layer.set('weatherType', 'radar-static');

        // Refresh every 2 minutes
        setInterval(function() {
            if (layer.getVisible()) {
                source.setUrl(IEM_TILE_BASE + '/q2-n1p-900913/{z}/{x}/{y}.png?_=' + Date.now());
                source.refresh();
            }
        }, 120000);

        return layer;
    }

    // ---- Static NEXRAD (latest frame only) ----
    function createNexradLayer() {
        var source = new ol.source.XYZ({
            url: IEM_TILE_BASE + '/nexrad-n0q-900913/{z}/{x}/{y}.png?_=' + Date.now(),
            attributions: '© <a href="https://mesonet.agron.iastate.edu/">IEM</a> NEXRAD',
            maxZoom: 8,
            crossOrigin: 'anonymous',
        });

        var layer = new ol.layer.Tile({
            name: 'nexrad_static',
            title: 'NEXRAD Radar (latest)',
            type: 'overlay',
            visible: false,
            zIndex: 52,
            source: source,
            opacity: (typeof nexradOpacity !== 'undefined') ? nexradOpacity : 0.4,
        });
        layer.set('weatherType', 'radar-static');

        setInterval(function() {
            if (layer.getVisible()) {
                source.setUrl(IEM_TILE_BASE + '/nexrad-n0q-900913/{z}/{x}/{y}.png?_=' + Date.now());
                source.refresh();
            }
        }, 120000);

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

        setInterval(function() {
            if (layer.getVisible()) {
                source.updateParams({ _t: Date.now() });
            }
        }, 900000);

        return layer;
    }

    weatherRegisterProvider({
        region: 'us',
        name: 'US (Radar/MRMS/NEXRAD/GOES)',
        getLayers: function() {
            return [
                createAnimatedRadarLayer(),
                createMrmsLayer(),
                createNexradLayer(),
                createGoesLayer(),
            ];
        },
    });
})();

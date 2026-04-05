// weather-ui.js — Weather animation UI components
// Animation bar with time slider, playback controls, and horizontal dBZ legend

'use strict';

var weather_uiContainer = null;
var weather_uiSlider = null;
var weather_uiTimestamp = null;
var weather_uiSourceLabel = null;
var weather_uiLegendBar = null;
var weather_uiLegendLabels = null;
var weather_uiLegendTitle = null;
var weather_uiPlayBtn = null;
var weather_uiSpeedBtns = {};

function weatherUiCreate() {
    if (weather_uiContainer) return;

    var mapContainer = document.getElementById('map_container');
    if (!mapContainer) return;

    // Main container
    var container = document.createElement('div');
    container.id = 'weather-animation-bar';
    container.className = 'weather-bar';
    container.style.display = 'none';

    // ---- Header row: source label + timestamp ----
    var header = document.createElement('div');
    header.className = 'weather-bar-header';

    var sourceLabel = document.createElement('span');
    sourceLabel.className = 'weather-bar-source';
    sourceLabel.textContent = 'Weather Radar';
    weather_uiSourceLabel = sourceLabel;

    var timestamp = document.createElement('span');
    timestamp.className = 'weather-bar-timestamp';
    timestamp.textContent = '--:-- UTC';
    weather_uiTimestamp = timestamp;

    header.appendChild(sourceLabel);
    header.appendChild(timestamp);
    container.appendChild(header);

    // ---- Slider row ----
    var sliderRow = document.createElement('div');
    sliderRow.className = 'weather-bar-slider-row';

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'weather-bar-slider';
    slider.min = '0';
    slider.max = '47';
    slider.value = '23';
    slider.addEventListener('input', function() {
        weatherStopAnimation();
        var idx = parseInt(slider.value, 10);
        weather_animIndex = idx;
        weatherShowFrame(idx);
    });
    weather_uiSlider = slider;

    sliderRow.appendChild(slider);
    container.appendChild(sliderRow);

    // ---- Controls row: time start | playback | speed ----
    var controls = document.createElement('div');
    controls.className = 'weather-bar-controls';

    // Left: start time
    var timeStart = document.createElement('span');
    timeStart.className = 'weather-bar-time-start';
    timeStart.textContent = '';

    // Center: playback buttons
    var playback = document.createElement('div');
    playback.className = 'weather-bar-playback';

    var btnSkipStart = weatherUiMakeBtn('\u23EE', 'Skip to start', weatherSkipToStart);
    var btnStepBack = weatherUiMakeBtn('\u25C0', 'Step back', weatherStepBackward);

    var btnPlay = document.createElement('button');
    btnPlay.className = 'weather-bar-play';
    btnPlay.textContent = '\u25B6';
    btnPlay.title = 'Play/Pause';
    btnPlay.addEventListener('click', weatherToggleAnimation);
    weather_uiPlayBtn = btnPlay;

    var btnStepFwd = weatherUiMakeBtn('\u25B6', 'Step forward', weatherStepForward);
    btnStepFwd.className = 'weather-bar-btn weather-bar-btn-small';
    var btnSkipEnd = weatherUiMakeBtn('\u23ED', 'Skip to end', weatherSkipToEnd);

    playback.appendChild(btnSkipStart);
    playback.appendChild(btnStepBack);
    playback.appendChild(btnPlay);
    playback.appendChild(btnStepFwd);
    playback.appendChild(btnSkipEnd);

    // Right: speed selector
    var speedRow = document.createElement('div');
    speedRow.className = 'weather-bar-speed';

    var speeds = [1, 2, 4, 8];
    for (var i = 0; i < speeds.length; i++) {
        (function(spd) {
            var btn = document.createElement('button');
            btn.className = 'weather-bar-speed-btn' + (spd === weather_animSpeed ? ' active' : '');
            btn.textContent = spd + 'x';
            btn.addEventListener('click', function() { weatherSetSpeed(spd); });
            speedRow.appendChild(btn);
            weather_uiSpeedBtns[spd] = btn;
        })(speeds[i]);
    }

    controls.appendChild(timeStart);
    controls.appendChild(playback);
    controls.appendChild(speedRow);
    container.appendChild(controls);

    // ---- Divider ----
    var divider = document.createElement('div');
    divider.className = 'weather-bar-divider';
    container.appendChild(divider);

    // ---- Legend row ----
    var legendRow = document.createElement('div');
    legendRow.className = 'weather-bar-legend';

    var legendTitle = document.createElement('span');
    legendTitle.className = 'weather-bar-legend-title';
    legendTitle.textContent = 'dBZ';
    weather_uiLegendTitle = legendTitle;

    var legendBarWrap = document.createElement('div');
    legendBarWrap.className = 'weather-bar-legend-wrap';

    var legendBar = document.createElement('div');
    legendBar.className = 'weather-bar-legend-bar';
    weather_uiLegendBar = legendBar;

    var legendLabels = document.createElement('div');
    legendLabels.className = 'weather-bar-legend-labels';
    weather_uiLegendLabels = legendLabels;

    legendBarWrap.appendChild(legendBar);
    legendBarWrap.appendChild(legendLabels);
    legendRow.appendChild(legendTitle);
    legendRow.appendChild(legendBarWrap);
    container.appendChild(legendRow);

    // Insert into map container
    mapContainer.appendChild(container);
    weather_uiContainer = container;

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (!weather_uiContainer || weather_uiContainer.style.display === 'none') return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            weatherToggleAnimation();
        } else if (e.code === 'ArrowLeft' && e.shiftKey) {
            e.preventDefault();
            weatherSkipToStart();
        } else if (e.code === 'ArrowRight' && e.shiftKey) {
            e.preventDefault();
            weatherSkipToEnd();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            weatherStepBackward();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            weatherStepForward();
        }
    });
}

function weatherUiMakeBtn(text, title, onClick) {
    var btn = document.createElement('button');
    btn.className = 'weather-bar-btn';
    btn.textContent = text;
    btn.title = title;
    btn.addEventListener('click', onClick);
    return btn;
}

// ---- UI update functions (called from weather.js animation controller) ----

function weatherUiShow() {
    if (weather_uiContainer) {
        weather_uiContainer.style.display = '';
    }
}

function weatherUiHide() {
    if (weather_uiContainer) {
        weather_uiContainer.style.display = 'none';
    }
}

function weatherUiUpdateSlider(index, total) {
    if (weather_uiSlider) {
        weather_uiSlider.max = String(total - 1);
        weather_uiSlider.value = String(index);
    }
}

function weatherUiUpdateTimestamp(unixSeconds) {
    if (!weather_uiTimestamp) return;
    var d = new Date(unixSeconds * 1000);
    var utc = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    var local = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    weather_uiTimestamp.textContent = utc + ' UTC (' + local + ' local)';
}

function weatherUiSetSourceLabel(label) {
    if (weather_uiSourceLabel) {
        weather_uiSourceLabel.textContent = label;
    }
}

function weatherUiUpdatePlayState(playing) {
    if (weather_uiPlayBtn) {
        weather_uiPlayBtn.textContent = playing ? '\u23F8' : '\u25B6';
        weather_uiPlayBtn.classList.toggle('playing', playing);
    }
}

function weatherUiUpdateSpeed(speed) {
    for (var s in weather_uiSpeedBtns) {
        weather_uiSpeedBtns[s].classList.toggle('active', parseInt(s, 10) === speed);
    }
}

function weatherUiSetLegend(legend) {
    if (!legend) {
        if (weather_uiLegendBar) weather_uiLegendBar.parentElement.parentElement.style.display = 'none';
        return;
    }
    if (weather_uiLegendBar) {
        weather_uiLegendBar.parentElement.parentElement.style.display = '';
    }
    if (weather_uiLegendTitle) {
        weather_uiLegendTitle.textContent = legend.label || 'dBZ';
    }
    if (weather_uiLegendBar) {
        weather_uiLegendBar.style.background = legend.gradient;
    }
    if (weather_uiLegendLabels && legend.stops) {
        weather_uiLegendLabels.innerHTML = '';
        for (var i = 0; i < legend.stops.length; i++) {
            var span = document.createElement('span');
            span.textContent = legend.stops[i];
            weather_uiLegendLabels.appendChild(span);
        }
    }
}

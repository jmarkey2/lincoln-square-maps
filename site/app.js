/* All geographic requests stay within this static site. */
/* global L */
'use strict';

const byId = id => document.getElementById(id);
const status = byId('map-status');
const topSelect = byId('top-layer');
const bottomSelect = byId('bottom-layer');
const opacity = byId('opacity');

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot load ${url} (${response.status})`);
  return response.json();
}

async function start() {
  if (!window.L) throw new Error('The local Leaflet library could not load.');
  const [config, boundary] = await Promise.all([
    readJSON('data/layers.json'), readJSON('data/urban-renewal.geojson')
  ]);
  const bounds = L.latLngBounds(config.bounds);
  // After a 90° turn, projected north/south span becomes screen width.
  const nw = L.CRS.EPSG3857.project(bounds.getNorthWest());
  const se = L.CRS.EPSG3857.project(bounds.getSouthEast());
  byId('map').style.aspectRatio = `${(nw.y - se.y) / (se.x - nw.x)}`;
  const map = L.map('map', {
    maxBoundsViscosity: 1, minZoom: config.minZoom,
    maxZoom: config.maxZoom, zoomSnap: 0, zoomDelta: 0.5,
    attributionControl: true, zoomControl: true,
    rotate: true, bearing: 90, rotateControl: false,
    touchRotate: false, shiftKeyRotate: false, pitchDrag: false, touchPitch: false
  });
  map.createPane('bottomImagery', map.getPane('rotatePane')).style.zIndex = 200;
  map.createPane('topImagery', map.getPane('rotatePane')).style.zIndex = 300;
  map.createPane('renewalBoundary', map.getPane('rotatePane')).style.zIndex = 450;
  L.control.scale({ position: 'topleft', imperial: true, metric: true }).addTo(map);
  const compass = L.control({ position: 'topright' });
  compass.onAdd = () => {
    const element = L.DomUtil.create('div', 'compass');
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', 'North points right; map rotated 90 degrees clockwise');
    element.innerHTML = '<span>N</span><span class="compass-arrow" aria-hidden="true">↑</span>';
    const update = () => { element.lastElementChild.style.transform = `rotate(${map.getBearing()}deg)`; };
    map.on('rotate', update);
    update();
    L.DomEvent.disableClickPropagation(element);
    return element;
  };
  compass.addTo(map);
  // Establish a view before the rotation plugin calculates bounds in screen pixels.
  map.setView(bounds.getCenter(), config.minZoom, { animate: false });
  map.setMaxBounds(bounds);
  const outline = L.geoJSON(boundary, {
    pane: 'renewalBoundary', interactive: false,
    style: { color: '#d63636', weight: 2, opacity: 1, fill: false }
  });
  const layers = [...config.layers].sort((a, b) => a.year - b.year);
  const findLayer = id => layers.find(layer => layer.id === id);
  for (const layer of layers) {
    topSelect.add(new Option(layer.label, layer.id));
    bottomSelect.add(new Option(layer.label, layer.id));
  }
  topSelect.value = config.defaultTop;
  bottomSelect.value = config.defaultBottom;
  let topLayer, bottomLayer;
  let failed = false;
  let activeAttribution;

  function showStatus(message, error = false) {
    status.textContent = message;
    status.className = `map-status${error ? ' error' : ''}`;
  }
  function updateStatus() {
    if (failed) return;
    if (topLayer?.isLoading() || bottomLayer?.isLoading()) showStatus('Loading imagery…');
    else {
      status.textContent = 'Imagery loaded';
      status.className = 'map-status ready';
    }
  }
  function makeLayer(info, pane, alpha) {
    const layer = L.tileLayer(info.url, {
      pane, bounds, noWrap: true, minZoom: config.minZoom,
      maxZoom: config.maxZoom, maxNativeZoom: info.maxNativeZoom,
      opacity: alpha, keepBuffer: 1, updateWhenIdle: true
    });
    layer.on('loading load', updateStatus);
    layer.on('tileerror', () => {
      failed = true;
      showStatus('Some imagery could not load. Check your connection, then reselect the layer to retry.', true);
    });
    return layer;
  }
  function render() {
    failed = false;
    if (topLayer) map.removeLayer(topLayer);
    if (bottomLayer) map.removeLayer(bottomLayer);
    const top = findLayer(topSelect.value);
    const bottom = findLayer(bottomSelect.value);
    bottomLayer = makeLayer(bottom, 'bottomImagery', 1);
    topLayer = makeLayer(top, 'topImagery', 1);
    updateBlend();
    bottomLayer.addTo(map);
    topLayer.addTo(map);
    // Credits are plain text in config. Escape them before Leaflet inserts HTML.
    const escapeHTML = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
    if (activeAttribution) map.attributionControl.removeAttribution(activeAttribution);
    activeAttribution = [...new Set([top.credit, bottom.credit])].map(escapeHTML).join(' · ');
    map.attributionControl.addAttribution(activeAttribution);
    updateStatus();
  }
  function updateMinZoom() {
    // Recompute from the current dimensions, including after device rotation.
    map.invalidateSize({ pan: false });
    // Leaflet's getBoundsZoom clamps its result to the existing minimum.
    map.setMinZoom(config.minZoom);
    map.setMinZoom(Math.max(config.minZoom, map.getBoundsZoom(bounds, false, L.point(16, 16))));
  }
  function fitArea() {
    updateMinZoom();
    map.fitBounds(bounds, { padding: [8, 8], animate: false });
  }
  topSelect.addEventListener('change', render);
  bottomSelect.addEventListener('change', render);
  function updateBlend() {
    const value = Math.max(0, Math.min(100, opacity.valueAsNumber));
    if (!Number.isFinite(value)) return;
    // Blend the completed imagery pane independently of Leaflet's tile fade lifecycle.
    // The underlying Map 2 remains opaque; neither source is replaced while blending.
    map.getPane('topImagery').style.opacity = String(1 - value / 100);
    opacity.setAttribute('aria-valuetext', `${(100 - value).toFixed(1)} percent Map 1, ${value.toFixed(1)} percent Map 2`);
  }
  opacity.addEventListener('input', updateBlend);
  const setBlendValue = value => {
    if (!Number.isFinite(value)) return;
    opacity.value = String(Math.round(Math.max(0, Math.min(100, value)) * 10) / 10);
    opacity.dispatchEvent(new Event('input', { bubbles: true }));
  };
  let drag = null;
  opacity.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    // Own pointer gestures so a native track-seek cannot reset a thumb press.
    // The native range still supplies appearance, accessibility and keyboard input.
    event.preventDefault();
    opacity.focus({ preventScroll: true });
    const box = opacity.getBoundingClientRect();
    const thumbRadius = 8;
    const length = Math.max(1, box.width - thumbRadius * 2);
    const current = opacity.valueAsNumber;
    const thumbX = box.left + thumbRadius + length * current / 100;
    if (Math.abs(event.clientX - thumbX) > 14) {
      setBlendValue((event.clientX - box.left - thumbRadius) / length * 100);
    }
    drag = { id: event.pointerId, x: event.clientX, value: opacity.valueAsNumber, length };
    opacity.setPointerCapture(event.pointerId);
  });
  opacity.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    setBlendValue(drag.value + (event.clientX - drag.x) / drag.length * 100);
  });
  const endDrag = event => {
    if (drag?.id === event.pointerId) drag = null;
  };
  opacity.addEventListener('pointerup', endDrag);
  opacity.addEventListener('pointercancel', endDrag);
  opacity.addEventListener('lostpointercapture', endDrag);
  opacity.addEventListener('wheel', event => {
    const delta = event.deltaY || event.deltaX;
    if (!delta) return;
    event.preventDefault();
    if (drag) return;
    // A typical 100–120 px wheel notch moves 5%; tiny trackpad deltas stay finer.
    const pixels = delta * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 800 : 1);
    const step = Math.sign(pixels) * Math.min(5, Math.max(0.1, Math.abs(pixels) / 20));
    setBlendValue(opacity.valueAsNumber + step);
  }, { passive: false });
  byId('boundary').addEventListener('change', event => {
    if (event.target.checked) outline.addTo(map);
    else map.removeLayer(outline);
  });
  if (byId('boundary').checked) outline.addTo(map);
  let previousSize = '';
  new ResizeObserver(() => {
    const size = `${byId('map').clientWidth},${byId('map').clientHeight}`;
    if (size === previousSize) return;
    previousSize = size;
    const wasOverview = map.getZoom() <= map.getMinZoom() + 0.01;
    updateMinZoom();
    if (wasOverview) fitArea();
  }).observe(byId('map'));
  fitArea();
  render();
  byId('controls').disabled = false;
}

start().catch(error => {
  console.error(error);
  status.className = 'map-status error';
  status.textContent = 'The map could not start. Serve the site over HTTP and check that its data and vendor files are present.';
});

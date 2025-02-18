import mapboxgl, { Map, Marker, MapMouseEvent, NavigationControl, GeolocateControl, LngLat } from 'mapbox-gl';
import { LineString } from 'geojson';
import { CurrentRun, RunStart, RunSegment } from './current-run';
import { getFormattedDistance } from './distance-formatter';
import { getStyleById } from './map-style';
import { ps } from './appsettings.secrets';
import { AnimationService } from './animation-service';
import { NextSegmentService } from './next-segment-service';
import { PreferenceService } from './preference-service';

let preferenceService = new PreferenceService();

let useMetric = preferenceService.getUseMetric();
let followRoads = preferenceService.getShouldFollowRoads();
let isWaiting = false;

const initialFocus = preferenceService.getLastOrDefaultFocus();
const mapStyle = getStyleById(preferenceService.getMapStyle());
const mbk = /*atob(*/ps/*)*/;

(mapboxgl as any)["accessToken"] = mbk;
let map = new Map({
  pitchWithRotate: false,
  center: [initialFocus.lng, initialFocus.lat],
  zoom: initialFocus.zoom,
  container: 'mapbox-container',
  style: mapStyle
});

let nextSegmentService = new NextSegmentService(mbk);

let currentRun: CurrentRun = undefined;

let animationService = new AnimationService(map);

let lengthElement = document.getElementById('run-length') as HTMLElement;
let unitsElement = document.getElementById('run-units') as HTMLElement;
let menuElement = document.getElementById('menu-toggle') as HTMLElement;

let settingsElement = document.getElementById('settings-pane') as HTMLElement;
let closeElement = document.getElementById('close-settings') as HTMLElement;
let scrimElement = document.getElementById('settings-scrim') as HTMLElement;
let uploadContainer = document.getElementById('upload-container') as HTMLElement
let uploadForm = document.getElementById('upload-form') as HTMLElement;
let runInput = document.getElementById('run-input') as HTMLInputElement;
let toggleUnitsElement = document.getElementById('toggle-units') as HTMLElement;
let followRoadsElement = document.getElementById('follow-roads') as HTMLElement;
let clearRunElement = document.getElementById('clear-run') as HTMLElement;
let loadRunElement = document.getElementById('load-run') as HTMLElement;
let saveRunElement = document.getElementById('save-run') as HTMLElement;
let streetStyleElement = document.getElementById('street-style') as HTMLElement;
let satelliteStyleElement = document.getElementById('satellite-style') as HTMLElement;
let darkStyleElement = document.getElementById('dark-style') as HTMLElement;
const mapStyleElements = [streetStyleElement, satelliteStyleElement, darkStyleElement];

let removeLastElement = document.getElementById('remove-last') as HTMLElement;

let helpElement = document.getElementById('help-notice') as HTMLElement;
let dismissHelpElement = document.getElementById('dismiss-notice') as HTMLElement;
setupUserControls();

map.on('load', () => {
  // only show on desktop useragents
  if (!/iPhone|iPad|iPod|Android/.test(window.navigator.userAgent)) {
    map.addControl(new NavigationControl(), 'bottom-right');
  }

  map.addControl(
    new GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: false
    }).on('geolocate', (p: GeolocationPosition) => {
      preferenceService.saveCurrentFocus(p, map.getZoom());
    }),
    'bottom-right');
    
  jsonToRun(preferenceService.getLastRun());
  if (currentRun !== undefined) showRunButtons();
});

// click or tap
map.on('click', (e: MapMouseEvent) => {
  if (!isWaiting) {
    setWaiting(true);
    addNewPoint(e);
  }
  const center = map.getCenter();
  const position = {
    coords: {
      latitude: center.lat,
      longitude: center.lng
    }
  } as GeolocationPosition;
  preferenceService.saveCurrentFocus(position, map.getZoom());
});

// triggered upon map style changed
map.on('style.load', () => {
  animationService.readdRunToMap(currentRun);
});

function showRunButtons(): void {
  removeLastElement.classList.remove('slide-out');
  removeLastElement.classList.add('slide-in');
  removeLastElement.setAttribute('aria-hidden', 'false');
  saveRunElement.classList.remove('hidden');
  clearRunElement.classList.remove('hidden');
}

function hideRunButtons(): void {
  removeLastElement.classList.remove('slide-in');
  removeLastElement.classList.add('slide-out');
  removeLastElement.setAttribute('aria-hidden', 'true');
  saveRunElement.classList.add('hidden');
  clearRunElement.classList.add('hidden');
}

function addNewPoint(e: MapMouseEvent): void {
  if (currentRun === undefined) {
    let start = new RunStart(
      e.lngLat
    );
    start.setMarker(addMarker(e.lngLat, true));
    currentRun = new CurrentRun(start);
    showRunButtons();
    updateLengthElement();
  } else {
    let prev = currentRun.getLastPosition();
    if (followRoads) {
      addSegmentFromDirectionsResponse(prev, e.lngLat);
    } else {
      addSegmentFromStraightLine(prev, e.lngLat);
    }
  }
  setWaiting(false);
  setTimeout(() => preferenceService.saveLastRun(runToJson(currentRun)), 100); // for some reason this won't save right without a delay
}

function addSegmentFromDirectionsResponse(previousLngLat: LngLat, lngLat: LngLat, animate = true) {
  return nextSegmentService.getSegmentFromDirectionsService(previousLngLat, lngLat)
    .then((newSegment: RunSegment) => {

      const line = newSegment.geometry as LineString;
      const coordinates = line.coordinates;
      if (animate) animationService.animateSegment(newSegment);

      // use ending coordinate from route for the marker
      const segmentEnd = coordinates[coordinates.length - 1];
      const marker = addMarker(new LngLat(segmentEnd[0], segmentEnd[1]), false);
      currentRun.addSegment(newSegment, marker);
      updateLengthElement();
    }, err => {
      alert(`An error occurred getting directions: ${err}`);
    });
}

function addSegmentFromStraightLine(previousLngLat: LngLat, lngLat: LngLat, animate = true): void {
  const newSegment = nextSegmentService.segmentFromStraightLine(previousLngLat, lngLat);

  if (animate) animationService.animateSegment(newSegment);
  const marker = addMarker(lngLat, false);
  currentRun.addSegment(newSegment, marker);
  updateLengthElement();
}

function runToJson(run: CurrentRun): string {
  if (run === undefined) return "{}";
  let runJSON: {[name:string]: any} = {
    start: {
      lng: run.start.lngLat.lng,
      lat: run.start.lngLat.lat,
    },
    distance: run.distance,
    segments: [],
    followRoads
  };
  for (let i in run.segments) {
    runJSON.segments.push({
      lng: run.segments[i].lngLat.lng,
      lat: run.segments[i].lngLat.lat,
      followsRoads: run.segments[i].followsRoads
    });
  }
  return JSON.stringify(runJSON);
}

function jsonToRun(json: string, changeView: boolean = false): boolean {
  try { 
    let runJSON = JSON.parse(json);
    let lngLat = new LngLat(runJSON.start.lng, runJSON.start.lat);
    let start = new RunStart(lngLat);
    start.setMarker(addMarker(lngLat, true));
    let newRun = new CurrentRun(start);
    let prev = lngLat;
    for (let i = 0; i < runJSON.segments.length; i++) {
      let lngLat = new LngLat(runJSON.segments[i].lng, runJSON.segments[i].lat);
      if (runJSON.segments[i].followsRoads) {
        addSegmentFromDirectionsResponse(prev, lngLat, false);
      } else {
        addSegmentFromStraightLine(prev, lngLat, false);
      }
      prev = lngLat;
    }
    clearRun(false);
    currentRun = newRun;
    if (changeView) {
      map.flyTo({
        center: [runJSON.start.lng, runJSON.start.lat],
        zoom: 14
      });
    }
    return true;
  }
  catch (err) {
    console.log(err);
    return false;
  }
  finally {
    setTimeout(() => animationService.readdRunToMap(currentRun), 150);
  }
}

function downloadRun(): void {
  let run = runToJson(currentRun);
  let file = new Blob([run], {
    type: "application/json"
  });
  let url = URL.createObjectURL(file);
  let link = document.createElement("a");
  link.href = url;
  let date = new Date();
  link.download = `run-${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear() % 100}.runmap`;
  link.click();
}

function showUploadForm(): void {
  closeMenu(false);
  uploadContainer.classList.add("showing-form");
  uploadContainer.setAttribute('aria-hidden', 'false');
  runInput.value = "";
}

async function loadRun(e: Event): Promise<void> {
  e.preventDefault();
  if (!runInput.files.length) return void (runInput.parentElement.querySelector("span").innerText = "No file selected");
  let json = await runInput.files[0].text();
  let loadsuccessful = jsonToRun(json, true);
  if (!loadsuccessful) return void (runInput.parentElement.querySelector("span").innerText = "Error loading run");
  closeMenu();
  showRunButtons();
  setTimeout(() => preferenceService.saveLastRun(runToJson(currentRun)), 100);
}

function setupUserControls(): void {
  showHelpElementIfNecessary();
  dismissHelpElement.onclick = hideStorageElement;

  removeLastElement.onclick = removeLastSegment;

  updateLengthElement();
  lengthElement.onclick = toggleDistanceUnits;

  menuElement.onclick = openMenu;
  closeElement.onclick = () => closeMenu();
  scrimElement.onclick = () => closeMenu();
  toggleUnitsElement.onclick = () => closeMenuAction(toggleDistanceUnits);

  setFollowRoads(followRoads);
  followRoadsElement.onclick = () => closeMenuAction(toggleFollowRoads);
  clearRunElement.onclick = () => closeMenuAction(clearRun);
  loadRunElement.onclick = showUploadForm;
  saveRunElement.onclick = () => closeMenuAction(downloadRun);

  const id = preferenceService.getMapStyle();
  setSelectedMapToggleStyles(document.getElementById(id) as HTMLElement);
  streetStyleElement.onclick = () => closeMenuAction(() => setSelectedMapToggleStyles(streetStyleElement));
  satelliteStyleElement.onclick = () => closeMenuAction(() => setSelectedMapToggleStyles(satelliteStyleElement));
  darkStyleElement.onclick = () => closeMenuAction(() => setSelectedMapToggleStyles(darkStyleElement));
  
  runInput.onchange = () => {
    runInput.parentElement.querySelector("span").innerText = runInput.files[0].name;
  }
  uploadForm.onsubmit = loadRun;
}

function closeMenuAction(fn: () => void) {
  fn();
  closeMenu();
}

function showHelpElementIfNecessary(): void {
  if (!preferenceService.getHasAcknowledgedHelp()) {
    helpElement.style.display = 'block';
  }
}

function hideStorageElement(): void {
  helpElement.style.display = 'none';
  preferenceService.saveHasAcknowledgedHelp(true);
}

function toggleDistanceUnits(): void {
  useMetric = !useMetric;
  updateLengthElement();
  preferenceService.saveUseMetric(useMetric);
}

function toggleFollowRoads(): void {
  followRoads = !followRoads;
  setFollowRoads(followRoads);
}

function setSelectedMapToggleStyles(selected: HTMLElement): void {
  const elementId = selected.id;
  const style = getStyleById(elementId);
  map.setStyle(style); // layers readded on style.load
  preferenceService.saveMapStyle(elementId);
  for (let element of mapStyleElements) {
    element.style.color = 'inherit';
  }
  selected.style.color = '#4285F4';
}

function removeLastSegment(): void {
  if (!currentRun) {
    return;
  }

  let lastPoint = currentRun.removeLastSegment();
  if (lastPoint) {
    map.setLayoutProperty(lastPoint.id, 'visibility', 'none');
    updateLengthElement();
  } else if (currentRun.start) {
    currentRun.start.marker.remove();
    updateLengthElement();
    currentRun = undefined;
    hideRunButtons();
  }
  preferenceService.saveLastRun(runToJson(currentRun));
}

function clearRun(commit: boolean = true): void {
  while (currentRun) {
    removeLastSegment();
  }
  if (commit) preferenceService.saveLastRun(runToJson(currentRun));
}

function updateLengthElement(): void {
  const distance = currentRun ? currentRun.distance : 0;
  const fd = getFormattedDistance(distance, useMetric);
  lengthElement.innerText = fd.roundedDistance;
  unitsElement.innerText = fd.units;
  toggleUnitsElement.setAttribute('aria-value', useMetric ? 'kilometers' : 'miles');
}

function addMarker(pos: LngLat, isStart: boolean): Marker {
  return new Marker({
    draggable: false,
    color: isStart ? '#00BD00' : undefined
  }).setLngLat(pos)
    .addTo(map);
}

function setWaiting(toWait: boolean): void {
  isWaiting = toWait;
  // TODO - loading spinner shown upon a delay?
}

function openMenu() {
  settingsElement.classList.add('settings-open');
  settingsElement.setAttribute('aria-hidden', 'false');
  scrimElement.classList.remove('scrim-hidden');
  scrimElement.classList.add('scrim-shown');
}

function closeMenu(hideForm: boolean = true) {
  settingsElement.classList.remove('settings-open');
  settingsElement.setAttribute('aria-hidden', 'true');
  if (!hideForm) return;
  uploadContainer.classList.remove("showing-form");
  uploadContainer.setAttribute('aria-hidden', 'true');
  scrimElement.classList.remove('scrim-shown');
  scrimElement.classList.add('scrim-hidden');
  runInput.parentElement.querySelector("span").innerText = "drag a file or click here";
}

function setFollowRoads(value: boolean) {
  if (value) {
    followRoadsElement.style.textDecoration = 'inherit';
    followRoadsElement.setAttribute('aria-value', 'enabled');
  } else {
    followRoadsElement.style.textDecoration = 'line-through';
    followRoadsElement.setAttribute('aria-value', 'disabled');
  }
  followRoads = value;
  preferenceService.saveShouldFollowRoads(value);
}

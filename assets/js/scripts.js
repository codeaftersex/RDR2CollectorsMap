/*
- these statements have no requirements
- code at multiple places depend on these
*/

Object.defineProperty(String.prototype, 'filename', {
  value: function (extension) {
    let s = this.replace(/\\/g, '/');
    s = s.substring(s.lastIndexOf('/') + 1);
    return extension ? s.replace(/[?#].+$/, '') : s.split('.')[0];
  }
});

// Check if an array contains another array. Used to enable random categories set (jewerly & fossils)
Object.defineProperty(Array.prototype, 'arrayContains', {
  value: function (sub) {
    const result = sub.filter(item => this.indexOf(item) > -1);
    return result.length > 0;
  }
});

HTMLElement.prototype.firstAncestorOrSelf = function (func) {
  'use strict';
  let node = this;
  while (node) {
    if (func(node)) return node;
    node = node.parentNode;
  }
  return null;
};

HTMLElement.prototype.propSearchUp = function (property) {
  'use strict';
  const element = this.firstAncestorOrSelf(function (node) {
    return node[property] !== undefined;
  });
  return element ? element[property] : undefined;
};

let uniqueSearchMarkers = [];

const colorNameMap = {
  '#00ffa2': 'aquagreen', '#ffce70': 'beige', '#292929': 'black', '#31a6c7': 'blue',
  '#7c411f': 'brown', '#416776': 'cadetblue', '#0066a2': 'darkblue', '#627134': 'darkgreen',
  '#e27839': 'darkorange', '#593769': 'darkpurple', '#a13235': 'darkred', '#444444': 'gray',
  '#70ae25': 'green', '#88dbff': 'lightblue', '#5e5e5e': 'lightgray', '#a3c62c': 'lightgreen',
  '#ff8c7d': 'lightorange', '#da4d6d': 'lightred', '#ee9232': 'orange', '#c05b9f': 'pink',
  '#6b65a4': 'purple', '#d43d29': 'red', '#ffffff': 'white', '#ffcc5c': 'yellow',
};
const colorNameToHexMap = Object.fromEntries(
  Object.entries(colorNameMap).map(([hex, name]) => [name, hex])
);

const categories = [
  'arrowhead', 'bottle', 'bracelet', 'coastal', 'coin', 'cups', 'earring', 'egg',
  'fast_travel', 'flower', 'fossils_random', 'heirlooms',
  'jewelry_random', 'megafauna', 'nazar', 'necklace', 'oceanic', 'pentacles',
  'random', 'ring', 'swords', 'treasure', 'user_pins', 'wands', 'weekly', 'legendary_animals'
];

const parentCategories = {
  jewelry_random: ['bracelet', 'earring', 'necklace', 'ring'],
  fossils_random: ['coastal', 'megafauna', 'oceanic']
};

let enabledCategories = [...categories];
try {
  enabledCategories = JSON.parse(localStorage.getItem("rdr2collector.enabled-categories") || localStorage.getItem("enabled-categories")) || [...categories];
} catch (error) {
  // localStorage is not available due to user's browser settings.
  alert("Error retrieving settings.\n\nPlease make sure storing data is allowed for this site. Some browsers restrict storing data in private browsing modes. This website will not work properly until this is resolved.");
}

let draggableLatLngCtn = null;

/*
- Leaflet extentions require Leaflet loaded
- guaranteed by this script’s position in index.html
*/
L.DivIcon.DataMarkup = L.DivIcon.extend({
  _setIconStyles: function (img, name) {
    L.DivIcon.prototype._setIconStyles.call(this, img, name);
    if (this.options.marker)
      img.dataset.marker = this.options.marker;

    if (this.options.time) {
      const from = parseInt(this.options.time[0]);
      const to = parseInt(this.options.time[1]);

      img.dataset.time = timeRange(from, to);
    }

    if (this.options.tippy)
      img.dataset.tippy = this.options.tippy;
  }
});

// Glowing icon (legendary animals)
L.Icon.TimedData = L.Icon.extend({
  _setIconStyles: function (img, name) {
    L.Icon.prototype._setIconStyles.call(this, img, name);
    if (this.options.time && this.options.time.length) {
      img.dataset.time = this.options.time;
    }
  },
});

/*
- DOM will be ready, all scripts will be loaded (all loaded via DOM script elements)
- everything in this file here will be executed
- they can depend on their order here
- unfortunately some async dependencies are not properly taken care of (yet)
*/
document.addEventListener('DOMContentLoaded', function() {
  try {
    init();
  } catch (e) {
    if (getParameterByName('show-alert') == '1') {
      alert(e);
    }
    console.error(e);
  }
});

function init() {
  try {
    Sentry.init({ release: nocache, tracesSampleRate: isLocalHost() ? 1 : 0.3 });
  } catch (err) {
    console.log(`Sentry: ${err}`);
  }

  const navLang = navigator.language;
  const langCodesMap = {
    "zh-CN": "zh-Hans",
    "zh-SG": "zh-Hans",
    "zh-HK": "zh-Hant",
    "zh-TW": "zh-Hant",
  };
  const mappedLanguage = langCodesMap[navLang] || navLang;
  SettingProxy.addSetting(Settings, "language", {
    default: Language.availableLanguages.includes(mappedLanguage)
      ? mappedLanguage
      : "en",
  });

  Settings.language = Language.availableLanguages.includes(Settings.language) ? Settings.language : 'en';

  if (['ja', 'ko', 'zh-Hans', 'zh-Hant'].includes(Settings.language))
    MapBase.setFallbackFonts();
  
  // Open side-menu on default only on desktop
  SettingProxy.addSetting(Settings, 'isMenuOpened', {
    default: (() => {
      try {
        const height = window.screen.availHeight;
        const width = window.screen.availWidth;
        const mediaMobile = window.matchMedia('only screen and (max-width: 760px)').matches;
        return (height > width && mediaMobile) ? false : true;
      } catch (err) {
        return false;
      }
    })(),
  });

  //Convert some old settings here
  //amount and collected items are converted in mapping
  Object.keys(localStorage).forEach(key => {
    if(key.startsWith('main.')) {
      localStorage.setItem(`rdr2collector.${key.replace('main.', '')}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    else if(key == 'customMarkersColors') {
      localStorage.setItem(`rdr2collector.${key}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    else if(key.startsWith('routes.')) {
      localStorage.setItem(`rdr2collector.${key}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    else if(key.startsWith('inventory.')) {
      localStorage.setItem(`rdr2collector.${key}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
    else if(key == 'enabled-categories') {
      localStorage.setItem(`rdr2collector.${key}`, localStorage.getItem(key));
      localStorage.removeItem(key);
    }
  });


  Menu.init();
  MapBase.mapInit(); // MapBase.map
  const languages = Language.init().then(() => Language.setMenuLanguage());
  changeCursor();

  if (!MapBase.isPreviewMode)

  updateTopWidget();

  /*
  - clockTick() relies on DOM and jquery
  - guaranteed only by this script’s position at end of index.html
  */
  setInterval(clockTick, 1000);
}

function isLocalHost() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function changeCursor() {
  const isCoordsEnabled = Settings.isCoordsOnClickEnabled || RouteSettings.customRouteEnabled;
  const pointer = 'url(assets/images/crosshair_thick.png) 12 12, pointer';
  document.querySelector('.leaflet-grab').style.cursor = isCoordsEnabled ? pointer : 'grab';

  const latLngCtn = document.querySelector('.lat-lng-container');
  latLngCtn.style.display = isCoordsEnabled ? 'block' : 'none';
  if (isCoordsEnabled) {
    draggableLatLngCtn ||= new PlainDraggable(latLngCtn);
  } else if (draggableLatLngCtn) {
    draggableLatLngCtn.remove();
    draggableLatLngCtn = null;
  }
}

function updateTopWidget() {
  const pEl = document.querySelectorAll('.top-widget > p');

  pEl.forEach((el, idx) => {
      if (Settings.topWidgetState !== idx) el.classList.add('hidden'); 
      else el.classList.remove('hidden');
  });
}

function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function setClipboardText(text) {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

function downloadAsFile(filename, text) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function clockTick() {
  'use strict';
  const now = MapBase.mapTime();
  const gameTime = new Date(now * 30);
  const gameHour = gameTime.getUTCHours();
  const nightTime = gameHour >= 22 || gameHour < 5;
  const clockFormat = {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: Settings.isClock24Hour ? 'h23' : 'h12',
  };

  // Preview mode removes these elements.
  const timeInGame = document.getElementById('time-in-game');
  if (timeInGame)
    timeInGame.textContent = gameTime.toLocaleString(Settings.language, clockFormat);

  const dayCycleEl = document.getElementById('day-cycle');
  if (dayCycleEl) {
    const file = dayCycleEl.getAttribute('src').filename;
    if ((nightTime && file !== "moon") || (!nightTime && file !== "sun")) {
      dayCycleEl.classList.remove('hidden');
      dayCycleEl.setAttribute('src', `./assets/images/${nightTime ? 'moon' : 'sun'}.png`);
    }
  }

  const cycleResetTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const delta = new Date(cycleResetTime - now);
  const deltaFormat = {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  };

  // Preview mode removes this element.
  const countdown = document.getElementById('countdown');
  if (countdown)
    countdown.textContent = delta.toLocaleString([], deltaFormat);

  document.querySelectorAll('[data-marker*="provision_wldflwr_agarita"], [data-marker*="provision_wldflwr_blood_flower"]').forEach(marker => {
    const isImportant = marker.classList.contains('highlight-items');
    const whiteGlow = 'drop-shadow(0 0 .5rem #fff) drop-shadow(0 0 .3rem #fff)';
    const redGlow = 'drop-shadow(0 0 .5rem #cc0000) drop-shadow(0 0 .4rem #cc0000)';
    const pinkGlow = 'drop-shadow(0 0 .5rem #ff6fc7) drop-shadow(0 0 .3rem #ff6fc7)';
    if (MapBase.isPreviewMode) {
      marker.style.filter = 'none';
    } else if (isImportant && nightTime) {
      marker.style.filter = pinkGlow;
    } else if (isImportant) {
      marker.style.filter = redGlow;
    } else {
      marker.style.filter = nightTime ? whiteGlow : 'none';
    }
  });

  document.querySelectorAll('.leaflet-marker-icon[data-time]').forEach(marker => {
    let time = marker.dataset.time || '';
    if (time === '') return;
    if (time.split(',').includes(gameHour + '') && !MapBase.isPreviewMode) {
        marker.style.filter = 'drop-shadow(0 0 .5rem #fff) drop-shadow(0 0 .25rem #fff)';
    } else {
        marker.style.filter = 'none';
    }
  });
}

/*
- rest of file: event handler registrations (and some more functions)
- registrations require DOM ready and jquery
  - guaranteed only by this script’s position at end of index.html
- some handlers require scripts to be initialized and data loaded
  - NOT GUARANTEED
  - only hope: user does not do anything until that happens
- please move them out of here to their respective owners
*/
const sideMenu = document.querySelector('.side-menu');
const scrollerLineTop = document.querySelector('.scroller-line-tp');
const scrollerArrowTop = document.querySelector('.scroller-arrow-tp');
const scrollerLineBottom = document.querySelector('.scroller-line-bt');
const scrollerArrowBottom = document.querySelector('.scroller-arrow-bt');
const backToTop = document.getElementById('back-to-top');
const draggableBackToTop = draggify(backToTop, { storageKey: 'rdr2collector.backToTopPosition' });
let wasAtTop = true;
let wasAtBottom = false;
let lastScrollY = sideMenu.scrollTop;






function setSettings(settings) {
  // Sorry, old settings! :-(
  if (settings.version === undefined) {
    location.reload();
    return;
  }

  delete settings.version;

  for (const key in settings) {
    //Skip `rdo.` keys.
    if (!key.startsWith('rdo.')) {
        localStorage.setItem(key, settings[key]);
    }
  }
  // Do this for now, maybe look into refreshing the menu completely (from init) later.
  location.reload();
}

function formatLootTableLevel(table, rate = 1, level = 0) {
  const result = document.createElement('div');

  const items = MapBase.lootTables.loot[table];
  const hasItems = !!items;

  // Max. 2 digits but no trailing.
  const formatted = Number((rate * 100).toPrecision(2));

  if (hasItems) {
    const title = document.createElement('span');
    title.className = `loot-table-title level-${level + 1}`;
    if (level === 0) {
      const h4 = document.createElement('h4');
      h4.setAttribute('data-text', `menu.${table}`);
      title.appendChild(h4);
    } else {
      const h5 = document.createElement('h5');
      h5.setAttribute('data-text', `menu.${table}`);
      title.appendChild(h5);
      const rateEl = document.createElement('h5');
      rateEl.className = 'rate';
      rateEl.textContent = `${formatted}%`;
      title.appendChild(rateEl);
    }
    result.appendChild(title);

    const wrapper = document.createElement('div');
    wrapper.className = `loot-table-wrapper level-${level + 1}`;
    Object.keys(items).forEach(key => {
      wrapper.appendChild(formatLootTableLevel(key, rate * items[key], level + 1));
    });
    result.appendChild(wrapper);
  } else {
    const item = document.createElement('div');
    item.className = 'loot-table-item';
    item.innerHTML = `<span data-text="${table}.name"></span><span class="rate">~${formatted}%</span>`;
    result.appendChild(item);
  }

  return result;
}




if (isMobile()) {
  searchHotkey.style.display = 'none';

  Settings.overrideBrowserSearch = false;
  overrideSearch.check = false;
  overrideSearch.parentElement.parentElement.classList.add('disabled');
  overrideSearch.parentElement.parentElement.disabled = true;
}


/**
  linear proportion with cut values out of range:
  value - number to convert,
  iMin - input range minimum,
  iMax - input range maximum,
  oMin - output range minimum,
  oMax - output range maximum;
**/
function linear(value, iMin, iMax, oMin, oMax) {
  const clamp = (num, min, max) => {
    return num <= min ? min : num >= max ? max : num;
  }
  return clamp((((value - iMin) / (iMax - iMin)) * (oMax - oMin) + oMin), oMin, oMax);
}

// converts number to correct 12/24 hours time:
function convertToTime(hours = '00', minutes = '00') {
  return Settings.isClock24Hour ?
    `${hours}:${minutes}` :
    `${+hours % 12 || 12}:${minutes} ${+hours >= 12 ? 'PM' : 'AM'}`;
}

// returns an Array with all hours between from...to
function timeRange(from, to) {
  const times = [];

  let hour = from;
  while (hour !== to) {
    times.push(hour);
    hour = (hour + 1) % 24;
    if (times.length >= 24) break;
  }
  return times;
}

function isEmptyObject(obj) {
  if (obj == null) return true;
  if (typeof obj !== 'object') return false;
  return Object.keys(obj).length === 0;
}

/**
 * Loads a specified font and adds it to the document's font set.
 *
 * @param {string} name - The name of the font.
 * @param {Object} urls - An object containing URLs for different font formats.
 * @param {string} [urls.woff2] - The URL for the WOFF2 font format.
 * @param {string} [urls.woff] - The URL for the WOFF font format.
 * @param {string} [urls.ttf] - The URL for the TTF font format.
 * @returns {Promise<FontFace>} A promise that resolves to the loaded FontFace object.
 * 
 * @example
 * const urls = {
 *   woff2: '/assets/fonts/font.woff2',
 *   woff: '/assets/fonts/font.woff',
 *   ttf: '/assets/fonts/font.ttf'
 * };
 */
function loadFont(name, urls = {}) {
  const sources = [
    { url: urls.woff2, format: 'woff2' },
    { url: urls.woff, format: 'woff' },
    { url: urls.ttf, format: 'truetype' }
  ]
    .filter(({ url }) => url)
    .map(({ url, format }) => `url(${url}) format('${format}')`)
    .join(', ');

  const fontFace = new FontFace(name, sources, { style: 'normal', weight: '400' });
  return fontFace.load().then(() => {
    document.fonts.add(fontFace);
    return fontFace;
  });
}

function isMobile() {
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const hasTouchPoints = 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0;
  const isMobileUAData = navigator.userAgentData ? navigator.userAgentData.mobile : false;
  const isMobileUserAgent = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return isCoarsePointer || hasTouchPoints || isMobileUAData || isMobileUserAgent;
}

function detectPlatform() {
  const { userAgentData, userAgent, vendor } = navigator;
  const platform = userAgentData?.platform || userAgent || vendor || window.opera || '';
  const platforms = {
    macOS: /Macintosh|MacIntel|MacPPC|Mac68K|Mac OS X/i,
    Windows: /Windows|Win32|Win64|WOW64|WinCE/i,
    Android: /Android/i,
    Linux: /Linux/i,
  };
  for (const [key, regex] of Object.entries(platforms)) {
    if (regex.test(platform)) return key;
  }

  return 'other';
}

/**
 * Converts placeholders within a translated string into corresponding HTML elements.
 * This function processes a DOM element's innerHTML and replaces specific placeholder
 * tokens (e.g., {↑}, {↓}, {Enter}) with the corresponding HTML representations provided
 * in the placeholders object.
 * 
 * @param {HTMLElement} el - The DOM element containing the translated text with placeholders.
 * @param {Object} placeholders - An object mapping placeholder tokens to their HTML representations.
 *                                The keys are the placeholders and the values are the HTML strings.
 * @returns {void}
 * 
 * @example
 * const el = document.getElementById('query-suggestions-hotkeys');
 * const placeholders = {
 *   '↑': '<kbd class="hotkey">↑</kbd>',
 *   '↓': '<kbd class="hotkey">↓</kbd>',
 *   'Enter': '<kbd class="hotkey">Enter</kbd>'
 * };
 * placeholdersToHtml(el, placeholders);
 * // The innerHTML of the element will be:
 * // 'Search in suggestions, Press <kbd class="hotkey">↑</kbd> <kbd class="hotkey">↓</kbd> <kbd class="hotkey">Enter</kbd> for general search.'
 */
function placeholdersToHtml(el, placeholders) {
  let html = el.innerHTML;
  Object.entries(placeholders).forEach(
    ([key, value]) => (html = html.split(`{${key}}`).join(value))
  );
  el.innerHTML = html;
}

/**
 * Makes an element draggable.
 *
 * @param {HTMLElement} el - The element to make draggable.
 * @param {Object} options - Configuration options for the draggable functionality.
 * @param {string} options.storageKey - The key used to save the element's position in localStorage.
 * @returns {Object} An object containing:
 *  - `isDragging`: A function that returns a boolean indicating if the element is being dragged.
 *  - `getDistanceMoved`: A function that returns the distance moved since the drag started.
 */
function draggify(el, { storageKey }) {
  if (!el) {
    console.error('Element not found');
    return;
  }

  let isDragging = false;
  let startX, startY, initialX, initialY;
  let currentX = 0, currentY = 0;

  const savePosition = () => {
    const position = { x: currentX, y: currentY };
    localStorage.setItem(storageKey, JSON.stringify(position));
  };

  const restorePosition = () => {
    const savedPosition = localStorage.getItem(storageKey);
    if (savedPosition) {
      const { x, y } = JSON.parse(savedPosition);
      currentX = x;
      currentY = y;
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  };

  const onDragStart = (e) => {
    isDragging = true;
    startX = e.clientX || e.touches[0].clientX;
    startY = e.clientY || e.touches[0].clientY;
    initialX = currentX;
    initialY = currentY;
    el.style.transition = 'none';
    el.style.cursor = 'grabbing';
    requestAnimationFrame(updatePosition);
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    currentX = initialX + (clientX - startX);
    currentY = initialY + (clientY - startY);
  };

  const onDragEnd = () => {
    isDragging = false;
    el.style.transition = '0.2s all';
    el.style.cursor = 'grab';
    savePosition();
  };

  const updatePosition = () => {
    if (isDragging) {
      el.style.transform = `translate(${currentX}px, ${currentY}px)`;
      requestAnimationFrame(updatePosition);
    }
  };

  el.addEventListener('pointerdown', onDragStart);
  document.addEventListener('pointermove', onDragMove);
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragEnd);

  el.addEventListener('touchstart', onDragStart);
  document.addEventListener('touchmove', onDragMove);
  document.addEventListener('touchend', onDragEnd);
  document.addEventListener('touchcancel', onDragEnd);

  restorePosition();

  return {
    isDragging: () => isDragging,
    getDistanceMoved: () =>
      Math.sqrt((currentX - initialX) ** 2 + (currentY - initialY) ** 2)
  };
}

function animateValue(el, start, end, duration) {
  const startTime = performance.now();
  function step(currTime) {
    const progress = Math.min((currTime - startTime) / duration, 1);
    const value = start + (end - start) * progress;

    el.textContent = `$${value.toFixed(2)}`;
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
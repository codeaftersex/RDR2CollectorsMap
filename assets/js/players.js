let huntingAreaCircle = null
let safezoneCircles = []
let safezoneMarkers = []
let focusedSafezoneCircle = null
MapBase.players = MapBase.players || []
// Horse Racing Checkpoints
let raceCheckpointMarkers = []
let raceCheckpointLines = []

// Radius scale factor: divide in-game radius by this number for map display
// Adjust this if circles appear too large or too small on the map
const SAFEZONE_RADIUS_SCALE = 15

// Coordinate conversion constants
// DONT TOUCH UNLESS YOU KNOW WHAT YOU ARE DOING
const COORD_X_OFFSET = 111.29
const COORD_Y_OFFSET = -63.6
const COORD_SCALE = 0.01552

// Convert game coordinates to map coordinates WITHOUT the debug marker
function gameToMapCoords(x, y) {
  return {
    lat: COORD_SCALE * y + COORD_Y_OFFSET,
    long: COORD_SCALE * x + COORD_X_OFFSET
  }
}

// Convert map coordinates back to game coordinates
function mapToGameCoords(lat, lng) {
  return {
    x: (lng - COORD_X_OFFSET) / COORD_SCALE,
    y: (lat - COORD_Y_OFFSET) / COORD_SCALE
  }
}

// Listen for click mode toggle
let mapClickMode = false

window.addEventListener("message", (event) => {
  console.log('[RDR2 Map] Received ANY message:', event.data?.type, event.data);
  if (event.data && event.data.type === "enableMapClick") {
    mapClickMode = event.data.enabled || false
    if (mapClickMode) {
      MapBase.map.getContainer().style.cursor = 'crosshair'
    } else {
      MapBase.map.getContainer().style.cursor = ''
    }
  } else if (event.data && event.data.type === "players:update") {
    const players = event.data.data
    MapBase.players.forEach(marker => {
      if (Layers.playersLayer) {
        Layers.playersLayer.removeLayer(marker)
      } else {
        MapBase.map.removeLayer(marker)
      }
    })
    MapBase.players = []

    players.forEach(player => {
      const pos = MapBase.gameToMap(player.coordinates.x, player.coordinates.y, "Hunting Area")

      const marker = L.marker([pos.lat, pos.long], {
        icon: new L.DivIcon.DataMarkup({
          iconSize: [40, 40],
          iconAnchor: [20, 40],
          popupAnchor: [0, -35],
          html: `<img src="${player.avatar}" style="width:40px;height:40px;border-radius:50%;border:2px solid white;">`,
          tippy: player.characterName
        }),
        isAdmin: player.isAdmin
      }).bindPopup(`
        <div style="text-align:center; min-width:150px">
          <img src="${player.avatar}" style="border-radius:50%;width:50px;height:50px;" /><br>
          <b>${player.characterName}</b><br>
          ${player.username} | (${player.job})
          <hr>
          <button onclick="window.parent.postMessage({ type: 'admin:teleport', playerId: '${player.id}' }, '*')">Teleport</button>
          <button onclick="window.parent.postMessage({ type: 'admin:bring', playerId: '${player.id}' }, '*')">Bring</button>
          <button onclick="window.parent.postMessage({ type: 'admin:kick', playerId: '${player.id}' }, '*')">Kick</button>
        </div>
      `)

      marker.addTo(Layers.playersLayer || MapBase.map)
      MapBase.players.push(marker)
    })
  } else if (event.data && event.data.type === "highlightAdmins") {
    highlightAdmins(event.data.value)
  } else if (event.data && event.data.type === "showHuntingArea") {
    if (!event.data.coords) return
    const x = event.data.coords.x
    const y = event.data.coords.y
    if (typeof x !== "number" || typeof y !== "number") return

    const pos = gameToMapCoords(x, y)

    if (huntingAreaCircle) {
      if (Layers.huntingLayer) {
        Layers.huntingLayer.removeLayer(huntingAreaCircle)
      } else {
        MapBase.map.removeLayer(huntingAreaCircle)
      }
    }

    const circle = L.circle([pos.lat, pos.long], {
          radius: event.data.radius || 50,
          color: "#ff0000",
          weight: 3,
          fillColor: "#ff0000",
          fillOpacity: 0.15,
          dashArray: "3 4"
        }).bindPopup(`
          <div style="text-align:center; min-width:150px">
            <b>Hunting Zone</b><br>
            Radius: ${event.data.radius || 50}m
          </div>
        `)

    if (Layers.huntingLayer) {
      circle.addTo(Layers.huntingLayer)
    } else {
      circle.addTo(MapBase.map)
    }

    huntingAreaCircle = circle
  } else if (event.data && event.data.type === "showSafezones") {
    //console.log('[SAFEZONE MAP] Received showSafezones with', event.data.zones ? event.data.zones.length : 0, 'zones')
    initMapClickHandler()
    
    safezoneCircles.forEach(circle => {
      if (Layers.playersLayer) {
        Layers.playersLayer.removeLayer(circle)
      } else {
        MapBase.map.removeLayer(circle)
      }
    })
    safezoneCircles = []
    
    safezoneMarkers.forEach(marker => {
      if (Layers.itemMarkersLayer) {
        Layers.itemMarkersLayer.removeLayer(marker)
      } else if (Layers.playersLayer) {
        Layers.playersLayer.removeLayer(marker)
      } else {
        MapBase.map.removeLayer(marker)
      }
    })
    safezoneMarkers = []

    // Add new safezone circles
    if (event.data.zones && Array.isArray(event.data.zones)) {
      //console.log('[SAFEZONE MAP] Processing', event.data.zones.length, 'zones')
      event.data.zones.forEach(zone => {
        if (typeof zone.x !== "number" || typeof zone.y !== "number") {
          console.log('[SAFEZONE MAP] Invalid zone coords:', zone)
          return
        }

        const pos = gameToMapCoords(zone.x, zone.y)
        const color = zone.color || "#10b981"

        // Scale radius for map display (game units to map meters)
        const mapRadius = (zone.radius || 50) / SAFEZONE_RADIUS_SCALE
        
        const circle = L.circle([pos.lat, pos.long], {
          radius: mapRadius,
          color: color,
          weight: 3,
          fillColor: color,
          fillOpacity: 0.15,
          dashArray: "5 5"
        }).bindPopup(`
          <div style="text-align:center; min-width:150px">
            <b>${zone.name || "Safezone"}</b><br>
            <span style="color:${color};font-weight:bold;text-transform:uppercase;">${zone.type || "unknown"}</span><br>
            Radius: ${zone.radius || 50}m
          </div>
        `)

        if (Layers.playersLayer) {
          circle.addTo(Layers.playersLayer)
        } else {
          circle.addTo(MapBase.map)
        }

        safezoneCircles.push(circle)
      })
    }
  } else if (event.data && event.data.type === "showSingleZone") {
    // Clear previous focused zone
    if (focusedSafezoneCircle) {
      if (Layers.playersLayer) {
        Layers.playersLayer.removeLayer(focusedSafezoneCircle)
      } else {
        MapBase.map.removeLayer(focusedSafezoneCircle)
      }
      focusedSafezoneCircle = null
    }

    // Show and focus on single zone
    if (event.data.zone) {
      const zone = event.data.zone
      if (typeof zone.x !== "number" || typeof zone.y !== "number") return

      const pos = gameToMapCoords(zone.x, zone.y)
      const color = zone.color || "#10b981"

      // Scale radius for map display (game units to map meters)
      const mapRadius = (zone.radius || 50) / SAFEZONE_RADIUS_SCALE
      
      const circle = L.circle([pos.lat, pos.long], {
        radius: mapRadius,
        color: color,
        weight: 4,
        fillColor: color,
        fillOpacity: 0.25,
        dashArray: "5 5"
      }).bindPopup(`
        <div style="text-align:center; min-width:150px">
          <b>${zone.name || "Safezone"}</b><br>
          <span style="color:${color};font-weight:bold;text-transform:uppercase;">${zone.type || "unknown"}</span><br>
          Radius: ${zone.radius || 50}m
        </div>
      `)

      if (Layers.playersLayer) {
        circle.addTo(Layers.playersLayer)
      } else {
        circle.addTo(MapBase.map)
      }

      // Center map on zone
      MapBase.map.setView([pos.lat, pos.long], 6)
      circle.openPopup()

      focusedSafezoneCircle = circle
    }
  } else if (event.data && event.data.type === "showRaceCheckpoints") {
    // Check if map is ready
    if (typeof MapBase === 'undefined' || !MapBase.map) return
    
    // Clear existing race checkpoint markers and lines
    raceCheckpointMarkers.forEach(marker => MapBase.map.removeLayer(marker))
    raceCheckpointMarkers = []
    raceCheckpointLines.forEach(line => MapBase.map.removeLayer(line))
    raceCheckpointLines = []
    
    // Add new race checkpoint markers
    if (!event.data.checkpoints || !Array.isArray(event.data.checkpoints)) return
    
    const checkpointPositions = []
    
    event.data.checkpoints.forEach((checkpoint, index) => {
      if (typeof checkpoint.x !== "number" || typeof checkpoint.y !== "number") return
      
      const pos = gameToMapCoords(checkpoint.x, checkpoint.y)
      checkpointPositions.push([pos.lat, pos.long])
      
      const color = checkpoint.color || "#d4af7a"
      const number = index + 1
      
      // Create numbered marker for checkpoint
      const marker = L.marker([pos.lat, pos.long], {
        icon: L.divIcon({
          className: 'race-checkpoint-marker',
          html: `<div style="background: ${color}; border: 3px solid #fff; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; color: #1a1410; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">${number}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })
      })
      
      marker.addTo(MapBase.map)
      raceCheckpointMarkers.push(marker)
    })
    
    // Draw lines connecting checkpoints
    if (checkpointPositions.length > 1) {
      const line = L.polyline(checkpointPositions, {
        color: '#d4af7a',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
      })
      
      line.addTo(MapBase.map)
      raceCheckpointLines.push(line)
    }
  }

})

// Map click handler for adding safezones/checkpoints
function initMapClickHandler() {
  if (typeof MapBase !== 'undefined' && MapBase.map) {
    MapBase.map.on('click', function(e) {
      if (mapClickMode) {
        // Convert map lat/lng to game coordinates
        const coords = mapToGameCoords(e.latlng.lat, e.latlng.lng)
        
        window.parent.postMessage({
          type: 'mapClick',
          coords: coords
        }, '*')
      }
    })
  } else {
    setTimeout(initMapClickHandler, 500)
  }
}

// Initialize map click handler when map loads
initMapClickHandler()



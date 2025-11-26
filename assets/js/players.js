let huntingAreaCircle = null

window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "players:update") {
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

    const pos = MapBase.gameToMap(x, y)

    if (huntingAreaCircle) {
      if (Layers.huntingLayer) {
        Layers.huntingLayer.removeLayer(huntingAreaCircle)
      } else {
        MapBase.map.removeLayer(huntingAreaCircle)
      }
    }

    const circle = L.circle([pos.lat, pos.long], {
      radius: event.data.radius || 50,
      color: "#000000",
      weight: 3,
      fill: false,
      fillOpacity: 0,
      dashArray: "3 4"
    })

    if (Layers.huntingLayer) {
      circle.addTo(Layers.huntingLayer)
    } else {
      circle.addTo(MapBase.map)
    }

    huntingAreaCircle = circle
  }

})

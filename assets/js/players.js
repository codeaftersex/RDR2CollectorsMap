
MapBase.players = [];

function highlightAdmins(enable) {
  MapBase.players.forEach(marker => {
    const isAdmin = marker.options.isAdmin; // player datasındaki isAdmin
    const iconEl = marker.getElement(); // marker DOM elementi
    if (!iconEl) return;

    const imgEl = iconEl.querySelector('img'); // img elementini alıyoruz
    if (!imgEl) return;

    if (enable && isAdmin) {
      imgEl.style.border = '2px solid red';
    } else {
      imgEl.style.border = '2px solid white'; // varsayılan border
    }
  });
}


window.addEventListener("message", (event) => {
  if (event.data?.type === "players:update") {
    const players = event.data.data;
    MapBase.players.forEach(marker => Layers.playersLayer?.removeLayer(marker));
    MapBase.players = [];

    players.forEach(player => {
      console.log("Player data:", player);
      const { lat, long } = MapBase.gameToMap(player.coordinates.x, player.coordinates.y);

      // Marker oluştur
     const marker = L.marker([lat, long], {
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
    `);

      // Marker’i map’e ve array’e ekle
      marker.addTo(Layers.playersLayer || MapBase.map);
      MapBase.players.push(marker);

      console.log("Marker added:", marker);
    });
  } else if (event.data?.type == "highlightAdmins") {
    highlightAdmins(event.data.value);
  }
});

const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

let now = Date.now();
let date = new Date();

let folderPrefix = getFolderPrefix(date);
console.log("Starting log prefix:", folderPrefix);

const urls = require("./urls.json")

fetchAll();
setInterval(fetchAll, 60 * 1000);

let oldVehicles = new Map();
const prefixes = ["41|", "42|", "43|", "44|"];
let streams = {};

function getFolderPrefix(date) {
  const d = new Date(date);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);

  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function checkDate() {
  const newPrefix = getFolderPrefix(new Date());
  if (newPrefix !== folderPrefix) {
    Object.values(streams).forEach(s => s.end());
    streams = {};
    folderPrefix = newPrefix;
    console.log(`NEW DAY: ${folderPrefix}`);
  }
}

function getStream(prefixKey) {
  if (!streams[prefixKey]) {
    const dir = path.join("history/" + folderPrefix);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `${prefixKey}.txt`);
    streams[prefixKey] = fs.createWriteStream(filePath, { flags: "a" });
  }
  return streams[prefixKey];
}

function formatVehicle(vec, oldVec) {
  return [
    vec.id,
    38 - vec.lat.toFixed(5),
    9 + vec.lon.toFixed(5),
    (vec.speed * 3.6).toFixed(1),
    vec.bearing,
    vec.stop_id,
    getStatus(vec.current_status),
    (vec.door_status === "OPEN" ? "1" : "0"),
    (!oldVec || vec.trip_id !== oldVec.trip_id) ? vec.trip_id : "",
    (!oldVec || vec.block_id !== oldVec.block_id) ? vec.block_id : "",
    (!oldVec || vec.shift_id !== oldVec.shift_id) ? vec.shift_id : ""
  ].join("<");
}

function getStatus(s) {
  switch(s) {
    case "INCOMING_AT":
      return "2"
    case "IN_TRANSIT_TO":
      return "1"
    case "STOPPED_AT":
      return "0"
    default:
      return "9"
  }
}

async function fetchAll() {
  now = Date.now();
  date = new Date();
  checkDate();

  let vehicles;
  try {
    const res = await fetch(urls.CMET);
    //const res2 = await fetch(urls.MOBI);
    vehicles = (await res.json()).filter(v => v.timestamp * 1000 > (now - 30 * 1000));

  } catch {
    console.log("FAILED TO FETCH");
    return;
  }

  prefixes.forEach((prefix, i) => {
    const stream = getStream(`CM${i + 1}`);
    const filtered = vehicles.filter(v =>
        v.id.startsWith(prefix)
    );
    if (filtered.length > 0) {
      const lines = filtered.map(vec => {
        const oldVec = oldVehicles.get(vec.id);
        return formatVehicle(vec, oldVec);
      });
      stream.write(`\n${now}\n` + lines.join("€"));
    }
  });

  console.log(`[${date.toString()}] Fetched ${vehicles.length} vehicles.`);
  oldVehicles = new Map(vehicles.map(v => [v.id, v]));
}

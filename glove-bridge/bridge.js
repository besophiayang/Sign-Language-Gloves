const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const WebSocket = require("ws");

const PORT_NAME = process.env.GLOVE_PORT || "COM6";
const BAUD = parseInt(process.env.GLOVE_BAUD || "115200", 10);
const WS_PORT = parseInt(process.env.WS_PORT || "8787", 10);

const wss = new WebSocket.Server({ port: WS_PORT });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.send(JSON.stringify({ type: "status", ok: true, message: "connected_to_bridge" }));
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

const sp = new SerialPort({ path: PORT_NAME, baudRate: BAUD });
const parser = sp.pipe(new ReadlineParser({ delimiter: "\n" }));

sp.on("open", () => {
  broadcast({ type: "status", ok: true, message: `serial_open:${PORT_NAME}@${BAUD}` });
});

sp.on("error", (e) => {
  broadcast({ type: "status", ok: false, message: `serial_error:${String(e.message || e)}` });
});

parser.on("data", (line) => {
  const text = String(line).trim();
  if (!text) return;
  broadcast({ type: "glove", text });
});

console.log(`Glove bridge running. WS: ws://localhost:${WS_PORT}  Serial: ${PORT_NAME}@${BAUD}`);

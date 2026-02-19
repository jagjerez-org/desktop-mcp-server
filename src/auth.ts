import { randomBytes, createHash, createHmac } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// ── Config ────────────────────────────────────────────
const CONFIG_DIR = join(homedir(), ".desktop-mcp");
const TOKENS_FILE = join(CONFIG_DIR, "tokens.json");
const SECRET_FILE = join(CONFIG_DIR, "server.secret");

interface PairedDevice {
  id: string;
  name: string;
  tokenHash: string;
  pairedAt: string;
  lastSeen: string;
  ip: string;
}

interface PairingSession {
  code: string;
  expiresAt: number;
  clientName?: string;
}

// ── State ─────────────────────────────────────────────
let activePairingSession: PairingSession | null = null;
let pairedDevices: PairedDevice[] = [];
let serverSecret: string;

// ── Init ──────────────────────────────────────────────
export function initAuth() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });

  // Load or create server secret
  if (existsSync(SECRET_FILE)) {
    serverSecret = readFileSync(SECRET_FILE, "utf-8").trim();
  } else {
    serverSecret = randomBytes(32).toString("hex");
    writeFileSync(SECRET_FILE, serverSecret, { mode: 0o600 });
  }

  // Load paired devices
  if (existsSync(TOKENS_FILE)) {
    try {
      pairedDevices = JSON.parse(readFileSync(TOKENS_FILE, "utf-8"));
    } catch {
      pairedDevices = [];
    }
  }

  console.error(`🔐 Auth initialized. ${pairedDevices.length} paired device(s).`);
}

function saveDevices() {
  writeFileSync(TOKENS_FILE, JSON.stringify(pairedDevices, null, 2), { mode: 0o600 });
}

// ── Pairing ───────────────────────────────────────────
export function startPairing(ttlSeconds = 120): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  activePairingSession = {
    code,
    expiresAt: Date.now() + ttlSeconds * 1000,
  };
  console.error(`\n🔗 PAIRING CODE: ${code} (expires in ${ttlSeconds}s)\n`);
  return code;
}

export function completePairing(
  code: string,
  clientName: string,
  clientIp: string
): { token: string; deviceId: string } | null {
  if (!activePairingSession) return null;
  if (Date.now() > activePairingSession.expiresAt) {
    activePairingSession = null;
    return null;
  }
  if (activePairingSession.code !== code) return null;

  // Generate token
  const deviceId = randomBytes(8).toString("hex");
  const rawToken = randomBytes(48).toString("base64url");
  const token = `dmcp_${deviceId}_${rawToken}`;
  const tokenHash = createHmac("sha256", serverSecret).update(token).digest("hex");

  pairedDevices.push({
    id: deviceId,
    name: clientName,
    tokenHash,
    pairedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    ip: clientIp,
  });

  saveDevices();
  activePairingSession = null;

  console.error(`✅ Device paired: ${clientName} (${deviceId}) from ${clientIp}`);
  return { token, deviceId };
}

// ── Token Validation ──────────────────────────────────
export function validateToken(token: string, clientIp: string): PairedDevice | null {
  const tokenHash = createHmac("sha256", serverSecret).update(token).digest("hex");
  const device = pairedDevices.find((d) => d.tokenHash === tokenHash);
  if (!device) return null;

  // Update last seen
  device.lastSeen = new Date().toISOString();
  device.ip = clientIp;
  saveDevices();

  return device;
}

// ── Device Management ─────────────────────────────────
export function listDevices(): Array<Omit<PairedDevice, "tokenHash">> {
  return pairedDevices.map(({ tokenHash, ...rest }) => rest);
}

export function revokeDevice(deviceId: string): boolean {
  const before = pairedDevices.length;
  pairedDevices = pairedDevices.filter((d) => d.id !== deviceId);
  if (pairedDevices.length < before) {
    saveDevices();
    console.error(`🚫 Device revoked: ${deviceId}`);
    return true;
  }
  return false;
}

export function revokeAll(): number {
  const count = pairedDevices.length;
  pairedDevices = [];
  saveDevices();
  console.error(`🚫 All ${count} device(s) revoked`);
  return count;
}

// ── Middleware helper ──────────────────────────────────
export function authenticate(
  req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } },
): PairedDevice | null {
  const auth = req.headers["authorization"];
  if (!auth || typeof auth !== "string") return null;

  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!token.startsWith("dmcp_")) return null;

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress
    ?? "unknown";

  return validateToken(token, ip);
}

export function isPairingActive(): boolean {
  if (!activePairingSession) return false;
  if (Date.now() > activePairingSession.expiresAt) {
    activePairingSession = null;
    return false;
  }
  return true;
}

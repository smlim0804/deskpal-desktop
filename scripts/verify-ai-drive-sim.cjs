function assert(condition, message) {
  if (!condition) {
    console.error(`AI drive simulation failed: ${message}`);
    process.exitCode = 1;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAiMovementAction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = String(value.type || "").trim().toLowerCase();
  if (type !== "motion") return null;
  const dx = clamp(Number(value.dx) || 0, -1, 1);
  const dy = clamp(Number(value.dy) || 0, -1, 1);
  const speed = Number.isFinite(Number(value.speed)) ? clamp(Number(value.speed), 0.35, 2.5) : null;
  const spin = clamp(Number(value.spin) || 0, -3, 3);
  if (Math.hypot(dx, dy) < 0.05 && Math.abs(spin) < 0.05 && speed === null) return null;
  return {
    type: "motion",
    dx,
    dy,
    distance: clamp(Number(value.distance) || 220, 0, 520),
    speed,
    spin,
    holdMs: Math.round(clamp(Number(value.holdMs) || 2600, 600, 8000)),
  };
}

function aiActionToMovementCommand(action) {
  if (!action) return null;
  const command = { changed: false };
  if (action.type === "motion") {
    if (Math.hypot(action.dx, action.dy) >= 0.05 && action.distance > 0) {
      command.target = { x: action.dx, y: action.dy };
      command.distance = action.distance;
    }
    if (Number.isFinite(action.speed)) command.speed = action.speed;
    if (Number.isFinite(action.spin) && Math.abs(action.spin) >= 0.05) command.spin = action.spin * 34;
    command.aiHoldMs = action.holdMs;
    command.changed = true;
  }
  return command.changed ? command : null;
}

function effectiveBehaviorForPet(pet, now) {
  const base = pet.behavior;
  if (!pet.aiBehaviorOverride || now >= (pet.aiControlledUntil || 0)) return base;
  return { ...base, ...pet.aiBehaviorOverride };
}

function applyAiMovementAction(pet, command, now) {
  const behavior = { ...effectiveBehaviorForPet(pet, now) };
  const aiHoldUntil = now + (Number.isFinite(command.aiHoldMs) ? command.aiHoldMs : 3600);
  pet.pausedByPanel = false;
  pet.replySlowUntil = 0;
  pet.aiControlledUntil = aiHoldUntil;
  pet.aiDrive = null;

  if (Number.isFinite(command.speed)) behavior.speedMultiplier = clamp(command.speed, 0.25, 3);
  if (behavior.movementStyle === "stay") behavior.movementStyle = "free";

  if (command.target) {
    const dx = command.target.x || 0;
    const dy = command.target.y || 0;
    const length = Math.hypot(dx, dy) || 1;
    pet.aiDrive = {
      dx: dx / length,
      dy: dy / length,
      speed: Number.isFinite(command.speed) ? command.speed : Number(behavior.speedMultiplier) || 1,
      spin: Number.isFinite(command.spin) ? command.spin : 0,
      until: aiHoldUntil,
    };
    pet.targetX = clamp(pet.x + (dx / length) * command.distance, 0, 746);
    pet.targetY = clamp(pet.y + (dy / length) * command.distance, 0, 546);
    pet.vx += (dx / length) * 1.8;
    pet.vy += (dy / length) * 1.8;
  }

  pet.aiBehaviorOverride = behavior;
}

function activeAiDriveForPet(pet, now) {
  const drive = pet.aiDrive;
  if (!drive) return null;
  if (now >= drive.until) {
    pet.aiDrive = null;
    return null;
  }
  const dx = Number(drive.dx) || 0;
  const dy = Number(drive.dy) || 0;
  const spin = Number(drive.spin) || 0;
  return Math.hypot(dx, dy) < 0.05 && Math.abs(spin) < 0.05 ? null : drive;
}

function updateMotion(pet, now, step) {
  const behavior = effectiveBehaviorForPet(pet, now);
  const movement = { speed: 1.6, accel: 0.08, damping: 0.92, wobble: 0 };
  const aiDrive = activeAiDriveForPet(pet, now);
  const aiControlled = !!aiDrive || now < (pet.aiControlledUntil || 0);
  if (pet.pausedByPanel && !aiControlled) {
    pet.vx = 0;
    pet.vy = 0;
    return;
  }
  if (aiDrive) {
    const dx = Number(aiDrive.dx) || 0;
    const dy = Number(aiDrive.dy) || 0;
    const dist = Math.hypot(dx, dy) || 1;
    const driveSpeed = clamp(Number(aiDrive.speed) || Number(behavior.speedMultiplier) || 1, 0.35, 3);
    const accel = movement.accel * driveSpeed * 2.4;
    pet.vx += (dx / dist) * accel * step;
    pet.vy += (dy / dist) * accel * step;
  } else if (behavior.movementStyle !== "stay") {
    pet.vx += 0.01 * step;
  }
  const baseMaxSpeed = movement.speed * behavior.speedMultiplier * (aiDrive ? clamp(Number(aiDrive.speed) || 1, 1, 3) * 1.25 : 1);
  const speed = Math.hypot(pet.vx, pet.vy);
  if (speed > baseMaxSpeed) {
    pet.vx *= baseMaxSpeed / speed;
    pet.vy *= baseMaxSpeed / speed;
  }
  pet.x += pet.vx * step;
  pet.y += pet.vy * step;
}

const now = 1000;
const pet = {
  x: 220,
  y: 160,
  vx: 0,
  vy: 0,
  targetX: 220,
  targetY: 160,
  behavior: { movementStyle: "stay", mouseMode: "avoid", speedMultiplier: 0.25 },
  aiBehaviorOverride: null,
  aiControlledUntil: 0,
  aiDrive: null,
  pausedByPanel: true,
  replySlowUntil: now + 16000,
};

const action = normalizeAiMovementAction({ type: "motion", dx: 0.8, dy: 0.2, speed: 2.2, spin: 0.4, holdMs: 3000 });
const command = aiActionToMovementCommand(action);
applyAiMovementAction(pet, command, now);

assert(pet.pausedByPanel === false, "AI action must release panel pause");
assert(pet.replySlowUntil === 0, "AI action must clear reply slowdown");
assert(pet.aiControlledUntil > now, "AI action must set an active control window");
assert(pet.aiBehaviorOverride?.movementStyle === "free", "AI action must override menu stay with temporary free movement");
assert(pet.aiDrive && pet.aiDrive.dx > 0.9 && pet.aiDrive.dy > 0.2, "AI action must create a normalized direct drive vector");

const before = { x: pet.x, y: pet.y, vx: pet.vx, vy: pet.vy };
pet.pausedByPanel = true;
updateMotion(pet, now + 100, 1);

assert(pet.vx > before.vx, "AI drive must increase velocity even if the panel tries to pause movement");
assert(pet.x > before.x, "AI drive must move the character in the chosen direction");
assert(effectiveBehaviorForPet(pet, now + 100).movementStyle === "free", "effective behavior must stay AI-controlled while active");

updateMotion(pet, now + 5000, 1);
assert(pet.aiDrive === null, "AI drive must clear after its hold window");

if (!process.exitCode) console.log("AI drive simulation passed.");

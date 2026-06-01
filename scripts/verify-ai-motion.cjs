const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root, "src", "main.cjs"), "utf8");
const overlay = fs.readFileSync(path.join(root, "src", "overlay.js"), "utf8");
const overlayCss = fs.readFileSync(path.join(root, "src", "overlay.css"), "utf8");

function assertMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    console.error(`AI motion invariant failed: ${message}`);
    process.exitCode = 1;
  }
}

function assertNotMatch(source, pattern, message) {
  if (pattern.test(source)) {
    console.error(`AI motion invariant failed: ${message}`);
    process.exitCode = 1;
  }
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

const plannerPrompt = functionBody(main, "buildMovementPlannerPrompt");
const plannerNoneReviewPrompt = functionBody(main, "buildMovementPlannerNoneReviewPrompt");
const plannerRepairPrompt = functionBody(main, "buildMovementPlannerRepairPrompt");
const normalizePlannerAction = functionBody(main, "normalizePlannerAction");
const normalizePlannerDecision = functionBody(main, "normalizePlannerDecision");
const normalizePlannerReview = functionBody(main, "normalizePlannerReview");
const planAiMovement = functionBody(main, "planAiMovement");
const runAiChat = functionBody(main, "runAiChat");
const normalizeAiMovementAction = functionBody(overlay, "normalizeAiMovementAction");
const aiActionToMovementCommand = functionBody(overlay, "aiActionToMovementCommand");
const applyAiActionResult = functionBody(overlay, "applyAiActionResult");
const applyMovementAction = functionBody(overlay, "applyMovementAction");
const updateMotion = functionBody(overlay, "updateMotion");
const activeAiDriveForPet = functionBody(overlay, "activeAiDriveForPet");
const movementStateForPet = functionBody(overlay, "movementStateForPet");
const positionPetBubble = functionBody(overlay, "positionPetBubble");

assertMatch(plannerPrompt, /Use your own judgement every time\. Do not keyword-match/, "planner must ask the AI to judge, not keyword-match");
assertMatch(plannerPrompt, /dx\/dy are free continuous steering values/, "planner must use continuous dx/dy body control");
assertMatch(plannerPrompt, /temporary AI override above the user's menu settings/, "planner must know AI body control overrides menu settings temporarily");
assertMatch(plannerPrompt, /current screen image is attached|attached image is available/, "planner prompt must include image context when available");
assertMatch(plannerPrompt, /cannot inspect images\. Judge movement from text, visible reply, and movement state only/, "planner must not pretend unsupported providers can see images");
assertNotMatch(plannerPrompt, /left\|right\|up\|down\|center/, "planner prompt must not expose fixed direction commands");
assertMatch(plannerNoneReviewPrompt, /Use your own judgement\. Do not keyword-match/, "planner none review must ask AI to judge instead of keyword-matching");
assertMatch(plannerNoneReviewPrompt, /no-movement plan contradicts the user's intent or the character reply/, "planner none review must catch reply/action contradictions");
assertNotMatch(plannerNoneReviewPrompt, /left\|right\|up\|down\|center/, "planner none review prompt must not expose fixed direction commands");
assertMatch(plannerRepairPrompt, /Re-evaluate from scratch using your own judgement\. Do not keyword-match/, "planner repair must ask the AI to re-judge failed plans");
assertNotMatch(plannerRepairPrompt, /left\|right\|up\|down\|center/, "planner repair prompt must not expose fixed direction commands");
assertNotMatch(main + overlay, /BUSYPET_ACTION/, "AI movement must not use hidden command directives");
assertMatch(main, /function providerSupportsImageAttachments\(provider\)[\s\S]*return provider === "codex"/, "only verified image-capable providers should receive image attachments");
assertMatch(main, /function imagePathsForProvider\(provider, imagePaths\)[\s\S]*providerSupportsImageAttachments\(provider\) \? imagePaths : \[\]/, "unsupported providers must receive no image file paths");
assertMatch(runAiChat, /const supportedImagePaths = imagePathsForProvider\(ai\.provider, imagePaths\)/, "AI chat must gate images by provider capability");
assertMatch(runAiChat, /imageSupport: supportsImages/, "AI chat prompt must know whether the provider can see images");
assertMatch(runAiChat, /chatWithProvider\(ai\.provider, status\.command, prompt, supportedImagePaths\)/, "visible AI chat must only attach supported image paths");
assertMatch(runAiChat, /planAiMovement\(ai\.provider, status\.command, aiPayload, imagePaths, chat\.text\)/, "AI chat must always request AI movement planning with requested image context");
assertMatch(planAiMovement, /const supportedImagePaths = imagePathsForProvider\(provider, imagePaths\)/, "AI planner must gate images by provider capability");
assertMatch(planAiMovement, /const plannerPayload = \{[\s\S]*requestedImagePaths: imagePaths,[\s\S]*imageSupport: providerSupportsImageAttachments\(provider\)/, "AI planner payload must preserve requested image context and provider image support");
assertMatch(planAiMovement, /buildMovementPlannerPrompt\(plannerPayload, visibleReply\)/, "AI planner must request a first movement plan");
assertMatch(planAiMovement, /const plan = await chatWithProvider\(provider, command, planPrompt, supportedImagePaths\)/, "AI movement planner must receive supported image context");
assertMatch(planAiMovement, /const reviewPlan = await chatWithProvider\(provider, command, reviewPrompt, supportedImagePaths\)/, "AI no-movement reviewer must receive supported image context");
assertMatch(planAiMovement, /const repairPlan = await chatWithProvider\(provider, command, repairPrompt, supportedImagePaths\)/, "AI movement repair must receive supported image context");
assertMatch(planAiMovement, /buildMovementPlannerRepairPrompt\(plannerPayload, visibleReply/, "AI planner must retry unusable plans with an AI repair prompt");
assertNotMatch(runAiChat, /chatLikelyNeedsMovementPlan/, "AI movement planning must not be gated by a local keyword detector");
assertNotMatch(planAiMovement, /chatLikelyNeedsMovementPlan|parseLocalMovementCommand|applyMovementCommand/, "AI movement repair must not fall back to local command parsing");
assertMatch(normalizePlannerDecision, /type === "none".*return \{ ok: true, action: null \}/s, "valid AI none decisions must not be treated as malformed plans");
assertMatch(normalizePlannerReview, /typeof value\.reconsider !== "boolean"/, "AI none review must require an explicit boolean reconsider decision");
assertMatch(planAiMovement, /if \(decision\.ok && decision\.action\) return decision\.action/, "AI planner must immediately return concrete AI body actions");
assertMatch(planAiMovement, /buildMovementPlannerNoneReviewPrompt\(plannerPayload, visibleReply, plan\.text\)/, "AI planner must ask AI to review no-movement decisions");
assertMatch(planAiMovement, /if \(!review\.ok \|\| !review\.reconsider\) return null/, "AI planner must only repair none decisions when AI reviewer asks for reconsideration");
assertMatch(planAiMovement, /const repairDecision = .*normalizePlannerDecision/s, "AI planner repair must use the same decision validator");
assertMatch(runAiChat, /try \{[\s\S]*planAiMovement\(ai\.provider, status\.command, aiPayload, imagePaths, chat\.text\)[\s\S]*\} finally \{[\s\S]*fs\.rmSync\(filePath, \{ force: true \}\)/, "temporary screen captures must stay alive until AI movement planning finishes");
assertNotMatch(normalizePlannerAction, /lowerType === "move"|lowerType === "spin"|followmouse|avoidmouse|lowerType === "area"/, "planner action parser must not accept fixed command actions");
assertNotMatch(normalizePlannerAction, /left", "right", "up", "down", "center"/, "planner action parser must not accept fixed directions");

assertMatch(overlay, /settings\?\.ai\?\.enabled \? null : applyMovementCommand/g, "AI-enabled chat must bypass the local command parser");
assertNotMatch(normalizeAiMovementAction, /type === "move"|type === "spin"|followmouse|avoidmouse|type === "area"/, "overlay AI parser must not accept fixed command actions");
assertNotMatch(normalizeAiMovementAction, /left", "right", "up", "down", "center"/, "overlay AI parser must not accept fixed directions");
assertNotMatch(aiActionToMovementCommand, /action\.type === "move"|action\.type === "spin"|action\.type === "area"|action\.type === "followMouse"|action\.type === "avoidMouse"/, "AI action converter must only accept free motion, speed, and mode actions");
assertMatch(applyAiActionResult, /applyMovementAction\(pet, command, character, \{ source: "ai" \}\)/, "AI actions must be marked as AI-sourced");
assertMatch(applyMovementAction, /const fromAi = options\.source === "ai"/, "movement action must distinguish AI from menu/local commands");
assertMatch(applyMovementAction, /pet\.aiBehaviorOverride = behavior/, "AI behavior changes must stay transient on the pet");
assertMatch(applyMovementAction, /pet\.aiDrive = \{[\s\S]*dx:[\s\S]*dy:[\s\S]*until: aiHoldUntil/, "AI motion must create a transient direct drive vector");
assertMatch(applyMovementAction, /settingsChanged && !fromAi/, "AI behavior changes must not be persisted to settings");
assertMatch(applyMovementAction, /slot\.behavior = behavior/, "non-AI movement changes must still update menu settings");

assertMatch(activeAiDriveForPet, /now >= drive\.until[\s\S]*pet\.aiDrive = null/, "expired AI direct drive must clear itself");
assertMatch(updateMotion, /const behavior = effectiveBehaviorForPet\(pet, now\)/, "motion loop must use effective AI behavior");
assertMatch(updateMotion, /const aiDrive = activeAiDriveForPet\(pet, now\)/, "motion loop must read the transient AI direct drive");
assertMatch(updateMotion, /!!aiDrive \|\| now < \(pet\.aiControlledUntil \|\| 0\)/, "active AI drive must count as AI control");
assertMatch(updateMotion, /pet\.pausedByPanel && !aiControlled/, "panel pause must not block active AI control");
assertMatch(updateMotion, /!aiControlled && \(now > pet\.nextTargetAt \|\| reachedTarget\)/, "random target picking must not override active AI control");
assertMatch(updateMotion, /if \(!flying && aiDrive\)[\s\S]*pet\.vx \+= \(dx \/ dist\) \* accel \* step/, "AI drive must push velocity directly instead of only setting menu targets");
assertMatch(updateMotion, /!aiDrive && behavior\.mouseMode === "follow"[\s\S]*!aiDrive && behavior\.mouseMode === "avoid"/, "mouse menu behavior must not fight an active AI drive");
assertMatch(movementStateForPet, /aiControlled: now < \(pet\.aiControlledUntil \|\| 0\)/, "AI planner payload must include whether AI control is already active");
assertMatch(positionPetBubble, /bubble\.classList\.contains\("pet-thinking"\)/, "thinking dots must have a separate position path");
assertMatch(positionPetBubble, /pet\.y \+ size \+ 8/, "thinking dots must be positioned below the character");
assertMatch(overlayCss, /\.pet-floating-bubble\.pet-thinking\.is-visible\s*\{[\s\S]*translate\(-50%, 0\)/, "thinking dots must use below-character visible transform");

if (!process.exitCode) console.log("AI motion invariants passed.");

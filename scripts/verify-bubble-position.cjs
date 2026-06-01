function assert(condition, message) {
  if (!condition) {
    console.error(`Bubble position simulation failed: ${message}`);
    process.exitCode = 1;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function positionPetBubble({ pet, bubbleClass, size, viewport }) {
  const x = clamp(pet.x + size / 2, 14, Math.max(14, viewport.w - 14));
  const isThinking = bubbleClass.includes("pet-thinking");
  const y = isThinking ? clamp(pet.y + size + 8, 14, Math.max(14, viewport.h - 18)) : Math.max(14, pet.y - 8);
  return { x: Math.round(x), y: Math.round(y), isThinking };
}

function renderedBox(position, dimensions) {
  if (position.isThinking) {
    return {
      left: position.x - dimensions.width / 2,
      right: position.x + dimensions.width / 2,
      top: position.y,
      bottom: position.y + dimensions.height,
    };
  }
  return {
    left: position.x - dimensions.width / 2,
    right: position.x + dimensions.width / 2,
    top: position.y - dimensions.height,
    bottom: position.y,
  };
}

const viewport = { w: 1440, h: 900 };
const size = 64;
const pet = { x: 420, y: 260 };
const thought = renderedBox(
  positionPetBubble({ pet, bubbleClass: "pet-thought pet-floating-bubble", size, viewport }),
  { width: 220, height: 78 },
);
const thinking = renderedBox(
  positionPetBubble({ pet, bubbleClass: "pet-thinking pet-floating-bubble", size, viewport }),
  { width: 54, height: 24 },
);

assert(thought.bottom <= pet.y - 8, "speech bubble must render above the character");
assert(thinking.top >= pet.y + size + 8, "thinking dots must render below the character");
assert(thinking.top - thought.bottom >= size + 16, "thinking dots and speech bubble must stay separated by the character body");
assert(thinking.left > thought.left && thinking.right < thought.right, "thinking dots should remain centered under the same character");

const lowPet = { x: 120, y: viewport.h - size - 4 };
const lowThinking = renderedBox(
  positionPetBubble({ pet: lowPet, bubbleClass: "pet-thinking pet-floating-bubble", size, viewport }),
  { width: 54, height: 24 },
);
assert(lowThinking.top <= viewport.h - 18, "thinking dots must clamp near the bottom of the viewport");

if (!process.exitCode) console.log("Bubble position simulation passed.");

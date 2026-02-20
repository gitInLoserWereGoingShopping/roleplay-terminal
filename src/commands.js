import { state } from "./state.js";
import { addLine } from "./ui.js";
import { normalize } from "./utils.js";
import { enterNode, listChoices } from "./render.js";

export async function handleCommand(raw) {
  const input = normalize(raw);
  if (!state.story || !state.story.nodes) {
    addLine("System still booting. Try again in a moment.", "warn");
    return;
  }
  if (state.typing) {
    addLine("Signal processing in progress. Stand by.", "dim");
    return;
  }
  const node = state.story.nodes[state.nodeId];
  if (!input) return;

  addLine(`> ${raw}`, "dim");

  if (input === "help" || input === "?" || input === "f1") {
    addLine("Commands:");
    addLine("- help: Show this help", "dim");
    addLine("- look: Reprint current scene", "dim");
    addLine("- choices: List available actions", "dim");
    addLine("- inventory: List held items", "dim");
    addLine("- restart: Restart the story", "dim");
    addLine("- effects on/off: Toggle screen effects", "dim");
    addLine("- 1/2/3 or type a choice label", "dim");
    return;
  }

  if (input === "look") {
    addLine(`[${node.title}]`, "dim");
    node.lines.forEach((line) => {
      if (typeof line === "string") {
        addLine(line);
      } else {
        addLine(line.text || "", line.style || "");
      }
    });
    return;
  }

  if (input === "choices") {
    listChoices(node);
    return;
  }

  if (input === "inventory") {
    if (state.inventory.size === 0) {
      addLine("Inventory empty.", "dim");
    } else {
      addLine("Inventory:");
      Array.from(state.inventory).forEach((item) => addLine(`- ${item}`, "dim"));
    }
    return;
  }

  if (input === "restart") {
    state.inventory.clear();
    state.flags.clear();
    state.log = [];
    document.getElementById("screen").innerHTML = "";
    await enterNode(state.story.startNode);
    return;
  }

  if (input === "effects off") {
    state.effectsEnabled = false;
    addLine("Effects disabled.", "dim");
    return;
  }

  if (input === "effects on") {
    state.effectsEnabled = true;
    addLine("Effects enabled.", "dim");
    return;
  }

  if (node.ending) {
    addLine("Story complete. Type " + '"restart"' + " to play again.", "dim");
    return;
  }

  if (node.inputMap) {
    const target = node.inputMap[input];
    if (!target) {
      addLine(node.inputError || "Unrecognized response.", "warn");
      return;
    }
    await enterNode(target);
    return;
  }

  const choiceIndex = parseInt(input, 10);
  let chosen = null;
  if (!Number.isNaN(choiceIndex)) {
    chosen = node.choices[choiceIndex - 1];
  } else {
    chosen = node.choices.find((choice) => normalize(choice.label) === input);
  }

  if (!chosen) {
    addLine("Unrecognized command. Type 'help' for options.", "warn");
    return;
  }

  await enterNode(chosen.target, { preDelay: state.timing.choiceAdvanceDelay });
}

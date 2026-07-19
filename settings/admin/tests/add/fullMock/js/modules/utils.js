// utils.js — shared helpers for the full mock builder. Question editor
// forms live in the shared authoring engine (pages/mock/engine/author.js);
// this file keeps only tool-level utilities and the "add question" menus.
import { authorKinds, editorHTML, setupAuthorForms } from "/pages/mock/engine/author.js";

let uidCounter = 0;

const utils = {
  getUniqueId() {
    uidCounter += 1;
    return `${Date.now()}${uidCounter}`;
  },

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  // "add question" menu for a container; target = listening | reading
  menuHTML(target, containerId) {
    const buttons = authorKinds(target)
      .map(
        (k) =>
          `<button type="button" class="${k.isNew ? "au-new" : ""}" onclick="utils.addAuthorItem('${containerId}','${target}','${k.kind}')">${k.isNew ? "✨ " : "+ "}${k.label}</button>`
      )
      .join("");
    return `<div class="au-menu">${buttons}</div>`;
  },

  addAuthorItem(containerId, target, kind) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.insertAdjacentHTML("beforeend", editorHTML(target, kind, utils.getUniqueId()));
    container.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
  },
};

setupAuthorForms();

window.utils = utils;
export default utils;

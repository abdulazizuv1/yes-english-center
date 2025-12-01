import { readingState } from "./state.js";

export function cleanupHighlightListeners() {
  readingState.highlightEventListeners.forEach(({ element, type, listener }) => {
    element.removeEventListener(type, listener);
  });
  readingState.highlightEventListeners = [];
}

export function addTrackedListener(element, type, listener) {
  element.addEventListener(type, listener);
  readingState.highlightEventListeners.push({ element, type, listener });
}

export function initializeHighlightSystem() {
  cleanupHighlightListeners();

  let justShownMenu = false;

  const mouseUpHandler = function (e) {
    const selection = window.getSelection();
    const contextMenu = document.getElementById("contextMenu");

    if (selection.toString().length > 0) {
      readingState.selectedText = selection.toString();
      try {
        readingState.selectedRange = selection.getRangeAt(0);

        const passagePanel = document.querySelector(".passage-panel");
        const questionsPanel = document.querySelector(".questions-panel");

        if (
          passagePanel &&
          questionsPanel &&
          (passagePanel.contains(e.target) || questionsPanel.contains(e.target))
        ) {
          if (contextMenu) {
            contextMenu.style.display = "block";
            contextMenu.style.position = "absolute";
            contextMenu.style.left = e.pageX + "px";
            contextMenu.style.top = e.pageY + 10 + "px";
            contextMenu.style.zIndex = "99999";

            justShownMenu = true;
            setTimeout(() => {
              justShownMenu = false;
            }, 200);
          }
        }
      } catch (err) {
        readingState.selectedRange = null;
      }
    } else {
      if (contextMenu && !justShownMenu) {
        contextMenu.style.display = "none";
      }
    }
  };

  const contextMenuHandler = function (e) {
    const passagePanel = document.querySelector(".passage-panel");
    const questionsPanel = document.querySelector(".questions-panel");

    if (
      passagePanel &&
      questionsPanel &&
      (passagePanel.contains(e.target) || questionsPanel.contains(e.target))
    ) {
      e.preventDefault();
    }
  };

  const clickHandler = function (e) {
    const contextMenu = document.getElementById("contextMenu");
    if (contextMenu && !contextMenu.contains(e.target) && !justShownMenu) {
      contextMenu.style.display = "none";
    }
  };

  addTrackedListener(document, "mouseup", mouseUpHandler);
  addTrackedListener(document, "contextmenu", contextMenuHandler);
  addTrackedListener(document, "click", clickHandler);
}

let saveHighlightsTimeout;

export function saveCurrentHighlights(saveState) {
  clearTimeout(saveHighlightsTimeout);
  saveHighlightsTimeout = setTimeout(() => {
    try {
      const passageText = document.getElementById("passageText");
      const questionsList = document.getElementById("questionsList");

      if (passageText) {
        const highlights = passageText.querySelectorAll(".highlighted");
        if (highlights.length > 0) {
          const cleanedHTML = cleanHighlightHTML(passageText.innerHTML);
          readingState.passageHighlights[readingState.currentPassageIndex] = cleanedHTML;
        } else {
          delete readingState.passageHighlights[readingState.currentPassageIndex];
        }
      }

      if (questionsList) {
        const highlights = questionsList.querySelectorAll(".highlighted");
        if (highlights.length > 0) {
          const cleanedHTML = cleanHighlightHTML(questionsList.innerHTML);
          readingState.questionHighlights[readingState.currentPassageIndex] = cleanedHTML;
        } else {
          delete readingState.questionHighlights[readingState.currentPassageIndex];
        }
      }

      saveState();
    } catch (error) {
      console.warn("Failed to save highlights:", error);
    }
  }, 100);
}

export function cleanHighlightHTML(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  temp.querySelectorAll(".highlighted .highlighted").forEach((nested) => {
    const parent = nested.parentElement;
    if (parent && parent.classList.contains("highlighted")) {
      while (nested.firstChild) {
        parent.insertBefore(nested.firstChild, nested);
      }
      nested.remove();
    }
  });

  temp.querySelectorAll("*").forEach((el) => {
    const allowedAttrs = [
      "class",
      "id",
      "type",
      "name",
      "value",
      "data-question-id",
      "data-group-qids",
      "placeholder",
      "data-highlight",
    ];
    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      if (!allowedAttrs.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  temp.normalize();
  return temp.innerHTML;
}

export function restorePassageHighlights() {
  const index = readingState.currentPassageIndex;
  const passageText = document.getElementById("passageText");
  if (passageText && readingState.passageHighlights[index]) {
    try {
      passageText.innerHTML = readingState.passageHighlights[index];
    } catch (error) {
      console.warn("Failed to restore passage highlights:", error);
    }
  }
}

export function restoreHighlights(restoreInputEventListeners) {
  restorePassageHighlights();
  const questionsList = document.getElementById("questionsList");
  const index = readingState.currentPassageIndex;

  if (questionsList && readingState.questionHighlights[index]) {
    try {
      const savedHTML = readingState.questionHighlights[index];

      setTimeout(() => {
        questionsList.innerHTML = savedHTML;

        setTimeout(() => {
          restoreInputEventListeners();
        }, 50);
      }, 10);
    } catch (error) {
      console.warn("Failed to restore question highlights:", error);
      setTimeout(() => {
        restoreInputEventListeners();
      }, 50);
    }
  } else {
    setTimeout(() => {
      restoreInputEventListeners();
    }, 10);
  }
}

export function clearSelection() {
  window.getSelection().removeAllRanges();
  readingState.selectedText = "";
  readingState.selectedRange = null;
}

export function setupWindowHighlightActions(saveState) {
  window.highlightSelection = function () {
    if (!readingState.selectedRange) {
      const menu = document.getElementById("contextMenu");
      if (menu) menu.style.display = "none";
      return;
    }

    try {
      if (readingState.selectedRange.collapsed || !readingState.selectedRange.toString().trim()) {
        clearSelection();
        return;
      }

      const fragment = document.createDocumentFragment();
      const range = readingState.selectedRange.cloneRange();
      const contents = range.extractContents();

      function wrapTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent.trim()) {
            const span = document.createElement("span");
            span.className = "highlighted";
            span.setAttribute("data-highlight", "true");
            span.textContent = node.textContent;
            return span;
          }
          return node;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const clone = node.cloneNode(false);
          Array.from(node.childNodes).forEach((child) => {
            clone.appendChild(wrapTextNodes(child));
          });
          return clone;
        }
        return node;
      }

      Array.from(contents.childNodes).forEach((node) => {
        fragment.appendChild(wrapTextNodes(node));
      });

      range.insertNode(fragment);

      const commonAncestor = range.commonAncestorContainer;
      if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
        commonAncestor.normalize();
      } else if (commonAncestor.parentElement) {
        commonAncestor.parentElement.normalize();
      }

      clearSelection();
      saveCurrentHighlights(saveState);
    } catch (error) {
      console.warn("Failed to create highlight:", error);
      try {
        const span = document.createElement("span");
        span.className = "highlighted";
        span.setAttribute("data-highlight", "true");
        readingState.selectedRange.surroundContents(span);
        clearSelection();
        saveCurrentHighlights(saveState);
      } catch (e) {
        console.error("Fallback highlighting also failed:", e);
      }
    }

    const menu = document.getElementById("contextMenu");
    if (menu) menu.style.display = "none";
  };

  window.removeHighlight = function () {
    if (!readingState.selectedRange) {
      clearSelection();
      return;
    }

    try {
      const range = readingState.selectedRange.cloneRange();
      const container = range.commonAncestorContainer;
      let highlightedElements = [];

      if (container.nodeType === Node.TEXT_NODE) {
        let parent = container.parentElement;
        while (parent) {
          if (parent.classList && parent.classList.contains("highlighted")) {
            highlightedElements.push(parent);
            break;
          }
          parent = parent.parentElement;
        }
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        const allHighlights = container.querySelectorAll(".highlighted");
        highlightedElements = Array.from(allHighlights).filter((el) => {
          try {
            return range.intersectsNode(el);
          } catch (e) {
            return false;
          }
        });

        if (container.classList && container.classList.contains("highlighted")) {
          highlightedElements.push(container);
        }
      }

      highlightedElements.forEach((element) => {
        const parent = element.parentNode;
        if (parent) {
          while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }
          parent.removeChild(element);
          parent.normalize();
        }
      });

      saveCurrentHighlights(saveState);
    } catch (error) {
      console.warn("Failed to remove highlight:", error);
    }

    clearSelection();
    const menu = document.getElementById("contextMenu");
    if (menu) menu.style.display = "none";
  };
}



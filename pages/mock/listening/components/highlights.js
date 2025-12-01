import { listeningState } from "./state.js";

function getElementSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className) return `.${element.className.split(" ")[0]}`;
  return element.tagName.toLowerCase();
}

function getTextBefore(node) {
  let text = "";
  let current = node;

  while (current && text.length < 50) {
    if (current.previousSibling) {
      current = current.previousSibling;
      if (current.nodeType === Node.TEXT_NODE) {
        text = current.textContent + text;
      } else if (current.textContent) {
        text = current.textContent + text;
      }
    } else {
      current = current.parentNode;
      if (!current || current.id === "question-list") break;
    }
  }

  return text;
}

function getTextAfter(node) {
  let text = "";
  let current = node;

  while (current && text.length < 50) {
    if (current.nextSibling) {
      current = current.nextSibling;
      if (current.nodeType === Node.TEXT_NODE) {
        text += current.textContent;
      } else if (current.textContent) {
        text += current.textContent;
      }
    } else {
      current = current.parentNode;
      if (!current || current.id === "question-list") break;
    }
  }

  return text;
}

export function saveCurrentHighlights() {
  const questionList = document.getElementById("question-list");
  if (!questionList) return;

  const highlights = questionList.querySelectorAll(".highlighted");
  const sectionKey = `section_${listeningState.currentSectionIndex}`;

  if (!listeningState.savedHighlights[sectionKey]) {
    listeningState.savedHighlights[sectionKey] = [];
  }

  listeningState.savedHighlights[sectionKey] = [];

  highlights.forEach((highlight, index) => {
    const parent = highlight.parentNode;
    const parentHtml = parent.outerHTML || parent.innerHTML;
    const highlightText = highlight.textContent;
    const highlightHtml = highlight.outerHTML;

    const highlightId = `highlight_${listeningState.currentSectionIndex}_${index}_${Date.now()}`;
    highlight.setAttribute("data-highlight-id", highlightId);

    listeningState.savedHighlights[sectionKey].push({
      id: highlightId,
      text: highlightText,
      html: highlightHtml,
      parentSelector: getElementSelector(parent),
      textBefore: getTextBefore(highlight),
      textAfter: getTextAfter(highlight),
      parentHtml,
    });
  });

  localStorage.setItem("testHighlights", JSON.stringify(listeningState.savedHighlights));
}

export function loadSavedHighlights() {
  try {
    const saved = localStorage.getItem("testHighlights");
    if (saved) {
      listeningState.savedHighlights = JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Error loading highlights:", e);
    listeningState.savedHighlights = {};
  }
}

export function restoreHighlights() {
  const sectionKey = `section_${listeningState.currentSectionIndex}`;
  const highlights = listeningState.savedHighlights[sectionKey];

  if (!highlights || highlights.length === 0) return;

  setTimeout(() => {
    highlights.forEach((highlightData) => {
      restoreSingleHighlight(highlightData);
    });
  }, 100);
}

function restoreSingleHighlight(highlightData) {
  const questionList = document.getElementById("question-list");
  if (!questionList) return;

  const walker = document.createTreeWalker(
    questionList,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let textNode;
  // eslint-disable-next-line no-cond-assign
  while ((textNode = walker.nextNode())) {
    const nodeText = textNode.textContent;
    const targetText = highlightData.text;

    const index = nodeText.indexOf(targetText);
    if (index !== -1) {
      const parent = textNode.parentNode;
      if (parent && parent.classList && parent.classList.contains("highlighted")) {
        continue;
      }

      try {
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + targetText.length);

        const span = document.createElement("span");
        span.className = "highlighted";
        span.style.backgroundColor = "#ffeb3b";
        span.setAttribute("data-highlight-id", highlightData.id);

        range.surroundContents(span);
        break;
      } catch (e) {
        try {
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + targetText.length);

          const contents = range.extractContents();
          const span = document.createElement("span");
          span.className = "highlighted";
          span.style.backgroundColor = "#ffeb3b";
          span.setAttribute("data-highlight-id", highlightData.id);
          span.appendChild(contents);
          range.insertNode(span);
          break;
        } catch (e2) {
          console.warn("Failed to restore highlight:", e2);
        }
      }
    }
  }
}

let selectedRange = null;
let justShownMenu = false;

document.addEventListener("mouseup", (e) => {
  const selection = window.getSelection();
  const menu = document.getElementById("contextMenu");

  if (selection.toString().length > 0) {
    try {
      selectedRange = selection.getRangeAt(0);

      if (e.target.closest(".questions-panel")) {
        if (menu) {
          menu.style.display = "block";
          menu.style.position = "absolute";
          menu.style.left = e.pageX + "px";
          menu.style.top = e.pageY + 10 + "px";
          menu.style.zIndex = "99999";

          justShownMenu = true;
          setTimeout(() => {
            justShownMenu = false;
          }, 200);
        }
      }
    } catch (err) {
      selectedRange = null;
    }
  } else if (menu && !justShownMenu) {
    menu.style.display = "none";
  }
});

document.addEventListener("contextmenu", (e) => {
  if (e.target.closest(".questions-panel")) {
    e.preventDefault();
  }
});

document.addEventListener("click", (e) => {
  const menu = document.getElementById("contextMenu");
  if (menu && !e.target.closest("#contextMenu") && !justShownMenu) {
    menu.style.display = "none";
  }
});

window.highlightSelection = () => {
  if (selectedRange) {
    const span = document.createElement("span");
    span.className = "highlighted";
    span.style.backgroundColor = "#ffeb3b";

    try {
      selectedRange.surroundContents(span);
    } catch (e) {
      const contents = selectedRange.extractContents();
      span.appendChild(contents);
      selectedRange.insertNode(span);
    }

    window.getSelection().removeAllRanges();
    selectedRange = null;

    saveCurrentHighlights();
  }
  const menu = document.getElementById("contextMenu");
  if (menu) menu.style.display = "none";
};

window.removeHighlight = function () {
  if (selectedRange) {
    const container = selectedRange.commonAncestorContainer;
    const highlighted =
      container.nodeType === Node.TEXT_NODE
        ? container.parentElement.closest(".highlighted")
          ? [container.parentElement.closest(".highlighted")]
          : []
        : Array.from(container.querySelectorAll(".highlighted")).filter((el) =>
            selectedRange.intersectsNode(el)
          );

    highlighted.forEach((element) => {
      const parent = element.parentNode;
      parent.insertBefore(document.createTextNode(element.textContent), element);
      parent.removeChild(element);
      parent.normalize();
    });

    saveCurrentHighlights();
  }

  window.getSelection().removeAllRanges();
  selectedRange = null;
  const menu = document.getElementById("contextMenu");
  if (menu) menu.style.display = "none";
};



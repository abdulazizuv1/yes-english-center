// Text highlighting: context menu, yellow marker spans, per-section
// save/restore for listening and per-passage save/restore for reading.
import { state } from "./state.js";
import { saveState } from "./storage.js";
import { restoreInputEventListeners } from "./answers.js";

// Highlight system functions
function cleanupHighlightListeners() {
  state.highlightEventListeners.forEach(({ element, type, listener }) => {
    element.removeEventListener(type, listener);
  });
  state.highlightEventListeners = [];
}

function addTrackedListener(element, type, listener) {
  element.addEventListener(type, listener);
  state.highlightEventListeners.push({ element, type, listener });
}

function initializeHighlightSystem() {
  cleanupHighlightListeners();
  
  let justShownMenu = false;
  
  const mouseUpHandler = function(e) {
    const selection = window.getSelection();
    const contextMenu = document.getElementById("contextMenu");
    
    if (selection.toString().length > 0) {
      state.selectedText = selection.toString();
      try {
        state.selectedRange = selection.getRangeAt(0);
        
        const passagePanel = document.querySelector(".passage-panel");
        const questionsPanel = document.querySelector(".questions-panel");
        const listeningQuestions = document.getElementById("listening-questions");
        
        let isInHighlightableArea = false;
        
        if (passagePanel?.contains(e.target) || questionsPanel?.contains(e.target)) {
          isInHighlightableArea = true;
        }
        
        if (listeningQuestions?.contains(e.target)) {
          isInHighlightableArea = true;
        }
        
        if (state.currentStage === "reading" || state.currentStage === "listening") {
          const target = e.target.closest(".passage-panel, .questions-panel");
          if (target) {
            isInHighlightableArea = true;
          }
        }
        
        if (isInHighlightableArea && contextMenu) {
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
      } catch (err) {
        state.selectedRange = null;
      }
    } else {
      if (contextMenu && !justShownMenu) {
        contextMenu.style.display = "none";
      }
    }
  };
  
  const contextMenuHandler = function(e) {
    const passagePanel = document.querySelector(".passage-panel");
    const questionsPanel = document.querySelector(".questions-panel");
    const listeningQuestions = document.getElementById("listening-questions");
    
    let isInHighlightableArea = false;
    
    if (passagePanel?.contains(e.target) || questionsPanel?.contains(e.target)) {
      isInHighlightableArea = true;
    }
    
    if (listeningQuestions?.contains(e.target)) {
      isInHighlightableArea = true;
    }
    
    if (state.currentStage === "reading" || state.currentStage === "listening") {
      isInHighlightableArea = true;
    }
    
    if (isInHighlightableArea) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  };
  
  const clickHandler = function(e) {
    const contextMenu = document.getElementById("contextMenu");
    if (contextMenu && !contextMenu.contains(e.target) && !justShownMenu) {
      contextMenu.style.display = "none";
    }
  };
  
  addTrackedListener(document, "mouseup", mouseUpHandler);
  addTrackedListener(document, "contextmenu", contextMenuHandler);
  addTrackedListener(document, "click", clickHandler);
}

function saveCurrentHighlights() {
  if (state.currentStage === "listening") {
    const questionList = document.getElementById("listening-questions");
    if (!questionList) return;
    
    const highlights = questionList.querySelectorAll('.highlighted');
    const sectionKey = `section_${state.currentSectionIndex}`;
    
    if (!state.savedHighlights[sectionKey]) {
      state.savedHighlights[sectionKey] = [];
    }
    
    state.savedHighlights[sectionKey] = [];
    
    highlights.forEach((highlight, index) => {
      const parent = highlight.parentNode;
      const parentHtml = parent.outerHTML || parent.innerHTML;
      const highlightText = highlight.textContent;
      const highlightHtml = highlight.outerHTML;
      
      const highlightId = `highlight_${state.currentSectionIndex}_${index}_${Date.now()}`;
      highlight.setAttribute('data-highlight-id', highlightId);
      
      state.savedHighlights[sectionKey].push({
        id: highlightId,
        text: highlightText,
        html: highlightHtml,
        parentSelector: getElementSelector(parent),
        textBefore: getTextBefore(highlight),
        textAfter: getTextAfter(highlight)
      });
    });
  } else if (state.currentStage === "reading") {
    const passageText = document.getElementById("passageText");
    const questionsList = document.getElementById("reading-questions");
    
    if (passageText) {
      const highlights = passageText.querySelectorAll(".highlighted");
      if (highlights.length > 0) {
        const cleanedHTML = cleanHighlightHTML(passageText.innerHTML);
        state.passageHighlights[state.currentPassageIndex] = cleanedHTML;
      } else {
        delete state.passageHighlights[state.currentPassageIndex];
      }
    }
    if (questionsList) {
      const highlights = questionsList.querySelectorAll(".highlighted");
      if (highlights.length > 0) {
        const cleanedHTML = cleanHighlightHTML(questionsList.innerHTML);
        state.questionHighlights[state.currentPassageIndex] = cleanedHTML;
      } else {
        delete state.questionHighlights[state.currentPassageIndex];
      }
    }
  }
  
  saveState();
}

function restoreHighlights() {
  if (state.currentStage === "listening") {
    const sectionKey = `section_${state.currentSectionIndex}`;
    const highlights = state.savedHighlights[sectionKey];
    
    if (!highlights || highlights.length === 0) return;
    
    setTimeout(() => {
      highlights.forEach(highlightData => {
        restoreSingleHighlight(highlightData);
      });
    }, 100);
  } else if (state.currentStage === "reading") {
    restorePassageHighlights(state.currentPassageIndex);
    const questionsList = document.getElementById("reading-questions");
    if (questionsList && state.questionHighlights[state.currentPassageIndex]) {
      try {
        const savedHTML = state.questionHighlights[state.currentPassageIndex];
        
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
}

function restoreSingleHighlight(highlightData) {
  const questionList = document.getElementById("listening-questions");
  if (!questionList) return;
  
  const walker = document.createTreeWalker(
    questionList,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let textNode;
  while (textNode = walker.nextNode()) {
    const nodeText = textNode.textContent;
    const targetText = highlightData.text;
    
    const index = nodeText.indexOf(targetText);
    if (index !== -1) {
      const parent = textNode.parentNode;
      if (parent && parent.classList && parent.classList.contains('highlighted')) {
        continue;
      }
      
      try {
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + targetText.length);
        
        const span = document.createElement("span");
        span.className = "highlighted";
        span.style.backgroundColor = "#ffeb3b";
        span.setAttribute('data-highlight-id', highlightData.id);
        
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
          span.setAttribute('data-highlight-id', highlightData.id);
          span.appendChild(contents);
          range.insertNode(span);
          break;
        } catch (e2) {
          console.warn('Failed to restore highlight:', e2);
        }
      }
    }
  }
}

function getElementSelector(element) {
  if (element.id) return `#${element.id}`;
  if (element.className) return `.${element.className.split(' ')[0]}`;
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
      if (!current || current.id === 'listening-questions') break;
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
      if (!current || current.id === 'listening-questions') break;
    }
  }
  
  return text;
}

function cleanHighlightHTML(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  temp.querySelectorAll('.highlighted .highlighted').forEach(nested => {
    const parent = nested.parentElement;
    if (parent && parent.classList && parent.classList.contains('highlighted')) {
      while (nested.firstChild) {
        parent.insertBefore(nested.firstChild, nested);
      }
      nested.remove();
    }
  });
  
  temp.querySelectorAll('*').forEach(el => {
    const allowedAttrs = ['class', 'id', 'type', 'name', 'value', 'data-question-id', 'data-group-qids', 'placeholder', 'data-highlight'];
    const attrs = Array.from(el.attributes);
    attrs.forEach(attr => {
      if (!allowedAttrs.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  temp.normalize();
  
  return temp.innerHTML;
}

function restorePassageHighlights(index) {
  const passageText = document.getElementById("passageText");
  if (passageText && state.passageHighlights[index]) {
    try {
      passageText.innerHTML = state.passageHighlights[index];
    } catch (error) {
      console.warn("Failed to restore passage highlights:", error);
      const passage = state.stageData.reading.passages[index];
      const formattedText = passage.text
        .split("\n\n")
        .map(p => `<p>${p.trim()}</p>`)
        .join("");
      passageText.innerHTML = formattedText;
    }
  }
}

// Enhanced highlight functionality
window.highlightSelection = function() {
  if (!state.selectedRange) {
    document.getElementById("contextMenu").style.display = "none";
    return;
  }
  
  try {
    if (state.selectedRange.collapsed || !state.selectedRange.toString().trim()) {
      clearSelection();
      return;
    }
    
    // Create a document fragment to hold highlighted content
    const fragment = document.createDocumentFragment();
    
    // Clone the range to avoid modifying the original
    const range = state.selectedRange.cloneRange();
    
    // Extract contents from the range
    const contents = range.extractContents();
    
    // Function to wrap text nodes in highlight spans
    function wrapTextNodes(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim()) {
          const span = document.createElement("span");
          span.className = "highlighted";
          span.setAttribute("data-highlight", "true");
          span.style.backgroundColor = "#ffeb3b";
          span.textContent = node.textContent;
          return span;
        }
        return node;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // For element nodes, process their children
        const clone = node.cloneNode(false);
        Array.from(node.childNodes).forEach(child => {
          clone.appendChild(wrapTextNodes(child));
        });
        return clone;
      }
      return node;
    }
    
    // Process all nodes in the extracted contents
    Array.from(contents.childNodes).forEach(node => {
      fragment.appendChild(wrapTextNodes(node));
    });
    
    // Insert the highlighted content back
    range.insertNode(fragment);
    
    // Normalize to merge adjacent text nodes
    const commonAncestor = range.commonAncestorContainer;
    if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
      commonAncestor.normalize();
    } else if (commonAncestor.parentElement) {
      commonAncestor.parentElement.normalize();
    }
    
    clearSelection();
    saveCurrentHighlights();
  } catch (error) {
    console.warn("Failed to create highlight:", error);
    // If highlighting fails, try a simpler approach
    try {
      const span = document.createElement("span");
      span.className = "highlighted";
      span.setAttribute("data-highlight", "true");
      span.style.backgroundColor = "#ffeb3b";
      state.selectedRange.surroundContents(span);
      clearSelection();
      saveCurrentHighlights();
    } catch (e) {
      console.error("Fallback highlighting also failed:", e);
    }
  }
  
  document.getElementById("contextMenu").style.display = "none";
};

window.removeHighlight = function() {
  if (!state.selectedRange) {
    clearSelection();
    return;
  }
  
  try {
    const range = state.selectedRange.cloneRange();
    const container = range.commonAncestorContainer;
    let highlightedElements = [];
    
    // Find all highlighted elements that intersect with the selection
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
      // Get all highlighted elements within the container
      const allHighlights = container.querySelectorAll(".highlighted");
      highlightedElements = Array.from(allHighlights).filter(el => {
        try {
          return range.intersectsNode(el);
        } catch (e) {
          return false;
        }
      });
      
      // Also check if the container itself is highlighted
      if (container.classList && container.classList.contains("highlighted")) {
        highlightedElements.push(container);
      }
    }
    
    // Remove highlights by unwrapping the span elements
    highlightedElements.forEach(element => {
      const parent = element.parentNode;
      if (parent) {
        // Move all child nodes before the highlighted element
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }
        // Remove the now-empty highlighted span
        parent.removeChild(element);
        // Normalize to merge adjacent text nodes
        parent.normalize();
      }
    });
    
    saveCurrentHighlights();
  } catch (error) {
    console.warn("Failed to remove highlight:", error);
  }
  
  clearSelection();
  document.getElementById("contextMenu").style.display = "none";
};

function clearSelection() {
  window.getSelection().removeAllRanges();
  state.selectedText = "";
  state.selectedRange = null;
}
export { initializeHighlightSystem, saveCurrentHighlights, restoreHighlights };

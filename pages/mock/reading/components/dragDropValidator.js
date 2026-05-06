const QUESTION_TYPE_DRAG_DROP = 'drag_drop';

export function validateDragDrop(q) {
  if (!q.items?.length) throw new Error('drag_drop: items required');
  if (!q.slots?.length) throw new Error('drag_drop: slots required');
  const ids = new Set(q.items.map(i => i.id));
  q.slots.forEach(s => {
    if (!ids.has(s.correctId))
      throw new Error(`drag_drop: slot ${s.slotId} correctId "${s.correctId}" not in items`);
  });
}

export function scoreDragDrop(q, userAnswer) {
  if (!userAnswer || typeof userAnswer !== 'object') return 0;
  return q.slots.filter(s => userAnswer[s.slotId] === s.correctId).length;
}

export { QUESTION_TYPE_DRAG_DROP };

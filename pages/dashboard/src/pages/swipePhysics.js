/* ═══════════════════════════════════════════════════════════════════
   How a flashcard behaves under the finger.

   A card pivots around the point you grabbed it by, the way a real card
   does on a table: hold it near the top edge and drag right, and the
   bottom lags behind (turns clockwise); hold it near the bottom and it
   turns the other way. Release it far or fast enough and it keeps going
   along the throw instead of snapping back.

   Pure functions so the study page and its test exercise the same maths.
   ═══════════════════════════════════════════════════════════════════ */

export const SWIPE_DISTANCE = 110;   // px past which a release throws the card
export const SWIPE_VELOCITY = 0.55;  // px/ms that also counts as a throw
// Tilt is measured against the swipe distance, not the card's width, so the
// gesture feels the same on a phone and on a wide screen.
export const ROTATE_PER_SWIPE = 12;  // degrees once dragged a full swipe, held at an edge
export const MAX_ROTATE = 34;        // never let it spin past this while in hand

/** Where along the card's height it was grabbed: -1 top … 0 middle … +1 bottom. */
export function grabPoint(clientY, rect) {
    if (!rect?.height) return 0;
    const t = ((clientY - rect.top) / rect.height) * 2 - 1;
    return Math.max(-1, Math.min(1, t));
}

/** Rotation while dragging — the torque comes from the grab point. */
export function dragAngle(dx, grabY) {
    const raw = (dx / SWIPE_DISTANCE) * ROTATE_PER_SWIPE * -grabY;
    return Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, raw));
}

/** Did the release throw the card away, or should it spring back? */
export function isThrown(dx, vx) {
    return Math.abs(dx) > SWIPE_DISTANCE || Math.abs(vx) > SWIPE_VELOCITY;
}

/** Which way it went — right means "I know this one". */
export function throwDirection(dx, vx) {
    if (dx !== 0) return dx > 0 ? 1 : -1;
    return vx > 0 ? 1 : -1;
}

/** Where the card ends up once thrown: keeps the drag's heading and spin. */
export function flightTransform({ dx, dy, vx, grabY, viewportWidth }) {
    const dir = throwDirection(dx, vx);
    const x = dir * (viewportWidth * 0.9);
    // carry on along the same slope the drag had, so it leaves where it was headed
    const y = dy + (dy / (Math.abs(dx) || 1)) * viewportWidth * 0.15;
    // a thrown card keeps turning a little further than it did in hand
    const angle = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE,
        dragAngle(dir * SWIPE_DISTANCE * 2.2, grabY)));
    return { x, y, angle };
}

/** -1 … +1, how far the card leans towards "know it" / "still learning". */
export function leanAmount(dx) {
    return Math.max(-1, Math.min(1, dx / SWIPE_DISTANCE));
}

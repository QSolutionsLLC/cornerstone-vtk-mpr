import { import as csTools, toolColors } from 'cornerstone-tools';
import calculateReferenceLine from './calculateReferenceLine.js';

const draw = csTools('drawing/draw');
const drawLine = csTools('drawing/drawLine');
const convertToVector3 = csTools('util/convertToVectro3');

/**
 * Renders the active reference line.
 *
 * @export @public @method
 * @name renderActiveReferenceLine
 * @param  {Object} context        The canvas context.
 * @param  {Object} targetElement      The data associated with the event.
 * @param  {Object} targetImagePlane    The element on which to render the reference line.
 * @param  {Object} referenceImagePlane
 */
export default function(context, targetElement, targetImagePlane, referenceImagePlane) {

  // Target
  const tRowCosines = convertToVector3(targetImagePlane.rowCosines);
  const tColCosines = convertToVector3(targetImagePlane.columnCosines);

  // Reference
  const rRowCosines = convertToVector3(referenceImagePlane.rowCosines);
  const rColCosines = convertToVector3(referenceImagePlane.columnCosines);

  // The image plane normals must be > 30 degrees apart
  const targetNormal = tRowCosines
    .clone()
    .cross(tColCosines);
  const referenceNormal = rRowCosines
    .clone()
    .cross(rColCosines);
  let angleInRadians = targetNormal.angleTo(referenceNormal);

  angleInRadians = Math.abs(angleInRadians);
  if (angleInRadians < 0.5) {
    const angleInDegrees = angleInRadians * (180 / Math.PI)
    console.warn(`${angleInDegrees} angle is to small for reference lines.`)
    
    return;
  }

  const referenceLine = calculateReferenceLine(
    targetImagePlane,
    referenceImagePlane
  );

  if (!referenceLine) {
    return;
  }

  const color = referenceImagePlane.referenceLineColor || toolColors.getActiveColor();

  // Draw the referenceLines
  context.setTransform(1, 0, 0, 1, 0, 0);

  draw(context, context => {
    drawLine(
      context,
      targetElement,
      referenceLine.start,
      referenceLine.end,
      { color }
    );
  });
}

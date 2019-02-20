import { vec3 } from 'gl-matrix';
import cornerstone, {
    getEnabledElement,
    metaData,
    pixelToCanvas,
    loadAndCacheImage,
    getViewport,
    displayImage,
    updateImage,
  } from 'cornerstone-core'
  import { Vector3 } from 'cornerstone-math';
  import {
    addToolState,
    getToolState,
    import as csTools,
    setToolDisabled,
    store,
    toolColors,
  } from 'cornerstone-tools'

  import renderReferenceLine from './renderReferenceLine.js';
  import getMprUrl from './lib/getMprUrl.js'
  import tryGetVtkVolumeForSeriesNumber from './lib/vtk/tryGetVtkVolumeForSeriesNumber.js';

  const BaseAnnotationTool = csTools('base/BaseAnnotationTool')

  // Drawing
  const drawLine = csTools('drawing/drawLine')
  const getNewContext = csTools('drawing/getNewContext')

  // Util
  const imagePointToPatientPoint = csTools('util/imagePointToPatientPoint')
  const projectPatientPointToImagePlane = csTools(
    'util/projectPatientPointToImagePlane'
  )


  /**
   * @export @public @class
   * @name AstCrossPoint
   * @classdesc
   * @extends BaseAnnotationTool
   */
  export default class MprTool extends BaseAnnotationTool {
    constructor(configuration = {}) {
      const defaultConfig = {
        name: 'Mpr',
        supportedInteractionTypes: ['Mouse', 'Touch'],
        // TODO: Set when a tool is added
        options: {
          // mouseButtonMask: 1,
          preventHandleOutsideImage: true,
        },
        configuration: {
          shadow: true,
          shadowColor: '#000000',
          shadowOffsetX: 1,
          shadowOffsetY: 1,
        },
      }
      const initialConfiguration = Object.assign(defaultConfig, configuration)

      super(initialConfiguration)

      this.initialConfiguration = initialConfiguration
      this.mergeOptions(initialConfiguration.options)

      this.updatePoint = _updatePoint.bind(this)
      this.syncedId = null
    }

    activeCallback(element, options) {

    }

    passiveCallback(element, options) {
      setToolDisabled(this.name, options)
    }

    enabledCallback(element, options) {
      setToolDisabled(this.name, options)
    }

    disabledCallback(element, options) {
      // store.state.enabledElements.forEach(async enabledElement => {
      //   clearToolState(enabledElement, this.name)
      //   const isEnabled = await waitForElementToBeEnabled(enabledElement)
      //   const hasLoadedImage = await waitForEnabledElementImageToLoad(
      //     enabledElement
      //   )
      //   if (isEnabled && hasLoadedImage) {
      //     updateImage(enabledElement)
      //   }
      // })
    }

    // BaseAnnotationTool, despite no persistent
    pointNearTool() {
      return false
    }

    /**
     *
     *
     * @param {*} evt
     * @returns
     */
    renderToolData(evt) {
      const eventData = evt.detail
      const element = eventData.element
      const enabledElement = getEnabledElement(element)
      const toolData = getToolState(evt.currentTarget, this.name)
      const context = getNewContext(eventData.canvasContext.canvas);
      
      ///// -----------------

      store.state.enabledElements.forEach(refElement => {
        const image = cornerstone.getImage(element);
        const refImage = cornerstone.getImage(refElement)
  
        // duck out if target is us
        if (refElement === element) {
          return;
        }
        // Don't draw reference line for non-mpr
        if(!refImage || !refImage.imageId.includes('mpr')){
          // console.warn('skipping; wrong image scheme');
          return;
        }

        const imagePlane = metaData.get('imagePlaneModule', image.imageId);
        const refImagePlane = metaData.get('imagePlaneModule', refImage.imageId);

        renderReferenceLine(context, element, imagePlane, refImagePlane)
      });


      //// ------------------
      
      
      // console.log(toolData)
      if (!toolData || !toolData.data || !toolData.data.length) return
      toolData.data.forEach(data => {
        if (data.visible === false) return
        if (!data.point) return
        _drawCrosshairs(data, context, element)
      })
    }

    /**
     * We use the post mouse down hook so we don't accidentally prevent passive
     * tool manipulation.
     *
     * @param {*} evt
     * @returns {boolean} true - consumes event
     * @memberof AstCrossPoint
     */
    postMouseDownCallback(evt) {
      this.updatePoint(evt)
      evt.preventDefault()
      evt.stopPropagation()

      const consumeEvent = true
      return consumeEvent
    }

    mouseDragCallback(evt) {
      this.updatePoint(evt)
      evt.preventDefault()
      evt.stopPropagation()
    }

    mouseMoveCallback(evt) {
      return false
    }

    postTouchStartCallback(evt) {
      this.updatePoint(evt)
      evt.preventDefault()
      evt.stopPropagation()

      const consumeEvent = true
      return consumeEvent
    }

    touchDragCallback(evt) {
      this.updatePoint(evt)
      evt.preventDefault()
      evt.stopPropagation()
    }
  }

  /**
   *
   *
   * @param {*} data
   * @param {*} context
   * @param {*} element
   */
  const _drawCrosshairs = function(data, context, element) {
    const color = toolColors.getActiveColor()
    const point = pixelToCanvas(element, data.point)
    const distance = 15
    const top = {
      x: point.x,
      y: point.y - distance,
    }
    const right = {
      x: point.x + distance,
      y: point.y,
    }
    const bottom = {
      x: point.x,
      y: point.y + distance,
    }
    const left = {
      x: point.x - distance,
      y: point.y,
    }
    drawLine(context, element, top, bottom, { color }, 'canvas')
    drawLine(context, element, left, right, { color }, 'canvas')
  }

  /**
   *
   *
   * @param {*} evt
   * @returns
   */
  const _updatePoint = async function(evt) {
    const eventData = evt.detail
    evt.stopImmediatePropagation()

    const element = evt.currentTarget;
    const enabledElement = getEnabledElement(evt.currentTarget)
    const imageId = enabledElement.image.imageId
    const imagePlane = metaData.get('imagePlaneModule', imageId)
    const imagePointXY = eventData.currentPoints.image

    // The point we've clicked is the "center" we want for our crosspoint;
    // However, our imageLoader uses the IPP as the "top left" for the slice
    // We need to calculate what the "top left" _would be_ if our clicked ipp
    // were in the center of a new slice
    // TODO: Replace this with an MPR specific version so we can use vec3
    // TODO: in metadata instead of old types?
    const ipp = imagePointToPatientPoint(imagePointXY, imagePlane)
    const ippVec3 = vec3.fromValues(ipp.x, ipp.y, ipp.z)
    const ippTopLeftVec3 = await _findIppTopLeftForVolume(imagePlane, ippVec3)

    store.state.enabledElements.forEach(targetElement => {
      const targetImage = cornerstone.getImage(targetElement)

      if (targetElement === element) {
        return;
      }
      if(!targetImage.imageId.includes('mpr')){
        // console.warn('skipping; wrong image scheme');
        return;
      }

      // Load image w/ same IOP, but w/ updated IPP
      const targetImagePlane = metaData.get('imagePlaneModule', targetImage.imageId);
      const iopString = targetImagePlane.rowCosines.concat(targetImagePlane.columnCosines).join()
      const ippString = new Float32Array([ippTopLeftVec3[0], ippTopLeftVec3[1], ippTopLeftVec3[2]]).join()
      const mprImageId = getMprUrl(iopString, ippString);

      loadAndCacheImage(mprImageId).then(image =>{
        displayImage(targetElement, image, getViewport(targetElement))
      });

      // Clear Toolstate
      // clearToolState(targetElement, this.name)

      // Update Tool State
      //const helloVector = new Vector3(...ippVec3);
      //const hello = projectPatientPointToImagePlane(helloVector, targetImagePlane);
      const crossPoint = _projectPatientPointToImagePlane(ippVec3, targetImagePlane)

      const toolData = getToolState(targetElement, this.name)
      if (!toolData || !toolData.data || !toolData.data.length) {
        addToolState(targetElement, this.name, {
          point: crossPoint,
        })
      } else {
        toolData.data[0].point = crossPoint
      }

      // Force redraw
      updateImage(targetElement)
  })
}

// TODO: We need something easier for store/retrieve/delete/clear than this
// TODO: Not sure if there is a pattern we can repurpose or if this is a new thing
async function _findIppTopLeftForVolume(imagePlane, ippCenter){

  const rowCosines = imagePlane.rowCosines; 
  const colCosines = imagePlane.columnCosines;

  // TODO: For "SeriesInstanceNumber" instead of series number?
  // TODO: Or should we create a GUID per volume?
  const vtkVolume = await tryGetVtkVolumeForSeriesNumber(0);
  const vtkImageData = vtkVolume.vtkImageData;
  const spacing = vtkImageData.getSpacing();
  const extent = vtkImageData.getExtent();

  const topLeftIpp = _computeIppTopLeftForCenter(rowCosines, colCosines, ippCenter, spacing, extent);

  return topLeftIpp;
}

function _computeIppTopLeftForCenter(rowCosines, colCosines, ippCenter, spacing, extent) {
  const distance = vec3.fromValues(
    spacing[0] * extent[1],
    spacing[1] * extent[3],
    spacing[2] * extent[5]
  );

  let colTranslate = vec3.create();
  vec3.multiply(colTranslate, colCosines, distance);
  vec3.scale(colTranslate, colTranslate, -0.5);

  let rowTranslate = vec3.create();
  vec3.multiply(rowTranslate, rowCosines, distance);
  vec3.scale(rowTranslate, rowTranslate, -0.5);

  const topLeftIpp = vec3.create();
  vec3.add(topLeftIpp, ippCenter, colTranslate);
  vec3.add(topLeftIpp, topLeftIpp, rowTranslate);

  return topLeftIpp;
}

function _projectPatientPointToImagePlane(patientPoint, imagePlane) {
  const rowCosines = imagePlane.rowCosines;
  const columnCosines = imagePlane.columnCosines;
  const imagePositionPatient = imagePlane.imagePositionPatient;

  const rowCosinesVec3 = vec3.fromValues(...rowCosines);
  const colCosinesVec3 = vec3.fromValues(...columnCosines);
  const ippVec3 = vec3.fromValues(...imagePositionPatient);

  const point = vec3.create();
  vec3.sub(point, patientPoint, ippVec3);

  const x = vec3.dot(rowCosinesVec3, point) / imagePlane.columnPixelSpacing;
  const y = vec3.dot(colCosinesVec3, point) / imagePlane.rowPixelSpacing;
  
  return { x, y };
}
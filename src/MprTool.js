import { vec3 } from 'gl-matrix';
import cornerstone, {
    EVENTS,
    getEnabledElement,
    metaData,
    pixelToCanvas,
    loadImage,
    loadAndCacheImage,
    getViewport,
    displayImage,
    updateImage,
  } from 'cornerstone-core'
  import {
    addToolState,
    clearToolState,
    getToolState,
    import as csTools,
    loadHandlerManager,
    setToolDisabled,
    store,
    toolColors,
  } from 'cornerstone-tools'
  import {
    waitForElementToBeEnabled,
    waitForEnabledElementImageToLoad,
  } from './lib/wait.js'

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
      this.clearPointsIfNotSynced = _clearPointsIfNotSynced.bind(this)
      this.syncedId = null
    }

    activeCallback(element, options) {
      this.element.removeEventListener(
        EVENTS.NEW_IMAGE,
        this.clearPointsIfNotSynced
      )
      this.element.addEventListener(EVENTS.NEW_IMAGE, this.clearPointsIfNotSynced)
    }

    passiveCallback(element, options) {
      setToolDisabled(this.name, options)
    }

    enabledCallback(element, options) {
      setToolDisabled(this.name, options)
    }

    disabledCallback(element, options) {
      this.element.removeEventListener(
        EVENTS.NEW_IMAGE,
        this.clearPointsIfNotSynced
      )
      store.state.enabledElements.forEach(async enabledElement => {
        clearToolState(enabledElement, this.name)
        const isEnabled = await waitForElementToBeEnabled(enabledElement)
        const hasLoadedImage = await waitForEnabledElementImageToLoad(
          enabledElement
        )
        if (isEnabled && hasLoadedImage) {
          updateImage(enabledElement)
        }
      })
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
      const toolData = getToolState(evt.currentTarget, this.name)
      if (!toolData || !toolData.data || !toolData.data.length) return
      const context = getNewContext(eventData.canvasContext.canvas)
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
    async postMouseDownCallback(evt) {
      await this.updatePoint(evt)
      evt.preventDefault()
      evt.stopPropagation()

      const consumeEvent = true
      return consumeEvent
    }

    async mouseDragCallback(evt) {
      await this.updatePoint(evt)
      evt.preventDefault()
      evt.stopPropagation()
    }

    mouseMoveCallback(evt) {
      return false
    }

    async postTouchStartCallback(evt) {
      await this.updatePoint(evt)
      evt.preventDefault()
      evt.stopPropagation()

      const consumeEvent = true
      return consumeEvent
    }

    async touchDragCallback(evt) {
      await this.updatePoint(evt)
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

      const targetImagePlane = metaData.get('imagePlaneModule', targetImage.imageId);
      const iopString = targetImagePlane.rowCosines.concat(targetImagePlane.columnCosines).join()
      const ippString = new Float32Array([ippTopLeftVec3[0], ippTopLeftVec3[1], ippTopLeftVec3[2]]).join()
      const mprImageId = getMprUrl(iopString, ippString);

      loadAndCacheImage(mprImageId).then(image =>{
        displayImage(targetElement, image, getViewport(targetElement))
      });

      // Clear
      // clearToolState(targetElement, this.name)

      // Update
      // rowCosines and columnCosines should be the same
      // We need _ideal_ imagePositionPatient values (x, y, z)
      // Assuming those values are within our bounds

    //   const bestImageIdIndex = _findBestImageIdIndex(
    //     targetElementCurrentImage,
    //     sourcePatientPoint,
    //     sourceImagePlane.frameOfReferenceUID
    //   )

      // if (bestImageIdIndex !== null) {
        try {
          // const imageId = seriesStack.imageIds[bestImageIdIndex]
        //   const targetTool = store.state.tools.find(
        //     tool => tool.element === targetElement && tool.name === this.name
        //   )

        //   if (targetTool) {
        //     targetTool.syncedId = imageId
        //   }

          // TODO: LOAD IMAGE

        //   seriesStack.currentImageIdIndex = bestImageIdIndex
        //   displayImage(targetElement, image, getViewport(targetElement))

        //   const endLoadingHandler = loadHandlerManager.getEndLoadHandler()
        //   if (endLoadingHandler) endLoadingHandler(targetElement, image)

        //   // New ToolState w/ bestImageId
        //   const targetMeta = metaData.get('imagePlaneModule', imageId)
        //   if (
        //     !targetMeta ||
        //     !targetMeta.rowCosines ||
        //     !targetMeta.columnCosines ||
        //     !targetMeta.imagePositionPatient
        //   )
        //     return

        //   const crossPoint = projectPatientPointToImagePlane(
        //     sourcePatientPoint,
        //     targetMeta
        //   )
        //   const toolData = getToolState(targetElement, this.name)
        //   if (!toolData || !toolData.data || !toolData.data.length) {
        //     addToolState(targetElement, this.name, {
        //       point: crossPoint,
        //     })
        //   } else {
        //     toolData.data[0].point = crossPoint
        //   }
        } catch (err) {
            console.warn(err);
        //   const errorLoadingHandler = loadHandlerManager.getErrorLoadingHandler()
        //   const imageId = seriesStack.imageIds[bestImageIdIndex]
        //   if (errorLoadingHandler)
        //     errorLoadingHandler(targetElement, imageId, err)
        }
      // }

      // Force redraw
      // updateImage(targetElement)
  })
}

const _clearPointsIfNotSynced = function() {
  const imageId = getEnabledElement(this.element).image.imageId

  if (!imageId) return // No image
  if (!this.syncedId) return // No syncedId
  if (imageId === this.syncedId) return // SyncedId matches :+1:

  store.state.enabledElements.forEach(enabledElement =>
    clearToolState(enabledElement, this.name)
  )
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
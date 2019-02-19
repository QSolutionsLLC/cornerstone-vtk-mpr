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
  import { Vector3 } from 'cornerstone-math'
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
  const _updatePoint = function(evt) {
    const eventData = evt.detail
    evt.stopImmediatePropagation()
    const sourceElement = evt.currentTarget
    const sourceEnabledElement = getEnabledElement(sourceElement)
    const sourceImageId = sourceEnabledElement.image.imageId
    const sourceImagePlane = metaData.get('imagePlaneModule', sourceImageId)
    console.log(`UPDATE: ${sourceImageId}`, sourceImagePlane)
    if (
      !sourceImagePlane ||
      !sourceImagePlane.rowCosines ||
      !sourceImagePlane.columnCosines ||
      !sourceImagePlane.imagePositionPatient ||
      !sourceImagePlane.frameOfReferenceUID
    )
      return
  

    const sourceImagePoint = eventData.currentPoints.image
    // Uses rowCosines, columnCosines, imagePositionPatient, and row/columnPixelSpacing
    const sourcePatientPoint = imagePointToPatientPoint(
      sourceImagePoint,
      sourceImagePlane
    )
  
    store.state.enabledElements.forEach(async targetElement => {
      const targetElementCurrentImage = cornerstone.getImage(targetElement)

      // Clear
      clearToolState(targetElement, this.name)
  
      // Update
      // rowCosines and columnCosines should be the same
      // We need _ideal_ imagePositionPatient values (x, y, z)
      // Assuming those values are within our bounds 
      const bestImageIdIndex = _findBestImageIdIndex(
        targetElementCurrentImage,
        sourcePatientPoint,
        sourceImagePlane.frameOfReferenceUID
      )

      if (bestImageIdIndex !== null) {
        try {
          const imageId = seriesStack.imageIds[bestImageIdIndex]
          const targetTool = store.state.tools.find(
            tool => tool.element === targetElement && tool.name === this.name
          )
  
          if (targetTool) {
            targetTool.syncedId = imageId
          }

          // TODO: LOAD IMAGE

          seriesStack.currentImageIdIndex = bestImageIdIndex
          displayImage(targetElement, image, getViewport(targetElement))
  
          const endLoadingHandler = loadHandlerManager.getEndLoadHandler()
          if (endLoadingHandler) endLoadingHandler(targetElement, image)
  
          // New ToolState w/ bestImageId
          const targetMeta = metaData.get('imagePlaneModule', imageId)
          if (
            !targetMeta ||
            !targetMeta.rowCosines ||
            !targetMeta.columnCosines ||
            !targetMeta.imagePositionPatient
          )
            return
  
          const crossPoint = projectPatientPointToImagePlane(
            sourcePatientPoint,
            targetMeta
          )
          const toolData = getToolState(targetElement, this.name)
          if (!toolData || !toolData.data || !toolData.data.length) {
            addToolState(targetElement, this.name, {
              point: crossPoint,
            })
          } else {
            toolData.data[0].point = crossPoint
          }
        } catch (err) {
          const errorLoadingHandler = loadHandlerManager.getErrorLoadingHandler()
          const imageId = seriesStack.imageIds[bestImageIdIndex]
          if (errorLoadingHandler)
            errorLoadingHandler(targetElement, imageId, err)
        }
      }
  
      // Force redraw
      updateImage(targetElement)
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
  
  const _loadImage = function(seriesStack, bestImageIdIndex, targetElement) {
    const startLoadingHandler = loadHandlerManager.getStartLoadHandler()
    if (startLoadingHandler) startLoadingHandler(targetElement)
  
    let loader
    if (seriesStack.preventCache) {
      loader = loadImage(seriesStack.imageIds[bestImageIdIndex])
    } else {
      loader = loadAndCacheImage(seriesStack.imageIds[bestImageIdIndex])
    }
    return loader
  }
  
  // If this is an oblique...
  // How do we best walk the index?
  const _findBestImageIdIndex = function(
    targetImage,
    sourcePatientPoint,
    sourceFrameOfReference
  ) {

      if(!targetImage){
          console.warn('no target image')
          return;
      }
      if(!targetImage.imageId.includes('mpr')){
          console.warn('skipping; wrong image scheme');
          return;
      }
      // if (targetMeta.frameOfReferenceUID !== sourceFrameOfReference) continue

      const imageId = targetImage.imageId;
      const targetMeta = metaData.get('imagePlaneModule', imageId)
      if(!targetMeta){
          console.warn('no imagePlaneModule');
          return;
      }

      const imagePosition = vec3.fromValues(...targetMeta.imagePositionPatient)
      const row = vec3.fromValues(...targetMeta.rowCosines)
      const column = vec3.fromValues(...targetMeta.columnCosines)

      // A vector that is perpendicular to both `column` and `row` and thus 'normal'
      let normal = vec3.create();
      vec3.cross(normal, column, row)
      
      // Distance from image's plane to normal's origin
      const targetPlanePosition = vec3.dot(vec3.clone(normal), imagePosition)

      
      // Distance from a same-oriented plane containing the source point to normal's origin
      const localSourcePatientPoint = vec3.fromValues(sourcePatientPoint.x, sourcePatientPoint.y, sourcePatientPoint.z)
      const sourcePointPlanePosition = vec3.dot(vec3.clone(normal), localSourcePatientPoint)
      
      // Distance between derived target and source planes
      const distance = Math.abs(targetPlanePosition - sourcePointPlanePosition)
      console.log(`${targetPlanePosition} - ${sourcePointPlanePosition} = ${distance}`)

  
    return distance
  }
  

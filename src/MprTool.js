import { vec3, mat4 } from 'gl-matrix';
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
    clearToolState,
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
  const draw = csTools('drawing/draw')
  const drawHandles = csTools('drawing/drawHandles')
  const getNewContext = csTools('drawing/getNewContext')
  const setShadow = csTools('drawing/setShadow')

  // Manipulators
  const moveHandle = csTools('manipulators/moveHandle')

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

      this.crossPoint = { x: 0, y: 0 };
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

    createNewMeasurement(eventData) {
      return {
        visible: true,
        active: true,
        color: undefined,
        //
        handles: {
          end: {
            x: 50,
            y: 50,
            highlight: true,
            active: true,
          },
        },
      };
    }

    // BaseAnnotationTool, despite no persistent
    pointNearTool() {
      return false
    }

    // TODO: This should be a delta, and part of a drag callback
    // TODO: We can move this outside the normal event loop?
    // TODO: We want this to be owned by the tool + elemment; no one else cares about this data
    handleSelectedCallback(evt, toolData, handle, interactionType = 'mouse'){
      const options = Object.assign({}, this.options, {
        doneMovingCallback: () => {
          
          // Find magic angle
          const eventData = evt.detail
          const element = eventData.element
          const image = cornerstone.getImage(element)
          const isMprImage = image.imageId.includes('mpr')

          if(!isMprImage){
            return;
          }

          const toolData = getToolState(element, this.name)
          // const myMagicAngle = this._findAngle(toolData);
          const myMagicAngle = 0.0174533 * 10;

          // Apply angle
          // TODO: We care about delta, not new angle
          // TODO: Unless each slice saves a copy of "original" axes
          store.state.enabledElements.forEach(refElement => {
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

            const refImagePlane = metaData.get('imagePlaneModule', refImage.imageId);
            const rowCosines = vec3.fromValues(...refImagePlane.rowCosines);
            const colCosines = vec3.fromValues(...refImagePlane.columnCosines);
            const ippArray = vec3.fromValues(...refImagePlane.imagePositionPatient);
    
            let axes = _calculateRotationAxes(rowCosines, colCosines, ippArray);
            axes = mat4.rotateY(axes, axes, myMagicAngle);

            console.log('ROTATED MATRIX', axes)
    
            const iopString = [axes[0], axes[1], axes[2], axes[4], axes[5], axes[6]].join()
            const ippString = new Float32Array([axes[12], axes[13], axes[14]]).join()
            const mprImageId = getMprUrl(iopString, ippString);
    
            // LOADS IMAGE
            loadAndCacheImage(mprImageId).then(image =>{
              displayImage(refElement, image, getViewport(refElement))
            });
          })

        }
      })
    
      moveHandle(
        evt.detail,
        this.name,
        toolData,
        handle,
        // - deleteIfHandleOutsideImage
        // - preventHandleOutsideImage
        // - doneMovingCallback
        options, // dragHandler needs movingHandler
        interactionType
      );
    
      evt.stopImmediatePropagation();
      evt.stopPropagation();
      evt.preventDefault();
    
      return;
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
      const image = cornerstone.getImage(element)
      const isMprImage = image.imageId.includes('mpr')

      if(!isMprImage){
        return;
      }

      let toolData = getToolState(element, this.name)
      const context = getNewContext(eventData.canvasContext.canvas);

      draw(context, context => {

        // Create toolData if it does not exist
        if(!toolData){

          console.warn('creating tool data in render')
          const measurementData = this.createNewMeasurement(eventData);

          addToolState(element, this.name, measurementData);
          toolData = getToolState(element, this.name);
        }

        // Configurable shadow
        setShadow(context, this.configuration);

        // Configure the handles
        const handleOptions = {
          color: 'dodgerblue',
          handleRadius: 15,
          drawHandlesIfActive: false,
        };
        
        
        for (let i = 0; i < toolData.data.length; i++) {
          const data = toolData.data[i];
          drawHandles(context, eventData, data.handles, handleOptions);
        }
      })


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

        // CURRENT
        const imagePlane = metaData.get('imagePlaneModule', image.imageId);
        const imagePlanePrime = {
          referenceLineColor: imagePlane.referenceLineColor,
          // TODO: DIRTY
          //imagePositionPatient: imagePlane.imagePositionPatient,
          imagePositionPatient: imagePlane.ippPlaned,
          rowCosines: imagePlane.rowCosines,
          columnCosines: imagePlane.columnCosines,
          rowPixelSpacing: imagePlane.rowPixelSpacing,
          columnPixelSpacing: imagePlane.columnPixelSpacing,
          frameOfReferenceUID: imagePlane.frameOfReferenceUID,
          columns: imagePlane.columns,
          rows: imagePlane.rows
        };

        // REFERENCE
        const refImagePlane = metaData.get('imagePlaneModule', refImage.imageId);
        const refImagePlanePrime = {
          referenceLineColor: refImagePlane.referenceLineColor,
          // TODO: DIRTY
          // imagePositionPatient: refImagePlane.imagePositionPatient,
          imagePositionPatient: refImagePlane.ippPlaned,
          rowCosines: refImagePlane.rowCosines,
          columnCosines: refImagePlane.columnCosines,
          rowPixelSpacing: refImagePlane.rowPixelSpacing,
          columnPixelSpacing: refImagePlane.columnPixelSpacing,
          frameOfReferenceUID: refImagePlane.frameOfReferenceUID,
          columns: refImagePlane.columns,
          rows: refImagePlane.rows
        };

        renderReferenceLine(context, element, imagePlanePrime, refImagePlanePrime)
        // renderReferenceLine(context, element, imagePlane, refImagePlane)
      });
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


    _findAngle(toolData){
      const crossPoint = this.crossPoint;
      const endPoint = toolData.data[0].handles.end;
  
      const dx = (endPoint.x - crossPoint.x) * 1 // colSpacing
      const dy = (endPoint.y - crossPoint.y) * 1 // rowSpacing
      const adjacent = Math.sqrt(dy * dy);
      const opposite = Math.sqrt(dx * dx);
      const angleInRadians =  Math.atan(opposite/adjacent)
      const angleInDegrees = angleInRadians * (180 / Math.PI)

      console.log(`${adjacent} = ${endPoint.x} - ${crossPoint.x}`)
      console.log(`${opposite} = ${endPoint.y} - ${crossPoint.y}`)
      console.log('FOUND ANGLE: ', angleInDegrees)

      return angleInRadians;
    }
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

    // CROSSHAIR ONLY
    const planePrime = {
      // ippCenter: [ippCenter[0], ippCenter[1], ippCenter[2]],
      // ippTopLeft: [axes[12], axes[13], axes[14]], 
      referenceLineColor: imagePlane.referenceLineColor,
      //
      //imagePositionPatient: imagePlane.imagePositionPatient,
      imagePositionPatient: imagePlane.ippPlaned,
      rowCosines: imagePlane.rowCosines,
      columnCosines: imagePlane.columnCosines,
      rowPixelSpacing: imagePlane.rowPixelSpacing,
      columnPixelSpacing: imagePlane.columnPixelSpacing,
      frameOfReferenceUID: imagePlane.frameOfReferenceUID,
      columns: imagePlane.columns,
      rows: imagePlane.rows
    };
    const ippCross = imagePointToPatientPoint(imagePointXY, planePrime)
    const ippCrossVec3 = vec3.fromValues(ippCross.x, ippCross.y, ippCross.z)

    const ippTopLeftVec3 = await _findIppTopLeftForVolume(imagePlane, ippVec3)

    store.state.enabledElements.forEach(targetElement => {
      let targetImage;
      
      try{ 
        targetImage = cornerstone.getImage(targetElement);
      }catch(ex){
        console.warn('target image is not enabled??')
        console.warn(ex)
        return;
      }

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

      // LOADS IMAGE
      loadAndCacheImage(mprImageId).then(image =>{
        displayImage(targetElement, image, getViewport(targetElement))
      });

      const imagePlanePrime = {
        referenceLineColor: targetImagePlane.referenceLineColor,
        // TODO: 
        //imagePositionPatient: imagePlane.imagePositionPatient,
        imagePositionPatient: targetImagePlane.ippPlaned,
        rowCosines: targetImagePlane.rowCosines,
        columnCosines: targetImagePlane.columnCosines,
        rowPixelSpacing: targetImagePlane.rowPixelSpacing,
        columnPixelSpacing: targetImagePlane.columnPixelSpacing,
        frameOfReferenceUID: targetImagePlane.frameOfReferenceUID,
        columns: targetImagePlane.columns,
        rows: targetImagePlane.rows
      };


      // SET CROSS POINT
      let toolData = getToolState(targetElement, this.name)

      if(!toolData){
        console.warn('creating tooldata in updatCrossPoint')
        const measurementData = this.createNewMeasurement(eventData);
        addToolState(targetElement, this.name, measurementData);
        toolData = getToolState(targetElement, this.name);
      }

      const crossPoint = _projectPatientPointToImagePlane(ippCrossVec3, imagePlanePrime)
      this.crossPoint = crossPoint;
      
      // Force redraw
      updateImage(targetElement)
    })

    // Force redraw on self
    updateImage(element)
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

  // console.log('INPUT IPP:', ippCenter)
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


function _calculateRotationAxes(rowCosines, colCosines, ippArray){
  let wCrossProd = vec3.create()
  vec3.cross(wCrossProd, rowCosines, colCosines);

  const axes = mat4.fromValues(
      rowCosines[0], rowCosines[1], rowCosines[2], 0,
      colCosines[0], colCosines[1], colCosines[2], 0,
      wCrossProd[0], wCrossProd[1], wCrossProd[2], 0,
      ippArray[0], ippArray[1], ippArray[2], 1
  )

  return axes;
}
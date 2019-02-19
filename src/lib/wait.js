import { getEnabledElement } from 'cornerstone-core/dist/cornerstone.js'

/**
 * Waits a set amount of time, then resolves. Can be chained off of to delay
 * next call in promise chain.
 *
 * @exports @public @function
 * @param {number} ms - number in ms to wait
 * @returns {Promise}
 */
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * A promise that returns an EnabledElement who's image has loaded, or
 * null if the provided element ceases being an enabledElement before an
 * image has been loaded.
 *
 * @param {HTMLElement} element - An element that is an EnabledElement
 * @returns {EnabledElement}
 */
export function waitForEnabledElementImageToLoad(element) {
  try {
    const enabledElement = getEnabledElement(element)

    if (!enabledElement.image) {
      return wait(250).then(() => waitForEnabledElementImageToLoad(element))
    }

    // EnabledElement's image is loaded.
    return enabledElement
  } catch (ex) {
    // Is no longer, or never was an enabled element, stop polling
    return null
  }
}

/**
 * A promise that returns an EnabledElement once the provided Element has
 * been enabled.
 *
 * @param {HTMLElement} element - An element that is an EnabledElement
 * @returns {EnabledElement}
 */
export function waitForElementToBeEnabled(element, i = 0) {
  const z = i + 1
  const waitThreshold = 15
  try {
    const enabledElement = getEnabledElement(element)

    // Element is enabled
    return enabledElement
  } catch (ex) {
    if (ex.message === 'element not enabled' && z < waitThreshold) {
      return wait(250).then(() => waitForElementToBeEnabled(element, z))
    }
    throw ex
  }
}

export default wait

import realsApproximatelyEqual from './realsApproximatelyEqual.js';

export default function (a, b, cmp) {
  let eq = realsApproximatelyEqual(a, b)
  if (eq === true) return 0

  if (a < b) {
    return -1
  }
  return 1
}

export default function (a, b) {
  let ax = a.x || a[0]
  let ay = a.y || a[1]
  let az = a.z || a[2]

  let bx = b.x || b[0]
  let by = b.y || b[1]
  let bz = b.z || b[2]

  const x = ay * bz - az * by
  const y = az * bx - ax * bz
  const z = ax * by - ay * bx

  return { x, y, z }
}

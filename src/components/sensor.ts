function requestPermission(permission: string): Promise<void> {
  return new Promise((resolve, reject) =>
    navigator.permissions
      .query({ name: permission as PermissionName })
      .then((result) => {
        if (result.state === 'denied') {
          reject(new Error('Permission to use accelerometer sensor is denied'))
        }
        resolve()
      })
      .catch(reject),
  )
}

export function startAccelerometer(
  reading: (sensor: LinearAccelerationSensor) => void,
): Promise<() => void> {
  if (typeof LinearAccelerationSensor !== 'function') {
    return Promise.reject(new Error('Linear acceleration sensor not supported'))
  }

  return new Promise((resolve, reject) => {
    let accelerometer: LinearAccelerationSensor | null = null
    try {
      accelerometer = new LinearAccelerationSensor({
        referenceFrame: 'device',
        frequency: 60,
      })
      accelerometer.addEventListener('error', (event) => {
        // Handle runtime errors.
        if (event.error.name === 'NotAllowedError') {
          requestPermission('accelerometer')
            .then(() => startAccelerometer(reading))
            .then(resolve)
            .catch(reject)
        } else if (event.error.name === 'NotReadableError') {
          reject(new Error('Cannot connect to the sensor.'))
        }
      })
      accelerometer.addEventListener('reading', () => reading(accelerometer!))
      accelerometer.start()
      resolve(() => {
        accelerometer?.stop()
      })
    } catch (error) {
      // Handle construction errors.
      if (error instanceof Error) {
        if (error.name === 'SecurityError') {
          // See the note above about permissions policy.
          requestPermission('accelerometer')
            .then(() => startAccelerometer(reading))
            .then(resolve)
            .catch(reject)
          return
        } else if (error.name === 'ReferenceError') {
          reject(new Error('Sensor is not supported by the User Agent.'))
          return
        }
      }
      reject(
        new Error(
          'Unknown error occurred while initializing the accelerometer sensor',
        ),
      )
    }
  })
}

export function startGyroscope(
  reading: (sensor: Gyroscope) => void,
): Promise<() => void> {
  if (typeof Gyroscope !== 'function') {
    return Promise.reject(new Error('Gyroscope sensor not supported'))
  }

  return new Promise((resolve, reject) => {
    let gyroscope: Gyroscope | null = null
    try {
      gyroscope = new Gyroscope({
        referenceFrame: 'device',
        frequency: 60,
      })
      gyroscope.addEventListener('error', (event) => {
        // Handle runtime errors.
        if (event.error.name === 'NotAllowedError') {
          requestPermission('gyroscope')
            .then(() => startGyroscope(reading))
            .then(resolve)
            .catch(reject)
        } else if (event.error.name === 'NotReadableError') {
          reject(new Error('Cannot connect to the sensor.'))
        }
      })
      gyroscope.addEventListener('reading', () => reading(gyroscope!))
      gyroscope.start()
      resolve(() => {
        gyroscope?.stop()
      })
    } catch (error) {
      // Handle construction errors.
      if (error instanceof Error) {
        if (error.name === 'SecurityError') {
          // See the note above about permissions policy.
          requestPermission('gyroscope')
            .then(() => startGyroscope(reading))
            .then(resolve)
            .catch(reject)
          return
        } else if (error.name === 'ReferenceError') {
          reject(new Error('Sensor is not supported by the User Agent.'))
          return
        }
      }
      reject(
        new Error(
          'Unknown error occurred while initializing the gyroscope sensor',
        ),
      )
    }
  })
}

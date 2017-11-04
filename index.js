import netatmo from 'netatmo'
import config from './secrets'

const api = new netatmo(config.auth)

const getStationsData = (err, devices) => {
    const now = Date.now() / 1000

    devices.forEach((device) => {
        device.modules.forEach((component) => {
            const data = {
                "module": component.module_name,
                "battery": component.battery_percent,
                "rf": component.rf_status,
                "timestamp": component.last_seen,
                "tags": ["netatmo", "weather"]
            }

            if (now - data.timestamp < (10*60)) {
                console.log(JSON.stringify(data))
            }
        })
    })

    process.exit()
}

api.on('get-stationsdata', getStationsData)

api.getStationsData()


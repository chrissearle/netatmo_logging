import netatmo from 'netatmo'
import {CronJob} from 'cron'
import {Logger, transports} from 'winston'
import 'winston-logstash'
import config from './secrets'

const logger = new Logger({
    transports: [
        new (transports.Logstash)({
            port: config.logstash.port,
            host: config.logstash.host,
            max_connect_retries: -1,
            node_name: 'netatmo',
        })
    ]
})

const api = new netatmo(config.auth)

const getStationsData = (err, devices) => {
    const now = Date.now() / 1000

    devices.forEach((device) => {
        const deviceData = {
            "station": device.station_name,
            "wifi_status": device.wifi_status,
            "noise": device.dashboard_data.Noise,
            "temperature": device.dashboard_data.Temperature,
            "humidity": device.dashboard_data.Humidity,
            "pressure": device.dashboard_data.Pressure,
            "CO2_level": device.dashboard_data.CO2,
            "tags": [ 'netatmo', 'weather' ]
        }

        logger.info(`Netatmo station ${deviceData.station} status`, deviceData)

        device.modules.forEach((component) => {
            const data = {
                "module": component.module_name,
                "battery": component.battery_percent,
                "rf": component.rf_status,
                "last_seen": component.last_seen,
                "tags": ["netatmo", "weather"]
            }

            if (now - data.last_seen < (10*60)) {
                switch (component.type) {
                    case 'NAModule1':
                        data.temperature = component.dashboard_data.Temperature
                        data.humidity = component.dashboard_data.Humidity
                        break
                    case 'NAModule2':
                        data.wind_angle = component.dashboard_data.WindAngle
                        data.wind_strength = component.dashboard_data.WindStrength
                        data.gust_angle = component.dashboard_data.GustAngle
                        data.gust_strength= component.dashboard_data.GustStrength
                        break
                    case 'NAModule3':
                        data.rain = component.dashboard_data.Rain
                        break
                }

                logger.info(`Netatmo module ${data.module} status`, data)
            }
        })
    })
}

api.on('get-stationsdata', getStationsData)

api.on("error", logger.error)

api.on("warning", logger.warn)

const job = new CronJob('00 */10 * * * *', () => {
    api.getStationsData()
}, null, null, 'Europe/Oslo')

logger.info("Starting netatmo logger")

api.getStationsData()

job.start()



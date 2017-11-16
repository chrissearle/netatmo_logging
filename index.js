import netatmo from 'netatmo'
import {CronJob} from 'cron'
import {Logger, transports} from 'winston'
import 'winston-logstash'
import minimist from 'minimist'
import moment from 'moment'

import config from './secrets'

const argv = minimist(process.argv.slice(2))

const singleRun = argv['s']

const transportList = []

if (config.loggers.console) {
    transportList.push(new (transports.Console)({
        timestamp: true
    }))
}

if (config.loggers.file) {
    transportList.push(new (transports.File)({
        filename: config.file.filepath
    }))
}

if (config.loggers.logstash) {
    transportList.push(new (transports.Logstash)({
        port: config.logstash.port,
        host: config.logstash.host,
        max_connect_retries: -1,
        node_name: 'netatmo',
    }))
}

const logger = new Logger({
    transports: transportList
})

const api = new netatmo(config.auth)

const validDuration = moment.duration({'minutes' : 10})

const lastSeenValid = (now, lastSeen) => {
    return moment(now).subtract(validDuration).isBefore(moment(lastSeen * 1000))
}

const lastSeenSince = (now, lastSeen) => {
    return Math.round(moment.duration(moment(now).diff(moment(lastSeen * 1000))).asSeconds())
}

const getStationsData = (err, devices) => {
    const now = Date.now()

    devices.forEach((device) => {
        const deviceData = {
            'station': device.station_name,
            'title': device.station_name,
            'wifi_status': device.wifi_status,
            'noise': device.dashboard_data.Noise,
            'temperature': device.dashboard_data.Temperature,
            'humidity': device.dashboard_data.Humidity,
            'pressure': device.dashboard_data.Pressure,
            'CO2_level': device.dashboard_data.CO2,
            'tags': ['netatmo', 'weather']
        }

        logger.info(`Netatmo station ${deviceData.station} status`, deviceData)

        device.modules.forEach((component) => {
            const data = {
                'module': component.module_name,
                'title': component.module_name,
                'battery': component.battery_percent,
                'rf': component.rf_status,
                'last_seen': component.last_seen,
                'last_seen_since': lastSeenSince(now, component.last_seen),
                'tags': ['netatmo', 'weather']
            }

            if (lastSeenValid(now, component.last_seen)) {
                switch (component.type) {
                    case 'NAModule1':
                        data.temperature = component.dashboard_data.Temperature
                        data.humidity = component.dashboard_data.Humidity
                        break
                    case 'NAModule2':
                        data.wind_angle = component.dashboard_data.WindAngle
                        data.wind_strength = component.dashboard_data.WindStrength
                        data.gust_angle = component.dashboard_data.GustAngle
                        data.gust_strength = component.dashboard_data.GustStrength
                        break
                    case 'NAModule3':
                        data.rain = component.dashboard_data.Rain
                        break
                }
            }

            logger.info(`Netatmo module ${data.module} status`, data)
        })
    })
}

api.on('get-stationsdata', getStationsData)

api.on('error', logger.error)

api.on('warning', logger.warn)

logger.info('Starting netatmo logger')

api.getStationsData()

if (!singleRun) {
    const job = new CronJob('00 */10 * * * *', () => {
        api.getStationsData()
    }, null, null, 'Europe/Oslo')

    job.start()
}



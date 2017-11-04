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
        device.modules.forEach((component) => {
            const data = {
                "module": component.module_name,
                "battery": component.battery_percent,
                "rf": component.rf_status,
                "last_seen": component.last_seen,
                "tags": ["netatmo", "weather"]
            }

            if (now - data.last_seen < (10*60)) {
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



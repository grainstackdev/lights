// @flow

import dotenvDefaults from "dotenv-defaults"
import axios from "axios";
import readline from 'readline-sync'
// $FlowFixMe
import chalk from 'chalk'
import env from 'parsenv'

dotenvDefaults.config()

type Light = {
  state: LightState,
  name: string,
}

type LightState = {
  on: boolean,
  bri: number, // [0, 254]
  hue: number, // [0, 65535]
  sat: number, // [0, 254]
  effect: string,
  xy: Array<any>,
  ct: number,
  alert: string,
  colormode: string,
  mode: string,
  reachable: boolean
}

const {
  USERNAME
} = process.env

let username = USERNAME || ''

Promise.resolve().then(async () => {
  const res = await axios.get('https://discovery.meethue.com/')
  const bridgeIp = res.data?.[0]?.internalipaddress
  const bridgeUrl = `http://${bridgeIp}`

  const bridge = makeBridge(bridgeUrl)

  const userExists = await bridge.checkUser(username)
  if (!userExists) {
    console.log(chalk.bgRed.bold('\n  Error  '))
    console.log('The user specified by .env does not exist. Creating a new user user...')
    await bridge.createUser()
  }

  const lights = await bridge.listLights()
  const lightId = Object.keys(lights)[0]
  if (!lightId) {
    throw new Error('Unable to find any light')
  }

  await bridge.setLightState(lightId, {on: true})

  const nColors = 12
  const cycleTime = 15000
  const timeStep = 200
  const stepRatio = timeStep / cycleTime

  const hueFullStep = 65535 / nColors
  const hueTimeStep = hueFullStep * stepRatio
  const briFullStep = cycleTime / 2
  const briTimeStep = briFullStep * stepRatio


  let lerp = 0
  let hue = 0
  setInterval(async () => {
    lerp += briTimeStep * (2 * Math.PI) / briFullStep / 2
    const bri3 = Math.round(Math.cos(lerp) * Math.cos(lerp) * 254)
    const bri4 = Math.round(Math.sin(lerp) * Math.sin(lerp) * 254)
    await bridge.setLightState('3', {bri: bri3})
    await bridge.setLightState('4', {bri: bri4})

    await bridge.setLightState('3', {hue})
    await bridge.setLightState('4', {hue})
    // await bridge.setLightState('4', {hue: (65535 - hue)})

    // await bridge.setLightState('3', {bri})
    // await bridge.setLightState('4', {bri: (254 - bri)})



    hue = Math.floor((hue + hueTimeStep) % 65535)
  }, timeStep)

})

function makeBridge(bridgeUrl) {
  const instance = axios.create({
    baseURL: bridgeUrl
  })

  async function checkUser(username) {
    const res = await instance.get(
      `/api/${username}`
    )
    const description = res.data?.[0]?.error?.description
    if (description === 'unauthorized user') {
      return false
    } else {
      return true
    }
  }

  async function createUser() {
    let res = await instance.post(
      '/api',
      {
        "devicetype":"my_hue_app"
      }
    )
    const description = res.data?.[0]?.error?.description
    if (description !== 'link button not pressed') {
      throw new Error('Expected to wait for button press.')
    }

    console.log(chalk.bgYellow.bold('\n  Pause  '))
    readline.keyInPause('Press the button on your bridge. Then unpause the program.');


    res = await axios.post(
      '/api',
      {
        "devicetype":"my_hue_app"
      },
      {
        baseURL: bridgeUrl
      }
    )
    username = res.data?.[0]?.success?.username
    if (!username) {
      throw new Error('Failed to create user.')
    } else {
      env.edit({USERNAME: username})
      env.write()
      console.log(chalk.bgGreen.bold('\n  Created  '))
      console.log('A new user was created and saved into .env.')
    }
  }

  async function listLights(): Promise<{[lightId: string]: Light}> {
    const res = await instance.get(`/api/${username}/lights`)
    return res.data || {}
  }

  async function setLightState(lightId: string, state: $Shape<LightState>) {
    const res = await instance.put(`/api/${username}/lights/${lightId}/state`, state)
    console.log('res.data', res.data)
  }

  return {
    checkUser,
    createUser,
    listLights,
    setLightState
  }
}


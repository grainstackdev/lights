
import dotenvDefaults from "dotenv-defaults"
import axios from "axios";
import readline from 'readline-sync'
import chalk from 'chalk'
import env from 'parsenv'

dotenvDefaults.config()

const {
  USERNAME
} = process.env

let username = USERNAME

Promise.resolve().then(async () => {
  const res = await axios.get('https://discovery.meethue.com/')
  const bridgeIp = res.data?.[0]?.internalipaddress
  const bridgeUrl = `http://${bridgeIp}`

  const helper = make(bridgeUrl)

  const userExists = await helper.checkUser(username)
  if (!userExists) {
    console.log(chalk.bgRed.bold('\n  Error  '))
    console.log('The user specified by .env does not exist. Creating a new user user...')
    await helper.createUser()
  }


})

function make(bridgeUrl) {
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
    // console.log('username', username)
  }

  return {
    checkUser,
    createUser
  }
}


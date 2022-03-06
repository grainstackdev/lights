import axios from "axios";

Promise.resolve().then(async () => {
  const res = await axios.get('https://discovery.meethue.com/')
  const bridgeIp = res.data?.internalipaddress
  const bridgePort = res.data?.port



})

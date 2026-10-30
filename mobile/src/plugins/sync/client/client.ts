import { encryptMsg, decryptMsg } from './utils'
import { callObj } from './sync'
// import { action as commonAction } from '@/store/modules/common'
// import { getStore } from '@/store'
// import registerSyncListHandler from './syncList'
import log from '../log'
import { aesEncrypt } from '../utils'
import { setSyncStatus } from '@/core/sync'
import { dateFormat } from '@/utils/common'
import { createMsg2call } from 'message2call'
import { toast } from '@/utils/tools'
import { SYNC_CLOSE_CODE, SYNC_CODE } from '../constants'
import { AppState } from 'react-native'

let status: LX.Sync.Status = {
  status: false,
  message: '',
}

export const sendSyncStatus = (newStatus: Omit<LX.Sync.Status, 'address'>) => {
  status.status = newStatus.status
  status.message = newStatus.message
  setSyncStatus(status)
}

export const sendSyncMessage = (message: string) => {
  status.message = message
  setSyncStatus(status)
}

// The server pings every 30 s (desktop: modules/sync/server/server/server.ts). A connection the network dropped while
// the app was in the background gets no close event: no ping for that long, it is taken as gone and made again
const PING_TIMEOUT = 30000 + 10000

const heartbeatTools = {
  failedNum: 0,
  lastMessageAt: 0,
  // (reconnected by itself: no "Sync connected" message)
  isAutoReconnect: false,
  maxTryNum: 100000,
  stepMs: 3000,
  connectTimeout: null as NodeJS.Timeout | null,
  pingTimeout: null as NodeJS.Timeout | null,
  delayRetryTimeout: null as NodeJS.Timeout | null,
  handleOpen() {
    console.log('open')
    // this.failedNum = 0
    this.heartbeat()
  },
  heartbeat() {
    this.lastMessageAt = Date.now()
    if (this.pingTimeout) clearTimeout(this.pingTimeout)
    // (a close of a dead connection waits for the network: the connection is made again at once)
    this.pingTimeout = setTimeout(() => {
      this.pingTimeout = null
      this.forceReconnect('Connection lost, reconnecting...')
    }, PING_TIMEOUT)
  },
  /**
   * The connection is left as it is (it may never close by itself) and made again
   */
  forceReconnect(message: string) {
    if (!client) return
    log.info('force reconnect:', message)
    const socket = client
    socket.data.isStale = true
    socket.data.handleClosed?.()
    try {
      socket.close(SYNC_CLOSE_CODE.failed)
    } catch {}
    sendSyncStatus({
      status: false,
      message,
    })
    this.isAutoReconnect = true
    this.clearTimeout()
    connect(socket.data.urlInfo, socket.data.keyInfo)
  },
  reConnnect() {
    this.clearTimeout()
    // client = null
    if (!client) return

    if (++this.failedNum > this.maxTryNum) {
      this.failedNum = 0
      sendSyncStatus({
        status: false,
        message: 'Connect error',
      })
      throw new Error('connect error')
    }

    const waitTime = Math.min(2000 + Math.floor(this.failedNum / 2) * this.stepMs, 30000)

    // sendSyncStatus({
    //   status: false,
    //   message: `Waiting ${waitTime / 1000}s reconnnect...`,
    // })

    this.delayRetryTimeout = setTimeout(() => {
      this.delayRetryTimeout = null
      if (!client) return
      console.log(dateFormat(new Date()), 'reconnnect...')
      sendSyncStatus({
        status: false,
        message: `Try reconnnect... (${this.failedNum})`,
      })
      connect(client.data.urlInfo, client.data.keyInfo)
    }, waitTime)
  },
  clearTimeout() {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout)
      this.connectTimeout = null
    }
    if (this.delayRetryTimeout) {
      clearTimeout(this.delayRetryTimeout)
      this.delayRetryTimeout = null
    }
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout)
      this.pingTimeout = null
    }
  },
  connect(socket: LX.Sync.Socket) {
    console.log('heartbeatTools connect')
    this.connectTimeout = setTimeout(() => {
      this.connectTimeout = null
      if (socket.data.isStale) return
      if (client) {
        try {
          client.close(SYNC_CLOSE_CODE.failed)
        } catch {}
      }
      if (++this.failedNum > this.maxTryNum) {
        this.failedNum = 0
        sendSyncStatus({
          status: false,
          message: 'Connect error',
        })
        throw new Error('connect error')
      }
      sendSyncStatus({
        status: false,
        message: 'Connect timeout, try reconnect...',
      })
      this.reConnnect()
    }, 2 * 60 * 1000)
    socket.addEventListener('open', () => {
      if (socket.data.isStale) return
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout)
        this.connectTimeout = null
      }
      this.handleOpen()
    })
    socket.addEventListener('message', () => {
      // (any message shows the connection is alive)
      if (!socket.data.isStale) this.heartbeat()
    })
    socket.addEventListener('close', (event) => {
      // (a connection replaced already)
      if (socket.data.isStale) return
      switch (event.code) {
        case SYNC_CLOSE_CODE.normal:
        case SYNC_CLOSE_CODE.failed:
          return
      }
      this.reConnnect()
    })
  },
}


let client: LX.Sync.Socket | null
// let listSyncPromise: Promise<void>
export const connect = (urlInfo: LX.Sync.UrlInfo, keyInfo: LX.Sync.KeyInfo) => {
  client = new WebSocket(`${urlInfo.wsProtocol}//${urlInfo.hostPath}/socket?i=${encodeURIComponent(keyInfo.clientId)}&t=${encodeURIComponent(aesEncrypt(SYNC_CODE.msgConnect, keyInfo.key))}`) as LX.Sync.Socket
  client.data = {
    keyInfo,
    urlInfo,
  }
  heartbeatTools.connect(client)

  let closeEvents: Array<(err: Error) => (void | Promise<void>)> = []
  let disconnected = true

  const message2read = createMsg2call<LX.Sync.ServerSyncActions>({
    funcsObj: {
      ...callObj,
      finished() {
        if (!heartbeatTools.isAutoReconnect) toast('Sync connected')
        heartbeatTools.isAutoReconnect = false
        client!.isReady = true
        sendSyncStatus({
          status: true,
          message: '',
        })
        heartbeatTools.failedNum = 0
      },
    },
    timeout: 120 * 1000,
    sendMessage(data) {
      if (disconnected) throw new Error('disconnected')
      void encryptMsg(keyInfo, JSON.stringify(data)).then((data) => {
        client?.send(data)
      }).catch((err) => {
        log.error('encrypt msg error: ', err)
        client?.close(SYNC_CLOSE_CODE.failed)
      })
    },
    onCallBeforeParams(rawArgs) {
      return [client, ...rawArgs]
    },
    onError(error, path, groupName) {
      const name = groupName ?? ''
      log.r_error(`sync call ${name} ${path.join('.')} error:`, error)
      // if (groupName == null) return
      // client?.close(SYNC_CLOSE_CODE.failed)
      // sendSyncStatus({
      //   status: false,
      //   message: error.message,
      // })
    },
  })

  client.remote = message2read.remote
  client.remoteQueueList = message2read.createQueueRemote('list')
  client.remoteQueueDislike = message2read.createQueueRemote('dislike')
  client.remoteQueueStats = message2read.createQueueRemote('stats')
  client.remoteQueueCollections = message2read.createQueueRemote('collections')

  const socket = client
  client.addEventListener('message', ({ data }) => {
    if (data == 'ping' || socket.data.isStale) return
    if (typeof data === 'string') {
      void decryptMsg(keyInfo, data).then((data) => {
        let syncData: LX.Sync.ServerSyncActions
        try {
          syncData = JSON.parse(data)
        } catch (err) {
          log.error('parse msg error: ', err)
          client?.close(SYNC_CLOSE_CODE.failed)
          return
        }
        message2read.message(syncData)
      }).catch((error) => {
        log.error('decrypt msg error: ', error)
        client?.close(SYNC_CLOSE_CODE.failed)
      })
    }
  })
  client.onClose = function(handler: typeof closeEvents[number]) {
    closeEvents.push(handler)
    return () => {
      closeEvents.splice(closeEvents.indexOf(handler), 1)
    }
  }

  const initMessage = 'Wait syncing...'
  client.addEventListener('open', () => {
    if (socket.data.isStale) return
    log.info('connect')
    // const store = getStore()
    // global.lx.syncKeyInfo = keyInfo
    client!.isReady = false
    client!.moduleReadys = {
      list: false,
      dislike: false,
      stats: false,
      collections: false,
    }
    disconnected = false
    sendSyncStatus({
      status: false,
      message: initMessage,
    })
  })
  // the end of the connection: on its close event, or at once when it is replaced (forceReconnect)
  let isClosed = false
  const handleClosed = () => {
    if (isClosed) return false
    isClosed = true
    const err = new Error('closed')
    try {
      for (const handler of closeEvents) void handler(err)
    } catch (err: any) {
      log.error(err?.message)
    }
    closeEvents = []
    disconnected = true
    message2read.destroy()
    return true
  }
  client.data.handleClosed = handleClosed
  client.addEventListener('close', ({ code }) => {
    if (!handleClosed() || socket.data.isStale) return
    switch (code) {
      case SYNC_CLOSE_CODE.normal:
      // case SYNC_CLOSE_CODE.failed:
        sendSyncStatus({
          status: false,
          message: '',
        })
        break
      case SYNC_CLOSE_CODE.failed:
        if (!status.message || status.message == initMessage) {
          sendSyncStatus({
            status: false,
            message: 'failed',
          })
        }
        break
    }
  })
  client.addEventListener('error', ({ message }) => {
    if (socket.data.isStale) return
    sendSyncStatus({
      status: false,
      message,
    })
  })
}

export const disconnect = async() => {
  if (!client) return
  log.info('disconnecting...')
  client.close(SYNC_CLOSE_CODE.normal)
  client = null
  heartbeatTools.clearTimeout()
  heartbeatTools.failedNum = 0
}

export const getStatus = (): LX.Sync.Status => status

// back in the app after a while: a connection that got no ping meanwhile is made again at once (the timers of the
// app may not have run in the background)
AppState.addEventListener('change', state => {
  if (state != 'active' || !client || client.data.isStale === true || !heartbeatTools.lastMessageAt) return
  if (Date.now() - heartbeatTools.lastMessageAt > PING_TIMEOUT) heartbeatTools.forceReconnect('Connection lost, reconnecting...')
})

declare namespace LX {
  namespace Sync {

    interface EnableServer {
      enable: boolean
      port: string
    }
    interface EnableClient {
      enable: boolean
      host: string
      authCode?: string
    }

    interface SyncActionBase <A> {
      action: A
    }
    interface SyncActionData<A, D> extends SyncActionBase<A> {
      data: D
    }
    type SyncAction<A, D = undefined> = D extends undefined ? SyncActionBase<A> : SyncActionData<A, D>


    interface ModeTypes {
      list: LX.Sync.List.SyncMode
      dislike: LX.Sync.Dislike.SyncMode
    }

    type ModeType = { [K in keyof ModeTypes]: { type: K, mode: ModeTypes[K] } }[keyof ModeTypes]

    type SyncMainWindowActions = SyncAction<'select_mode', { deviceName: string, type: keyof ModeTypes }>
    | SyncAction<'close_select_mode'>
    | SyncAction<'client_status', ClientStatus>
    | SyncAction<'server_status', ServerStatus>
    // the listening stats of another device (JSON) to merge into the ones of the window
    | SyncAction<'stats_merge', string>

    type SyncServiceActions = SyncAction<'select_mode', ModeType>
    | SyncAction<'get_server_status'>
    | SyncAction<'get_client_status'>
    | SyncAction<'generate_code'>
    | SyncAction<'enable_server', EnableServer>
    | SyncAction<'enable_client', EnableClient>
    // the plays recorded by the window (JSON), for the other devices
    | SyncAction<'stats_changed', string>

    type ServerDevices = ServerKeyInfo[]

    interface ServerStatus {
      status: boolean
      message: string
      address: string[]
      code: string
      devices: ServerKeyInfo[]
    }

    interface ClientStatus {
      status: boolean
      message: string
      address: string[]
    }

    interface ClientKeyInfo {
      clientId: string
      key: string
      serverName: string
    }

    interface ServerKeyInfo {
      clientId: string
      key: string
      deviceName: string
      lastConnectDate?: number
      isMobile: boolean
    }

    interface ListConfig {
      skipSnapshot: boolean
    }
    interface DislikeConfig {
      skipSnapshot: boolean
    }
    // the listening stats: merged (no snapshot)
    interface StatsConfig {
      skipSnapshot: boolean
    }
    type ServerType = 'desktop-app' | 'server'
    interface EnabledFeatures {
      list?: false | ListConfig
      dislike?: false | DislikeConfig
      stats?: false | StatsConfig
    }
    type SupportedFeatures = Partial<{ [k in keyof EnabledFeatures]: number }>
  }
}

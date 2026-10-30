declare global {
  namespace LX {
    namespace Sync {
      interface Status {
        status: boolean
        message: string
      }

      interface KeyInfo {
        clientId: string
        key: string
        serverName: string
      }

      interface Socket extends WebSocket {
        isReady: boolean
        data: {
          keyInfo: KeyInfo
          urlInfo: UrlInfo
          /** replaced by a new connection (plugins/sync/client/client.ts): its events are left out */
          isStale?: boolean
          /** ends it (once) without waiting for its close event */
          handleClosed?: () => boolean
        }
        moduleReadys: {
          list: boolean
          dislike: boolean
          stats: boolean
          collections: boolean
        }

        onClose: (handler: (err: Error) => (void | Promise<void>)) => () => void

        remote: LX.Sync.ServerSyncActions
        remoteQueueList: LX.Sync.ServerSyncListActions
        remoteQueueDislike: LX.Sync.ServerSyncDislikeActions
        remoteQueueStats: LX.Sync.ServerSyncStatsActions
        remoteQueueCollections: LX.Sync.ServerSyncCollectionsActions
      }


      interface ModeTypes {
        list: LX.Sync.List.SyncMode
        dislike: LX.Sync.Dislike.SyncMode
      }

      type ModeType = { [K in keyof ModeTypes]: { type: K, mode: ModeTypes[K] } }[keyof ModeTypes]

      interface UrlInfo {
        wsProtocol: string
        httpProtocol: string
        hostPath: string
        href: string
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
      // the collected albums / artists: merged (no snapshot)
      interface CollectionsConfig {
        skipSnapshot: boolean
      }
      type ServerType = 'desktop-app' | 'server'
      interface EnabledFeatures {
        list?: false | ListConfig
        dislike?: false | DislikeConfig
        stats?: false | StatsConfig
        collections?: false | CollectionsConfig
      }
      type SupportedFeatures = Partial<{ [k in keyof EnabledFeatures]: number }>
    }
  }
}

export {}

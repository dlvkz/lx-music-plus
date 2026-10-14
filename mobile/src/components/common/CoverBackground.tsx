import { memo, useCallback, useEffect, useState } from 'react'
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { defaultHeaders } from './Image'
import { useImageRetry } from './ImageBackground'

// The blurred cover of the dynamic background: the cover before stays under the new one until the new one is drawn,
// no moment of the bare color between two songs (PageContent, PlayerBar)

interface Props {
  uri: string
  blurRadius: number
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

export default memo(({ uri, blurRadius, style, children }: Props) => {
  // the covers drawn, the last one on top
  const [layers, setLayers] = useState<string[]>([uri])
  useEffect(() => {
    setLayers(layers => layers[layers.length - 1] == uri ? layers : [...layers.slice(-1), uri])
  }, [uri])
  // the one on top is drawn: the ones under it go
  const handleLoad = useCallback((loaded: string) => {
    setLayers(layers => layers[layers.length - 1] == loaded && layers.length > 1 ? [loaded] : layers)
  }, [])
  const retry = useImageRetry(uri)
  const handleError = useCallback((failed: string) => {
    if (failed == uri) retry.onError()
  }, [uri, retry])

  return (
    <View style={style}>
      {
        layers.map(layer => (
          <Image
            key={layer == uri ? `${layer}_${retry.key}` : layer}
            source={{ uri: layer, headers: defaultHeaders }}
            resizeMode="cover"
            blurRadius={blurRadius}
            style={StyleSheet.absoluteFill}
            onLoad={() => { handleLoad(layer) }}
            onError={() => { handleError(layer) }}
          />
        ))
      }
      {children}
    </View>
  )
})

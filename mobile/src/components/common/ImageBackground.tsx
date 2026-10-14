// https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Image/ImageBackground.js
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState,
  View,
  StyleSheet,
  Image,
} from 'react-native'
import type { ImageBackgroundProps as _ImageBackgroundProps } from 'react-native'


/**
 * Very simple drop-in replacement for <Image> which supports nesting views.
 *
 * ```ReactNativeWebPlayer
 * import { Component } from 'react';
 * import { AppRegistry, View, ImageBackground, Text } from 'react-native';
 *
 * class DisplayAnImageBackground extends Component {
 *   render() {
 *     return (
 *       <ImageBackground
 *         style={{width: 50, height: 50}}
 *         source={{uri: 'https://reactnative.dev/img/opengraph.png'}}
 *       >
 *         <Text>React</Text>
 *       </ImageBackground>
 *     );
 *   }
 * }
 *
 * // App registration and rendering
 * AppRegistry.registerComponent('DisplayAnImageBackground', () => DisplayAnImageBackground);
 * ```
 */

export type ImageBackgroundType = View

export interface ImageBackgroundProps extends Omit<_ImageBackgroundProps, 'source'> {
  source?: _ImageBackgroundProps['source'] | null
}

export default forwardRef<View, ImageBackgroundProps>(({
  children,
  style,
  imageStyle,
  imageRef,
  importantForAccessibility,
  source,
  ...props
}, ref) => {
  const flattenedStyle = StyleSheet.flatten(style)
  return (
    <View
      accessibilityIgnoresInvertColors={true}
      importantForAccessibility={importantForAccessibility}
      ref={ref}
      style={style}>
      {
        source == null ? null : (
          <Image
            {...props}
            source={source}
            importantForAccessibility={importantForAccessibility}
            style={[
              StyleSheet.absoluteFill,
              {
                // Temporary Workaround:
                // Current (imperfect yet) implementation of <Image> overwrites width and height styles
                // (which is not quite correct), and these styles conflict with explicitly set styles
                // of <ImageBackground> and with our internal layout model here.
                // So, we have to proxy/reapply these styles explicitly for actual <Image> component.
                // This workaround should be removed after implementing proper support of
                // intrinsic content size of the <Image>.
                width: flattenedStyle?.width,
                height: flattenedStyle?.height,
              },
              imageStyle,
            ]}
            ref={imageRef}
          />
        )
      }
      {children}
    </View>
  )
})

export const prefetch = async(url: string) => {
  return Image.prefetch(url)
}

const MAX_RETRY = 3
/**
 * The dynamic background: a cover that failed to show (after the app was in the background, its image gone from
 * the cache...) is downloaded again and shown again, instead of leaving only the color over it
 */
export const useImageRetry = (url: string | null) => {
  const [key, setKey] = useState(0)
  const retryRef = useRef(0)
  useEffect(() => {
    retryRef.current = 0
  }, [url])
  // back from a while in the background: shown again (the image can be dropped without an error)
  useEffect(() => {
    if (!url) return
    let hiddenAt = 0
    const subscription = AppState.addEventListener('change', state => {
      if (state == 'background') hiddenAt = Date.now()
      else if (state == 'active' && hiddenAt && Date.now() - hiddenAt > 60_000) setKey(key => key + 1)
    })
    return () => {
      subscription.remove()
    }
  }, [url])
  const onError = useCallback(() => {
    if (!url || retryRef.current >= MAX_RETRY) return
    const retry = ++retryRef.current
    console.log('dynamic background failed to show, retry', retry, url)
    setTimeout(() => {
      void prefetch(url).catch(() => false).finally(() => {
        setKey(key => key + 1)
      })
    }, 500 * retry)
  }, [url])
  return { key, onError }
}

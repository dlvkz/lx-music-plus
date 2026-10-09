import { View } from 'react-native'

import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'


interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
}

export default ({ title, children }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title} size={20} >{title}</Text>
      <View>
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  container: {
    // paddingLeft: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  title: {
    fontWeight: 'bold',
    paddingLeft: 15,
    marginBottom: 12,
    // lineHeight: 16,
  },
})

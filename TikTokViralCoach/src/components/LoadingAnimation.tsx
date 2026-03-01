import React from 'react';
import LottieView from 'lottie-react-native';
import {View} from 'react-native';

interface Props {
  size?: number;
}

const LoadingAnimation: React.FC<Props> = ({size = 120}) => (
  <View
    style={{
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
    <LottieView
      source={require('../assets/chef-loading.json')}
      autoPlay
      loop
      style={{width: size, height: size, backgroundColor: 'transparent'}}
      renderMode="AUTOMATIC"
    />
  </View>
);

export default LoadingAnimation;

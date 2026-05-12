/**
 * 宠物图片资源索引
 * Metro 的静态 require 不支持动态字符串，需要在此集中声明所有资源路径。
 * 由 getPetImageSource() 统一调用，外部禁止直接 require pets 图片。
 */
import { ImageSourcePropType } from 'react-native';

export const PET_IMAGES: Record<string, Record<number, ImageSourcePropType>> = {
  dragon: {
    1: require('./pets/dragon_stage1.png'),
    2: require('./pets/dragon_stage2.png'),
    3: require('./pets/dragon_stage3.png'),
    4: require('./pets/dragon_stage4.png'),
    5: require('./pets/dragon_stage5.png'),
  },
  cat: {
    1: require('./pets/cat_stage1.png'),
    2: require('./pets/cat_stage2.png'),
    3: require('./pets/cat_stage3.png'),
    4: require('./pets/cat_stage4.png'),
    5: require('./pets/cat_stage5.png'),
  },
  dog: {
    1: require('./pets/dog_stage1.png'),
    2: require('./pets/dog_stage2.png'),
    3: require('./pets/dog_stage3.png'),
    4: require('./pets/dog_stage4.png'),
    5: require('./pets/dog_stage5.png'),
  },
  rabbit: {
    1: require('./pets/rabbit_stage1.png'),
    2: require('./pets/rabbit_stage2.png'),
    3: require('./pets/rabbit_stage3.png'),
    4: require('./pets/rabbit_stage4.png'),
    5: require('./pets/rabbit_stage5.png'),
  },
  panda: {
    1: require('./pets/panda_stage1.png'),
    2: require('./pets/panda_stage2.png'),
    3: require('./pets/panda_stage3.png'),
    4: require('./pets/panda_stage4.png'),
    5: require('./pets/panda_stage5.png'),
  },
  fox: {
    1: require('./pets/fox_stage1.png'),
    2: require('./pets/fox_stage2.png'),
    3: require('./pets/fox_stage3.png'),
    4: require('./pets/fox_stage4.png'),
    5: require('./pets/fox_stage5.png'),
  },
};

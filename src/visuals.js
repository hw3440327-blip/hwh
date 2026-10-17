import { scenes } from './story.js';

export const artwork = {
  arrival: '/art/immersive-arrival.png', spring: '/art/immersive-arrival.png',
  bakery: '/art/immersive-bakery.png', room: '/art/immersive-room.png',
  'room-night': '/art/immersive-room-night.png', workshop: '/art/immersive-workshop.png',
  letters: '/art/immersive-letters.png', garden: '/art/immersive-garden.png',
};
const keyFor = scene => scene?.image === 'room' && /夜晚|晚上/.test(scene.time) ? 'room-night' : scene?.image || 'arrival';
export const getSceneArt = scene => artwork[keyFor(scene)] || artwork.arrival;
export function memoryArt(memory) {
  const momentImage = { moment_bread: 'bakery', moment_repair: 'workshop', moment_plant: 'room' }[memory.id];
  if (momentImage) return artwork[momentImage];
  const scene = memory.id.startsWith('echo:') ? scenes[memory.id.slice(5)] : Object.values(scenes).find(item => item.choices.some(choice => choice.memory?.id === memory.id));
  return getSceneArt(scene);
}
export function sceneDescription(scene) {
  return ({
    arrival: '手绘动画中的海边木造车站，雨后站台通向蓝色海湾，远山和小镇浸在柔光里',
    spring: '清透的手绘海边小镇，木造站房、海风与远处的山',
    bakery: '手绘动画般朴素的木面包房，烤箱透着暖光，桌上有纸袋和茶杯',
    room: '明亮的手绘小租屋，阳光落在旧木桌上，亚麻窗帘旁有一盆绿植',
    'room-night': '安静的手绘夜景，暖台灯照亮小租屋，窗外是深蓝的海湾',
    workshop: '有使用痕迹的木工作台、修补中的木盒与工具，海风从窗外吹来',
    letters: '夕阳照着木桌上摊开的旧信、照片和眼镜，茶杯旁留下温暖的影子',
    garden: '手绘的海边坡道与小花园，树影落在旧木长椅上，白发的背影望着远处',
  })[keyFor(scene)] || '手绘动画中的海边小镇';
}
const details = {
  arrival: [
    { id: 'platform', label: '湿漉漉的站台', x: 28, y: 65, text: '鞋底踩过浅浅的积水。站房木檐上的雨，隔一会儿才落下一滴。' },
    { id: 'sea', label: '远处的海', x: 73, y: 43, text: '风把一点咸味带到这里。船慢慢过去，海面又合上了那道细长的白线。' },
  ],
  bakery: [
    { id: 'oven', label: '烤箱的暖光', x: 28, y: 46, text: '烤箱里轻轻响了一声。黄油和面粉的味道，从柜台后面慢慢散出来。' },
    { id: 'cup', label: '桌上的茶杯', x: 67, y: 64, text: '杯沿有一道细小的磕痕，握着却很舒服。水汽让眼前的窗短暂地模糊了一点。' },
  ],
  room: [
    { id: 'curtain', label: '窗边的风', x: 65, y: 33, text: '帘子鼓起来，又慢慢落回去。屋里很安静，能听见楼下有人收起晾衣杆。' },
    { id: 'desk', label: '旧木桌', x: 32, y: 65, text: '桌角磨得圆圆的，阳光照在一小块浅色木纹上。把手放上去，摸得到一点暖意。' },
  ],
  'room-night': [
    { id: 'lamp', label: '那盏小台灯', x: 70, y: 52, text: '灯罩把光拢在桌边。窗外偶尔有一声车轮碾过湿路，很快又安静下来。' },
    { id: 'night', label: '海湾的灯火', x: 38, y: 32, text: '远处亮着几扇小窗。你不知道里面住着谁，只觉得这个夜晚有人和你一起醒着。' },
  ],
  workshop: [
    { id: 'wood', label: '修补中的木盒', x: 33, y: 63, text: '木盒盖上有许多细小划痕，最常被手碰到的地方反而更亮。有人已经用了它很久。' },
    { id: 'tools', label: '墙边的工具', x: 72, y: 37, text: '工具各有自己的位置。钳柄缠过新的布条，剪刀旁边放着一块折好的旧棉布。' },
  ],
  letters: [
    { id: 'paper', label: '信纸的折痕', x: 31, y: 62, text: '沿着折痕把纸慢慢展开。纸边已经软了，那些被认真写下的话，仍然留在原处。' },
    { id: 'tea', label: '放凉的茶', x: 69, y: 51, text: '杯底压着一圈淡淡的茶色。窗外有鸟叫了一声，你才想起，今天还没有出门走走。' },
  ],
  garden: [
    { id: 'bench', label: '修补过的长椅', x: 35, y: 60, text: '新换的木板颜色浅一点。树叶投下来的影子不停移动，像有人把时间轻轻翻了一页。' },
    { id: 'leaves', label: '头顶的树叶', x: 70, y: 32, text: '枝叶被风拨开一小道缝，天光就落下来。远处的人正在慢慢说话，你听不清，也不着急。' },
  ],
};
export function sceneDetails(scene) { const key = keyFor(scene); return details[key === 'spring' ? 'arrival' : key] || details.arrival; }

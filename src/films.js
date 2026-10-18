export const sceneFilms = {
  arrival: { poster:'/art/film-arrival.webp', src:'/films/arrival.mp4', label:'海风停在初来那天', focus:'人物、海面与枝叶的循环镜头' },
  bakery: { poster:'/art/film-bakery.webp', src:'/films/bakery.mp4', label:'把日子揉进面香', focus:'掌心、炉光与窗外海面的循环镜头' },
  bookshop: { poster:'/art/film-bookshop.webp', src:'/films/bookshop.mp4', label:'书页之间，有风经过', focus:'扶着书页的手、树影与海光的循环镜头' },
  workshop: { poster:'/art/film-workshop.webp', src:'/films/workshop.mp4', label:'旧木纹里的新一天', focus:'手作、衣袖与窗光的循环镜头' },
  kitchen: { poster:'/art/film-kitchen.webp', src:'/films/kitchen.mp4', label:'晚饭以后，先坐一会儿', focus:'捧杯的人、窗帘与湾灯的循环镜头' },
  garden: { poster:'/art/film-garden.webp', src:'/films/garden.mp4', label:'把耐心交给一畦新绿', focus:'浇水的手、花叶与晨光的循环镜头' },
  shore: { poster:'/art/film-shore.webp', src:'/films/shore.mp4', label:'潮水会慢慢回来', focus:'海潮、水光与远树的循环镜头' },
  night: { poster:'/art/film-night.webp', src:'/films/night.mp4', label:'那盏为你留下的灯', focus:'台灯、海湾倒影与窗边气息的循环镜头' },
};
const scenes = {
  arrival:'arrival',ending_return:'arrival',bakery:'bakery',trial_bakery:'bakery',ending_bakery:'bakery',
  bookshop:'bookshop',ending_bookshop:'bookshop',workshop:'workshop',life_craft:'workshop',
  life_bridge:'kitchen',life_companion:'kitchen',life_garden:'garden',life_retire:'garden',
  shore:'shore',room:'night',life_boundary:'night',life_midlife:'night',
};
export const filmForScene = scene => sceneFilms[scenes[scene?.id]] || null;

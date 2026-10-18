export const sceneFilms = {
  arrival: { poster:'/art/film-arrival.webp', label:'海风停在初来那天', focus:'固定原画上的光影、海面反光与细微环境变化' },
  bakery: { poster:'/art/film-bakery.webp', label:'把日子揉进面香', focus:'固定原画上的光影、海面反光与细微环境变化' },
  bookshop: { poster:'/art/film-bookshop.webp', label:'书页之间，有风经过', focus:'固定原画上的光影、海面反光与细微环境变化' },
  workshop: { poster:'/art/film-workshop.webp', label:'旧木纹里的新一天', focus:'固定原画上的光影、海面反光与细微环境变化' },
  kitchen: { poster:'/art/film-kitchen.webp', label:'晚饭以后，先坐一会儿', focus:'固定原画上的光影、海面反光与细微环境变化' },
  garden: { poster:'/art/film-garden.webp', label:'把耐心交给一畦新绿', focus:'固定原画上的光影、海面反光与细微环境变化' },
  shore: { poster:'/art/film-shore.webp', label:'潮水会慢慢回来', focus:'固定原画上的光影、海面反光与细微环境变化' },
  night: { poster:'/art/film-night.webp', label:'那盏为你留下的灯', focus:'固定原画上的光影、海面反光与细微环境变化' },
};
const scenes = {
  arrival:'arrival',ending_return:'arrival',bakery:'bakery',trial_bakery:'bakery',ending_bakery:'bakery',
  bookshop:'bookshop',ending_bookshop:'bookshop',workshop:'workshop',life_craft:'workshop',
  life_bridge:'kitchen',life_companion:'kitchen',life_garden:'garden',life_retire:'garden',
  shore:'shore',room:'night',life_boundary:'night',life_midlife:'night',
};
export const filmForScene = scene => sceneFilms[scenes[scene?.id]] || null;

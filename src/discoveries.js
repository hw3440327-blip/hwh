import { scenes } from './story.js';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const validPhoto = value => typeof value === 'string' && value.length <= 110000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const discoveryDefinitions = [
  { id: 'tea', title: '借一盏茶的时间', subtitle: '提起茶壶，把今天慢慢倒进杯里。', place: '窗边茶席', sceneIds: ['bakery','bookshop','first_week','life_bridge','life_companion','life_rest','life_lin_letter','life_album'], memory: { id:'discovery_tea', title:'给自己沏的一盏茶', description:'亲手选了茶，守着水流慢慢落入杯中。热气升起时，今天终于有了一小段只属于自己的时间。' } },
  { id: 'shells', title: '潮汐留下的信', subtitle: '找三枚贝壳，摆出只有你知道的海岸。', place: '海堤石阶', sceneIds:['shore'], memory: { id:'discovery_shells', title:'一小片自己的海岸', description:'在潮水退去的石阶边找到三枚贝壳，又亲手摆出一条不必通向任何地方的弧线。海替你留过一点光。' } },
  { id: 'photo', title: '把这一束光留下', subtitle: '移动取景框，给普通的一天一个自己的角度。', place:'小镇光影', sceneIds:Object.keys(scenes), memory:{ id:'discovery_photo', title:'由你取景的小镇', description:'光正好落在这里。你停了一会儿，决定记住眼前的这个角度。取景和题字都随这一段旅程收好了。' } },
];
const find = id => discoveryDefinitions.find(d => d.id === id);
export const sceneDiscoveries = game => discoveryDefinitions.filter(d => d.sceneIds.includes(game?.sceneId));
export function normalizeDiscoveries(value, visited = Object.keys(scenes)) {
  if (!object(value)) return {};
  visited = Array.isArray(visited) ? visited : [];
  const result = {};
  if (object(value.tea)) {
    const tea = value.tea;
    const blend = ['jasmine','osmanthus'].includes(tea.blend) ? tea.blend : null;
    const filled = blend && finite(tea.filled) ? clamp(tea.filled,0,82) : 0;
    const steeped = filled >= 45 && tea.steeped === true;
    result.tea = { blend, filled, steeped, completed: steeped && tea.completed === true };
  }
  if (object(value.shells)) {
    const shell = value.shells;
    const found = [...new Set(Array.isArray(shell.found) ? shell.found.filter(i => Number.isInteger(i) && i>=0 && i<3) : [])];
    const defaults = [{x:.3,y:.5,angle:-18},{x:.5,y:.43,angle:12},{x:.7,y:.54,angle:-8}];
    const layout = defaults.map((fallback,i) => {
      const p = Array.isArray(shell.layout) && object(shell.layout[i]) ? shell.layout[i] : fallback;
      return { x:finite(p.x)?clamp(p.x,.12,.88):fallback.x, y:finite(p.y)?clamp(p.y,.22,.78):fallback.y, angle:finite(p.angle)?clamp(p.angle,-180,180):fallback.angle };
    });
    result.shells = { found, layout, completed: found.length === 3 && shell.completed === true };
  }
  if (object(value.photo)) {
    const p=value.photo;
    const shots=(Array.isArray(p.shots)?p.shots:[]).filter(s=>object(s)&&Object.hasOwn(scenes,s.sceneId)&&visited.includes(s.sceneId)&&finite(s.x)&&finite(s.y)&&finite(s.zoom)).slice(-6).map(s=>({image:validPhoto(s.image)?s.image:'',sceneId:s.sceneId,x:clamp(s.x,0,1),y:clamp(s.y,0,1),zoom:clamp(s.zoom,1,2.2),caption:typeof s.caption==='string'?Array.from(s.caption).slice(0,48).join(''):''}));
    result.photo={shots,completed:shots.length>0};
  }
  return result;
}
export function discoveryProgress(game,id) {
  if(!find(id))return null;
  const normalized=normalizeDiscoveries(game?.discoveries,game?.visited);
  if(id==='tea')return normalized.tea||{blend:null,filled:0,steeped:false,completed:false};
  if(id==='shells')return normalized.shells||{found:[],layout:[{x:.3,y:.5,angle:-18},{x:.5,y:.43,angle:12},{x:.7,y:.54,angle:-8}],completed:false};
  return normalized.photo||{shots:[],completed:false};
}
export function performDiscovery(game,id,action) {
  const definition=find(id);
  if(!definition||!object(game)||!object(action)||!Array.isArray(game.memories)||!Array.isArray(game.visited)||!definition.sceneIds.includes(game.sceneId)||game.introDone!==true)return game;
  const p=discoveryProgress(game,id);let next=structuredClone(p),changed=false;
  if(id!=='photo'&&p.completed)return game;
  if(id==='tea') {
    if(action.type==='blend'&&!p.blend&&['jasmine','osmanthus'].includes(action.blend)){next.blend=action.blend;changed=true;}
    if(action.type==='pour'&&p.blend&&!p.steeped&&finite(action.amount)&&action.amount>0&&action.amount<=10&&p.filled<82){next.filled=clamp(p.filled+action.amount,0,82);changed=true;}
    if(action.type==='steep'&&p.filled>=45&&!p.steeped){next.steeped=true;changed=true;}
    if(action.type==='savor'&&p.steeped){next.completed=true;changed=true;}
  } else if(id==='shells') {
    if(action.type==='find'&&Number.isInteger(action.index)&&action.index>=0&&action.index<3&&!p.found.includes(action.index)){next.found.push(action.index);changed=true;}
    if(action.type==='place'&&p.found.length===3&&Number.isInteger(action.index)&&action.index>=0&&action.index<3&&finite(action.x)&&finite(action.y)&&finite(action.angle)){next.layout[action.index]={x:clamp(action.x,.12,.88),y:clamp(action.y,.22,.78),angle:clamp(action.angle,-180,180)};changed=true;}
    if(action.type==='keep'&&p.found.length===3){next.completed=true;changed=true;}
  } else if(action.type==='capture'&&finite(action.x)&&finite(action.y)&&finite(action.zoom)&&typeof action.caption==='string') {
    next.shots=[...p.shots,{sceneId:game.sceneId,x:clamp(action.x,0,1),y:clamp(action.y,0,1),zoom:clamp(action.zoom,1,2.2),caption:Array.from(action.caption).slice(0,48).join(''),image:validPhoto(action.image)?action.image:''}].slice(-6);next.completed=true;changed=true;
  }
  if(!changed)return game;
  const memories=next.completed&&!game.memories.some(m=>m.id===definition.memory.id)?[...game.memories,{...definition.memory}]:game.memories;
  return {...game,discoveries:{...normalizeDiscoveries(game.discoveries,game.visited),[id]:next},memories};
}

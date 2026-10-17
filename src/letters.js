// These are fictional letters inside the story. Reply choices never send a message.
export const letters = [
  {
    id: 'lin_first_parcel',
    fromId: 'lin',
    from: '林姨',
    subject: '快递先放在柜台下面',
    date: '22岁 · 初秋',
    unlock: { scene: 'first_week' },
    paragraphs: [
      '{name}，你上回那个快递，我收进柜台下面了。外面的纸箱淋湿了一角，里面没事。我下午都在，不必赶着午休来取；如果想让我转放门房，回个话就好。',
      '后街新换的路灯有时会闪，已经有人报修。你晚回家可以走菜市场这边，多绕几十步，脚下亮一点。我的自行车也坏了，明天得去找周予看看，最近什么都挤在一块儿。',
      '顺便问一句，你习不习惯吃葱？周末想煮一锅面，隔壁已经说要带鸡蛋。如果有空就留个碗的位置，没空也没关系，我好知道该买多少，不然又得连吃三顿剩面。',
    ],
    ps: '取快递时敲侧门就行，前门的铃这两天不太灵。',
    replies: [
      { id: 'collect_and_dinner', text: '我明天下午去取。周末可以留一只碗，葱我也吃。' },
      { id: 'collect_only', text: '谢谢林姨，明天去取。周末已有安排，下次再一起吃面。' },
    ],
  },
  {
    id: 'zhou_winter_tool',
    fromId: 'zhou',
    from: '周予',
    subject: '螺丝刀不急着还',
    date: '22岁 · 冬末',
    unlock: { scene: 'winter' },
    paragraphs: [
      '{name}，借你的那把螺丝刀先放着，我有备用的。桌脚要是又晃，别再往里垫纸，拍张底下的照片给我。木头受潮后会有点变形，得先看清楚是哪颗螺丝松了。',
      '店里这周在整理零件，找出一整盒配不上对的抽屉把手。我本想全扔了，分到最后又留下半盒，结果柜子还是合不上。原来替自己收拾东西，比替别人修要难一点。',
      '周日下午我会在门口磨工具，声音有点响，先和你说一声。如果你正好要睡觉，我就改到上午。顺便想借你的旧报纸铺桌面，不用整齐，沾了油的那张别给我就行。',
    ],
    replies: [
      { id: 'save_newspapers', text: '我留了几张旧报纸，周日带过去。下午磨工具没关系。' },
      { id: 'quiet_sunday', text: '周日下午想补觉，能挪到上午吗？报纸我会放在你门口。' },
    ],
  },
  {
    id: 'he_first_postcard',
    fromId: 'he',
    from: '阿禾',
    subject: '还没出发，先挑好了明信片',
    date: '22岁 · 初春',
    unlock: { scene: 'letter' },
    paragraphs: [
      '{name}，我还没买最后那段车票，倒先把沿途能寄信的邮局查了一遍。店里的排班要交接，行李也一直超重，昨天拿出一本书，今天又偷偷塞回去了，真是没完。',
      '这张明信片是清点库存时翻出来的，画着修堤之前的海岸。以前放学走那条路，鞋里总能倒出一点沙。我想带几张去，到了新地方，或许就知道该写些什么给这里的人。',
      '你想先收到山里的车站，还是北边城市的街景？我不保证拍得漂亮，但会记下那天吃了什么、车有没有晚点。你也可以给我讲小镇的天气，阴天和起雾都算，别只挑晴天。',
    ],
    replies: [
      { id: 'mountain_station', text: '想看看山里的车站。我会给你留一张小镇起雾的照片。' },
      { id: 'city_streets', text: '寄一张城市街景吧，也告诉我你在那里吃过什么。' },
    ],
  },
  {
    id: 'lin_shorter_shift',
    fromId: 'lin',
    from: '林姨',
    subject: '这回轮到我学着晚一点起床',
    date: '30岁 · 初秋',
    unlock: { scene: 'life_budget' },
    paragraphs: [
      '{name}，最近把早晨的事交出去一些，我反而总在五点醒。第一天还偷偷走到店门口，看见里面已经有人开灯，才想起自己今天可以去别处吃早饭，不用赶着和面。',
      '女儿笑我不会歇着，这话也对。上午试着去买菜，才知道这个点的鱼比中午贵不少，和摊主讲了半天价，最后只带回两块豆腐。你看，人总有些得重新学的小事。',
      '从前记在围裙口袋里的配方，我最近抄成一本。有一页泡过水，盐的分量糊了，我得找人陪我试一盘。如果你得空，过来帮忙尝尝；不方便也可以把喜欢的口味写给我。',
    ],
    replies: [
      { id: 'try_recipe', text: '给我留一个试吃的位置吧。我们慢慢把那一页补齐。' },
      { id: 'send_flavor', text: '我还记得那款微咸的面包，想请你把它也写进本子里。' },
    ],
  },
  {
    id: 'zhou_smaller_work',
    fromId: 'zhou',
    from: '周予',
    subject: '大柜子暂时不接了',
    date: '45岁 · 深秋',
    unlock: { scene: 'life_midlife' },
    paragraphs: [
      '{name}，店门口那张告示我换了，大柜子和需要搬上楼的活暂时不接。前阵子搬桌子闪了腰，医生让我少逞强。我原本只想歇三天，后来发现，照他说的做省心多了。',
      '小件照旧能修，不过我把交货时间放宽了一些。客人急的时候，也有走掉的。说不失落是假的，空下来的时间倒真能坐着吃完午饭，汤没凉之前就喝得上。',
      '以前收的那些旧照片，我装进了一只浅抽屉。有几张记不清是谁拍的，你下回可以帮我认认。若你手里也有，背面写个大概的年月就好，想不起日子也不用硬猜。',
    ],
    replies: [
      { id: 'identify_photos', text: '下次一起认照片。我未必记得日期，但可能认得那张桌子。' },
      { id: 'send_old_photo', text: '我去翻翻旧相册，挑一张能记起故事的给你。' },
    ],
  },
  {
    id: 'he_familiar_street',
    fromId: 'he',
    from: '阿禾',
    subject: '又绕错了买菜的路',
    date: '52岁 · 盛夏',
    unlock: { scene: 'life_rest' },
    paragraphs: [
      '{name}，最近整理从外地带回的箱子，光是过期的公交卡就数出七张。当年觉得每个地方都会再去，留得很认真。如今有两座城市的住址，我已经想不起门牌了。',
      '镇上的菜摊换过位置，我昨天仍按旧路走，多兜了一圈才买到葱。倒是书店门槛那个小缺口还在，搬书进门时又绊了一下。熟悉的地方也会变，脚总比脑子慢一点。',
      '我想给旧明信片做个索引，背面没写完的就照原样留下，不补一个像模像样的结尾。你若还留着哪张，愿意的话告诉我上面画的是什么，免得我把自己的行程都记混了。',
    ],
    replies: [
      { id: 'find_postcard', text: '我翻翻夹在书里的明信片，找到后把画面写给你。' },
      { id: 'remember_weather', text: '有些画面记不清了，但我记得那阵子总在下雨，纸边有点卷。' },
    ],
  },
  {
    id: 'lin_forwarded_recipe',
    fromId: 'lin',
    from: '林姨的女儿 · 代转旧信',
    subject: '配方本里，夹着写给你的那页纸',
    date: '67岁 · 冬末（旧信代转）',
    unlock: { scene: 'life_lin_letter' },
    paragraphs: [
      '{name}，整理母亲的配方本时，我找到这页折好的信纸，外面写着你的名字，没有日期。我没替她补，连面粉留下的手印也保留着。下面这段，照她原来的字抄给你。',
      '“吃饭别总凑合。盐的数补好了，没什么神秘的，就是我以前随手记错了。烤箱大小不同，第一盘要在旁边看着。这些旧纸别为它腾太多地方，有用的几页留下就好。”',
      '我把原纸另外收进袋子里了。如果你愿意，我想在本子后面记下你熟悉的一款面包，不一定是招牌，普通的也好。等以后有人翻到，就知道这些配方曾经摆在哪些人的餐桌上。',
    ],
    ps: '这是代转的旧信。你写下的话，会作为给整理者的回信收好。',
    replies: [
      { id: 'remember_simple_bread', text: '请记下最普通的那款面包。我记得纸袋打开时，底部还是热的。' },
      { id: 'keep_flour_marks', text: '谢谢你保留这页纸。面粉的手印也请留着，那是配方的一部分。' },
    ],
  },
  {
    id: 'zhou_forwarded_drawer',
    fromId: 'zhou',
    from: '旧物铺整理者 · 代转周予旧信',
    subject: '浅抽屉最里面的一只信封',
    date: '80岁 · 初春（旧信代转）',
    unlock: { scene: 'life_album' },
    paragraphs: [
      '{name}，我们在整理旧物铺的浅抽屉，发现一只写给你的信封。里面有半张砂纸、一幅桌脚草图，还有周予留下的几句话。信里没有年月，以下保留原文，没有替他改动。',
      '“那个修不平的桌脚，后来找到原因了。地砖中间有点凹，换个位置就稳。我把木头削了半天才发现，白忙一场。草图还是给你留着，上面标的尺寸有用，别照最后那道线锯。”',
      '草图和砂纸已经装进新的保护袋。我们正在给旧物铺的照片写说明，如果你还记得这张桌子原来放在哪儿，想请你补一句；若不记得，也可以让那个位置空着，等别人再来认。',
    ],
    ps: '这封旧信由整理者代转；回信会和草图说明一起收好。',
    replies: [
      { id: 'remember_table_corner', text: '我记得靠窗有一块地砖略低，桌子曾挪到旁边。请把这句附上。' },
      { id: 'leave_blank', text: '我怕记错，就先留白吧。请替我好好收着这张草图。' },
    ],
  },
  {
    id: 'he_forwarded_unfinished',
    fromId: 'he',
    from: '沿海书店整理者 · 代转阿禾旧信',
    subject: '一张只写到半途的明信片',
    date: '82岁 · 冬末（旧信代转）',
    unlock: { scene: 'life_farewell' },
    paragraphs: [
      '{name}，书店整理旧明信片时，找到一张写给你的。邮票已经贴好，却没有寄出。阿禾在背面提到一个晚点的车站，我们查不到那班车了，就把她写下的部分原样转给你。',
      '“今天等车等了两个钟头，站台的热水倒是一直有。邻座的人问我栖屿在哪儿，我画了海和那条很短的老街。画得不像，差点忘记书店背后还有一条能抄近路的小巷。”',
      '她写到这里停了笔。我们没有替这张卡片补上结尾，只在说明里标了“写给{name}”。如果你愿意，可以留下一句关于那条小巷的记忆，和这张没有寄出的明信片放在一起。',
    ],
    ps: '原卡未盖邮戳，随信一起收在书店的旧信夹里。',
    replies: [
      { id: 'remember_short_lane', text: '那条巷子雨后容易积水，绕过去时，能听见面包房收托盘的声音。' },
      { id: 'keep_unfinished', text: '就让它停在这里吧。我知道她当时在想着回来的路。' },
    ],
  },
];

/** Resolve mail from story progress, never from the real date or a browser clock. */
export function unlockedLetters(game) {
  if (!game || typeof game !== 'object') return [];
  const visited = new Set(Array.isArray(game.visited) ? game.visited : []);
  if (typeof game.sceneId === 'string') visited.add(game.sceneId);
  const flags = new Set(Array.isArray(game.flags) ? game.flags : []);
  return letters.filter(({ unlock }) =>
    (!unlock?.scene || visited.has(unlock.scene))
    && (!unlock?.flag || flags.has(unlock.flag)),
  );
}

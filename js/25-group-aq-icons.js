
/* ══════════ Group AQ · 图标精选字典 + 挑选器 + Liquid Glass 可选风格（GROUP-AQ-ICONS） ══════════
   借鉴来源（只借做法与选形思路，全部为本组手写代码，未复制任何项目代码、未下载图标文件）：
   - Tabler（MIT，6,563 个，outline 24px 2px 描边）：首选字形来源；aliases.json 的
     中文/同义词搜索思路收敛为精选字典内的名字+关键词搜索（离线，不联网）。
   - Phosphor（MIT，1,512 个设计 × 6 weights）：备选；本组只取“描边 + 填充”两档
     变体概念，不嵌 6 个 weight；目录分类 + 标签组织挑选器的思路已采用。
   - Fluent（MIT，regular/filled/light 三档，24 尺寸为主）：备选；本组全手机只用
     24 尺寸规矩，light 覆盖不全故不作默认；color 风格已废弃，不用。
   - IconPark（Apache-2.0，一份源文件四种主题）：备选；只借“主题切换”思路，
     multi-color 不作全桌默认；仓库已归档冻结使用。
   - OpenMoji（图形 CC BY-SA 4.0，约 4,495 个；仓库代码 LGPL-3.0）：彩色点缀，
     只挑 24 个高频表情；color/black 双版本思路记为“制作时逐个内联 SVG”，本文件
     内是系统字体渲染的占位（已排除旗帜与多肤色变体），署名见关于页。
   - Lucide（ISC）、glass-icons 的 16 库目录（MIT 代码）：选形时的参考清单，
     不搬整库；Simple Icons（CC0）品牌标不用作 app 图标（另核商标政策）。
   - open-Icons 的跨库搜索思路收敛为精选字典内搜索，不联网、不搬整站。
   未选用：Remix Icon / Iconoir / Doodle Icons（许可未验证）；CDN 按需取图 /
   npm 包 / 字体图标 / sprite 整包 / PWA 导出整套（都需要构建器或联网，不做）。
   新增键只有 phone_icon_picks_v1（见 KEY）；既有键只读/复用，不改形状；
   桌面 app 图标沿用 D 组自有重画，本组不动；不碰微信消息发送/回复、
   图片消息渲染、乙游 3D 家主逻辑。 */
window.AQIcons = (() => {
'use strict';
const KEY = 'phone_icon_picks_v1';
/* 精选字典：60 个单色图标（定额 40–80 内）。字段：id / n 名字 / k 关键词 / c 分类 / s 内层 SVG。
   同一图标只存一份内层 path，共用 iconSVG 的 svg 外壳 + currentColor（跟主题换色）。 */
const CATS = [
  { id: 'all', name: '全部' }, { id: 'comm', name: '通讯' }, { id: 'media', name: '媒体' },
  { id: 'eff', name: '效率' }, { id: 'tool', name: '工具' }, { id: 'mood', name: '心情' }
];
const ICONS = [
  { id: 'phone', n: '电话', k: '电话 通话 打电话', c: 'comm', s: '<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"/>' },
  { id: 'message-circle', n: '消息', k: '消息 聊天 气泡 对话', c: 'comm', s: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' },
  { id: 'message-square', n: '微信', k: '微信 聊天 会话 群聊', c: 'comm', s: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  { id: 'mail', n: '邮件', k: '邮件 邮箱 信件', c: 'comm', s: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>' },
  { id: 'video', n: '视频通话', k: '视频通话 摄像头 视频', c: 'comm', s: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>' },
  { id: 'send', n: '发送', k: '发送 纸飞机 发出', c: 'comm', s: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' },
  { id: 'bell', n: '通知', k: '通知 提醒 铃铛 消息提醒', c: 'comm', s: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
  { id: 'users', n: '联系人', k: '联系人 群聊 好友 通讯录', c: 'comm', s: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
  { id: 'share', n: '分享', k: '分享 转发', c: 'comm', s: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' },
  { id: 'camera', n: '相机', k: '相机 拍照 摄影', c: 'media', s: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>' },
  { id: 'image', n: '相册', k: '相册 图片 照片 图库', c: 'media', s: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
  { id: 'music', n: '音乐', k: '音乐 歌曲 播放音乐', c: 'media', s: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  { id: 'headphones', n: '耳机', k: '耳机 听歌 耳麦', c: 'media', s: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>' },
  { id: 'play', n: '播放', k: '播放 开始', c: 'media', s: '<polygon points="5 3 19 12 5 21 5 3"/>' },
  { id: 'pause', n: '暂停', k: '暂停', c: 'media', s: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' },
  { id: 'film', n: '电影', k: '电影 剧本 胶片 影片', c: 'media', s: '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>' },
  { id: 'mic', n: '录音', k: '录音 语音 话筒', c: 'media', s: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>' },
  { id: 'calendar', n: '日历', k: '日历 日期 计划', c: 'eff', s: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' }, /* GROUP-FIX7：日程 app 已删，日历图形改名日历 */
  { id: 'clock', n: '时钟', k: '时钟 此刻 时间 钟表', c: 'eff', s: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
  { id: 'file-text', n: '备忘录', k: '备忘录 文档 笔记 文字', c: 'eff', s: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' },
  { id: 'edit', n: '编辑', k: '编辑 写字 笔 修改', c: 'eff', s: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' },
  { id: 'bookmark', n: '收藏', k: '收藏 书签', c: 'eff', s: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' },
  { id: 'check', n: '完成', k: '完成 对勾 打勾', c: 'eff', s: '<polyline points="20 6 9 17 4 12"/>' },
  { id: 'check-circle', n: '已完成', k: '已完成 勾选 通过', c: 'eff', s: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
  { id: 'list', n: '清单', k: '清单 列表 待办', c: 'eff', s: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>' },
  { id: 'archive', n: '归档', k: '归档 收纳 存档', c: 'eff', s: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>' },
  { id: 'folder', n: '文件夹', k: '文件夹 文件 目录', c: 'eff', s: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
  { id: 'download', n: '下载', k: '下载 保存到本地', c: 'eff', s: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
  { id: 'upload', n: '上传', k: '上传 发送到云端', c: 'eff', s: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>' },
  { id: 'plus', n: '新建', k: '新建 添加 加号', c: 'eff', s: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' },
  { id: 'paperclip', n: '附件', k: '附件 回形针 附上', c: 'eff', s: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>' },
  { id: 'book', n: '小说', k: '小说 书 阅读 书籍', c: 'eff', s: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' },
  { id: 'book-open', n: '日记', k: '日记 阅读 打开的书', c: 'eff', s: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
  { id: 'search', n: '搜索', k: '搜索 查找 查手机 放大镜', c: 'tool', s: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
  { id: 'settings', n: '设置', k: '设置 齿轮 系统设置', c: 'tool', s: '<circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7" y2="7"/><line x1="17" y1="17" x2="19.1" y2="19.1"/><line x1="19.1" y1="4.9" x2="17" y2="7"/><line x1="7" y1="17" x2="4.9" y2="19.1"/>' },
  { id: 'home', n: '归巢', k: '归巢 首页 房子 回家', c: 'tool', s: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { id: 'globe', n: '浏览器', k: '浏览器 网络 地球 网页', c: 'tool', s: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
  { id: 'compass', n: '探索', k: '探索 指南针 发现', c: 'tool', s: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>' },
  { id: 'map-pin', n: '位置', k: '位置 地点 定位 地址', c: 'tool', s: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
  { id: 'cloud', n: '天气', k: '天气 云 云朵', c: 'tool', s: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>' },
  { id: 'sun', n: '晴天', k: '晴天 太阳 白天', c: 'tool', s: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' },
  { id: 'moon', n: '夜晚', k: '夜晚 月亮 睡眠', c: 'tool', s: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' },
  { id: 'lock', n: '锁定', k: '锁定 密码 锁', c: 'tool', s: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
  { id: 'shield', n: '隐私', k: '隐私 保护 安全', c: 'tool', s: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  { id: 'sliders', n: '调节', k: '调节 设置 滑块', c: 'tool', s: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>' },
  { id: 'wifi', n: '网络', k: '网络 无线 wifi 信号', c: 'tool', s: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>' },
  { id: 'battery', n: '电量', k: '电量 电池', c: 'tool', s: '<rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><line x1="5" y1="10" x2="5" y2="14"/><line x1="9" y1="10" x2="9" y2="14"/>' },
  { id: 'link', n: '链接', k: '链接 网址', c: 'tool', s: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>' },
  { id: 'x', n: '关闭', k: '关闭 叉号 取消', c: 'tool', s: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' },
  { id: 'heart', n: '喜欢', k: '喜欢 爱心 爱', c: 'mood', s: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
  { id: 'star', n: '星星', k: '星星 收藏 喜欢', c: 'mood', s: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
  { id: 'smile', n: '心情', k: '心情 开心 笑脸 快乐', c: 'mood', s: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>' },
  { id: 'coffee', n: '咖啡', k: '咖啡 休息 喝咖啡', c: 'mood', s: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>' },
  { id: 'gift', n: '礼物', k: '礼物 惊喜 送礼', c: 'mood', s: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>' },
  { id: 'zap', n: '灵感', k: '灵感 闪电 能量', c: 'mood', s: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
  { id: 'eye', n: '看见', k: '看见 眼睛 观看', c: 'mood', s: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' },
  { id: 'sparkles', n: '闪亮', k: '闪亮 魔法 星光', c: 'mood', s: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>' },
  { id: 'paw', n: '宠物', k: '宠物 猫爪 爪子', c: 'mood', s: '<ellipse cx="12" cy="15.5" rx="4.5" ry="3.5"/><circle cx="6.5" cy="10" r="1.6"/><circle cx="10" cy="7.8" r="1.6"/><circle cx="14" cy="7.8" r="1.6"/><circle cx="17.5" cy="10" r="1.6"/>' },
  { id: 'award', n: '成就', k: '成就 奖牌 奖励', c: 'mood', s: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>' },
  { id: 'flag', n: '目标', k: '目标 旗帜 旗子', c: 'mood', s: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>' }
];
const BY_ID = {};
ICONS.forEach((it) => { BY_ID[it.id] = it; });
/* 功能位 → 默认图标（新增图标只加一行映射，不动渲染代码；桌面 app 图标不在此列）。 */
const SLOTS = [
  { id: 'phone', l: '电话', i: 'phone' }, { id: 'sms', l: '信息', i: 'message-circle' },
  { id: 'wechat', l: '微信', i: 'message-square' }, { id: 'camera', l: '相机', i: 'camera' },
  { id: 'album', l: '相册', i: 'image' }, { id: 'music', l: '音乐', i: 'music' },
  { id: 'notes', l: '备忘录', i: 'file-text' }, { id: 'calendar', l: '日历', i: 'calendar' }, /* GROUP-FIX7：改名日历 */
  { id: 'weather', l: '天气', i: 'cloud' }, { id: 'browser', l: '浏览器', i: 'globe' },
  { id: 'settings', l: '设置', i: 'settings' }, { id: 'guichao', l: '归巢', i: 'home' },
  { id: 'diary', l: '日记', i: 'book-open' }, { id: 'script', l: '剧本', i: 'film' },
  { id: 'novel', l: '小说', i: 'book' }, { id: 'cike', l: '此刻', i: 'clock' },
  { id: 'checkphone', l: '查手机', i: 'search' }
];
const SLOT_BY_ID = {};
SLOTS.forEach((s) => { SLOT_BY_ID[s.id] = s; });
/* D 批禁 emoji：24 个心情笑脸全部手绘 SVG（黄脸 + 眼睛/嘴/点缀参数化），不再用 emoji 字形；
   存的值从 emoji 字符改成笑脸 id，旧存值读不到时回落为空（只丢一次旧选择，不丢数据）。 */
const mojiSVG = (m, size) => {
  const s = size || 26;
  const ink = '#1e2748';
  let eyes = '', mouth = '', extra = '';
  if (m.eyes === 'dot') eyes = '<circle cx="8.5" cy="10" r="1.5" fill="' + ink + '"/><circle cx="15.5" cy="10" r="1.5" fill="' + ink + '"/>';
  else if (m.eyes === 'happy') eyes = '<path d="M6.5 10.5Q8.5 8 10.5 10.5M13.5 10.5Q15.5 8 17.5 10.5" stroke="' + ink + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
  else if (m.eyes === 'closed') eyes = '<path d="M6.5 10Q8.5 11.8 10.5 10M13.5 10Q15.5 11.8 17.5 10" stroke="' + ink + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
  else if (m.eyes === 'heart') eyes = '<path d="M8.5 11.5S5.8 9.4 5.8 7.9c0-1.2 1.6-1.8 2.7-.7 1-1.1 2.7-.5 2.7.7 0 1.5-2.7 3.6-2.7 3.6Z" fill="#e5484d"/><path d="M15.5 11.5S12.8 9.4 12.8 7.9c0-1.2 1.6-1.8 2.7-.7 1-1.1 2.7-.5 2.7.7 0 1.5-2.7 3.6-2.7 3.6Z" fill="#e5484d"/>';
  else if (m.eyes === 'star') eyes = '<path d="M8.5 5.5l.9 2 2 .3-1.5 1.4.4 2.1-1.8-1-1.8 1 .4-2.1-1.5-1.4 2-.3Z" fill="#f5b90a"/><path d="M15.5 5.5l.9 2 2 .3-1.5 1.4.4 2.1-1.8-1-1.8 1 .4-2.1-1.5-1.4 2-.3Z" fill="#f5b90a"/>';
  else if (m.eyes === 'cool') eyes = '<rect x="4.5" y="7.5" width="6" height="4" rx="1.5" fill="' + ink + '"/><rect x="13.5" y="7.5" width="6" height="4" rx="1.5" fill="' + ink + '"/><path d="M10.5 9.5h3" stroke="' + ink + '" stroke-width="1.6"/>';
  else if (m.eyes === 'wink') eyes = '<circle cx="8.5" cy="10" r="1.5" fill="' + ink + '"/><path d="M13.5 10.5Q15.5 8 17.5 10.5" stroke="' + ink + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
  else if (m.eyes === 'plead') eyes = '<circle cx="8.5" cy="10" r="2.1" fill="' + ink + '"/><circle cx="15.5" cy="10" r="2.1" fill="' + ink + '"/><circle cx="9.2" cy="9.3" r=".7" fill="#fff"/><circle cx="16.2" cy="9.3" r=".7" fill="#fff"/>';
  else if (m.eyes === 'angry') eyes = '<path d="M5.5 7.5 10 9.5M18.5 7.5 14 9.5" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/><circle cx="8.5" cy="11" r="1.3" fill="' + ink + '"/><circle cx="15.5" cy="11" r="1.3" fill="' + ink + '"/>';
  else if (m.eyes === 'think') eyes = '<circle cx="8.5" cy="10" r="1.5" fill="' + ink + '"/><path d="M13.5 8.5Q15.5 7 17.5 8.5" stroke="' + ink + '" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="15.5" cy="10.5" r="1.3" fill="' + ink + '"/>';
  else if (m.eyes === 'dizzy') eyes = '<path d="M6.5 8l4 4m0-4-4 4M13.5 8l4 4m0-4-4 4" stroke="' + ink + '" stroke-width="1.6" stroke-linecap="round"/>';
  else if (m.eyes === 'squint') eyes = '<path d="M6 10.5h5M13 10.5h5" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
  if (m.mouth === 'smile') mouth = '<path d="M8.5 14.5Q12 17.5 15.5 14.5" stroke="' + ink + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
  else if (m.mouth === 'laugh') mouth = '<path d="M7.5 13.5Q12 20 16.5 13.5Z" fill="' + ink + '"/>';
  else if (m.mouth === 'open') mouth = '<ellipse cx="12" cy="15.5" rx="1.8" ry="2.2" fill="' + ink + '"/>';
  else if (m.mouth === 'wail') mouth = '<ellipse cx="12" cy="15.5" rx="2.6" ry="3" fill="' + ink + '"/>';
  else if (m.mouth === 'frown') mouth = '<path d="M8.5 17Q12 14 15.5 17" stroke="' + ink + '" stroke-width="1.7" fill="none" stroke-linecap="round"/>';
  else if (m.mouth === 'flat') mouth = '<path d="M9 15.5h6" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round"/>';
  else if (m.mouth === 'tongue') mouth = '<path d="M8.5 14Q12 16.8 15.5 14" stroke="' + ink + '" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M10.5 15.2h3v2.6a1.5 1.5 0 0 1-3 0Z" fill="#f27d7d"/>';
  else if (m.mouth === 'kiss') mouth = '<circle cx="15.5" cy="15" r="1.6" fill="' + ink + '"/>';
  else if (m.mouth === 'small') mouth = '<path d="M9.5 15Q12 17 14.5 15" stroke="' + ink + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
  if (m.extra === 'tear') extra = '<path d="M18.5 12.5c.9.9 1.1 2.2.4 3.1-.6.8-1.9.8-2.5 0-.7-.9-.5-2.2.4-3.1Z" fill="#7db8e8"/>';
  else if (m.extra === 'tears') extra = '<path d="M5.5 12.5c.9.9 1.1 2.2.4 3.1-.6.8-1.9.8-2.5 0-.7-.9-.5-2.2.4-3.1Z" fill="#7db8e8"/><path d="M18.5 12.5c.9.9 1.1 2.2.4 3.1-.6.8-1.9.8-2.5 0-.7-.9-.5-2.2.4-3.1Z" fill="#7db8e8"/>';
  else if (m.extra === 'blush') extra = '<ellipse cx="6" cy="13.5" rx="1.8" ry="1.1" fill="#f2a0a0" opacity=".7"/><ellipse cx="18" cy="13.5" rx="1.8" ry="1.1" fill="#f2a0a0" opacity=".7"/>';
  else if (m.extra === 'halo') extra = '<ellipse cx="12" cy="3.2" rx="5" ry="1.6" fill="none" stroke="#f5b90a" stroke-width="1.6"/>';
  else if (m.extra === 'hearts') extra = '<path d="M19.5 5.5s-2-1.4-2-2.7c0-.9 1.2-1.3 2-.5.8-.8 2-.4 2 .5 0 1.3-2 2.7-2 2.7Z" fill="#e5484d"/>';
  else if (m.extra === 'hat') extra = '<path d="M12 1.5 16.5 6H7.5Z" fill="#8e4ec6"/><circle cx="12" cy="1.5" r="1" fill="#f5d90a"/>';
  return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ffd93b"/>' + extra + eyes + mouth + '</svg>';
};
const MOJI = [
  { id: 'happy', n: '开心', eyes: 'dot', mouth: 'smile', extra: 'blush' },
  { id: 'laugh', n: '大笑', eyes: 'happy', mouth: 'laugh', extra: 'tear' },
  { id: 'love', n: '喜欢', eyes: 'heart', mouth: 'smile', extra: 'blush' },
  { id: 'plead', n: '委屈', eyes: 'plead', mouth: 'small', extra: 'tear' },
  { id: 'sad', n: '难过', eyes: 'closed', mouth: 'frown', extra: 'tear' },
  { id: 'angry', n: '生气', eyes: 'angry', mouth: 'frown' },
  { id: 'sleepy', n: '困', eyes: 'closed', mouth: 'open' },
  { id: 'cool', n: '酷', eyes: 'cool', mouth: 'smile' },
  { id: 'think', n: '思考', eyes: 'think', mouth: 'flat' },
  { id: 'party', n: '庆祝', eyes: 'happy', mouth: 'laugh', extra: 'hat' },
  { id: 'sob', n: '大哭', eyes: 'closed', mouth: 'wail', extra: 'tears' },
  { id: 'smile', n: '微笑', eyes: 'happy', mouth: 'smile', extra: 'blush' },
  { id: 'playful', n: '调皮', eyes: 'wink', mouth: 'tongue' },
  { id: 'calm', n: '平静', eyes: 'closed', mouth: 'small' },
  { id: 'yummy', n: '馋', eyes: 'happy', mouth: 'tongue' },
  { id: 'hug', n: '抱抱', eyes: 'happy', mouth: 'smile', extra: 'hearts' },
  { id: 'starry', n: '星星眼', eyes: 'star', mouth: 'laugh' },
  { id: 'angel', n: '天使', eyes: 'dot', mouth: 'smile', extra: 'halo' },
  { id: 'sweet', n: '甜蜜', eyes: 'heart', mouth: 'smile', extra: 'hearts' },
  { id: 'kiss', n: '亲亲', eyes: 'wink', mouth: 'kiss', extra: 'hearts' },
  { id: 'tongue', n: '吐舌', eyes: 'wink', mouth: 'tongue' },
  { id: 'zany', n: '搞怪', eyes: 'dizzy', mouth: 'laugh' },
  { id: 'silly', n: '鬼脸', eyes: 'squint', mouth: 'tongue' },
  { id: 'tongue2', n: '调皮2', eyes: 'dot', mouth: 'tongue' }
];
const GLASS_PRESETS = [
  { id: 'soft', name: '柔和' }, { id: 'clear', name: '通透' },
  { id: 'frost', name: '磨砂' }, { id: 'tint', name: '暖调' }
];
const SOURCES = [
  { name: 'Tabler', lic: 'MIT', ver: '3.x', role: '首选字形来源' },
  { name: 'Phosphor', lic: 'MIT', ver: '2.x', role: '备选字形来源' },
  { name: 'Fluent', lic: 'MIT', ver: '9.x', role: '备选字形来源（只用 24 regular）' },
  { name: 'Lucide', lic: 'ISC', ver: '0.4x', role: '选形参考' },
  { name: 'IconPark', lic: 'Apache-2.0', ver: '1.4.x', role: '主题切换备选' },
  { name: 'OpenMoji', lic: 'CC BY-SA 4.0', ver: '15.x', role: '已不用：笑脸改手绘 SVG' }
];
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const _read = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return (v === null || v === undefined) ? dflt : v; } catch (e) { return dflt; } };
const _write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
const defaults = () => {
  const picks = {};
  SLOTS.forEach((s) => { picks[s.id] = { icon: s.i, stroke: 2, filled: false }; });
  return { v: 1, picks: picks, glass: { style: 'default', preset: 'soft' }, moji: '' };
};
const load = () => {
  const d = defaults();
  const raw = _read(KEY, null);
  if (raw && typeof raw === 'object') {
    if (raw.picks && typeof raw.picks === 'object') {
      Object.keys(raw.picks).forEach((slotId) => {
        const p = raw.picks[slotId];
        if (p && BY_ID[p.icon] && SLOT_BY_ID[slotId]) {
          d.picks[slotId] = { icon: p.icon, stroke: [1.5, 2, 2.5].indexOf(Number(p.stroke)) >= 0 ? Number(p.stroke) : 2, filled: !!p.filled };
        }
      });
    }
    if (raw.glass && typeof raw.glass === 'object') {
      if (raw.glass.style === 'glass' || raw.glass.style === 'default') d.glass.style = raw.glass.style;
      if (GLASS_PRESETS.some((g) => g.id === raw.glass.preset)) d.glass.preset = raw.glass.preset;
    }
    if (typeof raw.moji === 'string' && MOJI.some((m) => m.id === raw.moji)) d.moji = raw.moji;
  }
  return d;
};
const save = (d) => _write(KEY, d);
const getPick = (slotId) => load().picks[slotId] || null;
const setPick = (slotId, iconId) => {
  if (!SLOT_BY_ID[slotId] || !BY_ID[iconId]) return false;
  const d = load();
  d.picks[slotId].icon = iconId;
  return save(d);
};
/* 共用 svg 外壳：单色符号 + currentColor（深色/浅色主题下跟主题换色）；填充档描边收起。 */
const iconSVG = (id, opts) => {
  const it = BY_ID[id];
  if (!it) return '';
  const o = Object.assign({ size: 24, stroke: 2, filled: false }, opts || {});
  const size = Math.max(12, Math.min(96, Number(o.size) || 24));
  if (o.filled) return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" stroke="none" aria-hidden="true">' + it.s + '</svg>';
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="' + o.stroke + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it.s + '</svg>';
};
/* 图标 tile：字形与背景分离，换风格只换模板、不重存图标；默认软圆角纯色，玻璃是可选。 */
const tileHTML = (iconId, opts) => {
  const o = Object.assign({}, opts || {});
  const d = load();
  const g = d.glass;
  const cls = 'aq-tile' + (o.small ? ' aq-tile-sm' : '') + (g.style === 'glass' ? ' aq-glass aq-glass-' + g.preset : '');
  return '<span class="' + cls + '">' + iconSVG(iconId, o) + '</span>';
};
const glassLabel = (d) => (d.glass.style === 'glass' ? 'Liquid Glass · ' + (GLASS_PRESETS.find((g) => g.id === d.glass.preset) || {}).name : '默认（软圆角纯色）');
const pickerSummaryHTML = () => {
  const d = load();
  const demo = ['phone', 'wechat', 'guichao', 'diary', 'cike', 'checkphone'].map((slotId) => {
    const p = d.picks[slotId] || {};
    return tileHTML(p.icon || slotId, { size: 20, stroke: p.stroke || 2, filled: !!p.filled, small: true });
  }).join('');
  return '<div class="gw-set-row"><div class="lb">当前图标风格<div class="sub">' + esc(glassLabel(d)) + ' · 只存图标 ID，换风格不用重存。</div></div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;padding:2px 0 8px">' + demo + '</div>';
};

/* ── 挑选器页（st-sub 规范，与 W 组桌面与外观页同一切换链）── */
let _selSlot = 'phone';
let _cat = 'all';
let _kw = '';
const filteredIcons = () => {
  const kw = _kw.trim().toLowerCase();
  return ICONS.filter((it) => {
    if (_cat !== 'all' && it.c !== _cat) return false;
    if (!kw) return true;
    return (it.n + ' ' + it.k + ' ' + it.id).toLowerCase().indexOf(kw) >= 0;
  });
};
const gridHTML = () => {
  const list = filteredIcons();
  if (!list.length) return '<div class="aq-note">没有 matching 的图标，换个关键词试试（只在 60 个精选图标里搜，离线可用）。</div>';
  const d = load();
  const cur = (d.picks[_selSlot] || {}).icon;
  return '<div class="aq-grid" id="aq-grid">' + list.map((it) =>
    '<button class="aq-ico-btn' + (cur === it.id ? ' on' : '') + '" data-aq-icon="' + esc(it.id) + '" title="' + esc(it.n) + '">'
    + iconSVG(it.id, { size: 22, stroke: 2 }) + '<span>' + esc(it.n) + '</span></button>'
  ).join('') + '</div>';
};
const pickerBodyHTML = () => {
  const d = load();
  const slot = SLOT_BY_ID[_selSlot] || SLOTS[0];
  const pick = d.picks[_selSlot] || { icon: slot.i, stroke: 2, filled: false };
  const catSeg = '<div class="aq-seg">' + CATS.map((c) =>
    '<button data-aq-cat="' + esc(c.id) + '" class="' + (_cat === c.id ? 'on' : '') + '">' + esc(c.name) + '</button>').join('') + '</div>';
  const slotSeg = '<div class="aq-seg">' + SLOTS.map((s) =>
    '<button data-aq-slot="' + esc(s.id) + '" class="' + (_selSlot === s.id ? 'on' : '') + '">' + esc(s.l) + '</button>').join('') + '</div>';
  const strokeSeg = '<div class="aq-seg">' + [[1.5, '细'], [2, '标准'], [2.5, '粗']].map((w) =>
    '<button data-aq-stroke="' + w[0] + '" class="' + (pick.stroke === w[0] ? 'on' : '') + '">' + w[1] + '</button>').join('')
    + '<button data-aq-fill="1" class="' + (pick.filled ? 'on' : '') + '">填充</button></div>';
  const styleSeg = '<div class="aq-seg">'
    + '<button data-aq-style="default" class="' + (d.glass.style === 'default' ? 'on' : '') + '">默认（软圆角纯色）</button>'
    + '<button data-aq-style="glass" class="' + (d.glass.style === 'glass' ? 'on' : '') + '">Liquid Glass</button></div>';
  const presetSeg = '<div class="aq-seg">' + GLASS_PRESETS.map((g) =>
    '<button data-aq-preset="' + esc(g.id) + '" class="' + (d.glass.preset === g.id ? 'on' : '') + '"' + (d.glass.style === 'glass' ? '' : ' disabled') + '>' + esc(g.name) + '</button>').join('') + '</div>';
  const wallDemo = '<div class="aq-wall-demo">' + ['phone', 'wechat', 'guichao', 'diary', 'cike', 'checkphone'].map((slotId) => {
    const p = d.picks[slotId] || {};
    return tileHTML(p.icon, { size: 22, stroke: p.stroke || 2, filled: !!p.filled });
  }).join('') + '<span style="font-size:13px;color:var(--st-ink-60,rgba(30,39,72,.6))">壁纸上的玻璃效果预览（磨砂化只在有壁纸的桌面上看得出来）</span></div>';
  const mojiSeg = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' + MOJI.map((m) =>
    '<button class="aq-moji-btn' + (d.moji === m.id ? ' on' : '') + '" data-aq-moji="' + esc(m.id) + '" title="' + esc(m.n) + '">' + mojiSVG(m, 26) + '</button>').join('') + '</div>';
  return '<div class="gw-set-h">功能位</div>'
    + '<div class="aq-note" style="margin-top:0">先选一个功能位，再点下面的图标换上；桌面 app 图标即取自本字典（GROUP-FIX2）：这里换图标会同步到桌面对应 app。</div>'
    + slotSeg
    + '<div class="gw-set-row"><div class="lb">当前：' + esc(slot.l) + '<div class="sub">图标 ' + esc((BY_ID[pick.icon] || {}).n || pick.icon) + ' · 描边 ' + pick.stroke + (pick.filled ? ' · 填充' : ' · 描边') + '</div></div>' + tileHTML(pick.icon, { size: 22, stroke: pick.stroke, filled: pick.filled }) + '</div>'
    + '<div class="gw-set-h">搜图标</div>'
    + '<input id="aq-search" type="search" placeholder="搜图标：电话、音乐、天气…" value="' + esc(_kw) + '" style="width:100%;box-sizing:border-box;border:1px solid var(--st-silver,#bfc8e0);border-radius:var(--st-radius-md,8px);padding:8px 12px;font-size:17px;background:var(--st-paper,#fffdf8);color:var(--st-ink,#1e2748)">'
    + catSeg + gridHTML()
    + '<div class="gw-set-h">变体</div>'
    + '<div class="aq-note" style="margin-top:0">同一图标 3 档描边 + 填充开关，换变体不换图标 ID，localStorage 里还是只存一个 ID。</div>'
    + strokeSeg
    + '<div class="gw-set-h">图标风格</div>'
    + '<div class="aq-note" style="margin-top:0">Liquid Glass 只是可选风格，默认不启用；纯 CSS（渐变 + 高光 + 边缘光 + backdrop-filter 磨砂），没有真折射，省电。</div>'
    + styleSeg + presetSeg + wallDemo
    + '<div class="gw-set-h">心情笑脸（手绘 SVG）</div>'
    + '<div class="aq-note" style="margin-top:0">只挑 24 个高频心情，供小组件 / 快捷方式 / 心情 / 日记点缀用；笑脸全部手绘 SVG，不用 emoji 字形。</div>'
    + mojiSeg
    + '<div class="gw-set-h">来源</div>'
    + '<div class="aq-note">' + SOURCES.map((s) => esc(s.name) + '（' + esc(s.lic) + '）· ' + esc(s.role)).join('<br>') + '<br>桌面 app 图标取自本字典（GROUP-FIX2）。</div>'
    + '<div style="margin:16px 0 30px"><button data-aq-reset="1" style="width:100%;border:1px solid var(--st-silver,#bfc8e0);background:var(--st-paper,#fffdf8);border-radius:var(--st-radius-md,8px);padding:12px;font-size:17px;color:var(--st-danger, #7c2d2d)">恢复全部默认图标与风格</button></div>';
};
const renderPickerBody = () => {
  const body = document.getElementById('aq-picker-body');
  if (body) body.innerHTML = pickerBodyHTML();
};
const openPicker = (sub) => {
  try {
    let host = (sub && sub.parentElement) || document.getElementById('st-root');
    if (!host) host = document.body;
    let pk = host.querySelector('#st-sub-aq-picker');
    if (pk) { renderPickerBody(); return true; }
    const tmp = document.createElement('div');
    tmp.innerHTML = '<div class="st-sub" id="st-sub-aq-picker">' + stSubBar('图标挑选器') + '<div id="aq-picker-body" style="padding:0 16px 32px"></div></div>';
    pk = tmp.firstElementChild;
    host.appendChild(pk);
    pk.addEventListener('click', (e) => {
      if (e.target.closest('[data-back]')) { if (pk.parentNode) pk.parentNode.removeChild(pk); return; }
      const catBtn = e.target.closest('[data-aq-cat]');
      if (catBtn) { _cat = catBtn.getAttribute('data-aq-cat'); renderPickerBody(); return; }
      const slotBtn = e.target.closest('[data-aq-slot]');
      if (slotBtn) { _selSlot = slotBtn.getAttribute('data-aq-slot'); renderPickerBody(); return; }
      const icoBtn = e.target.closest('[data-aq-icon]');
      if (icoBtn) { setPick(_selSlot, icoBtn.getAttribute('data-aq-icon')); renderPickerBody(); return; }
      const stBtn = e.target.closest('[data-aq-stroke]');
      if (stBtn) { const d = load(); d.picks[_selSlot].stroke = Number(stBtn.getAttribute('data-aq-stroke')); save(d); renderPickerBody(); return; }
      const fillBtn = e.target.closest('[data-aq-fill]');
      if (fillBtn) { const d = load(); d.picks[_selSlot].filled = !d.picks[_selSlot].filled; save(d); renderPickerBody(); return; }
      const styleBtn = e.target.closest('[data-aq-style]');
      if (styleBtn) { const d = load(); d.glass.style = styleBtn.getAttribute('data-aq-style'); save(d); renderPickerBody(); return; }
      const preBtn = e.target.closest('[data-aq-preset]');
      if (preBtn && !preBtn.disabled) { const d = load(); d.glass.preset = preBtn.getAttribute('data-aq-preset'); save(d); renderPickerBody(); return; }
      const mojiBtn = e.target.closest('[data-aq-moji]');
      if (mojiBtn) { const d = load(); d.moji = (d.moji === mojiBtn.getAttribute('data-aq-moji')) ? '' : mojiBtn.getAttribute('data-aq-moji'); save(d); renderPickerBody(); return; }
      if (e.target.closest('[data-aq-reset]')) { save(defaults()); _cat = 'all'; _kw = ''; _selSlot = 'phone'; renderPickerBody(); return; }
    });
    pk.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'aq-search') {
        _kw = e.target.value || '';
        renderPickerBody();
        const inp = document.getElementById('aq-search');
        if (inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (err) {} }
      }
    });
    renderPickerBody();
    requestAnimationFrame(() => { try { pk.classList.add('show'); } catch (err) {} });
    return true;
  } catch (e) { return false; }
};

return {
  KEY: KEY, CATS: CATS, ICONS: ICONS, SLOTS: SLOTS, MOJI: MOJI,
  GLASS_PRESETS: GLASS_PRESETS, SOURCES: SOURCES,
  iconSVG: iconSVG, tileHTML: tileHTML, load: load, save: save,
  getPick: getPick, setPick: setPick, openPicker: openPicker,
  pickerHTML: pickerBodyHTML, pickerSummaryHTML: pickerSummaryHTML,
  resetAll: () => save(defaults()),
  counts: () => ({ icons: ICONS.length, moji: MOJI.length, slots: SLOTS.length })
};
})();

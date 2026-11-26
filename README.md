# 小未来的手机 · 分文件版

这是 `小未来的手机_微信此刻版.html` 的分文件源码（基底 md5 `aa48b25d673669076f7447929000f21a`，
2026-11-26 22 项功能批产物，79,543 行）。GitHub Pages 直接跑这一版；单文件离线版由
`build/build.py` 从这里拼出来。

## 目录

```
split-new/
├── index.html            # 入口骨架: 只含 head + 挂载点 + 按顺序引用的 css/js
├── css/                  # 33 个样式文件 (原文件里的 33 个 <style> 块, 一块一文件)
├── js/                   # 60 个脚本文件 (原文件里的 60 个内联 <script> 块, 一块一文件)
├── build/
│   ├── build.py          # 打包脚本 (纯 Python 3 标准库): 拼回单文件版并自验
│   ├── build.config.json # 拼接顺序清单 + 每块的来源行/字节/md5 (顺序的唯一来源)
│   └── split.py          # 本次拆分用的拆分器 (一次性, md5 门控)
├── dist/
│   └── 小未来的手机_微信此刻版.html  # 打包产物 (与基底逐字节一致, md5 已验)
├── tests/
│   └── smoke_split.js    # 拆分版冒烟测试 (本地 HTTP 服务加载, jsdom)
├── MANIFEST.md           # 拆分清单: 每块 → 文件的对照表
└── README.md             # 本文件
```

## 在 GitHub Pages 上跑

直接把本目录内容推到仓库根目录即可。`index.html` 用相对路径引用
`css/...` / `js/...`，在项目子路径（`username.github.io/xiaoweilai-phone/`）下能直接跑，
不用改任何路径。

本地预览：

```bash
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/index.html
```

（`file://` 直接打开也能加载 `<script src>` / `<link>`，但 Pages 是正式支持的形态。）

## 打回单文件版

```bash
python3 build/build.py
# 产物: dist/小未来的手机_微信此刻版.html
# 脚本自验: md5 / 字节数 / 行数 / 块计数与基底一致, 60 个 js 文件 node --check 通过,
# 任一失败即退出码 1 且不写出坏产物。
```

## 数据迁移（重要，先看）

**localStorage / IndexedDB 不会自动跟着走。** 手机上现有数据存在 `file://` 源下；
Pages 版是另一个源，首次打开是干净的默认状态（空白头像、空名字、空联系人）。

迁移办法（已有整屋备份导入流程，幂等、不重复）：

1. 在手机单文件版里导出「整屋备份」；
2. 在 Pages 版里导入这份备份。

日历小组件、home 小组件、音频、VRM 模型存在 IndexedDB（库 `xiaoweilai`，
表 `calendar_marks` / `calendar_notes` / `calendar_meta` / `widget_assets` /
`audio_blobs` / `vrm_models`），随整机备份走（音频 >10MB 时备份会明说排除；
VRM 只备元数据，blob 需重导；归档快照只含 localStorage）。

## 拆分原则

- **只拆文件，不改逻辑**：不改任何功能、不改 localStorage 键、不改 app 注册名、
  不改执行顺序、不改用户数据。`<script>` 按原顺序加载，不用 ES module，
  不加 `defer` / `async`（supabase 那个外链自带的 `defer` 原样保留）。
- 一文件一块：33 css + 60 js，内容字节一字不动；`build.config.json` 是顺序的唯一来源。

## 与拆分方案的偏离（有意为之，附原因）

原方案在 `~/workspace/xiaoweilai/拆分方案_分文件与单文件打包.md`。以下三处为保
证「只拆文件，不改逻辑」与可验证性而偏离原方案的语义合并布局：

1. **一文件一块，而非按 app 语义合并**（原方案的 `tokens.css` / `wechat.css` /
   `kernel.js` / `apps/wechat.js` 等）。合并后要拼回逐字节一致的单文件，
   得在 `build.py` 里再按标记切分，风险大；一文件一块让拼回产物与基底
   md5 完全一致（已验证），GROUP 对照见 `MANIFEST.md`。语义合并可日后
   另做一次重构。
2. **`assets/` 与 `apps-embedded/` 未抽出**：`data:image`（171 处）、`GC_B64`（3 处）、
   `srcdoc`（15 处）全部留在原块内。抽出要改 JS 加载方式（异步取文件代替内联），
   是逻辑改动；iframe 从 `srcdoc` 改 `src` 真实文件还会改同源 localStorage
   与返回键行为（原方案风险 4 自己也标了这一点）。拆分版照样跑在 Pages 上，
   因为这些资源仍内联在加载的 js/css 文件里。
3. **supabase-js CDN 标签保留原样**（原方案 §八第 3 点待确认）：不擅自删，
   文件本身已有 `onerror="window._supabaseLoadFailed=true"` 的离线降级。

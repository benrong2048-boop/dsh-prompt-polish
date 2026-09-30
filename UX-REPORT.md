# 验收报告：prompt-polish 面板 UI/UX + 性能系统优化

准绳：docs.always200.com（prompt-optimizer 官方文档），38/39 页通读。
证据：487 项断言全绿（mustache 34 / smoke 219 / contract 70 / host 164）+ 模板 10/10 与上游逐字节一致 + install.ps1 全管线通过并已同步进 profile。
生效方式：**完整重启 DSH 应用**（本 shell 未绑定 Ctrl+R，也没跑 dev:web watcher；本轮 host 与 client 两半都有改动）。

## 0. 准绳采纳情况（诚实披露）

- `basic/models/` 是唯一没读到的页：web_fetch 三次经代理 403（SignatureDoesNotMatch），pwsh 直连传输 EOF。其主题（模型接入/启用）已被 quick-start 与 troubleshooting 覆盖，本轮采纳的条款没有盲区。
- 从文档提炼、本轮落地的 5 条行为准绳：
  - **D1** quick-start 第 3 步：结果工作区带复制按钮 → 结果区新增「复制草稿」。
  - **D2** quick-start：「优化提示词 暂时保留默认的 专业优化」→ 用户族默认模板 = 专业优化。
  - **D3** troubleshooting：优化按钮在提示词为空/模型未启用时置灰，且置灰必须可解释 → 三类禁用原因写进 title。
  - **D4** 图像工作区结果卡：token 元数据 + 推理耗时 → 结果元信息「模型 · 耗时 · 字数 · tok」。
  - **D5** 性能要区分「模型响应慢」与「应用卡」→ 应用侧只砍渲染次数与网络往返；模型耗时做成可见元信息。

## 1. 性能优化

### 1.1 慢的定位

测量工具 `bench.mjs`（可随时重跑）。四组基准的结论：

| 环节 | 测量 | 结论 |
|---|---|---|
| 首屏（座位按钮注入工具条） | bundle eval 0.4–0.5ms | 不慢 |
| Host 冷导入 | 6–10ms（进程噪声带） | 不慢 |
| 打开面板 | 每次挂载 1 次 /models 网络往返 | **可优化** |
| 点击按钮 → 流开始 | 目录组装 ~16µs、构消息 ~3.6µs/模板 | 不慢 |
| **流式生成期间** | **每个 delta 一次全板渲染：300 deltas = 310 renders** | **真卡点** |
| 模型响应本体 | 秒级，应用不可控 | 做成可见（D5），不假装优化 |

### 1.2 前后数据（同一基准：300 deltas @4ms/delta）

| 指标 | 改造前 | 改造后 | 变化 |
|---|---|---|---|
| 流式期间全板渲染次数 | **310** | **73** | **−76%** |
| 重开面板网络请求 | 1 次/挂载 | 0 次（30s 缓存内） | 往返消除 |
| bundle 体积 / eval | 28.6KB / 0.51ms | 38.0KB / 0.54ms | +9.4KB 为规范注释与新交互，无感 |
| 基准 wall time | 4717ms | 4647ms | ≈不变（见下） |

两点诚实说明：

1. **wall time 不变是预期内的**：该基准的瓶颈是 token 到达速率（假流 sleep），渲染负担本就不在关键路径上。−76% 渲染在真实 GUI 里的收益是**生成期间主线程不再被渲染霸占**——滚动结果区、在输入框打字、移动鼠标不再顿挫。这正是 D5 里「应用卡」的那一半被消除；「模型慢」的那一半现在由元信息里的耗时明示。
2. B1/B2/B3 的前后波动（如冷导入 10.35→6.7ms）是进程级噪声；这些 µs/ms 级环节本来就不是瓶颈，不计为收益。

### 1.3 修改内容

**(a) 流式合帧节流 60ms** — `lib/client.js` `run()`：

```js
var flushTimer = null;
stream(body, function(text) {
    carried += text;
    if (flushTimer === null) {
        flushTimer = setTimeout(function() {
            flushTimer = null;
            setResult(carried);   // 至多每 60ms 一次全板渲染
        }, 60);
    }
}, controller.signal).then(function(out) {
    dropFlush();
    setResult(out.text);          // 终态无条件写最终文本
    ...
```

done / abort / error 三条终态路径都 `clearTimeout` 并写最终文本——节流只影响中间帧，不可能吃掉尾巴或损失准确性。abort 路径还额外保留了已到达的部分结果（含未 flush 的尾巴）。

**(b) 目录模块级缓存**（30s TTL + 同飞请求合并 + 失败不缓存）：

```js
var CATALOG_TTL_MS = 30000;
function loadCatalog() {
    if (catalogCache !== null && Date.now() - catalogCache.at < CATALOG_TTL_MS)
        return Promise.resolve(catalogCache.data);
    if (catalogInflight === null) { catalogInflight = fetchModels().then(/* 填缓存 */, /* 清 inflight 再抛 */); }
    return catalogInflight;
}
```

**(c) usage chunk 透传** — `lib/index.js`：宿主 `StreamChunk` 联合里有专门的 `{type:"usage"}` chunk，此前被丢弃：

```js
if (chunk.type === "usage") { usage = chunk.usage; continue; }
...
emit({ type: "done", text: cleaned, model, truncated,
       usage: usage == null ? void 0 : { inputTokens: usage.inputTokens,
                                         outputTokens: usage.outputTokens,
                                         totalTokens: usage.totalTokens } });
```

### 1.4 预期收益

- 生成期间主线程渲染负担 −76%；推理模型高速吐 token（50–100 tok/s）时输入/滚动不卡。
- 30s 内重开面板从 1 次网络请求降为 0；两个 composer 同时挂载不再打两次 /models。
- 耗时与 token 可见，用户能自行区分「模型慢」与「应用卡」。

## 2. 按钮视觉与交互协调性（核心问题）

### 2.1 统一规范

已作为注释写死在 `lib/client.js` CSS 段头部；颜色全部走 `--dsw-*` 主题令牌，零手写色值：

| 层级 | 控件 | 高度 | 圆角 | 字号 | 内边距 |
|---|---|---|---|---|---|
| 主动作 | `.pp-btn[data-primary]`（替换草稿） | 28 | 8 | 12 / 600 | 0 12 |
| 普通动作 | `.pp-btn`（开始优化/停止/重新生成/发送草稿/提取变量/写回模板） | 28 | 8 | 12 | 0 12 |
| 小动作 | `.pp-mini`（复制草稿，结果区） | 24 | 7 | 11.5 | 0 8 |
| 页签 | `.pp-tab` | 26 | 14（胶囊） | 12 | 0 10 |
| 选择器 | `.pp-sel`（两处） | 28 | 8 | 11.5 | 0 6 |

间距：按钮间 gap 8px；所有控件 `line-height = 高度 − 2px 边框`，文字垂直居中不跳动。

状态矩阵（每个按钮五态齐全）：

| 状态 | ghost 按钮 | primary 按钮 |
|---|---|---|
| 默认 | bg-base + border-l1 | brand-primary 黑底白字加粗 |
| hover | bg-layer-2 + border-l2 | `filter:brightness(1.14)` |
| active | bg = border-l1 | `brightness(.88)` |
| disabled | `opacity:.45; cursor:not-allowed` + **title 说明原因** | 同左 |
| focus-visible | 2px brand-primary 外圈 | 同左 |

过渡统一 `.12s ease`（background/border-color/color/filter）。

### 2.2 「替换草稿」吞字（点名 bug）

- **现状与根因**：`.pp-foot` 是 560px 面板里的 flex 行，左侧 meta（长模型名）+ 选择器，右侧最多 5 个按钮。旧 `.pp-btn` 既无 `white-space:nowrap` 也无 `flex:0 0 auto`——空间不足时按钮被 flex 压缩、文字折行，而高度定死 28px，第二行被裁掉 → 「吞字」。按钮越多越严重（提取变量完成后正是 5 按钮态）。
- **修改**：

```css
.pp-meta{...flex:0 1 auto;min-width:0;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-btn{...line-height:26px;white-space:nowrap;flex:0 0 auto;...}
.pp-sel{...flex:0 1 auto;min-width:72px;max-width:190px;...}
```

  策略：**按钮永不压缩、永不折行**；可压缩的负担移交给 meta（省略号 + 全文进 title 提示）与选择器（最低压到 72px）。
- **效果**：任何窗口宽度、任何按钮数量下「替换草稿」四字完整；同规则集同时治好兄弟按钮（发送草稿/提取变量/写回模板/停止）；meta 信息不丢（悬停可见全文）。布局与功能保持原样。

### 2.3 其他「按钮不好看」症状清单与修复

| 症状 | 现状 | 修复后 |
|---|---|---|
| 配色不统一 | 手写颜色混用 | 全走 `--dsw-*` 令牌，随主题自动 |
| 层级不清晰 | 主按钮不突出 | 唯一 brand-primary 黑底 = 替换草稿；其余全部 ghost |
| hover 缺失 | 悬停无反馈 | 五态矩阵全覆盖（primary 用 brightness 渐变） |
| disabled 缺失/无解释 | 灰了但不知道为什么 | `.45` 透明度 + not-allowed + **title 写明缺什么前提**（D3） |
| 键盘焦点不可见 | 无 focus 样式 | `:focus-visible` 2px 品牌色 outline（含 tabs/关闭钮/选择器） |
| 对齐错位 | 行高不一垂直跳动 | `line-height = 高度 − 边框` 统一 |
| 页签无按压态 | `.pp-tab` 只有选中态 | 补 hover/active/disabled + nowrap 防折行 |
| 关闭钮 × 可被挤压 | 窄窗口变形 | `flex:0 0 auto` |

### 2.4 可解释禁用（D3 落地）

```js
var runBlock = template === null ? "模板目录还没载入"
    : sourceNow.trim() === "" ? "输入框里还没有内容可润色"
    : mode === "iterate" && feedback.trim() === "" ? "先填改进意见，再点开始迭代" : "";
// <button disabled={!canRun} title={canRun ? "按当前模板生成一版新的" : runBlock}>
```

「提取变量」在提取中同样置灰并变文案「提取中…」，防重复点击。迭代说明文案与行为矛盾（原文案称"留空则仅重新生成一次"，实际会被拒绝）→ 改为「必填：说明这次要改什么」。

## 3. 复制草稿按钮（点名保留）

先把三个相关按钮的历史理清——**零删除、零行为变更**：

| 按钮 | 位置 | 行为 | 本轮状态 |
|---|---|---|---|
| 发送草稿（即用户最初要求的「复制草稿」写回并发送，此前已按要求改名） | footer | 写回输入框 + 立即发送 | **原样保留** |
| 替换草稿 | footer（主按钮） | 只写回输入框，不发送 | **原样保留**（只修了吞字） |
| 复制草稿（新增，= 文档 D1 的结果工作区复制按钮） | 结果区右上工具条 | 只写剪贴板，不动草稿、不发送 | **新增** |

```js
navigator.clipboard.writeText(result).then(mark, legacy);  // legacy = textarea + execCommand 兜底
// 成功 → 按钮变「已复制 ✓」，1.5s 后复原；失败 → 错误条提示手动选中复制
```

contract 测试钉死：复制文本 === 结果文本，且 setDraft/submit 调用数为 0。

## 4. 其他文档准绳对齐

| # | 项 | 现状 → 修改后 |
|---|---|---|
| D2 | 默认模板 | user 族取注册表序第一个（基础优化）→ host 下发 `catalog.defaults`（system=general-optimize / **user=user-prompt-professional** / iterate=iterate），client 只跟随、零硬编码；`PREFERRED_DEFAULTS` 仅在 id 真实存在于族内时生效（删模板自动退回旧规则）。旧 host 未重启时 client 优雅降级为旧行为 |
| D4 | 结果元信息 | 「模型 X」→「模型 X · 耗时 Y.Ys · N 字 · tok in→out」。usage 仅当 provider 上报时出现；耗时在完成时一次性计算（`Date.now()-startedAt`），**无滴答计时器** |
| D1 | 结果区复制 | 见第 3 节 |

## 5. 已优化项（逐项验收清单）

1. ✅ 流式渲染 60ms 合帧（310 → 73 次全板渲染，−76%）
2. ✅ 目录 30s 缓存 + 同飞去重（重开面板 0 请求）
3. ✅ usage chunk host→client 透传（此前被丢弃）
4. ✅ 结果元信息：模型 + 耗时 + 字数 + token
5. ✅ 按钮五态规范 + 全令牌化配色 + 三档尺寸统一（28/26/24）
6. ✅ 「替换草稿」吞字修复（nowrap + flex-none + meta 省略 + sel 可压缩）
7. ✅ 主按钮层级唯一化 + brightness hover/active
8. ✅ focus-visible 键盘焦点圈（全部可交互控件）
9. ✅ 可解释禁用：开始优化三类原因进 title；提取变量提取中置灰 +「提取中…」
10. ✅ 结果区「复制草稿」（D1）+「已复制 ✓」反馈 + execCommand 兜底
11. ✅ 默认模板 = 专业优化（D2，host 下发、client 零硬编码）
12. ✅ 迭代说明文案与行为矛盾修复
13. ✅ 发送草稿 / 替换草稿 / 复制草稿 三按钮并存，零删除、零行为变更
14. ✅ 测试基建：vm 沙箱补齐浏览器全局（setTimeout/clearTimeout/navigator）+「成功运行不得出现 pp-err」反掩盖断言——它暴露并修复了一个真实 harness bug（沙箱缺 setTimeout 时全部假流静默改走 error 路径而断言照过）
15. ✅ 文档同步：README 新增「面板行为（文档准绳）」章节、测试数更新、install.ps1 语法清单补 templates-generated.js、重启说明与实际环境对齐

## 6. 未处理 / 待确认项

1. **分析动作 + 版本链（原始/工作区/vN）+ 多列对比测试**：上游文档有的能力，本插件从未实现；属功能扩展，超出本轮「UI/UX + 性能」范围——是否立项**待确认**。
2. **tok 显示依赖 provider**：宿主流里没有 usage chunk 时，元信息自动省略 tok 段（耗时/字数不受影响），不是 bug。
3. **真实 GUI 首屏/网络实测**：需重启应用后人工确认；bench 是等效负载，数字见 1.2。
4. **`basic/models/` 文档页不可达**：403×3 + 传输 EOF×1；主题已被其他页覆盖，无采纳盲区。
5. **生效需要完整重启 DSH 应用**：host（index.js/prompts.js）与 client（client.js）两半本轮都有改动。
6. **面板宽度 560px 未动**（按要求布局不变）：按钮全开时 meta 会以省略号截断，全文在 title 提示里；若希望 meta 永远全显，需要把 footer 改成两层——**待确认**。

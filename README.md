# dsh-prompt-polish

DSH 输入框里的「随时润色提示词」按钮，位置在**模型选择器的左侧**。
优化逻辑移植自 [`linshenkx/prompt-optimizer`](https://github.com/linshenkx/prompt-optimizer)（AGPL-3.0）：
模板文本逐字保留，`optimizationMode` 轴与消息形状按上游结构实现。移植范围见文末「未移植」。

## 为什么需要它，值不值得用

**它解决的问题**：你知道想让模型做什么，但草稿里只有一句话——没角色、没背景、没输出形式，
结果答得平平。每次都手写"角色/目标/约束/格式"太累，这个按钮替你把这些结构补上，你看一眼再决定用不用。

**一次润色花什么**：

| 花费 | 说明 |
| --- | --- |
| 一次模型调用 | 每点一次润色 = 一次流式调用；迭代优化、提取变量各自再算一次。打开面板不花钱，后台也不会偷偷跑 |
| token | 输入（草稿+模板）+ 输出（优化稿），典型几百个 token；结果区直接显示"本次 N 输入 + M 输出 = T tokens"，模型没上报就写"未提供"，绝不显示假 0 |
| 等待 | 模型速度决定，面板如实显示耗时，不假装"秒出" |

**它不会做什么**：不会自动发送（替换草稿只写回输入框，发送必须你点）；不会偷偷存历史
（首次明确询问，选"不保存"就一条不存且不再问）；不会把你的提示词变华丽但丢信息——
模板明确要求保留你的原意与占位符。

**什么时候别用它**：草稿已经写全了角色/约束/格式；粘贴的代码不想被"润色"；所在环境按 token 计费
且你在意这点开销。

## 两个真实例子

以下都是本插件实际产出、真实使用过的记录——先看你原本怎么说，再看润色后模型拿到什么。

### 例子一：一句口语反馈 → 七条可执行要求

**你的输入**

> 你不要僵硬，实际都是以具体内容为准的。你的目的在于梳理该章节的内容，以思维导图的形式呈现。

**点一次 ✨ 后，模型拿到的是**

> 请以我提供的章节具体内容为唯一依据，梳理该章节的内容结构，并输出为思维导图。要求如下：
>
> 1. 不要套用固定模板、预设框架或僵化层级；章节实际讲了什么，就按什么逻辑拆分。
> 2. 中心主题：使用章节标题或能够概括全章的核心主题。
> 3. 一级分支：依据章节的主要部分、核心论点、关键问题或内容板块划分，数量随内容而定，通常为 3—7 个，不强行凑数。
> 4. 下级分支：按分类、因果、流程、对比、例证、并列关系等实际逻辑展开；内容简单时可只到二级，内容复杂时可扩展至三级或四级。
> 5. 节点表述：使用简洁的名词短语或短句，保留原文关键术语和核心概念；不添加原文没有的信息，不遗漏重要内容。
> 6. 输出形式：使用 Markdown 嵌套列表或缩进大纲呈现，清晰体现父子层级关系，便于直接转换为思维导图。
> 7. 若章节内容存在多种合理梳理方式，优先选择最贴合原文结构、最便于理解的一种；必要时可在节点后括注原文依据或关键词。

**差别在哪**：原话里"不要僵硬"是口语，模型各自理解、全看运气；润色后是七条可执行要求——
依据唯一、结构随内容、分支数量、层级深度、节点表述、输出形式、多种方案的取舍规则。
任务越复杂，这种差别越值钱。

### 例子二：一句"帮我看看" → 一份评审任务书

**你的输入**

> 我是想让你从产品经理的角度，看看我们这个作品设计的咋样，还有什么需要改进的

**点一次 ✨ 后，模型拿到的是**

> 请你以产品经理的视角，评审我提供的作品设计并给出改进建议。
>
> 作品信息如下（请按实际情况补充）：
> - 作品名称/类型：
> - 目标用户群体：
> - 要解决的核心需求或痛点：
> - 核心功能与主要使用流程：
> - 设计材料：附设计稿/截图/原型链接/文字说明：
>
> 请重点从以下维度分析：
> 1. 目标用户与核心需求是否明确、痛点是否真实存在
> 2. 功能设计与使用场景是否匹配，是否有冗余功能或关键功能缺失
> 3. 使用流程与交互是否顺畅，用户上手成本如何
> 4. 与同类产品或替代方案的差异和优势
> 5. 可行性（技术、成本、资源）与商业价值
>
> 输出要求：
> - 先给出整体评价，包括主要优点和最关键的问题
> - 再按优先级（高/中/低）列出可落地的改进建议，每条建议说明理由和预期效果
> - 如果信息不足影响判断，请先列出需要我补充的信息，不要凭空假设

**差别在哪**：原话是"看看咋样"，模型只能泛泛而谈；润色后是一份完整的评审任务书——
先列清单要你补齐作品信息（模型不必瞎猜）、锁定五个评审维度、规定"整体评价 → 分级建议 →
先要材料"的输出结构。改的是**任务的完整度**，不是措辞漂不漂亮。

## 功能一览

- ✨ 输入框旁一键润色：系统提示词 / 用户提示词 / 迭代优化 三个模式，流式输出
- 结果三选一：复制（只进剪贴板）、替换草稿（写回不发）、发送草稿（写回并发送）
- 每次结果带元信息：模型 · 耗时 · 字数 · token
- 本机历史（授权制）：版本链、单条删除、整链删除、清空；数据只在本机 localStorage
- 对比版本链：原稿 | 所选版本 | 最新版本 三列并排 + 本机结构分析（不调模型）
- 变量提取：把可变片段抽成 `{{变量}}`，一键写回成模板

## 它做什么

在对话输入框里写好一句话，点 `✨ 润色`，弹层面板流式给出优化后的提示词。
默认落在「替换草稿」上——**写回输入框但不发消息，也绝不执行提示词**，你自己看过再按回车；
想一步到位就点「发送草稿」。

### 面板顶部是一条轴，不是三个风格按钮

标签行是上游的 `OptimizationMode`：**这条提示词是系统提示词还是用户提示词**，它决定用哪个模板族。

| 优化对象 | 模板族（`templateType`） | 可选模板 | 处理器实际发出的消息 |
| --- | --- | --- | --- |
| 系统提示词 | `optimize` | 通用优化 | **2 条**：`system` = 模板正文**不经渲染**，`user` = 待优化原文**裸传** |
| 用户提示词 | `userOptimize` | 基础优化 / 专业优化 | `system` + `user` 两条，**都过 mustache** |
| 迭代优化 | `iterate` | 通用迭代 | `system` + `user` 两条，都过 mustache |

两条路的差别是**处理器造成的，不是模板文案造成的**（`processor.js` 的 `buildMessages`）：
裸字符串模板整个跳过渲染，因为 LangGPT 骨架里那些 `{{变量}}`、`[角色名称]` 是**留给模型填的**，
一渲染就被当变量吃掉；消息数组模板才需要 mustache，因为它们的分支和 JSON framing 在那儿。
防执行指令也因此只存在于数组族，且位于 **user** 消息里紧挨待优化正文。

模板与模式的清单由宿主 `GET /prompt-polish/models` 一并下发（含每个模板解析出来的
`variables` 和 `simple` 标记），面板照单渲染；浏览器侧不再另写一份常量。

## 渲染层（这轮补上的核心）

上游把模板交给真的 `mustache` 包。这个 profile 装不了它 —— `node_modules` 里没有，
而在 profile 里跑 `pnpm install` 会把手工复制进去的包剪掉 —— 所以 `lib/mustache.js`
实现了一个语义一致的子集：`{{x}}`（HTML 转义）、`{{{x}}}` 与 `{{&x}}`（原样）、
`{{#x}}…{{/x}}`、`{{^x}}…{{/x}}`、`{{!注释}}`、`{{>partial}}`、`{{.}}` 与 `{{a.b}}`、
以及 section 压入的上下文栈。`mustache.test.mjs` 34 项锁住这些语义。

两处是**刻意决定**，不是偷懒：

1. **lambda 的返回值原样插入，绝不二次渲染。** 用户提示词里本来就可能有 `{{风格}}`；
   渲染一遍就会去查这个 slot，查不到就把它删掉 —— 正是上游注释里
   "自动保留值中的占位符"要防的事。
2. **`{{=<% %>=}}` 是 mustache 规范的 Set Delimiter，不是手把斯语法。** 出厂模板靠它在
   正文里写字面 `{{变量}}`（"已有 `{{变量}}` 就别重复提取"）。不支持它，这句话就会被渲染成
   "已有 ，就…"，指令失真。

3. **守卫只加在会渲染的族上，反过来也是。** 移植 `iterate` / `user-prompt-professional` 时我把
   上游的 `{{=<% %>=}}{{location_theme}}<%={{ }}=%>` 写成裸 `{{location_theme}}`，于是这句"要保住
   占位符"的指令自己被渲染空了，正文变成「双花括号变量占位符（例如 ）」，`referencedVariables`
   还连带把 `location_theme` 当成输入变量上报（`{{...}}` 更阴 —— 它是个合法标签名，按 `.` 切完
   漏出一个**空字符串**变量名）。反过来，`general-optimize` 是**字符串**族、永不渲染，
   上游在那里就是裸写 `{{variable_name}}`；给它套上分隔符切换等于把 `{{=<% %>=}}` 这串语法
   原样漏给模型。**判据是这一族会不会过渲染，不是"看到字面量就包"。**

`TemplateContext` 与上游 `resolveOptimizationMessages` 同构：

```
originalPrompt, optimizationMode, contextMode, renderPhase: "optimize",
tools, hasInputImages, inputImageCount, inputImagesJson,   // 清单只有 index/label/mimeType，不含字节
customVariables, conversationMessages,
conversationContext = "ROLE: content" 空行连接, toolsContext = "Tool name: …\nParameters: <pretty>"
```

`createExtendedContext` 保留上游的优先级：**内置变量赢**，自定义变量不得覆盖 `originalPrompt`。

注册表（`lib/prompts.js`）不再是常量：`registerTemplate` 会在**注册时**用解析出的引用名和
声明的 `fields` 做双向核对（引用未声明 / 声明未使用都拒绝），**按集合比、不按顺序**
——`referencedVariables` 走解析树所以天然有序，`fields` 是模板的自然写法，把顺序当语义会
误拒出厂的 `iterate`；未闭合的 mustache 也当场拒。出厂的数组模板现在也逐个重新注册一遍来过
这道闸（见上面第 13 节测试），不再因为写在静态字面量里而绕过它。
`getDefaultTemplateId` 带上游那套兜底链（`optimize↔userOptimize` 互兜，`iterate` 退到任一优化族）。

## 变量抽取（独立一次调用）

上游 `VariableExtractionService` 是**独立服务**，不是优化器的一个模式，所以这里也是独立路由
`POST /prompt-polish/extract-variables`，非流式、JSON 进 JSON 出。上下文是上游那三件套：
`promptContent`、`existingVariableNames`（空时为字面量 `"None"`）、`hasExistingVariables`。

- 响应解析沿用上游顺序：抠 ` ```json ` 围栏 → 修复 → `JSON.parse` → **逐字段严格校验**
  （`name`/`value`/`position.originalText`/`position.occurrence ≥ 1`/`reason`）。
- 上游用 `jsonrepair` 包；这里用一个**刻意更窄**的替代（尾逗号、多余围栏、对象外的散文）。
  超出范围的错误** loudly 失败** —— 这么严格的 schema 下，静默"修好"的变量表会把错字塞进用户提示词。
- `applyVariables` 按 `originalText` 第 `occurrence` 次出现替换成 `{{name}}`，**从后往前**替换
  以免偏移。两个跨度只要有字符重叠就整次抛错（模型完全可能同时返回 `春天` 和 `春天的河`，
  交错替换会把 `{{名}}` 塞进词中间）；定位不上也抛，**绝不半改**。这条不是上游代码
  （上游在 app 层做），但没它这功能没意义。
- 套用是**尽力而为，不是第二道闸门**：变量名和值本身有用，所以位置对不上时路由仍返回 200，
  只是 `templated: null` 外加 `templatedError`。面板保留变量列表、只禁用「写回模板」，
  并把宿主给的原因原话放进 `title`。**没有**把整次抽取报成 502。
- 套用后的文本由宿主一起返回，浏览器不重复实现那套偏移算术。

面板上：有结果后出现「提取变量」，列出 `{{名}} = 值 · 理由` 与摘要，再出现「写回模板」
把带占位的版本写回输入框（**不发送** —— 抽完变量就是要继续编辑）。

## 与 prompt-optimizer 对齐的三条硬规则

1. **草稿以 JSON 传递**——上游的 `helpers.toJson` 是原样搬过来的（`() => (text, render) =>
   JSON.stringify(render(text))`），编码只发生在值上，所以用户文本里的引号、换行、代码块逃不出数据通道。
2. **`{{占位符}}` 逐字保留**——那是用户的槽位，不许翻译、改名、删除。
3. **只输出提示词本身**——无引导语、无解释、不用代码块包围；服务端仍会兜底剥离围栏。

注意第 1 条的边界：`optimize` 族（系统提示词）**上游本来就不做 JSON framing，也没有防执行指令**，
它把待优化原文作为**独立的 user 消息裸传**。这里按上游保真处理，只保留第 3 条的服务端剥离兜底。

## 组成

```
package.json          dsh.client 声明（platform: web）
lib/index.js          Host 半：三条路由（optimize 流式 / extract-variables / models）
lib/mustache.js       mustache 子集渲染器（含 Set Delimiter、section lambda、上下文栈）
lib/processor.js      TemplateContext 组装 + buildMessages（两族形状在此分叉）
lib/prompts.js        模板注册表（getTemplate / getDefaultTemplateId / registerTemplate）
lib/templates-generated.js  **机器生成**，别手改：上游 5 个模板正文由 gen-templates.mjs 抽取
gen-templates.mjs     从上游 template.ts 抽正文 → 生成上面那个模块（手抄曾吃掉占位符，故禁手抄）
compare-upstream.mjs  审计：注册表里每个模板与上游逐字比对，一条不剩地报 IDENTICAL
lib/extraction.js     变量抽取响应解析 + 按位置套写成 {{变量}} 模板
lib/client.js         浏览器半：手写 __ModuleLoader__ 自注册包，无构建步骤
check-patch.mjs       校验 profile 的 cordis.patch.yml
install.ps1           复制进 profile + 语法检查 + 补丁校验 + 跑全部测试
```

浏览器半不持有任何密钥，也不直连模型；它只调用本机 Host 路由。

## 润色用哪个模型

面板底部有个下拉框，默认**跟随输入框当前模型**，也可以钉住一个（存在
`localStorage` 的 `dsh.prompt-polish/model`，格式 `provider/model`）。

这不是锦上添花，正是第一版"点了没反应"的根因：输入框可以切到 `wan2.7-image`
这类**图像模型**，它无法回答文本改写，供应商只回一句
`InvalidParameter: Unsupported model`。而 `LlmModelInfo` 只有 `inputModalities`，
**没有输出模态字段**，所以宿主侧无法可靠判断"这个模型不能出文本"——
能做的就是把选择权交给人，并在失败时把模型名说清楚。

## 面板底部的按钮

文案统一成"四字、动词开头、宾语一致"，其中「替换草稿」与「发送草稿」只差一个动词，
正好对应它们唯一的区别：

| 按钮 | 出现时机 | 做什么 | 不调用什么 |
| --- | --- | --- | --- |
| 开始优化 / 重新生成 | 空闲 | 没有结果时读「开始优化」，有结果时读「重新生成」。用**冻结的那份源文本** + 当前模板再跑一次；切换标签或模板会自动重跑，`迭代优化` 例外，要先填改进意见 | 不写回输入框 |
| 提取变量 | 有结果 | 另一次调用（`extract-variables` 路由 + 上游抽取模板），列出结果里可参数化的片段 | 不碰输入框 |
| 写回模板 | 已提取 | `setDraft(templated)` —— 把片段换成 `{{变量}}` 占位后写回，**不发送**：抽完变量就是要接着编辑 | 不调 `submit()` |
| 替换草稿 | 有结果 | `inputActions.setDraft(result)` —— 把结果写回输入框，**不发送**，你还能自己改两句再按回车。这是主按钮 | 不调 `submit()` |
| 发送草稿 | 有结果 | `setDraft(result)` 之后立刻 `submit()` —— 写回并直接发出这条消息 | — |

「开始优化」这个别名不是文案花样：早期版本按钮在无结果时是禁用的，而迭代改进意见为空时
自动运行又被刻意跳过，两条合起来让 `迭代优化` 在"面板打开后第一次运行失败"这条路径上**根本点不动**。

生成中时第一个按钮会变成「停止」（`abortRef.current.abort()`，同时掐掉 fetch 与宿主侧的模型流）。

`submit()` 走的是输入框正常回车那条路（`InputActions.submit` → `this.submit("queue")`），
所以**当前有回合在跑时这条消息会排队，而不是打断**。

`setDraft()` 后能立刻 `submit()` 是查证过的，不是想当然：`setDraft` 底层是
`editor.update(..., { discrete: true })`，Lexical 的 discrete 会同步冲刷更新监听器，
`onEditorUpdate()` 在 `setDraft` 返回前就把 `projection.clipboardText` 写好了，
而 `submit()` 读的正是这个字段 —— 所以不会发出旧文本。`contract.test.mjs` 里有一条
断言把这个**顺序**钉死：`[["setDraft", 结果], ["submit"]]`。

## 面板行为（以 docs.always200.com 为准绳）

- **每族的默认模板由服务端说了算**：`/prompt-polish/models` 附带 `defaults`，
  用户族默认「专业优化」（quick-start 原文），客户端不写死 id。
- **按钮禁用必须可解释**：开始优化在「目录未载入 / 输入框为空 / 迭代缺改进意见」时置灰，
  且 `title` 写明缺什么（troubleshooting 页把"为什么是灰的"当一等公民）。
- **结果区自带复制按钮**（`pp-btn pp-mini`，对应上游结果工作区的复制动作）：
  只写剪贴板，不动草稿、不发送；`navigator.clipboard` 缺失时退回 `execCommand`。
- **结果元信息**：`模型 X · 耗时 Y.Ys · N 字 · tok in→out`。usage 来自流的
  `{type:"usage"}` chunk（宿主转发、按需缺省）；耗时在完成时一次性计算，没有滴答计时器。
- **流式渲染节流 60ms**：300 delta 从 310 次全板渲染降到 ~20-70 次；
  done/abort/error 三条终态路径都无条件写最终文本，节流不可能吃掉尾巴。
- **目录缓存**：模块级 30s TTL + 同飞请求合并，重挂载不再重复打 `/models`。
- **智能火苗（本机判分，零模型调用）**：草稿越"没说清"火越旺——
  短、缺动作要求、缺输出形式、缺背景、用词模糊（"随便/优化一下"）都会加分，
  burn 提示"看起来还没说清：…"，ember 调暗呼吸，quiet 只剩余光；
  打开历史时火自动静默。纯字符串评分（`scoreDraft`），不修改用户文字，也不拦发送。
- **历史 v2：授权制 + 版本链**。首次成功生成后先弹授权卡
  （"只保存在这台设备上…可随时清空"），选「开启历史」才落盘、选「不保存」就清空且不再询问
  （历史页可随时重新开启）。数据格式 `{ schemaVersion:2, consent, entries }`，
  旧的裸数组自动迁移为 consent:"granted"。每次成功生成记一个**版本**：
  iterate 挂在它所改写的版本下（parentId/rootId），普通运行开新链；
  上限 50 条按"整条最老的链先删"裁剪，删单条时子版本自动接回上一版。
  展开卡片可见当时的输入、结果与 token 句子，并支持
  复制结果 / 写回输入框 / 对比版本链 / 删除此版 / 删除整条链 / 清空全部。
  localStorage 不可用时静默降级，绝不影响一次生成。
- **对比版本链（本机结构分析）**：历史卡「对比版本链」打开
  原稿 | 所选版本 | 最新版本 三列（窄面板自动叠放），中间列可切版本；
  底部"结构变化（本机分析）"给出 行数增删（行级 LCS，400 行封顶退化为估算）
  与 目标/背景/约束/输出格式 四个角色的覆盖变化——全部本地确定性计算，零模型调用。
- **token 消耗可见**：结果区每次成功后显示
  "本次 N 输入 + M 输出 = T tokens"；历史卡片与对比页同样显示；
  provider 未上报时显示"本次用量未提供"（绝不显示假 0）；
  链条汇总在部分版本缺用量时如实标注"其中 X 次未提供"。
- **按钮规范**（全部走 `--dsw-*` 主题令牌）：高度 28/26/24，圆角 9/8/7，
  状态齐 默认/hover/active/disabled/focus-visible；footer 里按钮 `flex:0 0 auto` +
  `nowrap` 永不压缩（「替换草稿」吞字的根因就是可压缩+定高裁切），meta 用省略号让位。
  座位按钮（✨ 润色）是唯一例外：它按用户要求做成"活火"，用固定暖色 + 呼吸动画，
  因为火在任何主题下都是暖的。

## 安装状态

已装进本 profile：

- 包体：`%USERPROFILE%\.dsh\profiles\desktop\node_modules\@mimo-ai\dsh-client-ui-prompt-polish\`
- 插件行：`cordis.patch.yml` 里的 `- insert:` 块

```yaml
- insert:
    - id: prompt-polish
      name: "@mimo-ai/dsh-client-ui-prompt-polish"
```

包是手工复制进 profile 的 `node_modules` 的；在 profile 里再跑 `pnpm install`
（例如装别的 bundle）可能把它剪掉，重跑 `install.ps1` 即可恢复。

## 接入 DSH 时踩到的四条硬约束

这三条都不是猜测，是读 `cordis-plugin-include` / `dsh-llm` 源码 + 探针验证出来的：

1. **新插件必须写在 `- insert:` 里。** 裸的 `- id: <新id>` 行会被当成"对已存在条目的覆盖"，
   匹配不到就 `warn("patch insert: ...")` 后**静默丢弃**——不报错、不日志、界面上什么都没有。
   第三方 bundle（`dshmarket`）正是用 `insert:` 挂自己的行。
2. **改 Host 半代码必须重启 DSH；浏览器半在有 `pnpm run dev:web` watcher 时刷新页面即可，本环境没跑 watcher，两半都要完整重启应用。**
   把 `name` 换成 `file:///...index.js?rev=N` 绕过 ESM 缓存**并不能**让宿主重新导入——
   实测新代码里注册的路由始终 405（等同不存在），而旧代码注册的路由返回 401。
   只有 bundle 组合（增删行）会热重放。
3. **`StreamChunk.finish` 的 `reason` 是判别联合对象，不是字符串。**
   `{kind:'stop'} | {kind:'tool-calls'} | {kind:'max-tokens'} | {kind:'aborted', failure} | {kind:'error', failure}`。
   写成 `reason === "error"` 永远不成立，于是任何真实失败都会被降级成"模型没有返回内容"，
   把 `failure.message` 全部吞掉。这是第一版报错看不出所以然的直接原因。
4. **模板里的 `system` 角色必须放在 `messages[0]`，且不能再传 `options.system`。**
    `dsh-llm-pi-ai` 的 `splitSystemPrompt()`：`options.system` 一旦有值就以它为准，然后把
    `messages` 里 `role:"system"` 的那条**折叠成 user 轮次**（`textOnlyContext` 里
    `messages.push({ role: "user", content: flattenText(message) })`）——人格设定静默降级成
    普通输入。只有省略 `options.system`、且首条是 system 时，它才成为真正的 `systemPrompt`。
    另外 `flattenText` 内部是 `message.content.filter(...)`，所以 `content` 必须是**块数组**，
    给纯字符串会直接抛。`host.test.mjs` 用 `seenSystem.at(-1) === undefined` 把这条钉住。

## 测试

```
node mustache.test.mjs   # 渲染引擎：34 项，转义/反转/点号/Set Delimiter/lambda 不二次渲染
node smoke.mjs           # 模板层：219 项，族/消息形状/fields↔引用集合相等/JSON 转义/正文占位符保真
node contract.test.mjs   # 浏览器半：117 项，跑真 useEffect + 假流式 fetch，逐个点控件并验调用顺序
node host.test.mjs       # Host 半：164 项，假 webServer/llm 跑通三条路由、线协议校验与抽取的失败路径
node compare-upstream.mjs  # 不是测试是审计：把每个模板正文和上游 template.ts 逐字比对
node check-patch.mjs     # 校验 profile 的 cordis.patch.yml 仍可解析且 insert 行完好
pwsh -File install.ps1   # 上面全部，外加复制与语法检查
```

夹具的 `finish` chunk 必须用 `{kind: ...}` 对象形状——用字符串会把上面第 3 条那个
bug 洗成"测试通过"（第一版正是如此：31 项全绿，却依然把真实失败吞成空结果）。

同理，contract 的 vm 沙箱必须提供浏览器全局（`setTimeout`/`clearTimeout`/`navigator`）：
节流改造后曾出现沙箱缺 `setTimeout`，每次假流都在第一个 delta 处改走 error 路径，
而 fixture 的 delta 文本恰好等于最终文本，结果断言全部照过——只有
「成功运行不得渲染 pp-err」这条反掩盖断言能钉住它，别删。

## 未移植（与上游的已知差距）

上游 `packages/core` 里这几块我没做，别当成已实现：

| 上游能力 | 证据 | 现状 |
| --- | --- | --- |
| 图像 | `FunctionMode = "basic"\|"pro"\|"image"`；`ImageSubMode = text2image\|image2image\|multiimage`；`OptimizationRequest.inputImages`；`PromptService` 构造注入 `imageUnderstandingService`；有图时 `splitMultimodalMessages` → `understand({modelConfig, systemPrompt, userPrompt, images})` | **没有**。注意上游是**一次调用换个载体**，不是"先看图再优化"。DSH 侧另有硬约束：`InputState` 只有 `attachmentIds`，注释明写 "browser objects stay in ConversationController"，输入框附件的字节拿不到。带 `inputImages` 的请求会被明确拒绝，不会静默丢弃 |
| Pro 多消息 / 变量填值 | `MessageOptimizationRequest{selectedMessageId, messages}`、`ConversationMessage.originalContent`、`contextMode`、`advancedContext{variables,messages,tools}`、`variable-value-generation` | **部分**：`advancedContext` 与 `contextMode` 服务端已接好并能渲染；但面板只能优化输入框这一条草稿，多消息选择与变量自动填值没有入口 |
| 评测 | `evaluation/`、`evaluation-rewrite/`、`evaluation-structured-compare/` 模板族 | 无 |
| 非图像模板 | `optimize`×5、`userOptimize`×3、`iterate`×2 | **10/10 已装**，除 `output-format-optimize`：它读 `selectedMessage`/`conversationMessages`/`contentTooLong` 这些**会话选取**变量，本插件线协议不携带，硬装只会渲染出一堆空段落 —— 比不装更糟（理由写死在 `NOT_PORTED`）。选择器按族动态列出，模板由 `gen-templates.mjs` 抽取、`compare-upstream.mjs` 逐字审计 |
| 图像 / 上下文变体模板 | `text2imageOptimize`×5、`image2imageOptimize`×3、`multiimageOptimize`、`conversationMessageOptimize`×3、`context/*` | 未移植。注册表允许直接 `registerTemplate` 补，不必改处理器 |
| 流式与工具 | `optimizePromptStream`、`iteratePromptStream`、`sendMessageStreamWithTools` | 优化走流式；抽取非流式（上游亦如此）；工具调用没有 |

变量抽取（`variable-extraction`）**已**接成独立路由，见「变量抽取」一节。

上游"两步优化"这个说法，我在当前 `packages/core` 里**没找到**对应开关：
`optimizePrompt` 全程只发一次模型调用（渲染 → 发出，中间没有第二步）。因此不写进已实现清单。

## 许可

模板文本逐字移植自 prompt-optimizer（AGPL-3.0），出处见每个模板的 `id` 与其 `metadata` 注释。
个人本地使用无碍；若对外分发这份插件，需按 AGPL-3.0 提供对应源码并保留出处说明。

# 上架 dshmarket 指南（dsh-prompt-polish）

市场目录来自 [awesome-dsh-plugin.com](https://awesome-dsh-plugin.com)（`plugins.json`），
条目以 PR 形式加进它的源仓库；市场安装时优先走 npm 包，其次 git URL。

## 0. 先发 npm（强烈推荐）

市场条目的 `npm` 字段指向一个已发布的 npm 包，安装体验最好（走镜像、可回滚）：

```powershell
cd dsh-prompt-polish
npm login
# 首次发布 scoped 包需要声明公开：
npm publish --access public
```

包名用 `@mimo-ai/dsh-client-ui-prompt-polish`（或改成你自己的 scope，记得同步改
package.json 的 name、cordis.patch.yml 的 name、install-plugin.ps1 里的路径）。

不想发 npm 也可以：条目的 `url` 指向 GitHub 仓库即可，市场用 `git+https://…` 安装。

## 1. 提交目录条目

1. 打开 awesome-dsh-plugin 的 GitHub 仓库（插件页底部有 repo 链接），
   编辑它的 `plugins.json`（或按仓库 README 的说明提交）。
2. 把 `market/plugins-entry.json` 的内容追加进 `plugins` 数组，
   并把 `<your-github-username>` 替换成你的账号。
3. `category` 必须是目录接受的分类 id（现用 `agi`，提交前对照现有条目改对）。
4. 提 PR；合并后市场首页就会出现本插件，`install` 命令为：

```powershell
dsh plugin --profile web add @mimo-ai/dsh-client-ui-prompt-polish
```

## 2. desktop profile 的说明（写进你的 README）

desktop profile 由 Electron 应用独占管理（`dsh plugin --profile desktop …` 会报
`managed exclusively by the Electron application`），所以桌面用户走仓库里的
`install-plugin.ps1 -ProfileName desktop`，脚本完成同样的复制 + patch 追加。

## 3. 兼容性声明（建议）

在 package.json 里加 `engines.dsh` 或对 `@deepseek-ai/*` 的 `peerDependencies` 范围，
市场会在发现页显示兼容性预检结果（dshmarket 的 discovery-compatibility 模块读取它）。

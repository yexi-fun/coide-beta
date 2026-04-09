# coide-beta

本项目基于 [vicmaster/coide](https://github.com/vicmaster/coide) 修改，当前作为 `coide-beta` 维护，属于面向 Windows 的衍生版本。

一个面向 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 的桌面 GUI 客户端，对你已经在使用的 CLI 做了一层图形界面封装。使用相同账号、相同订阅，无需 API Key。

项目基于 Electron、React 和 TypeScript 构建。当前分支保留了本地已安装 Claude Code / SDK 相关集成路径，并在其上增加了更完善的桌面 UI。

## 功能特性

**聊天与会话**
- 流式响应，支持 Markdown 渲染和代码高亮（shiki）
- 支持多轮对话与会话持久化
- 会话管理：创建、切换、删除、自动命名、历史搜索
- 为每个会话选择工作目录
- 编辑并重新运行历史消息
- 复制整段对话或单条回复
- 中文优先界面，支持应用内中英切换
- 键盘快捷键（Cmd+K 清空、Cmd+N 新建会话、Cmd+[/] 切换、Esc 停止）

**工具调用与权限**
- 可折叠的工具调用卡片，实时展示输出
- 带上下文的权限弹窗，可在批准前查看 Claude 想执行的操作
- 文件修改可视化 diff 查看器（Monaco Editor），支持 Accept/Reject
- 拒绝后可自动回滚文件
- 跳过权限开关，支持自动批准模式

**右侧面板**
- **Agent Tree**：实时展示子 Agent 层级、状态、耗时和 token 数量，并提供时间线视图显示并行执行情况，可取消运行中的 Agent
- **Todo List**：实时任务跟踪，带进度条、状态点和可折叠说明
- **Context Tracker**：跟踪 token 使用量，带颜色进度条、输入/输出/缓存明细以及已修改文件列表
- **File Changelog**：记录当前会话中所有被修改的文件，提供累计 diff 和一键回滚

**侧边栏**
- 带项目目录标签的会话列表
- Skills 浏览器，可直接运行 Claude Code skills
- 命令面板，支持内置命令和斜杠命令自动补全

**集成终端**
- 完整终端模拟器（xterm.js），可运行构建、测试、服务和交互式程序
- 支持多标签页创建与关闭
- 可拖拽调整大小的面板
- 支持通过 Cmd+J 或顶部按钮切换显示

**其他**
- 支持图片/截图拖拽上传
- 文件附件支持：拖拽或文件选择器上传 PDF、DOCX、XLSX、PPTX、CSV 和文本文件，并自动提取文本
- 会话内搜索，支持匹配高亮
- 智能自动滚动与一键跳转到底部
- 桌面通知
- 已添加兼容 OpenAI API 格式的第三方供应商设置界面
- 深色主题桌面 UI

## 前置要求

- 已安装并完成认证的 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- Node.js 20+
- Windows 10 / 11（本分支主要目标平台）

## 安装与初始化

```bash
git clone https://github.com/vicmaster/coide.git
cd coide-beta
npm install
npx electron-rebuild -f -w node-pty
```

## 开发

```bash
npm run dev
```

## 构建

```bash
npm run build      # 编译 TypeScript 并打包
npm run package    # 构建并生成可分发产物
```

## Windows 打包

本分支当前通过 `electron-builder` 支持 Windows 打包。

```bash
npm run package:win             # 生成便携版
npm run package:win:installer   # 生成 NSIS 安装版 .exe
npm run package:win:all         # 同时生成便携版和 NSIS 安装版
```

当前已验证的 NSIS 安装包输出路径：

```text
dist/Coide-0.12.0-x64.exe
```

说明：
- 默认情况下安装包未签名，如需消除 Windows 签名提示，需要额外配置代码签名。
- 为避免升级后因旧配置语言值导致渲染层黑屏，项目已兼容并自动归一化历史语言值，如 `Chinese`、`中文`。

## 架构

```text
Electron Main Process (Node.js)
├── node-pty 子进程 → Claude CLI（stream-json 输出）
├── 权限拦截与文件回滚系统
├── IPC bridge → Renderer
└── 进程管理（通过 SIGTERM 中止）

Electron Renderer Process (React)
├── 聊天 UI，包含 markdown、工具卡片和 diff 查看器
├── Sidebar（sessions、skills、commands）
├── Right Panel（agents、todo、context、files）
└── Zustand stores（持久化到 localStorage）
```

## 技术栈

| 层级 | 技术 |
|------|------|
| Shell | Electron 35、electron-vite、node-pty |
| UI | React 19、TypeScript、Tailwind CSS v3 |
| Editor | Monaco Editor（diff） |
| Terminal | xterm.js |
| Markdown | react-markdown、shiki |
| State | Zustand + persist middleware |

## 许可证

MIT

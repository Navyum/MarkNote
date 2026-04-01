# MarkNote Upstream Sync 操作手册

## 概述

MarkNote 是基于 [Yank Note](https://github.com/purocean/yn) 的定制化 fork。本手册描述如何将上游更新合并到本项目，同时保留所有定制化修改。

---

## 快速参考

```bash
# 日常同步上游（一条命令）
./scripts/sync-upstream.sh

# 修改了定制化内容后，更新 patch 文件
./scripts/update-patches.sh
```

---

## 一、项目 Remote 配置

| Remote | 地址 | 用途 |
|--------|------|------|
| `origin` | `ssh://git@144.34.226.23:7022/root/MarkNote.git` | 你的私有仓库 |
| `upstream` | `https://github.com/purocean/yn.git` | 上游原始仓库 |

首次配置（已完成，无需重复）：
```bash
git remote add upstream https://github.com/purocean/yn.git
```

---

## 二、Patch 文件清单

所有 patch 存放在 `.patches/` 目录：

### Premium 相关
| Patch | 说明 |
|-------|------|
| `001-premium-bypass.patch` | 跳过 Premium 验证，`getPurchased()` 始终返回 `true` |
| `002-premium-email.patch` | 联系邮箱 `yank-note@outlook.com` → `mark-note@outlook.com` |

### 品牌定制
| Patch | 说明 |
|-------|------|
| `003-brand-titlebar.patch` | 标题栏显示 "Mark Note"，支持 `currentFile.title` fallback |
| `004-brand-frontmatter.patch` | Front Matter 模板 APP_NAME + VuePress Front Matter 模板 |
| `005-brand-package.patch` | `package.json` 中 description 为 "Mark Note" |
| `006-readme.patch` | `README.md` / `README_ZH-CN.md` 定制内容 |
| `008-brand-name-global.patch` | 全局品牌名替换（20+ 文件：i18n、help 文档、HTML title 等） |
| `009-links-navyum.patch` | GitHub 链接 / copyright → Navyum |

### 功能增强
| Patch | 说明 |
|-------|------|
| `010-picgo-image-format.patch` | PicGo 图片上传格式选择（默认/HTML/HTML居中对齐） |

### 构建配置
| Patch | 说明 |
|-------|------|
| `007-ci-mac-only.patch` | GitHub Actions 只构建 Mac 平台 |
| `011-build-config.patch` | `electron-builder.json` 自定义 + notarize teamId 注释 |

### 二进制文件（不在 patch 中，需手动保护）

以下文件是你替换的自定义图标，无法用 text patch 管理：

```
build/micon.icns              # Mac 应用图标
build/test.icns               # 测试图标
src/main/assets/icon.png      # 主进程图标（已替换）
src/main/assets/icon_bak.png  # 原始图标备份
src/main/assets/micon.icns    # Mac 图标副本
src/renderer/assets/favicon.ico      # 浏览器图标（已替换）
src/renderer/assets/favicon_bak.ico  # 原始 favicon 备份
src/renderer/assets/icon.png         # 渲染进程图标（已替换）
src/renderer/assets/icon_bak.png     # 原始图标备份
```

> 如果上游更新了 `icon.png` 或 `favicon.ico`，合并时冲突选择保留你的版本（ours）。

---

## 三、日常同步操作

### 场景 1：常规同步上游

```bash
./scripts/sync-upstream.sh
```

脚本自动执行：
1. 检查工作区是否干净（不干净则终止）
2. `git fetch upstream`
3. 检查是否有新 commit（没有则退出）
4. `git merge upstream/develop`
5. 如有冲突 → 自动 accept upstream 版本
6. 依次应用所有 `.patches/*.patch`
7. 提交合并结果

### 场景 2：同步后推送到 origin

```bash
./scripts/sync-upstream.sh
git push origin develop
```

### 场景 3：patch 应用失败

脚本会提示哪个 patch 失败了。手动处理步骤：

```bash
# 1. 查看失败的 patch 内容
cat .patches/008-brand-name-global.patch

# 2. 手动尝试应用，查看冲突详情
git apply --3way .patches/008-brand-name-global.patch

# 3. 手动编辑冲突文件，解决冲突

# 4. 解决完毕后，重新生成 patch
./scripts/update-patches.sh

# 5. 提交
git add -A
git commit -m "Fix patch conflicts after upstream sync"
```

---

## 四、修改定制化内容

### 新增一处品牌名替换

1. 编辑对应文件，把 "Yank Note" 改为 "Mark Note"
2. 运行 `./scripts/update-patches.sh` 重新生成 patch
3. 提交改动 + 更新后的 patch 文件

### 新增一个全新的定制化功能

1. 正常开发、测试
2. 在 `scripts/update-patches.sh` 中新增一条 `git diff` 规则：
   ```bash
   git diff upstream/develop HEAD -- src/your/new/file.ts \
       > "$PATCH_DIR/012-your-feature.patch"
   ```
3. 运行 `./scripts/update-patches.sh`
4. 提交所有改动

### 删除一个定制化

1. 还原对应文件到上游版本：`git checkout upstream/develop -- path/to/file`
2. 删除对应 patch 文件
3. 从 `update-patches.sh` 中移除对应行
4. 提交

---

## 五、原理说明

```
你的代码 = 上游代码 + 定制化改动
                      ↑
                 提取为 patch 文件

同步流程:
  merge upstream → 接受上游版本（定制化暂时丢失）
                 → apply patches（定制化重新贴回）
                 → 最终代码 = 上游最新 + 你的定制化
```

Patch 通过**上下文行**（diff 中无符号的行）定位修改位置，然后执行删除/插入操作。

`git apply --3way` 支持智能三方合并，即使上下文有小幅变化也能成功定位。

---

## 六、注意事项

1. **同步前确保工作区干净**：先 commit 或 stash 未提交的修改
2. **不要直接编辑 patch 文件**：应修改源文件后运行 `update-patches.sh` 重新生成
3. **二进制文件需手动保护**：图标等二进制文件冲突时选择保留本地版本
4. **定期同步**：间隔越长，patch 失败概率越高（上游改动累积越多）
5. **同步后建议测试构建**：`yarn install && yarn build` 确认无编译错误

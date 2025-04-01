import type Token from 'markdown-it/lib/token'
import { Plugin, Ctx } from '@fe/context'
import { DOM_ATTR_NAME, FLAG_DEMO } from '@fe/support/args'

export default {
  name: 'image-hosting-picgo',
  register: (ctx: Ctx) => {
    const logger = ctx.utils.getLogger('plugin.image-hosting-picgo')
    const uploadActionName = 'plugin.image-hosting-picgo.upload'
    const settingKeyUrl = 'plugin.image-hosting-picgo.server-url'
    const settingKeyPaste = 'plugin.image-hosting-picgo.enable-paste-image'
    const settingKeyFormat = 'plugin.image-hosting-picgo.image-format'

    ctx.setting.changeSchema((schema) => {
      schema.properties[settingKeyUrl] = {
        title: 'T_picgo.setting.api-title',
        description: 'T_picgo.setting.api-desc',
        type: 'string',
        defaultValue: 'http://127.0.0.1:36677/upload',
        pattern: '^(http://|https://|$)',
        options: {
          patternmessage: 'T_picgo.setting.api-msg',
        },
        group: 'image',
      }

      // 在 setting.changeSchema 中添加配置项
      schema.properties[settingKeyFormat] = {
        title: 'T_picgo.setting.format-title',
        description: 'T_picgo.setting.format-desc',
        type: 'string',
        defaultValue: '![Img](url)\n',
        required: true,
        enum: [
          '![Img](url)\n',
          '<img src="url" />\n',
          '<p align="center"><img src="url" width="80%"></p>\n',
        ],
        group: 'image',
        options: {
          enum_titles: [
            'T_picgo.setting.format-default',
            'T_picgo.setting.format-html',
            'T_picgo.setting.format-html-align',
          ]
        }
      }

      schema.properties[settingKeyPaste] = {
        title: 'T_picgo.setting.paste-title',
        type: 'boolean',
        format: 'checkbox',
        defaultValue: false,
        group: 'image',
      }

    })

    ctx.action.registerAction({
      name: uploadActionName,
      handler: async (file: File) => {
        if (FLAG_DEMO) {
          ctx.ui.useToast().show('warning', ctx.i18n.t('demo-tips'))
          return URL.createObjectURL(file)
        }

        const url = ctx.setting.getSettings()[settingKeyUrl]

        if (!url) {
          const msg = ctx.i18n.t('picgo.need-api')
          ctx.ui.useToast().show('warning', msg)
          ctx.setting.showSettingPanel()
          throw new Error(msg)
        }

        ctx.ui.useToast().show('info', ctx.i18n.t('picgo.uploading'), 0)

        logger.debug('upload', url, file)

        // remote mode, use multipart/form-data to upload
        if (url.includes('key=')) {
          const formData = new FormData()
          formData.append('file', file)

          try {
            const { result } = await ctx.api.proxyFetch(
              url,
              { method: 'post', body: formData, },
            ).then(r => r.json())

            ctx.ui.useToast().hide()

            if (result.length > 0) {
              return result[0]
            }
          } catch (error) {
            const msg = ctx.i18n.t('picgo.upload-failed')
            ctx.ui.useToast().show('warning', msg)
            throw new Error(msg)
          }

          return
        }

        const tmpFileName = 'picgo-' + file.name

        try {
          const { data: { path } } = await ctx.api.writeTmpFile(tmpFileName, await ctx.utils.fileToBase64URL(file), true)
          logger.debug('tmp file', path)

          const { result } = await ctx.api.proxyFetch(
            url,
            {
              method: 'post',
              body: { list: [path] },
              jsonBody: true,
            },
          ).then(r => r.json())

          ctx.ui.useToast().hide()

          if (result.length > 0) {
            return result[0]
          }
        } catch (error) {
          const msg = ctx.i18n.t('picgo.upload-failed')
          ctx.ui.useToast().show('warning', msg)
          throw new Error(msg)
        } finally {
          ctx.api.deleteTmpFile(tmpFileName)
        }
      }
    })

    ctx.registerHook('EDITOR_PASTE_IMAGE', async ({ file }) => {
      if (!ctx.setting.getSettings()[settingKeyPaste]) {
        return false
      }

      await insertImage(file)

      return true
    })

    async function insertImage (file: File) {
      if (!ctx.store.state.currentFile) {
        throw new Error('No file opened.')
      }
      const url = await ctx.action.getActionHandler(uploadActionName)(file)
      // 获取配置的图片格式
      const format = ctx.setting.getSettings()[settingKeyFormat] || '![Img](url)'
      // 替换占位符并插入编辑器
      const markdown = format.replace('url', url)// 自动换行

      ctx.editor.insert(markdown)
    }

    function addImage () {
      const input = window.document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.onchange = async () => {
        for (let i = 0; i < input.files!.length; i++) {
          await insertImage(input.files![i])
        }
      }
      input.click()
    }

    async function uploadLocalImage (srcAttr: string, originSrc: string) {
      if (srcAttr && originSrc) {
        const res: Response = await ctx.api.fetchHttp(srcAttr)
        const fileName = ctx.utils.path.basename(ctx.utils.removeQuery(originSrc))
        const file = new File(
          [await res.blob()],
          fileName,
          { type: ctx.lib.mime.getType(fileName) || undefined }
        )

        try {
          return await ctx.action.getActionHandler('plugin.image-hosting-picgo.upload')(file)
        } catch (error) {
          return null
        }
      }
    }

    async function uploadAllImage () {
      const tokens = ctx.view.getRenderEnv()?.tokens
      if (!tokens) {
        return
      }

      const currentDocChecker = ctx.doc.createCurrentDocChecker()

      const processImg = async (tokens: Token[]) => {
        for (const token of tokens) {
          currentDocChecker.throwErrorIfChanged()

          if (token.children) {
            await processImg(token.children)
          }

          if (token.tag === 'img' && token.attrGet(ctx.args.DOM_ATTR_NAME.LOCAL_IMAGE)) {
            const srcAttr = token.attrGet('src')
            const originSrc = token.attrGet(ctx.args.DOM_ATTR_NAME.ORIGIN_SRC)
            const url = await uploadLocalImage(srcAttr!, originSrc!)

            currentDocChecker.throwErrorIfChanged()

            if (url) {
              ctx.editor.replaceValue(
                ctx.utils.encodeMarkdownLink(originSrc!),
                ctx.utils.encodeMarkdownLink(url)
              )
            }
          }
        }
      }

      await processImg(tokens)
    }

    const addImageActionId = 'plugin.image-hosting-picgo.add-image'
    const uploadAllImageActionId = 'plugin.image-hosting-picgo.upload-all-image'

    ctx.editor.whenEditorReady().then(({ editor }) => {
      editor.addAction({
        id: addImageActionId,
        contextMenuGroupId: 'modification',
        label: ctx.i18n.t('add-image') + ' (PicGo)',
        run: addImage,
      })
    })

    ctx.statusBar.tapMenus(menus => {
      menus['status-bar-insert']?.list?.unshift({
        id: addImageActionId,
        type: 'normal',
        title: ctx.i18n.t('add-image'),
        ellipsis: true,
        subTitle: 'PicGo',
        onClick: addImage
      })

      menus['status-bar-tool']?.list?.push({
        id: uploadAllImageActionId,
        type: 'normal',
        title: ctx.i18n.t('picgo.upload-all-images'),
        subTitle: 'PicGo',
        onClick: uploadAllImage
      })
    })

    ctx.view.tapContextMenus((items, e) => {
      const el = e.target as HTMLElement

      if (
        el.tagName === 'IMG' &&
        el.getAttribute(DOM_ATTR_NAME.LOCAL_IMAGE)
      ) {
        const repo = el.getAttribute(DOM_ATTR_NAME.TARGET_REPO)
        if (repo === ctx.args.HELP_REPO_NAME) {
          return
        }

        items.push({
          id: 'plugin.image-hosting-picgo.upload-single-image',
          type: 'normal',
          ellipsis: false,
          label: ctx.i18n.t('upload-image') + ' (PicGo)',
          onClick: async () => {
            try {
              if (!ctx.store.state.currentFile) {
                throw new Error('No file opened.')
              }

              const srcAttr = el.getAttribute('src')
              const originSrc = el.getAttribute(DOM_ATTR_NAME.ORIGIN_SRC)!

              const url = await uploadLocalImage(srcAttr!, originSrc)
              if (url) {
                ctx.editor.replaceValue(
                  ctx.utils.encodeMarkdownLink(originSrc),
                  ctx.utils.encodeMarkdownLink(url)
                )
              }
            } catch (error: any) {
              ctx.ui.useToast().show('warning', error.message)
            }
          }
        })
      }
    })
  }
} as Plugin

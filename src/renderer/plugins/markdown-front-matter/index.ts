import type { Options } from 'markdown-it'
import type { Plugin } from '@fe/context'
import { processFrontMatter, useMarkdownItRule } from './lib'
import workerIndexerUrl from './worker-indexer?worker&url'

export default {
  name: 'markdown-front-matter',
  register: ctx => {
    const logger = ctx.utils.getLogger('markdown-front-matter')
    ctx.markdown.registerPlugin(md => {
      const render = md.render

      md.render = (src: string, env: any) => {
        const { attributes } = processFrontMatter(src, env)
        logger.debug('render', attributes)

        // save origin options
        const originOptions = { ...md.options }

        // set options
        if (attributes.mdOptions && typeof attributes.mdOptions === 'object') {
          Object.assign(md.options, attributes.mdOptions)
        }

        const result = render.call(md, src, env)

        // clear md.options
        Object.keys(md.options).forEach(key => {
          delete md.options[key as keyof Options]
        })

        // restore origin options
        Object.assign(md.options, originOptions)

        return result
      }

      useMarkdownItRule(md)
    })

    ctx.editor.tapSimpleCompletionItems(items => {
      /* eslint-disable no-template-curly-in-string */

      items.push(
        { label: '/ --- Front Matter', insertText: '---\nheadingNumber: true\nwrapCode: true\nenableMacro: true\nmdOptions: { linkify: true, breaks: true }\ndefine:\n    APP_NAME: Mark Note\n---\n', block: true },
        { 
          label: '/ --- VuePress Front Matter', 
          insertText: () => {
            const currentFile = ctx.store.state.currentFile
            const fullFileName = ctx.utils.path.basename(currentFile.path)
            const fileExtension = ctx.utils.path.extname(fullFileName)
            const title = fullFileName.replace(fileExtension, '')
            const author = ctx.setting.getSetting('plugin.plugin-front-matter.author') || 'navyum'
            const date = ctx.lib.dayjs().format('YYYY-MM-DD HH:mm:ss')

            return `---
title: ${title}
author: ${author}
date: ${date}

article: false
index: false
sidebar: false
headerDepth: 2
sticky: true
star: true

category:
  - \${1:使用指南}
tag:
  - \${2:页面配置}
  - \${3:使用指南}
---
`
          }, 
          block: true 
        }
      )
    })
    

    ctx.indexer.importScriptsToWorker(new URL(workerIndexerUrl, import.meta.url))
  }
} as Plugin 
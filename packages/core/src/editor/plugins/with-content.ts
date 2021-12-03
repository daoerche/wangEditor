/**
 * @description slate 插件 - content
 * @author wangfupeng
 */

import xmlFormat from 'xml-formatter'
import { Editor, Node, Text, Path, Operation, Range, Transforms, Element } from 'slate'
import { DomEditor } from '../dom-editor'
import { IDomEditor } from '../..'
import { EDITOR_TO_SELECTION, NODE_TO_KEY } from '../../utils/weak-maps'
import { node2html } from '../../to-html/node2html'
import { genElemId } from '../../formats/helper'
import { Key } from '../../utils/key'
import { DOMElement, getPlainText } from '../../utils/dom'
import { findCurrentLineRange } from '../../utils/line'
import { ElementWithId } from '../interface'

const IGNORE_TAGS = new Set([
  'doctype',
  '!doctype',
  'meta',
  'script',
  'style',
  'link',
  'frame',
  'iframe',
  'title',
  'svg', // TODO 暂时忽略
])

export const withContent = <T extends Editor>(editor: T) => {
  const e = editor as T & IDomEditor
  const { onChange, insertText, apply, deleteBackward } = e

  // 重写 apply 方法
  // apply 方法非常重要，它最终执行 operation https://docs.slatejs.org/concepts/05-operations
  // operation 的接口定义参考 slate src/interfaces/operation.ts
  e.apply = (op: Operation) => {
    const matches: [Path, Key][] = []

    const { readOnly } = e.getConfig()
    if (readOnly) return

    switch (op.type) {
      case 'insert_text':
      case 'remove_text':
      case 'set_node': {
        for (const [node, path] of Editor.levels(e, { at: op.path })) {
          // 在当前节点寻找
          const key = DomEditor.findKey(e, node)
          matches.push([path, key])
        }
        break
      }

      case 'insert_node':
      case 'remove_node':
      case 'merge_node':
      case 'split_node': {
        for (const [node, path] of Editor.levels(e, { at: Path.parent(op.path) })) {
          // 在父节点寻找
          const key = DomEditor.findKey(e, node)
          matches.push([path, key])
        }
        break
      }

      case 'move_node': {
        for (const [node, path] of Editor.levels(e, {
          at: Path.common(Path.parent(op.path), Path.parent(op.newPath)),
        })) {
          const key = DomEditor.findKey(e, node)
          matches.push([path, key])
        }
        break
      }
    }

    // 执行原本的 apply - 重要！！！
    apply(op)

    // 绑定 node 和 key
    for (const [path, key] of matches) {
      const [node] = Editor.node(e, path)
      NODE_TO_KEY.set(node, key)
    }
  }

  e.deleteBackward = unit => {
    if (unit !== 'line') {
      return deleteBackward(unit)
    }

    if (editor.selection && Range.isCollapsed(editor.selection)) {
      const parentBlockEntry = Editor.above(editor, {
        match: n => Editor.isBlock(editor, n),
        at: editor.selection,
      })

      if (parentBlockEntry) {
        const [, parentBlockPath] = parentBlockEntry
        const parentElementRange = Editor.range(editor, parentBlockPath, editor.selection.anchor)

        const currentLineRange = findCurrentLineRange(e, parentElementRange)

        if (!Range.isCollapsed(currentLineRange)) {
          Transforms.delete(editor, { at: currentLineRange })
        }
      }
    }
  }

  // 重写 onchange API
  e.onChange = () => {
    // 记录当前选区
    const { selection } = e
    if (selection != null) {
      EDITOR_TO_SELECTION.set(e, selection)
    }

    // 触发配置的 change 事件
    e.emit('change')

    onChange()
  }

  e.insertText = (s: string) => {
    // 若触发 maxLength ，则不继续插入
    //【注意1】拼音的 maxLength 限制，不在这里，在 compositionStart 和 compositionEnd 里处理
    //【注意2】粘贴的 maxLength 限制，在 insertData 和 insertFragment
    const res = DomEditor.checkMaxLength(e)
    if (res) {
      return
    }

    // 执行默认的 insertText
    insertText(s)
  }

  // tab
  e.handleTab = () => {
    e.insertText('    ')
  }

  // 获取 html
  e.getHtml = (opt: { withFormat?: boolean } = {}): string => {
    const { withFormat = true } = opt

    const { children = [] } = e
    let html = children.map(child => node2html(child, e)).join('')
    if (!withFormat) return html

    // 格式化 html ，需要包裹一个 div
    html = `<div>${html}</div>`
    html = xmlFormat(html, {
      collapseContent: true,
    })
    // 格式化完毕，去掉外层的 div
    html = html.replace(/\r\n\s{4}/g, '\r\n')
    html = html.replace(/^<div>\r\n/g, '')
    html = html.replace(/\r\n<\/div>$/g, '')
    return html
  }

  // 获取 text
  e.getText = (): string => {
    const { children = [] } = e
    return children.map(child => Node.string(child)).join('\n')
  }

  // 获取选区文字
  e.getSelectionText = (): string => {
    const { selection } = e
    if (selection == null) return ''
    return Editor.string(editor, selection)
  }

  // 根据 type 获取 elems
  e.getElemsByType = (type: string, isPrefix = false): ElementWithId[] => {
    const elems: ElementWithId[] = []

    // 获取 editor 所有 nodes
    const nodeEntries = Editor.nodes(e, {
      at: [],
      universal: true,
    })
    for (let nodeEntry of nodeEntries) {
      const [node] = nodeEntry
      if (Element.isElement(node)) {
        // 判断 type （前缀 or 全等）
        let flag = isPrefix ? node.type.indexOf(type) >= 0 : node.type === type
        if (flag) {
          const key = DomEditor.findKey(e, node)
          const id = genElemId(key.id)

          // node + id
          elems.push({
            ...node,
            id,
          })
        }
      }
    }

    return elems
  }

  // 根据 type 前缀，获取 elems
  e.getElemsByTypePrefix = (typePrefix: string): ElementWithId[] => {
    return e.getElemsByType(typePrefix, true)
  }

  /**
   * 判断 editor 是否为空（只有一个空 paragraph）
   */
  e.isEmpty = () => {
    const { children = [] } = e
    if (children.length > 1) return false // >1 个顶级节点

    const firstNode = children[0]
    if (firstNode == null) return true // editor.children 空数组

    if (Element.isElement(firstNode) && firstNode.type === 'paragraph') {
      const { children: texts = [] } = firstNode
      if (texts.length > 1) return false // >1 text node

      const t = texts[0]
      if (t == null) return true // 无 text 节点

      if (Text.isText(t) && t.text === '') return true // 只有一个 text 且是空字符串
    }

    return false
  }

  /**
   * 清空内容
   */
  e.clear = () => {
    const initialEditorValue: Node[] = [
      {
        type: 'paragraph',
        children: [{ text: '' }],
      },
    ]
    Transforms.removeNodes(e, {
      at: {
        anchor: Editor.start(e, []),
        focus: Editor.end(e, []),
      },
      mode: 'highest',
    })
    Transforms.insertNodes(e, initialEditorValue)
  }

  e.getParentNode = (node: Node) => {
    return DomEditor.getParentNode(e, node)
  }

  /**
   * 插入 DOMElement
   * @param domElem DOM Element
   */
  e.insertDomElem = (domElem: DOMElement) => {
    const tag = domElem.tagName.toLowerCase()
    if (IGNORE_TAGS.has(tag)) return

    const text = getPlainText(domElem)
    if (!text) return

    const lines = text.split(/\r\n|\r|\n/) // 换行
    const length = lines.length
    lines.forEach((line, index) => {
      e.insertText(line)
      if (index + 1 < length) {
        Transforms.splitNodes(e, { always: true }) // 插入换行
      }
    })
  }

  /**
   * 插入 html （不保证语义完全正确），用于粘贴
   * @param html html string
   */
  e.dangerouslyInsertHtml = (html: string = '') => {
    if (!html) return

    const div = document.createElement('div')
    div.innerHTML = html
    div.setAttribute('hidden', 'true')
    document.body.appendChild(div)
    Array.from(div.childNodes).forEach(child => {
      const { nodeType } = child
      if (nodeType === 1) {
        // DOM Element
        try {
          // 可第三方扩展，加 try 包裹
          e.insertDomElem(child as DOMElement)
        } catch (err) {
          // 出错，则插入文本
          const text = child.textContent
          if (text) e.insertText(text)
          console.error('insertDomElem error', child)
        }
      }
      if (nodeType === 3) {
        // DOM Text
        const text = child.textContent
        if (text) e.insertText(text)
      }
    })
    document.body.removeChild(div)
  }

  return e
}
